import { beforeEach, describe, expect, it, vi } from 'vitest';

const orientation = vi.hoisted(() => ({
  getSessionAvailabilityForBA: vi.fn(),
  listSessionsWithRosters: vi.fn(),
}));
const webinar = vi.hoisted(() => ({ listUpcomingWebinarEvents: vi.fn() }));
const persistence = vi.hoisted(() => ({ persistenceCall: vi.fn() }));

vi.mock('../orientationSession.js', () => orientation);
vi.mock('../webinarEvent.js', () => webinar);
vi.mock('../../services/persistence/dispatch.js', () => persistence);

import { getEventCenterForAdmin, getEventCenterForBA } from '../eventCenter.js';

const webinarEvent = {
  eventId: 'web_1', scheduledFor: '2026-08-01T00:00:00.000Z', hosts: ['Kevin'],
  zoomUrl: null, durationMinutes: 60, status: 'upcoming' as const,
  createdAt: '2026-07-01T00:00:00.000Z',
};

beforeEach(() => vi.resetAllMocks());

describe('Event Center read projection', () => {
  it('composes BA orientation and webinar truth without changing ownership', async () => {
    orientation.getSessionAvailabilityForBA.mockResolvedValue({ sessions: [{ sessionId: 'ori_1' }], myReservationSessionId: 'ori_1' });
    webinar.listUpcomingWebinarEvents.mockResolvedValue([webinarEvent]);
    const result = await getEventCenterForBA('TM-01');
    expect(result.sources).toEqual({ orientation: 'available', webinar: 'available' });
    expect(result.myOrientationReservationSessionId).toBe('ori_1');
    expect(result.webinarEvents[0]).toMatchObject({ eventId: 'web_1', audience: 'prospect', reservationMode: 'invitation_token_only' });
    expect(result.events).toEqual(expect.arrayContaining([
      expect.objectContaining({
        eventType: 'new_member_orientation',
        visibility: expect.objectContaining({ prospect: 'none' }),
        capacity: expect.objectContaining({ mode: 'limited' }),
        registration: expect.objectContaining({ owner: 'orientation', state: 'available' }),
        reminders: { owner: 'source_domain', status: 'not_configured', channels: [] },
        attendance: { state: 'not_recorded', recordedAt: null, inferred: false },
        followUp: { owner: 'human_crm', connection: 'not_connected', automated: false },
      }),
      expect.objectContaining({
        eventType: 'prospect_webinar',
        visibility: expect.objectContaining({ prospect: 'invitation_token_only' }),
        capacity: { mode: 'unlimited', limit: null, reserved: null, remaining: null },
        registration: expect.objectContaining({ mode: 'prospect_invitation_token', state: 'invitation_required' }),
      }),
    ]));
  });

  it('reports one source unavailable without erasing the other source', async () => {
    orientation.getSessionAvailabilityForBA.mockRejectedValue(new Error('orientation offline'));
    webinar.listUpcomingWebinarEvents.mockResolvedValue([webinarEvent]);
    const result = await getEventCenterForBA('TM-01');
    expect(result.sources).toEqual({ orientation: 'unavailable', webinar: 'available' });
    expect(result.orientationSessions).toEqual([]);
    expect(result.webinarEvents).toHaveLength(1);
  });

  it('counts webinar reservations for admin without treating them as attendance', async () => {
    orientation.listSessionsWithRosters.mockResolvedValue([]);
    webinar.listUpcomingWebinarEvents.mockResolvedValue([webinarEvent]);
    persistence.persistenceCall.mockResolvedValue({ documents: [{ eventId: 'web_1' }, { eventId: 'web_1' }] });
    const result = await getEventCenterForAdmin();
    expect(result.webinarEvents[0]).toMatchObject({ eventId: 'web_1', reservationCount: 2 });
    expect(result.webinarEvents[0]).not.toHaveProperty('attendanceCount');
    expect(result.events.find((event) => event.eventType === 'prospect_webinar')).toMatchObject({
      capacity: { mode: 'unlimited', limit: null, reserved: 2, remaining: null },
      attendance: { state: 'not_recorded', recordedAt: null, inferred: false },
      followUp: { owner: 'human_crm', connection: 'not_connected', automated: false },
    });
  });
});
