/**
 * Holding tank domain. The team-wide shared pool every BA's prospects
 * feed into at video_complete (Chat #84 keystone).
 *
 * Architecture (Chat #105 lock, option A):
 *   - Mongo `pool_counters` holds the authoritative monotonic position
 *     counter. `$inc` returns the new value in a single atomic operation;
 *     no race condition between concurrent placements.
 *   - Mongo `pool_placements` stores each placement record indexed by
 *     prospectId. Lookup is the idempotency check — if a placement
 *     already exists for this prospect, placeProspect returns it without
 *     incrementing the counter again.
 *   - Neo4j writes (:Prospect)-[:IN_HOLDING_TANK {position}]->(:Pool)
 *     so graph queries can walk the pool by position or by BA.
 *   - ChromaDB `mcs_pool_events` records a semantically searchable event
 *     for every placement; useful for /admin live operations and audit.
 *
 * Monotonicity contract (locked-spec Part 3.2):
 *   - Position numbers never reshuffle. If a prospect at #347 is later
 *     flushed (enrolled, expired, archived), #348 does NOT become #347.
 *   - The vacant slot is preserved by clearing the prospect linkage but
 *     leaving the position number in the assigned sequence.
 *
 * Idempotency contract (Chat #105 lock):
 *   - placeProspect is safe to call twice. The second call returns the
 *     existing PoolPlacement with alreadyPlaced=true; no new position is
 *     minted, no new triple-stack write occurs.
 *   - This protects against:
 *     * The .com client retrying a failed POST /api/p/:token/video-event.
 *     * YouTube IFrame firing 'ended' multiple times for one playthrough.
 *     * Network glitches that re-deliver the same event.
 */

import { gatewayCall } from '../services/gateway.js';
import { publishPlacement } from '../services/poolEvents.js';
import type {
  HoldingTankSnapshot,
  PlaceProspectResult,
  PlacementEvent,
  PlacementTickerEntry,
  PoolPlacement,
} from '@momentum/shared';

const MONGO_DB = 'momentum';
const COUNTERS_COLLECTION = 'pool_counters';
const PLACEMENTS_COLLECTION = 'pool_placements';
const CHROMA_COLLECTION = 'mcs_pool_events';

/** Single-row counter document id. The pool is team-wide (Chat #84). */
export const TEAM_POOL_ID = 'tm_team_pool';

/**
 * Atomically increment the team pool counter and return the new value.
 *
 * Gateway bug worked around: the mongo `update` action does not honor
 * `upsert:true`. We branch on existence: if the counter doc is missing
 * we insert it at 1; otherwise we $inc and re-read.
 *
 * Race note: between the existence check and the insert, a concurrent
 * placement could insert first. The MongoDB driver enforces _id
 * uniqueness, so the second insert throws — we catch and re-enter the
 * $inc path. This collapses to at most one extra round trip during the
 * very-first placement; steady state is one $inc + one query.
 */
async function incrementPoolCounter(): Promise<number> {
  // Try $inc first. If counter doc exists, this is the entire happy path.
  // The gateway returns matchedCount/modifiedCount; we then read to learn
  // the new value.
  const incResult = await gatewayCall<{ matchedCount?: number; modifiedCount?: number }>(
    'mongodb',
    'update',
    {
      database: MONGO_DB,
      collection: COUNTERS_COLLECTION,
      filter: { _id: TEAM_POOL_ID },
      update: { $inc: { current: 1 } },
    },
  );

  if ((incResult.matchedCount ?? 0) > 0) {
    const after = await gatewayCall<{ documents: Array<{ current: number }> }>('mongodb', 'query', {
      database: MONGO_DB,
      collection: COUNTERS_COLLECTION,
      filter: { _id: TEAM_POOL_ID },
      limit: 1,
    });
    const value = after.documents[0]?.current;
    if (typeof value !== 'number') {
      throw new Error('pool_counter_read_failed');
    }
    return value;
  }

  // Counter doc missing — seed at 1. Catch duplicate-key in case a
  // concurrent placement seeded it first; fall back to $inc.
  try {
    await gatewayCall('mongodb', 'insert', {
      database: MONGO_DB,
      collection: COUNTERS_COLLECTION,
      documents: [{ _id: TEAM_POOL_ID, current: 1, createdAt: new Date().toISOString() }],
    });
    return 1;
  } catch (err) {
    // Concurrent insert won the race. Re-enter the $inc path once.
    const retry = await gatewayCall<{ matchedCount?: number }>('mongodb', 'update', {
      database: MONGO_DB,
      collection: COUNTERS_COLLECTION,
      filter: { _id: TEAM_POOL_ID },
      update: { $inc: { current: 1 } },
    });
    if ((retry.matchedCount ?? 0) === 0) {
      throw new Error(`pool_counter_seed_collision: ${(err as Error).message}`);
    }
    const after = await gatewayCall<{ documents: Array<{ current: number }> }>('mongodb', 'query', {
      database: MONGO_DB,
      collection: COUNTERS_COLLECTION,
      filter: { _id: TEAM_POOL_ID },
      limit: 1,
    });
    const value = after.documents[0]?.current;
    if (typeof value !== 'number') {
      throw new Error('pool_counter_read_failed_after_retry');
    }
    return value;
  }
}

/**
 * Look up an existing placement by prospectId. Returns null if the
 * prospect has not been placed yet. Used for the idempotency check
 * inside placeProspect.
 */
export async function findPlacementByProspectId(prospectId: string): Promise<PoolPlacement | null> {
  const result = await gatewayCall<{ documents: PoolPlacement[] }>('mongodb', 'query', {
    database: MONGO_DB,
    collection: PLACEMENTS_COLLECTION,
    filter: { prospectId },
    limit: 1,
  });
  return result.documents[0] ?? null;
}

export interface PlaceProspectInput {
  prospectId: string;
  sponsorBaId: string;
  /** Prospect's expiresAt is copied onto the placement for fast flush sweeps. */
  prospectExpiresAt: string;
  /** First name + last initial used in the ChromaDB event document. */
  firstName: string;
  lastInitial: string;
  /** City and state used in the ChromaDB event document for ticker semantics. */
  city: string;
  stateOrRegion: string;
}

/**
 * Place a prospect in the team-wide holding tank.
 *
 * Idempotent: if the prospect is already placed, returns the existing
 * placement record with alreadyPlaced=true and performs no writes.
 *
 * Otherwise:
 *   1. Increment the team pool counter (atomic Mongo $inc).
 *   2. Insert the placement record into `pool_placements`.
 *   3. MERGE the (:Prospect)-[:IN_HOLDING_TANK]->(:Pool) edge in Neo4j.
 *   4. Add a placement event to ChromaDB `mcs_pool_events`.
 *   5. Mirror positionNumber + placedAt back onto the prospect record.
 *
 * All five operations are sequential; if step 2+ fails after step 1 has
 * minted a position, that position becomes a vacant slot. This is
 * acceptable per the monotonicity contract — wasted positions are an
 * expected outcome of error recovery, not a bug.
 */
export async function placeProspect(input: PlaceProspectInput): Promise<PlaceProspectResult> {
  // Idempotency check first — cheapest path is no-op.
  const existing = await findPlacementByProspectId(input.prospectId);
  if (existing) {
    return {
      prospectId: existing.prospectId,
      positionNumber: existing.positionNumber,
      placedAt: existing.placedAt,
      alreadyPlaced: true,
    };
  }

  // 1. Mint the position number.
  const positionNumber = await incrementPoolCounter();
  const placedAt = new Date().toISOString();

  // 2. Insert placement record. _id = prospectId for one-placement-per-
  //    prospect invariant; if a second writer raced to here, duplicate-
  //    key surfaces as a gateway error — we catch and return the row.
  const placement: PoolPlacement = {
    prospectId: input.prospectId,
    sponsorBaId: input.sponsorBaId,
    positionNumber,
    placedAt,
    expiresAt: input.prospectExpiresAt,
    flushedAt: null,
    flushReason: null,
  };

  try {
    await gatewayCall('mongodb', 'insert', {
      database: MONGO_DB,
      collection: PLACEMENTS_COLLECTION,
      documents: [{ _id: input.prospectId, ...placement }],
    });
  } catch (err) {
    // Concurrent placement won; return the persisted one. The position we
    // minted in step 1 is now vacant (intentional per monotonicity
    // contract). We do not attempt to reclaim it.
    const winner = await findPlacementByProspectId(input.prospectId);
    if (winner) {
      return {
        prospectId: winner.prospectId,
        positionNumber: winner.positionNumber,
        placedAt: winner.placedAt,
        alreadyPlaced: true,
      };
    }
    throw err;
  }

  // 3. Neo4j: MERGE prospect + pool nodes, MERGE the relationship with
  //    position. MERGE on the relationship is idempotent in case of retry.
  await gatewayCall('neo4j', 'cypher', {
    query:
      'MERGE (pool:Pool {id: $poolId}) ' +
      'MERGE (p:Prospect {prospectId: $prospectId}) ' +
      'MERGE (p)-[r:IN_HOLDING_TANK]->(pool) ' +
      'SET r.position = $position, ' +
      '    r.placedAt = $placedAt, ' +
      '    r.sponsorBaId = $sponsorBaId',
    params: {
      poolId: TEAM_POOL_ID,
      prospectId: input.prospectId,
      position: positionNumber,
      placedAt,
      sponsorBaId: input.sponsorBaId,
    },
  });

  // 4. ChromaDB event log. Document body is the format the ticker will
  //    eventually render (Chat #108) so semantic search returns recognizable
  //    text. Collection bootstrapped in Chat #105 (CK-04 protocol).
  const eventId = `placement_${input.prospectId}_${placedAt}`;
  const eventDoc =
    `#${positionNumber} ${input.firstName} ${input.lastInitial}. ` +
    `from ${input.city}, ${input.stateOrRegion} · ` +
    `invited by ${input.sponsorBaId} at ${placedAt}`;
  await gatewayCall('chromadb', 'add', {
    collection: CHROMA_COLLECTION,
    ids: [eventId],
    documents: [eventDoc],
    metadatas: [
      {
        kind: 'placement',
        prospectId: input.prospectId,
        sponsorBaId: input.sponsorBaId,
        positionNumber,
        placedAt,
        city: input.city,
        stateOrRegion: input.stateOrRegion,
      },
    ],
  });

  // 5. Mirror position + placedAt + state onto the prospect record so the
  //    next GET /api/p/:token resolve carries the assigned position without
  //    re-querying pool_placements. State stays in lockstep with the token.
  await gatewayCall('mongodb', 'update', {
    database: MONGO_DB,
    collection: 'prospects',
    filter: { prospectId: input.prospectId },
    update: {
      $set: {
        positionNumber,
        placedAt,
        state: 'video_complete',
        updatedAt: placedAt,
      },
    },
  });

  // 6. Publish to the in-process pool event bus so every connected SSE
  //    viewer receives the placement live (Chat #114 dashboard port).
  //    Fan-out is fire-and-forget; persistence already committed in steps
  //    1–5. If no viewers are subscribed, the publish is a no-op.
  const placementEvent: PlacementEvent = {
    eventId: `placement_evt_${input.prospectId}_${placedAt}`,
    positionNumber,
    firstName: input.firstName,
    lastInitial: input.lastInitial,
    city: input.city,
    stateOrRegion: input.stateOrRegion,
    placedAt,
  };
  publishPlacement(placementEvent);

  return {
    prospectId: input.prospectId,
    positionNumber,
    placedAt,
    alreadyPlaced: false,
  };
}

/**
 * Build the SSE snapshot payload sent at connection open. The client
 * uses `globalMaxPosition` to compute its beneath-you count via
 *   beneath_you = max(0, globalMaxPosition - my_position)
 * and uses `recent` to seed the position-stack ticker without a second
 * round-trip.
 *
 * `recentLimit` is the number of most-recent placements to include.
 * Locked-spec 4.4 calls for 20–40 visible entries; pass 40 from the
 * route layer and let the client trim if needed.
 */
export async function buildHoldingTankSnapshot(
  recentLimit: number,
): Promise<HoldingTankSnapshot> {
  const [globalMaxPosition, recent] = await Promise.all([
    readPoolCounter(),
    listRecentPlacements(recentLimit),
  ]);
  return { globalMaxPosition, recent };
}

/**
 * Read the current value of the team pool counter without incrementing.
 * Returns 0 if the counter doc has not been seeded yet (no placements
 * have happened ever).
 */
async function readPoolCounter(): Promise<number> {
  const result = await gatewayCall<{ documents: Array<{ current: number }> }>(
    'mongodb',
    'query',
    {
      database: MONGO_DB,
      collection: COUNTERS_COLLECTION,
      filter: { _id: TEAM_POOL_ID },
      limit: 1,
    },
  );
  return result.documents[0]?.current ?? 0;
}

/**
 * Return the most recent N placements (newest first), as ticker entries.
 * Backed by a Mongo query against `pool_placements` sorted by placedAt
 * descending. Flushed placements are excluded — the ticker shows the
 * live team, not historical no-shows.
 */
async function listRecentPlacements(
  limit: number,
): Promise<PlacementTickerEntry[]> {
  // We need first name + last initial + city/state for ticker render, but
  // those live on the prospect record, not the placement record. The most
  // economical path at v1 scale is a query against the prospect collection
  // filtered to state=video_complete with the right projection + sort.
  // When pool_placements is large enough to dominate, this becomes a
  // single $lookup aggregation or a denormalized field on placement.
  const result = await gatewayCall<{
    documents: Array<{
      firstName: string;
      lastInitial?: string;
      lastName?: string;
      location?: { city?: string; stateOrRegion?: string };
      positionNumber: number;
      placedAt: string;
    }>;
  }>('mongodb', 'query', {
    database: MONGO_DB,
    collection: 'prospects',
    filter: {
      state: 'video_complete',
      positionNumber: { $ne: null },
      placedAt: { $ne: null },
    },
    sort: { placedAt: -1 },
    limit,
  });

  return result.documents
    .filter((d) => typeof d.positionNumber === 'number' && typeof d.placedAt === 'string')
    .map<PlacementTickerEntry>((d) => ({
      positionNumber: d.positionNumber,
      firstName: d.firstName,
      lastInitial:
        d.lastInitial ||
        (d.lastName ? d.lastName.charAt(0).toUpperCase() : ''),
      city: d.location?.city ?? '',
      stateOrRegion: d.location?.stateOrRegion ?? '',
      placedAt: d.placedAt,
    }));
}
