import { describe, expect, it } from 'vitest';
import {
  MCS_CURRENT_ORIENTATION_STATE_MACHINE,
  projectCurrentOrientationState,
  type McsOrientationStateReservationEvidence,
} from '@momentum/shared';

const now = '2026-07-13T12:00:00.000Z';

function reservation(
  overrides: Partial<McsOrientationStateReservationEvidence> = {},
): McsOrientationStateReservationEvidence {
  return {
    reservationId: 'RES-1',
    sessionId: 'SESSION-1',
    status: 'reserved',
    scheduledFor: '2026-07-14T12:00:00.000Z',
    createdAt: '2026-07-12T12:00:00.000Z',
    cancelledAt: null,
    ...overrides,
  };
}

describe('P2-115 current orientation state machine', () => {
  it('publishes only transitions the current group-session scheduler supports', () => {
    expect(MCS_CURRENT_ORIENTATION_STATE_MACHINE.transitions).toEqual([
      { from: 'not_scheduled', event: 'seat_reserved', to: 'scheduled' },
      { from: 'cancelled', event: 'seat_reserved', to: 'scheduled' },
      { from: 'scheduled', event: 'seat_cancelled', to: 'cancelled' },
      { from: 'scheduled', event: 'session_elapsed', to: 'attendance_unverified' },
      { from: 'attendance_unverified', event: 'seat_cancelled', to: 'cancelled' },
    ]);
    expect(JSON.stringify(MCS_CURRENT_ORIENTATION_STATE_MACHINE.transitions)).not.toContain('completed');
    expect(MCS_CURRENT_ORIENTATION_STATE_MACHINE.completion).toEqual({
      attendanceAuthority: null,
      completionAuthority: null,
      elapsedTimeCompletesOrientation: false,
      reservationCompletesOrientation: false,
    });
  });

  it('projects no evidence as not scheduled', () => {
    expect(projectCurrentOrientationState({ reservations: [], projectedAt: now })).toMatchObject({
      state: 'not_scheduled',
      activeReservationCount: 0,
      completionInferred: false,
    });
  });

  it('projects an active future reservation as scheduled', () => {
    expect(projectCurrentOrientationState({ reservations: [reservation()], projectedAt: now })).toMatchObject({
      state: 'scheduled',
      activeReservationCount: 1,
      currentReservationId: 'RES-1',
      currentSessionId: 'SESSION-1',
    });
  });

  it('projects an elapsed reservation as attendance unverified, never completed', () => {
    const result = projectCurrentOrientationState({
      reservations: [reservation({ scheduledFor: '2026-07-12T12:00:00.000Z' })],
      projectedAt: now,
    });
    expect(result.state).toBe('attendance_unverified');
    expect(result.completionAuthority).toBeNull();
    expect(result.completionInferred).toBe(false);
  });

  it('retains explicit cancellation as the current historical state', () => {
    expect(projectCurrentOrientationState({
      reservations: [reservation({ status: 'cancelled', cancelledAt: '2026-07-12T13:00:00.000Z' })],
      projectedAt: now,
    }).state).toBe('cancelled');
  });

  it('fails closed on duplicate or malformed evidence', () => {
    const duplicate = projectCurrentOrientationState({
      reservations: [
        reservation(),
        reservation({ reservationId: 'RES-2', sessionId: 'SESSION-2' }),
      ],
      projectedAt: now,
    });
    expect(duplicate).toMatchObject({
      state: 'inconsistent',
      activeReservationCount: 2,
      attentionReasons: ['duplicate_active_reservations'],
      completionInferred: false,
    });

    const malformed = projectCurrentOrientationState({
      reservations: [reservation({ status: 'attended', scheduledFor: 'not-a-date' })],
      projectedAt: now,
    });
    expect(malformed.state).toBe('inconsistent');
    expect(malformed.attentionReasons).toEqual([
      'invalid_reservation_status',
      'invalid_reservation_timestamp',
    ]);
  });
});
