import { describe, expect, it, vi } from 'vitest';
import {
  buildAdminOrientationDiagnostic,
  projectOrientationDiagnostics,
} from '../orientationDiagnostic.js';

const now = '2026-07-14T12:00:00.000Z';

function session(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    sessionId: 'SESSION-1',
    scheduledFor: '2026-07-15T12:00:00.000Z',
    hosts: ['Kevin Gardner'],
    capacity: 10,
    durationMinutes: 60,
    joinUrl: null,
    status: 'upcoming',
    createdAt: '2026-07-10T12:00:00.000Z',
    ...overrides,
  };
}

function reservation(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    reservationId: 'RES-1',
    sessionId: 'SESSION-1',
    tmagId: 'TMAG-100',
    baName: 'Example BA',
    scheduledFor: '2026-07-15T12:00:00.000Z',
    status: 'reserved',
    createdAt: '2026-07-11T12:00:00.000Z',
    cancelledAt: null,
    smsDeliveryStatus: 'skipped',
    smsDeliveryError: null,
    ...overrides,
  };
}

describe('P2-116 orientation diagnostics', () => {
  it('returns a clean, machine-readable report-only boundary', () => {
    const report = projectOrientationDiagnostics({
      sessions: [session()],
      reservations: [reservation()],
      generatedAt: now,
    });

    expect(report).toMatchObject({
      ok: true,
      schemaVersion: 'orientation_diagnostic.v1',
      stateSchemaVersion: 'orientation_state.v1',
      policy: 'report_only',
      sourceAuthority: {
        sessions: 'tmag_new_member_orientation_sessions',
        reservations: 'tmag_new_member_orientation_reservations',
      },
      attendanceAuthority: null,
      completionAuthority: null,
      completionInferred: false,
      autoRepair: false,
      totals: { stuck: 0, duplicate: 0, inconsistent: 0, findings: 0 },
    });
  });

  it('reports only the elapsed active reservation as stuck and does not infer attendance', () => {
    const elapsed = '2026-07-13T12:00:00.000Z';
    const report = projectOrientationDiagnostics({
      // Stored `upcoming` is valid current scheduler evidence: no session-status
      // transition writer exists, so elapsed time must not diagnose the session.
      sessions: [session({ scheduledFor: elapsed, status: 'upcoming' })],
      reservations: [reservation({ scheduledFor: elapsed })],
      generatedAt: now,
    });

    expect(report.findings).toEqual([
      expect.objectContaining({
        category: 'stuck',
        code: 'elapsed_active_reservation',
        repairPolicy: 'report_only',
      }),
    ]);
    expect(report.completionInferred).toBe(false);
    expect(report.attendanceAuthority).toBeNull();
    expect(report.completionAuthority).toBeNull();
  });

  it('reports duplicate identities and active reservations without changing records', () => {
    const report = projectOrientationDiagnostics({
      sessions: [session(), session()],
      reservations: [
        reservation(),
        reservation({ reservationId: 'RES-2' }),
        reservation({ tmagId: 'TMAG-200', baName: 'Second BA' }),
      ],
      generatedAt: now,
    });
    const codes = report.findings.map((finding) => finding.code);

    expect(codes).toContain('duplicate_session_id');
    expect(codes).toContain('duplicate_reservation_id');
    expect(codes).toContain('duplicate_active_reservations_for_ba');
    expect(codes).toContain('duplicate_active_reservations_for_ba_session');
    expect(report.totals.duplicate).toBe(4);
    expect(report.autoRepair).toBe(false);
  });

  it('reports malformed, orphaned, mismatched, cancelled-session, and over-capacity evidence', () => {
    const report = projectOrientationDiagnostics({
      sessions: [
        session({ capacity: 1 }),
        session({ sessionId: 'SESSION-CANCELLED', status: 'cancelled' }),
        session({ sessionId: '', scheduledFor: 'not-a-date', capacity: 0 }),
      ],
      reservations: [
        reservation(),
        reservation({ reservationId: 'RES-2', tmagId: 'TMAG-200', baName: 'Second BA' }),
        reservation({ reservationId: 'RES-ORPHAN', tmagId: 'TMAG-300', baName: 'Third BA', sessionId: 'MISSING' }),
        reservation({ reservationId: 'RES-MISMATCH', tmagId: 'TMAG-400', baName: 'Fourth BA', scheduledFor: '2026-07-16T12:00:00.000Z' }),
        reservation({ reservationId: 'RES-CANCELLED-SESSION', tmagId: 'TMAG-500', baName: 'Fifth BA', sessionId: 'SESSION-CANCELLED' }),
        reservation({ reservationId: 'RES-BAD', tmagId: '', baName: '', status: 'attended', scheduledFor: 'bad' }),
        reservation({ reservationId: 'RES-CANCEL-ORDER', tmagId: 'TMAG-600', baName: 'Sixth BA',
          status: 'cancelled', createdAt: '2026-07-11T12:00:00.000Z',
          cancelledAt: '2026-07-10T12:00:00.000Z' }),
      ],
      generatedAt: now,
    });
    const codes = new Set(report.findings.map((finding) => finding.code));

    expect(codes.has('invalid_session_record')).toBe(true);
    expect(codes.has('invalid_reservation_record')).toBe(true);
    expect(codes.has('reservation_without_session')).toBe(true);
    expect(codes.has('reservation_schedule_mismatch')).toBe(true);
    expect(codes.has('active_reservation_for_cancelled_session')).toBe(true);
    expect(codes.has('session_over_capacity')).toBe(true);
    expect(report.findings.every((finding) => finding.repairPolicy === 'report_only')).toBe(true);
  });

  it('reads only the two current Mongo authorities and exposes bounded-scan truth', async () => {
    const persistence = vi.fn(async (
      tool: string,
      action: string,
      params: Record<string, unknown>,
    ) => {
      expect(tool).toBe('mongodb');
      expect(action).toBe('query');
      if (params.collection === 'tmag_new_member_orientation_sessions') {
        return { documents: [session(), session({ sessionId: 'SESSION-2' }), session({ sessionId: 'SESSION-3' })] };
      }
      if (params.collection === 'tmag_new_member_orientation_reservations') {
        return { documents: [reservation()] };
      }
      throw new Error(`unexpected collection ${String(params.collection)}`);
    });

    const report = await buildAdminOrientationDiagnostic({
      limit: 2,
      now: () => new Date(now),
      persistence: persistence as never,
    });

    expect(persistence).toHaveBeenCalledTimes(2);
    expect(persistence.mock.calls.every((call) => call[1] === 'query')).toBe(true);
    expect(persistence.mock.calls.every((call) => call[2]?.limit === 3)).toBe(true);
    expect(report).toMatchObject({
      generatedAt: now,
      scanLimit: 2,
      scanLimitReached: { sessions: true, reservations: false },
      scanned: { sessions: 2, reservations: 1 },
      autoRepair: false,
    });
  });
});
