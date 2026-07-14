export const MCS_ORIENTATION_STATE_MACHINE_VERSION = 'orientation_state.v1' as const;

export type McsCurrentOrientationState =
  | 'not_scheduled'
  | 'scheduled'
  | 'cancelled'
  | 'attendance_unverified'
  | 'inconsistent';

export type McsCurrentOrientationEvent =
  | 'seat_reserved'
  | 'seat_cancelled'
  | 'session_elapsed';

export interface McsOrientationStateReservationEvidence {
  reservationId: string;
  sessionId: string;
  status: string;
  scheduledFor: string;
  createdAt: string;
  cancelledAt: string | null;
}

export interface McsCurrentOrientationStateProjection {
  schemaVersion: typeof MCS_ORIENTATION_STATE_MACHINE_VERSION;
  state: McsCurrentOrientationState;
  projectedAt: string;
  sourceAuthority: 'tmag_new_member_orientation_reservations';
  activeReservationCount: number;
  currentReservationId: string | null;
  currentSessionId: string | null;
  scheduledFor: string | null;
  completionAuthority: null;
  attendanceAuthority: null;
  completionInferred: false;
  attentionReasons: Array<
    | 'duplicate_active_reservations'
    | 'invalid_reservation_status'
    | 'invalid_reservation_timestamp'
  >;
}

export interface McsOrientationStateResponse {
  ok: true;
  orientation: McsCurrentOrientationStateProjection;
}

export const MCS_CURRENT_ORIENTATION_STATE_MACHINE = {
  schemaVersion: MCS_ORIENTATION_STATE_MACHINE_VERSION,
  scope: 'current_live_group_session_scheduler',
  storedReservationStates: ['reserved', 'cancelled'],
  participantStates: [
    'not_scheduled',
    'scheduled',
    'cancelled',
    'attendance_unverified',
    'inconsistent',
  ],
  transitions: [
    { from: 'not_scheduled', event: 'seat_reserved', to: 'scheduled' },
    { from: 'cancelled', event: 'seat_reserved', to: 'scheduled' },
    { from: 'scheduled', event: 'seat_cancelled', to: 'cancelled' },
    { from: 'scheduled', event: 'session_elapsed', to: 'attendance_unverified' },
    { from: 'attendance_unverified', event: 'seat_cancelled', to: 'cancelled' },
  ],
  completion: {
    attendanceAuthority: null,
    completionAuthority: null,
    elapsedTimeCompletesOrientation: false,
    reservationCompletesOrientation: false,
  },
  boundaries: {
    futureStageArchitectureIsNotCurrentRuntime: true,
    stateProjectionIsReadOnly: true,
    inconsistentEvidenceNeverCompletesOrientation: true,
  },
} as const;

function validInstant(value: string | null): value is string {
  return value !== null && Number.isFinite(Date.parse(value));
}

function latestReservation(
  reservations: readonly McsOrientationStateReservationEvidence[],
): McsOrientationStateReservationEvidence | null {
  return [...reservations].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ?? null;
}

/**
 * Project current participant state from explicit reservation evidence.
 * Elapsed time changes `scheduled` to `attendance_unverified`; it never creates
 * attendance or completion evidence.
 */
export function projectCurrentOrientationState(args: {
  reservations: readonly McsOrientationStateReservationEvidence[];
  projectedAt: string;
}): McsCurrentOrientationStateProjection {
  const attentionReasons: McsCurrentOrientationStateProjection['attentionReasons'] = [];
  const projectedAtValid = validInstant(args.projectedAt);
  const validStatuses = new Set(['reserved', 'cancelled']);
  const invalidStatus = args.reservations.some((reservation) => !validStatuses.has(reservation.status));
  const invalidTimestamp = !projectedAtValid || args.reservations.some((reservation) => (
    !validInstant(reservation.scheduledFor) ||
    !validInstant(reservation.createdAt) ||
    (reservation.cancelledAt !== null && !validInstant(reservation.cancelledAt))
  ));
  if (invalidStatus) attentionReasons.push('invalid_reservation_status');
  if (invalidTimestamp) attentionReasons.push('invalid_reservation_timestamp');

  const active = args.reservations.filter((reservation) => reservation.status === 'reserved');
  if (active.length > 1) attentionReasons.push('duplicate_active_reservations');

  const latest = latestReservation(args.reservations);
  const current = active.length === 1 ? active[0]! : null;
  let state: McsCurrentOrientationState;
  if (attentionReasons.length > 0) state = 'inconsistent';
  else if (current) {
    state = Date.parse(current.scheduledFor) > Date.parse(args.projectedAt)
      ? 'scheduled'
      : 'attendance_unverified';
  } else if (latest?.status === 'cancelled') state = 'cancelled';
  else state = 'not_scheduled';

  return {
    schemaVersion: MCS_ORIENTATION_STATE_MACHINE_VERSION,
    state,
    projectedAt: args.projectedAt,
    sourceAuthority: 'tmag_new_member_orientation_reservations',
    activeReservationCount: active.length,
    currentReservationId: current?.reservationId ?? null,
    currentSessionId: current?.sessionId ?? null,
    scheduledFor: current?.scheduledFor ?? null,
    completionAuthority: null,
    attendanceAuthority: null,
    completionInferred: false,
    attentionReasons,
  };
}
