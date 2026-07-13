import type {
  McsAdminEventCenterResponse,
  McsAdminEventCenterWebinarEvent,
  McsEventCenterResponse,
  McsEventCenterEvent,
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

function currentLifecycleFields(): Pick<
  McsEventCenterEvent,
  'reminders' | 'attendance' | 'followUp'
> {
  return {
    reminders: { owner: 'source_domain', status: 'not_configured', channels: [] },
    attendance: { state: 'not_recorded', recordedAt: null, inferred: false },
    followUp: { owner: 'human_crm', connection: 'not_connected', automated: false },
  };
}

function projectOrientationEvents(
  sessions: Array<{
    sessionId: string;
    scheduledFor: string;
    hosts: string[];
    durationMinutes: number;
    capacity: number;
    seatsTaken: number;
    seatsRemaining: number;
    reservedByMe?: boolean;
    status?: 'upcoming' | 'past' | 'cancelled';
  }>,
): McsEventCenterEvent[] {
  return sessions.map((session) => ({
    eventId: `orientation:${session.sessionId}`,
    sourceId: session.sessionId,
    eventType: 'new_member_orientation',
    visibility: {
      team: 'authenticated',
      admin: 'founder_admin',
      prospect: 'none',
    },
    scheduledFor: session.scheduledFor,
    hosts: session.hosts,
    durationMinutes: session.durationMinutes,
    status: session.status ?? 'upcoming',
    capacity: {
      mode: 'limited',
      limit: session.capacity,
      reserved: session.seatsTaken,
      remaining: session.seatsRemaining,
    },
    registration: {
      owner: 'orientation',
      mode: 'ba_self_service',
      state: session.reservedByMe
        ? 'reserved_by_me'
        : session.seatsRemaining <= 0
          ? 'full'
          : 'available',
    },
    ...currentLifecycleFields(),
  }));
}

function projectWebinarEvents(
  events: Awaited<ReturnType<typeof listUpcomingWebinarEvents>>,
  counts?: Map<string, number>,
): McsEventCenterEvent[] {
  return events.map((event) => ({
    eventId: `webinar:${event.eventId}`,
    sourceId: event.eventId,
    eventType: 'prospect_webinar',
    visibility: {
      team: 'authenticated',
      admin: 'founder_admin',
      prospect: 'invitation_token_only',
    },
    scheduledFor: event.scheduledFor,
    hosts: event.hosts,
    durationMinutes: event.durationMinutes,
    status: event.status,
    capacity: {
      mode: 'unlimited',
      limit: null,
      reserved: counts?.get(event.eventId) ?? null,
      remaining: null,
    },
    registration: {
      owner: 'prospect_webinar',
      mode: 'prospect_invitation_token',
      state: 'invitation_required',
    },
    ...currentLifecycleFields(),
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

  const orientationSessions =
    orientation.status === 'fulfilled' ? orientation.value.sessions : [];
  const webinarEvents = webinar.status === 'fulfilled' ? webinar.value : [];

  return {
    ok: true,
    schemaVersion: MCS_EVENT_CENTER_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    sources: {
      orientation: orientation.status === 'fulfilled' ? 'available' : 'unavailable',
      webinar: webinar.status === 'fulfilled' ? 'available' : 'unavailable',
    },
    events: [
      ...projectOrientationEvents(orientationSessions),
      ...projectWebinarEvents(webinarEvents),
    ].sort((a, b) => a.scheduledFor.localeCompare(b.scheduledFor)),
    orientationSessions,
    myOrientationReservationSessionId:
      orientation.status === 'fulfilled'
        ? orientation.value.myReservationSessionId
        : null,
    webinarEvents: projectWebinars(webinarEvents),
  };
}

export async function getEventCenterForAdmin(): Promise<McsAdminEventCenterResponse> {
  const [orientation, webinar] = await Promise.allSettled([
    listSessionsWithRosters(),
    (async (): Promise<{
      sourceEvents: Awaited<ReturnType<typeof listUpcomingWebinarEvents>>;
      projected: McsAdminEventCenterWebinarEvent[];
      counts: Map<string, number>;
    }> => {
      const events = await listUpcomingWebinarEvents({ horizonDays: 30, limit: 100 });
      const counts = await webinarReservationCounts(events.map((event) => event.eventId));
      return {
        sourceEvents: events,
        counts,
        projected: projectWebinars(events).map((event) => ({
          ...event,
          reservationCount: counts.get(event.eventId) ?? 0,
        })),
      };
    })(),
  ]);

  const orientationSessions = orientation.status === 'fulfilled' ? orientation.value : [];

  return {
    ok: true,
    schemaVersion: MCS_EVENT_CENTER_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    sources: {
      orientation: orientation.status === 'fulfilled' ? 'available' : 'unavailable',
      webinar: webinar.status === 'fulfilled' ? 'available' : 'unavailable',
    },
    events: [
      ...projectOrientationEvents(orientationSessions),
      ...(webinar.status === 'fulfilled'
        ? projectWebinarEvents(webinar.value.sourceEvents, webinar.value.counts)
        : []),
    ].sort((a, b) => a.scheduledFor.localeCompare(b.scheduledFor)),
    orientationSessions,
    webinarEvents: webinar.status === 'fulfilled' ? webinar.value.projected : [],
  };
}
