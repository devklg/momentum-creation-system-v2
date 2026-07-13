import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { EventsPage } from '../events';

afterEach(() => vi.unstubAllGlobals());

describe('BA Event Center', () => {
  it('shows source-owned orientation and webinar events', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === '/api/events') return { ok: true, json: async () => ({
        ok: true, schemaVersion: 'event_center.v1', sources: { orientation: 'available', webinar: 'available' },
        myOrientationReservationSessionId: null,
        orientationSessions: [{ sessionId: 'ori_1', scheduledFor: '2026-08-01T17:00:00.000Z', hosts: ['Kevin', 'Paul'], capacity: 10, seatsRemaining: 7, durationMinutes: 60, reservedByMe: false }],
        webinarEvents: [{ eventId: 'web_1', scheduledFor: '2026-08-02T17:00:00.000Z', hosts: ['Kevin', 'Paul'], durationMinutes: 60, status: 'upcoming', reservationMode: 'invitation_token_only' }],
      }) };
      return { ok: true, json: async () => ({ ok: true, items: [] }) };
    }));
    render(<MemoryRouter><EventsPage /></MemoryRouter>);
    expect(await screen.findByText('New-member orientation')).toBeInTheDocument();
    expect(screen.getByText('Prospect webinars')).toBeInTheDocument();
    expect(screen.getByText('Invitation link only')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reserve seat' })).toBeInTheDocument();
  });
});
