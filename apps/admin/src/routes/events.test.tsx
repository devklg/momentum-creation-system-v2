import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { EventsAdminPage } from './events';

afterEach(() => vi.unstubAllGlobals());

describe('Admin Event Center', () => {
  it('shows operations and preserves the attendance boundary', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({
      ok: true, sources: { orientation: 'available', webinar: 'available' },
      schemaVersion: 'event_center.v1.2',
      events: [{ eventId: 'webinar:web_1', sourceId: 'web_1', eventType: 'prospect_webinar', visibility: { team: 'authenticated', admin: 'founder_admin', prospect: 'invitation_token_only' }, capacity: { mode: 'unlimited', limit: null, reserved: 4, remaining: null }, registration: { owner: 'prospect_webinar', mode: 'prospect_invitation_token', state: 'invitation_required' }, reminders: { status: 'not_configured', channels: [] }, attendance: { state: 'not_recorded', inferred: false, counts: { recorded: 0, attended: 0, missed: 0, rescheduled: 0 } }, followUp: { owner: 'human_crm', connection: 'not_connected', automated: false, connectedCount: 0 } }],
      orientationSessions: [{ sessionId: 'ori_1', scheduledFor: '2026-08-01T17:00:00.000Z', hosts: ['Kevin'], status: 'upcoming', capacity: 10, seatsTaken: 3, seatsRemaining: 7 }],
      webinarEvents: [{ eventId: 'web_1', scheduledFor: '2026-08-02T17:00:00.000Z', hosts: ['Paul'], status: 'upcoming', reservationCount: 4 }],
      webinarReservations: [],
      pageInfo: { pageSize: 50, hasMore: false, nextCursor: null },
    }) })));
    render(<MemoryRouter><EventsAdminPage /></MemoryRouter>);
    expect(await screen.findByText('Event operations')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Manage orientation' })).toHaveAttribute('href', '/orientation');
    expect(screen.getByText(/Reservation counts do not prove attendance/)).toBeInTheDocument();
    expect(screen.getByText(/never infers attendance or contacts a prospect/)).toBeInTheDocument();
    expect(screen.getByText('Normalized event model')).toBeInTheDocument();
    expect(screen.getByText(/Not recorded · never inferred/)).toBeInTheDocument();
    expect(screen.getByText(/Human CRM · not connected · 0/)).toBeInTheDocument();
  });

  it('records confirmed attendance and explains that contact is not automated', async () => {
    const getPayload = {
      ok: true, schemaVersion: 'event_center.v1.2', sources: { orientation: 'available', webinar: 'available' }, events: [], orientationSessions: [],
      webinarEvents: [{ eventId: 'web_1', scheduledFor: '2026-08-02T17:00:00.000Z', hosts: ['Paul'], status: 'upcoming', reservationCount: 1 }],
      webinarReservations: [{ reservationId: 'r1', eventId: 'web_1', prospectId: 'p1', sponsorTmagId: 'TM-02', name: 'Pat Prospect', createdAt: '2026-07-01T00:00:00.000Z', attendance: null, attendanceRecordedAt: null, crmFollowUpDueAt: null }],
      pageInfo: { pageSize: 50, hasMore: false, nextCursor: null },
    };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => getPayload })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true, attendance: { state: 'attended', recordedAt: '2026-08-02T18:00:00.000Z' }, followUp: { dueAt: '2026-08-03T17:00:00.000Z', created: true, automatedContact: false } }) });
    vi.stubGlobal('fetch', fetchMock);
    render(<MemoryRouter><EventsAdminPage /></MemoryRouter>);
    const buttons = await screen.findAllByRole('button', { name: 'attended' });
    fireEvent.click(buttons[0]!);
    expect(await screen.findByText(/Human CRM follow-up created; no contact was sent/)).toBeInTheDocument();
    expect(fetchMock).toHaveBeenNthCalledWith(2, '/api/admin/events/webinars/web_1/reservations/r1/attendance', expect.objectContaining({ method: 'POST' }));
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('appends, deduplicates, and exposes an honest terminal state', async () => {
    const base = {
      ok: true, schemaVersion: 'event_center.v1.2', sources: { orientation: 'available', webinar: 'available' },
      dependencies: { attendance: 'available', crm: 'available' }, events: [], orientationSessions: [], webinarEvents: [],
    };
    const row = (reservationId: string, name: string) => ({ reservationId, eventId: 'web_1', prospectId: reservationId, sponsorTmagId: 'TM-02', name, createdAt: '2026-07-01T00:00:00.000Z', attendance: null, attendanceRecordedAt: null, crmFollowUpDueAt: null });
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ ...base, webinarReservations: [row('r1', 'First')], pageInfo: { pageSize: 1, hasMore: true, nextCursor: 'cursor-token-that-is-long-enough' } }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ ...base, webinarReservations: [row('r1', 'First updated'), row('r2', 'Second')], pageInfo: { pageSize: 1, hasMore: false, nextCursor: null } }) });
    vi.stubGlobal('fetch', fetchMock);
    render(<MemoryRouter><EventsAdminPage /></MemoryRouter>);
    fireEvent.click(await screen.findByRole('button', { name: 'Load more reservations' }));
    expect(await screen.findByText('Second')).toBeInTheDocument();
    expect(screen.getByText('First updated')).toBeInTheDocument();
    expect(screen.queryByText('First')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'All reservations loaded' })).toBeDisabled();
  });
});
