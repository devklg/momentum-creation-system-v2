import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { EventsAdminPage } from './events';

afterEach(() => vi.unstubAllGlobals());

describe('Admin Event Center', () => {
  it('shows operations and preserves the attendance boundary', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({
      ok: true, sources: { orientation: 'available', webinar: 'available' },
      orientationSessions: [{ sessionId: 'ori_1', scheduledFor: '2026-08-01T17:00:00.000Z', hosts: ['Kevin'], status: 'upcoming', capacity: 10, seatsTaken: 3, seatsRemaining: 7 }],
      webinarEvents: [{ eventId: 'web_1', scheduledFor: '2026-08-02T17:00:00.000Z', hosts: ['Paul'], status: 'upcoming', reservationCount: 4 }],
    }) })));
    render(<MemoryRouter><EventsAdminPage /></MemoryRouter>);
    expect(await screen.findByText('Event operations')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Manage orientation' })).toHaveAttribute('href', '/orientation');
    expect(screen.getByText(/Reservation counts do not prove attendance/)).toBeInTheDocument();
    expect(screen.getByText(/does not infer attendance or initiate follow-up/)).toBeInTheDocument();
  });
});
