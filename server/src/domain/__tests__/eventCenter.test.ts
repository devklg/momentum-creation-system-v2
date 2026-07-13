import { beforeEach, describe, expect, it, vi } from 'vitest';

const orientation = vi.hoisted(() => ({
  getSessionAvailabilityForBA: vi.fn(),
  listSessionsWithRosters: vi.fn(),
}));
const webinar = vi.hoisted(() => ({ listUpcomingWebinarEvents: vi.fn() }));
const persistence = vi.hoisted(() => ({ persistenceCall: vi.fn() }));
const attendance = vi.hoisted(() => ({ listLatestWebinarAttendance: vi.fn() }));

vi.mock('../orientationSession.js', () => orientation);
vi.mock('../webinarEvent.js', () => webinar);
vi.mock('../../services/persistence/dispatch.js', () => persistence);
vi.mock('../eventAttendance.js', () => attendance);

import { getEventCenterForAdmin, getEventCenterForBA } from '../eventCenter.js';

const webinarEvent = {
  eventId: 'web_1', scheduledFor: '2026-08-01T00:00:00.000Z', hosts: ['Kevin'],
  zoomUrl: null, durationMinutes: 60, status: 'upcoming' as const,
  createdAt: '2026-07-01T00:00:00.000Z',
};

beforeEach(() => {
  vi.resetAllMocks();
  attendance.listLatestWebinarAttendance.mockResolvedValue(new Map());
});

describe('Event Center read projection', () => {
  it('orders mixed-offset event timestamps by their actual instant', async () => {
    orientation.getSessionAvailabilityForBA.mockResolvedValue({
      sessions: [{
        sessionId: 'ori_later', scheduledFor: '2026-11-01T01:30:00-08:00', hosts: ['Kevin'],
        durationMinutes: 60, capacity: 10, seatsTaken: 0, seatsRemaining: 10, reservedByMe: false,
      }],
      myReservationSessionId: null,
    });
    webinar.listUpcomingWebinarEvents.mockResolvedValue([{
      ...webinarEvent,
      eventId: 'web_earlier',
      scheduledFor: '2026-11-01T08:45:00.000Z',
    }]);

    const result = await getEventCenterForBA('TM-01');
    expect(result.events.map((event) => event.sourceId)).toEqual(['web_earlier', 'ori_later']);
  });

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
        attendance: { state: 'not_recorded', recordedAt: null, inferred: false, counts: { recorded: 0, attended: 0, missed: 0, rescheduled: 0 } },
        followUp: { owner: 'human_crm', connection: 'not_connected', automated: false, connectedCount: 0 },
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
    persistence.persistenceCall
      .mockResolvedValueOnce({ documents: [
        { reservationId: 'r1', eventId: 'web_1', prospectId: 'p1', sponsorTmagId: 'TM-01', name: 'A', createdAt: '2026-07-01T00:00:00.000Z' },
        { reservationId: 'r2', eventId: 'web_1', prospectId: 'p2', sponsorTmagId: 'TM-01', name: 'B', createdAt: '2026-07-01T00:00:00.000Z' },
      ] })
      .mockResolvedValueOnce({ documents: [] });
    const result = await getEventCenterForAdmin();
    expect(result.webinarEvents[0]).toMatchObject({ eventId: 'web_1', reservationCount: 2 });
    expect(result.webinarEvents[0]).not.toHaveProperty('attendanceCount');
    expect(result.events.find((event) => event.eventType === 'prospect_webinar')).toMatchObject({
      capacity: { mode: 'unlimited', limit: null, reserved: 2, remaining: null },
      attendance: { state: 'not_recorded', recordedAt: null, inferred: false, counts: { recorded: 0, attended: 0, missed: 0, rescheduled: 0 } },
      followUp: { owner: 'human_crm', connection: 'not_connected', automated: false, connectedCount: 0 },
    });
    expect(result.webinarReservations).toHaveLength(2);
  });

  it('projects explicit attendance and an available human CRM connection', async () => {
    orientation.listSessionsWithRosters.mockResolvedValue([]);
    webinar.listUpcomingWebinarEvents.mockResolvedValue([webinarEvent]);
    persistence.persistenceCall
      .mockResolvedValueOnce({ documents: [
        { reservationId: 'r1', eventId: 'web_1', prospectId: 'p1', sponsorTmagId: 'TM-01', name: 'A', createdAt: '2026-07-01T00:00:00.000Z' },
      ] })
      .mockResolvedValueOnce({ documents: [
        { prospectId: 'p1', sponsorTmagId: 'TM-01', dueAt: '2026-08-02T00:00:00.000Z', createdAt: '2026-08-01T00:00:00.000Z', clearedAt: null },
      ] });
    attendance.listLatestWebinarAttendance.mockResolvedValue(new Map([['r1', {
      attendanceId: 'a1', eventId: 'web_1', reservationId: 'r1', eventType: 'prospect_webinar',
      prospectId: 'p1', sponsorTmagId: 'TM-01', state: 'attended',
      recordedAt: '2026-08-01T01:00:00.000Z', recordedByTmagId: 'TM-01', crmFollowUpDueAt: '2026-08-02T00:00:00.000Z',
    }]]));
    const result = await getEventCenterForAdmin();
    expect(result.events[0]).toMatchObject({
      attendance: { state: 'recorded', inferred: false, counts: { recorded: 1, attended: 1, missed: 0, rescheduled: 0 } },
      followUp: { owner: 'human_crm', connection: 'available', automated: false, connectedCount: 1 },
    });
    expect(result.webinarReservations[0]).toMatchObject({ attendance: 'attended', crmFollowUpDueAt: '2026-08-02T00:00:00.000Z' });
  });
});
