import type {
  McsAdminEventCenterResponse,
  McsAdminEventCenterWebinarEvent,
  McsEventCenterResponse,
  McsEventCenterWebinarEvent,
  McsWebinarReservationRecord,
} from '@momentum/shared';
import { MCS_EVENT_CENTER_SCHEMA_VERSION } from '@momentum/shared';
import { persistenceCall } from '../services/persistence/dispatch.js';
import {
  getSessionAvailabilityForBA,
  listSessionsWithRosters,
} from './orientationSession.js';
import { listUpcomingWebinarEvents } from './webinarEvent.js';

const MONGO_DB = 'momentum';
const WEBINAR_RESERVATIONS_COLLECTION = 'tmag_prospect_webinar_reservations';

function projectWebinars(
  events: Awaited<ReturnType<typeof listUpcomingWebinarEvents>>,
): McsEventCenterWebinarEvent[] {
  return events.map((event) => ({
    ...event,
    audience: 'prospect',
    reservationMode: 'invitation_token_only',
  }));
}

async function webinarReservationCounts(
  eventIds: string[],
): Promise<Map<string, number>> {
  if (eventIds.length === 0) return new Map();
  const result = await persistenceCall<{ documents: McsWebinarReservationRecord[] }>(
    'mongodb',
    'query',
    {
      database: MONGO_DB,
      collection: WEBINAR_RESERVATIONS_COLLECTION,
      filter: { eventId: { $in: eventIds } },
      limit: 5000,
    },
  );
  const counts = new Map<string, number>();
  for (const reservation of result.documents ?? []) {
    counts.set(reservation.eventId, (counts.get(reservation.eventId) ?? 0) + 1);
  }
  return counts;
}

export async function getEventCenterForBA(
  tmagId: string,
): Promise<McsEventCenterResponse> {
  const [orientation, webinar] = await Promise.allSettled([
    getSessionAvailabilityForBA(tmagId),
    listUpcomingWebinarEvents({ horizonDays: 30, limit: 50 }),
  ]);

  return {
    ok: true,
    schemaVersion: MCS_EVENT_CENTER_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    sources: {
      orientation: orientation.status === 'fulfilled' ? 'available' : 'unavailable',
      webinar: webinar.status === 'fulfilled' ? 'available' : 'unavailable',
    },
    orientationSessions:
      orientation.status === 'fulfilled' ? orientation.value.sessions : [],
    myOrientationReservationSessionId:
      orientation.status === 'fulfilled'
        ? orientation.value.myReservationSessionId
        : null,
    webinarEvents:
      webinar.status === 'fulfilled' ? projectWebinars(webinar.value) : [],
  };
}

export async function getEventCenterForAdmin(): Promise<McsAdminEventCenterResponse> {
  const [orientation, webinar] = await Promise.allSettled([
    listSessionsWithRosters(),
    (async (): Promise<McsAdminEventCenterWebinarEvent[]> => {
      const events = await listUpcomingWebinarEvents({ horizonDays: 30, limit: 100 });
      const counts = await webinarReservationCounts(events.map((event) => event.eventId));
      return projectWebinars(events).map((event) => ({
        ...event,
        reservationCount: counts.get(event.eventId) ?? 0,
      }));
    })(),
  ]);

  return {
    ok: true,
    schemaVersion: MCS_EVENT_CENTER_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    sources: {
      orientation: orientation.status === 'fulfilled' ? 'available' : 'unavailable',
      webinar: webinar.status === 'fulfilled' ? 'available' : 'unavailable',
    },
    orientationSessions: orientation.status === 'fulfilled' ? orientation.value : [],
    webinarEvents: webinar.status === 'fulfilled' ? webinar.value : [],
  };
}
