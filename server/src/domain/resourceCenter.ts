import type {
  McsResourceCatalogEntry,
  McsResourceCenterDocument,
  McsResourceCenterDetailResponse,
  McsResourceCenterItem,
  McsResourceCenterResponse,
} from '@momentum/shared';
import { MCS_RESOURCE_CENTER_RESPONSE_SCHEMA_VERSION } from '@momentum/shared';
import { persistenceCall } from '../services/persistence/dispatch.js';
import { RESOURCE_CATALOG_MONGO_COLLECTION } from './resourceCatalogSchema.js';
import { verifyResourcePublishingGate } from './resourcePublishingGate.js';
import { knowledgeSourceContentDigest } from '../services/knowledge/knowledgeResourceProjection.js';
import type { McsKnowledgeBaseSourceRecord } from '@momentum/shared/runtime';
import type { McsKnowledgeBaseDocumentPointer } from '@momentum/shared/runtime';
import { parseKnowledgeDocumentPointer } from '../services/knowledge/knowledgeDocumentStorage.js';

type Persistence = typeof persistenceCall;
type VerifyGate = typeof verifyResourcePublishingGate;

function teamAudience(entry: McsResourceCatalogEntry): boolean {
  return entry.audience.surfaces.includes('team') &&
    entry.audience.roles.some((role) => role === 'brand_ambassador' || role === 'leader');
}

function safeOpenTarget(entry: McsResourceCatalogEntry): string | null {
  const locator = entry.contentLocator.locator.trim();
  const isTeamResourceRoute = locator === '/video-library' ||
    locator.startsWith('/training/') ||
    locator.startsWith('/resources/');
  if (entry.contentLocator.type === 'route' && isTeamResourceRoute) {
    return locator;
  }
  if (entry.contentLocator.type === 'external_url' && /^https:\/\//i.test(locator)) {
    return locator;
  }
  if (entry.kind === 'content_video') return '/video-library';
  return null;
}

export async function getResourceCenterResourceDetail(
  resourceVersionId: string,
  persistence: Persistence = persistenceCall,
  verifyGate: VerifyGate = verifyResourcePublishingGate,
): Promise<McsResourceCenterDetailResponse | null> {
  const resolved = await resolveKnowledgeResource(resourceVersionId, persistence, verifyGate);
  if (!resolved) return null;
  const { entry, source } = resolved;
  const document = resourceCenterDocument(resourceVersionId, source.upload?.document);
  return {
    ok: true,
    schemaVersion: MCS_RESOURCE_CENTER_RESPONSE_SCHEMA_VERSION,
    item: toItem(entry),
    content: source.originalContent,
    document,
  };
}

export async function getResourceCenterKnowledgeDocumentPointer(
  resourceVersionId: string,
  persistence: Persistence = persistenceCall,
  verifyGate: VerifyGate = verifyResourcePublishingGate,
): Promise<McsKnowledgeBaseDocumentPointer | null> {
  const resolved = await resolveKnowledgeResource(resourceVersionId, persistence, verifyGate);
  return resolved ? parseKnowledgeDocumentPointer(resolved.source.upload?.document) : null;
}

async function resolveKnowledgeResource(
  resourceVersionId: string,
  persistence: Persistence,
  verifyGate: VerifyGate,
): Promise<{ entry: McsResourceCatalogEntry; source: McsKnowledgeBaseSourceRecord } | null> {
  const mongo = await persistence<{ documents?: McsResourceCatalogEntry[] }>('mongodb', 'query', {
    database: 'momentum',
    collection: RESOURCE_CATALOG_MONGO_COLLECTION,
    filter: { resourceVersionId, lifecycle: 'active' },
    limit: 1,
  });
  const entry = mongo.documents?.[0];
  if (!entry || !teamAudience(entry) || entry.kind !== 'knowledge_source') return null;
  if (!(await verifyGate(resourceVersionId, 'retrieve', persistence)).allowed) return null;
  if (
    entry.lineage.sourceCollection !== 'mcs_knowledge_sources' ||
    !entry.lineage.sourceRecordId
  ) return null;
  const sourceResult = await persistence<{ documents?: McsKnowledgeBaseSourceRecord[] }>('mongodb', 'query', {
    database: 'momentum',
    collection: entry.lineage.sourceCollection,
    filter: {
      sourceId: entry.lineage.sourceRecordId,
      version: entry.version,
      status: 'active',
      authorityDecision: 'active_authority',
      'authority.authorityStatus': 'active_authority',
      'authority.authorityKind': { $in: ['kevin_authored', 'kevin_approved'] },
    },
    limit: 1,
  });
  const source = sourceResult.documents?.[0];
  if (!source || knowledgeSourceContentDigest(source) !== entry.contentDigestSha256) return null;
  return { entry, source };
}

function resourceCenterDocument(
  resourceVersionId: string,
  value: unknown,
): McsResourceCenterDocument | null {
  const pointer = parseKnowledgeDocumentPointer(value);
  return pointer ? {
    filename: pointer.filename,
    mimeType: pointer.mimeType,
    originalBytes: pointer.originalBytes,
    sha256: pointer.sha256,
    openTarget: `/api/resources/${encodeURIComponent(resourceVersionId)}/document`,
  } : null;
}

function toItem(entry: McsResourceCatalogEntry): McsResourceCenterItem {
  return {
    resourceId: entry.resourceId,
    resourceVersionId: entry.resourceVersionId,
    title: entry.title,
    summary: entry.summary,
    kind: entry.kind,
    categories: [...new Set(entry.categories)].sort(),
    tags: [...new Set(entry.tags)].sort(),
    languageCode: entry.language.code,
    version: entry.version,
    sourceSystem: entry.lineage.sourceSystem,
    openTarget: safeOpenTarget(entry),
    updatedAt: entry.updatedAt,
  };
}

export async function listResourceCenterResources(
  persistence: Persistence = persistenceCall,
  verifyGate: VerifyGate = verifyResourcePublishingGate,
): Promise<McsResourceCenterResponse> {
  const mongo = await persistence<{ documents?: McsResourceCatalogEntry[] }>('mongodb', 'query', {
    database: 'momentum',
    collection: RESOURCE_CATALOG_MONGO_COLLECTION,
    filter: { lifecycle: 'active' },
    sort: { title: 1, version: -1 },
    limit: 500,
  });
  const audienceCandidates = await filterCanonicalKnowledgeEntries(
    (mongo.documents ?? []).filter(teamAudience),
    persistence,
  );
  const activeVersionsByResource = audienceCandidates.reduce<Map<string, number>>((counts, entry) => {
    counts.set(entry.resourceId, (counts.get(entry.resourceId) ?? 0) + 1);
    return counts;
  }, new Map());
  const candidates = audienceCandidates.filter(
    (entry) => activeVersionsByResource.get(entry.resourceId) === 1,
  );
  const decisions: Awaited<ReturnType<VerifyGate>>[] = [];
  for (let start = 0; start < candidates.length; start += 8) {
    decisions.push(...await Promise.all(
      candidates.slice(start, start + 8)
        .map((entry) => verifyGate(entry.resourceVersionId, 'retrieve', persistence)),
    ));
  }
  const items = candidates
    .filter((_entry, index) => decisions[index]?.allowed === true)
    .map(toItem)
    .sort((left, right) => left.title.localeCompare(right.title));

  return {
    ok: true,
    schemaVersion: MCS_RESOURCE_CENTER_RESPONSE_SCHEMA_VERSION,
    items,
    categories: [...new Set(items.flatMap((item) => item.categories))].sort(),
    kinds: [...new Set(items.map((item) => item.kind))].sort(),
  };
}

async function filterCanonicalKnowledgeEntries(
  entries: readonly McsResourceCatalogEntry[],
  persistence: Persistence,
): Promise<McsResourceCatalogEntry[]> {
  const knowledgeEntries = entries.filter((entry) => entry.kind === 'knowledge_source');
  if (knowledgeEntries.length === 0) return [...entries];
  const identities = knowledgeEntries.flatMap((entry) => {
    const sourceId = entry.lineage.sourceRecordId;
    return entry.lineage.sourceCollection === 'mcs_knowledge_sources' && sourceId
      ? [{ sourceId, version: entry.version }]
      : [];
  });
  if (identities.length === 0) return entries.filter((entry) => entry.kind !== 'knowledge_source');
  const result = await persistence<{ documents?: McsKnowledgeBaseSourceRecord[] }>('mongodb', 'query', {
    database: 'momentum',
    collection: 'mcs_knowledge_sources',
    filter: {
      $or: identities,
      status: 'active',
      authorityDecision: 'active_authority',
      'authority.authorityStatus': 'active_authority',
      'authority.authorityKind': { $in: ['kevin_authored', 'kevin_approved'] },
    },
    limit: Math.min(500, identities.length),
  });
  const canonical = new Map(
    (result.documents ?? []).map((source) => [`${String(source.sourceId)}:${source.version}`, knowledgeSourceContentDigest(source)]),
  );
  return entries.filter((entry) => {
    if (entry.kind !== 'knowledge_source') return true;
    const sourceId = entry.lineage.sourceRecordId;
    return !!sourceId && canonical.get(`${sourceId}:${entry.version}`) === entry.contentDigestSha256;
  });
}
