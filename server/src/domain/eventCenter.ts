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
import {
  AdminCursorError,
  combineMongoFilters,
  decodeAdminCursor,
  descendingKeysetFilter,
  encodeAdminCursor,
  type AdminPageInfo,
} from './adminPagination.js';

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

async function reservationCounts(eventIds: string[]): Promise<Map<string, number>> {
  if (eventIds.length === 0) return new Map();
  const result = await persistenceCall<{ results: Array<{ _id: string; count: number }> }>(
    'mongodb',
    'aggregate',
    {
      database: MONGO_DB,
      collection: WEBINAR_RESERVATIONS_COLLECTION,
      pipeline: [
        { $match: { eventId: { $in: eventIds } } },
        { $group: { _id: '$eventId', count: { $sum: 1 } } },
      ],
    },
  );
  return new Map((result.results ?? []).map((row) => [row._id, row.count]));
}

const EVENT_RESERVATION_SCOPE = 'admin_event_reservations.v1';

async function webinarReservationPage(input: {
  eventIds: string[];
  pageSize: number;
  cursor?: string;
}): Promise<{ rows: McsWebinarReservationRecord[]; pageInfo: AdminPageInfo }> {
  const pageSize = Math.max(1, Math.min(100, input.pageSize));
  if (input.eventIds.length === 0) {
    return { rows: [], pageInfo: { pageSize, hasMore: false, nextCursor: null } };
  }
  const baseFilter = { eventId: { $in: input.eventIds } };
  const contract = {
    eventIds: [...input.eventIds].sort(),
    sort: 'createdAt_desc_reservationId_desc',
  };
  let keyset: Record<string, unknown> = {};
  if (input.cursor) {
    const keys = decodeAdminCursor({
      token: input.cursor,
      scope: EVENT_RESERVATION_SCOPE,
      contract,
      requiredKeys: ['createdAt', 'reservationId'],
    });
    const cursorMatch = await persistenceCall<{ documents: McsWebinarReservationRecord[] }>(
      'mongodb',
      'query',
      {
        database: MONGO_DB,
        collection: WEBINAR_RESERVATIONS_COLLECTION,
        filter: combineMongoFilters(baseFilter, {
          createdAt: keys.createdAt,
          reservationId: keys.reservationId,
        }),
        limit: 1,
      },
    );
    if (!cursorMatch.documents?.[0]) throw new AdminCursorError();
    keyset = descendingKeysetFilter(
      'createdAt',
      'reservationId',
      keys.createdAt!,
      keys.reservationId!,
    );
  }
  const result = await persistenceCall<{ documents: McsWebinarReservationRecord[] }>(
    'mongodb',
    'query',
    {
      database: MONGO_DB,
      collection: WEBINAR_RESERVATIONS_COLLECTION,
      filter: combineMongoFilters(baseFilter, keyset),
      sort: { createdAt: -1, reservationId: -1 },
      limit: pageSize + 1,
    },
  );
  const docs = result.documents ?? [];
  const hasMore = docs.length > pageSize;
  const rows = hasMore ? docs.slice(0, pageSize) : docs;
  const last = rows[rows.length - 1];
  return {
    rows,
    pageInfo: {
      pageSize,
      hasMore,
      nextCursor: hasMore && last
        ? encodeAdminCursor({
            scope: EVENT_RESERVATION_SCOPE,
            contract,
            keys: { createdAt: last.createdAt, reservationId: last.reservationId },
          })
        : null,
    },
  };
}

async function activeFollowUps(
  rows: Array<Pick<McsWebinarReservationRecord, 'prospectId' | 'sponsorTmagId'>>,
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
    ].sort((a, b) => new Date(a.scheduledFor).getTime() - new Date(b.scheduledFor).getTime()),
    orientationSessions,
    myOrientationReservationSessionId:
      orientation.status === 'fulfilled'
        ? orientation.value.myReservationSessionId
        : null,
    webinarEvents: projectWebinars(webinarEvents),
  };
}

export async function getEventCenterForAdmin(input: {
  pageSize?: number;
  cursor?: string;
} = {}): Promise<McsAdminEventCenterResponse & { pageInfo: AdminPageInfo }> {
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
      pageInfo: AdminPageInfo;
    }> => {
      const events = await listUpcomingWebinarEvents({ horizonDays: 30, limit: 100 });
      const eventIds = events.map((event) => event.eventId);
      const [reservationPage, counts] = await Promise.all([
        webinarReservationPage({ eventIds, pageSize: input.pageSize ?? 50, cursor: input.cursor }),
        reservationCounts(eventIds),
      ]);
      const sourceReservations = reservationPage.rows;
      const attendanceResult = await Promise.allSettled([
        listLatestWebinarAttendance(eventIds),
      ]).then(([result]) => result!);
      const latestAttendance = attendanceResult.status === 'fulfilled' ? attendanceResult.value : new Map();
      const followUpResult = await Promise.allSettled([
        activeFollowUps([...latestAttendance.values()]),
      ]).then(([result]) => result!);
      const followUps = followUpResult.status === 'fulfilled' ? followUpResult.value : new Map();
      const attendanceByEvent = new Map<string, McsEventAttendanceRecord[]>();
      const connectedCounts = new Map<string, number>();
      for (const attendance of latestAttendance.values()) {
        const rows = attendanceByEvent.get(attendance.eventId) ?? [];
        rows.push(attendance);
        attendanceByEvent.set(attendance.eventId, rows);
        if (followUps.has(`${attendance.prospectId}\u0000${attendance.sponsorTmagId}`)) {
          connectedCounts.set(
            attendance.eventId,
            (connectedCounts.get(attendance.eventId) ?? 0) + 1,
          );
        }
      }
      const reservations = sourceReservations.map((reservation) => {
        const attendance = latestAttendance.get(reservation.reservationId) ?? null;
        const followUp = followUps.get(`${reservation.prospectId}\u0000${reservation.sponsorTmagId}`) ?? null;
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
        pageInfo: reservationPage.pageInfo,
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
    pageInfo: webinar.status === 'fulfilled'
      ? webinar.value.pageInfo
      : { pageSize: input.pageSize ?? 50, hasMore: false, nextCursor: null },
  };
}
