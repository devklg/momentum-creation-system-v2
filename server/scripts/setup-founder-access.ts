/**
 * Founder access setup — Kevin only.
 *
 * Two things stand between the founder and the .team app:
 *   1. passwordHash is null on TMBA-FOUNDER-KEVIN (seed-founders.ts leaves it
 *      null), so POST /api/auth/login fails — argon2.verify throws on a null
 *      hash and the catch returns a 401.
 *   2. There is no michael_schedules row for the founder, so the
 *      requireMichaelComplete gate (which reads isInterviewComplete ->
 *      michael_schedules.status === 'completed') 403s every protected route.
 *
 * This script fixes BOTH for TMBA-FOUNDER-KEVIN only (Paul is untouched):
 *   - Sets a real argon2id passwordHash from the FOUNDER_PASSWORD env var,
 *     hashed exactly the way registerBA() does. The plaintext is read from the
 *     environment, never written to disk and never logged.
 *   - Seeds (or flips to) a michael_schedules row with status 'completed' and
 *     seededForAccess:true. This is an HONEST seed: it opens the gate for build
 *     work and is explicitly flagged as NOT a real Michael interview, so when
 *     Kevin does the real interview later the genuine record simply supersedes
 *     it.
 *
 * Idempotent — safe to re-run. Re-running with a new FOUNDER_PASSWORD rotates
 * the password.
 *
 * Usage (PowerShell):
 *   $env:FOUNDER_PASSWORD = "your-password-here"
 *   pnpm --filter @momentum/server setup:founder-access
 *   Remove-Item Env:\FOUNDER_PASSWORD   # optional: clear it from the shell
 *
 * Respects the gateway-bug notes in services/tripleStack.ts:
 *   - Mongo `update` does NOT honor upsert -> branch on existence (insert vs update).
 *   - Mongo query param is `filter`, not `query`.
 *   - Chroma add() does not auto-create collections (mcs_michael_schedules is
 *     created at boot / by initMichaelSchedule; existence handled by branch).
 */

import argon2 from 'argon2';
import { gatewayCall } from '../src/services/gateway.js';
import { tripleStackWrite } from '../src/services/tripleStack.js';

const FOUNDER_BA_ID = 'TMBA-FOUNDER-KEVIN';
const SCHEDULE_ID = `MS-${FOUNDER_BA_ID}`;

interface BARow {
  baId: string;
  firstName?: string;
  lastName?: string;
  passwordHash?: string | null;
  timezone?: string | null;
}

interface MichaelRow {
  _id: string;
  baId: string;
  status: string;
}

async function setFounderPassword(): Promise<void> {
  const plain = process.env.FOUNDER_PASSWORD;
  if (!plain || plain.length < 8) {
    throw new Error(
      'FOUNDER_PASSWORD env var is missing or shorter than 8 chars. ' +
        'Set it before running:  $env:FOUNDER_PASSWORD = "your-password"',
    );
  }

  // Confirm the founder record exists before we try to update it.
  const found = await gatewayCall<{ documents: BARow[]; count: number }>(
    'mongodb',
    'query',
    {
      database: 'momentum',
      collection: 'brand_ambassadors',
      filter: { baId: FOUNDER_BA_ID },
      limit: 1,
    },
  );
  const ba = found.documents[0];
  if (!ba) {
    throw new Error(
      `No brand_ambassadors record for ${FOUNDER_BA_ID}. ` +
        'Run `pnpm --filter @momentum/server seed:founders` first.',
    );
  }

  // Hash identically to registerBA().
  const passwordHash = await argon2.hash(plain, { type: argon2.argon2id });

  await gatewayCall('mongodb', 'update', {
    database: 'momentum',
    collection: 'brand_ambassadors',
    filter: { baId: FOUNDER_BA_ID },
    update: { $set: { passwordHash } },
  });

  const had = ba.passwordHash ? 'rotated existing' : 'set (was null)';
  console.log(
    `[founder-access] password ${had} for ${FOUNDER_BA_ID} ` +
      `(${ba.firstName ?? '?'} ${ba.lastName ?? ''}). Hash written to Mongo.`,
  );
  // Note: the password hash lives only in Mongo (the auth source of truth).
  // Neo4j/Chroma never store credentials, so this step is intentionally
  // Mongo-only — not a triple-stack write.
}

async function seedCompletedMichael(): Promise<void> {
  const nowIso = new Date().toISOString();

  const existing = await gatewayCall<{ documents: MichaelRow[]; count: number }>(
    'mongodb',
    'query',
    {
      database: 'momentum',
      collection: 'michael_schedules',
      filter: { baId: FOUNDER_BA_ID },
      limit: 1,
    },
  );

  if (existing.documents.length > 0) {
    const row = existing.documents[0]!;
    if (row.status === 'completed') {
      console.log(
        `[founder-access] michael_schedules row ${row._id} already completed — skip.`,
      );
      return;
    }
    // Flip the existing row to completed (Mongo update + Neo4j mirror).
    await gatewayCall('mongodb', 'update', {
      database: 'momentum',
      collection: 'michael_schedules',
      filter: { _id: row._id },
      update: {
        $set: {
          status: 'completed',
          completedAt: nowIso,
          seededForAccess: true,
          seedNote:
            'Build-access seed, NOT a real Michael interview. Founder will do the real interview later; that record supersedes this.',
        },
      },
    });
    await gatewayCall('neo4j', 'cypher', {
      query:
        "MATCH (m:MichaelSchedule {scheduleId: $id}) " +
        "SET m.status = 'completed', m.completedAt = $completedAt, m.seededForAccess = true",
      params: { id: row._id, completedAt: nowIso },
    });
    console.log(
      `[founder-access] michael_schedules row ${row._id} flipped ` +
        `${row.status} -> completed (seededForAccess).`,
    );
    return;
  }

  // No row — create one, completed, triple-stack. Mirrors initMichaelSchedule's
  // shape but pre-completed and flagged as an access seed.
  await tripleStackWrite({
    id: SCHEDULE_ID,
    mongoCollection: 'michael_schedules',
    mongoDoc: {
      baId: FOUNDER_BA_ID,
      status: 'completed',
      slotStartUtc: null,
      slotEndUtc: null,
      timezone: 'America/Los_Angeles',
      rescheduleCount: 0,
      signupAt: nowIso,
      scheduledAt: null,
      startedAt: null,
      completedAt: nowIso,
      callSid: null,
      seededForAccess: true,
      seedNote:
        'Build-access seed, NOT a real Michael interview. Founder will do the real interview later; that record supersedes this.',
    },
    neo4j: {
      cypher:
        'MERGE (b:BA {baId: $baId}) ' +
        'MERGE (m:MichaelSchedule {scheduleId: $id}) ' +
        "SET m.status = 'completed', m.completedAt = $completedAt, " +
        'm.signupAt = $signupAt, m.timezone = $timezone, m.seededForAccess = true ' +
        'MERGE (b)-[:HAS_MICHAEL_SCHEDULE]->(m)',
      params: {
        baId: FOUNDER_BA_ID,
        completedAt: nowIso,
        signupAt: nowIso,
        timezone: 'America/Los_Angeles',
      },
    },
    chroma: {
      collection: 'mcs_michael_schedules',
      document: `Michael schedule for founder ${FOUNDER_BA_ID} seeded COMPLETED for build access at ${nowIso}. Not a real interview — flagged seededForAccess.`,
      metadata: {
        scheduleId: SCHEDULE_ID,
        baId: FOUNDER_BA_ID,
        status: 'completed',
        kind: 'michael_schedule',
        seededForAccess: true,
      },
    },
  });

  console.log(
    `[founder-access] michael_schedules row ${SCHEDULE_ID} created (completed, seededForAccess). Gate will open.`,
  );
}

async function main(): Promise<void> {
  console.log(`[founder-access] begin — target ${FOUNDER_BA_ID} (Kevin only; Paul untouched)`);
  await setFounderPassword();
  await seedCompletedMichael();
  console.log('[founder-access] done. Log in at .team with baId TMBA-FOUNDER-KEVIN + your password.');
}

main().catch((err) => {
  console.error('[founder-access] failed:', err instanceof Error ? err.message : err);
  process.exit(1);
});
