import type { McsGraphRagRecord } from '@momentum/shared';
import type { McsKnowledgeId, McsKnowledgeReference, McsSourceId } from '@momentum/shared/runtime';
import { persistenceCall } from '../services/persistence/dispatch.js';
import { activeKnowledgeCollection } from './graphrag.js';

const MONGO_COLLECTION = 'mcs_graphrag_records';
const OUTBOX_COLLECTION = 'tmag_projection_outbox';
export const GRAPHRAG_READINESS_BATCH_MAX_UNIQUE_IDS = 50;

export type GraphRagReadinessStatus = 'ready' | 'blocked' | 'degraded';
export interface GraphRagReadinessResult {
  id: string;
  status: GraphRagReadinessStatus;
  reasons: string[];
  record: McsGraphRagRecord | null;
}

interface MongoResult { documents?: Array<Record<string, unknown>>; count?: number }
interface ChromaGetResult { ids?: string[]; documents?: string[]; metadatas?: Array<Record<string, unknown> | null> }
interface NeoResult { records?: Array<Record<string, unknown>> }

let readinessBatches = 0;
let readinessRequestedIds = 0;
let readinessMongoCanonicalCalls = 0;
let readinessMongoOutboxCalls = 0;
let readinessNeo4jCalls = 0;
let readinessChromaCalls = 0;

export async function verifyGraphRagRetrievalReadiness(id: string): Promise<GraphRagReadinessResult> {
  const [result] = await verifyGraphRagRetrievalReadinessBatch([id]);
  return result ?? blocked(id, 'mongo_missing_or_ambiguous');
}

export async function verifyGraphRagRetrievalReadinessBatch(
  ids: readonly string[],
): Promise<GraphRagReadinessResult[]> {
  const uniqueIds = [...new Set(ids)];
  if (uniqueIds.length > GRAPHRAG_READINESS_BATCH_MAX_UNIQUE_IDS) {
    throw new RangeError(
      `GraphRAG readiness accepts at most ${GRAPHRAG_READINESS_BATCH_MAX_UNIQUE_IDS} unique ids`,
    );
  }

  readinessBatches += 1;
  readinessRequestedIds += ids.length;
  if (uniqueIds.length === 0) return [];

  let mongo: MongoResult;
  try {
    readinessMongoCanonicalCalls += 1;
    mongo = await persistenceCall<MongoResult>('mongodb', 'query', {
      database: 'momentum', collection: MONGO_COLLECTION,
      filter: { _id: { $in: uniqueIds } }, limit: uniqueIds.length,
    });
  } catch (error) {
    return ids.map((id) => degraded(id, `mongo_error:${message(error)}`));
  }

  const mongoDocuments = mongo.documents ?? [];
  const preliminary = new Map<string, GraphRagReadinessResult>();
  const eligibleRecords: McsGraphRagRecord[] = [];
  for (const id of uniqueIds) {
    const documents = mongoDocuments.filter((doc) => doc._id === id || doc.id === id);
    if (documents.length !== 1) {
      preliminary.set(id, blocked(id, 'mongo_missing_or_ambiguous'));
      continue;
    }
    const record = asRecord(documents[0]!, id);
    if (!record) {
      preliminary.set(id, blocked(id, 'invalid_mongo_record'));
      continue;
    }
    if (!record.retrievalReady) {
      preliminary.set(id, { id, status: 'blocked', reasons: ['mongo_not_retrieval_ready'], record });
      continue;
    }
    eligibleRecords.push(record);
  }

  if (eligibleRecords.length > 0) {
    await verifyEligibleProjections(eligibleRecords, preliminary);
  }

  return ids.map((id) => copyReadinessResult(
    preliminary.get(id) ?? blocked(id, 'mongo_missing_or_ambiguous'),
  ));
}

export function getGraphRagReadinessDiagnostics() {
  return {
    retention: 'in_process_since_restart' as const,
    maxUniqueIds: GRAPHRAG_READINESS_BATCH_MAX_UNIQUE_IDS,
    batches: readinessBatches,
    requestedIds: readinessRequestedIds,
    storeCalls: {
      mongoCanonical: readinessMongoCanonicalCalls,
      mongoOutbox: readinessMongoOutboxCalls,
      neo4j: readinessNeo4jCalls,
      chroma: readinessChromaCalls,
    },
  };
}

export function resetGraphRagReadinessDiagnosticsForTests(): void {
  readinessBatches = 0;
  readinessRequestedIds = 0;
  readinessMongoCanonicalCalls = 0;
  readinessMongoOutboxCalls = 0;
  readinessNeo4jCalls = 0;
  readinessChromaCalls = 0;
}

async function verifyEligibleProjections(
  records: readonly McsGraphRagRecord[],
  results: Map<string, GraphRagReadinessResult>,
): Promise<void> {
  const ids = records.map((record) => record.id);
  const chromaGroups = new Map<string, McsGraphRagRecord[]>();
  for (const record of records) {
    const collection = activeKnowledgeCollection(record.domain, record.language);
    const group = chromaGroups.get(collection) ?? [];
    group.push(record);
    chromaGroups.set(collection, group);
  }

  readinessMongoOutboxCalls += 1;
  const outboxPromise = persistenceCall<MongoResult>('mongodb', 'query', {
    database: 'momentum', collection: OUTBOX_COLLECTION,
    filter: {
      mongoCollection: MONGO_COLLECTION,
      entityId: { $in: ids },
      status: { $in: ['pending', 'failed'] },
    },
    limit: ids.length * 2,
  });

  readinessNeo4jCalls += 1;
  const neoPromise = persistenceCall<NeoResult>('neo4j', 'cypher', {
    query: 'MATCH (k:TmagKnowledge) WHERE k.id IN $ids RETURN k.id AS id, k.knowledgeObjectId AS knowledgeObjectId, k.version AS version, k.domain AS domain, k.language AS language, k.tenantId AS tenantId, k.retrievalReady AS retrievalReady',
    params: { ids },
  });

  const chromaPromises = [...chromaGroups.entries()].map(async ([collection, group]) => {
    readinessChromaCalls += 1;
    const value = await persistenceCall<ChromaGetResult>('chromadb', 'get', {
      collection: activeKnowledgeCollection(group[0]!.domain, group[0]!.language),
      ids: group.map((record) => record.id),
    });
    return { collection, value };
  });

  const [outboxSettled, neoSettled, ...chromaSettled] = await Promise.allSettled([
    outboxPromise,
    neoPromise,
    ...chromaPromises,
  ]);
  const chromaByCollection = new Map<string, PromiseSettledResult<ChromaGetResult>>();
  [...chromaGroups.keys()].forEach((collection, index) => {
    const settled = chromaSettled[index];
    if (!settled) return;
    if (settled.status === 'fulfilled') {
      chromaByCollection.set(collection, { status: 'fulfilled', value: settled.value.value });
    } else {
      chromaByCollection.set(collection, settled);
    }
  });

  for (const record of records) {
    const reasons: string[] = [];
    let degradedResult = false;

    if (outboxSettled.status === 'rejected') {
      degradedResult = true;
      reasons.push(`outbox_error:${message(outboxSettled.reason)}`);
    } else if (outboxResultTruncated(outboxSettled.value)) {
      degradedResult = true;
      reasons.push('outbox_result_truncated');
    } else if (hasUnresolvedProjection(outboxSettled.value, record.id)) {
      reasons.push('projection_unresolved');
    }

    if (neoSettled.status === 'rejected') {
      degradedResult = true;
      reasons.push(`neo4j_error:${message(neoSettled.reason)}`);
    } else if (!exactNeoMatch(neoSettled.value.records, record)) {
      reasons.push('neo4j_missing_mismatch_or_ambiguous');
    }

    const collection = activeKnowledgeCollection(record.domain, record.language);
    const chroma = chromaByCollection.get(collection);
    if (!chroma || chroma.status === 'rejected') {
      degradedResult = true;
      reasons.push(`chroma_error:${message(chroma?.status === 'rejected' ? chroma.reason : 'missing result')}`);
    } else if (!exactChromaMatch(chroma.value, record)) {
      reasons.push('chroma_missing_mismatch_or_ambiguous');
    }

    results.set(record.id, {
      id: record.id,
      status: degradedResult ? 'degraded' : reasons.length === 0 ? 'ready' : 'blocked',
      reasons,
      record,
    });
  }
}

export function graphRagReadinessReference(result: GraphRagReadinessResult): McsKnowledgeReference | null {
  const record = result.record;
  const sourceId = record?.derivedFrom?.[0];
  if (result.status !== 'ready' || !record || !sourceId) return null;
  return {
    knowledgeId: record.knowledgeObjectId as McsKnowledgeId,
    domain: record.domain,
    status: 'active',
    language: record.language,
    translationStatus: 'same_language',
    sourceId: sourceId as McsSourceId,
    title: record.title,
    summary: record.summary,
  };
}

function hasUnresolvedProjection(result: MongoResult, id: string): boolean {
  const documents = result.documents ?? [];
  if ((result.count ?? documents.length) === 0) return false;
  return documents.some((document) => document.entityId === undefined || document.entityId === id);
}

function outboxResultTruncated(result: MongoResult): boolean {
  return typeof result.count === 'number' && result.count > (result.documents?.length ?? 0);
}

function asRecord(doc: Record<string, unknown>, id: string): McsGraphRagRecord | null {
  if (doc.id !== id || typeof doc.knowledgeObjectId !== 'string' || typeof doc.version !== 'number' ||
      !['success', 'training', 'relationship', 'performance', 'organizational'].includes(String(doc.domain)) ||
      !['en', 'es'].includes(String(doc.language)) || typeof doc.tenantId !== 'string' ||
      typeof doc.retrievalReady !== 'boolean' || !Array.isArray(doc.derivedFrom)) return null;
  return doc as unknown as McsGraphRagRecord;
}

function exactNeoMatch(rows: Array<Record<string, unknown>> | undefined, record: McsGraphRagRecord): boolean {
  const matches = rows?.filter((row) => row.id === record.id) ?? [];
  return matches.length === 1 && equalProjection(matches[0]!, record);
}

function exactChromaMatch(result: ChromaGetResult, record: McsGraphRagRecord): boolean {
  const index = result.ids?.indexOf(record.id) ?? -1;
  return index >= 0 && result.ids?.filter((id) => id === record.id).length === 1 &&
    equalProjection(result.metadatas?.[index] ?? {}, record);
}

function equalProjection(value: Record<string, unknown>, record: McsGraphRagRecord): boolean {
  return value.id === undefined || value.id === record.id
    ? value.knowledgeObjectId === record.knowledgeObjectId && Number(value.version) === record.version &&
      value.domain === record.domain && value.language === record.language && value.tenantId === record.tenantId &&
      value.retrievalReady === true
    : false;
}

function copyReadinessResult(result: GraphRagReadinessResult): GraphRagReadinessResult {
  return {
    ...result,
    reasons: [...result.reasons],
    record: result.record ? structuredClone(result.record) : null,
  };
}

function blocked(id: string, reason: string): GraphRagReadinessResult { return { id, status: 'blocked', reasons: [reason], record: null }; }
function degraded(id: string, reason: string): GraphRagReadinessResult { return { id, status: 'degraded', reasons: [reason], record: null }; }
function message(error: unknown): string { return error instanceof Error ? error.message : String(error); }
