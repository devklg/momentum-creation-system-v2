/**
 * Tiered write helper (docs/app-data-model-contract.md §2.2–§2.4, §13 item 1).
 *
 * Replaces the fire-once `tripleStackWrite` (services/tripleStack.ts) with a
 * writer whose failure/consistency policy is chosen PER RECORD by tier. The app
 * is already MongoDB-authoritative with optional projections (§2.0); this
 * finishes the policy the original helper left open. The sorting test for a
 * caller picking a tier (§2.1):
 *
 *   > Would Michael, Ivory, or the training agent give bad advice if this
 *   > record half-wrote?
 *
 *   - 'graph_critical' (Tier 1): membership + agent-reasoned edges — BA +
 *     UPLINE_IS, prospect + sponsor edge, Ivory edges. Mongo + Neo4j ATOMIC:
 *     both land or the Mongo insert is rolled back. The anchor node MUST
 *     pre-exist (cypher uses MATCH, never MERGE — a phantom sponsor is
 *     forbidden, §6.3). Verified by a caller-supplied read-back (n>=1).
 *
 *   - 'knowledge' (Tier 2): what the agents learn from - Steve discovery,
 *     master content, CRM notes, behavioral trail. Mongo
 *     commit = success; Neo4j/Chroma projection is MANDATORY via the durable
 *     retry queue (projectionOutbox.ts) until it lands; alert on exhaustion.
 *
 *   - 'operational' (Tier 3): callbacks, fast-start ticks, reservations, audit.
 *     Mongo commit = success; projections retry but never block the user.
 *
 * EVERY tier reads its Mongo write back to verify it landed (§4A "verify, don't
 * assume"). One fix here; every caller that migrates onto it inherits durable
 * projection-with-retry, rollback for membership, and read-back verification.
 *
 * NOTE: this module is additive. Existing `tripleStackWrite` callers keep
 * working; migrating them (registration ba.ts, crm.ts, holdingTank.ts, the
 * admin CRUD paths, Ivory/Michael/training) is contract §13 items 2–5.
 */

import { persistenceCall } from './persistence/dispatch.js';
import { assertChromaCollectionExists, ChromaCollectionMissingError } from './chromaCollections.js';
import {
  enqueueProjection,
  extractCount,
  type Neo4jProjectionPayload,
  type ChromaProjectionPayload,
} from './projectionOutbox.js';

const MONGO_DB = 'momentum';

export type WriteTier = 'graph_critical' | 'knowledge' | 'operational';

export interface TieredNeo4jWrite {
  cypher: string;
  params?: Record<string, unknown>;
  /**
   * Read-back proving the write landed: a `RETURN count(...) AS n` query that
   * must return n>=1 (e.g. the BA node AND its UPLINE_IS edge to the matched
   * sponsor). REQUIRED for `graph_critical` — Tier 1 must be verifiable, and
   * because the anchor uses MATCH, a missing anchor produces a silent zero-row
   * write that only a read-back can catch. Optional for knowledge/operational.
   */
  verifyCypher?: string;
  verifyParams?: Record<string, unknown>;
}

export interface TieredChromaWrite {
  collection: string;
  document: string;
  id?: string;
  metadata?: Record<string, unknown>;
}

export interface TieredWriteInput {
  tier: WriteTier;
  /** Stable canonical id shared across all stores (becomes Mongo _id). */
  id: string;
  mongoCollection: string;
  mongoDoc: Record<string, unknown>;
  mongoDatabase?: string;
  neo4j?: TieredNeo4jWrite;
  chroma?: TieredChromaWrite;
}

export interface LegResult {
  ok: boolean;
  /** Projection deferred to the durable retry queue (knowledge/operational). */
  queued?: boolean;
  outboxId?: string;
  counters?: Record<string, number>;
  verified?: boolean;
  error?: string;
}

export interface TieredWriteResult {
  tier: WriteTier;
  id: string;
  mongo: { ok: boolean; verified: boolean };
  neo4j?: LegResult;
  chroma?: LegResult;
}

/** A graph_critical write whose Mongo leg was rolled back after Neo4j failed. */
export class GraphCriticalWriteError extends Error {
  constructor(
    public readonly id: string,
    public readonly reason: string,
  ) {
    super(`[tiered:graph_critical] ${id} rolled back — ${reason}`);
    this.name = 'GraphCriticalWriteError';
  }
}

/**
 * Rollback failed too — a TRUE half-write that needs manual repair. Distinct on
 * purpose so a monitor/caller can tell "safely rolled back" from "orphaned row
 * still in Mongo." Never swallowed, never logged as success.
 */
export class HalfWriteError extends Error {
  constructor(
    public readonly id: string,
    public readonly collection: string,
    public readonly detail: string,
  ) {
    super(
      `[tiered][CRITICAL] half-write: ${collection}/${id} committed to Mongo but ` +
        `its required graph leg failed AND rollback failed — manual repair needed. ${detail}`,
    );
    this.name = 'HalfWriteError';
  }
}

function database(input: TieredWriteInput): string {
  return input.mongoDatabase ?? MONGO_DB;
}

/** Read the just-inserted Mongo doc back by _id. True iff it is present. */
async function verifyMongoLanded(db: string, collection: string, id: string): Promise<boolean> {
  const data = await persistenceCall<{ count?: number; documents?: unknown[] }>('mongodb', 'query', {
    database: db,
    collection,
    filter: { _id: id },
    limit: 1,
  });
  return (data.documents?.length ?? data.count ?? 0) > 0;
}

/** Compensating delete of a Mongo doc by _id. Throws HalfWriteError if it can't. */
async function rollbackMongo(db: string, collection: string, id: string): Promise<void> {
  try {
    const data = await persistenceCall<{ deletedCount?: number }>('mongodb', 'delete', {
      database: db,
      collection,
      filter: { _id: id },
    });
    if ((data.deletedCount ?? 0) < 1) {
      throw new HalfWriteError(id, collection, 'compensating delete removed 0 rows');
    }
  } catch (err) {
    if (err instanceof HalfWriteError) throw err;
    throw new HalfWriteError(id, collection, err instanceof Error ? err.message : String(err));
  }
}

/** Run the Neo4j leg and, if a verify query is given, confirm n>=1. */
async function runNeo4j(
  write: TieredNeo4jWrite,
  id: string,
): Promise<{ counters?: Record<string, number>; verified: boolean }> {
  const data = await persistenceCall<{
    records?: Array<Record<string, unknown>>;
    summary?: { counters?: Record<string, number> };
  }>('neo4j', 'cypher', {
    query: write.cypher,
    params: { id, ...(write.params ?? {}) },
  });
  const counters = data.summary?.counters;
  if (!write.verifyCypher) return { counters, verified: false };
  const check = await persistenceCall<{ records?: Array<Record<string, unknown>> }>('neo4j', 'cypher', {
    query: write.verifyCypher,
    params: { id, ...(write.verifyParams ?? {}) },
  });
  const n = extractCount(check);
  if (n < 1) throw new Error(`graph read-back returned ${n} (<1) — required node/edge not present`);
  return { counters, verified: true };
}

function toNeo4jPayload(write: TieredNeo4jWrite): Neo4jProjectionPayload {
  return {
    cypher: write.cypher,
    params: write.params,
    verifyCypher: write.verifyCypher,
    verifyParams: write.verifyParams,
  };
}

function toChromaPayload(write: TieredChromaWrite): ChromaProjectionPayload {
  return { collection: write.collection, id: write.id, document: write.document, metadata: write.metadata };
}

/**
 * Tiered write. See module header for tier semantics. Returns a per-leg result;
 * for graph_critical a failed graph leg throws (after rollback) rather than
 * returning, because the record is not valid without its edge.
 */
export async function tieredWrite(input: TieredWriteInput): Promise<TieredWriteResult> {
  const db = database(input);

  if (input.tier === 'graph_critical' && !input.neo4j) {
    throw new Error(`[tiered] graph_critical write ${input.id} requires a neo4j leg.`);
  }
  if (input.tier === 'graph_critical' && input.neo4j && !input.neo4j.verifyCypher) {
    throw new Error(
      `[tiered] graph_critical write ${input.id} requires neo4j.verifyCypher ` +
        `(a RETURN count(...) AS n read-back). Tier 1 must be verifiable.`,
    );
  }

  // Guard the Chroma collection up front (keeps the #147 protection) for the
  // atomic path. For knowledge/operational a missing collection is tolerated:
  // the projection is queued and lands once the collection exists.
  if (input.chroma && input.tier === 'graph_critical') {
    await assertChromaCollectionExists(input.chroma.collection);
  }

  // 1. Mongo insert — always, first.
  await persistenceCall('mongodb', 'insert', {
    database: db,
    collection: input.mongoCollection,
    documents: [{ _id: input.id, ...input.mongoDoc }],
  });

  // 2. Read-back verify the Mongo commit (all tiers).
  const mongoVerified = await verifyMongoLanded(db, input.mongoCollection, input.id);
  if (!mongoVerified) {
    // Nothing else has run; surface immediately.
    throw new Error(`[tiered] Mongo read-back failed for ${input.mongoCollection}/${input.id}.`);
  }

  const result: TieredWriteResult = {
    tier: input.tier,
    id: input.id,
    mongo: { ok: true, verified: true },
  };

  // 3. Graph + search legs, by tier.
  if (input.tier === 'graph_critical') {
    // Mongo + Neo4j atomic-or-rollback.
    try {
      const neo = await runNeo4j(input.neo4j!, input.id);
      result.neo4j = { ok: true, counters: neo.counters, verified: neo.verified };
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      await rollbackMongo(db, input.mongoCollection, input.id); // throws HalfWriteError if it can't
      throw new GraphCriticalWriteError(input.id, reason);
    }
    // Chroma is NOT part of the Tier-1 atomic unit; if present, treat it as a
    // durable-retry projection (rare for Tier-1 records).
    if (input.chroma) {
      result.chroma = await projectChromaDurable(input, 'knowledge');
    }
    return result;
  }

  // knowledge / operational: Mongo commit already = success. Projections are
  // mandatory-but-deferred; never throw, never block.
  const projTier = input.tier === 'knowledge' ? 'knowledge' : 'operational';

  if (input.neo4j) {
    result.neo4j = await projectNeo4jDurable(input, projTier);
  }
  if (input.chroma) {
    result.chroma = await projectChromaDurable(input, projTier);
  }
  return result;
}

/** Try the Neo4j projection inline; on any failure, enqueue for durable retry. */
async function projectNeo4jDurable(
  input: TieredWriteInput,
  tier: 'knowledge' | 'operational',
): Promise<LegResult> {
  try {
    const neo = await runNeo4j(input.neo4j!, input.id);
    return { ok: true, counters: neo.counters, verified: neo.verified };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const outboxId = await enqueueProjection({
      tier,
      target: 'neo4j',
      entityId: input.id,
      mongoCollection: input.mongoCollection,
      payload: toNeo4jPayload(input.neo4j!),
      lastError: msg,
    });
    return { ok: false, queued: true, outboxId, error: msg };
  }
}

/** Try the Chroma projection inline; on any failure, enqueue for durable retry. */
async function projectChromaDurable(
  input: TieredWriteInput,
  tier: 'knowledge' | 'operational',
): Promise<LegResult> {
  const chroma = input.chroma!;
  try {
    await assertChromaCollectionExists(chroma.collection);
    await persistenceCall('chromadb', 'add', {
      collection: chroma.collection,
      ids: [chroma.id ?? input.id],
      documents: [chroma.document],
      metadatas: [chroma.metadata ?? {}],
    });
    return { ok: true };
  } catch (err) {
    // A missing collection is still queued: it lands once the collection is
    // created/registered, rather than being lost.
    const msg =
      err instanceof ChromaCollectionMissingError
        ? `collection missing: ${err.collection}`
        : err instanceof Error
          ? err.message
          : String(err);
    const outboxId = await enqueueProjection({
      tier,
      target: 'chroma',
      entityId: input.id,
      mongoCollection: input.mongoCollection,
      payload: toChromaPayload(chroma),
      lastError: msg,
    });
    return { ok: false, queued: true, outboxId, error: msg };
  }
}

/** Ergonomic wrappers — callers in §13 items 2/3/5 read better with these. */
export function writeGraphCritical(
  input: Omit<TieredWriteInput, 'tier'>,
): Promise<TieredWriteResult> {
  return tieredWrite({ ...input, tier: 'graph_critical' });
}
export function writeKnowledge(input: Omit<TieredWriteInput, 'tier'>): Promise<TieredWriteResult> {
  return tieredWrite({ ...input, tier: 'knowledge' });
}
export function writeOperational(input: Omit<TieredWriteInput, 'tier'>): Promise<TieredWriteResult> {
  return tieredWrite({ ...input, tier: 'operational' });
}
