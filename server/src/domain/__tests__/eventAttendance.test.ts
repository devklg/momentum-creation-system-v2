import { beforeEach, describe, expect, it, vi } from 'vitest';

const persistence = vi.hoisted(() => ({ persistenceCall: vi.fn() }));
const tiered = vi.hoisted(() => ({ writeOperational: vi.fn() }));
const audit = vi.hoisted(() => ({ appendAuditEntry: vi.fn() }));
const crm = vi.hoisted(() => ({ getActiveFollowUp: vi.fn(), setFollowUp: vi.fn() }));

vi.mock('../../services/persistence/dispatch.js', () => persistence);
vi.mock('../../services/tieredWrite.js', () => tiered);
vi.mock('../auditLog.js', () => audit);
vi.mock('../crm.js', () => crm);

import { recordWebinarAttendance } from '../eventAttendance.js';

const actor = { kind: 'admin' as const, tmagId: 'TM-01', displayName: 'Kevin' };
const reservation = {
  reservationId: 'res_1', eventId: 'web_1', token: 'tok', prospectId: 'prospect_1',
  sponsorTmagId: 'TM-02', name: 'Prospect One', email: 'p@example.com',
  createdAt: '2026-07-01T00:00:00.000Z', emailDeliveryStatus: 'sent' as const,
  emailDeliveryError: null, smsDeliveryStatus: 'sent' as const, smsDeliveryError: null,
};

beforeEach(() => {
  vi.resetAllMocks();
  tiered.writeOperational.mockResolvedValue({});
  audit.appendAuditEntry.mockResolvedValue({});
});

describe('P2-106 webinar attendance to CRM follow-up', () => {
  it('rejects a missing reservation and never infers attendance', async () => {
    persistence.persistenceCall.mockResolvedValue({ documents: [] });
    await expect(recordWebinarAttendance({ eventId: 'web_1', reservationId: 'missing', state: 'attended', actor }))
      .rejects.toThrow('reservation_not_found');
    expect(tiered.writeOperational).not.toHaveBeenCalled();
    expect(crm.setFollowUp).not.toHaveBeenCalled();
  });

  it('records explicit attendance and preserves an existing human reminder', async () => {
    persistence.persistenceCall
      .mockResolvedValueOnce({ documents: [reservation] })
      .mockResolvedValueOnce({ documents: [] });
    crm.getActiveFollowUp.mockResolvedValue({
      prospectId: 'prospect_1', sponsorTmagId: 'TM-02', dueAt: '2026-08-03T00:00:00.000Z',
      createdAt: '2026-08-01T00:00:00.000Z', clearedAt: null,
    });
    const result = await recordWebinarAttendance({ eventId: 'web_1', reservationId: 'res_1', state: 'missed', actor });
    expect(tiered.writeOperational).toHaveBeenCalledWith(expect.objectContaining({
      mongoCollection: 'tmag_event_attendance',
      mongoDoc: expect.objectContaining({ state: 'missed', prospectId: 'prospect_1', sponsorTmagId: 'TM-02' }),
    }));
    expect(crm.setFollowUp).not.toHaveBeenCalled();
    expect(result.followUp).toEqual({ connection: 'available', dueAt: '2026-08-03T00:00:00.000Z', created: false, automatedContact: false });
  });

  it('creates a deterministic human CRM reminder without contacting the prospect', async () => {
    persistence.persistenceCall
      .mockResolvedValueOnce({ documents: [reservation] })
      .mockResolvedValueOnce({ documents: [] });
    crm.getActiveFollowUp.mockResolvedValue(null);
    crm.setFollowUp.mockImplementation(async (_prospectId: string, _sponsor: string, dueAt: string) => ({
      prospectId: 'prospect_1', sponsorTmagId: 'TM-02', dueAt,
      createdAt: '2026-08-01T00:00:00.000Z', clearedAt: null,
    }));
    const result = await recordWebinarAttendance({ eventId: 'web_1', reservationId: 'res_1', state: 'attended', actor });
    expect(crm.setFollowUp).toHaveBeenCalledWith(
      'prospect_1', 'TM-02', expect.any(String),
      expect.objectContaining({ actor, scheduledAction: 'admin.events.crm_follow_up.scheduled' }),
    );
    expect(result.followUp.created).toBe(true);
    expect(result.followUp.automatedContact).toBe(false);
  });

  it('is retry-safe for the same latest attendance state', async () => {
    const prior = {
      attendanceId: 'attendance_1', eventId: 'web_1', reservationId: 'res_1', eventType: 'prospect_webinar' as const,
      prospectId: 'prospect_1', sponsorTmagId: 'TM-02', state: 'attended' as const,
      recordedAt: new Date(Date.now() - 1000).toISOString(), recordedByTmagId: 'TM-01',
      crmFollowUpDueAt: new Date(Date.now() + 60_000).toISOString(),
    };
    persistence.persistenceCall
      .mockResolvedValueOnce({ documents: [reservation] })
      .mockResolvedValueOnce({ documents: [prior] });
    await recordWebinarAttendance({ eventId: 'web_1', reservationId: 'res_1', state: 'attended', actor });
    expect(tiered.writeOperational).not.toHaveBeenCalled();
    expect(audit.appendAuditEntry).not.toHaveBeenCalled();
    expect(crm.getActiveFollowUp).not.toHaveBeenCalled();
  });
});
