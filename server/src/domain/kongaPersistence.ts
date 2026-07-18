import { persistenceCall } from '../services/persistence/dispatch.js';
import { tripleStackWrite, type TripleStackInput } from '../services/tripleStack.js';

type Persistence = typeof persistenceCall;
type Writer = typeof tripleStackWrite;

function neoCount(result: unknown): number {
  const record = (result as { records?: Array<Record<string, unknown>> }).records?.[0];
  const value = record?.n;
  if (typeof value === 'number') return value;
  if (value && typeof value === 'object' && 'low' in value) {
    return Number((value as { low: number }).low);
  }
  return Number(value ?? 0);
}

export interface KongaReadback {
  mongo: Record<string, unknown>;
  neo4jCount: number;
  chromaId: string;
}

/**
 * Governed Konga write: the normal application tripleStackWrite path followed
 * by exact read-back of all three required legs. Callers may publish public
 * events only after this function resolves.
 */
export async function tripleStackWriteWithReadback(
  input: TripleStackInput & {
    neo4jVerify: { cypher: string; params?: Record<string, unknown> };
    chromaId?: string;
  },
  persistence: Persistence = persistenceCall,
  writer: Writer = tripleStackWrite,
): Promise<KongaReadback> {
  if (!input.neo4j || !input.chroma) {
    throw new Error('konga_three_required_legs_missing');
  }

  await writer(input);

  const [mongoResult, neo4jResult, chromaResult] = await Promise.all([
    persistence<{ documents?: Array<Record<string, unknown>> }>('mongodb', 'query', {
      database: input.mongoDatabase ?? 'momentum',
      collection: input.mongoCollection,
      filter: { _id: input.id },
      limit: 1,
    }),
    persistence('neo4j', 'cypher', {
      query: input.neo4jVerify.cypher,
      params: { id: input.id, ...(input.neo4jVerify.params ?? {}) },
    }),
    persistence<{ ids?: string[] }>('chromadb', 'get', {
      collection: input.chroma.collection,
      ids: [input.chromaId ?? input.id],
    }),
  ]);

  const mongo = mongoResult.documents?.[0];
  if (!mongo) throw new Error(`konga_mongo_readback_missing:${input.id}`);
  const neo4jCount = neoCount(neo4jResult);
  if (neo4jCount !== 1) {
    throw new Error(`konga_neo4j_readback_not_exact:${input.id}:${neo4jCount}`);
  }
  const chromaId = input.chromaId ?? input.id;
  if (!(chromaResult.ids ?? []).includes(chromaId)) {
    throw new Error(`konga_chroma_readback_missing:${chromaId}`);
  }

  return { mongo, neo4jCount, chromaId };
}

export async function verifyKongaThreeLegs(
  input: {
    id: string;
    mongoCollection: string;
    neo4jVerify: { cypher: string; params?: Record<string, unknown> };
    chromaCollection: string;
    mongoDatabase?: string;
    chromaId?: string;
  },
  persistence: Persistence = persistenceCall,
): Promise<KongaReadback> {
  const [mongoResult, neo4jResult, chromaResult] = await Promise.all([
    persistence<{ documents?: Array<Record<string, unknown>> }>('mongodb', 'query', {
      database: input.mongoDatabase ?? 'momentum',
      collection: input.mongoCollection,
      filter: { _id: input.id },
      limit: 1,
    }),
    persistence('neo4j', 'cypher', {
      query: input.neo4jVerify.cypher,
      params: { id: input.id, ...(input.neo4jVerify.params ?? {}) },
    }),
    persistence<{ ids?: string[] }>('chromadb', 'get', {
      collection: input.chromaCollection,
      ids: [input.chromaId ?? input.id],
    }),
  ]);
  const mongo = mongoResult.documents?.[0];
  if (!mongo) throw new Error(`konga_mongo_readback_missing:${input.id}`);
  const neo4jCount = neoCount(neo4jResult);
  if (neo4jCount !== 1) throw new Error(`konga_neo4j_readback_not_exact:${input.id}:${neo4jCount}`);
  const chromaId = input.chromaId ?? input.id;
  if (!(chromaResult.ids ?? []).includes(chromaId)) throw new Error(`konga_chroma_readback_missing:${chromaId}`);
  return { mongo, neo4jCount, chromaId };
}
