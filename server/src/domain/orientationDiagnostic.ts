import {
  MCS_ORIENTATION_DIAGNOSTIC_VERSION,
  projectCurrentOrientationState,
  type McsAdminOrientationDiagnosticResponse,
  type McsOrientationDiagnosticFinding,
  type McsOrientationStateReservationEvidence,
} from '@momentum/shared';
import { persistenceCall } from '../services/persistence/dispatch.js';

const MONGO_DB = 'momentum';
const SESSIONS_COLLECTION = 'tmag_new_member_orientation_sessions';
const RESERVATIONS_COLLECTION = 'tmag_new_member_orientation_reservations';
const DEFAULT_SCAN_LIMIT = 1_000;
const MAX_SCAN_LIMIT = 5_000;

type Persistence = typeof persistenceCall;
type Row = Record<string, unknown>;

export interface OrientationDiagnosticProjectionInput {
  sessions: readonly Row[];
  reservations: readonly Row[];
  generatedAt: string;
  scanLimit?: number;
  scanLimitReached?: {
    sessions: boolean;
    reservations: boolean;
  };
}

export interface BuildOrientationDiagnosticOptions {
  limit?: number;
  now?: () => Date;
  persistence?: Persistence;
}

function nonEmptyText(row: Row, key: string): string | null {
  const value = row[key];
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

function validInstant(value: string | null): value is string {
  return value !== null && Number.isFinite(Date.parse(value));
}

function addFinding(
  findings: McsOrientationDiagnosticFinding[],
  category: McsOrientationDiagnosticFinding['category'],
  code: McsOrientationDiagnosticFinding['code'],
  row: Row,
  detail: string,
  evidence: Record<string, unknown> = {},
): void {
  findings.push({
    category,
    code,
    sessionId: nonEmptyText(row, 'sessionId'),
    reservationId: nonEmptyText(row, 'reservationId'),
    tmagId: nonEmptyText(row, 'tmagId'),
    detail,
    evidence,
    repairPolicy: 'report_only',
  });
}

function groupBy(rows: readonly Row[], key: string): Map<string, Row[]> {
  const groups = new Map<string, Row[]>();
  for (const row of rows) {
    const value = nonEmptyText(row, key);
    if (!value) continue;
    const group = groups.get(value) ?? [];
    group.push(row);
    groups.set(value, group);
  }
  return groups;
}

function reservationEvidence(row: Row): McsOrientationStateReservationEvidence | null {
  const reservationId = nonEmptyText(row, 'reservationId');
  const sessionId = nonEmptyText(row, 'sessionId');
  const status = nonEmptyText(row, 'status');
  const scheduledFor = nonEmptyText(row, 'scheduledFor');
  const createdAt = nonEmptyText(row, 'createdAt');
  const cancelledAtValue = row.cancelledAt;
  const cancelledAt = cancelledAtValue === null || cancelledAtValue === undefined
    ? null
    : typeof cancelledAtValue === 'string'
      ? cancelledAtValue
      : null;

  if (!reservationId || !sessionId || !status || !scheduledFor || !createdAt) return null;
  return { reservationId, sessionId, status, scheduledFor, createdAt, cancelledAt };
}

/**
 * Pure, report-only projection over the current group-session scheduler records.
 * Time can identify unresolved evidence, but it never proves attendance or
 * completion and this projector never mutates scheduler state.
 */
export function projectOrientationDiagnostics(
  input: OrientationDiagnosticProjectionInput,
): McsAdminOrientationDiagnosticResponse {
  const findings: McsOrientationDiagnosticFinding[] = [];
  const generatedAtMs = Date.parse(input.generatedAt);
  const sessionsById = groupBy(input.sessions, 'sessionId');
  const reservationsById = groupBy(input.reservations, 'reservationId');

  for (const [sessionId, rows] of sessionsById) {
    if (rows.length > 1) {
      addFinding(findings, 'duplicate', 'duplicate_session_id', rows[0]!,
        `Session identifier appears on ${rows.length} records.`, { sessionId, count: rows.length });
    }
  }
  for (const [reservationId, rows] of reservationsById) {
    if (rows.length > 1) {
      addFinding(findings, 'duplicate', 'duplicate_reservation_id', rows[0]!,
        `Reservation identifier appears on ${rows.length} records.`, { reservationId, count: rows.length });
    }
  }

  const validSessionById = new Map<string, Row>();
  for (const session of input.sessions) {
    const sessionId = nonEmptyText(session, 'sessionId');
    const scheduledFor = nonEmptyText(session, 'scheduledFor');
    const createdAt = nonEmptyText(session, 'createdAt');
    const status = nonEmptyText(session, 'status');
    const capacity = session.capacity;
    const durationMinutes = session.durationMinutes;
    const hosts = session.hosts;
    const valid = Boolean(
      sessionId &&
      validInstant(scheduledFor) &&
      validInstant(createdAt) &&
      status && ['upcoming', 'past', 'cancelled'].includes(status) &&
      typeof capacity === 'number' && Number.isInteger(capacity) && capacity > 0 &&
      typeof durationMinutes === 'number' && Number.isInteger(durationMinutes) && durationMinutes > 0 &&
      Array.isArray(hosts) && hosts.length > 0 &&
      hosts.every((host) => typeof host === 'string' && host.trim().length > 0),
    );
    if (!valid) {
      addFinding(findings, 'inconsistent', 'invalid_session_record', session,
        'Session is missing required identity, status, timestamp, or capacity evidence.',
        { status: session.status ?? null, scheduledFor: session.scheduledFor ?? null,
          createdAt: session.createdAt ?? null, capacity: capacity ?? null,
          durationMinutes: durationMinutes ?? null });
      continue;
    }
    if (!validSessionById.has(sessionId!)) validSessionById.set(sessionId!, session);

    const scheduledMs = Date.parse(scheduledFor!);
    if (Number.isFinite(generatedAtMs) && status === 'past' && scheduledMs > generatedAtMs) {
      addFinding(findings, 'inconsistent', 'future_session_marked_past', session,
        'Session is marked past even though its scheduled instant is still in the future.',
        { scheduledFor, generatedAt: input.generatedAt });
    }
  }

  const validReservations: Array<{ row: Row; evidence: McsOrientationStateReservationEvidence }> = [];
  for (const reservation of input.reservations) {
    const evidence = reservationEvidence(reservation);
    const tmagId = nonEmptyText(reservation, 'tmagId');
    const baName = nonEmptyText(reservation, 'baName');
    const statusValid = evidence !== null && ['reserved', 'cancelled'].includes(evidence.status);
    const timestampsValid = evidence !== null && validInstant(evidence.scheduledFor) &&
      validInstant(evidence.createdAt) &&
      (evidence.cancelledAt === null || validInstant(evidence.cancelledAt));
    const cancellationCoherent = evidence !== null && (
      (evidence.status === 'reserved' && evidence.cancelledAt === null) ||
      (evidence.status === 'cancelled' && evidence.cancelledAt !== null &&
        Date.parse(evidence.cancelledAt) >= Date.parse(evidence.createdAt))
    );
    if (!evidence || !tmagId || !baName || !statusValid || !timestampsValid || !cancellationCoherent) {
      addFinding(findings, 'inconsistent', 'invalid_reservation_record', reservation,
        'Reservation is missing required identity or has invalid status, timestamp, or cancellation evidence.',
        { status: reservation.status ?? null, scheduledFor: reservation.scheduledFor ?? null,
          createdAt: reservation.createdAt ?? null, cancelledAt: reservation.cancelledAt ?? null });
      continue;
    }
    validReservations.push({ row: reservation, evidence });
  }

  const byBa = new Map<string, Array<{ row: Row; evidence: McsOrientationStateReservationEvidence }>>();
  for (const reservation of validReservations) {
    const tmagId = nonEmptyText(reservation.row, 'tmagId')!;
    const group = byBa.get(tmagId) ?? [];
    group.push(reservation);
    byBa.set(tmagId, group);
  }

  for (const [tmagId, reservations] of byBa) {
    const projection = projectCurrentOrientationState({
      reservations: reservations.map((reservation) => reservation.evidence),
      projectedAt: input.generatedAt,
    });
    const active = reservations.filter((reservation) => reservation.evidence.status === 'reserved');
    if (projection.attentionReasons.includes('duplicate_active_reservations')) {
      addFinding(findings, 'duplicate', 'duplicate_active_reservations_for_ba', active[0]!.row,
        `BA has ${active.length} active orientation reservations.`,
        { tmagId, reservationIds: active.map((reservation) => reservation.evidence.reservationId) });
      for (const [sessionId, sameSession] of groupBy(active.map((reservation) => reservation.row), 'sessionId')) {
        if (sameSession.length > 1) {
          addFinding(findings, 'duplicate', 'duplicate_active_reservations_for_ba_session', sameSession[0]!,
            `BA has ${sameSession.length} active reservations for the same session.`,
            { tmagId, sessionId, count: sameSession.length });
        }
      }
    } else if (projection.state === 'attendance_unverified') {
      addFinding(findings, 'stuck', 'elapsed_active_reservation', active[0]!.row,
        'The reserved session instant elapsed; attendance and completion remain unverified.',
        { scheduledFor: projection.scheduledFor, attendanceAuthority: null, completionAuthority: null });
    }
  }

  for (const { row: reservation, evidence } of validReservations) {
    const session = validSessionById.get(evidence.sessionId);
    if (!session) {
      addFinding(findings, 'inconsistent', 'reservation_without_session', reservation,
        'Reservation references no valid current orientation session.', { sessionId: evidence.sessionId });
      continue;
    }
    const sessionScheduledFor = nonEmptyText(session, 'scheduledFor');
    if (sessionScheduledFor !== evidence.scheduledFor) {
      addFinding(findings, 'inconsistent', 'reservation_schedule_mismatch', reservation,
        'Reservation schedule snapshot does not match its session record.',
        { reservationScheduledFor: evidence.scheduledFor, sessionScheduledFor });
    }
    if (evidence.status === 'reserved' && session.status === 'cancelled') {
      addFinding(findings, 'inconsistent', 'active_reservation_for_cancelled_session', reservation,
        'An active reservation references a cancelled session.', { sessionStatus: session.status });
    }
  }

  for (const [sessionId, rows] of validSessionById) {
    const capacity = rows.capacity as number;
    const activeCount = validReservations.filter(({ evidence }) => (
      evidence.sessionId === sessionId && evidence.status === 'reserved'
    )).length;
    if (activeCount > capacity) {
      addFinding(findings, 'inconsistent', 'session_over_capacity', rows,
        `Session has ${activeCount} active reservations for ${capacity} seats.`,
        { activeReservations: activeCount, capacity });
    }
  }

  const totals = { stuck: 0, duplicate: 0, inconsistent: 0 };
  for (const finding of findings) totals[finding.category] += 1;
  return {
    ok: true,
    schemaVersion: MCS_ORIENTATION_DIAGNOSTIC_VERSION,
    stateSchemaVersion: 'orientation_state.v1',
    generatedAt: input.generatedAt,
    policy: 'report_only',
    sourceAuthority: {
      sessions: SESSIONS_COLLECTION,
      reservations: RESERVATIONS_COLLECTION,
    },
    attendanceAuthority: null,
    completionAuthority: null,
    completionInferred: false,
    autoRepair: false,
    scanLimit: input.scanLimit ?? DEFAULT_SCAN_LIMIT,
    scanLimitReached: input.scanLimitReached ?? { sessions: false, reservations: false },
    scanned: { sessions: input.sessions.length, reservations: input.reservations.length },
    totals: { ...totals, findings: findings.length },
    findings,
  };
}

/** Read the current scheduler collections and return a bounded report only. */
export async function buildAdminOrientationDiagnostic(
  options: BuildOrientationDiagnosticOptions = {},
): Promise<McsAdminOrientationDiagnosticResponse> {
  const persistence = options.persistence ?? persistenceCall;
  const limit = Math.min(MAX_SCAN_LIMIT, Math.max(1, Math.floor(options.limit ?? DEFAULT_SCAN_LIMIT)));
  const [sessionResult, reservationResult] = await Promise.all([
    persistence<{ documents?: Row[] }>('mongodb', 'query', {
      database: MONGO_DB,
      collection: SESSIONS_COLLECTION,
      filter: {},
      sort: { scheduledFor: -1 },
      limit: limit + 1,
    }),
    persistence<{ documents?: Row[] }>('mongodb', 'query', {
      database: MONGO_DB,
      collection: RESERVATIONS_COLLECTION,
      filter: {},
      sort: { createdAt: -1 },
      limit: limit + 1,
    }),
  ]);
  const allSessions = sessionResult.documents ?? [];
  const allReservations = reservationResult.documents ?? [];
  return projectOrientationDiagnostics({
    sessions: allSessions.slice(0, limit),
    reservations: allReservations.slice(0, limit),
    generatedAt: (options.now?.() ?? new Date()).toISOString(),
    scanLimit: limit,
    scanLimitReached: {
      sessions: allSessions.length > limit,
      reservations: allReservations.length > limit,
    },
  });
}
