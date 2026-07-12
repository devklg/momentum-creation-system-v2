/**
 * Inbound callback capture ("the raised hand") — Chat lane feat/vm-inbound-callback.
 *
 * The prospect hears the voicemail and CALLS BACK. That inbound call carries
 * no client_state; before this lane the webhook processor silently dropped
 * it. These tests drive the full durable-queue path (processWebhookEvent →
 * processTelnyxCallControlWebhook → processInboundTelnyxCall) and assert the
 * raised hand lands in the CANONICAL CRM model (p1-54).
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  persistenceCall: vi.fn(),
  writeOperational: vi.fn(),
  writeKnowledge: vi.fn(),
  gatherSingleDigit: vi.fn(),
  hangupCall: vi.fn(),
  playbackStart: vi.fn(),
  sendSms: vi.fn(),
}));

vi.mock('../../services/persistence/dispatch.js', () => ({
  persistenceCall: mocks.persistenceCall,
}));

vi.mock('../../services/tieredWrite.js', () => ({
  writeOperational: mocks.writeOperational,
  writeKnowledge: mocks.writeKnowledge,
}));

vi.mock('../../services/telnyx.js', () => ({
  TelnyxConfigError: class TelnyxConfigError extends Error {},
  TelnyxError: class TelnyxError extends Error {},
  gatherSingleDigit: mocks.gatherSingleDigit,
  hangupCall: mocks.hangupCall,
  playbackStart: mocks.playbackStart,
  sendSms: mocks.sendSms,
}));

import { processWebhookEvent, type VmQueueJob } from '../vmProviderQueue.js';

type AnyRec = Record<string, unknown>;

const lead = {
  leadId: 'lead_cb_1',
  importJobId: 'import_1',
  leadOwnerId: 'lo_1',
  vmCampaignId: 'vm_1',
  ownerTmagId: 'TMBA-OWNER',
  sponsorTmagId: 'TMBA-SPONSOR',
  sourceLabel: 'apache_leads',
  sourceLeadId: null,
  firstName: 'Cal',
  lastName: 'Back',
  phone: '(323) 555-0142',
  normalizedPhone: '+13235550142',
  email: null,
  normalizedEmail: null,
  city: 'Los Angeles',
  stateOrRegion: 'CA',
  country: 'US',
  consentStatus: 'unknown',
  dedupeKey: 'dk',
  status: 'voicemail_drop_delivered',
  token: 'tok_cb_1',
  crmRecordId: 'crm_cb_1',
  validationIssues: [],
  activatedAt: null,
  createdAt: '2026-07-10T00:00:00.000Z',
  updatedAt: '2026-07-10T00:00:00.000Z',
};

function job(webhookEventId: string): VmQueueJob<{ webhookEventId: string; provider: 'telnyx_call_control' }> {
  return {
    jobId: `job_${webhookEventId}`,
    kind: 'webhook_event',
    status: 'processing',
    attempts: 1,
    maxAttempts: 3,
    availableAt: '2026-07-12T00:00:00.000Z',
    lockedAt: null,
    completedAt: null,
    failedAt: null,
    failureReason: null,
    payload: { webhookEventId, provider: 'telnyx_call_control' },
    createdAt: '2026-07-12T00:00:00.000Z',
    updatedAt: '2026-07-12T00:00:00.000Z',
  };
}

function inboundPayload(extra: AnyRec = {}): AnyRec {
  return {
    eventType: 'call.initiated',
    direction: 'incoming',
    from: '+1 (323) 555-0142',
    to: '+13236931362',
    call_control_id: 'cc_inb_1',
    call_session_id: 'cs_inb_1',
    state: 'parked',
    ...extra,
  };
}

/**
 * Simulated Mongo. writeOperational/writeKnowledge docs are captured into
 * per-collection arrays so read-backs resolve against what was written.
 */
let mongo: Map<string, AnyRec[]>;

function docsIn(collection: string): AnyRec[] {
  return mongo.get(collection) ?? [];
}

function arrange(payload: AnyRec, options: { leads?: AnyRec[] } = {}) {
  const leads = options.leads ?? [lead];
  mongo = new Map();

  mocks.writeOperational.mockImplementation(async (input: { mongoCollection: string; mongoDoc: AnyRec }) => {
    const list = mongo.get(input.mongoCollection) ?? [];
    list.push(input.mongoDoc);
    mongo.set(input.mongoCollection, list);
    return { tier: 'operational', id: 'x', mongo: { ok: true, verified: true } };
  });
  mocks.writeKnowledge.mockImplementation(async (input: { mongoCollection: string; mongoDoc: AnyRec }) => {
    const list = mongo.get(input.mongoCollection) ?? [];
    list.push(input.mongoDoc);
    mongo.set(input.mongoCollection, list);
    return { tier: 'knowledge', id: 'x', mongo: { ok: true, verified: true } };
  });

  mocks.persistenceCall.mockImplementation(async (tool: string, action: string, params: AnyRec) => {
    if (tool === 'mongodb' && action === 'query') {
      const collection = params.collection as string;
      if (collection === 'tmag_vm_provider_webhook_events') {
        return { documents: [{ provider: 'telnyx_call_control', payload }] };
      }
      if (collection === 'tmag_vm_bulk_leads') {
        const filter = params.filter as AnyRec;
        if (typeof filter.normalizedPhone === 'string') {
          return { documents: leads.filter((l) => l.normalizedPhone === filter.normalizedPhone) };
        }
        if (typeof filter.leadId === 'string') {
          return { documents: leads.filter((l) => l.leadId === filter.leadId) };
        }
        return { documents: leads };
      }
      if (collection === 'tmag_vm_inbound_calls') {
        const filter = params.filter as AnyRec;
        return {
          documents: docsIn(collection).filter((d) => d.inboundCallId === filter.inboundCallId),
        };
      }
      if (collection === 'tmag_prospect_callback_requests') {
        const filter = params.filter as AnyRec;
        return {
          documents: docsIn(collection).filter(
            (d) => d.callbackRequestId === filter.callbackRequestId,
          ),
        };
      }
      if (collection === 'tmag_prospect_crm_records') {
        return { documents: [{ crmRecordId: lead.crmRecordId, status: 'needs_follow_up' }] };
      }
      if (collection === 'tmag_vm_delivery_events') {
        return { documents: [] };
      }
      return { documents: [], count: 0 };
    }
    return { documents: [], results: [], count: 0 };
  });
}

function mongoUpdates(collection: string): AnyRec[] {
  return mocks.persistenceCall.mock.calls
    .filter(
      ([tool, action, params]) =>
        tool === 'mongodb' && action === 'update' && (params as AnyRec).collection === collection,
    )
    .map(([, , params]) => params as AnyRec);
}

beforeEach(() => {
  mocks.persistenceCall.mockReset();
  mocks.writeOperational.mockReset();
  mocks.writeKnowledge.mockReset();
  mocks.gatherSingleDigit.mockReset();
  mocks.hangupCall.mockReset();
  mocks.playbackStart.mockReset();
  mocks.sendSms.mockReset();
});

describe('inbound callback capture (the raised hand)', () => {
  it('matches the caller to the lead and writes the canonical callback model', async () => {
    arrange(inboundPayload());

    await processWebhookEvent(job('wh_inbound_match'));

    // 1. Canonical callback request — intent interested_tell_me_more,
    //    ownership from the LEAD, never the payload.
    const callbackRequests = docsIn('tmag_prospect_callback_requests');
    expect(callbackRequests).toHaveLength(1);
    const cb = callbackRequests[0]!;
    expect(cb.intent).toBe('interested_tell_me_more');
    expect(cb.ownerTmagId).toBe('TMBA-OWNER');
    expect(cb.sponsorTmagId).toBe('TMBA-SPONSOR');
    expect(cb.leadId).toBe('lead_cb_1');
    expect(cb.source).toBe('vm_inbound_call');

    // 2. Canonical timeline event.
    const timeline = docsIn('tmag_prospect_timeline_events');
    expect(timeline).toHaveLength(1);
    expect(timeline[0]!.kind).toBe('callback_requested');
    expect(timeline[0]!.leadId).toBe('lead_cb_1');
    expect(timeline[0]!.ownerTmagId).toBe('TMBA-OWNER');

    // 3. CRM record → needs_follow_up (canonical crmStatuses value).
    const crmUpdates = mongoUpdates('tmag_prospect_crm_records');
    expect(crmUpdates).toHaveLength(1);
    expect((crmUpdates[0]!.update as AnyRec).$set).toMatchObject({ status: 'needs_follow_up' });

    // 4. VM lead → callback_requested (existing CRM_VM_LEAD_STATUSES value).
    const leadUpdates = mongoUpdates('tmag_vm_bulk_leads');
    expect(leadUpdates).toHaveLength(1);
    expect((leadUpdates[0]!.update as AnyRec).$set).toMatchObject({ status: 'callback_requested' });

    // 5. Attribution: campaign-scoped delivery/interest event.
    const deliveryEvents = docsIn('tmag_vm_delivery_events');
    expect(deliveryEvents).toHaveLength(1);
    expect(deliveryEvents[0]!).toMatchObject({
      status: 'inbound_callback_received',
      leadId: 'lead_cb_1',
      vmCampaignId: 'vm_1',
      ownerTmagId: 'TMBA-OWNER',
    });

    // 6. Inbound call record marked matched.
    const inboundCalls = docsIn('tmag_vm_inbound_calls');
    expect(inboundCalls).toHaveLength(1);
    expect(inboundCalls[0]!).toMatchObject({ matched: true, leadId: 'lead_cb_1' });
  });

  it('records unknown caller IDs as unattributed inbound with NO callback request', async () => {
    arrange(inboundPayload({ from: '+13235559999' }), { leads: [lead] });

    await processWebhookEvent(job('wh_inbound_unknown'));

    const inboundCalls = docsIn('tmag_vm_inbound_calls');
    expect(inboundCalls).toHaveLength(1);
    expect(inboundCalls[0]!).toMatchObject({
      matched: false,
      leadId: null,
      normalizedFromNumber: '+13235559999',
    });

    expect(docsIn('tmag_prospect_callback_requests')).toHaveLength(0);
    expect(docsIn('tmag_prospect_timeline_events')).toHaveLength(0);
    expect(mongoUpdates('tmag_prospect_crm_records')).toHaveLength(0);
    expect(mongoUpdates('tmag_vm_bulk_leads')).toHaveLength(0);
  });

  it('is idempotent per call_session_id (webhook retries do not double-create)', async () => {
    arrange(inboundPayload());
    await processWebhookEvent(job('wh_inbound_first'));

    // Second delivery of the same call — inbound record now exists.
    await processWebhookEvent(job('wh_inbound_retry'));

    expect(docsIn('tmag_prospect_callback_requests')).toHaveLength(1);
    expect(docsIn('tmag_vm_inbound_calls')).toHaveLength(1);
  });

  it('acknowledges inbound answered/hangup legs without creating callback requests', async () => {
    arrange(inboundPayload({ eventType: 'call.hangup' }));

    await processWebhookEvent(job('wh_inbound_hangup'));

    expect(docsIn('tmag_prospect_callback_requests')).toHaveLength(0);
    expect(docsIn('tmag_vm_inbound_calls')).toHaveLength(0);
  });

  it('regression: outbound events with client_state still run the AMD state machine', async () => {
    const clientState = Buffer.from(
      JSON.stringify({
        leadId: lead.leadId,
        audioUrl: 'https://teammagnificent.com/vm-audio/test.mp3',
      }),
      'utf8',
    ).toString('base64url');

    arrange({
      eventType: 'call.machine.premium.detection.ended',
      direction: 'outgoing',
      call_control_id: 'cc_out_1',
      client_state: clientState,
      result: 'human_residence',
    });

    await processWebhookEvent(job('wh_outbound_regression'));

    // Outbound path untouched: gather starts, no inbound artifacts.
    expect(mocks.gatherSingleDigit).toHaveBeenCalledWith({
      callControlId: 'cc_out_1',
      audioUrl: 'https://teammagnificent.com/vm-audio/test.mp3',
      timeoutMs: 8000,
    });
    expect(docsIn('tmag_vm_inbound_calls')).toHaveLength(0);
    expect(docsIn('tmag_prospect_callback_requests')).toHaveLength(0);
  });
});
