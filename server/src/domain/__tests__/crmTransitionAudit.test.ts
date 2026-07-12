import { beforeEach, describe, expect, it, vi } from 'vitest';

const { persistenceCall, writeKnowledge, appendAuditEntry } = vi.hoisted(() => ({
  persistenceCall: vi.fn(),
  writeKnowledge: vi.fn(),
  appendAuditEntry: vi.fn(),
}));

vi.mock('../../services/persistence/dispatch.js', () => ({ persistenceCall }));
vi.mock('../../services/tieredWrite.js', () => ({
  writeKnowledge,
  writeOperational: vi.fn(),
}));
vi.mock('../auditLog.js', () => ({ appendAuditEntry }));

import { clearFollowUp, setDisposition, setFollowUp } from '../crm.js';
import { applyCrmLifecycleEvent } from '../prospectCrm.js';

const prospect = {
  prospectId: 'prospect_1',
  sponsorTmagId: 'TM-BA-1',
  state: 'video_complete',
  firstName: 'Pat',
  lastInitial: 'R.',
};
const ba = { tmagId: 'TM-BA-1', firstName: 'Ba', lastName: 'Owner' };

function mongoQueries(...documents: unknown[][]): void {
  const queue = [...documents];
  persistenceCall.mockImplementation((_tool: string, action: string) => {
    if (action === 'query') return Promise.resolve({ documents: queue.shift() ?? [] });
    return Promise.resolve({ ok: true });
  });
}

describe('P1-56 CRM transition audit entries', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    writeKnowledge.mockResolvedValue({ ok: true });
    appendAuditEntry.mockResolvedValue({ entryId: 'audit_1' });
  });

  it('audits scheduling a new follow-up after persistence succeeds', async () => {
    mongoQueries([prospect], [], [ba]);
    const dueAt = new Date(Date.now() + 86_400_000).toISOString();

    await setFollowUp(prospect.prospectId, prospect.sponsorTmagId, dueAt);

    expect(writeKnowledge).toHaveBeenCalledOnce();
    expect(appendAuditEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'ba.crm.follow_up.scheduled',
        actor: expect.objectContaining({ displayName: 'Ba Owner' }),
        before: { state: 'none', dueAt: null },
        after: { state: 'scheduled', dueAt },
      }),
    );
  });

  it('audits follow-up reschedule and clear with exact prior state', async () => {
    const oldDueAt = new Date(Date.now() + 43_200_000).toISOString();
    const newDueAt = new Date(Date.now() + 86_400_000).toISOString();
    const active = { ...prospect, dueAt: oldDueAt, createdAt: oldDueAt, clearedAt: null };
    mongoQueries([prospect], [active], [ba]);

    await setFollowUp(prospect.prospectId, prospect.sponsorTmagId, newDueAt);

    expect(appendAuditEntry).toHaveBeenLastCalledWith(
      expect.objectContaining({
        action: 'ba.crm.follow_up.rescheduled',
        before: { state: 'scheduled', dueAt: oldDueAt },
        after: { state: 'scheduled', dueAt: newDueAt },
      }),
    );

    vi.clearAllMocks();
    appendAuditEntry.mockResolvedValue({ entryId: 'audit_2' });
    mongoQueries([prospect], [active], [ba]);
    await clearFollowUp(prospect.prospectId, prospect.sponsorTmagId);

    expect(appendAuditEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'ba.crm.follow_up.cleared',
        before: { state: 'scheduled', dueAt: oldDueAt },
        after: expect.objectContaining({ state: 'cleared', dueAt: null }),
      }),
    );
  });

  it('does not audit an idempotent follow-up clear', async () => {
    mongoQueries([prospect], []);
    await clearFollowUp(prospect.prospectId, prospect.sponsorTmagId);
    expect(appendAuditEntry).not.toHaveBeenCalled();
  });

  it('does not mutate or audit an unchanged normalized follow-up date', async () => {
    const dueAt = new Date(Date.now() + 86_400_000).toISOString();
    mongoQueries([prospect], [{ ...prospect, dueAt, createdAt: dueAt, clearedAt: null }]);

    await setFollowUp(prospect.prospectId, prospect.sponsorTmagId, dueAt);

    expect(persistenceCall).toHaveBeenCalledTimes(2);
    expect(appendAuditEntry).not.toHaveBeenCalled();
  });

  it('audits disposition set, change, and clear but skips an unchanged value', async () => {
    mongoQueries([prospect], [], [ba]);
    await setDisposition(prospect.prospectId, prospect.sponsorTmagId, 'interested');
    expect(appendAuditEntry).toHaveBeenLastCalledWith(
      expect.objectContaining({
        action: 'ba.crm.disposition.set',
        before: { disposition: null },
        after: { disposition: 'interested' },
      }),
    );

    vi.clearAllMocks();
    appendAuditEntry.mockResolvedValue({ entryId: 'audit_2' });
    mongoQueries([prospect], [{ disposition: 'interested' }], [ba]);
    await setDisposition(prospect.prospectId, prospect.sponsorTmagId, 'later');
    expect(appendAuditEntry).toHaveBeenLastCalledWith(
      expect.objectContaining({
        action: 'ba.crm.disposition.changed',
        before: { disposition: 'interested' },
        after: { disposition: 'later' },
      }),
    );

    vi.clearAllMocks();
    appendAuditEntry.mockResolvedValue({ entryId: 'audit_3' });
    mongoQueries([prospect], [{ disposition: 'later' }], [ba]);
    await setDisposition(prospect.prospectId, prospect.sponsorTmagId, null);
    expect(appendAuditEntry).toHaveBeenLastCalledWith(
      expect.objectContaining({ action: 'ba.crm.disposition.cleared' }),
    );

    vi.clearAllMocks();
    mongoQueries([prospect], [{ disposition: 'interested' }]);
    await setDisposition(prospect.prospectId, prospect.sponsorTmagId, 'interested');
    expect(appendAuditEntry).not.toHaveBeenCalled();
  });

  it('audits only CRM lifecycle events that actually change status', async () => {
    const crmRecord = {
      crmRecordId: 'crm_prospect_1',
      prospectId: prospect.prospectId,
      leadId: null,
      leadOwnerId: null,
      vmCampaignId: null,
      token: 'token_1',
      ownerTmagId: prospect.sponsorTmagId,
      sponsorTmagId: prospect.sponsorTmagId,
      source: 'invite_token',
      status: 'inactive_pre_engagement',
      disposition: null,
      followUpDueAt: null,
      closedAt: null,
      closedReason: null,
      createdAt: '2026-07-11T00:00:00.000Z',
      updatedAt: '2026-07-11T00:00:00.000Z',
    };
    mongoQueries([crmRecord]);
    await applyCrmLifecycleEvent(prospect.prospectId, 'link_clicked', 'Link clicked');
    expect(appendAuditEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'system.crm.status_changed',
        before: { status: 'inactive_pre_engagement' },
        after: expect.objectContaining({ status: 'active', timelineEventKind: 'link_clicked' }),
      }),
    );

    vi.clearAllMocks();
    writeKnowledge.mockResolvedValue({ ok: true });
    mongoQueries([{ ...crmRecord, status: 'active' }]);
    await applyCrmLifecycleEvent(prospect.prospectId, 'activated', 'Activated');
    expect(appendAuditEntry).not.toHaveBeenCalled();
  });

  it('audits every CRM lifecycle status family', async () => {
    const cases = [
      ['inactive_pre_engagement', 'info_requested', 'needs_follow_up'],
      ['inactive_pre_engagement', 'presentation_started', 'watching'],
      ['watching', 'presentation_completed', 'presentation_completed'],
      ['presentation_completed', 'holding_tank', 'holding_tank'],
    ] as const;

    for (const [status, kind, expected] of cases) {
      vi.clearAllMocks();
      writeKnowledge.mockResolvedValue({ ok: true });
      appendAuditEntry.mockResolvedValue({ entryId: 'audit_family' });
      mongoQueries([{
        crmRecordId: 'crm_prospect_1', prospectId: prospect.prospectId,
        leadId: null, leadOwnerId: null, vmCampaignId: null, token: 'token_1',
        ownerTmagId: prospect.sponsorTmagId, sponsorTmagId: prospect.sponsorTmagId,
        source: 'invite_token', status, disposition: null, followUpDueAt: null,
        closedAt: null, closedReason: null, createdAt: '2026-07-11T00:00:00.000Z',
        updatedAt: '2026-07-11T00:00:00.000Z',
      }]);

      await applyCrmLifecycleEvent(prospect.prospectId, kind, kind);
      expect(appendAuditEntry).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'system.crm.status_changed',
          before: { status },
          after: expect.objectContaining({ status: expected, timelineEventKind: kind }),
        }),
      );
    }
  });

  it('does not audit when a mutation write fails', async () => {
    mongoQueries([prospect], []);
    writeKnowledge.mockRejectedValue(new Error('write failed'));
    const dueAt = new Date(Date.now() + 86_400_000).toISOString();

    await expect(
      setFollowUp(prospect.prospectId, prospect.sponsorTmagId, dueAt),
    ).rejects.toThrow('write failed');
    expect(appendAuditEntry).not.toHaveBeenCalled();
  });

  it('does not audit a reschedule or lifecycle transition before all writes finish', async () => {
    const dueAt = new Date(Date.now() + 86_400_000).toISOString();
    const oldDueAt = new Date(Date.now() + 43_200_000).toISOString();
    const queue = [[prospect], [{ ...prospect, dueAt: oldDueAt, createdAt: oldDueAt, clearedAt: null }]];
    persistenceCall.mockImplementation((_tool: string, action: string) => {
      if (action === 'query') return Promise.resolve({ documents: queue.shift() ?? [] });
      return Promise.reject(new Error('update failed'));
    });
    await expect(setFollowUp(prospect.prospectId, prospect.sponsorTmagId, dueAt))
      .rejects.toThrow('update failed');
    expect(appendAuditEntry).not.toHaveBeenCalled();

    vi.clearAllMocks();
    const crmRecord = {
      crmRecordId: 'crm_prospect_1', prospectId: prospect.prospectId,
      leadId: null, leadOwnerId: null, vmCampaignId: null, token: 'token_1',
      ownerTmagId: prospect.sponsorTmagId, sponsorTmagId: prospect.sponsorTmagId,
      source: 'invite_token', status: 'inactive_pre_engagement', disposition: null,
      followUpDueAt: null, closedAt: null, closedReason: null,
      createdAt: '2026-07-11T00:00:00.000Z', updatedAt: '2026-07-11T00:00:00.000Z',
    };
    mongoQueries([crmRecord]);
    writeKnowledge.mockRejectedValue(new Error('timeline failed'));
    await expect(applyCrmLifecycleEvent(prospect.prospectId, 'link_clicked', 'clicked'))
      .rejects.toThrow('timeline failed');
    expect(appendAuditEntry).not.toHaveBeenCalled();
  });
});
