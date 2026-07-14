import type {
  KnowledgeEvolutionRecord,
  KnowledgeEvolutionVersion,
  KnowledgeRetrievalRollout,
  KnowledgeSupersessionRecord,
} from '@momentum/shared/runtime';
import { KNOWLEDGE_EVOLUTION_COLLECTIONS } from '@momentum/shared/runtime';
import {
  activeKnowledgeDocumentId,
  reindexKnowledgeEvolution,
  type KnowledgeReindexRequest,
} from '../../runtime/knowledge-evolution/indexing/knowledgeEvolutionReindex.service.js';
import { hasApprovalReference } from '../../runtime/knowledge-evolution/policies/EvolutionApprovalPolicy.js';
import { persistenceCall } from '../persistence/dispatch.js';
import type {
  CanonicalMaintenanceBatch,
  CanonicalMaintenanceItem,
  ChromaMaintenancePort,
  ChromaVerificationState,
} from './engine.js';
import type { ChromaMaintenanceManifestEntry } from './manifest.js';

const MONGO_DATABASE = 'momentum';

interface MongoQueryResult<T> {
  documents?: Array<T & { _id?: unknown }>;
}

interface ChromaListCollectionsResult {
  collections?: Array<{
    name?: string;
    metadata?: Record<string, unknown>;
    dimension?: number | null;
  }>;
}

interface ChromaGetResult {
  ids?: string[];
  documents?: Array<string | null>;
  metadatas?: Array<Record<string, unknown> | null>;
}

interface LiveApplyDecision {
  status?: unknown;
  decided_by?: unknown;
  related_acr?: unknown;
  authorization_scope?: unknown;
  authorized_mode?: unknown;
  authorized_collections?: unknown;
  dry_run_report_sha256?: unknown;
}

interface ChromaListRecordsResult extends ChromaGetResult {
  count?: number;
}

async function mongoQuery<T>(
  collection: string,
  filter: Record<string, unknown>,
  options: { sort?: Record<string, 1 | -1>; limit?: number } = {},
): Promise<Array<T & { _id?: unknown }>> {
  const result = await persistenceCall<MongoQueryResult<T>>('mongodb', 'query', {
    database: MONGO_DATABASE,
    collection,
    filter,
    ...(options.sort ? { sort: options.sort } : {}),
    ...(options.limit ? { limit: options.limit } : {}),
  });
  return result.documents ?? [];
}

function stringId(value: unknown): string | null {
  if (typeof value === 'string' && value.length > 0) return value;
  if (value && typeof value === 'object' && 'toString' in value) {
    const resolved = String(value);
    return resolved && resolved !== '[object Object]' ? resolved : null;
  }
  return null;
}

function metadataDocument(record: KnowledgeEvolutionRecord): string | null {
  const value = record.metadata?.document;
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function sourceTraceable(record: KnowledgeEvolutionRecord): boolean {
  return record.sourceCandidateIds.length > 0
    || record.sourceKnowledgeObjectIds.length > 0
    || record.sourceLearningSignalIds.length > 0
    || record.sourceOutcomeIds.length > 0;
}

function expectedMetadata(request: KnowledgeReindexRequest): Record<string, unknown> {
  const metadata: Record<string, unknown> = {
    evolutionId: request.evolutionId,
    knowledgeObjectId: request.knowledgeObjectId,
    version: request.version,
    domain: request.domain,
    language: request.language,
    lifecycleStatus: request.lifecycle,
    governanceStatus: request.governanceStatus ?? 'approved',
    retrievalReady: request.retrievalReady ?? false,
    tenantId: request.tenantId,
    sourceTraceable:
      Boolean(request.sourceCandidateIds?.length)
      || Boolean(request.sourceKnowledgeObjectIds?.length)
      || Boolean(request.sourceLearningSignalIds?.length)
      || Boolean(request.sourceOutcomeIds?.length),
  };
  if (request.teamId) metadata.teamId = request.teamId;
  if (request.teamKey) metadata.teamKey = request.teamKey;
  if (request.teamName) metadata.teamName = request.teamName;
  if (request.sourceCandidateIds?.length) metadata.sourceCandidateIds = request.sourceCandidateIds.join('|');
  if (request.sourceKnowledgeObjectIds?.length) metadata.sourceKnowledgeObjectIds = request.sourceKnowledgeObjectIds.join('|');
  if (request.sourceLearningSignalIds?.length) metadata.sourceLearningSignalIds = request.sourceLearningSignalIds.join('|');
  if (request.sourceOutcomeIds?.length) metadata.sourceOutcomeIds = request.sourceOutcomeIds.join('|');
  return metadata;
}

function metadataMatches(
  actual: Record<string, unknown> | null | undefined,
  request: KnowledgeReindexRequest,
): boolean {
  if (!actual) return false;
  return Object.entries(expectedMetadata(request)).every(([key, value]) => actual[key] === value);
}

function removalRequest(
  record: KnowledgeEvolutionRecord,
  knowledgeObjectId: string,
  lifecycle: 'archived' | 'superseded',
): KnowledgeReindexRequest {
  return {
    evolutionId: record.evolutionId,
    knowledgeObjectId,
    version: record.versionCreated ?? 1,
    tenantId: record.tenantId,
    teamId: record.teamId,
    teamKey: record.teamKey,
    teamName: record.teamName,
    domain: record.domain,
    language: record.language,
    lifecycle,
    approved: Boolean(record.approvalReference),
    retrievalReady: false,
    sourceCandidateIds: [...record.sourceCandidateIds],
    sourceKnowledgeObjectIds: [...record.sourceKnowledgeObjectIds],
    sourceLearningSignalIds: [...record.sourceLearningSignalIds],
    sourceOutcomeIds: [...record.sourceOutcomeIds],
  };
}

function activeRequest(
  record: KnowledgeEvolutionRecord,
  knowledgeObjectId: string,
  document: string,
  retrievalReady: boolean,
): KnowledgeReindexRequest {
  return {
    evolutionId: record.evolutionId,
    knowledgeObjectId,
    version: record.versionCreated as number,
    tenantId: record.tenantId,
    teamId: record.teamId,
    teamKey: record.teamKey,
    teamName: record.teamName,
    domain: record.domain,
    language: record.language,
    lifecycle: 'active',
    approved: true,
    governanceStatus: 'approved',
    retrievalReady,
    document,
    sourceCandidateIds: [...record.sourceCandidateIds],
    sourceKnowledgeObjectIds: [...record.sourceKnowledgeObjectIds],
    sourceLearningSignalIds: [...record.sourceLearningSignalIds],
    sourceOutcomeIds: [...record.sourceOutcomeIds],
  };
}

function blockedItem(
  cursor: string,
  record: KnowledgeEvolutionRecord,
  knowledgeObjectId: string,
  reason: string,
): CanonicalMaintenanceItem {
  return {
    cursor,
    action: 'blocked',
    reason,
    expectedId: activeKnowledgeDocumentId(
      knowledgeObjectId,
      record.versionCreated ?? 1,
      record.language,
    ),
    request: removalRequest(record, knowledgeObjectId, 'archived'),
  };
}

async function loadCanonicalBatch(input: {
  entry: ChromaMaintenanceManifestEntry;
  cursor: string | null;
  limit: number;
}): Promise<CanonicalMaintenanceBatch> {
  if (input.entry.projector !== 'knowledge_evolution_active'
    || !input.entry.domain
    || !input.entry.language) {
    return { items: [], nextCursor: null };
  }

  const records = await mongoQuery<KnowledgeEvolutionRecord>(
    KNOWLEDGE_EVOLUTION_COLLECTIONS.records,
    {
      domain: input.entry.domain,
      language: input.entry.language,
      targetKnowledgeObjectId: { $exists: true },
      ...(input.cursor ? { _id: { $gt: input.cursor } } : {}),
    },
    { sort: { _id: 1 }, limit: input.limit },
  );
  if (records.length === 0) return { items: [], nextCursor: null };

  const knowledgeObjectIds = [...new Set(records
    .map((record) => record.targetKnowledgeObjectId)
    .filter((value): value is string => typeof value === 'string' && value.length > 0))];
  const [archivedVersions, supersessions, rollouts] = await Promise.all([
    mongoQuery<KnowledgeEvolutionVersion>(
      KNOWLEDGE_EVOLUTION_COLLECTIONS.versions,
      { knowledgeObjectId: { $in: knowledgeObjectIds }, changeType: 'archived' },
    ),
    mongoQuery<KnowledgeSupersessionRecord>(
      KNOWLEDGE_EVOLUTION_COLLECTIONS.supersessionRecords,
      { oldKnowledgeObjectId: { $in: knowledgeObjectIds } },
    ),
    mongoQuery<KnowledgeRetrievalRollout>(
      KNOWLEDGE_EVOLUTION_COLLECTIONS.retrievalRollouts,
      { knowledgeObjectId: { $in: knowledgeObjectIds }, retrievalReady: true },
    ),
  ]);
  const archived = new Set(archivedVersions.map((row) => row.knowledgeObjectId));
  const superseded = new Set(supersessions.map((row) => row.oldKnowledgeObjectId));
  const ready = new Set(rollouts.map((row) => `${row.knowledgeObjectId}:${row.version}`));

  const items = records.map((record): CanonicalMaintenanceItem => {
    const cursor = stringId(record._id) ?? record.evolutionId;
    const knowledgeObjectId = record.targetKnowledgeObjectId;
    if (!knowledgeObjectId) return blockedItem(cursor, record, record.evolutionId, 'missing_target_id');
    if (archived.has(knowledgeObjectId) || record.evolutionAction === 'archive_existing_knowledge') {
      const request = removalRequest(record, knowledgeObjectId, 'archived');
      return { cursor, action: 'remove', reason: 'canonical_archived', expectedId: '', request };
    }
    if (superseded.has(knowledgeObjectId)) {
      const request = removalRequest(record, knowledgeObjectId, 'superseded');
      return { cursor, action: 'remove', reason: 'canonical_superseded', expectedId: '', request };
    }
    if (record.status === 'failed' || record.status === 'rolled_back') {
      return blockedItem(cursor, record, knowledgeObjectId, `canonical_${record.status}_not_lifecycle_proof`);
    }
    if (!hasApprovalReference(record.approvalReference)) {
      return blockedItem(cursor, record, knowledgeObjectId, 'invalid_approval');
    }
    if (!record.versionCreated || record.versionCreated < 1) {
      return blockedItem(cursor, record, knowledgeObjectId, 'missing_version');
    }
    const document = metadataDocument(record);
    if (!document) return blockedItem(cursor, record, knowledgeObjectId, 'missing_document');

    const retrievalReady = ready.has(`${knowledgeObjectId}:${record.versionCreated}`);
    if (!retrievalReady) return blockedItem(cursor, record, knowledgeObjectId, 'not_retrieval_ready');
    const request = activeRequest(record, knowledgeObjectId, document, retrievalReady);
    if (sourceTraceable(record) !== expectedMetadata(request).sourceTraceable) {
      return blockedItem(cursor, record, knowledgeObjectId, 'source_traceability_mismatch');
    }
    return {
      cursor,
      action: 'upsert',
      reason: 'canonical_active',
      expectedId: activeKnowledgeDocumentId(knowledgeObjectId, record.versionCreated, record.language),
      request,
    };
  });

  const lastCursor = items.at(-1)?.cursor ?? null;
  return {
    items,
    nextCursor: records.length === input.limit ? lastCursor : null,
  };
}

async function verify(item: CanonicalMaintenanceItem): Promise<ChromaVerificationState> {
  const collection = `mcs_${item.request.domain}_knowledge_${item.request.language}`;
  if (item.action === 'upsert') {
    let result: ChromaGetResult;
    try {
      result = await persistenceCall<ChromaGetResult>('chromadb', 'get', {
        collection,
        ids: [item.expectedId],
        include_documents: true,
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes('collection not found')) return 'missing';
      throw error;
    }
    if (!(result.ids ?? []).includes(item.expectedId)) return 'missing';
    return result.documents?.[0] === item.request.document
      && metadataMatches(result.metadatas?.[0], item.request)
      ? 'match'
      : 'mismatch';
  }
  let result: ChromaListRecordsResult;
  try {
    result = await persistenceCall<ChromaListRecordsResult>('chromadb', 'list_records', {
      collection,
      where: { knowledgeObjectId: item.request.knowledgeObjectId },
      limit: 1,
      offset: 0,
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes('collection not found')) return 'missing';
    throw error;
  }
  return (result.count ?? result.ids?.length ?? 0) === 0 ? 'missing' : 'stale_present';
}

async function applyItem(item: CanonicalMaintenanceItem): Promise<void> {
  const result = await reindexKnowledgeEvolution(item.request);
  if (result.status !== 'completed') {
    throw new Error(`knowledge reindex did not complete: ${result.reason}`);
  }
}

export function createChromaMaintenanceRuntimePort(): ChromaMaintenancePort {
  return {
    async listCollections() {
      const result = await persistenceCall<ChromaListCollectionsResult>(
        'chromadb',
        'list_collections',
        {},
      );
      return (result.collections ?? [])
        .filter((row): row is typeof row & { name: string } => typeof row.name === 'string')
        .map((row) => ({
          name: row.name,
          ...(row.metadata ? { metadata: row.metadata } : {}),
          dimension: row.dimension ?? null,
        }));
    },
    async listProjectionPage({ collection, offset, limit }) {
      const result = await persistenceCall<ChromaListRecordsResult>('chromadb', 'list_records', {
        collection,
        offset,
        limit,
      });
      return {
        count: result.count ?? result.ids?.length ?? 0,
        metadatas: result.metadatas ?? [],
      };
    },
    loadCanonicalBatch,
    verify,
    upsert: applyItem,
    remove: applyItem,
    async assertApplyAuthorization(input) {
      const decisions = await mongoQuery<LiveApplyDecision>(
        'decisions',
        { _id: input.decisionId },
        { limit: 2 },
      );
      if (decisions.length !== 1) {
        throw new Error('live apply authorization decision was not found uniquely');
      }
      const decision = decisions[0] as LiveApplyDecision;
      const authorizedCollections = Array.isArray(decision.authorized_collections)
        ? decision.authorized_collections
          .filter((value): value is string => typeof value === 'string')
          .sort((a, b) => a.localeCompare(b))
        : [];
      const requested = [...input.collections].sort((a, b) => a.localeCompare(b));
      const matchesCollections = authorizedCollections.length === requested.length
        && authorizedCollections.every((value, index) => value === requested[index]);
      if (decision.status !== 'active'
        || decision.decided_by !== 'kevin_gardner'
        || decision.related_acr !== 'ACR-0027'
        || decision.authorization_scope !== 'live_chroma_apply'
        || decision.authorized_mode !== input.mode
        || decision.dry_run_report_sha256 !== input.evidenceSha256
        || !matchesCollections) {
        throw new Error('live apply authorization does not match mode, collections, or dry-run evidence');
      }
    },
  };
}
