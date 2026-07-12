/**
 * Work-the-lead writes: owner-scoped, canonical CRM values only, suppression
 * fail-closed, read-backs enforced.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  persistenceCall: vi.fn(),
  writeOperational: vi.fn(),
  writeKnowledge: vi.fn(),
}));

vi.mock('../../services/persistence/dispatch.js', () => ({
  persistenceCall: mocks.persistenceCall,
}));

vi.mock('../../services/tieredWrite.js', () => ({
  writeOperational: mocks.writeOperational,
  writeKnowledge: mocks.writeKnowledge,
}));

import {
  addLeadNote,
  getLeadInvite,
  markLeadDoNotCall,
  setLeadDisposition,
  setLeadFollowUp,
  VmLeadWorkError,
} from '../vmLeadWork.js';

const OWNER = 'TMBA-1';

const lead = {
  leadId: 'lead_1',
  importJobId: 'import_1',
  leadOwnerId: 'lo_1',
  vmCampaignId: 'vm_1',
  ownerTmagId: OWNER,
  sponsorTmagId: OWNER,
  sourceLabel: 'test',
  sourceLeadId: null,
  firstName: 'Pat',
  lastName: 'Lead',
  phone: '+13235550100',
  normalizedPhone: '+13235550100',
  email: null,
  normalizedEmail: null,
  city: 'Los Angeles',
  stateOrRegion: 'CA',
  country: 'US',
  consentStatus: 'unknown',
  dedupeKey: 'd',
  status: 'callback_requested',
  token: 'tok_1',
  crmRecordId: 'crm_1',
  validationIssues: [],
  activatedAt: null,
  createdAt: '2026-07-11T00:00:00.000Z',
  updatedAt: '2026-07-11T00:00:00.000Z',
};

/**
 * Tiny in-memory Mongo stand-in: inserts land through the mocked tiered
 * writers, updates $set into matching docs, queries filter on equality of a
 * few known fields — enough to exercise read-backs for real.
 */
function buildFakeStore(seed: Record<string, Array<Record<string, unknown>>>) {
  const store: Record<string, Array<Record<string, unknown>>> = JSON.parse(JSON.stringify(seed));

  const matches = (doc: Record<string, unknown>, filter: Record<string, unknown>): boolean =>
    Object.entries(filter).every(([key, value]) => {
      if (value !== null && typeof value === 'object') return true; // operators — accept
      return doc[key] === value;
    });

  mocks.persistenceCall.mockImplementation(
    async (tool: string, action: string, params: Record<string, unknown>) => {
      if (tool !== 'mongodb') return { documents: [], results: [], count: 0 };
      const collection = params.collection as string;
      const docs = store[collection] ?? [];
      if (action === 'query') {
        const filtered = docs.filter((doc) => matches(doc, (params.filter as Record<string, unknown>) ?? {}));
        return { documents: filtered, count: filtered.length };
      }
      if (action === 'update') {
        const filter = (params.filter as Record<string, unknown>) ?? {};
        const update = (params.update as { $set?: Record<string, unknown> }) ?? {};
        for (const doc of docs) {
          if (matches(doc, filter) && update.$set) Object.assign(doc, update.$set);
        }
        return { ok: true };
      }
      return { documents: [], results: [], count: 0 };
    },
  );

  const insertViaTieredWrite = async (input: { mongoCollection: string; mongoDoc: Record<string, unknown> }) => {
    store[input.mongoCollection] = store[input.mongoCollection] ?? [];
    store[input.mongoCollection]!.push({ ...input.mongoDoc });
    return { tier: 'knowledge', id: 'x', mongo: { ok: true, verified: true } };
  };
  mocks.writeKnowledge.mockImplementation(insertViaTieredWrite as never);
  mocks.writeOperational.mockImplementation(insertViaTieredWrite as never);

  return store;
}

beforeEach(() => {
  mocks.persistenceCall.mockReset();
  mocks.writeOperational.mockReset();
  mocks.writeKnowledge.mockReset();
});

describe('vmLeadWork', () => {
  it('rejects a non-canonical disposition', async () => {
    buildFakeStore({ tmag_vm_bulk_leads: [lead] });
    await expect(
      setLeadDisposition({ leadId: 'lead_1', ownerTmagId: OWNER, disposition: 'hot_lead' as never }),
    ).rejects.toThrow('invalid_disposition');
  });

  it('rejects work on another owner’s lead as lead_not_found', async () => {
    buildFakeStore({ tmag_vm_bulk_leads: [lead] });
    await expect(
      setLeadDisposition({ leadId: 'lead_1', ownerTmagId: 'TMBA-INTRUDER', disposition: 'interested' }),
    ).rejects.toThrow('lead_not_found');
    await expect(
      addLeadNote({ leadId: 'lead_1', ownerTmagId: 'TMBA-INTRUDER', text: 'nope' }),
    ).rejects.toThrow('lead_not_found');
  });

  it('sets a canonical disposition, mirrors it onto the CRM record, and reads it back', async () => {
    const store = buildFakeStore({
      tmag_vm_bulk_leads: [lead],
      tmag_prospect_crm_records: [{ crmRecordId: 'crm_1', disposition: null }],
      tmag_prospect_crm_dispositions: [],
    });

    const result = await setLeadDisposition({ leadId: 'lead_1', ownerTmagId: OWNER, disposition: 'interested' });

    expect(result).toBe('interested');
    expect(store.tmag_prospect_crm_dispositions?.[0]?.disposition).toBe('interested');
    expect(store.tmag_prospect_crm_records?.[0]?.disposition).toBe('interested');
    // Timeline evidence
    const timeline = store.tmag_prospect_timeline_events ?? [];
    expect(timeline.some((e) => e.kind === 'disposition_changed')).toBe(true);
  });

  it('appends a timestamped note with note_added timeline evidence', async () => {
    const store = buildFakeStore({ tmag_vm_bulk_leads: [lead] });

    const note = await addLeadNote({ leadId: 'lead_1', ownerTmagId: OWNER, text: '  Great call, wants info  ' });

    expect(note.text).toBe('Great call, wants info');
    expect(note.createdAt).toBeTruthy();
    expect(store.tmag_prospect_crm_notes?.[0]?.text).toBe('Great call, wants info');
    expect((store.tmag_prospect_timeline_events ?? []).some((e) => e.kind === 'note_added')).toBe(true);
  });

  it('schedules a follow-up in the future and rejects past due times', async () => {
    const store = buildFakeStore({
      tmag_vm_bulk_leads: [lead],
      tmag_prospect_crm_records: [{ crmRecordId: 'crm_1', followUpDueAt: null }],
    });

    await expect(
      setLeadFollowUp({ leadId: 'lead_1', ownerTmagId: OWNER, dueAt: '2020-01-01T00:00:00.000Z' }),
    ).rejects.toThrow('due_at_in_past');

    const dueAt = new Date(Date.now() + 60 * 60_000).toISOString();
    const followUp = await setLeadFollowUp({ leadId: 'lead_1', ownerTmagId: OWNER, dueAt });
    expect(followUp.dueAt).toBe(dueAt);
    expect(followUp.clearedAt).toBeNull();
    expect(store.tmag_prospect_crm_records?.[0]?.followUpDueAt).toBe(dueAt);
    expect((store.tmag_prospect_timeline_events ?? []).some((e) => e.kind === 'follow_up_set')).toBe(true);
  });

  it('returns the invite URL without sending anything; markSent records the human send', async () => {
    const store = buildFakeStore({ tmag_vm_bulk_leads: [lead] });

    const quiet = await getLeadInvite({ leadId: 'lead_1', ownerTmagId: OWNER, markSent: false });
    expect(quiet.inviteUrl).toMatch(/\/rvm\/tok_1$/);
    expect((store.tmag_prospect_timeline_events ?? []).length).toBe(0);

    const sent = await getLeadInvite({ leadId: 'lead_1', ownerTmagId: OWNER, markSent: true });
    expect(sent.markedSent).toBe(true);
    const timeline = store.tmag_prospect_timeline_events ?? [];
    expect(timeline.some((e) => e.kind === 'sms_sent')).toBe(true);
  });

  it('do-not-call writes a GLOBAL suppression row and hard-blocks the lead', async () => {
    const store = buildFakeStore({
      tmag_vm_bulk_leads: [{ ...lead }],
      tmag_prospect_crm_records: [{ crmRecordId: 'crm_1', disposition: null }],
      tmag_prospect_crm_dispositions: [],
    });

    await markLeadDoNotCall({ leadId: 'lead_1', ownerTmagId: OWNER });

    const suppression = store.tmag_vm_suppression_list?.[0];
    expect(suppression?.ownerTmagId).toBe('global');
    expect(suppression?.normalizedPhone).toBe('+13235550100');
    expect(suppression?.reason).toBe('do_not_call');

    const storedLead = store.tmag_vm_bulk_leads?.[0];
    expect(storedLead?.doNotDrop).toBe(true);
    expect(storedLead?.consentStatus).toBe('do_not_contact');
    expect(storedLead?.status).toBe('suppressed');
    expect(store.tmag_prospect_crm_dispositions?.[0]?.disposition).toBe('do_not_contact');
  });

  it('surfaces read-back failure instead of pretending the write landed', async () => {
    buildFakeStore({ tmag_vm_bulk_leads: [lead] });
    // Break the tiered writer so nothing lands in the fake store.
    mocks.writeKnowledge.mockResolvedValue({ tier: 'knowledge', id: 'x', mongo: { ok: true, verified: true } });

    await expect(addLeadNote({ leadId: 'lead_1', ownerTmagId: OWNER, text: 'ghost' })).rejects.toThrow(
      VmLeadWorkError,
    );
  });
});
