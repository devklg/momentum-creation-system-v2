import { describe, expect, it, vi } from 'vitest';
import {
  deriveKongaPlacementIdentity,
  placeKongaProspect,
  projectLegacyPlacementAddedBy,
  resolveInvitationRecordId,
} from '../kongaPlacement.js';
import {
  type KongaReadback,
  type tripleStackWriteWithReadback,
  type verifyKongaThreeLegs,
} from '../kongaPersistence.js';

const PROSPECTS_COLLECTION = 'tmag_prospects';
const MONGO_DB = 'momentum';
const PLACEMENT_COLLECTION = 'tmag_prospect_htank_placements';
const CLAIM_COLLECTION = 'tmag_konga_placement_claims';
const CHROMA_COLLECTION = 'mcs_prospect_htank_events';
const CLAIM_CHROMA_COLLECTION = 'mcs_konga_placement_claims';
const TEAM_POOL_ID = 'tm_team_pool';
const PLACEMENT_NEO4J_WRITE =
  'MERGE (pool:TmagPool {id:$poolId}) MATCH (p:TmagProspect {prospectId:$prospectId}) ' +
  'MERGE (p)-[r:IN_HOLDING_TANK {placementId:$id}]->(pool) ' +
  'SET r += $relationshipProps';

const dispatch = vi.hoisted(() => ({ persistenceCall: vi.fn() }));

vi.mock('../../services/persistence/dispatch.js', () => dispatch);

dispatch.persistenceCall.mockImplementation(async (tool: string, action: string) => {
  if (tool === 'chromadb' && action === 'list_collections') {
    return {
      collections: [{ name: CLAIM_CHROMA_COLLECTION }, { name: CHROMA_COLLECTION }],
    };
  }
  return {};
});

const input = {
  prospectId: 'prospect-1',
  sponsorTmagId: 'TMBA-SPONSOR',
  invitationRecordId: 'immutable-invitation-1',
  prospectExpiresAt: '2026-09-01T00:00:00.000Z',
  firstName: 'Avery',
  lastInitial: 'Q',
  city: 'Los Angeles',
  stateOrRegion: 'CA',
  now: new Date('2026-07-17T18:00:00.000Z'),
};

const prospectSeed = {
  prospectId: input.prospectId,
  sponsorTmagId: input.sponsorTmagId,
  firstName: input.firstName,
  lastInitial: input.lastInitial,
  city: input.city,
  stateOrRegion: input.stateOrRegion,
};

type JsonRecord = Record<string, unknown>;

interface ClaimState {
  _id: string;
  claimEventId?: string;
  prospectId: string;
  placementAttemptId: string;
  placementId: string;
  ownerAttempt: string;
  fence: number;
  expiresAt: string;
  createdAt: string;
  heartbeatAt: string;
}

interface Barrier {
  wait: () => Promise<void>;
  release: (count?: number) => void;
}

type KongaPlacementResult = {
  placementId: string;
  placementAttemptId: string;
  prospectId: string;
  positionNumber: number;
  placedAt: string;
  alreadyPlaced: boolean;
};

type KongaStrictWrite = typeof tripleStackWriteWithReadback;
type KongaStrictVerify = typeof verifyKongaThreeLegs;
type KongaStrictWriteInput = {
  id: string;
  mongoCollection: string;
  mongoDoc: JsonRecord;
  neo4j?: { cypher: string; params?: JsonRecord };
  chroma?: { collection: string; document: string; metadata?: Record<string, unknown> };
  neo4jVerify: { cypher: string; params?: JsonRecord };
  chromaId?: string;
};
function createBarrier(): Barrier {
  let permits = 0;
  const waiters: Array<() => void> = [];

  return {
    wait: async () =>
      new Promise<void>((resolve) => {
        if (permits > 0) {
          permits -= 1;
          resolve();
          return;
        }
        waiters.push(resolve);
      }),
    release(count = 1): void {
      let remaining = count;
      while (remaining > 0) {
        const waiter = waiters.shift();
        if (!waiter) {
          permits += 1;
          remaining -= 1;
          continue;
        }
        waiter();
        remaining -= 1;
      }
    },
  };
}

function filterMatches(document: JsonRecord, rawFilter: JsonRecord | undefined): boolean {
  if (!rawFilter) return true;
  const filter = rawFilter;

  if ('$or' in filter && Array.isArray(filter.$or)) {
    return filter.$or.some((candidate) => filterMatches(document, candidate as JsonRecord));
  }

  for (const [key, rawValue] of Object.entries(filter)) {
    if (key === '$or' || key === '$and') continue;
    const candidate = document[key];

    if (rawValue && typeof rawValue === 'object' && !Array.isArray(rawValue)) {
      const operator = rawValue as JsonRecord;
      if ('$ne' in operator) {
        if (candidate === operator.$ne) return false;
        continue;
      }
      if ('$eq' in operator) {
        if (candidate !== operator.$eq) return false;
        continue;
      }
      if ('$exists' in operator) {
        const expected = Boolean(operator.$exists);
        if ((candidate !== undefined) !== expected) return false;
        continue;
      }
      if ('$lt' in operator) {
        if (Number(candidate) >= Number(operator.$lt)) return false;
        continue;
      }
      if ('$gt' in operator) {
        if (Number(candidate) <= Number(operator.$gt)) return false;
        continue;
      }
    }

    if (candidate !== rawValue) return false;
  }

  return true;
}

function applySet(document: JsonRecord, update: JsonRecord | undefined): void {
  const set = update?.$set;
  if (!set || typeof set !== 'object') return;
  Object.entries(set as JsonRecord).forEach(([key, value]) => {
    document[key] = value;
  });
}

function placementEdgeKey(poolId: string, placementId: string): string {
  return `${poolId}|${placementId}`;
}

function placementProjectionEventId(placement: { placementId: string; ownerAttempt: string; fence: number }): string {
  return `${placement.placementId}|${placement.ownerAttempt}|${placement.fence}`;
}

function claimId(prospectId: string): string {
  return `konga_claim_${prospectId}`;
}

function buildClaimEventId(claim: { _id: string; ownerAttempt: string; fence: number }): string {
  return `${claim._id}|${claim.ownerAttempt}|${claim.fence}`;
}

function chromaMapFor(
  collections: Map<string, Map<string, { document: string; metadata: JsonRecord | null }>>,
  collection: string,
): Map<string, { document: string; metadata: JsonRecord | null }> {
  let state = collections.get(collection);
  if (!state) {
    state = new Map<string, { document: string; metadata: JsonRecord | null }>();
    collections.set(collection, state);
  }
  return state;
}

function asKongaResult(result: Awaited<ReturnType<typeof placeKongaProspect>>): KongaPlacementResult {
  if (!('placementId' in result) || !('placementAttemptId' in result)) {
    throw new Error('Expected Konga placement result');
  }
  return result as KongaPlacementResult;
}

function asLegacyPlaceResult(result: Awaited<ReturnType<typeof placeKongaProspect>>): {
  prospectId: string;
  positionNumber: number;
  placedAt: string;
  alreadyPlaced: boolean;
} {
  const candidate = result as {
    prospectId: string;
    positionNumber: number;
    placedAt: string;
    alreadyPlaced: boolean;
    placementId?: string;
    placementAttemptId?: string;
  };
  if (typeof candidate.prospectId !== 'string' || typeof candidate.positionNumber !== 'number') {
    throw new Error('Expected legacy place result');
  }
  return {
    prospectId: candidate.prospectId,
    positionNumber: candidate.positionNumber,
    placedAt: candidate.placedAt,
    alreadyPlaced: Boolean(candidate.alreadyPlaced),
  };
}

function createFixture(overrides: {
  initialClaims?: ClaimState[];
  initialPlacements?: JsonRecord[];
  initialProspects?: JsonRecord[];
  failPlacementNeoWriteOnce?: boolean;
  failPlacementMongoDeleteOnce?: boolean;
  failPlacementNeo4jDeleteOnce?: boolean;
  failPlacementChromaDeleteOnce?: boolean;
  failPlacementMongoDeleteForever?: boolean;
  failPlacementNeo4jDeleteForever?: boolean;
  failPlacementChromaDeleteForever?: boolean;
} = {}) {
  const calls: Array<{ tool: string; action: string; params: JsonRecord }> = [];
  const claims = new Map<string, JsonRecord>();
  const claimNeo = new Map<string, JsonRecord>();
  const claimChroma = new Map<string, { document: string; metadata: JsonRecord }>();
  const placements = new Map<string, JsonRecord>();
  const prospects = new Map<string, JsonRecord>();
  const placementNeo = new Map<string, JsonRecord>();
  const chromaCollections = new Map<
    string,
    Map<string, { document: string; metadata: JsonRecord | null }>
  >();
  const state = {
    claims,
    claimNeo,
    claimChroma,
    placements,
    prospects,
    placementNeo,
    chromaCollections,
    claimChromaCollection: chromaCollections.get(CLAIM_CHROMA_COLLECTION),
    failPlacementNeoWriteOnce: overrides.failPlacementNeoWriteOnce ? 1 : 0,
    failPlacementMongoDeleteAttempts: overrides.failPlacementMongoDeleteOnce ? 1 : 0,
    failPlacementNeo4jDeleteAttempts: overrides.failPlacementNeo4jDeleteOnce ? 1 : 0,
    failPlacementChromaDeleteAttempts: overrides.failPlacementChromaDeleteOnce ? 1 : 0,
    failPlacementMongoDeleteForever: overrides.failPlacementMongoDeleteForever ?? false,
    failPlacementNeo4jDeleteForever: overrides.failPlacementNeo4jDeleteForever ?? false,
    failPlacementChromaDeleteForever: overrides.failPlacementChromaDeleteForever ?? false,
  };

  if (overrides.initialProspects?.length) {
    for (const prospect of overrides.initialProspects) {
      prospects.set(String(prospect.prospectId), { ...prospect });
    }
  } else {
    prospects.set(input.prospectId, { ...prospectSeed });
  }

  for (const doc of overrides.initialClaims ?? []) {
    const claimEventId = doc.claimEventId ?? buildClaimEventId(doc);
    const claimRecord = { ...doc, claimEventId };
    claims.set(doc._id, claimRecord);
    claimNeo.set(claimEventId, {
      claimEventId,
      claimId: doc._id,
      prospectId: doc.prospectId,
      ownerAttempt: doc.ownerAttempt,
      fence: doc.fence,
      placementAttemptId: doc.placementAttemptId,
      placementId: doc.placementId,
      createdAt: doc.createdAt,
      heartbeatAt: doc.heartbeatAt,
      expiresAt: doc.expiresAt,
    });
    claimChroma.set(claimEventId, {
      document: `Konga placement claim ${doc.prospectId} ${doc.ownerAttempt} attempt ${doc.placementAttemptId} fence ${doc.fence}`,
      metadata: {
        kind: 'konga_placement_claim',
        claimId: doc._id,
        claimEventId,
        prospectId: doc.prospectId,
        placementAttemptId: doc.placementAttemptId,
        placementId: doc.placementId,
        ownerAttempt: doc.ownerAttempt,
        fence: doc.fence,
        expiresAt: doc.expiresAt,
        createdAt: doc.createdAt,
        heartbeatAt: doc.heartbeatAt,
      },
    });
  }

  for (const placement of overrides.initialPlacements ?? []) {
    if (placement._id && typeof placement._id === 'string') {
      placements.set(placement._id, { ...placement });
    }
  }

  chromaCollections.set(CLAIM_CHROMA_COLLECTION, chromaMapFor(chromaCollections, CLAIM_CHROMA_COLLECTION));
  chromaCollections.set(CHROMA_COLLECTION, chromaMapFor(chromaCollections, CHROMA_COLLECTION));

  function rows(collection: string, filter: JsonRecord | undefined): JsonRecord[] {
    let source: JsonRecord[];
    if (collection === CLAIM_COLLECTION) source = [...claims.values()];
    else if (collection === PLACEMENT_COLLECTION) source = [...placements.values()];
    else if (collection === PROSPECTS_COLLECTION) source = [...prospects.values()];
    else source = [];

    return source.filter((doc) => filterMatches(doc, filter));
  }

  const persistence = vi.fn(async (tool: string, action: string, params: JsonRecord) => {
    calls.push({ tool, action, params });

    if (tool === 'mongodb') {
      const collection = String(params.collection ?? '');
      if (action === 'query') {
        const docs = rows(collection, params.filter as JsonRecord | undefined);
        const limit = typeof params.limit === 'number' ? params.limit : undefined;
        const selected = typeof limit === 'number' ? docs.slice(0, limit) : docs;
        return { documents: selected, count: docs.length };
      }

      if (action === 'insert') {
        const docs = (params.documents as JsonRecord[] | undefined) ?? [];
        for (const doc of docs) {
          const id = String(doc._id);
          if (collection === CLAIM_COLLECTION && claims.has(id)) {
            throw new Error('duplicate key');
          }
          if (collection === PLACEMENT_COLLECTION && placements.has(id)) {
            throw new Error('duplicate key');
          }
          if (collection === CLAIM_COLLECTION) {
            const claimRecord = doc as unknown as ClaimState;
            const fenceValue = Number(claimRecord.fence);
            const parsedFence = Number.isFinite(fenceValue) ? Math.trunc(fenceValue) : 0;
            const claimEventId = String(
              claimRecord.claimEventId ??
                buildClaimEventId({
                  _id: String(claimRecord._id),
                  ownerAttempt: String(claimRecord.ownerAttempt),
                  fence: parsedFence,
                }),
            );
            claims.set(id, { ...claimRecord, claimEventId });
          }
          if (collection === PLACEMENT_COLLECTION) placements.set(id, { ...doc });
        }
        return { insertedCount: docs.length, insertedIds: {} };
      }

      if (action === 'update') {
        const filter = params.filter as JsonRecord | undefined;
        const update = params.update as JsonRecord | undefined;
        let matched = 0;
        if (collection === CLAIM_COLLECTION) {
          for (const doc of claims.values()) {
            if (!filterMatches(doc, filter)) continue;
            applySet(doc, update);
            matched += 1;
          }
        }
        if (collection === PLACEMENT_COLLECTION) {
          for (const doc of placements.values()) {
            if (!filterMatches(doc, filter)) continue;
            applySet(doc, update);
            matched += 1;
          }
        }
        if (collection === PROSPECTS_COLLECTION) {
          for (const doc of prospects.values()) {
            if (!filterMatches(doc, filter)) continue;
            applySet(doc, update);
            matched += 1;
          }
        }
        return { matchedCount: matched, modifiedCount: matched, upsertedCount: 0 };
      }

      if (action === 'delete') {
        const mongoFilter = params.filter as Record<string, unknown> | undefined;
        if (collection === PLACEMENT_COLLECTION && mongoFilter?.placementId !== undefined) {
          if (state.failPlacementMongoDeleteForever) {
            throw new Error('konga_placement_cleanup_delete_failed');
          }
          if (state.failPlacementMongoDeleteAttempts > 0) {
            state.failPlacementMongoDeleteAttempts -= 1;
            throw new Error('konga_placement_cleanup_delete_failed');
          }
        }
        const filter = params.filter as JsonRecord | undefined;
        let deleted = 0;
        if (collection === CLAIM_COLLECTION) {
        for (const [id, doc] of claims.entries()) {
            if (filterMatches(doc, filter)) {
              const claimRecord = doc as unknown as ClaimState;
              const claimEventId = String(
                claimRecord.claimEventId ??
                  buildClaimEventId({
                    _id: String(claimRecord._id),
                    ownerAttempt: String(claimRecord.ownerAttempt),
                    fence: Number.isFinite(Number(claimRecord.fence))
                      ? Math.trunc(Number(claimRecord.fence))
                      : 0,
                  }),
              );
              claims.delete(id);
              claimNeo.delete(claimEventId);
              claimChroma.delete(claimEventId);
              deleted += 1;
            }
          }
        }
        if (collection === PLACEMENT_COLLECTION) {
          for (const [id, doc] of placements.entries()) {
            if (filterMatches(doc, filter)) {
              placements.delete(id);
              deleted += 1;
            }
          }
        }
        return { deletedCount: deleted };
      }

      return {};
    }

    if (tool === 'neo4j') {
      const query = String(params.query ?? '');
      const qparams = (params.params as JsonRecord) ?? {};
      if (
        query.includes('DELETE r') &&
        (query.includes('IN_HOLDING_TANK') || query.includes('IN_HOLDING_TANK {'))
      ) {
        if (state.failPlacementNeo4jDeleteForever) {
          throw new Error('konga_placement_cleanup_delete_failed');
        }
        if (state.failPlacementNeo4jDeleteAttempts > 0) {
          state.failPlacementNeo4jDeleteAttempts -= 1;
          throw new Error('konga_placement_cleanup_delete_failed');
        }
      }

      if (query.includes('TmagKongaPlacementClaim')) {
        const claimRecordId = String((qparams.claimEventId ?? qparams.id ?? qparams.claimId) ?? '');
        const ownerAttemptParam = qparams.ownerAttempt;
        const fenceParam = qparams.fence;

        if (query.includes('MERGE (c:TmagKongaPlacementClaim')) {
          const properties = (qparams.properties as JsonRecord) ?? {};
          claimNeo.set(claimRecordId, {
            claimEventId: claimRecordId,
            claimId: properties.claimId ?? claimRecordId,
            ...properties,
          });
          return { records: [{ n: 1 }], summary: { counters: {} } };
        }

        if (query.includes('count(c) AS n')) {
          const row = claimNeo.get(claimRecordId);
          const match =
            !!row &&
            row.claimEventId === claimRecordId &&
            row.prospectId === qparams.prospectId &&
            (ownerAttemptParam === undefined || row.ownerAttempt === ownerAttemptParam) &&
            (fenceParam === undefined || row.fence === fenceParam);
          const ownerAttempt = row?.ownerAttempt;
          const fence = row?.fence;
          return {
            records: [{
              n: match ? 1 : 0,
              ...(ownerAttempt !== undefined ? { ownerAttempt } : {}),
              ...(fence !== undefined ? { fence } : {}),
            }],
            summary: { counters: {} },
          };
        }

        if (query.includes('DETACH DELETE c')) {
          for (const [id, row] of claimNeo.entries()) {
            if (id !== claimRecordId) continue;
            if (ownerAttemptParam !== undefined && row.ownerAttempt !== ownerAttemptParam) {
              continue;
            }
            if (fenceParam !== undefined && row.fence !== fenceParam) {
              continue;
            }
            claimNeo.delete(id);
            claimChroma.delete(id);
          }
          return { records: [], summary: { counters: {} } };
        }
      }

      if (query.includes('IN_HOLDING_TANK')) {
        if (query.includes('MERGE (p)-[r:IN_HOLDING_TANK')) {
          const placementId = String((qparams.id ?? qparams.placementId) ?? '');
          const poolId = String(qparams.poolId ?? TEAM_POOL_ID);
          placementNeo.set(placementEdgeKey(poolId, placementId), {
            poolId,
            placementId,
            prospectId: String(qparams.prospectId ?? ''),
            relationshipProps: (qparams.relationshipProps as JsonRecord) ?? {},
          });
          return { records: [{ n: 1 }], summary: { counters: {} } };
        }

        if (query.includes('count(r) AS n')) {
          const placementId = String((qparams.id ?? qparams.placementId) ?? '');
          const prospectId = qparams.prospectId;
          const poolId = String(qparams.poolId ?? TEAM_POOL_ID);
          const ownerAttemptParam = qparams.ownerAttempt;
          const fenceParam = qparams.fence;
          const placementAttemptIdParam = qparams.placementAttemptId;
          let count = 0;
          const hasLegacyMatch =
            query.includes('WHERE r.position = $positionNumber') ||
            query.includes('WHERE r.sponsorTmagId = $sponsorTmagId') ||
            query.includes('WHERE r.placedAt = $placedAt');
          for (const edge of placementNeo.values()) {
            if (edge.poolId !== poolId) continue;
            if (!hasLegacyMatch && placementId && edge.placementId !== placementId) continue;
            if (prospectId !== undefined && edge.prospectId !== prospectId) continue;
            const props = edge.relationshipProps as JsonRecord | undefined;
            if (placementAttemptIdParam !== undefined && props?.placementAttemptId !== placementAttemptIdParam) {
              continue;
            }
            if (ownerAttemptParam !== undefined && props?.ownerAttempt !== ownerAttemptParam) {
              continue;
            }
            if (fenceParam !== undefined && props?.fence !== fenceParam) {
              continue;
            }
            if (hasLegacyMatch) {
              if (qparams.positionNumber !== undefined && props?.position !== qparams.positionNumber) continue;
              if (qparams.sponsorTmagId !== undefined && props?.sponsorTmagId !== qparams.sponsorTmagId) continue;
              if (qparams.placedAt !== undefined && props?.placedAt !== qparams.placedAt) continue;
            }
            count += 1;
          }
          return { records: [{ n: count }], summary: { counters: {} } };
        }

        if (query.includes('DELETE r')) {
          const poolId = String(qparams.poolId ?? TEAM_POOL_ID);
          const placementId = String((qparams.id ?? qparams.placementId) ?? '');
          const ownerAttemptParam = qparams.ownerAttempt;
          const fenceParam = qparams.fence;
          const entries = [...placementNeo.entries()];
          for (const [edgeKey, edge] of entries) {
            const [, edgePlacementId] = edgeKey.split('|');
            if (edge.poolId !== poolId) {
              continue;
            }
            if (placementId && edgePlacementId !== placementId) {
              continue;
            }
            const relationshipProps = edge.relationshipProps as JsonRecord | undefined;
            if (ownerAttemptParam !== undefined && relationshipProps?.ownerAttempt !== ownerAttemptParam) {
              continue;
            }
            if (fenceParam !== undefined && relationshipProps?.fence !== fenceParam) {
              continue;
            }
            placementNeo.delete(edgeKey);
          }
          return { records: [], summary: { counters: {} } };
        }
      }

      return { records: [], summary: { counters: {} } };
    }

      if (tool === 'chromadb') {
        const collection = String(params.collection ?? '');
        const col = chromaMapFor(chromaCollections, collection);

        if (action === 'list_collections') {
          return {
            collections: [...chromaCollections.entries()].map(([name]) => ({ name })),
          };
        }

      if (action === 'add') {
        const ids = (params.ids as string[]) ?? [];
        const documents = (params.documents as string[]) ?? [];
        const metadatas = (params.metadatas as Array<JsonRecord>) ?? [];
        ids.forEach((id, index) => {
          col.set(id, {
            document: documents[index] ?? '',
            metadata: metadatas[index] ?? null,
          });
        });
        return { ok: true, count: ids.length };
      }

      if (action === 'get') {
        const ids = (params.ids as string[]) ?? [];
        const found = ids.filter((id) => col.has(id));
        return {
          ids: found,
          metadatas: found.map((id) => col.get(id)?.metadata ?? null),
          documents: found.map((id) => col.get(id)?.document ?? ''),
        };
      }

      if (action === 'delete') {
        if (collection === CHROMA_COLLECTION) {
          if (state.failPlacementChromaDeleteForever) {
            throw new Error('konga_placement_cleanup_delete_failed');
          }
          if (state.failPlacementChromaDeleteAttempts > 0) {
            state.failPlacementChromaDeleteAttempts -= 1;
            throw new Error('konga_placement_cleanup_delete_failed');
          }
        }
        const ids = (params.ids as string[]) ?? [];
        ids.forEach((id) => col.delete(id));
        return { ok: true };
      }

      return {};
    }

    return {};
  });

  dispatch.persistenceCall.mockImplementation(persistence);

  async function strictVerify(input: {
    id: string;
    mongoCollection: string;
    neo4jVerify: { cypher: string; params?: JsonRecord };
    chromaCollection: string;
    chromaId?: string;
    mongoDatabase?: string;
  }): Promise<KongaReadback> {
    const chromaId = input.chromaId ?? input.id;
    const [mongoResult, neo4jResult, chromaResult] = await Promise.all([
      persistence('mongodb', 'query', {
        database: input.mongoDatabase ?? 'momentum',
        collection: input.mongoCollection,
        filter: { _id: input.id },
        limit: 1,
      }),
      persistence('neo4j', 'cypher', {
        query: input.neo4jVerify.cypher,
        params: { id: input.id, ...(input.neo4jVerify.params ?? {}) },
      }),
      persistence('chromadb', 'get', {
        collection: input.chromaCollection,
        ids: [chromaId],
      }),
    ]);

    const mongo = mongoResult.documents?.[0] as Record<string, unknown> | undefined;
    if (!mongo) throw new Error(`konga_mongo_readback_missing:${input.id}`);
    const neo4jCount = Number((neo4jResult.records?.[0] as JsonRecord)?.n ?? 0);
    if (neo4jCount !== 1) throw new Error(`konga_neo4j_readback_not_exact:${input.id}:${neo4jCount}`);
    if (!((chromaResult.ids ?? []).includes(chromaId))) {
      throw new Error(`konga_chroma_readback_missing:${chromaId}`);
    }

    return { mongo, neo4jCount, chromaId };
  }

  function strictWriteBuilder(payload: KongaStrictWriteInput): KongaStrictWrite {
    const defaults = payload;

    return vi.fn(async (input: KongaStrictWriteInput) => {
      const request = input ?? defaults;
      const writeId = request.id;
      const chroma = request.chroma as
        | ({ collection: string; document: string; metadata?: Record<string, unknown>; id?: string })
        | undefined;
      const { mongoCollection, neo4j, neo4jVerify, mongoDoc } = request;
      const chromaId = request.chromaId ?? chroma?.id ?? writeId;

      await persistence('mongodb', 'insert', {
        database: 'momentum',
        collection: mongoCollection,
        documents: [{ _id: writeId, ...mongoDoc }],
      });

        if (neo4j) {
          if (state.failPlacementNeoWriteOnce > 0 && mongoCollection === PLACEMENT_COLLECTION) {
            state.failPlacementNeoWriteOnce -= 1;
            throw new Error('konga_placement_neo4j_write_failed');
          }
        await persistence('neo4j', 'cypher', {
          query: neo4j.cypher,
          params: { id: writeId, ...(neo4j.params ?? {}) },
        });
          if (neo4j.cypher.includes('IN_HOLDING_TANK')) {
            const qparams = (neo4j.params ?? {}) as JsonRecord;
            const relationshipProps = (qparams.relationshipProps as JsonRecord) ?? {};
            const placementId = String(qparams.id ?? writeId);
            const prospectId = String(qparams.prospectId ?? '');
            const poolId = String(qparams.poolId ?? TEAM_POOL_ID);
            placementNeo.set(placementEdgeKey(poolId, placementId), {
              poolId,
              placementId,
              prospectId,
              relationshipProps: {
                placementAttemptId: String(
                  qparams.placementAttemptId ??
                    qparams.placementAttempt ??
                    qparams.placementAttemptId__maybe ??
                    '',
                ),
                position: qparams.position ?? qparams.positionNumber ?? relationshipProps.position ?? 0,
                placedAt:
                  qparams.placedAt ?? qparams.placedAtIso ?? relationshipProps.placedAt ?? '',
                sponsorTmagId: qparams.sponsorTmagId ?? qparams.tmag ?? '',
                addedByFirstName: qparams.addedByFirstName ?? qparams.addedByFirstInitial ?? '',
                addedByLastInitial:
                  qparams.addedByLastInitial ?? qparams.addedByLastInitialLetter ?? '',
                ...(relationshipProps.ownerAttempt !== undefined
                  ? { ownerAttempt: relationshipProps.ownerAttempt }
                  : {}),
                ...(relationshipProps.fence !== undefined ? { fence: relationshipProps.fence } : {}),
              },
            });
          }
        }

      if (chroma) {
        await persistence('chromadb', 'add', {
          collection: chroma.collection,
          ids: [chromaId],
          documents: [chroma.document],
          metadatas: [chroma.metadata ?? {}],
        });
      }

      return strictVerify({
        id: writeId,
        mongoCollection,
        neo4jVerify,
        chromaCollection: chroma?.collection ?? CHROMA_COLLECTION,
        chromaId,
      });
    }) as unknown as KongaStrictWrite;
  }

  return {
    calls,
    state,
    persistence,
    strictWrite: strictWriteBuilder,
    strictVerify: strictVerify as unknown as KongaStrictVerify,
  };
}

describe('Konga placement permanence', () => {
  it('derives stable attempt identity without exposing the invitation id', () => {
    const a = deriveKongaPlacementIdentity(input);
    const b = deriveKongaPlacementIdentity(input);
    expect(a).toEqual(b);
    expect(JSON.stringify(a)).not.toContain(input.invitationRecordId);
  });

  it('persists minimized addedBy and publishes only after governed readback', async () => {
    const fixture = createFixture();
    const strictWrite = fixture.strictWrite({
      id: 'test-placement-success',
      mongoCollection: PLACEMENT_COLLECTION,
      mongoDoc: {},
      neo4j: { cypher: PLACEMENT_NEO4J_WRITE },
      chroma: {
        collection: CHROMA_COLLECTION,
        document: 'placement',
      },
      neo4jVerify: {
        cypher: 'MATCH (:TmagProspect)-[r:IN_HOLDING_TANK {placementId:$id}]->(:TmagPool {id:$poolId}) RETURN count(r) AS n',
      },
    });
    const publish = vi.fn();

    const result = await placeKongaProspect(
      input,
      {
        persistence: fixture.persistence as never,
        strictWrite,
        strictVerify: fixture.strictVerify as never,
        increment: vi.fn(async () => 41),
        findBa: vi.fn(async () => ({
          tmagId: input.sponsorTmagId,
          firstName: 'Jordan',
          lastName: 'Rivera',
        })) as never,
        publish,
      },
    );

    const writePayload = fixture.calls.find(
      (call) =>
        call.tool === 'mongodb' &&
        call.action === 'insert' &&
        call.params.collection === PLACEMENT_COLLECTION,
    ) as
      | {
          params: { documents?: JsonRecord[] };
          tool: string;
          action: string;
        }
      | undefined;
    expect(result.positionNumber).toBe(41);
    expect(writePayload?.params.documents?.[0]).toMatchObject({
      addedBy: { firstName: 'Jordan', lastInitial: 'R' },
    });
    expect(publish).toHaveBeenCalledTimes(1);
  });

  it('emits no SSE when a required persistence leg cannot read back', async () => {
    const fixture = createFixture();
    const publish = vi.fn();
    await expect(
      placeKongaProspect(input, {
        persistence: fixture.persistence as never,
        strictWrite: vi.fn(async () => {
          throw new Error('konga_chroma_readback_missing');
        }) as never,
        publish,
        increment: vi.fn(async () => 42),
        findBa: vi.fn(async () => ({ firstName: 'Jordan', lastName: 'Rivera' })) as never,
      }),
    ).rejects.toThrow('konga_chroma_readback_missing');
    expect(publish).not.toHaveBeenCalled();
  });

  it('prevents concurrent distinct attempts from both becoming live', async () => {
    const fixture = createFixture();
    const strictWrite = fixture.strictWrite({
      id: 'placement-distinct',
      mongoCollection: PLACEMENT_COLLECTION,
      mongoDoc: {},
      neo4j: { cypher: PLACEMENT_NEO4J_WRITE },
      chroma: {
        collection: CHROMA_COLLECTION,
        document: 'placement',
      },
      neo4jVerify: {
        cypher: 'MATCH (:TmagProspect)-[r:IN_HOLDING_TANK {placementId:$id}]->(:TmagPool {id:$poolId}) RETURN count(r) AS n',
      },
    });

    const [first, second] = await Promise.allSettled([
      placeKongaProspect(
        { ...input, invitationRecordId: 'attempt-a' },
        {
          persistence: fixture.persistence as never,
          strictWrite,
          strictVerify: fixture.strictVerify as never,
          increment: vi.fn(async () => 41),
          findBa: vi.fn(async () => ({ firstName: 'Jordan', lastName: 'Rivera' })) as never,
        },
      ),
      placeKongaProspect(
        { ...input, invitationRecordId: 'attempt-b' },
        {
          persistence: fixture.persistence as never,
          strictWrite,
          strictVerify: fixture.strictVerify as never,
          increment: vi.fn(async () => 42),
          findBa: vi.fn(async () => ({ firstName: 'Jordan', lastName: 'Rivera' })) as never,
        },
      ),
    ]);

    expect(first.status === 'fulfilled' || second.status === 'fulfilled').toBe(true);
    expect(first.status === 'rejected' || second.status === 'rejected').toBe(true);
    const rejected =
      first.status === 'rejected'
        ? first.reason
        : second.status === 'rejected'
          ? second.reason
          : undefined;
    expect(String(rejected)).toContain('konga_placement_claim_conflict:prospect-1');
  });

  it('treats the same invitation attempt as idempotent', async () => {
    const ids = deriveKongaPlacementIdentity(input);
    const fixture = createFixture({
      initialPlacements: [
        {
          _id: ids.placementId,
          placementId: ids.placementId,
          placementAttemptId: ids.placementAttemptId,
          prospectId: input.prospectId,
          sponsorTmagId: input.sponsorTmagId,
          positionNumber: 88,
          placedAt: input.now.toISOString(),
          expiresAt: input.prospectExpiresAt,
          flushedAt: null,
          flushReason: null,
          addedBy: { firstName: 'Jordan', lastInitial: 'R' },
        },
      ],
    });
    const chromaCollection = fixture.state.chromaCollections.get(CHROMA_COLLECTION)!;
    const placementEdge = placementEdgeKey(TEAM_POOL_ID, ids.placementId);
    fixture.state.placementNeo.set(placementEdge, {
      poolId: TEAM_POOL_ID,
      placementId: ids.placementId,
      prospectId: input.prospectId,
      relationshipProps: {
        position: 88,
      },
    });
    chromaCollection.set(ids.placementId, {
      document: 'legacy-backed placement',
      metadata: {
        kind: 'konga_placement',
        placementId: ids.placementId,
        placementAttemptId: ids.placementAttemptId,
        prospectId: input.prospectId,
        sponsorTmagId: input.sponsorTmagId,
        positionNumber: 88,
        placedAt: input.now.toISOString(),
      },
    });

    const result = await placeKongaProspect(input, {
      persistence: fixture.persistence as never,
      strictVerify: fixture.strictVerify as never,
      increment: vi.fn(),
      publish: vi.fn(),
    });
    const kongaResult = asKongaResult(result);

    expect(kongaResult.alreadyPlaced).toBe(true);
    expect(kongaResult.positionNumber).toBe(88);
    expect(kongaResult.placementId).toBe(ids.placementId);
    expect(
      fixture.calls.find((call) => call.tool === 'mongodb' && call.action === 'update' && call.params.collection === PLACEMENT_COLLECTION),
    ).toBeUndefined();
  });

  it('derives raw-token-backed legacy identity from prospect/sponsor/createdAt fields', () => {
    const tokenRecord = {
      token: 'TOKEN-LEGACY-RAW',
      prospectId: input.prospectId,
      sponsorTmagId: input.sponsorTmagId,
      state: 'video_complete',
      createdAt: '2026-07-10T00:00:00.000Z',
      _id: 'TOKEN-LEGACY-RAW',
    } as const;

    const invitationRecordId = resolveInvitationRecordId(tokenRecord);
    expect(invitationRecordId).toBe(
      `legacy_invitation_${input.prospectId}|${input.sponsorTmagId}|${tokenRecord.createdAt}`,
    );
    expect(invitationRecordId).not.toContain(tokenRecord.token);
  });

  it('fails closed when raw-token-backed legacy identity cannot be proven', () => {
    const tokenRecord = {
      token: 'TOKEN-LEGACY-RAW',
      prospectId: input.prospectId,
      sponsorTmagId: input.sponsorTmagId,
      state: 'video_complete',
      createdAt: undefined as unknown as string,
      _id: 'TOKEN-LEGACY-RAW',
    } as const;

    expect(resolveInvitationRecordId(tokenRecord)).toBeNull();
  });

  it('derives legacy invitation identity from a non-secret database id', () => {
    const tokenRecord = {
      token: 'TOKEN-RAW-UNSAFE',
      prospectId: input.prospectId,
      sponsorTmagId: input.sponsorTmagId,
      state: 'clicked',
      createdAt: '2026-07-10T00:00:00.000Z',
      _id: 'legacy-token-doc-id',
    } as const;

    const invitationRecordId = resolveInvitationRecordId(tokenRecord);
    const identity = deriveKongaPlacementIdentity({
      prospectId: tokenRecord.prospectId,
      invitationRecordId: invitationRecordId!,
    });

    expect(invitationRecordId).toBe('legacy_invitation_legacy-token-doc-id');
    expect(JSON.stringify(identity)).not.toContain(tokenRecord.token);
  });

  it('retains flushed attempt history when a fresh invitation is placed', async () => {
    const priorIdentity = deriveKongaPlacementIdentity({
      prospectId: input.prospectId,
      invitationRecordId: 'prior-attempt',
    });
    const priorPlacement = {
      _id: priorIdentity.placementId,
      ...priorIdentity,
      prospectId: input.prospectId,
      sponsorTmagId: input.sponsorTmagId,
      positionNumber: 101,
      placedAt: '2026-07-10T00:00:00.000Z',
      expiresAt: input.prospectExpiresAt,
      flushedAt: '2026-07-11T00:00:00.000Z',
      flushReason: 'enrolled',
      addedBy: { firstName: 'Jordan', lastInitial: 'R' },
    };
    const fixture = createFixture({ initialPlacements: [priorPlacement] });
    const freshInput = { ...input, invitationRecordId: 'fresh-attempt' };
    const freshIdentity = deriveKongaPlacementIdentity(freshInput);
    const strictWrite = fixture.strictWrite({
      id: freshIdentity.placementId,
      mongoCollection: PLACEMENT_COLLECTION,
      mongoDoc: {},
      neo4j: { cypher: PLACEMENT_NEO4J_WRITE },
      chroma: { collection: CHROMA_COLLECTION, document: 'placement' },
      neo4jVerify: {
        cypher:
          'MATCH (:TmagProspect)-[r:IN_HOLDING_TANK {placementId:$id}]->(:TmagPool {id:$poolId}) RETURN count(r) AS n',
      },
    });

    const result = asKongaResult(await placeKongaProspect(freshInput, {
      persistence: fixture.persistence as never,
      strictWrite,
      strictVerify: fixture.strictVerify as never,
      increment: vi.fn(async () => 200),
      findBa: vi.fn(async () => ({ firstName: 'Jordan', lastName: 'Rivera' })) as never,
      publish: vi.fn(),
    }));

    expect(result.placementId).toBe(freshIdentity.placementId);
    expect(result.placementAttemptId).not.toBe(priorIdentity.placementAttemptId);
    expect(fixture.state.placements.size).toBe(2);
    expect(fixture.state.placements.get(priorIdentity.placementId)).toMatchObject({
      placementId: priorIdentity.placementId,
      flushedAt: priorPlacement.flushedAt,
      flushReason: priorPlacement.flushReason,
    });
    expect(fixture.state.placements.get(freshIdentity.placementId)).toMatchObject({
      placementId: freshIdentity.placementId,
      flushedAt: null,
      flushReason: null,
    });
  });

  it('does not return a same-attempt row owned by a claim owner before a completion marker exists', async () => {
    const sharedInput = { ...input, invitationRecordId: 'owned-attempt-race' };
    const sharedIdentity = deriveKongaPlacementIdentity(sharedInput);
    const fixture = createFixture();
    const strictWrite = fixture.strictWrite({
      id: sharedIdentity.placementId,
      mongoCollection: PLACEMENT_COLLECTION,
      mongoDoc: {},
      neo4j: { cypher: PLACEMENT_NEO4J_WRITE },
      chroma: {
        collection: CHROMA_COLLECTION,
        document: 'placement',
      },
      neo4jVerify: {
        cypher:
          'MATCH (:TmagProspect)-[r:IN_HOLDING_TANK {placementId:$id}]->(:TmagPool {id:$poolId}) RETURN count(r) AS n',
      },
    });
    const written = createBarrier();
    const allowSecond = createBarrier();

    const firstWriter = vi.fn(async (payload) => {
      await strictWrite(payload as never);
      written.release();
      await allowSecond.wait();
      throw new Error('owned-race-a-after-write');
    }) as never;

    const firstCall = placeKongaProspect(
      sharedInput,
      {
        persistence: fixture.persistence as never,
        strictWrite: firstWriter,
        strictVerify: fixture.strictVerify as never,
        increment: vi.fn(async () => 301),
        findBa: vi.fn(async () => ({ firstName: 'Jordan', lastName: 'Rivera' })) as never,
      },
    );
    await written.wait();

    await fixture.persistence('mongodb', 'delete', {
      database: MONGO_DB,
      collection: CLAIM_COLLECTION,
      filter: { _id: claimId(sharedInput.prospectId) },
    });

    const secondCall = placeKongaProspect(
      sharedInput,
      {
        persistence: fixture.persistence as never,
        strictVerify: fixture.strictVerify as never,
        increment: vi.fn(async () => 302),
        findBa: vi.fn(async () => ({ firstName: 'Jordan', lastName: 'Rivera' })) as never,
        claimAcquireMaxAttempts: 4,
      },
    );

    allowSecond.release();
    const [firstResult, secondResult] = await Promise.allSettled([firstCall, secondCall]);

    expect(firstResult.status).toBe('rejected');
    expect(secondResult.status).toBe('fulfilled');
    const secondKongaResult = asKongaResult(
      (secondResult as PromiseFulfilledResult<Awaited<ReturnType<typeof placeKongaProspect>>>).value,
    );

    expect(secondKongaResult.alreadyPlaced).toBe(false);
    expect(secondKongaResult.positionNumber).toBe(302);
    expect(fixture.state.claims.has(claimId(sharedInput.prospectId))).toBe(false);
    expect(fixture.state.placements.has(sharedIdentity.placementId)).toBe(true);
  });

  it('returns legacy rows with no placement identifiers only after readback verification', async () => {
    const legacyPlacementId = 'legacy-row-without-ids';
    const fixture = createFixture({
      initialPlacements: [
        {
          _id: legacyPlacementId,
          prospectId: input.prospectId,
          sponsorTmagId: input.sponsorTmagId,
          positionNumber: 88,
          placedAt: input.now.toISOString(),
          expiresAt: input.prospectExpiresAt,
          flushedAt: null,
          flushReason: null,
        },
      ],
    });
    const chromaCollection = fixture.state.chromaCollections.get(CHROMA_COLLECTION)!;
    const placementEdge = placementEdgeKey(TEAM_POOL_ID, legacyPlacementId);
    fixture.state.placementNeo.set(placementEdge, {
      poolId: TEAM_POOL_ID,
      placementId: legacyPlacementId,
      prospectId: input.prospectId,
      relationshipProps: {
        position: 88,
        sponsorTmagId: input.sponsorTmagId,
        placedAt: input.now.toISOString(),
        ownerAttempt: 'legacy-owner',
        fence: 1,
      },
    });
    chromaCollection.set(legacyPlacementId, {
      document: 'legacy-backed placement',
      metadata: {
        kind: 'konga_placement',
        placementId: legacyPlacementId,
        prospectId: input.prospectId,
        sponsorTmagId: input.sponsorTmagId,
        positionNumber: 88,
        placedAt: input.now.toISOString(),
        ownerAttempt: 'legacy-owner',
        fence: 1,
      },
    });

    const result = await placeKongaProspect(input, {
      persistence: fixture.persistence as never,
      strictVerify: fixture.strictVerify as never,
      increment: vi.fn(),
      publish: vi.fn(),
    });
    const kongaResult = asLegacyPlaceResult(result);
    const persistedLegacyPlacement = fixture.state.placements.get(legacyPlacementId);

    expect(kongaResult.alreadyPlaced).toBe(true);
    expect(kongaResult.positionNumber).toBe(88);
    expect(kongaResult.prospectId).toBe(input.prospectId);
    expect(persistedLegacyPlacement?.placementId).toBeUndefined();
    expect(persistedLegacyPlacement?.placementAttemptId).toBeUndefined();
    expect(persistedLegacyPlacement?.ownerAttempt).toBeUndefined();
    expect(persistedLegacyPlacement?.fence).toBeUndefined();
    expect(persistedLegacyPlacement?.projectionEventId).toBeUndefined();
    expect(
      fixture.calls.find((call) => call.tool === 'mongodb' && call.action === 'update' && call.params.collection === PLACEMENT_COLLECTION),
    ).toBeUndefined();
  });

  it('fails closed when a legacy live row cannot be exactly read back', async () => {
    const legacyPlacementId = 'legacy-row-without-ids-bad-proof';
    const fixture = createFixture({
      initialPlacements: [
        {
          _id: legacyPlacementId,
          prospectId: input.prospectId,
          sponsorTmagId: input.sponsorTmagId,
          positionNumber: 88,
          placedAt: input.now.toISOString(),
          expiresAt: input.prospectExpiresAt,
          flushedAt: null,
          flushReason: null,
        },
      ],
    });
    fixture.state.placementNeo.set(placementEdgeKey(TEAM_POOL_ID, legacyPlacementId), {
      poolId: TEAM_POOL_ID,
      placementId: legacyPlacementId,
      prospectId: input.prospectId,
      relationshipProps: {
        position: 88,
        sponsorTmagId: 'OTHER',
        placedAt: input.now.toISOString(),
        ownerAttempt: 'legacy-owner',
        fence: 1,
      },
    });
    const chromaCollection = fixture.state.chromaCollections.get(CHROMA_COLLECTION)!;
    chromaCollection.set(legacyPlacementId, {
      document: 'legacy-backed placement mismatch',
      metadata: {
        kind: 'konga_placement',
        placementId: legacyPlacementId,
        prospectId: input.prospectId,
        sponsorTmagId: input.sponsorTmagId,
        positionNumber: 88,
        placedAt: input.now.toISOString(),
        ownerAttempt: 'legacy-owner',
        fence: 1,
      },
    });

    await expect(
      placeKongaProspect(input, {
        persistence: fixture.persistence as never,
        strictVerify: fixture.strictVerify as never,
        increment: vi.fn(),
        publish: vi.fn(),
      }),
    ).rejects.toThrow('konga_live_placement_verification_failed');
  });

  it('blocks a fresh attempt while another live placement is present', async () => {
    const fixture = createFixture({
      initialPlacements: [
        {
          _id: 'other-placement',
          prospectId: input.prospectId,
          placementAttemptId: 'other-attempt',
          placementId: 'other-placement',
          sponsorTmagId: input.sponsorTmagId,
          positionNumber: 11,
          placedAt: input.now.toISOString(),
          expiresAt: input.prospectExpiresAt,
          flushedAt: null,
          flushReason: null,
        },
      ],
    });

    const increment = vi.fn();
    await expect(
      placeKongaProspect(input, {
        persistence: fixture.persistence as never,
        increment: increment as never,
      }),
    ).rejects.toThrow('konga_live_placement_exists');
    expect(increment).not.toHaveBeenCalled();
  });
  it('allows a fresh invitation after flush and returns newer position identity', async () => {
    let next = 100;
    const makeAttempt = async (invitationRecordId: string) =>
      (() => {
        const fixture = createFixture();
        const strictWrite = fixture.strictWrite({
            id: 'fresh-attempt-placeholder',
            mongoCollection: PLACEMENT_COLLECTION,
            mongoDoc: {},
            neo4j: { cypher: PLACEMENT_NEO4J_WRITE },
            chroma: {
              collection: CHROMA_COLLECTION,
              document: 'placement',
            },
            neo4jVerify: {
              cypher:
                'MATCH (:TmagProspect)-[r:IN_HOLDING_TANK {placementId:$id}]->(:TmagPool {id:$poolId}) RETURN count(r) AS n',
            },
          });
        return placeKongaProspect(
          { ...input, invitationRecordId },
          {
            persistence: fixture.persistence as never,
            strictWrite,
            strictVerify: fixture.strictVerify as never,
            increment: vi.fn(async () => ++next),
            findBa: vi.fn(async () => ({ firstName: 'Jordan', lastName: 'Rivera' })) as never,
            publish: vi.fn(),
          },
        );
      })();

    const prior = asKongaResult(await makeAttempt('prior-invitation-flushed'));
    const fresh = asKongaResult(await makeAttempt('fresh-invitation'));

    expect(fresh.placementAttemptId).not.toBe(prior.placementAttemptId);
    expect(fresh.placementId).not.toBe(prior.placementId);
    expect(fresh.positionNumber).toBeGreaterThan(prior.positionNumber);
  });

  it('reclaims expired claims and prevents stale owner mutation of stale lease attempts', async () => {
    const now = new Date('2026-07-17T20:00:00.000Z');
    const stale: ClaimState = {
      _id: claimId(input.prospectId),
      prospectId: input.prospectId,
      placementAttemptId: 'stale-attempt',
      placementId: 'stale-placement',
      ownerAttempt: 'stale-owner',
      fence: 1,
      createdAt: new Date(now.getTime() - 120_000).toISOString(),
      heartbeatAt: new Date(now.getTime() - 120_000).toISOString(),
      expiresAt: new Date(now.getTime() - 60_000).toISOString(),
    };
    const fixture = createFixture({ initialClaims: [stale] });

    const strictWrite = fixture.strictWrite({
      id: 'stale-placement-result',
      mongoCollection: PLACEMENT_COLLECTION,
      mongoDoc: {},
      neo4j: { cypher: 'MERGE' },
      chroma: {
        collection: CHROMA_COLLECTION,
        document: 'placement',
      },
      neo4jVerify: {
        cypher:
          'MATCH (:TmagProspect)-[r:IN_HOLDING_TANK {placementId:$id}]->(:TmagPool {id:$poolId}) RETURN count(r) AS n',
      },
    });

    const result = await placeKongaProspect(input, {
      persistence: fixture.persistence as never,
      strictWrite,
      strictVerify: fixture.strictVerify as never,
      clock: () => now,
      increment: vi.fn(async () => 77),
      findBa: vi.fn(async () => ({ firstName: 'Jordan', lastName: 'Rivera' })) as never,
    });

    const kongaResult = asKongaResult(result);
    expect(kongaResult.positionNumber).toBe(77);
    expect(fixture.state.claims.size).toBe(0);

    const staleWrite = await fixture.persistence('mongodb', 'update', {
      database: 'momentum',
      collection: CLAIM_COLLECTION,
      filter: {
        _id: claimId(input.prospectId),
        ownerAttempt: 'stale-owner',
        fence: 1,
      },
      update: { $set: { ownerAttempt: 'no-op' } },
    });
    expect(staleWrite.matchedCount).toBe(0);
  });

  it('serializes concurrent same-attempt calls so only one writer persists', async () => {
    const fixture = createFixture();
    const blockWrite = createBarrier();
    const writerReady = createBarrier();

    const strictWrite = vi.fn(async (payload: {
      id: string;
      mongoCollection: string;
      mongoDoc: JsonRecord;
      neo4j?: { cypher: string; params?: JsonRecord };
      chroma?: { collection: string; document: string; metadata?: JsonRecord };
      neo4jVerify: { cypher: string; params?: JsonRecord };
      }) => {
      writerReady.release();
      await blockWrite.wait();
      await fixture.persistence('mongodb', 'insert', {
        database: 'momentum',
        collection: payload.mongoCollection,
        documents: [{ _id: payload.id, ...payload.mongoDoc }],
      });
      if (payload.neo4j) {
        await fixture.persistence('neo4j', 'cypher', {
          query: payload.neo4j.cypher,
          params: { id: payload.id, ...(payload.neo4j.params ?? {}) },
        });
      }
      if (payload.chroma) {
        await fixture.persistence('chromadb', 'add', {
          collection: payload.chroma.collection,
          ids: [payload.id],
          documents: [payload.chroma.document],
          metadatas: [payload.chroma.metadata ?? {}],
        });
      }
      return fixture.strictVerify({
        id: payload.id,
        mongoCollection: payload.mongoCollection,
        neo4jVerify: payload.neo4jVerify,
        chromaCollection: payload.chroma?.collection ?? CHROMA_COLLECTION,
      });
    }) as unknown as KongaStrictWrite;

    const publish = vi.fn();
    const sharedInput = { ...input, invitationRecordId: 'shared-attempt' };
    const winner = placeKongaProspect(sharedInput, {
      persistence: fixture.persistence as never,
      strictWrite,
      strictVerify: fixture.strictVerify as never,
      increment: vi.fn(async () => 51),
      findBa: vi.fn(async () => ({ firstName: 'Jordan', lastName: 'Rivera' })) as never,
      publish,
    });

    await writerReady.wait();

    const follower = placeKongaProspect(sharedInput, {
      persistence: fixture.persistence as never,
      strictWrite,
      strictVerify: fixture.strictVerify as never,
      claimAcquireYield: (_ms?: number) => blockWrite.wait(),
      claimAcquireMaxAttempts: 40,
      increment: vi.fn(async () => 52),
      findBa: vi.fn(async () => ({ firstName: 'Jordan', lastName: 'Rivera' })) as never,
      publish,
    });

    blockWrite.release(100);
    const results = await Promise.allSettled([winner, follower]);
    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');
    expect(fulfilled.length).toBeGreaterThanOrEqual(1);
    expect(rejected.length).toBeLessThanOrEqual(1);

    const winnerResult = fulfilled[0]?.status === 'fulfilled' ? asKongaResult(fulfilled[0].value) : undefined;
    const maybeFollower = fulfilled.find((entry, index) => index === 1 && entry.status === 'fulfilled') as
      | PromiseFulfilledResult<ReturnType<typeof asKongaResult>>
      | undefined;

    if (winnerResult) {
      expect(winnerResult.alreadyPlaced).toBe(false);
      if (fulfilled.length === 2 && maybeFollower?.value) {
        const followerResult = asKongaResult(maybeFollower.value);
        expect(followerResult.alreadyPlaced).toBe(true);
        expect(winnerResult.placementId).toBe(followerResult.placementId);
      }
    }

    if (rejected.length === 1) {
      const reason = String(rejected[0]!.reason);
      expect(
        reason.includes('konga_live_placement_exists') ||
          reason.includes('konga_placement_claim_conflict'),
      ).toBe(true);
    }

    expect(strictWrite).toHaveBeenCalledTimes(1);
    expect(publish).toHaveBeenCalledTimes(1);
    expect(fixture.state.claims.size).toBe(0);
    expect(fixture.state.claimNeo.size).toBe(0);
    expect(fixture.state.claimChroma.size).toBe(0);
  });

  it('repairs partial mongo placement write through same-attempt retry across Mongo/Neo/Chroma', async () => {
    const fixture = createFixture({ failPlacementNeoWriteOnce: true });
    const publish = vi.fn();
    const strictWrite = fixture.strictWrite({
      id: 'konga-placement-partial',
      mongoCollection: PLACEMENT_COLLECTION,
      mongoDoc: {},
      neo4j: {
        cypher: PLACEMENT_NEO4J_WRITE,
      },
      chroma: {
        collection: CHROMA_COLLECTION,
        document: 'placement',
      },
      neo4jVerify: {
        cypher: 'MATCH (:TmagProspect)-[r:IN_HOLDING_TANK {placementId:$id}]->(:TmagPool {id:$poolId}) RETURN count(r) AS n',
      },
    });

    const result = await placeKongaProspect(
      { ...input, invitationRecordId: 'partial-write' },
      {
        persistence: fixture.persistence as never,
        strictWrite,
        strictVerify: fixture.strictVerify as never,
        increment: vi.fn(async () => 61),
        findBa: vi.fn(async () => ({ firstName: 'Jordan', lastName: 'Rivera' })) as never,
        publish,
      },
    );

    const kongaResult = asKongaResult(result);
    expect(kongaResult.alreadyPlaced).toBe(true);
    expect(publish).not.toHaveBeenCalled();
    const edgeKey = placementEdgeKey(TEAM_POOL_ID, kongaResult.placementId);
    expect(fixture.state.placementNeo.has(edgeKey)).toBe(true);
    const chromaCollection = fixture.state.chromaCollections.get(CHROMA_COLLECTION)!;
    const persisted = fixture.state.placements.get(kongaResult.placementId);
    expect(persisted).toBeDefined();
    const persistedPlacement = persisted as { placementId: string; ownerAttempt: string; fence: number };
    expect(
      chromaCollection.has(
        placementProjectionEventId({
          placementId: persistedPlacement.placementId,
          ownerAttempt: persistedPlacement.ownerAttempt,
          fence: persistedPlacement.fence,
        }),
      ),
    ).toBe(true);
  });

  it('repairs claim projection when partial claim writes are observed', async () => {
    const existingClaim: ClaimState = {
      _id: claimId(input.prospectId),
      prospectId: input.prospectId,
      placementAttemptId: deriveKongaPlacementIdentity(input).placementAttemptId,
      placementId: 'stale-placement',
      ownerAttempt: 'corrupt-owner',
      fence: 1,
      createdAt: input.now.toISOString(),
      heartbeatAt: input.now.toISOString(),
      expiresAt: new Date(input.now.getTime() + 120_000).toISOString(),
    };
    const fixture = createFixture({
      initialClaims: [existingClaim],
    });
    // Remove neo/chroma projections to force a partial-failure readback path.
    const existingClaimEventId = buildClaimEventId(existingClaim);
    fixture.state.claimNeo.delete(existingClaimEventId);
    fixture.state.claimChroma.delete(existingClaimEventId);

    const strictWrite = fixture.strictWrite({
      id: 'claim-partial-fix',
      mongoCollection: PLACEMENT_COLLECTION,
      mongoDoc: {},
      neo4j: { cypher: PLACEMENT_NEO4J_WRITE },
      chroma: {
        collection: CHROMA_COLLECTION,
        document: 'placement',
      },
      neo4jVerify: {
        cypher: 'MATCH (:TmagProspect)-[r:IN_HOLDING_TANK {placementId:$id}]->(:TmagPool {id:$poolId}) RETURN count(r) AS n',
      },
    });

    const result = await placeKongaProspect(input, {
      persistence: fixture.persistence as never,
      strictWrite,
      strictVerify: fixture.strictVerify as never,
      increment: vi.fn(async () => 88),
      findBa: vi.fn(async () => ({ firstName: 'Jordan', lastName: 'Rivera' })) as never,
    });

    const kongaResult = asKongaResult(result);
    expect(kongaResult.alreadyPlaced).toBe(false);
    expect(fixture.state.claims.has(existingClaim._id)).toBe(false);
    expect(fixture.state.claimNeo.has(existingClaimEventId)).toBe(false);
    expect(fixture.state.claimChroma.has(existingClaimEventId)).toBe(false);
  });

  it('rejects after lease crossing and preserves the current winner’s placement projection', async () => {
    const fixture = createFixture();
    const sharedInput = { ...input, invitationRecordId: 'steady-attempt' };
    const winnerInput = { ...input, invitationRecordId: 'replacement-attempt' };
    const sharedIdentity = deriveKongaPlacementIdentity(sharedInput);
    const winnerIdentity = deriveKongaPlacementIdentity(winnerInput);
    const blockedWriter = createBarrier();
    const releaseWriter = createBarrier();
    const blockedWrite = createBarrier();

    const strictWrite = fixture.strictWrite({
      id: 'steady-placement',
      mongoCollection: PLACEMENT_COLLECTION,
      mongoDoc: {},
      neo4j: { cypher: PLACEMENT_NEO4J_WRITE },
      chroma: {
        collection: CHROMA_COLLECTION,
        document: 'placement',
      },
      neo4jVerify: {
        cypher:
          'MATCH (:TmagProspect)-[r:IN_HOLDING_TANK {placementId:$id}]->(:TmagPool {id:$poolId}) RETURN count(r) AS n',
      },
    });

    const staleWriter = vi.fn(async (payload) => {
      blockedWriter.release();
      const result = await strictWrite(payload as never);
      blockedWrite.release();
      await releaseWriter.wait();
      return result;
    }) as never;

    const staleCall = placeKongaProspect(sharedInput, {
      persistence: fixture.persistence as never,
      strictWrite: staleWriter as never,
      strictVerify: fixture.strictVerify as never,
      increment: vi.fn(async () => 121),
      findBa: vi.fn(async () => ({ firstName: 'Jordan', lastName: 'Rivera' })) as never,
      clock: () => new Date('2026-07-17T00:00:00.000Z'),
    });

    await blockedWriter.wait();

    const winner = placeKongaProspect(winnerInput, {
      persistence: fixture.persistence as never,
      strictWrite: strictWrite as never,
      strictVerify: fixture.strictVerify as never,
      increment: vi.fn(async () => 122),
      findBa: vi.fn(async () => ({ firstName: 'Jordan', lastName: 'Rivera' })) as never,
      clock: () => new Date('2026-07-17T00:30:00.000Z'),
    });
    const winnerResult = asKongaResult(await winner);

    releaseWriter.release();
    await expect(staleCall).rejects.toThrow('konga_placement_claim_not_owner');

    const placementStore = fixture.state.placements;
    expect(placementStore.has(sharedIdentity.placementId)).toBe(false);
    expect(placementStore.has(winnerIdentity.placementId)).toBe(true);
    expect(winnerResult.placementId).toBe(winnerIdentity.placementId);
    await blockedWrite.wait();
    expect(fixture.state.placementNeo.has(placementEdgeKey(TEAM_POOL_ID, winnerIdentity.placementId))).toBe(true);
    const chromaCollection = fixture.state.chromaCollections.get(CHROMA_COLLECTION)!;
    const winnerPlacement = fixture.state.placements.get(winnerIdentity.placementId) as JsonRecord | undefined;
    if (!winnerPlacement) {
      throw new Error('missing winner placement row in fixture');
    }
    const winnerProjectionId = placementProjectionEventId({
      placementId: String(winnerPlacement.placementId ?? winnerPlacement._id ?? ''),
      ownerAttempt: String(winnerPlacement.ownerAttempt ?? ''),
      fence: Number(winnerPlacement.fence ?? 0),
    });
    expect(chromaCollection.has(winnerProjectionId)).toBe(true);
  });

  it('survives same-placementId overwrite during same-attempt cleanup with winner projection fenced to a distinct id', async () => {
    const fixture = createFixture();
    const sharedInput = { ...input, invitationRecordId: 'adversarial-cleanup' };
    const sharedIdentity = deriveKongaPlacementIdentity(sharedInput);
    const winnerOwnerAttempt = 'konga_owner_adversarial_winner';
    const baseWrite = fixture.strictWrite({
      id: sharedIdentity.placementId,
      mongoCollection: PLACEMENT_COLLECTION,
      mongoDoc: {},
      neo4j: { cypher: PLACEMENT_NEO4J_WRITE },
      chroma: {
        collection: CHROMA_COLLECTION,
        document: 'placement',
      },
      neo4jVerify: {
        cypher:
          'MATCH (:TmagProspect)-[r:IN_HOLDING_TANK {placementId:$id}]->(:TmagPool {id:$poolId}) RETURN count(r) AS n',
      },
    });
    const aWrites = createBarrier();
    const allowAContinue = createBarrier();
    let capturedA: KongaStrictWriteInput | null = null;
    let winnerFence = 0;
    const winnerProjection = { id: '' };

    const adversary = (async () => {
      await aWrites.wait();
      const captured = capturedA as KongaStrictWriteInput | null;
      if (!captured) {
        throw new Error('missing captured cleanup attempt input');
      }
      const mongoDoc = captured.mongoDoc as JsonRecord;
      const baseFence = Number(mongoDoc.fence ?? NaN);
      winnerFence = Number.isFinite(baseFence) ? baseFence + 1 : 1;
      const winnerProjectionEventId = placementProjectionEventId({
        placementId: sharedIdentity.placementId,
        ownerAttempt: winnerOwnerAttempt,
        fence: winnerFence,
      });
      winnerProjection.id = winnerProjectionEventId;

      const neoParams = ((captured.neo4j as JsonRecord)?.params as JsonRecord) ?? {};
      const relationshipProps = (neoParams.relationshipProps as JsonRecord) ?? {};
      const chromaMetadata = (((captured.chroma as JsonRecord) ?? {}).metadata as JsonRecord) ?? {};

      const updatedRelationshipProps = {
        ...relationshipProps,
        placementAttemptId: sharedIdentity.placementAttemptId,
        ownerAttempt: winnerOwnerAttempt,
        fence: winnerFence,
      };
      const updatedChromaMetadata = {
        ...chromaMetadata,
        placementId: sharedIdentity.placementId,
        placementAttemptId: sharedIdentity.placementAttemptId,
        ownerAttempt: winnerOwnerAttempt,
        fence: winnerFence,
        projectionEventId: winnerProjectionEventId,
      };

      await fixture.persistence('neo4j', 'cypher', {
        query: ((captured.neo4j as JsonRecord) ?? {}).cypher as string,
        params: {
          ...(neoParams as JsonRecord),
          id: captured.id,
          relationshipProps: updatedRelationshipProps,
        },
      });
      await fixture.persistence('mongodb', 'update', {
        database: MONGO_DB,
        collection: PLACEMENT_COLLECTION,
        filter: { _id: sharedIdentity.placementId },
        update: {
          $set: {
            ...mongoDoc,
            placementAttemptId: sharedIdentity.placementAttemptId,
            ownerAttempt: winnerOwnerAttempt,
            fence: winnerFence,
            projectionEventId: winnerProjectionEventId,
          },
        },
      });
      await fixture.persistence('chromadb', 'add', {
        collection: CHROMA_COLLECTION,
        ids: [winnerProjectionEventId],
        documents: ['winner placement'],
        metadatas: [updatedChromaMetadata],
      });
      fixture.state.claims.delete(claimId(sharedInput.prospectId));
      allowAContinue.release();
    })();

    const strictWrite = vi.fn(async (payload: KongaStrictWriteInput) => {
      const writePayload = payload as KongaStrictWriteInput;
      capturedA = writePayload;
      await baseWrite(writePayload);
      aWrites.release();
      await allowAContinue.wait();
      throw new Error('staged-recovery-failure-before-chroma-proof');
    }) as unknown as KongaStrictWrite;

    const placementCall = placeKongaProspect(sharedInput, {
      persistence: fixture.persistence as never,
      strictWrite,
      strictVerify: fixture.strictVerify as never,
      increment: vi.fn(async () => 188),
      findBa: vi.fn(async () => ({ firstName: 'Jordan', lastName: 'Rivera' })) as never,
      clock: () => new Date('2026-07-17T00:00:00.000Z'),
    });

    const placementFailure = placementCall;
    await adversary;
    if (!capturedA) {
      throw new Error('missing captured cleanup attempt input');
    }
    const aPayload = capturedA as JsonRecord;
    const aMongoDoc = aPayload?.mongoDoc as JsonRecord;
    const staleProjectionId = placementProjectionEventId({
      placementId: String(aPayload?.id ?? ''),
      ownerAttempt: String(aMongoDoc?.ownerAttempt ?? ''),
      fence: Number(aMongoDoc?.fence ?? 0),
    });

    expect(capturedA).toBeTruthy();
    expect(staleProjectionId).toBeTruthy();
    await expect(placementFailure).rejects.toThrow('staged-recovery-failure-before-chroma-proof');
    expect(staleProjectionId).not.toBe(winnerProjection.id);

    const verification = await fixture.strictVerify({
      id: sharedIdentity.placementId,
      mongoCollection: PLACEMENT_COLLECTION,
      neo4jVerify: {
        cypher:
          'MATCH (:TmagProspect)-[r:IN_HOLDING_TANK {placementId:$id}]->(:TmagPool {id:$poolId}) RETURN count(r) AS n',
        params: { poolId: TEAM_POOL_ID },
      },
      chromaCollection: CHROMA_COLLECTION,
      chromaId: winnerProjection.id,
      mongoDatabase: 'momentum',
    });
    expect(verification.mongo.placementAttemptId).toBe(sharedIdentity.placementAttemptId);
    expect(verification.chromaId).toBe(winnerProjection.id);

    const chromaCollection = fixture.state.chromaCollections.get(CHROMA_COLLECTION)!;
    expect(chromaCollection.has(staleProjectionId)).toBe(false);
    expect(chromaCollection.has(winnerProjection.id)).toBe(true);
    const winnerEdge = fixture.state.placementNeo.get(placementEdgeKey(TEAM_POOL_ID, sharedIdentity.placementId)) as
      | JsonRecord
      | undefined;
    const winnerRelationshipProps = (winnerEdge?.relationshipProps ?? {}) as JsonRecord;
    expect(winnerRelationshipProps.placementAttemptId).toBe(sharedIdentity.placementAttemptId);
    expect(winnerRelationshipProps.ownerAttempt).toBe(winnerOwnerAttempt);
    expect(winnerRelationshipProps.fence).toBe(winnerFence);
  });
  it('retries placement cleanup when one store delete fails once before succeeding', async () => {
    const fixture = createFixture({ failPlacementMongoDeleteOnce: true });
    const contenderInput = { ...input, invitationRecordId: 'cleanup-attempt-keep' };
    const winnerInput = { ...input, invitationRecordId: 'cleanup-attempt-cleaner' };
    const contenderIdentity = deriveKongaPlacementIdentity(contenderInput);
    const winnerIdentity = deriveKongaPlacementIdentity(winnerInput);
    const contenderBarrier = createBarrier();
    const releaseContender = createBarrier();

    const contenderWriterBase = fixture.strictWrite({
      id: 'cleanup-contender',
      mongoCollection: PLACEMENT_COLLECTION,
      mongoDoc: {},
      neo4j: { cypher: PLACEMENT_NEO4J_WRITE },
      chroma: {
        collection: CHROMA_COLLECTION,
        document: 'placement',
      },
      neo4jVerify: {
        cypher:
          'MATCH (:TmagProspect)-[r:IN_HOLDING_TANK {placementId:$id}]->(:TmagPool {id:$poolId}) RETURN count(r) AS n',
      },
    });
    const contenderWriter = vi.fn(async (payload) => {
      await contenderWriterBase(payload as never);
      contenderBarrier.release();
      await releaseContender.wait();
      throw new Error('contender_postwrite_forced_failure');
    }) as never;

    const contenderCall = placeKongaProspect(contenderInput, {
      persistence: fixture.persistence as never,
      strictWrite: contenderWriter as never,
      strictVerify: fixture.strictVerify as never,
      increment: vi.fn(async () => 141),
      findBa: vi.fn(async () => ({ firstName: 'Jordan', lastName: 'Rivera' })) as never,
      clock: () => new Date('2026-07-17T00:00:00.000Z'),
    });

    await contenderBarrier.wait();
    const winner = placeKongaProspect(winnerInput, {
      persistence: fixture.persistence as never,
      strictWrite: fixture.strictWrite({
        id: 'cleanup-winner',
        mongoCollection: PLACEMENT_COLLECTION,
        mongoDoc: {},
        neo4j: { cypher: PLACEMENT_NEO4J_WRITE },
        chroma: {
          collection: CHROMA_COLLECTION,
          document: 'placement',
        },
        neo4jVerify: {
          cypher:
            'MATCH (:TmagProspect)-[r:IN_HOLDING_TANK {placementId:$id}]->(:TmagPool {id:$poolId}) RETURN count(r) AS n',
        },
      }) as never,
      strictVerify: fixture.strictVerify as never,
      increment: vi.fn(async () => 142),
      findBa: vi.fn(async () => ({ firstName: 'Jordan', lastName: 'Rivera' })) as never,
      clock: () => new Date('2026-07-17T00:30:00.000Z'),
    });
    const winnerResult = asKongaResult(await winner);
    releaseContender.release();

    await expect(contenderCall).rejects.toThrow('contender_postwrite_forced_failure');
    const mongoDeleteCalls = fixture.calls.filter(
      (call) =>
        call.tool === 'mongodb' &&
        call.action === 'delete' &&
        call.params.collection === PLACEMENT_COLLECTION,
    ).length;
    expect(mongoDeleteCalls).toBeGreaterThan(1);
    expect(fixture.state.placements.has(contenderIdentity.placementId)).toBe(false);
    expect(fixture.state.placements.has(winnerIdentity.placementId)).toBe(true);
    expect(winnerResult.placementId).toBe(winnerIdentity.placementId);
  });

  it('fails closed when placement cleanup delete cannot be fully removed', async () => {
    const fixture = createFixture({ failPlacementMongoDeleteForever: true });
    const contenderInput = { ...input, invitationRecordId: 'cleanup-attempt-fail-open' };
    const winnerInput = { ...input, invitationRecordId: 'cleanup-attempt-still-alive' };
    const contenderIdentity = deriveKongaPlacementIdentity(contenderInput);
    const winnerIdentity = deriveKongaPlacementIdentity(winnerInput);
    const contenderBarrier = createBarrier();
    const releaseContender = createBarrier();

    const contenderWriterBase = fixture.strictWrite({
      id: 'cleanup-contender-fail',
      mongoCollection: PLACEMENT_COLLECTION,
      mongoDoc: {},
      neo4j: { cypher: PLACEMENT_NEO4J_WRITE },
      chroma: {
        collection: CHROMA_COLLECTION,
        document: 'placement',
      },
      neo4jVerify: {
        cypher:
          'MATCH (:TmagProspect)-[r:IN_HOLDING_TANK {placementId:$id}]->(:TmagPool {id:$poolId}) RETURN count(r) AS n',
      },
    });
    const contenderWriter = vi.fn(async (payload) => {
      await contenderWriterBase(payload as never);
      contenderBarrier.release();
      await releaseContender.wait();
      throw new Error('contender_postwrite_forced_failure');
    }) as never;

    const contenderCall = placeKongaProspect(contenderInput, {
      persistence: fixture.persistence as never,
      strictWrite: contenderWriter as never,
      strictVerify: fixture.strictVerify as never,
      increment: vi.fn(async () => 151),
      findBa: vi.fn(async () => ({ firstName: 'Jordan', lastName: 'Rivera' })) as never,
      clock: () => new Date('2026-07-17T00:00:00.000Z'),
    });

    await contenderBarrier.wait();
    const winner = placeKongaProspect(winnerInput, {
      persistence: fixture.persistence as never,
      strictWrite: fixture.strictWrite({
        id: 'cleanup-winner-fail',
        mongoCollection: PLACEMENT_COLLECTION,
        mongoDoc: {},
        neo4j: { cypher: PLACEMENT_NEO4J_WRITE },
        chroma: {
          collection: CHROMA_COLLECTION,
          document: 'placement',
        },
        neo4jVerify: {
          cypher:
            'MATCH (:TmagProspect)-[r:IN_HOLDING_TANK {placementId:$id}]->(:TmagPool {id:$poolId}) RETURN count(r) AS n',
        },
      }) as never,
      strictVerify: fixture.strictVerify as never,
      increment: vi.fn(async () => 152),
      findBa: vi.fn(async () => ({ firstName: 'Jordan', lastName: 'Rivera' })) as never,
      clock: () => new Date('2026-07-17T00:30:00.000Z'),
    });
    await winner;
    releaseContender.release();

    await expect(contenderCall).rejects.toThrow('konga_placement_projection_cleanup_failed');
    expect(fixture.state.placements.has(contenderIdentity.placementId)).toBe(true);
    expect(fixture.state.placements.has(winnerIdentity.placementId)).toBe(true);
  });

  it('projects legacy attribution as null without backfill', () => {
    expect(
      projectLegacyPlacementAddedBy({
        prospectId: 'legacy',
        sponsorTmagId: 'TMBA-X',
        positionNumber: 7,
        placedAt: '2025-01-01T00:00:00.000Z',
        expiresAt: '2025-02-01T00:00:00.000Z',
        flushedAt: null,
        flushReason: null,
      }),
    ).toBeNull();
  });
});
