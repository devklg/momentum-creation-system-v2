import type {
  McsAdminEventCenterResponse,
  McsAdminEventCenterWebinarReservation,
  McsAdminEventCenterWebinarEvent,
  McsCrmFollowUpRecord,
  McsEventAttendanceRecord,
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
import { listLatestWebinarAttendance } from './eventAttendance.js';

const MONGO_DB = 'momentum';
const WEBINAR_RESERVATIONS_COLLECTION = 'tmag_prospect_webinar_reservations';
const CRM_FOLLOWUPS_COLLECTION = 'tmag_prospect_crm_followups';

const EMPTY_ATTENDANCE_COUNTS = {
  recorded: 0,
  attended: 0,
  missed: 0,
  rescheduled: 0,
} as const;

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
    attendance: {
      state: 'not_recorded',
      recordedAt: null,
      inferred: false,
      counts: { ...EMPTY_ATTENDANCE_COUNTS },
    },
    followUp: {
      owner: 'human_crm',
      connection: 'not_connected',
      automated: false,
      connectedCount: 0,
    },
  };
}

function attendanceLifecycle(
  rows: McsEventAttendanceRecord[],
  connectedCount: number,
  availability: { attendance: boolean; crm: boolean } = { attendance: true, crm: true },
): Pick<McsEventCenterEvent, 'attendance' | 'followUp'> {
  if (!availability.attendance) {
    return {
      attendance: {
        state: 'unavailable', recordedAt: null, inferred: false,
        counts: { ...EMPTY_ATTENDANCE_COUNTS },
      },
      followUp: {
        owner: 'human_crm', connection: availability.crm ? 'not_connected' : 'unavailable',
        automated: false, connectedCount: 0,
      },
    };
  }
  if (rows.length === 0) {
    const current = currentLifecycleFields();
    return { attendance: current.attendance, followUp: current.followUp };
  }
  return {
    attendance: {
      state: 'recorded',
      recordedAt: rows.reduce(
        (latest, row) => row.recordedAt > latest ? row.recordedAt : latest,
        rows[0]!.recordedAt,
      ),
      inferred: false,
      counts: {
        recorded: rows.length,
        attended: rows.filter((row) => row.state === 'attended').length,
        missed: rows.filter((row) => row.state === 'missed').length,
        rescheduled: rows.filter((row) => row.state === 'rescheduled').length,
      },
    },
    followUp: {
      owner: 'human_crm',
      connection: !availability.crm
        ? 'unavailable'
        : connectedCount > 0 ? 'available' : 'not_connected',
      automated: false,
      connectedCount,
    },
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
  attendance?: Map<string, McsEventAttendanceRecord[]>,
  connectedCounts?: Map<string, number>,
  availability?: { attendance: boolean; crm: boolean },
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
    reminders: currentLifecycleFields().reminders,
    ...attendanceLifecycle(
      attendance?.get(event.eventId) ?? [],
      connectedCounts?.get(event.eventId) ?? 0,
      availability,
    ),
  }));
}

async function webinarReservations(
  eventIds: string[],
): Promise<McsWebinarReservationRecord[]> {
  if (eventIds.length === 0) return [];
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
  return result.documents ?? [];
}

function reservationCounts(rows: McsWebinarReservationRecord[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const row of rows) counts.set(row.eventId, (counts.get(row.eventId) ?? 0) + 1);
  return counts;
}

async function activeFollowUps(
  rows: McsWebinarReservationRecord[],
): Promise<Map<string, McsCrmFollowUpRecord>> {
  const prospectIds = [...new Set(rows.map((row) => row.prospectId))];
  if (prospectIds.length === 0) return new Map();
  const result = await persistenceCall<{ documents: McsCrmFollowUpRecord[] }>(
    'mongodb',
    'query',
    {
      database: MONGO_DB,
      collection: CRM_FOLLOWUPS_COLLECTION,
      filter: { prospectId: { $in: prospectIds }, clearedAt: null },
      limit: 10000,
    },
  );
  return new Map((result.documents ?? []).map((row) => [
    `${row.prospectId}\u0000${row.sponsorTmagId}`,
    row,
  ]));
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
      reservations: McsAdminEventCenterWebinarReservation[];
      attendanceByEvent: Map<string, McsEventAttendanceRecord[]>;
      connectedCounts: Map<string, number>;
      attendanceAvailable: boolean;
      crmAvailable: boolean;
    }> => {
      const events = await listUpcomingWebinarEvents({ horizonDays: 30, limit: 100 });
      const sourceReservations = await webinarReservations(events.map((event) => event.eventId));
      const counts = reservationCounts(sourceReservations);
      const [attendanceResult, followUpResult] = await Promise.allSettled([
        listLatestWebinarAttendance(events.map((event) => event.eventId)),
        activeFollowUps(sourceReservations),
      ]);
      const latestAttendance = attendanceResult.status === 'fulfilled' ? attendanceResult.value : new Map();
      const followUps = followUpResult.status === 'fulfilled' ? followUpResult.value : new Map();
      const attendanceByEvent = new Map<string, McsEventAttendanceRecord[]>();
      const connectedCounts = new Map<string, number>();
      const reservations = sourceReservations.map((reservation) => {
        const attendance = latestAttendance.get(reservation.reservationId) ?? null;
        const followUp = followUps.get(`${reservation.prospectId}\u0000${reservation.sponsorTmagId}`) ?? null;
        if (attendance) {
          const rows = attendanceByEvent.get(reservation.eventId) ?? [];
          rows.push(attendance);
          attendanceByEvent.set(reservation.eventId, rows);
          if (followUp) {
            connectedCounts.set(
              reservation.eventId,
              (connectedCounts.get(reservation.eventId) ?? 0) + 1,
            );
          }
        }
        return {
          reservationId: reservation.reservationId,
          eventId: reservation.eventId,
          prospectId: reservation.prospectId,
          sponsorTmagId: reservation.sponsorTmagId,
          name: reservation.name,
          createdAt: reservation.createdAt,
          attendance: attendance?.state ?? null,
          attendanceRecordedAt: attendance?.recordedAt ?? null,
          crmFollowUpDueAt: followUp?.dueAt ?? null,
        } satisfies McsAdminEventCenterWebinarReservation;
      });
      return {
        sourceEvents: events,
        counts,
        reservations,
        attendanceByEvent,
        connectedCounts,
        attendanceAvailable: attendanceResult.status === 'fulfilled',
        crmAvailable: followUpResult.status === 'fulfilled',
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
    dependencies: {
      attendance: webinar.status === 'fulfilled' && webinar.value.attendanceAvailable ? 'available' : 'unavailable',
      crm: webinar.status === 'fulfilled' && webinar.value.crmAvailable ? 'available' : 'unavailable',
    },
    events: [
      ...projectOrientationEvents(orientationSessions),
      ...(webinar.status === 'fulfilled'
        ? projectWebinarEvents(
          webinar.value.sourceEvents,
          webinar.value.counts,
          webinar.value.attendanceByEvent,
          webinar.value.connectedCounts,
          {
            attendance: webinar.value.attendanceAvailable,
            crm: webinar.value.crmAvailable,
          },
        )
        : []),
    ].sort((a, b) => a.scheduledFor.localeCompare(b.scheduledFor)),
    orientationSessions,
    webinarEvents: webinar.status === 'fulfilled' ? webinar.value.projected : [],
    webinarReservations: webinar.status === 'fulfilled' ? webinar.value.reservations : [],
  };
}
