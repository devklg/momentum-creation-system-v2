import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { OrientationPage } from './orientation';

afterEach(() => vi.unstubAllGlobals());

const sessions = {
  ok: true,
  sessions: [],
};

describe('Admin orientation diagnostic', () => {
  it('shows report-only findings without attendance, completion, or repair claims', async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      if (String(input).endsWith('/diagnostic')) {
        return {
          ok: true,
          json: async () => ({
            ok: true,
            schemaVersion: 'orientation_diagnostic.v1',
            stateSchemaVersion: 'orientation_state.v1',
            generatedAt: '2026-07-14T01:00:00.000Z',
            policy: 'report_only',
            sourceAuthority: { sessions: 'tmag_new_member_orientation_sessions', reservations: 'tmag_new_member_orientation_reservations' },
            attendanceAuthority: null,
            completionAuthority: null,
            scanLimit: 1000,
            scanLimitReached: { sessions: false, reservations: false },
            scanned: { sessions: 2, reservations: 3 },
            totals: { stuck: 1, duplicate: 0, inconsistent: 1, findings: 2 },
            findings: [
              {
                category: 'stuck',
                code: 'elapsed_active_reservation',
                sessionId: 'SESSION-1',
                reservationId: 'RES-1',
                tmagId: 'TMAG-01',
                detail: 'Active reservation remains after the session time elapsed; attendance and completion remain unverified.',
                evidence: {},
                repairPolicy: 'report_only',
              },
              {
                category: 'inconsistent',
                code: 'reservation_without_session',
                sessionId: 'MISSING',
                reservationId: 'RES-2',
                tmagId: 'TMAG-02',
                detail: 'Reservation references no current orientation session record.',
                evidence: {},
                repairPolicy: 'report_only',
              },
            ],
          }),
        };
      }
      return { ok: true, json: async () => sessions };
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<OrientationPage />);

    expect(await screen.findByText('Orientation Record Diagnostic')).toBeTruthy();
    expect(screen.getByText(/never repairs records or infers attendance or completion/i)).toBeTruthy();
    expect(screen.getByText('elapsed active reservation')).toBeTruthy();
    expect(screen.getByText('reservation without session')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /repair|resolve|complete/i })).toBeNull();
    expect(fetchMock).toHaveBeenCalledWith('/api/admin/orientation/diagnostic', {
      credentials: 'include',
    });
  });

  it('shows honest empty and bounded-scan states', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: string | URL | Request) => ({
      ok: true,
      json: async () => String(input).endsWith('/diagnostic')
        ? {
            ok: true,
            schemaVersion: 'orientation_diagnostic.v1',
            stateSchemaVersion: 'orientation_state.v1',
            generatedAt: '2026-07-14T01:00:00.000Z',
            policy: 'report_only',
            sourceAuthority: { sessions: 'tmag_new_member_orientation_sessions', reservations: 'tmag_new_member_orientation_reservations' },
            attendanceAuthority: null,
            completionAuthority: null,
            scanLimit: 10,
            scanLimitReached: { sessions: true, reservations: false },
            scanned: { sessions: 10, reservations: 0 },
            totals: { stuck: 0, duplicate: 0, inconsistent: 0, findings: 0 },
            findings: [],
          }
        : sessions,
    })));

    render(<OrientationPage />);

    expect(await screen.findByText('No orientation record findings in the bounded scan.')).toBeTruthy();
    expect(screen.getByText(/totals may be incomplete/i)).toBeTruthy();
    expect(screen.getByText(/Attendance authority: none. Completion authority: none./)).toBeTruthy();
  });
});
