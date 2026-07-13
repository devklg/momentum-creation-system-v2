import { randomUUID } from 'node:crypto';
import type {
  McsAuditActor,
  McsEventAttendanceRecord,
  McsEventAttendanceState,
  McsRecordEventAttendanceResponse,
  McsWebinarReservationRecord,
} from '@momentum/shared';
import { persistenceCall } from '../services/persistence/dispatch.js';
import { writeOperational } from '../services/tieredWrite.js';
import { appendAuditEntry } from './auditLog.js';
import { getActiveFollowUp, setFollowUp } from './crm.js';

const MONGO_DB = 'momentum';
const RESERVATIONS_COLLECTION = 'tmag_prospect_webinar_reservations';
const ATTENDANCE_COLLECTION = 'tmag_event_attendance';
const CHROMA_COLLECTION = 'mcs_event_attendance';
const FOLLOW_UP_DELAY_MS = 24 * 60 * 60 * 1000;

export class EventAttendanceError extends Error {
  constructor(public readonly code: 'reservation_not_found' | 'event_mismatch') {
    super(code);
    this.name = 'EventAttendanceError';
  }
}

interface StoredAttendance extends McsEventAttendanceRecord {
  _id?: string;
}

async function findReservation(
  eventId: string,
  reservationId: string,
): Promise<McsWebinarReservationRecord> {
  const result = await persistenceCall<{ documents: McsWebinarReservationRecord[] }>(
    'mongodb',
    'query',
    {
      database: MONGO_DB,
      collection: RESERVATIONS_COLLECTION,
      filter: { reservationId },
      limit: 1,
    },
  );
  const reservation = result.documents?.[0];
  if (!reservation) throw new EventAttendanceError('reservation_not_found');
  if (reservation.eventId !== eventId) throw new EventAttendanceError('event_mismatch');
  return reservation;
}

async function latestAttendance(reservationId: string): Promise<StoredAttendance | null> {
  const result = await persistenceCall<{ documents: StoredAttendance[] }>(
    'mongodb',
    'query',
    {
      database: MONGO_DB,
      collection: ATTENDANCE_COLLECTION,
      filter: { reservationId },
      sort: { recordedAt: -1 },
      limit: 1,
    },
  );
  return result.documents?.[0] ?? null;
}

async function persistAttendance(input: {
  reservation: McsWebinarReservationRecord;
  state: McsEventAttendanceState;
  actor: McsAuditActor & { kind: 'admin' };
  crmFollowUpDueAt: string;
}): Promise<McsEventAttendanceRecord> {
  const attendanceId = `eventatt_${randomUUID()}`;
  const recordedAt = new Date().toISOString();
  const record: McsEventAttendanceRecord = {
    attendanceId,
    eventId: input.reservation.eventId,
    reservationId: input.reservation.reservationId,
    eventType: 'prospect_webinar',
    prospectId: input.reservation.prospectId,
    sponsorTmagId: input.reservation.sponsorTmagId,
    state: input.state,
    recordedAt,
    recordedByTmagId: input.actor.tmagId,
    crmFollowUpDueAt: input.crmFollowUpDueAt,
  };

  await writeOperational({
    id: attendanceId,
    mongoCollection: ATTENDANCE_COLLECTION,
    mongoDoc: { ...record },
    neo4j: {
      cypher:
        'MATCH (p:TmagProspect {prospectId: $prospectId}) ' +
        'MATCH (e:TmagWebinarEvent {eventId: $eventId}) ' +
        'CREATE (a:TmagEventAttendance {attendanceId: $id, reservationId: $reservationId, state: $state, recordedAt: $recordedAt}) ' +
        'CREATE (p)-[:HAS_EVENT_ATTENDANCE]->(a)-[:FOR_EVENT]->(e)',
      params: {
        prospectId: record.prospectId,
        eventId: record.eventId,
        reservationId: record.reservationId,
        state: record.state,
        recordedAt: record.recordedAt,
        crmFollowUpDueAt: record.crmFollowUpDueAt,
      },
    },
    chroma: {
      collection: CHROMA_COLLECTION,
      document:
        `Prospect ${record.prospectId} attendance for webinar ${record.eventId} ` +
        `was recorded as ${record.state} by ${record.recordedByTmagId}.`,
      metadata: {
        kind: 'event_attendance',
        eventType: record.eventType,
        eventId: record.eventId,
        reservationId: record.reservationId,
        prospectId: record.prospectId,
        sponsorTmagId: record.sponsorTmagId,
        state: record.state,
        recordedAt: record.recordedAt,
        crmFollowUpDueAt: record.crmFollowUpDueAt,
      },
    },
  });

  await appendAuditEntry({
    actor: input.actor,
    action: 'admin.events.attendance.recorded',
    entity: { kind: 'prospect', id: record.prospectId, displayLabel: input.reservation.name },
    severity: 'info',
    before: { attendance: 'not_recorded_or_prior_state' },
    after: {
      attendanceId,
      eventId: record.eventId,
      reservationId: record.reservationId,
      attendance: record.state,
      inferred: false,
    },
  });

  return record;
}

/**
 * Record explicit webinar attendance and make a human CRM reminder available.
 * A reservation or elapsed time never calls this function. The admin action is
 * the source of truth. Existing BA reminders are preserved instead of moved.
 */
export async function recordWebinarAttendance(input: {
  eventId: string;
  reservationId: string;
  state: McsEventAttendanceState;
  actor: McsAuditActor & { kind: 'admin' };
}): Promise<McsRecordEventAttendanceResponse> {
  const reservation = await findReservation(input.eventId, input.reservationId);
  const prior = await latestAttendance(reservation.reservationId);
  if (prior?.state === input.state) {
    return {
      ok: true,
      attendance: prior,
      followUp: {
        connection: 'available',
        dueAt: prior.crmFollowUpDueAt,
        created: false,
        automatedContact: false,
      },
    };
  }

  const existingFollowUp = await getActiveFollowUp(
    reservation.prospectId,
    reservation.sponsorTmagId,
  );
  const dueAt = existingFollowUp?.dueAt
    ?? new Date(Date.now() + FOLLOW_UP_DELAY_MS).toISOString();
  const followUp = existingFollowUp
    ?? await setFollowUp(
      reservation.prospectId,
      reservation.sponsorTmagId,
      dueAt,
      {
        actor: input.actor,
        scheduledAction: 'admin.events.crm_follow_up.scheduled',
        rescheduledAction: 'admin.events.crm_follow_up.rescheduled',
      },
    );
  const attendance = await persistAttendance({
    reservation,
    state: input.state,
    actor: input.actor,
    crmFollowUpDueAt: followUp.dueAt,
  });

  return {
    ok: true,
    attendance,
    followUp: {
      connection: 'available',
      dueAt: followUp.dueAt,
      created: existingFollowUp === null,
      automatedContact: false,
    },
  };
}

export async function listLatestWebinarAttendance(
  eventIds: string[],
): Promise<Map<string, McsEventAttendanceRecord>> {
  if (eventIds.length === 0) return new Map();
  const result = await persistenceCall<{ documents: McsEventAttendanceRecord[] }>(
    'mongodb',
    'query',
    {
      database: MONGO_DB,
      collection: ATTENDANCE_COLLECTION,
      filter: { eventId: { $in: eventIds }, eventType: 'prospect_webinar' },
      sort: { recordedAt: -1 },
      limit: 10000,
    },
  );
  const latest = new Map<string, McsEventAttendanceRecord>();
  for (const row of result.documents ?? []) {
    if (!latest.has(row.reservationId)) latest.set(row.reservationId, row);
  }
  return latest;
}
