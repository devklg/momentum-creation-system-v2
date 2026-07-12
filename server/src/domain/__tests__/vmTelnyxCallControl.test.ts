import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  persistenceCall: vi.fn(),
  tripleStackWrite: vi.fn(),
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

vi.mock('../../services/tripleStack.js', () => ({
  tripleStackWrite: mocks.tripleStackWrite,
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

const lead = {
  leadId: 'lead_1',
  importJobId: 'import_1',
  leadOwnerId: 'owner_1',
  vmCampaignId: 'vm_1',
  ownerTmagId: 'TMBA-1',
  sponsorTmagId: 'TMBA-1',
  sourceLabel: 'test',
  sourceLeadId: null,
  firstName: 'Pat',
  lastName: 'One',
  phone: '+13235550100',
  normalizedPhone: '+13235550100',
  email: null,
  normalizedEmail: null,
  city: null,
  stateOrRegion: null,
  country: 'US',
  consentStatus: 'unknown',
  dedupeKey: 'd',
  status: 'voicemail_drop_queued',
  token: 'tok_1',
  crmRecordId: null,
  validationIssues: [],
  activatedAt: null,
  createdAt: '2026-07-04T00:00:00.000Z',
  updatedAt: '2026-07-04T00:00:00.000Z',
};

function clientState(extra: Record<string, unknown> = {}) {
  return Buffer.from(
    JSON.stringify({
      leadId: lead.leadId,
      vmCampaignId: lead.vmCampaignId,
      ownerTmagId: lead.ownerTmagId,
      audioUrl: 'https://teammagnificent.com/vm-audio/test.mp3',
      tokenUrl: 'https://teammagnificent.com/rvm/tok_1',
      ...extra,
    }),
    'utf8',
  ).toString('base64url');
}

function job(webhookEventId: string): VmQueueJob<{ webhookEventId: string; provider: 'telnyx_call_control' }> {
  return {
    jobId: `job_${webhookEventId}`,
    kind: 'webhook_event',
    status: 'processing',
    attempts: 1,
    maxAttempts: 3,
    availableAt: '2026-07-04T00:00:00.000Z',
    lockedAt: null,
    completedAt: null,
    failedAt: null,
    failureReason: null,
    payload: { webhookEventId, provider: 'telnyx_call_control' },
    createdAt: '2026-07-04T00:00:00.000Z',
    updatedAt: '2026-07-04T00:00:00.000Z',
  };
}

function arrange(payload: Record<string, unknown>) {
  mocks.persistenceCall.mockImplementation(async (tool: string, action: string, params: Record<string, unknown>) => {
    if (tool === 'mongodb' && action === 'query') {
      if (params.collection === 'tmag_vm_provider_webhook_events') {
        return { documents: [{ provider: 'telnyx_call_control', payload }] };
      }
      if (params.collection === 'tmag_vm_bulk_leads') {
        return { documents: [lead] };
      }
    }
    return { documents: [], count: 0 };
  });
}

function deliveryStatuses(): string[] {
  return mocks.writeOperational.mock.calls
    .map((call) => call[0]?.mongoDoc?.status)
    .filter((status): status is string => typeof status === 'string');
}

beforeEach(() => {
  mocks.persistenceCall.mockReset();
  mocks.tripleStackWrite.mockReset();
  mocks.writeOperational.mockReset();
  mocks.writeOperational.mockResolvedValue({
    tier: 'operational',
    id: 'vm_test',
    mongo: { ok: true, verified: true },
  });
  mocks.gatherSingleDigit.mockReset();
  mocks.hangupCall.mockReset();
  mocks.playbackStart.mockReset();
  mocks.sendSms.mockReset();
  mocks.sendSms.mockResolvedValue({ messageId: 'sms_1' });
});

describe('Telnyx VM Call Control AMD state machine', () => {
  it.each(['human_residence', 'human_business'])('starts single-digit gather for %s', async (result) => {
    arrange({
      eventType: 'call.machine.premium.detection.ended',
      call_control_id: 'call_1',
      client_state: clientState(),
      result,
    });

    await processWebhookEvent(job(`wh_${result}`));

    expect(mocks.gatherSingleDigit).toHaveBeenCalledWith({
      callControlId: 'call_1',
      audioUrl: 'https://teammagnificent.com/vm-audio/test.mp3',
      timeoutMs: 8000,
    });
    expect(deliveryStatuses()).toContain('human_answered_gather_started');
  });

  it('records press-1 interest and sends the token link SMS through Telnyx SMS', async () => {
    arrange({
      eventType: 'call.dtmf.received',
      call_control_id: 'call_1',
      client_state: clientState(),
      digit: '1',
    });

    await processWebhookEvent(job('wh_press_1'));

    expect(mocks.sendSms).toHaveBeenCalledWith({
      to: '+13235550100',
      text: "Here's your Team Magnificent link: https://teammagnificent.com/rvm/tok_1",
    });
    expect(mocks.hangupCall).toHaveBeenCalledWith('call_1');
    expect(deliveryStatuses()).toEqual(expect.arrayContaining(['interest_signal', 'token_link_sms_enqueued']));
  });

  it('marks not_sure as undeliverable and hangs up politely', async () => {
    arrange({
      eventType: 'call.machine.premium.detection.ended',
      call_control_id: 'call_1',
      client_state: clientState(),
      result: 'not_sure',
    });

    await processWebhookEvent(job('wh_not_sure'));

    expect(mocks.hangupCall).toHaveBeenCalledWith('call_1');
    expect(deliveryStatuses()).toContain('undeliverable');
  });
});
