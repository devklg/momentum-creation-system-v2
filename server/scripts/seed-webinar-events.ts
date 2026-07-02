/**
 * Seed Team Magnificent webinar events (Chat #116).
 *
 * Cadence (locked Chat #116): Mondays and Thursdays at 5:00pm Pacific
 * wall-clock time, 60 minutes, hosted by Kevin + Paul, on one recurring
 * Zoom registration link (WEBINAR_REGISTER_URL). Seeds a rolling 8-week
 * horizon of upcoming slots.
 *
 * Idempotent — safe to re-run. Each slot's eventId is derived from its
 * Pacific calendar date (see webinarCadence.ts), so a slot that already
 * exists in `webinar_events` is skipped rather than duplicated. This is
 * how the rolling window is maintained: re-run periodically and only the
 * newly-in-horizon slots get written. We query-then-insert so idempotency is
 * explicit.
 *
 * Triple-stack per write (Rule 1):
 *   - Mongo `webinar_events` — the document the dashboard reads via
 *     findNextUpcomingEvent().
 *   - Neo4j (:WebinarEvent {eventId}) — MERGE, idempotent on re-run.
 *   - ChromaDB `mcs_webinar_events` — semantic event log. Collection was
 *     created in Chat #116 (CK-04: collection must exist before add()).
 *
 * The ChromaDB collection is bootstrapped defensively at the top of this
 * script too (create-if-missing) so a fresh environment can run the
 * seeder without a manual create step.
 *
 * Usage:  pnpm --filter @momentum/server seed:webinar-events
 */

import { persistenceCall } from '../src/services/persistence/dispatch.js';
import { tripleStackWrite } from '../src/services/tripleStack.js';
import { env } from '../src/env.js';
import {
  generateUpcomingSlots,
  DEFAULT_HORIZON_WEEKS,
  WEBINAR_DURATION_MINUTES,
} from '../src/domain/webinarCadence.js';

const MONGO_DB = 'momentum';
const MONGO_COLLECTION = 'webinar_events';
const CHROMA_COLLECTION = 'mcs_webinar_events';
const HOSTS = ['Kevin Gardner', 'Paul Barrios'];

/** Ensure the ChromaDB collection exists before any add(). */
async function ensureChromaCollection(): Promise<void> {
  try {
    await persistenceCall('chromadb', 'create_collection', {
      name: CHROMA_COLLECTION,
      metadata: {
        chat_number: 116,
        project: 'momentum_creation_system_v1',
        description:
          'Team Magnificent webinar events — Mon/Thu 5pm Pacific recurring sessions',
      },
    });
    // eslint-disable-next-line no-console
    console.log(`[seed] chroma collection '${CHROMA_COLLECTION}' ready (created)`);
  } catch {
    // Already exists — create throws on duplicate. Safe to continue.
    // eslint-disable-next-line no-console
    console.log(`[seed] chroma collection '${CHROMA_COLLECTION}' ready (exists)`);
  }
}

/** Does an event with this id already exist in Mongo? (idempotency check) */
async function eventExists(eventId: string): Promise<boolean> {
  const result = await persistenceCall<{ documents: Array<{ eventId: string }> }>(
    'mongodb',
    'query',
    {
      database: MONGO_DB,
      collection: MONGO_COLLECTION,
      filter: { eventId },
      limit: 1,
    },
  );
  return result.documents.length > 0;
}

async function main(): Promise<void> {
  const registerUrl = env.WEBINAR_REGISTER_URL;
  if (!registerUrl) {
    // eslint-disable-next-line no-console
    console.warn(
      '[seed] WARNING: WEBINAR_REGISTER_URL is empty. Events will be seeded ' +
        'with zoomUrl=null. Set it in .env and re-run to populate the link.',
    );
  }

  await ensureChromaCollection();

  const now = new Date();
  const slots = generateUpcomingSlots(now, DEFAULT_HORIZON_WEEKS);

  // eslint-disable-next-line no-console
  console.log(
    `[seed] generated ${slots.length} Mon/Thu 5pm-Pacific slots over ` +
      `${DEFAULT_HORIZON_WEEKS} weeks from ${now.toISOString()}`,
  );

  let created = 0;
  let skipped = 0;
  const nowIso = new Date().toISOString();

  for (const slot of slots) {
    if (await eventExists(slot.eventId)) {
      skipped++;
      // eslint-disable-next-line no-console
      console.log(`[seed]   skip  ${slot.eventId} (${slot.scheduledFor}) — exists`);
      continue;
    }

    const mongoDoc = {
      eventId: slot.eventId,
      scheduledFor: slot.scheduledFor,
      hosts: HOSTS,
      zoomUrl: registerUrl || null,
      durationMinutes: WEBINAR_DURATION_MINUTES,
      status: 'upcoming' as const,
      createdAt: nowIso,
    };

    const chromaDoc =
      `Team Magnificent live webinar on ${slot.scheduledFor} ` +
      `(Mon/Thu 5pm Pacific, ${WEBINAR_DURATION_MINUTES} min), ` +
      `hosted by ${HOSTS.join(' and ')}.`;

    await tripleStackWrite({
      id: slot.eventId,
      mongoCollection: MONGO_COLLECTION,
      mongoDoc,
      neo4j: {
        cypher:
          'MERGE (e:WebinarEvent {eventId: $id}) ' +
          'SET e.scheduledFor = $scheduledFor, ' +
          '    e.status = $status, ' +
          '    e.durationMinutes = $durationMinutes, ' +
          '    e.hosts = $hosts',
        params: {
          scheduledFor: slot.scheduledFor,
          status: 'upcoming',
          durationMinutes: WEBINAR_DURATION_MINUTES,
          hosts: HOSTS,
        },
      },
      chroma: {
        collection: CHROMA_COLLECTION,
        document: chromaDoc,
        metadata: {
          kind: 'webinar_event',
          eventId: slot.eventId,
          scheduledFor: slot.scheduledFor,
          status: 'upcoming',
        },
      },
    });

    created++;
    // eslint-disable-next-line no-console
    console.log(`[seed]   write ${slot.eventId} (${slot.scheduledFor}) — triple-stack ok`);
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
