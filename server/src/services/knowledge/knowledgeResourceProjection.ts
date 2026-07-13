import { createHash } from 'node:crypto';
import type { McsResourceCatalogEntry } from '@momentum/shared';
import type {
  McsKnowledgeBaseChunkRecord,
  McsKnowledgeBaseSourceRecord,
} from '@momentum/shared/runtime';
import { verifyResourcePublishingGate } from '../../domain/resourcePublishingGate.js';
import {
  RESOURCE_CATALOG_CHROMA_COLLECTION,
  RESOURCE_CATALOG_MONGO_COLLECTION,
} from '../../domain/resourceCatalogSchema.js';
import { persistenceCall } from '../persistence/dispatch.js';

const KEVIN_TMAG_ID = 'TMAG-01';
const MONGO_DATABASE = 'momentum';

type Persistence = typeof persistenceCall;
type VerifyGate = typeof verifyResourcePublishingGate;

type TaxonomizedSource = McsKnowledgeBaseSourceRecord & {
  canonicalTopicTags?: string[];
  categoryTags?: string[];
  productTags?: string[];
  taxonomy?: {
    primaryCategory?: string;
    categoryTags?: string[];
    productTags?: string[];
    topicTags?: string[];
  };
};

export interface KnowledgeResourceProjectionResult {
  resourceId: string;
  resourceVersionId: string;
  active: boolean;
  reasons: string[];
  entry: McsResourceCatalogEntry | null;
}

export function knowledgeSourceContentDigest(source: Pick<McsKnowledgeBaseSourceRecord, 'originalContent'>): string {
  return createHash('sha256').update(source.originalContent, 'utf8').digest('hex');
}

export function buildKnowledgeResourceCatalogEntry(input: {
  source: McsKnowledgeBaseSourceRecord;
  chunks: readonly McsKnowledgeBaseChunkRecord[];
  lifecycle: 'approved' | 'active';
  updatedAt: string;
  readinessEvidenceId?: string;
}): McsResourceCatalogEntry {
  const { source, chunks } = input;
  assertKevinApproved(source);
  const taxonomized = source as TaxonomizedSource;
  const resourceId = `knowledge:${source.sourceId}`;
  const resourceVersionId = `${resourceId}:v${source.version}`;
  const tags = unique([
    ...(taxonomized.canonicalTopicTags ?? []),
    ...(taxonomized.productTags ?? []),
    ...(taxonomized.taxonomy?.topicTags ?? []),
    ...chunks.flatMap((chunk) => chunk.topicTags),
  ]);
  const categories = unique([
    ...(taxonomized.categoryTags ?? []),
    ...(taxonomized.taxonomy?.categoryTags ?? []),
    ...(taxonomized.taxonomy?.primaryCategory ? [taxonomized.taxonomy.primaryCategory] : []),
    source.domain,
  ]);
  const agentScopes = unique(chunks.flatMap((chunk) => chunk.agentScopes));
  const active = input.lifecycle === 'active';
  const evidenceIds = input.readinessEvidenceId ? [input.readinessEvidenceId] : [];

  return {
    schemaVersion: 'resource_catalog.v1',
    resourceId,
    resourceVersionId,
    tenantId: source.scope.tenantId,
    teamId: source.scope.teamId ?? 'team_magnificent',
    kind: 'knowledge_source',
    title: source.title,
    summary: summarize(source.originalContent),
    version: source.version,
    lifecycle: input.lifecycle,
    audience: {
      surfaces: ['team'],
      roles: ['brand_ambassador', 'leader'],
      agentScopes,
    },
    language: {
      mode: 'localized',
      code: source.language,
      translationOfResourceVersionId: null,
      translationStatus: 'approved',
    },
    authority: {
      kind: source.authority.authorityKind,
      status: 'active_authority',
      decidedByTmagId: approvalTmagId(source),
      decidedAt: source.authority.authorityAt,
      evidenceId: source.authority.authorityRef ?? String(source.sourceId),
    },
    readiness: {
      retrievalMode: 'required',
      state: active ? 'ready' : 'pending',
      checks: {
        content: 'passed',
        compliance: 'passed',
        authority: 'passed',
        translation: 'passed',
        mongo: 'passed',
        neo4j: active ? 'passed' : 'pending',
        chroma: active ? 'passed' : 'pending',
      },
      evidenceIds,
      blockedReasons: [],
      evaluatedAt: active ? input.updatedAt : null,
      evaluatedByTmagId: active ? approvalTmagId(source) : null,
    },
    lineage: {
      originKind: 'admin_upload',
      sourceSystem: 'knowledge_core',
      sourceCollection: 'mcs_knowledge_sources',
      sourceRecordId: String(source.sourceId),
      parentResourceVersionId: null,
      supersedesResourceVersionId: source.version > 1 ? `${resourceId}:v${source.version - 1}` : null,
      replacementResourceVersionId: null,
    },
    contentLocator: {
      type: 'route',
      locator: `/resources/${encodeURIComponent(resourceVersionId)}`,
      field: null,
    },
    contentDigestSha256: knowledgeSourceContentDigest(source),
    tags,
    categories,
    migration: { source: 'native', ambiguities: [] },
    authorTmagId: approvalTmagId(source),
    createdAt: source.createdAt,
    updatedAt: input.updatedAt,
  };
}

export async function projectKevinApprovedKnowledgeSourceToCatalog(
  source: McsKnowledgeBaseSourceRecord,
  chunks: readonly McsKnowledgeBaseChunkRecord[],
  persistence: Persistence = persistenceCall,
  verifyGate: VerifyGate = verifyResourcePublishingGate,
  now: () => Date = () => new Date(),
): Promise<KnowledgeResourceProjectionResult> {
  try {
    assertKevinApproved(source);
  } catch (error) {
    return blocked(source, error instanceof Error ? error.message : String(error));
  }
  if (!chunks.some((chunk) =>
    chunk.status === 'active' &&
    chunk.retrievalEligible &&
    chunk.surfaceScopes.includes('team') &&
    chunk.authorityStatus === 'active_authority'
  )) {
    return blocked(source, 'approved_team_chunk_required');
  }

  const expectedResourceId = `knowledge:${source.sourceId}`;
  const expectedResourceVersionId = `${expectedResourceId}:v${source.version}`;
  const existing = await persistence<{ documents?: McsResourceCatalogEntry[] }>('mongodb', 'query', {
    database: MONGO_DATABASE,
    collection: RESOURCE_CATALOG_MONGO_COLLECTION,
    filter: { resourceVersionId: expectedResourceVersionId },
    limit: 1,
  });
  const existingEntry = existing.documents?.[0];
  const expectedDigest = knowledgeSourceContentDigest(source);
  if (existingEntry && existingEntry.contentDigestSha256 !== expectedDigest) {
    return {
      resourceId: expectedResourceId,
      resourceVersionId: expectedResourceVersionId,
      active: false,
      reasons: ['immutable_version_digest_conflict'],
      entry: existingEntry,
    };
  }
  if (
    existingEntry?.lifecycle === 'active' &&
    existingEntry.resourceId === expectedResourceId &&
    existingEntry.contentDigestSha256 === expectedDigest
  ) {
    const current = await verifyGate(expectedResourceVersionId, 'retrieve', persistence);
    if (current.allowed) {
      return {
        resourceId: expectedResourceId,
        resourceVersionId: expectedResourceVersionId,
        active: true,
        reasons: [],
        entry: existingEntry,
      };
    }
  }

  const approved = buildKnowledgeResourceCatalogEntry({
    source,
    chunks,
    lifecycle: 'approved',
    updatedAt: now().toISOString(),
  });
  await writeCatalogProjection(approved, persistence);
  const publish = await verifyGate(approved.resourceVersionId, 'publish', persistence);
  if (!publish.allowed || !publish.evidence) {
    return { resourceId: approved.resourceId, resourceVersionId: approved.resourceVersionId, active: false, reasons: publish.reasons, entry: approved };
  }

  const active = buildKnowledgeResourceCatalogEntry({
    source,
    chunks,
    lifecycle: 'active',
    updatedAt: now().toISOString(),
    readinessEvidenceId: publish.evidence.evidenceId,
  });
  await writeCatalogProjection(active, persistence);
  const retrieve = await verifyGate(active.resourceVersionId, 'retrieve', persistence);
  return {
    resourceId: active.resourceId,
    resourceVersionId: active.resourceVersionId,
    active: retrieve.allowed,
    reasons: retrieve.reasons,
    entry: active,
  };
}

async function writeCatalogProjection(entry: McsResourceCatalogEntry, persistence: Persistence): Promise<void> {
  const existing = await persistence<{ documents?: unknown[] }>('mongodb', 'query', {
    database: MONGO_DATABASE,
    collection: RESOURCE_CATALOG_MONGO_COLLECTION,
    filter: { resourceVersionId: entry.resourceVersionId },
    limit: 1,
  });
  if ((existing.documents?.length ?? 0) > 0) {
    await persistence('mongodb', 'update', {
      database: MONGO_DATABASE,
      collection: RESOURCE_CATALOG_MONGO_COLLECTION,
      filter: { resourceVersionId: entry.resourceVersionId },
      update: { $set: entry },
    });
  } else {
    await persistence('mongodb', 'insert', {
      database: MONGO_DATABASE,
      collection: RESOURCE_CATALOG_MONGO_COLLECTION,
      documents: [{ _id: entry.resourceVersionId, ...entry }],
    });
  }

  await persistence('neo4j', 'cypher', {
    query: [
      'MERGE (r:TmagResource {tenantId:$tenantId, teamId:$teamId, resourceId:$resourceId})',
      'SET r.kind=$kind, r.title=$title',
      'MERGE (v:TmagResourceVersion {resourceVersionId:$resourceVersionId})',
      'SET v.version=$version, v.contentDigestSha256=$digest, v.lifecycle=$lifecycle,',
      'v.authorityStatus=$authorityStatus, v.updatedAt=$updatedAt',
      'MERGE (r)-[:HAS_VERSION]->(v)',
      'MERGE (a:TeamMagnificentMember {tmagId:$approverTmagId})',
      'ON CREATE SET a.identityProjection="knowledge_authority"',
      'MERGE (v)-[:APPROVED_BY]->(a)',
      'WITH v',
      'MATCH (s:KnowledgeSource {id:$sourceId})',
      'MERGE (v)-[:PROJECTS_KNOWLEDGE_SOURCE]->(s)',
    ].join(' '),
    params: {
      tenantId: entry.tenantId,
      teamId: entry.teamId,
      resourceId: entry.resourceId,
      resourceVersionId: entry.resourceVersionId,
      kind: entry.kind,
      title: entry.title,
      version: entry.version,
      digest: entry.contentDigestSha256,
      lifecycle: entry.lifecycle,
      authorityStatus: entry.authority.status,
      updatedAt: entry.updatedAt,
      approverTmagId: entry.authority.decidedByTmagId,
      sourceId: entry.lineage.sourceRecordId,
    },
  });

  await persistence('chromadb', 'add', {
    collection: RESOURCE_CATALOG_CHROMA_COLLECTION,
    ids: [entry.resourceVersionId],
    documents: [`${entry.title}\n\n${entry.summary}\n\n${entry.tags.join(' ')}`],
    metadatas: [{
      resourceVersionId: entry.resourceVersionId,
      resourceId: entry.resourceId,
      tenantId: entry.tenantId,
      teamId: entry.teamId,
      kind: entry.kind,
      contentDigestSha256: entry.contentDigestSha256,
      lifecycle: entry.lifecycle,
      authorityStatus: entry.authority.status,
      language: entry.language.code ?? 'neutral',
      updatedAt: entry.updatedAt,
    }],
  });
}

function assertKevinApproved(source: McsKnowledgeBaseSourceRecord): void {
  if (source.status !== 'active' || source.authorityDecision !== 'active_authority') {
    throw new Error('active_knowledge_source_required');
  }
  if (source.authority.authorityStatus !== 'active_authority') {
    throw new Error('active_kevin_authority_required');
  }
  if (source.authority.authorityKind !== 'kevin_authored' && source.authority.authorityKind !== 'kevin_approved') {
    throw new Error('kevin_approval_required');
  }
}

function approvalTmagId(source: McsKnowledgeBaseSourceRecord): string {
  return /^TM(?:AG|BA)-/i.test(source.createdBy) ? source.createdBy : KEVIN_TMAG_ID;
}

function summarize(content: string): string {
  const normalized = content
    .replace(/^\s*#{1,6}\s+/gm, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (normalized.length <= 280) return normalized;
  const clipped = normalized.slice(0, 277).replace(/\s+\S*$/, '').trimEnd();
  return `${clipped}…`;
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))].sort();
}

function blocked(source: McsKnowledgeBaseSourceRecord, reason: string): KnowledgeResourceProjectionResult {
  const resourceId = `knowledge:${source.sourceId}`;
  return {
    resourceId,
    resourceVersionId: `${resourceId}:v${source.version}`,
    active: false,
    reasons: [reason],
    entry: null,
  };
}
