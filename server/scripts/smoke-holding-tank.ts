/**
 * H1 live smoke — holding-tank domain against the provisioned Rev 3 stack.
 * Rewritten 2026-07-02 post-reidentification-migration (PR #115) + ACR-0009:
 * direct-mode scripts must bootstrap their own connections (no gateway).
 * Run: pnpm --filter @momentum/server tsx scripts/smoke-holding-tank.ts
 *
 *   1. Connects Mongo directly (governed stack), seeds a synthetic
 *      tmag_prospects row (smoke-prefixed _id, Rev 3 shape).
 *   2. placeProspect — expects alreadyPlaced=false, position>0.
 *   3. placeProspect again — expects alreadyPlaced=true, same position.
 *   4. Verifies Mongo tmag_prospect_htank_placements row, the Neo4j
 *      (:TmagProspect)-[:IN_HOLDING_TANK]->(:TmagPool) edge, and the
 *      mcs_prospect_htank_events Chroma doc (GPU embedder must be up).
 *   5. Cleans up all smoke-prefixed records and exits 0.
 */

import { persistenceCall } from '../src/services/persistence/dispatch.js';
import { connectMongo } from '../src/services/persistence/mongo/connection.js';
import { placeProspect, findPlacementByProspectId, TEAM_POOL_ID } from '../src/domain/holdingTank.js';

const SMOKE_PROSPECT_ID = `smoke_prospect_${Date.now()}`;
const SMOKE_SPONSOR = 'TMAG-01';
const MONGO_DB = 'momentum';
const PROSPECTS = 'tmag_prospects';
const PLACEMENTS = 'tmag_prospect_htank_placements';

async function seed(): Promise<void> {
  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 8 * 7 * 24 * 60 * 60 * 1000).toISOString();
  await persistenceCall('mongodb', 'insert', {
    database: MONGO_DB,
    collection: PROSPECTS,
    documents: [
      {
        _id: SMOKE_PROSPECT_ID,
        prospectId: SMOKE_PROSPECT_ID,
        firstName: 'Smoke',
        lastName: 'Test',
        lastInitial: 'T',
        location: { city: 'Test City', stateOrRegion: 'CA', country: 'US' },
        phone: null,
        email: null,
        sponsorTmagId: SMOKE_SPONSOR,
        state: 'clicked',
        positionNumber: null,
        placedAt: null,
        becameCustomer: false,
        becameCustomerAt: null,
        customerNote: null,
        createdAt: now,
        updatedAt: now,
        expiresAt,
      },
    ],
  });
}

async function cleanup(): Promise<void> {
  await persistenceCall('mongodb', 'delete', {
    database: MONGO_DB, collection: PROSPECTS, filter: { _id: SMOKE_PROSPECT_ID },
  }).catch(() => {});
  await persistenceCall('mongodb', 'delete', {
    database: MONGO_DB, collection: PLACEMENTS, filter: { _id: SMOKE_PROSPECT_ID },
  }).catch(() => {});
  await persistenceCall('neo4j', 'cypher', {
    query: 'MATCH (p:TmagProspect {prospectId: $id})-[r:IN_HOLDING_TANK]->() DELETE r, p',
    params: { id: SMOKE_PROSPECT_ID },
  }).catch(() => {});
  await persistenceCall('chromadb', 'delete', {
    collection: 'mcs_prospect_htank_events',
    where: { prospectId: SMOKE_PROSPECT_ID },
  }).catch(() => {});
}

async function main(): Promise<void> {
  console.log('[smoke] connecting direct persistence (mongo)...');
  await connectMongo();

  console.log('[smoke] seeding synthetic prospect:', SMOKE_PROSPECT_ID);
  await seed();

  const input = {
    prospectId: SMOKE_PROSPECT_ID,
    sponsorTmagId: SMOKE_SPONSOR,
    prospectExpiresAt: new Date(Date.now() + 8 * 7 * 24 * 60 * 60 * 1000).toISOString(),
    firstName: 'Smoke',
    lastInitial: 'T',
    city: 'Test City',
    stateOrRegion: 'CA',
  };

  console.log('[smoke] call 1: placeProspect');
  const first = await placeProspect(input);
  console.log('  result:', first);
  if (first.alreadyPlaced) throw new Error('expected alreadyPlaced=false on first call');
  if (first.positionNumber < 1) throw new Error('expected positionNumber >= 1');

  console.log('[smoke] call 2: placeProspect (idempotency)');
  const second = await placeProspect(input);
  console.log('  result:', second);
  if (!second.alreadyPlaced) throw new Error('expected alreadyPlaced=true on second call');
  if (second.positionNumber !== first.positionNumber) {
    throw new Error(`expected same position; got ${second.positionNumber} vs ${first.positionNumber}`);
  }

  console.log('[smoke] verify mongo placement row');
  const placement = await findPlacementByProspectId(SMOKE_PROSPECT_ID);
  if (!placement) throw new Error('placement row missing in mongo');
  console.log('  placement:', placement);

  console.log('[smoke] verify neo4j relationship');
  const neo = await persistenceCall<{ records: Array<{ position: number; placedAt: string }> }>('neo4j', 'cypher', {
    query:
      'MATCH (p:TmagProspect {prospectId: $id})-[r:IN_HOLDING_TANK]->(pool:TmagPool {id: $poolId}) ' +
      'RETURN r.position AS position, r.placedAt AS placedAt',
    params: { id: SMOKE_PROSPECT_ID, poolId: TEAM_POOL_ID },
  });
  console.log('  neo4j records:', neo.records);
  if (!neo.records.length) throw new Error('neo4j relationship missing');

  console.log('[smoke] verify chroma event (mcs_prospect_htank_events)');
  const chroma = await persistenceCall<{ results: Array<{ id: string }> }>('chromadb', 'query_with_filter', {
    collection: 'mcs_prospect_htank_events',
    query: 'placement in the holding tank',
    where: { prospectId: SMOKE_PROSPECT_ID },
    n_results: 5,
  }).catch((err: Error) => {
    console.log('  chroma query failed:', err.message);
    return null;
  });
  if (chroma) console.log('  chroma result:', JSON.stringify(chroma).slice(0, 400));
  if (!chroma || !JSON.stringify(chroma).includes(SMOKE_PROSPECT_ID)) {
    throw new Error('chroma htank event missing — H1 requires all three legs');
  }

  console.log('[smoke] cleanup');
  await cleanup();
  console.log('[smoke] PASS — all three legs verified (Rev 3 names, direct mode)');
  process.exit(0);
}

main().catch((err) => {
  console.error('[smoke] FAIL', err);
  cleanup().finally(() => process.exit(1));
});
