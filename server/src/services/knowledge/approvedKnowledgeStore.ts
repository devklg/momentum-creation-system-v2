/**
 * Store-backed approved knowledge foundation.
 *
 * Kevin/admin-authored knowledge enters through `createKevinApprovedKnowledgeSource`,
 * is parsed/chunked through the governed intake pipeline, and is triple-stacked.
 * `createStoredApprovedKnowledgeProvider` is the Knowledge Core boundary adapter
 * the Context Manager can use in real time.
 */

import { randomUUID } from 'node:crypto';
import {
  MCS_KNOWLEDGE_BASE_CHUNK_COLLECTION,
  MCS_KNOWLEDGE_BASE_SCHEMA_VERSION,
  MCS_KNOWLEDGE_BASE_SOURCE_COLLECTION,
} from '@momentum/shared/runtime';
import type {
  McsAgentKey,
  McsKnowledgeAuthorityKind,
  McsKnowledgeBaseChunkRecord,
  McsKnowledgeBaseSourceRecord,
  McsKnowledgeChunk,
  McsKnowledgeDomain,
  McsKnowledgeFreshness,
  McsKnowledgeId,
  McsKnowledgeReference,
  McsRawKnowledgeSource,
  McsRuntimeLanguage,
  McsRuntimeTranslationStatus,
  McsRuntimeRequestScope,
  McsSourceId,
} from '@momentum/shared/runtime';
import { persistenceCall } from '../persistence/dispatch.js';
import { writeKnowledge } from '../tieredWrite.js';
import type { KnowledgeCoreBoundaryPort } from '../../runtime/knowledge/knowledgeCore.js';
import {
  ingestRawKnowledgeSource,
  chunksToKnowledgeReferences,
  deriveKnowledgeId,
  type ChunkOptions,
} from '../../runtime/knowledge/intake/index.js';
import {
  appendGraphRagRecord,
  GRAPHRAG_EMBEDDING_MODEL_VERSION,
} from '../../domain/graphrag.js';
import {
  projectKevinApprovedKnowledgeSourceToCatalog,
  type KnowledgeResourceProjectionResult,
} from './knowledgeResourceProjection.js';

export const KNOWLEDGE_SOURCE_COLLECTION = MCS_KNOWLEDGE_BASE_SOURCE_COLLECTION;
export const KNOWLEDGE_CHUNK_COLLECTION = MCS_KNOWLEDGE_BASE_CHUNK_COLLECTION;

export interface CreateKevinApprovedKnowledgeSourceInput {
  title: string;
  content: string;
  createdBy: string;
  domain: McsKnowledgeDomain;
  language: McsRuntimeLanguage;
  sourceType?: McsRawKnowledgeSource['sourceType'];
  format?: McsRawKnowledgeSource['format'];
  sourceRef?: string;
  upload?: McsKnowledgeBaseSourceRecord['upload'];
  topicTags?: readonly string[];
  agentScopes?: readonly McsAgentKey[];
  authorityKind?: Extract<McsKnowledgeAuthorityKind, 'kevin_authored' | 'kevin_approved'>;
  authorityBy?: string;
  authorityRef?: string;
  createdAt?: string;
}

export interface CreateKevinApprovedKnowledgeSourceResult {
  source: McsKnowledgeBaseSourceRecord;
  chunks: McsKnowledgeBaseChunkRecord[];
  references: McsKnowledgeReference[];
  chunkCount: number;
  indexRecordCount: number;
  graphRagRecordCount: number;
  graphRagFailureCount: number;
  resourceCatalogProjection: KnowledgeResourceProjectionResult;
}

interface MongoQueryResult {
  documents?: Array<Record<string, unknown>>;
  count?: number;
}

interface ChromaQueryResult {
  results?: {
    ids?: string[];
    documents?: string[];
    metadatas?: Array<Record<string, unknown> | null>;
    distances?: number[];
  };
}

const DEFAULT_SEMANTIC_K = 6;
const MAX_SEMANTIC_K = 12;
export const APPROVED_RETRIEVAL_CACHE_TTL_MS = 5_000;
export const APPROVED_RETRIEVAL_CACHE_MAX_ENTRIES = 128;

interface ApprovedRetrievalCacheEntry {
  expiresAt: number;
  references: McsKnowledgeReference[];
}

const approvedRetrievalCache = new Map<string, ApprovedRetrievalCacheEntry>();
const approvedRetrievalInFlight = new Map<
  string,
  { generation: number; promise: Promise<McsKnowledgeReference[]> }
>();
let approvedRetrievalCacheGeneration = 0;
let cacheHits = 0;
let cacheMisses = 0;
let cacheCoalesced = 0;
let cacheEvictions = 0;
let cacheInvalidations = 0;
let cacheInFlightCount = 0;

export async function createKevinApprovedKnowledgeSource(
  input: CreateKevinApprovedKnowledgeSourceInput,
): Promise<CreateKevinApprovedKnowledgeSourceResult> {
  const createdAt = input.createdAt ?? new Date().toISOString();
  const sourceId = `knowledge_source_${randomUUID()}` as McsSourceId;
  const source: McsRawKnowledgeSource = {
    sourceId,
    title: input.title.trim(),
    sourceType: input.sourceType ?? 'owned_text',
    format: input.format ?? 'markdown',
    originalContent: input.content,
    ...(input.sourceRef ? { sourceRef: input.sourceRef } : {}),
    createdBy: input.createdBy,
    authority: {
      authorityKind: input.authorityKind ?? 'kevin_authored',
      authorityStatus: 'active_authority',
      authorityBy: input.authorityBy ?? input.createdBy,
      authorityAt: createdAt,
      ...(input.authorityRef || input.sourceRef ? { authorityRef: input.authorityRef ?? input.sourceRef } : {}),
    },
    createdAt,
    language: input.language,
    domain: input.domain,
    scope: teamMagnificentScope(),
    version: 1,
    status: 'active',
  };

  const chunkOptions: ChunkOptions = {
    classification: {
      topicTags: input.topicTags ?? [],
      ...(input.agentScopes ? { agentScopes: input.agentScopes } : {}),
      surfaceScopes: ['team', 'admin'],
    },
  };
  const intake = ingestRawKnowledgeSource(source, chunkOptions);
  const references = chunksToKnowledgeReferences(intake.chunks);
  const collection = knowledgeChromaCollection(input.domain, input.language);
  const sourceRecord: McsKnowledgeBaseSourceRecord = {
    ...source,
    schemaVersion: MCS_KNOWLEDGE_BASE_SCHEMA_VERSION,
    authority: intake.authority.authority,
    authorityDecision: intake.authority.decision,
    ...(input.upload ? { upload: input.upload } : {}),
    chunkCount: intake.chunks.length,
    indexRecordCount: intake.indexRecords.length,
  };

  await writeKnowledge({
    id: String(source.sourceId),
    mongoCollection: KNOWLEDGE_SOURCE_COLLECTION,
    mongoDoc: { ...sourceRecord },
    neo4j: {
      cypher: [
        'MERGE (s:KnowledgeSource {id:$id})',
        'SET s += $props',
      ].join(' '),
      params: {
        props: {
          title: source.title,
          domain: source.domain,
          language: source.language,
          status: source.status,
          authorityKind: source.authority?.authorityKind,
          authorityStatus: source.authority?.authorityStatus,
          createdBy: source.createdBy,
          createdAt: source.createdAt,
        },
      },
    },
    chroma: {
      collection,
      document: `${source.title}\n\n${source.originalContent}`,
      metadata: {
        kind: 'knowledge_source',
        sourceId: String(source.sourceId),
        domain: source.domain,
        language: source.language,
        authority: 'kevin',
      },
    },
  });
  invalidateApprovedKnowledgeRetrievalCache();

  const chunkRecords: McsKnowledgeBaseChunkRecord[] = intake.chunks.map((chunk) => ({
    ...chunk,
    schemaVersion: MCS_KNOWLEDGE_BASE_SCHEMA_VERSION,
    title: chunk.heading ?? source.title,
    summary: chunk.text,
    knowledgeId: deriveKnowledgeId(chunk.chunkId) as McsKnowledgeId,
    authorityKind: source.authority?.authorityKind,
    authorityStatus: source.authority?.authorityStatus,
    sourceTitle: source.title,
    citation: {
      label: source.title,
      sourceRef: source.sourceRef ?? null,
      documentId: chunk.documentId,
      chunkId: chunk.chunkId,
      sourceVersion: chunk.sourceVersion,
      chunkIndex: chunk.chunkIndex,
      startOffset: chunk.sourceOffsets.startOffset,
      endOffset: chunk.sourceOffsets.endOffset,
    },
  }));

  for (const chunkRecord of chunkRecords) {
    await writeKnowledge({
      id: chunkRecord.chunkId,
      mongoCollection: KNOWLEDGE_CHUNK_COLLECTION,
      mongoDoc: { ...chunkRecord },
      neo4j: {
        cypher: [
          'MERGE (c:KnowledgeChunk {id:$id})',
          'SET c += $props',
          'WITH c',
          'MATCH (s:KnowledgeSource {id:$sourceId})',
          'MERGE (s)-[:HAS_CHUNK]->(c)',
        ].join(' '),
        params: {
          sourceId: String(source.sourceId),
          props: {
            sourceId: String(chunkRecord.sourceId),
            title: chunkRecord.title,
            domain: chunkRecord.domain,
            language: chunkRecord.language,
            status: chunkRecord.status,
            retrievalEligible: chunkRecord.retrievalEligible,
            sourceVersion: chunkRecord.sourceVersion,
          },
        },
      },
      chroma: {
        collection: KNOWLEDGE_CHUNK_COLLECTION,
        document: chunkRecord.text || chunkRecord.heading || source.title,
        metadata: {
          kind: 'knowledge_chunk',
          sourceId: String(chunkRecord.sourceId),
          chunkId: chunkRecord.chunkId,
          documentId: chunkRecord.documentId,
          sourceVersion: chunkRecord.sourceVersion,
          chunkIndex: chunkRecord.chunkIndex,
          title: chunkRecord.title,
          heading: chunkRecord.heading ?? undefined,
          domain: chunkRecord.domain,
          language: chunkRecord.language,
          status: chunkRecord.status,
          retrievalEligible: chunkRecord.retrievalEligible,
          authority: chunkRecord.authorityKind ?? 'kevin',
          authorityStatus: chunkRecord.authorityStatus,
          sourceTitle: chunkRecord.sourceTitle,
          citationLabel: chunkRecord.citation.label,
          citationSourceRef: chunkRecord.citation.sourceRef ?? undefined,
          topicTags: chunkRecord.topicTags.join('|'),
          agentScopes: chunkRecord.agentScopes.join('|'),
          surfaceScopes: chunkRecord.surfaceScopes.join('|'),
          'scope.tenantId': chunkRecord.scope.tenantId,
          'scope.teamId': chunkRecord.scope.teamId,
          'scope.teamKey': chunkRecord.scope.teamKey,
          'scope.teamName': chunkRecord.scope.teamName,
          startOffset: chunkRecord.sourceOffsets.startOffset,
          endOffset: chunkRecord.sourceOffsets.endOffset,
        },
      },
    });
    invalidateApprovedKnowledgeRetrievalCache();
  }

  let graphRagRecordCount = 0;
  let graphRagFailureCount = 0;
  for (const chunkRecord of chunkRecords) {
    try {
      const projected = await projectApprovedChunkToGraphRag(chunkRecord);
      if (projected) graphRagRecordCount += 1;
    } catch (error) {
      graphRagFailureCount += 1;
      // Approved knowledge remains authoritative. A derived-memory failure must
      // be visible, but must never roll back or ambiguously mutate that approval.
      console.error(
        `[knowledge][graphrag] projection failed for ${chunkRecord.chunkId}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  let resourceCatalogProjection: KnowledgeResourceProjectionResult;
  try {
    resourceCatalogProjection = await projectKevinApprovedKnowledgeSourceToCatalog(
      sourceRecord,
      chunkRecords,
    );
  } catch (error) {
    resourceCatalogProjection = {
      resourceId: `knowledge:${sourceRecord.sourceId}`,
      resourceVersionId: `knowledge:${sourceRecord.sourceId}:v${sourceRecord.version}`,
      active: false,
      reasons: [error instanceof Error ? error.message : String(error)],
      entry: null,
    };
    console.error(
      `[knowledge][resource-catalog] projection failed for ${sourceRecord.sourceId}: ${resourceCatalogProjection.reasons.join(', ')}`,
    );
  }

  return {
    source: sourceRecord,
    chunks: chunkRecords,
    references,
    chunkCount: intake.chunks.length,
    indexRecordCount: intake.indexRecords.length,
    graphRagRecordCount,
    graphRagFailureCount,
    resourceCatalogProjection,
  };
}

export async function projectApprovedChunkToGraphRag(
  chunk: McsKnowledgeBaseChunkRecord,
) {
  if (chunk.status !== 'active' || !chunk.retrievalEligible) return null;
  if (chunk.authorityStatus !== 'active_authority') return null;
  const domain = chunk.domain === 'system' || chunk.domain === 'governance'
    ? 'organizational'
    : chunk.domain;
  return appendGraphRagRecord({
    knowledgeObjectId: String(chunk.knowledgeId),
    version: chunk.sourceVersion,
    tenantId: chunk.scope.tenantId,
    domain,
    language: chunk.language,
    summary: chunk.summary || chunk.text,
    modelVersion: GRAPHRAG_EMBEDDING_MODEL_VERSION,
    title: chunk.title,
    type: 'graphrag_chunk',
    retrievalReady: false,
    derivedFrom: [String(chunk.sourceId), chunk.chunkId],
  });
}

export function createStoredApprovedKnowledgeProvider(): Pick<
  KnowledgeCoreBoundaryPort,
  'listApprovedKnowledge' | 'searchApprovedKnowledge'
> {
  return {
    async listApprovedKnowledge(scope) {
      const data = await persistenceCall<MongoQueryResult>('mongodb', 'query', {
        collection: KNOWLEDGE_CHUNK_COLLECTION,
        filter: {
          status: 'active',
          retrievalEligible: true,
          'scope.tenantId': scope.tenantId,
          'scope.teamId': scope.teamId,
          'scope.teamKey': scope.teamKey,
          'scope.teamName': scope.teamName,
        },
        limit: 200,
      });

      return (data.documents ?? []).flatMap(documentToKnowledgeReference);
    },
    async searchApprovedKnowledge(scope, query, k, language) {
      const normalizedQuery = normalizeSearchQuery(query);
      if (!normalizedQuery) return [];

      const limit = normalizeSemanticK(k);
      const key = approvedRetrievalCacheKey(scope, normalizedQuery, limit, language);
      const now = Date.now();
      const cached = approvedRetrievalCache.get(key);
      if (cached && cached.expiresAt > now) {
        cacheHits += 1;
        approvedRetrievalCache.delete(key);
        approvedRetrievalCache.set(key, cached);
        return copyKnowledgeReferences(cached.references);
      }
      if (cached) approvedRetrievalCache.delete(key);

      const existing = approvedRetrievalInFlight.get(key);
      if (existing?.generation === approvedRetrievalCacheGeneration) {
        cacheCoalesced += 1;
        return copyKnowledgeReferences(await existing.promise);
      }

      cacheMisses += 1;
      const generation = approvedRetrievalCacheGeneration;
      cacheInFlightCount += 1;
      const search = searchApprovedKnowledgeStore(scope, normalizedQuery, limit)
        .then((references) => {
          if (references.length > 0 && generation === approvedRetrievalCacheGeneration) {
            setApprovedRetrievalCacheEntry(key, references);
          }
          return references;
        })
        .finally(() => {
          cacheInFlightCount = Math.max(0, cacheInFlightCount - 1);
          if (approvedRetrievalInFlight.get(key)?.promise === search) {
            approvedRetrievalInFlight.delete(key);
          }
        });
      approvedRetrievalInFlight.set(key, { generation, promise: search });

      return copyKnowledgeReferences(await search);
    },
  };
}

export function getApprovedKnowledgeRetrievalCacheDiagnostics() {
  return {
    retention: 'in_process_since_restart' as const,
    ttlMs: APPROVED_RETRIEVAL_CACHE_TTL_MS,
    maxEntries: APPROVED_RETRIEVAL_CACHE_MAX_ENTRIES,
    hits: cacheHits,
    misses: cacheMisses,
    coalesced: cacheCoalesced,
    evictions: cacheEvictions,
    size: approvedRetrievalCache.size,
    inFlight: cacheInFlightCount,
    invalidations: cacheInvalidations,
    generation: approvedRetrievalCacheGeneration,
  };
}

export function invalidateApprovedKnowledgeRetrievalCache(): void {
  approvedRetrievalCache.clear();
  approvedRetrievalCacheGeneration += 1;
  cacheInvalidations += 1;
}

export function resetApprovedKnowledgeRetrievalCacheForTests(): void {
  approvedRetrievalCache.clear();
  approvedRetrievalInFlight.clear();
  approvedRetrievalCacheGeneration = 0;
  cacheHits = 0;
  cacheMisses = 0;
  cacheCoalesced = 0;
  cacheEvictions = 0;
  cacheInvalidations = 0;
  cacheInFlightCount = 0;
}

async function searchApprovedKnowledgeStore(
  scope: McsRuntimeRequestScope,
  normalizedQuery: string,
  limit: number,
): Promise<McsKnowledgeReference[]> {
  let data: ChromaQueryResult;
  try {
    data = await persistenceCall<ChromaQueryResult>('chromadb', 'query_with_filter', {
      collection: KNOWLEDGE_CHUNK_COLLECTION,
      query: normalizedQuery,
      n_results: limit,
      filter: {
        status: 'active',
        retrievalEligible: true,
      },
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(
      `[knowledge] semantic approved-knowledge search failed through embedder/Chroma; ` +
        `returning empty references. ${err instanceof Error ? err.message : String(err)}`,
    );
    return [];
  }
  return hydrateSemanticSearchReferences(data, scope);
}

function approvedRetrievalCacheKey(
  scope: McsRuntimeRequestScope,
  normalizedQuery: string,
  limit: number,
  language: McsRuntimeLanguage | undefined,
): string {
  return JSON.stringify([
    normalizedQuery.toLocaleLowerCase('en-US'),
    limit,
    language ?? null,
    scope.tenantId,
    scope.teamId ?? null,
    scope.teamKey ?? null,
    scope.teamName ?? null,
    scope.tmagId ?? null,
  ]);
}

function setApprovedRetrievalCacheEntry(key: string, references: readonly McsKnowledgeReference[]): void {
  if (approvedRetrievalCache.has(key)) approvedRetrievalCache.delete(key);
  while (approvedRetrievalCache.size >= APPROVED_RETRIEVAL_CACHE_MAX_ENTRIES) {
    const oldest = approvedRetrievalCache.keys().next().value as string | undefined;
    if (oldest === undefined) break;
    approvedRetrievalCache.delete(oldest);
    cacheEvictions += 1;
  }
  approvedRetrievalCache.set(key, {
    expiresAt: Date.now() + APPROVED_RETRIEVAL_CACHE_TTL_MS,
    references: copyKnowledgeReferences(references),
  });
}

function copyKnowledgeReferences(references: readonly McsKnowledgeReference[]): McsKnowledgeReference[] {
  return structuredClone(references) as McsKnowledgeReference[];
}

export function knowledgeChromaCollection(
  domain: McsKnowledgeDomain,
  language: McsRuntimeLanguage,
): string {
  const collectionDomain =
    domain === 'governance' || domain === 'system' ? 'organizational' : domain;
  return `mcs_${collectionDomain}_knowledge_${language}`;
}

function documentToKnowledgeReference(doc: Record<string, unknown>): McsKnowledgeReference[] {
  const knowledgeId = typeof doc.knowledgeId === 'string' ? doc.knowledgeId : undefined;
  const sourceId = typeof doc.sourceId === 'string' ? doc.sourceId : undefined;
  const domain = doc.domain;
  const language = doc.language;
  const status = doc.status;
  const retrievalEligible = doc.retrievalEligible;
  if (
    !knowledgeId ||
    !sourceId ||
    !isDomain(domain) ||
    (language !== 'en' && language !== 'es') ||
    status !== 'active' ||
    retrievalEligible === false
  ) {
    return [];
  }

  const title = typeof doc.title === 'string' ? doc.title : undefined;
  const summary = typeof doc.summary === 'string' ? doc.summary : undefined;
  const translationStatus = isTranslationStatus(doc.translationStatus)
    ? doc.translationStatus
    : 'same_language';
  const freshness = extractFreshness(doc);

  return [{
    knowledgeId: knowledgeId as McsKnowledgeReference['knowledgeId'],
    ...(title ? { title } : {}),
    ...(summary ? { summary } : {}),
    domain,
    status,
    language,
    translationStatus,
    sourceId: sourceId as McsKnowledgeReference['sourceId'],
    ...(citationFromRecord(doc) ? { citation: citationFromRecord(doc)! } : {}),
    ...(freshness ? { freshness } : {}),
  }];
}

function hydrateSemanticSearchReferences(
  data: ChromaQueryResult,
  scope: McsRuntimeRequestScope,
): McsKnowledgeReference[] {
  const ids = data.results?.ids ?? [];
  const documents = data.results?.documents ?? [];
  const metadatas = data.results?.metadatas ?? [];
  const references: McsKnowledgeReference[] = [];

  for (let index = 0; index < ids.length; index += 1) {
    const metadata = metadatas[index] ?? {};
    if (!isApprovedSearchHit(metadata, scope)) continue;

    const chunk = metadataToKnowledgeChunk({
      id: ids[index],
      document: documents[index],
      metadata,
      scope,
    });
    if (!chunk) continue;

    const [reference] = chunksToKnowledgeReferences([chunk]);
    if (!reference) continue;

    references.push({
      ...reference,
      ...(typeof metadata.title === 'string' && metadata.title.trim().length > 0
        ? { title: metadata.title }
        : {}),
      translationStatus: isTranslationStatus(metadata.translationStatus)
        ? metadata.translationStatus
        : reference.translationStatus,
      ...(extractFreshness(metadata) ? { freshness: extractFreshness(metadata) } : {}),
      ...(citationFromRecord(metadata) ? { citation: citationFromRecord(metadata)! } : {}),
    });
  }

  return references;
}

function citationFromRecord(record: Record<string, unknown>) {
  const documentId = stringValue(record.documentId);
  const chunkId = stringValue(record.chunkId);
  const sourceVersion = numberValue(record.sourceVersion);
  const chunkIndex = numberValue(record.chunkIndex);
  const startOffset = numberValue(record.startOffset) ?? (isRecord(record.sourceOffsets) ? numberValue(record.sourceOffsets.startOffset) : undefined);
  const endOffset = numberValue(record.endOffset) ?? (isRecord(record.sourceOffsets) ? numberValue(record.sourceOffsets.endOffset) : undefined);
  const label = stringValue(record.citationLabel) ?? stringValue(record.sourceTitle);
  if (!documentId || !chunkId || !label || sourceVersion === undefined || chunkIndex === undefined || startOffset === undefined || endOffset === undefined || sourceVersion < 1 || chunkIndex < 0 || startOffset < 0 || endOffset < startOffset) return null;
  return { label, sourceRef: stringValue(record.citationSourceRef) ?? stringValue(record.sourceRef) ?? null, documentId, chunkId, sourceVersion, chunkIndex, startOffset, endOffset };
}

function metadataToKnowledgeChunk(input: {
  id: string | undefined;
  document: string | undefined;
  metadata: Record<string, unknown>;
  scope: McsRuntimeRequestScope;
}): McsKnowledgeChunk | null {
  const chunkId = stringValue(input.metadata.chunkId) ?? input.id;
  const sourceId = stringValue(input.metadata.sourceId);
  const domain = input.metadata.domain;
  const language = input.metadata.language;
  const text = input.document ?? stringValue(input.metadata.summary) ?? stringValue(input.metadata.text);
  if (
    !chunkId ||
    !sourceId ||
    !text ||
    !isDomain(domain) ||
    (language !== 'en' && language !== 'es')
  ) {
    return null;
  }

  return {
    chunkId,
    sourceId: sourceId as McsSourceId,
    documentId: stringValue(input.metadata.documentId) ?? `${sourceId}:document`,
    sourceVersion: numberValue(input.metadata.sourceVersion) ?? 1,
    heading: stringValue(input.metadata.heading) ?? stringValue(input.metadata.title) ?? null,
    text,
    chunkIndex: numberValue(input.metadata.chunkIndex) ?? 0,
    language,
    domain,
    scope: scopeFromMetadata(input.metadata, input.scope),
    topicTags: stringArrayValue(input.metadata.topicTags),
    agentScopes: agentScopesFromMetadata(input.metadata.agentScopes),
    surfaceScopes: surfaceScopesFromMetadata(input.metadata.surfaceScopes),
    sourceOffsets: {
      startOffset: numberValue(input.metadata.startOffset) ?? 0,
      endOffset: numberValue(input.metadata.endOffset) ?? text.length,
    },
    status: 'active',
    retrievalEligible: input.metadata.retrievalEligible !== false,
  };
}

function isApprovedSearchHit(
  metadata: Record<string, unknown>,
  scope: McsRuntimeRequestScope,
): boolean {
  const status = metadata.status;
  if (status !== 'active' && status !== 'approved') return false;
  if (metadata.retrievalEligible === false) return false;
  if (!metadataScopeMatches(metadata, scope)) return false;

  const authorityStatus = metadata.authorityStatus ?? metadata.authorityDecision;
  if (
    authorityStatus !== undefined &&
    authorityStatus !== 'active_authority' &&
    authorityStatus !== 'approved'
  ) {
    return false;
  }

  const authority = metadata.authority;
  if (
    authority !== undefined &&
    authority !== 'kevin' &&
    authority !== 'kevin_authored' &&
    authority !== 'kevin_approved'
  ) {
    return false;
  }

  return true;
}

function metadataScopeMatches(
  metadata: Record<string, unknown>,
  scope: McsRuntimeRequestScope,
): boolean {
  const tenantId = stringValue(metadata['scope.tenantId']) ?? stringValue(metadata.tenantId);
  const teamId = stringValue(metadata['scope.teamId']) ?? stringValue(metadata.teamId);
  const teamKey = stringValue(metadata['scope.teamKey']) ?? stringValue(metadata.teamKey);
  const teamName = stringValue(metadata['scope.teamName']) ?? stringValue(metadata.teamName);
  if (tenantId !== undefined && tenantId !== scope.tenantId) return false;
  if (teamId !== undefined && teamId !== scope.teamId) return false;
  if (teamKey !== undefined && teamKey !== scope.teamKey) return false;
  if (teamName !== undefined && teamName !== scope.teamName) return false;
  return true;
}

function scopeFromMetadata(
  metadata: Record<string, unknown>,
  fallback: McsRuntimeRequestScope,
): McsRuntimeRequestScope {
  const teamScope = teamMagnificentScope();
  return {
    tenantId: (stringValue(metadata['scope.tenantId']) ?? stringValue(metadata.tenantId) ?? fallback.tenantId) as McsRuntimeRequestScope['tenantId'],
    teamId: (stringValue(metadata['scope.teamId']) ?? stringValue(metadata.teamId) ?? fallback.teamId ?? teamScope.teamId) as NonNullable<McsRuntimeRequestScope['teamId']>,
    teamKey: (stringValue(metadata['scope.teamKey']) ?? stringValue(metadata.teamKey) ?? fallback.teamKey ?? teamScope.teamKey) as NonNullable<McsRuntimeRequestScope['teamKey']>,
    teamName: (stringValue(metadata['scope.teamName']) ?? stringValue(metadata.teamName) ?? fallback.teamName ?? teamScope.teamName) as NonNullable<McsRuntimeRequestScope['teamName']>,
    ...(fallback.tmagId ? { tmagId: fallback.tmagId } : {}),
  };
}

function normalizeSearchQuery(query: string): string {
  return query.replace(/\s+/g, ' ').trim();
}

function normalizeSemanticK(k: number | undefined): number {
  if (k === undefined) return DEFAULT_SEMANTIC_K;
  if (!Number.isFinite(k)) return DEFAULT_SEMANTIC_K;
  return Math.max(1, Math.min(MAX_SEMANTIC_K, Math.floor(k)));
}

function extractFreshness(record: Record<string, unknown>): McsKnowledgeFreshness | undefined {
  if (isRecord(record.freshness)) return record.freshness as unknown as McsKnowledgeFreshness;
  const freshness: McsKnowledgeFreshness = {};
  if (typeof record.freshnessLifecycle === 'string') freshness.lifecycle = record.freshnessLifecycle as McsKnowledgeFreshness['lifecycle'];
  if (typeof record.lifecycle === 'string') freshness.lifecycle = record.lifecycle as McsKnowledgeFreshness['lifecycle'];
  if (typeof record.effectiveAt === 'string') freshness.effectiveAt = record.effectiveAt;
  if (typeof record.expiresAt === 'string') freshness.expiresAt = record.expiresAt;
  if (typeof record.updatedAt === 'string') freshness.updatedAt = record.updatedAt;
  return Object.keys(freshness).length > 0 ? freshness : undefined;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value : undefined;
}

function numberValue(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function stringArrayValue(value: unknown): string[] {
  if (typeof value === 'string') {
    return value
      .split(/[|,]/g)
      .map((item) => item.trim())
      .filter(Boolean);
  }
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string');
}

function agentScopesFromMetadata(value: unknown): McsAgentKey[] {
  return stringArrayValue(value).filter((item): item is McsAgentKey =>
    item === 'steve_success' || item === 'michael_magnificent' || item === 'ivory',
  );
}

function surfaceScopesFromMetadata(value: unknown): McsKnowledgeChunk['surfaceScopes'] {
  const scopes = stringArrayValue(value).filter((item): item is McsKnowledgeChunk['surfaceScopes'][number] =>
    item === 'team' || item === 'admin',
  );
  return scopes.length > 0 ? scopes : ['team'];
}

function isTranslationStatus(value: unknown): value is McsRuntimeTranslationStatus {
  return value === 'same_language' ||
    value === 'not_required' ||
    value === 'human_reviewed_translation' ||
    value === 'machine_translation_marked' ||
    value === 'language_neutral_template' ||
    value === 'clarification_required';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function teamMagnificentScope(): McsRuntimeRequestScope {
  return {
    tenantId: 'tenant_team_magnificent' as McsRuntimeRequestScope['tenantId'],
    teamId: 'team_magnificent' as NonNullable<McsRuntimeRequestScope['teamId']>,
    teamKey: 'team_magnificent',
    teamName: 'Team Magnificent',
  };
}

function isDomain(value: unknown): value is McsKnowledgeDomain {
  return value === 'success' ||
    value === 'training' ||
    value === 'relationship' ||
    value === 'performance' ||
    value === 'organizational' ||
    value === 'system' ||
    value === 'governance';
}
