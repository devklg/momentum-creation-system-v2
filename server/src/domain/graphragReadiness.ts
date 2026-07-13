import type { McsGraphRagRecord } from '@momentum/shared';
import type { McsKnowledgeId, McsKnowledgeReference, McsSourceId } from '@momentum/shared/runtime';
import { persistenceCall } from '../services/persistence/dispatch.js';
import { activeKnowledgeCollection } from './graphrag.js';

const MONGO_COLLECTION = 'mcs_graphrag_records';
const OUTBOX_COLLECTION = 'tmag_projection_outbox';

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

export async function verifyGraphRagRetrievalReadiness(id: string): Promise<GraphRagReadinessResult> {
  let mongo: MongoResult;
  try {
    mongo = await persistenceCall<MongoResult>('mongodb', 'query', {
      database: 'momentum', collection: MONGO_COLLECTION, filter: { _id: id }, limit: 2,
    });
  } catch (error) {
    return degraded(id, `mongo_error:${message(error)}`);
  }
  if ((mongo.documents?.length ?? 0) !== 1) return blocked(id, 'mongo_missing_or_ambiguous');
  const record = asRecord(mongo.documents![0]!, id);
  if (!record) return blocked(id, 'invalid_mongo_record');
  if (!record.retrievalReady) return { id, status: 'blocked', reasons: ['mongo_not_retrieval_ready'], record };

  try {
    const [outbox, neo, chroma] = await Promise.all([
      persistenceCall<MongoResult>('mongodb', 'query', {
        database: 'momentum', collection: OUTBOX_COLLECTION,
        filter: { mongoCollection: MONGO_COLLECTION, entityId: id, status: { $in: ['pending', 'failed'] } }, limit: 10,
      }),
      persistenceCall<NeoResult>('neo4j', 'cypher', {
        query: 'MATCH (k:TmagKnowledge {id:$id}) RETURN k.id AS id, k.knowledgeObjectId AS knowledgeObjectId, k.version AS version, k.domain AS domain, k.language AS language, k.tenantId AS tenantId, k.retrievalReady AS retrievalReady',
        params: { id },
      }),
      persistenceCall<ChromaGetResult>('chromadb', 'get', {
        collection: activeKnowledgeCollection(record.domain, record.language), ids: [id],
      }),
    ]);
    const reasons: string[] = [];
    if ((outbox.documents?.length ?? outbox.count ?? 0) > 0) reasons.push('projection_unresolved');
    if (!exactNeoMatch(neo.records, record)) reasons.push('neo4j_missing_mismatch_or_ambiguous');
    if (!exactChromaMatch(chroma, record)) reasons.push('chroma_missing_mismatch_or_ambiguous');
    return { id, status: reasons.length === 0 ? 'ready' : 'blocked', reasons, record };
  } catch (error) {
    return { id, status: 'degraded', reasons: [`store_error:${message(error)}`], record };
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

function asRecord(doc: Record<string, unknown>, id: string): McsGraphRagRecord | null {
  if (doc.id !== id || typeof doc.knowledgeObjectId !== 'string' || typeof doc.version !== 'number' ||
      !['success', 'training', 'relationship', 'performance', 'organizational'].includes(String(doc.domain)) ||
      !['en', 'es'].includes(String(doc.language)) || typeof doc.tenantId !== 'string' ||
      typeof doc.retrievalReady !== 'boolean' || !Array.isArray(doc.derivedFrom)) return null;
  return doc as unknown as McsGraphRagRecord;
}

function exactNeoMatch(rows: Array<Record<string, unknown>> | undefined, record: McsGraphRagRecord): boolean {
  return rows?.length === 1 && equalProjection(rows[0]!, record);
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

function blocked(id: string, reason: string): GraphRagReadinessResult { return { id, status: 'blocked', reasons: [reason], record: null }; }
function degraded(id: string, reason: string): GraphRagReadinessResult { return { id, status: 'degraded', reasons: [reason], record: null }; }
function message(error: unknown): string { return error instanceof Error ? error.message : String(error); }
