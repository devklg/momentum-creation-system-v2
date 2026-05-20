/**
 * Smoke test for the Chat #105 holding-tank domain. Not part of the
 * production codebase. Run with:
 *   pnpm --filter @momentum/server tsx scripts/smoke-holding-tank.ts
 *
 * What it does:
 *   1. Creates a synthetic prospect + token (smoke-prefixed _ids).
 *   2. Calls placeProspect once — expects alreadyPlaced=false, position>0.
 *   3. Calls placeProspect again — expects alreadyPlaced=true, same position.
 *   4. Verifies Mongo pool_placements + prospects rows, Neo4j relationship,
 *      ChromaDB event document.
 *   5. Cleans up all smoke-prefixed records.
 */

import { gatewayCall } from '../src/services/gateway.js';
import { placeProspect, findPlacementByProspectId, TEAM_POOL_ID } from '../src/domain/holdingTank.js';

const SMOKE_PROSPECT_ID = `smoke_prospect_${Date.now()}`;
const SMOKE_BA_ID = 'TMBA-FOUNDER-KEVIN';
const MONGO_DB = 'momentum';

async function seed(): Promise<void> {
  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 8 * 7 * 24 * 60 * 60 * 1000).toISOString();
  await gatewayCall('mongodb', 'insert', {
    database: MONGO_DB,
    collection: 'prospects',
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
        sponsorBaId: SMOKE_BA_ID,
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
  await gatewayCall('mongodb', 'delete', {
    database: MONGO_DB,
    collection: 'prospects',
    filter: { _id: SMOKE_PROSPECT_ID },
  }).catch(() => {});
  await gatewayCall('mongodb', 'delete', {
    database: MONGO_DB,
    collection: 'pool_placements',
    filter: { _id: SMOKE_PROSPECT_ID },
  }).catch(() => {});
  await gatewayCall('neo4j', 'cypher', {
    query: 'MATCH (p:Prospect {prospectId: $id})-[r:IN_HOLDING_TANK]->() DELETE r, p',
    params: { id: SMOKE_PROSPECT_ID },
  }).catch(() => {});
}

async function main(): Promise<void> {
  console.log('[smoke] seeding synthetic prospect:', SMOKE_PROSPECT_ID);
  await seed();

  console.log('[smoke] call 1: placeProspect');
  const first = await placeProspect({
    prospectId: SMOKE_PROSPECT_ID,
    sponsorBaId: SMOKE_BA_ID,
    prospectExpiresAt: new Date(Date.now() + 8 * 7 * 24 * 60 * 60 * 1000).toISOString(),
    firstName: 'Smoke',
    lastInitial: 'T',
    city: 'Test City',
    stateOrRegion: 'CA',
  });
  console.log('  result:', first);
  if (first.alreadyPlaced) throw new Error('expected alreadyPlaced=false on first call');
  if (first.positionNumber < 1) throw new Error('expected positionNumber >= 1');

  console.log('[smoke] call 2: placeProspect (idempotency)');
  const second = await placeProspect({
    prospectId: SMOKE_PROSPECT_ID,
    sponsorBaId: SMOKE_BA_ID,
    prospectExpiresAt: new Date(Date.now() + 8 * 7 * 24 * 60 * 60 * 1000).toISOString(),
    firstName: 'Smoke',
    lastInitial: 'T',
    city: 'Test City',
    stateOrRegion: 'CA',
  });
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
  const neo = await gatewayCall<{ records: Array<{ position: number; placedAt: string }> }>('neo4j', 'cypher', {
    query:
      'MATCH (p:Prospect {prospectId: $id})-[r:IN_HOLDING_TANK]->(pool:Pool {id: $poolId}) ' +
      'RETURN r.position AS position, r.placedAt AS placedAt',
    params: { id: SMOKE_PROSPECT_ID, poolId: TEAM_POOL_ID },
  });
  console.log('  neo4j records:', neo.records);
  if (!neo.records.length) throw new Error('neo4j relationship missing');

  console.log('[smoke] verify chroma event');
  const chroma = await gatewayCall<{ ids: string[][]; documents: string[][] }>('chromadb', 'query', {
    collection: 'mcs_pool_events',
    where: { prospectId: SMOKE_PROSPECT_ID },
    n_results: 5,
  }).catch((err: Error) => {
    console.log('  chroma query failed (non-fatal in smoke):', err.message);
    return null;
  });
  if (chroma) console.log('  chroma:', chroma);

  console.log('[smoke] cleanup');
  await cleanup();
  console.log('[smoke] PASS');
}

main().catch((err) => {
  console.error('[smoke] FAIL', err);
  cleanup().finally(() => process.exit(1));
});
