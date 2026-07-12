import { beforeEach, describe, expect, it, vi } from 'vitest';

const { persistenceCall, appendAuditEntry } = vi.hoisted(() => ({
  persistenceCall: vi.fn(),
  appendAuditEntry: vi.fn(),
}));

vi.mock('../../services/persistence/dispatch.js', () => ({ persistenceCall }));
vi.mock('../auditLog.js', () => ({ appendAuditEntry }));

import { runCrmCleanup } from '../crmCleanup.js';

const crm: {
  crmRecordId: string;
  prospectId: string;
  ownerTmagId: string;
  sponsorTmagId: string;
  status: string;
  followUpDueAt: string | null;
} = {
  crmRecordId: 'crm_p1', prospectId: 'p1', ownerTmagId: 'BA1', sponsorTmagId: 'BA1',
  status: 'active', followUpDueAt: null,
};
const followUp = {
  followUpId: 'fu1', prospectId: 'p1', sponsorTmagId: 'BA1',
  dueAt: '2020-01-01T00:00:00.000Z', createdAt: '2019-12-01T00:00:00.000Z', clearedAt: null,
};

function scans(prospects: unknown[], crmRows = [crm], followUps = [followUp]): void {
  persistenceCall
    .mockResolvedValueOnce({ documents: crmRows })
    .mockResolvedValueOnce({ documents: followUps })
    .mockResolvedValueOnce({ documents: prospects });
}

describe('P1-57 CRM cleanup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    appendAuditEntry.mockResolvedValue({ entryId: 'audit_1' });
  });

  it('defaults to a bounded dry run and never age-clears an ordinary overdue reminder', async () => {
    scans([{ prospectId: 'p1', state: 'video_complete' }]);
    const result = await runCrmCleanup({ limit: 99_999 });

    expect(result.dryRun).toBe(true);
    expect(result.actions).toEqual([
      expect.objectContaining({ kind: 'sync_crm_followup_due_at', applied: false }),
    ]);
    expect(persistenceCall).toHaveBeenCalledTimes(3);
    expect(persistenceCall.mock.calls[0]?.[2]).toEqual(expect.objectContaining({ limit: 500 }));
    expect(appendAuditEntry).not.toHaveBeenCalled();
  });

  it.each(['enrolled', 'expired'])('clears a %s prospect follow-up and nulls CRM dueAt', async (state) => {
    scans([{ prospectId: 'p1', state }], [{ ...crm, followUpDueAt: followUp.dueAt }]);
    persistenceCall
      .mockResolvedValueOnce({ ok: true })
      .mockResolvedValueOnce({ documents: [{ ...followUp, clearedAt: '2026-07-11T12:00:00.000Z' }] })
      .mockResolvedValueOnce({ ok: true })
      .mockResolvedValueOnce({ ok: true })
      .mockResolvedValueOnce({ documents: [{ ...crm, followUpDueAt: null }] });

    const result = await runCrmCleanup({
      dryRun: false,
      now: () => new Date('2026-07-11T12:00:00.000Z'),
    });

    expect(result.applied).toBe(2);
    expect(result.errors).toEqual([]);
    expect(appendAuditEntry).toHaveBeenCalledTimes(2);
    expect(appendAuditEntry).toHaveBeenNthCalledWith(1, expect.objectContaining({
      actor: { kind: 'system', label: 'crm_cleanup' },
      action: 'system.crm.follow_up.cleared_terminal',
      reason: `prospect_${state}`,
    }));
  });

  it('does not mutate an orphan solely because the prospect is missing', async () => {
    scans([], [{ ...crm, followUpDueAt: followUp.dueAt }]);
    const result = await runCrmCleanup();
    expect(result.actions).toEqual([]);
  });

  it('treats an explicitly closed CRM as deterministic terminal evidence', async () => {
    scans([], [{ ...crm, status: 'closed', followUpDueAt: followUp.dueAt }]);
    const result = await runCrmCleanup();
    expect(result.actions[0]).toEqual(expect.objectContaining({
      kind: 'clear_terminal_followup',
      reason: 'crm_closed',
    }));
  });

  it('reconciles an obsolete CRM due date to null when no active reminder exists', async () => {
    scans([{ prospectId: 'p1', state: 'video_complete' }], [{ ...crm, followUpDueAt: followUp.dueAt }], []);
    persistenceCall
      .mockResolvedValueOnce({ ok: true })
      .mockResolvedValueOnce({ documents: [{ ...crm, followUpDueAt: null }] });

    const result = await runCrmCleanup({ dryRun: false });
    expect(result.applied).toBe(1);
    expect(appendAuditEntry).toHaveBeenCalledWith(expect.objectContaining({
      action: 'system.crm.follow_up_due_at.reconciled',
      reason: 'no_active_followup',
    }));
  });

  it('uses conditional filters, verifies mutations, and collects failures without aborting', async () => {
    const crm2 = { ...crm, crmRecordId: 'crm_p2', prospectId: 'p2', followUpDueAt: '2025-01-01T00:00:00.000Z' };
    scans(
      [{ prospectId: 'p1', state: 'enrolled' }, { prospectId: 'p2', state: 'video_complete' }],
      [crm, crm2],
      [followUp],
    );
    persistenceCall
      .mockResolvedValueOnce({ ok: true })
      .mockResolvedValueOnce({ documents: [] })
      .mockResolvedValueOnce({ ok: true })
      .mockResolvedValueOnce({ documents: [{ ...crm2, followUpDueAt: null }] });

    const result = await runCrmCleanup({ dryRun: false });

    expect(result.errors).toEqual([
      expect.objectContaining({ prospectId: 'p1', kind: 'clear_terminal_followup' }),
    ]);
    expect(result.applied).toBe(1);
    expect(appendAuditEntry).toHaveBeenCalledOnce();
    const update = persistenceCall.mock.calls.find((call) => call[1] === 'update' && call[2].collection === 'tmag_prospect_crm_followups');
    expect(update?.[2].filter).toEqual(expect.objectContaining({ followUpId: 'fu1', dueAt: followUp.dueAt, clearedAt: null }));
  });
});
