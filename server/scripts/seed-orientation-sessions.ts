/**
 * Seed Team Magnificent group orientation sessions (Chat #147 — wireframe §3.6).
 *
 * Orientation runs as scheduled GROUP sessions of up to 10 BAs each, hosted by
 * the founders. This seeder REUSES the webinar cadence generator
 * (domain/webinarCadence.ts — Mon/Thu 5pm Pacific, DST-correct) to lay down a
 * rolling horizon of upcoming sessions, exactly as the §2.6 webinar seeder
 * does. Founders can also add ad-hoc sessions from /admin; this is the bulk
 * convenience path.
 *
 * Idempotent — safe to re-run. A slot whose scheduledFor already has a session
 * is skipped. We query-then-create so idempotency is explicit.
 *
 * Triple-stack per write via createOrientationSession() (Mongo + Neo4j +
 * Chroma `mcs_orientation`, collection bootstrapped lazily in the domain).
 *
 * Usage:  pnpm --filter @momentum/server seed:orientation-sessions
 */

import { persistenceCall } from '../src/services/persistence/dispatch.js';
import { connectMongo } from '../src/services/persistence/mongo/connection.js';
import {
  createOrientationSession,
  ensureOrientationCollection,
  ORIENTATION_DEFAULT_HOSTS,
} from '../src/domain/orientationSession.js';
import {
  generateUpcomingSlots,
  DEFAULT_HORIZON_WEEKS,
} from '../src/domain/webinarCadence.js';
import { ORIENTATION_SESSION_CAPACITY } from '@momentum/shared';

const MONGO_DB = 'momentum';
const SESSIONS_COLLECTION = 'orientation_sessions';

/** Does a session already exist at this exact slot time? (idempotency check) */
async function sessionExistsAt(scheduledFor: string): Promise<boolean> {
  const result = await persistenceCall<{ documents: Array<{ scheduledFor: string }> }>(
    'mongodb',
    'query',
    {
      database: MONGO_DB,
      collection: SESSIONS_COLLECTION,
      filter: { scheduledFor },
      limit: 1,
    },
  );
  return (result.documents ?? []).length > 0;
}

async function main(): Promise<void> {
  await connectMongo();
  await ensureOrientationCollection();

  const now = new Date();
  const slots = generateUpcomingSlots(now, DEFAULT_HORIZON_WEEKS);

  // eslint-disable-next-line no-console
  console.log(
    `[seed] generated ${slots.length} Mon/Thu 5pm-Pacific orientation slots over ` +
      `${DEFAULT_HORIZON_WEEKS} weeks from ${now.toISOString()} ` +
      `(cap ${ORIENTATION_SESSION_CAPACITY}, hosts ${ORIENTATION_DEFAULT_HOSTS.join(' & ')})`,
  );

  let created = 0;
  let skipped = 0;

  for (const slot of slots) {
    if (await sessionExistsAt(slot.scheduledFor)) {
      skipped++;
      // eslint-disable-next-line no-console
      console.log(`[seed]   skip  ${slot.scheduledFor} — session exists`);
      continue;
    }
    const session = await createOrientationSession({ scheduledFor: slot.scheduledFor });
    created++;
    // eslint-disable-next-line no-console
    console.log(`[seed]   write ${session.sessionId} (${slot.scheduledFor}) — triple-stack ok`);
  }

  // eslint-disable-next-line no-console
  console.log(`[seed] done. created=${created} skipped=${skipped} total=${slots.length}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error('[seed] FAILED:', err);
    process.exit(1);
  });
