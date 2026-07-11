import {
  writeGraphCritical,
  type TieredChromaWrite,
  type TieredWriteResult,
} from '../services/tieredWrite.js';
import { persistenceCall } from '../services/persistence/dispatch.js';
import { enqueueProjection, extractCount, type Neo4jProjectionPayload } from '../services/projectionOutbox.js';
import type { McsPoolPlacement } from '@momentum/shared';

const MONGO_DB = 'momentum';
const PLACEMENTS_COLLECTION = 'tmag_prospect_htank_placements';

export interface PoolPlacementGraphWriteInput {
  placement: McsPoolPlacement;
  poolId: string;
  relationshipProps: Record<string, unknown>;
  chroma?: TieredChromaWrite;
}

export interface PoolPlacementPatchInput {
  prospectId: string;
  patch: Record<string, unknown>;
  relationshipPatch: Record<string, unknown>;
}

function withoutUndefined(input: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined));
}

export function buildPoolPlacementGraphCypher(): {
  cypher: string;
  verifyCypher: string;
} {
  return {
    cypher:
      'MERGE (pool:TmagPool {id: $poolId}) ' +
      'MATCH (p:TmagProspect {prospectId: $id}) ' +
      'MERGE (p)-[r:IN_HOLDING_TANK]->(pool) ' +
      'SET r += $relationshipProps',
    verifyCypher:
      'MATCH (p:TmagProspect {prospectId: $id})-[r:IN_HOLDING_TANK]->' +
      '(pool:TmagPool {id: $poolId}) RETURN count(r) AS n',
  };
}

export function writePoolPlacementGraphCritical(
  input: PoolPlacementGraphWriteInput,
): Promise<TieredWriteResult> {
  const graph = buildPoolPlacementGraphCypher();
  const relationshipProps = withoutUndefined({
    position: input.placement.positionNumber,
    placedAt: input.placement.placedAt,
    sponsorTmagId: input.placement.sponsorTmagId,
    ...input.relationshipProps,
  });

  return writeGraphCritical({
    id: input.placement.prospectId,
    mongoCollection: PLACEMENTS_COLLECTION,
    mongoDoc: { ...input.placement },
    neo4j: {
      cypher: graph.cypher,
      params: {
        poolId: input.poolId,
        relationshipProps,
      },
      verifyCypher: graph.verifyCypher,
      verifyParams: {
        poolId: input.poolId,
      },
    },
    ...(input.chroma ? { chroma: input.chroma } : {}),
  });
}

async function verifyPlacementPatch(
  prospectId: string,
  expected: Record<string, unknown>,
): Promise<void> {
  const result = await persistenceCall<{ documents?: Array<Record<string, unknown>> }>('mongodb', 'query', {
    database: MONGO_DB,
    collection: PLACEMENTS_COLLECTION,
    filter: { prospectId },
    limit: 1,
  });
  const doc = result.documents?.[0];
  if (!doc) throw new Error(`pool_placement_readback_missing:${prospectId}`);
  for (const [key, value] of Object.entries(expected)) {
    if (doc[key] !== value) {
      throw new Error(`pool_placement_readback_mismatch:${prospectId}:${key}`);
    }
  }
}

async function projectPlacementPatchToNeo4j(
  prospectId: string,
  patch: Record<string, unknown>,
): Promise<void> {
  const payload: Neo4jProjectionPayload = {
    cypher:
      'MATCH (p:TmagProspect {prospectId: $id})-[r:IN_HOLDING_TANK]->(:TmagPool) ' +
      'SET r += $relationshipProps',
    params: {
      relationshipProps: patch,
    },
    verifyCypher:
      'MATCH (p:TmagProspect {prospectId: $id})-[r:IN_HOLDING_TANK]->(:TmagPool) ' +
      'RETURN count(r) AS n',
  };

  try {
    await persistenceCall('neo4j', 'cypher', {
      query: payload.cypher,
      params: { id: prospectId, ...(payload.params ?? {}) },
    });
    const check = await persistenceCall<{ records?: Array<Record<string, unknown>> }>('neo4j', 'cypher', {
      query: payload.verifyCypher,
      params: { id: prospectId, ...(payload.verifyParams ?? {}) },
    });
    if (extractCount(check) < 1) throw new Error('pool placement graph read-back returned 0');
  } catch (err) {
    await enqueueProjection({
      tier: 'operational',
      target: 'neo4j',
      entityId: prospectId,
      mongoCollection: PLACEMENTS_COLLECTION,
      payload,
      lastError: err instanceof Error ? err.message : String(err),
    });
  }
}

export async function updatePoolPlacementOperational(
  input: PoolPlacementPatchInput,
): Promise<void> {
  const patch = withoutUndefined(input.patch);
  await persistenceCall('mongodb', 'update', {
    database: MONGO_DB,
    collection: PLACEMENTS_COLLECTION,
    filter: { prospectId: input.prospectId },
    update: { $set: patch },
  });
  await verifyPlacementPatch(input.prospectId, patch);
  await projectPlacementPatchToNeo4j(
    input.prospectId,
    withoutUndefined(input.relationshipPatch),
  );
}
