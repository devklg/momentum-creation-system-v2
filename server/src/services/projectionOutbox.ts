/**
 * Projection outbox — the durable retry queue behind the tiered writer
 * (docs/app-data-model-contract.md §2.4 + §13 item 1; FINDINGS "four systemic
 * fixes" #1).
 *
 * For Tier-2 (knowledge) and Tier-3 (operational) writes, the MongoDB commit is
 * the success boundary; the Neo4j / ChromaDB projections are MANDATORY but
 * allowed to lag. When an inline projection attempt fails, the write is NOT
 * lost and the caller is NOT blocked — the projection is enqueued here and
 * replayed by drainProjectionOutbox() until it lands, or is exhausted (then
 * dead-lettered with a loud ALERT, never silently dropped).
 *
 * This is the machinery the contract §2.0 found missing: "the missing machinery
 * is rollback (for membership) and durable retry (for knowledge)." Rollback for
 * Tier-1 lives in tieredWrite.ts; durable retry for Tier-2/3 lives here.
 *
 * Storage: one MongoDB collection `projection_outbox` in the app database.
 * The drain uses only insert / query / delete PERSISTENCE actions (each verified
 * against the live PERSISTENCE this session), so a retry is delete-then-insert
 * rather than an in-place update — fully idempotent and built only on primitives
 * we trust. An update-based version is a later micro-optimization, not needed.
 *
 * Suggested indexes (add via ensureIndexes(), §9):
 *   { status: 1, nextAttemptAt: 1 }   // due-row scan
 *   { entityId: 1 }                    // trace a record's pending projections
 */

import { persistenceCall } from './persistence/dispatch.js';
import { assertChromaCollectionExists } from './chromaCollections.js';

const OUTBOX_DB = 'momentum';
const OUTBOX_COLLECTION = 'tmag_projection_outbox';

/** Max replay attempts before a projection is dead-lettered + alerted. */
const MAX_ATTEMPTS = 8;

/** Backoff (minutes) by attempt index; the last value repeats. */
const BACKOFF_MINUTES = [1, 2, 5, 15, 30, 60, 120, 360] as const;

export type ProjectionTarget = 'neo4j' | 'chroma';
/** knowledge writes drain first (high); operational drain after (normal). */
export type ProjectionPriority = 'high' | 'normal';
export type OutboxStatus = 'pending' | 'failed';
export type ProjectionTier = 'knowledge' | 'operational';

export interface Neo4jProjectionPayload {
  cypher: string;
  params?: Record<string, unknown>;
  /** Optional read-back: a `RETURN count(...) AS n` query that must yield n>=1. */
  verifyCypher?: string;
  verifyParams?: Record<string, unknown>;
}

export interface ChromaProjectionPayload {
  collection: string;
  document: string;
  metadata?: Record<string, unknown>;
}

export type ProjectionPayload = Neo4jProjectionPayload | ChromaProjectionPayload;

export interface EnqueueProjectionInput {
  tier: ProjectionTier;
  target: ProjectionTarget;
  /** The shared canonical id (= Mongo _id of the source record). */
  entityId: string;
  /** Source Mongo collection, for tracing only. */
  mongoCollection: string;
  payload: ProjectionPayload;
  priority?: ProjectionPriority;
  lastError?: string;
}

export interface OutboxRecord {
  _id: string;
  outboxId: string;
  tier: ProjectionTier;
  target: ProjectionTarget;
  entityId: string;
  mongoCollection: string;
  payload: ProjectionPayload;
  priority: ProjectionPriority;
  status: OutboxStatus;
  attempts: number;
  maxAttempts: number;
  nextAttemptAt: string; // ISO-8601 UTC
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DrainSummary {
  scanned: number;
  landed: number;
  reEnqueued: number;
  deadLettered: number;
}

function nowIso(): string {
  return new Date().toISOString();
}

function backoffFrom(attempt: number): string {
  const idx = Math.min(attempt, BACKOFF_MINUTES.length - 1);
  const minutes = BACKOFF_MINUTES[idx] ?? BACKOFF_MINUTES[BACKOFF_MINUTES.length - 1] ?? 360;
  return new Date(Date.now() + minutes * 60_000).toISOString();
}

function newOutboxId(): string {
  return `obx_${nowIso()}_${Math.random().toString(36).slice(2, 10)}`;
}

/** Read an `AS n` count out of a neo4j.cypher result (shape: data.records[0].n). */
export function extractCount(data: { records?: Array<Record<string, unknown>> }): number {
  const row = data.records?.[0];
  if (!row) return 0;
  const v = typeof row.n === 'number' ? row.n : Object.values(row).find((x) => typeof x === 'number');
  return typeof v === 'number' ? v : 0;
}

/**
 * Enqueue a failed / lagging projection for durable retry. Returns the outboxId.
 * The enqueue itself is the last line of defense — if THIS Mongo insert fails
 * the projection would be lost, so that error propagates to the caller.
 */
export async function enqueueProjection(input: EnqueueProjectionInput): Promise<string> {
  const ts = nowIso();
  const outboxId = newOutboxId();
  const record: OutboxRecord = {
    _id: outboxId,
    outboxId,
    tier: input.tier,
    target: input.target,
    entityId: input.entityId,
    mongoCollection: input.mongoCollection,
    payload: input.payload,
    priority: input.priority ?? (input.tier === 'knowledge' ? 'high' : 'normal'),
    status: 'pending',
    attempts: 0,
    maxAttempts: MAX_ATTEMPTS,
    nextAttemptAt: ts, // eligible immediately; the next drain picks it up
    lastError: input.lastError ?? null,
    createdAt: ts,
    updatedAt: ts,
  };
  await persistenceCall('mongodb', 'insert', {
    database: OUTBOX_DB,
    collection: OUTBOX_COLLECTION,
    documents: [record],
  });
  return outboxId;
}

/** Replay one projection against its target store. Throws on failure. */
async function replay(record: OutboxRecord): Promise<void> {
  if (record.target === 'neo4j') {
    const p = record.payload as Neo4jProjectionPayload;
    await persistenceCall('neo4j', 'cypher', {
      query: p.cypher,
      params: { id: record.entityId, ...(p.params ?? {}) },
    });
    if (p.verifyCypher) {
      const data = await persistenceCall<{ records?: Array<Record<string, unknown>> }>('neo4j', 'cypher', {
        query: p.verifyCypher,
        params: { id: record.entityId, ...(p.verifyParams ?? {}) },
      });
      const n = extractCount(data);
      if (n < 1) throw new Error(`neo4j projection verify returned ${n} (<1) for ${record.entityId}`);
    }
    return;
  }
  const c = record.payload as ChromaProjectionPayload;
  await assertChromaCollectionExists(c.collection);
  await persistenceCall('chromadb', 'add', {
    collection: c.collection,
    ids: [record.entityId],
    documents: [c.document],
    metadatas: [c.metadata ?? {}],
  });
}

/** Remove an outbox row by id (used after a successful replay). */
async function deleteRow(outboxId: string): Promise<void> {
  await persistenceCall('mongodb', 'delete', {
    database: OUTBOX_DB,
    collection: OUTBOX_COLLECTION,
    filter: { _id: outboxId },
  });
}

/**
 * Re-enqueue a row with an incremented attempt + backoff. Implemented as
 * delete-then-insert (same _id) so the drain stays on verified primitives.
 * At maxAttempts the row is dead-lettered: status flips to 'failed', it stops
 * being eligible, and a loud ALERT is logged for a monitor to pick up.
 * Returns true if dead-lettered, false if re-queued for another try.
 */
async function bumpOrDeadLetter(record: OutboxRecord, error: string): Promise<boolean> {
  const attempts = record.attempts + 1;
  const ts = nowIso();
  const dead = attempts >= record.maxAttempts;
  const next: OutboxRecord = {
    ...record,
    attempts,
    status: dead ? 'failed' : 'pending',
    nextAttemptAt: dead ? ts : backoffFrom(attempts),
    lastError: error,
    updatedAt: ts,
  };
  await deleteRow(record._id);
  await persistenceCall('mongodb', 'insert', {
    database: OUTBOX_DB,
    collection: OUTBOX_COLLECTION,
    documents: [next],
  });
  if (dead) {
    // eslint-disable-next-line no-console
    console.error(
      `[projection-outbox][ALERT] DEAD-LETTER ${record.target} projection for ` +
        `${record.mongoCollection}/${record.entityId} after ${attempts} attempts. ` +
        `last error: ${error}. Row kept as status:'failed' for inspection.`,
    );
  }
  return dead;
}

/**
 * Drain due projections. Intended to be called on a timer by the server (and
 * once at boot). Processes the highest-priority due rows first. Bounded by
 * `limit` so a backlog never monopolizes a tick.
 */
async function fetchDue(
  priority: ProjectionPriority,
  limit: number,
  now: string,
): Promise<OutboxRecord[]> {
  if (limit <= 0) return [];
  const data = await persistenceCall<{ documents?: OutboxRecord[] }>('mongodb', 'query', {
    database: OUTBOX_DB,
    collection: OUTBOX_COLLECTION,
    filter: { status: 'pending', priority, nextAttemptAt: { $lte: now } },
    limit,
  });
  return data.documents ?? [];
}

export async function drainProjectionOutbox(opts?: { limit?: number }): Promise<DrainSummary> {
  const limit = opts?.limit ?? 50;
  const now = nowIso();
  // High priority (knowledge) drains before normal (operational). Two bounded,
  // sort-free queries keep the drain on verified query params (filter + limit).
  const high = await fetchDue('high', limit, now);
  const normal = await fetchDue('normal', limit - high.length, now);
  const due = [...high, ...normal];
  const summary: DrainSummary = { scanned: due.length, landed: 0, reEnqueued: 0, deadLettered: 0 };

  for (const record of due) {
    try {
      await replay(record);
      await deleteRow(record._id);
      summary.landed += 1;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const dead = await bumpOrDeadLetter(record, msg);
      if (dead) summary.deadLettered += 1;
      else summary.reEnqueued += 1;
    }
  }
  return summary;
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// OUTBOX DRAIN WORKER
//
// drainProjectionOutbox() above is the engine; this is the scheduler that
// actually RUNS it. Without a scheduler the durable retry queue is never
// drained: failed Tier-2/3 Neo4j/Chroma projections enqueue rows that sit
// forever, Neo4j/Chroma silently drift from authoritative Mongo, and the
// dead-letter ALERT can never fire (nothing ever replays a row to exhaustion).
// (Phase 10 audit finding H1.)
//
// Mirrors the broadcastQueue worker shape: idempotent start, single in-flight
// tick, drain once at boot (so a backlog from a previous run lands promptly)
// then on a fixed interval. The first retry backoff is 1 minute, so a 30s tick
// catches due rows without busy-waiting. `drain` is injectable purely so the
// scheduler can be unit-tested without touching the PERSISTENCE.
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const DRAIN_INTERVAL_MS = 30_000;
const DRAIN_LIMIT = 50;

let outboxWorkerStarted = false;
let outboxTimer: NodeJS.Timeout | null = null;
let outboxTickInFlight = false;

export interface ProjectionOutboxWorkerOptions {
  intervalMs?: number;
  drainLimit?: number;
  /** Injectable for tests; defaults to the real drainProjectionOutbox. */
  drain?: (opts?: { limit?: number }) => Promise<DrainSummary>;
}

/**
 * Start the outbox drain loop. Idempotent and safe to call from app boot.
 */
export function startProjectionOutboxWorker(opts?: ProjectionOutboxWorkerOptions): void {
  if (outboxWorkerStarted) return;
  outboxWorkerStarted = true;

  const intervalMs = opts?.intervalMs ?? DRAIN_INTERVAL_MS;
  const limit = opts?.drainLimit ?? DRAIN_LIMIT;
  const drain = opts?.drain ?? drainProjectionOutbox;

  const runTick = async (): Promise<void> => {
    if (outboxTickInFlight) return;
    outboxTickInFlight = true;
    try {
      const summary = await drain({ limit });
      if (summary.landed > 0 || summary.deadLettered > 0) {
        // eslint-disable-next-line no-console
        console.log(
          `[projection-outbox] drain: scanned=${summary.scanned} landed=${summary.landed} ` +
            `reEnqueued=${summary.reEnqueued} deadLettered=${summary.deadLettered}`,
        );
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[projection-outbox] drain tick failed (continuing)', err);
    } finally {
      outboxTickInFlight = false;
    }
  };

  // Drain once at boot, then on the interval.
  void runTick();
  outboxTimer = setInterval(() => {
    void runTick();
  }, intervalMs);
  // eslint-disable-next-line no-console
  console.log(`[projection-outbox] worker started — interval=${intervalMs}ms, limit=${limit}`);
}

export function stopProjectionOutboxWorker(): void {
  if (outboxTimer) {
    clearInterval(outboxTimer);
    outboxTimer = null;
  }
  outboxWorkerStarted = false;
  outboxTickInFlight = false;
}
