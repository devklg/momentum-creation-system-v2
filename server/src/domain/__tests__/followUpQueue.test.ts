import { beforeEach, describe, expect, it, vi } from 'vitest';

const persistence = vi.hoisted(() => ({ persistenceCall: vi.fn() }));
vi.mock('../../services/persistence/dispatch.js', () => persistence);

import { getUnifiedFollowUpQueue } from '../followUpQueue.js';

const NOW = new Date('2026-07-13T20:00:00.000Z');

beforeEach(() => vi.resetAllMocks());

describe('P2-107 unified follow-up queue', () => {
  it('merges prospect and VM/RVM raised hands and reminders in human-action order', async () => {
    persistence.persistenceCall
      .mockResolvedValueOnce({ documents: [
        { callbackRequestId: 'cb-prospect', prospectId: 'p1', sponsorTmagId: 'TM-01', intent: 'have_questions', createdAt: '2026-07-13T18:00:00.000Z' },
        { callbackRequestId: 'cb-vm', prospectId: null, leadId: 'l1', ownerTmagId: 'TM-01', intent: 'interested_tell_me_more', createdAt: '2026-07-13T19:00:00.000Z' },
      ] })
      .mockResolvedValueOnce({ documents: [
        { followUpId: 'fu-p1', prospectId: 'p1', sponsorTmagId: 'TM-01', dueAt: '2026-07-12T20:00:00.000Z', clearedAt: null },
        { followUpId: 'fu-p2', prospectId: 'p2', sponsorTmagId: 'TM-01', dueAt: '2026-07-11T20:00:00.000Z', clearedAt: null },
        { followUpId: 'fu-l2', leadId: 'l2', ownerTmagId: 'TM-01', dueAt: '2026-07-15T20:00:00.000Z', clearedAt: null },
      ] })
      .mockResolvedValueOnce({ documents: [
        { prospectId: 'p1', firstName: 'Ana', lastName: 'Jones' },
        { prospectId: 'p2', firstName: 'Ben', lastName: 'King' },
      ] })
      .mockResolvedValueOnce({ documents: [
        { leadId: 'l1', firstName: 'Cara', lastName: 'Lane' },
        { leadId: 'l2', firstName: 'Dev', lastName: 'Moon' },
      ] });

    const result = await getUnifiedFollowUpQueue('TM-01', NOW);

    expect(result.manualOnly).toBe(true);
    expect(result.counts).toEqual({ total: 4, raisedHands: 2, overdue: 1, upcoming: 1 });
    expect(result.items.map((item) => [item.entityId, item.status, item.source])).toEqual([
      ['l1', 'raised_hand', 'vm_rvm'],
      ['p1', 'raised_hand', 'prospect_crm'],
      ['p2', 'overdue', 'prospect_crm'],
      ['l2', 'upcoming', 'vm_rvm'],
    ]);
    expect(result.items.find((item) => item.entityId === 'p1')?.reason).toBe('callback_request');
    expect(result.items.find((item) => item.entityId === 'l2')?.href).toBe('/vm-campaigns');
  });

  it('scopes every source to the authenticated BA and drops orphaned evidence', async () => {
    persistence.persistenceCall
      .mockResolvedValueOnce({ documents: [
        { callbackRequestId: 'orphan', prospectId: 'missing', sponsorTmagId: 'TM-01', intent: 'have_questions', createdAt: '2026-07-13T18:00:00.000Z' },
      ] })
      .mockResolvedValueOnce({ documents: [] })
      .mockResolvedValueOnce({ documents: [] })
      .mockResolvedValueOnce({ documents: [] });

    const result = await getUnifiedFollowUpQueue('TM-01', NOW);
    expect(result.items).toEqual([]);
    expect(persistence.persistenceCall).toHaveBeenNthCalledWith(1, 'mongodb', 'query', expect.objectContaining({
      filter: expect.objectContaining({ $or: [{ sponsorTmagId: 'TM-01' }, { ownerTmagId: 'TM-01' }] }),
    }));
    expect(persistence.persistenceCall).toHaveBeenNthCalledWith(4, 'mongodb', 'query', expect.objectContaining({
      filter: { ownerTmagId: 'TM-01' },
    }));
  });
});
