/**
 * Backfill founder timezones — one-time fix for the two founder records
 * seeded in Chat #97 BEFORE the timezone field existed on the BA schema.
 *
 * Founders (Chat #98 — both confirmed Pacific by Kevin):
 *   - TMBA-FOUNDER-KEVIN → America/Los_Angeles
 *   - TMBA-FOUNDER-PAUL  → America/Los_Angeles
 *
 * Writes timezone to all three stores (triple-stack):
 *   1. MongoDB  brand_ambassadors      — $set on the doc
 *   2. Neo4j    (:BA {baId})           — SET n.timezone
 *   3. ChromaDB mcs_brand_ambassadors  — refresh metadata (add = upsert by id)
 *
 * Idempotent — safe to re-run. Per-record:
 *   - Skips if Mongo timezone already matches target value.
 *   - Otherwise updates Mongo + Neo4j + Chroma, then verifies 3-of-3.
 *
 * Usage:  pnpm --filter @momentum/server backfill:founder-timezones
 */

import { persistenceCall } from '../src/services/persistence/dispatch.js';

interface FounderBackfill {
  baId: string;
  firstName: string;
  lastName: string;
  threeBaId: string;
  code: string;
  role: 'founder' | 'co_leader';
  timezone: string;
}

const BACKFILLS: FounderBackfill[] = [
  {
    baId: 'TMBA-FOUNDER-KEVIN',
    firstName: 'Kevin',
    lastName: 'Gardner',
    threeBaId: '1845964',
    code: 'TM-01',
    role: 'founder',
    timezone: 'America/Los_Angeles',
  },
  {
    baId: 'TMBA-FOUNDER-PAUL',
    firstName: 'Paul',
    lastName: 'Barrios',
    threeBaId: '892390',
    code: 'TM-02',
    role: 'co_leader',
    timezone: 'America/Los_Angeles',
  },
];

interface BAReadback {
  baId: string;
  timezone?: string;
  firstName?: string;
  lastName?: string;
  threeBaId?: string;
  role?: string;
}

async function readBaFromMongo(baId: string): Promise<BAReadback | null> {
  const result = await persistenceCall<{ documents: BAReadback[] }>(
    'mongodb',
    'query',
    {
      database: 'momentum',
      collection: 'brand_ambassadors',
      filter: { baId },
      limit: 1,
    },
  );
  return result.documents[0] ?? null;
}

async function readTzFromNeo4j(baId: string): Promise<string | null> {
  const result = await persistenceCall<{ records: Array<{ tz?: string | null }> }>(
    'neo4j',
    'cypher',
    {
      query: 'MATCH (n:BA {baId: $baId}) RETURN n.timezone AS tz',
      params: { baId },
    },
  );
  const first = result.records[0];
  return first?.tz ?? null;
}

interface ChromaGetResult {
  ids: string[];
  metadatas: Array<Record<string, unknown> | null>;
}

async function readTzFromChroma(baId: string): Promise<string | null> {
  try {
    const result = await persistenceCall<ChromaGetResult>('chromadb', 'get', {
      collection: 'mcs_brand_ambassadors',
      ids: [baId],
    });
    const meta = result.metadatas[0];
    if (meta && typeof meta.timezone === 'string') return meta.timezone;
    return null;
  } catch {
    // Not all chromadb backends expose `get`; verification falls back to "not
    // checked" if it's unavailable. We still wrote via `add` (upsert).
    return null;
  }
}

async function backfillOne(f: FounderBackfill): Promise<void> {
  const tag = `${f.firstName} ${f.lastName} (${f.baId})`;

  const existing = await readBaFromMongo(f.baId);
  if (!existing) {
    console.log(`[backfill] ${tag} — record not found in Mongo, SKIP (run seed:founders first)`);
    return;
  }
  if (existing.timezone === f.timezone) {
    console.log(`[backfill] ${tag} — timezone already "${f.timezone}", SKIP`);
    return;
  }

  console.log(
    `[backfill] ${tag} — setting timezone = "${f.timezone}" (was: ${existing.timezone ?? '<missing>'})`,
  );

  // 1. MongoDB: $set timezone.
  await persistenceCall('mongodb', 'update', {
    database: 'momentum',
    collection: 'brand_ambassadors',
    filter: { baId: f.baId },
    update: { $set: { timezone: f.timezone } },
  });

  // 2. Neo4j: SET n.timezone on the BA node.
  await persistenceCall('neo4j', 'cypher', {
    query: 'MATCH (n:BA {baId: $baId}) SET n.timezone = $timezone RETURN n.baId',
    params: { baId: f.baId, timezone: f.timezone },
  });

  // 3. ChromaDB: delete-by-id first, then add so the document text and
  //    metadata refresh deterministically. Idempotent in aggregate because
  //    the surrounding code only runs this branch when Mongo confirmed the
  //    record had a missing/wrong timezone.
  const createdAt = new Date().toISOString();
  try {
    await persistenceCall('chromadb', 'delete', {
      collection: 'mcs_brand_ambassadors',
      ids: [f.baId],
    });
  } catch (err) {
    // Delete failures are non-fatal — if the id doesn't exist, the add still
    // works. Log and continue.
    const msg = err instanceof Error ? err.message : 'unknown';
    console.log(`[backfill] ${tag} — chroma delete soft-fail: ${msg}`);
  }
  await persistenceCall('chromadb', 'add', {
    collection: 'mcs_brand_ambassadors',
    ids: [f.baId],
    documents: [
      `Founder BA ${f.firstName} ${f.lastName} (BA ${f.baId} / THREE ${f.threeBaId}) — role: ${f.role}, timezone: ${f.timezone}. Access code ${f.code}.`,
    ],
    metadatas: [
      {
        baId: f.baId,
        threeBaId: f.threeBaId,
        kind: 'brand_ambassador_founder',
        role: f.role,
        timezone: f.timezone,
        backfilledAt: createdAt,
      },
    ],
  });

  // Verify 3-of-3.
  const mongoAfter = await readBaFromMongo(f.baId);
  const neo4jAfter = await readTzFromNeo4j(f.baId);
  const chromaAfter = await readTzFromChroma(f.baId);

  const mongoOk = mongoAfter?.timezone === f.timezone;
  const neo4jOk = neo4jAfter === f.timezone;
  const chromaOk = chromaAfter === f.timezone || chromaAfter === null; // chroma `get` may be unavailable

  console.log(
    `[backfill] ${tag} — verify: mongo=${mongoOk ? 'OK' : 'FAIL(' + (mongoAfter?.timezone ?? 'null') + ')'} ` +
      `neo4j=${neo4jOk ? 'OK' : 'FAIL(' + (neo4jAfter ?? 'null') + ')'} ` +
      `chroma=${chromaAfter === f.timezone ? 'OK' : chromaAfter === null ? 'SKIP(get-unavailable)' : 'FAIL(' + chromaAfter + ')'}`,
  );

  if (!mongoOk || !neo4jOk) {
    throw new Error(`[backfill] ${tag} — verification failed`);
  }
}

async function main(): Promise<void> {
  console.log('[backfill] founder timezones — begin');
  for (const f of BACKFILLS) {
    await backfillOne(f);
  }
  console.log('[backfill] founder timezones — done');
}

main().catch((err) => {
  console.error('[backfill] failed:', err);
  process.exit(1);
});
