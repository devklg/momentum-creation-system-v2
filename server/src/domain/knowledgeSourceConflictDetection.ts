import { createHash } from 'node:crypto';
import type {
  McsAdminKnowledgeIntegrityStatus,
  McsKnowledgeSourceConflictClass,
  McsKnowledgeSourceConflictFingerprint,
  McsKnowledgeSourceConflictSeverity,
} from '@momentum/shared';
import {
  MCS_KNOWLEDGE_BASE_SOURCE_COLLECTION,
} from '@momentum/shared/runtime';
import { RESOURCE_CATALOG_MONGO_COLLECTION } from './resourceCatalogSchema.js';
import { persistenceCall } from '../services/persistence/dispatch.js';

const DATABASE = 'momentum';
const MAX_SOURCE_ROWS = 1_000;
const MAX_RESOURCE_ROWS = 1_000;
const PAGE_SIZE = 250;
const SAMPLE_LIMIT = 20;
const TEAM_SCOPE = {
  'scope.tenantId': 'tenant_team_magnificent',
  'scope.teamId': 'team_magnificent',
  'scope.teamKey': 'team_magnificent',
  'scope.teamName': 'Team Magnificent',
} as const;

const CONFLICT_CLASSES: readonly McsKnowledgeSourceConflictClass[] = [
  'active_source_ref_divergence',
  'active_source_identity_divergence',
  'resource_projection_digest_mismatch',
  'active_authority_state_mismatch',
  'active_exact_duplicate',
];

const SEVERITY: Record<McsKnowledgeSourceConflictClass, McsKnowledgeSourceConflictSeverity> = {
  active_source_ref_divergence: 'high',
  active_source_identity_divergence: 'critical',
  resource_projection_digest_mismatch: 'high',
  active_authority_state_mismatch: 'medium',
  active_exact_duplicate: 'advisory',
};

const SEVERITY_RANK: Record<McsKnowledgeSourceConflictSeverity, number> = {
  advisory: 1,
  medium: 2,
  high: 3,
  critical: 4,
};

interface SourceDocument extends Record<string, unknown> {
  _id?: unknown;
  sourceId?: unknown;
  version?: unknown;
  originalContent?: unknown;
  sourceRef?: unknown;
  domain?: unknown;
  language?: unknown;
  status?: unknown;
  authorityDecision?: unknown;
  authority?: unknown;
}

interface ResourceDocument extends Record<string, unknown> {
  _id?: unknown;
  resourceVersionId?: unknown;
  contentDigestSha256?: unknown;
  lineage?: unknown;
}

interface ValidSource {
  sourceId: string;
  version: number;
  digest: string;
  sourceRef: string | null;
  domain: string;
  language: string;
  active: boolean;
  approved: boolean;
}

interface ValidResource {
  resourceVersionId: string;
  digest: string;
}

interface ScanResult<T> {
  documents: T[];
  truncated: boolean;
  degradedReasons: string[];
}

type Persistence = typeof persistenceCall;

export interface KnowledgeSourceConflictDetectionInput {
  sources: readonly SourceDocument[];
  resources: readonly ResourceDocument[];
  sourceTruncated?: boolean;
  resourceTruncated?: boolean;
  degradedReasons?: readonly string[];
  computedAt?: string;
}

export function detectKnowledgeSourceConflicts(
  input: KnowledgeSourceConflictDetectionInput,
): McsAdminKnowledgeIntegrityStatus {
  const degradedReasons = [...(input.degradedReasons ?? [])];
  const sources: ValidSource[] = [];
  const resources: ValidResource[] = [];

  for (const document of input.sources) {
    const parsed = parseSource(document);
    if (!parsed) {
      degradedReasons.push('malformed_source_record');
      continue;
    }
    sources.push(parsed);
  }
  for (const document of input.resources) {
    const parsed = parseResource(document);
    if (!parsed) {
      degradedReasons.push('malformed_resource_record');
      continue;
    }
    resources.push(parsed);
  }

  const fingerprints = new Map<string, McsKnowledgeSourceConflictFingerprint>();
  const addConflict = (conflictClass: McsKnowledgeSourceConflictClass, comparisonKey: string) => {
    const fingerprint = digest(`${conflictClass}\u0000${comparisonKey}`);
    fingerprints.set(`${conflictClass}:${fingerprint}`, {
      conflictClass,
      severity: SEVERITY[conflictClass],
      fingerprint,
    });
  };

  const activeSources = sources.filter((source) => source.active);
  for (const source of activeSources) {
    if (!source.approved) {
      addConflict('active_authority_state_mismatch', `${source.sourceId}\u0000${source.version}`);
    }
  }

  for (const [key, group] of groupBy(activeSources, (source) => `${source.sourceId}\u0000${source.version}`)) {
    if (new Set(group.map((source) => source.digest)).size > 1) {
      addConflict('active_source_identity_divergence', key);
    }
  }

  const comparable = activeSources.filter((source) => source.approved && source.sourceRef);
  for (const [key, group] of groupBy(
    comparable,
    (source) => `${source.sourceRef}\u0000${source.domain}\u0000${source.language}`,
  )) {
    if (
      new Set(group.map((source) => source.sourceId)).size > 1 &&
      new Set(group.map((source) => source.digest)).size > 1
    ) {
      addConflict('active_source_ref_divergence', key);
    }
  }

  for (const [key, group] of groupBy(
    comparable,
    (source) => `${source.sourceRef}\u0000${source.domain}\u0000${source.language}\u0000${source.digest}`,
  )) {
    if (new Set(group.map((source) => source.sourceId)).size > 1) {
      addConflict('active_exact_duplicate', key);
    }
  }

  const resourcesByVersion = groupBy(resources, (resource) => resource.resourceVersionId);
  for (const source of activeSources.filter((candidate) => candidate.approved)) {
    const resourceVersionId = `knowledge:${source.sourceId}:v${source.version}`;
    const matches = resourcesByVersion.get(resourceVersionId) ?? [];
    if (matches.some((resource) => resource.digest !== source.digest)) {
      addConflict('resource_projection_digest_mismatch', resourceVersionId);
    }
  }

  const samples = [...fingerprints.values()]
    .sort((left, right) =>
      SEVERITY_RANK[right.severity] - SEVERITY_RANK[left.severity] ||
      left.conflictClass.localeCompare(right.conflictClass) ||
      left.fingerprint.localeCompare(right.fingerprint))
    .slice(0, SAMPLE_LIMIT);
  const allConflicts = [...fingerprints.values()];
  const counts = Object.fromEntries(
    CONFLICT_CLASSES.map((conflictClass) => [
      conflictClass,
      allConflicts.filter((entry) => entry.conflictClass === conflictClass).length,
    ]),
  ) as Record<McsKnowledgeSourceConflictClass, number>;
  const highestSeverity = allConflicts.reduce<McsKnowledgeSourceConflictSeverity | null>(
    (highest, entry) => !highest || SEVERITY_RANK[entry.severity] > SEVERITY_RANK[highest]
      ? entry.severity
      : highest,
    null,
  );
  const degradedCounts = countReasons(degradedReasons);
  const truncated = input.sourceTruncated === true || input.resourceTruncated === true;
  const status = truncated
    ? 'truncated'
    : degradedCounts.length > 0
      ? 'degraded'
      : allConflicts.length > 0
        ? 'conflicts'
        : 'clear';

  return {
    status,
    computedAt: input.computedAt ?? new Date().toISOString(),
    conflictCount: allConflicts.length,
    highestSeverity,
    counts,
    scan: {
      sourceLimit: MAX_SOURCE_ROWS,
      resourceLimit: MAX_RESOURCE_ROWS,
      sourcesObserved: input.sources.length,
      resourcesObserved: input.resources.length,
      complete: !truncated && degradedCounts.length === 0,
    },
    degradedReasons: degradedCounts,
    samples,
    mutationAuthorized: false,
  };
}

export async function observeKnowledgeSourceConflicts(
  persistence: Persistence = persistenceCall,
  now: () => Date = () => new Date(),
): Promise<McsAdminKnowledgeIntegrityStatus> {
  const [sourceScan, resourceScan] = await Promise.all([
    scanCollection<SourceDocument>(persistence, {
      collection: MCS_KNOWLEDGE_BASE_SOURCE_COLLECTION,
      filter: TEAM_SCOPE,
      projection: {
        _id: 1, sourceId: 1, version: 1, originalContent: 1, sourceRef: 1,
        domain: 1, language: 1, status: 1, authorityDecision: 1, authority: 1,
      },
      maxRows: MAX_SOURCE_ROWS,
      failureReason: 'source_scan_unavailable',
    }),
    scanCollection<ResourceDocument>(persistence, {
      collection: RESOURCE_CATALOG_MONGO_COLLECTION,
      filter: {
        tenantId: 'tenant_team_magnificent',
        teamId: 'team_magnificent',
        kind: 'knowledge_source',
      },
      projection: {
        _id: 1, resourceVersionId: 1, contentDigestSha256: 1,
        'lineage.sourceRecordId': 1, version: 1,
      },
      maxRows: MAX_RESOURCE_ROWS,
      failureReason: 'resource_scan_unavailable',
    }),
  ]);

  return detectKnowledgeSourceConflicts({
    sources: sourceScan.documents,
    resources: resourceScan.documents,
    sourceTruncated: sourceScan.truncated,
    resourceTruncated: resourceScan.truncated,
    degradedReasons: [...sourceScan.degradedReasons, ...resourceScan.degradedReasons],
    computedAt: now().toISOString(),
  });
}

async function scanCollection<T extends Record<string, unknown>>(
  persistence: Persistence,
  options: {
    collection: string;
    filter: Record<string, unknown>;
    projection: Record<string, 0 | 1>;
    maxRows: number;
    failureReason: string;
  },
): Promise<ScanResult<T>> {
  const documents: T[] = [];
  const degradedReasons: string[] = [];
  let cursor: string | null = null;

  try {
    while (documents.length < options.maxRows) {
      const limit = Math.min(PAGE_SIZE, options.maxRows - documents.length);
      const result: { documents?: T[]; count?: number } = await persistence<{
        documents?: T[];
        count?: number;
      }>('mongodb', 'query', {
        database: DATABASE,
        collection: options.collection,
        filter: cursor ? { ...options.filter, _id: { $gt: cursor } } : options.filter,
        projection: options.projection,
        sort: { _id: 1 },
        limit,
      });
      const page: T[] = result.documents ?? [];
      if (page.length === 0) {
        if ((result.count ?? 0) > 0) degradedReasons.push('incomplete_scan_page');
        return { documents, truncated: false, degradedReasons };
      }

      let previous: string | null = cursor;
      for (const document of page as T[]) {
        const id: string | null = typeof document._id === 'string' ? document._id : null;
        if (!id || (previous !== null && id <= previous)) {
          degradedReasons.push('invalid_scan_cursor');
          return { documents, truncated: false, degradedReasons };
        }
        documents.push(document);
        previous = id;
      }
      cursor = previous;
      if (page.length < limit) {
        if ((result.count ?? page.length) > page.length) degradedReasons.push('incomplete_scan_page');
        return { documents, truncated: false, degradedReasons };
      }
    }

    const probe = await persistence<{ documents?: T[] }>('mongodb', 'query', {
      database: DATABASE,
      collection: options.collection,
      filter: { ...options.filter, _id: { $gt: cursor } },
      projection: { _id: 1 },
      sort: { _id: 1 },
      limit: 1,
    });
    return { documents, truncated: (probe.documents?.length ?? 0) > 0, degradedReasons };
  } catch {
    degradedReasons.push(options.failureReason);
    return { documents, truncated: false, degradedReasons };
  }
}

function parseSource(document: SourceDocument): ValidSource | null {
  const sourceId = stringValue(document.sourceId);
  const version = positiveInteger(document.version);
  const originalContent = typeof document.originalContent === 'string' ? document.originalContent : null;
  const domain = stringValue(document.domain);
  const language = stringValue(document.language);
  const status = stringValue(document.status);
  if (!sourceId || version === null || originalContent === null || !domain || !language || !status) return null;

  const authority = isRecord(document.authority) ? document.authority : {};
  const approved = document.authorityDecision === 'active_authority' &&
    authority.authorityStatus === 'active_authority' &&
    (authority.authorityKind === 'kevin_authored' || authority.authorityKind === 'kevin_approved');
  const sourceRef = typeof document.sourceRef === 'string' && document.sourceRef.trim()
    ? normalizeSourceRef(document.sourceRef)
    : null;

  return {
    sourceId,
    version,
    digest: digest(originalContent),
    sourceRef,
    domain,
    language,
    active: status === 'active',
    approved,
  };
}

function parseResource(document: ResourceDocument): ValidResource | null {
  const resourceVersionId = stringValue(document.resourceVersionId);
  const digestValue = stringValue(document.contentDigestSha256)?.toLowerCase() ?? null;
  if (!resourceVersionId || !digestValue || !/^[a-f0-9]{64}$/.test(digestValue)) return null;
  return { resourceVersionId, digest: digestValue };
}

export function normalizeKnowledgeSourceRef(value: string): string {
  return normalizeSourceRef(value);
}

function normalizeSourceRef(value: string): string {
  const trimmed = value.trim();
  const match = /^([A-Za-z][A-Za-z0-9+.-]*):\/\/([^/?#]+)(.*)$/.exec(trimmed);
  if (!match) return trimmed;
  const [, scheme = '', authority = '', remainder = ''] = match;
  const at = authority.lastIndexOf('@');
  const userInfo = at >= 0 ? authority.slice(0, at + 1) : '';
  const hostPort = at >= 0 ? authority.slice(at + 1) : authority;
  return `${scheme.toLowerCase()}://${userInfo}${hostPort.toLowerCase()}${remainder}`;
}

function digest(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function groupBy<T>(values: readonly T[], keyFor: (value: T) => string): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const value of values) {
    const key = keyFor(value);
    const group = groups.get(key) ?? [];
    group.push(value);
    groups.set(key, group);
  }
  return groups;
}

function countReasons(reasons: readonly string[]): Array<{ reason: string; count: number }> {
  const counts = new Map<string, number>();
  for (const reason of reasons) counts.set(reason, (counts.get(reason) ?? 0) + 1);
  return [...counts.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([reason, count]) => ({ reason, count }));
}

function stringValue(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function positiveInteger(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
