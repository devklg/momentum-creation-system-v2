/**
 * Webinar event domain (Chat #114 dashboard port).
 *
 * Architecture:
 *   - Mongo `webinar_events` stores one document per scheduled event.
 *   - The dashboard reads the next upcoming event (scheduledFor > now,
 *     status = 'upcoming') and renders the countdown + reservation form.
 *   - Seeding is operationally separate: an /admin action or a cadence
 *     cron creates events. This module does not seed; it only reads.
 *
 * Cadence still open per locked-spec Part 5. Kevin's interim posture:
 *   manual seeding from /admin until cadence is decided.
 */

import { persistenceCall } from '../services/persistence/dispatch.js';
import type { McsWebinarEvent } from '@momentum/shared';

const MONGO_DB = 'momentum';
const MONGO_COLLECTION = 'tmag_prospect_webinar_events';

/**
 * Return the next upcoming event (earliest scheduledFor still in the
 * future), or null if no upcoming event is seeded. The dashboard
 * gracefully degrades to a static "check back soon" tile in the null
 * case rather than rendering a broken countdown.
 */
export async function findNextUpcomingEvent(): Promise<McsWebinarEvent | null> {
  const now = new Date().toISOString();
  const result = await persistenceCall<{ documents: McsWebinarEvent[] }>(
    'mongodb',
    'query',
    {
      database: MONGO_DB,
      collection: MONGO_COLLECTION,
      filter: { status: 'upcoming', scheduledFor: { $gt: now } },
      sort: { scheduledFor: 1 },
      limit: 1,
    },
  );
  return result.documents[0] ?? null;
}

/**
 * Look up a webinar event by id. Returns null if the event does not
 * exist or has been cancelled. Used by the reservation route to
 * validate the prospect is reserving against a real upcoming event.
 */
export async function findEventById(eventId: string): Promise<McsWebinarEvent | null> {
  const result = await persistenceCall<{ documents: McsWebinarEvent[] }>(
    'mongodb',
    'query',
    {
      database: MONGO_DB,
      collection: MONGO_COLLECTION,
      filter: { eventId },
      limit: 1,
    },
  );
  return result.documents[0] ?? null;
}
