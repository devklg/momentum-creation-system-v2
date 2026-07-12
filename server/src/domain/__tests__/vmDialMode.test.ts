/**
 * dialMode matrix — vm_only / live_transfer / both × AMD human / machine,
 * plus the fail-closed gates:
 *   - owner unavailable → live_transfer never bridges; both leaves voicemail
 *   - dry-run / unapproved campaign → NEVER bridges
 *   - transfer failure → voicemail fallback in both, outcome recorded
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  // VM_LIVE_DELIVERY_ENABLED must be true so the live gate can OPEN when the
  // campaign is admin-approved; provider mode stays manual_csv so env.ts's
  // telnyx-live assertions do not fire.
  process.env.VM_LIVE_DELIVERY_ENABLED = 'true';
  return {
    persistenceCall: vi.fn(),
    writeOperational: vi.fn(),
    writeKnowledge: vi.fn(),
    gatherSingleDigit: vi.fn(),
    hangupCall: vi.fn(),
    playbackStart: vi.fn(),
    sendSms: vi.fn(),
    transferCall: vi.fn(),
    getTransferAvailability: vi.fn(),
  };
});

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
  transferCall: mocks.transferCall,
}));

vi.mock('../vmLiveTransfer.js', () => ({
  getTransferAvailability: mocks.getTransferAvailability,
  setTransferAvailability: vi.fn(),
  VmLiveTransferError: class VmLiveTransferError extends Error {},
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
  createdAt: '2026-07-11T00:00:00.000Z',
  updatedAt: '2026-07-11T00:00:00.000Z',
};

const AUDIO_URL = 'https://teammagnificent.com/vm-audio/test.mp3';

function clientState(extra: Record<string, unknown> = {}) {
  return Buffer.from(
    JSON.stringify({
      leadId: lead.leadId,
      vmCampaignId: lead.vmCampaignId,
      ownerTmagId: lead.ownerTmagId,
      audioUrl: AUDIO_URL,
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
    availableAt: '2026-07-11T00:00:00.000Z',
    lockedAt: null,
    completedAt: null,
    failedAt: null,
    failureReason: null,
    payload: { webhookEventId, provider: 'telnyx_call_control' },
    createdAt: '2026-07-11T00:00:00.000Z',
    updatedAt: '2026-07-11T00:00:00.000Z',
  };
}

interface ArrangeOptions {
  dialMode?: string;
  adminApprovedForLiveDelivery?: boolean;
  deliveryEvents?: Array<Record<string, unknown>>;
}

function arrange(payload: Record<string, unknown>, options: ArrangeOptions = {}) {
  mocks.persistenceCall.mockImplementation(
    async (tool: string, action: string, params: Record<string, unknown>) => {
      if (tool === 'mongodb' && action === 'query') {
        if (params.collection === 'tmag_vm_provider_webhook_events') {
          return { documents: [{ provider: 'telnyx_call_control', payload }] };
        }
        if (params.collection === 'tmag_vm_bulk_leads') {
          return { documents: [lead] };
        }
        if (params.collection === 'tmag_vm_campaigns') {
          return {
            documents: [
              {
                vmCampaignId: 'vm_1',
                dialMode: options.dialMode ?? 'vm_only',
                adminApprovedForLiveDelivery: options.adminApprovedForLiveDelivery ?? true,
                audioUrl: AUDIO_URL,
                status: 'running',
              },
            ],
          };
        }
        if (params.collection === 'tmag_vm_delivery_events') {
          return { documents: options.deliveryEvents ?? [], count: options.deliveryEvents?.length ?? 0 };
        }
      }
      return { documents: [], count: 0 };
    },
  );
}

function amdHuman(result = 'human_residence') {
  return {
    eventType: 'call.machine.premium.detection.ended',
    call_control_id: 'call_orig',
    client_state: clientState(),
    result,
  };
}

function amdMachine(result = 'machine_end_beep') {
  return {
    eventType: 'call.machine.premium.detection.ended',
    call_control_id: 'call_orig',
    client_state: clientState(),
    result,
  };
}

function deliveryStatuses(): string[] {
  return mocks.writeOperational.mock.calls
    .map((call) => call[0]?.mongoDoc?.status)
    .filter((status): status is string => typeof status === 'string');
}

beforeEach(() => {
  mocks.persistenceCall.mockReset();
  mocks.writeOperational.mockReset();
  mocks.writeOperational.mockResolvedValue({
    tier: 'operational',
    id: 'vm_test',
    mongo: { ok: true, verified: true },
  });
  mocks.writeKnowledge.mockReset();
  mocks.gatherSingleDigit.mockReset();
  mocks.hangupCall.mockReset();
  mocks.playbackStart.mockReset();
  mocks.sendSms.mockReset();
  mocks.transferCall.mockReset();
  mocks.getTransferAvailability.mockReset();
  mocks.getTransferAvailability.mockResolvedValue({
    ownerTmagId: 'TMBA-1',
    available: true,
    transferToNumber: '+13235559999',
    updatedAt: '2026-07-11T00:00:00.000Z',
  });
});

describe('dialMode matrix', () => {
  it('vm_only + human → press-1 gather, no bridge, human_no_transfer recorded', async () => {
    arrange(amdHuman(), { dialMode: 'vm_only' });
    await processWebhookEvent(job('wh_1'));

    expect(mocks.transferCall).not.toHaveBeenCalled();
    expect(mocks.gatherSingleDigit).toHaveBeenCalled();
    expect(deliveryStatuses()).toEqual(
      expect.arrayContaining(['human_answered_gather_started', 'human_no_transfer']),
    );
  });

  it('vm_only + machine → plays the voicemail', async () => {
    arrange(amdMachine(), { dialMode: 'vm_only' });
    await processWebhookEvent(job('wh_2'));

    expect(mocks.playbackStart).toHaveBeenCalledWith('call_orig', AUDIO_URL);
    expect(mocks.transferCall).not.toHaveBeenCalled();
    expect(deliveryStatuses()).toContain('machine_beep_playback_started');
  });

  it('live_transfer + human + owner available → bridges to the owner', async () => {
    arrange(amdHuman(), { dialMode: 'live_transfer' });
    await processWebhookEvent(job('wh_3'));

    expect(mocks.transferCall).toHaveBeenCalledWith(
      expect.objectContaining({ callControlId: 'call_orig', to: '+13235559999' }),
    );
    expect(mocks.gatherSingleDigit).not.toHaveBeenCalled();
    expect(deliveryStatuses()).toContain('live_transfer_initiated');
  });

  it('live_transfer + machine → hangs up with no message', async () => {
    arrange(amdMachine(), { dialMode: 'live_transfer' });
    await processWebhookEvent(job('wh_4'));

    expect(mocks.playbackStart).not.toHaveBeenCalled();
    expect(mocks.hangupCall).toHaveBeenCalledWith('call_orig');
    expect(deliveryStatuses()).toContain('machine_no_message');
  });

  it('live_transfer + machine greeting.ended → hangs up with no message', async () => {
    arrange(
      {
        eventType: 'call.machine.premium.greeting.ended',
        call_control_id: 'call_orig',
        client_state: clientState(),
      },
      { dialMode: 'live_transfer' },
    );
    await processWebhookEvent(job('wh_4b'));

    expect(mocks.playbackStart).not.toHaveBeenCalled();
    expect(mocks.hangupCall).toHaveBeenCalledWith('call_orig');
    expect(deliveryStatuses()).toContain('machine_no_message');
  });

  it('both + human + owner available → bridges to the owner', async () => {
    arrange(amdHuman(), { dialMode: 'both' });
    await processWebhookEvent(job('wh_5'));

    expect(mocks.transferCall).toHaveBeenCalled();
    expect(deliveryStatuses()).toContain('live_transfer_initiated');
  });

  it('both + machine → plays the voicemail', async () => {
    arrange(amdMachine(), { dialMode: 'both' });
    await processWebhookEvent(job('wh_6'));

    expect(mocks.playbackStart).toHaveBeenCalledWith('call_orig', AUDIO_URL);
    expect(mocks.transferCall).not.toHaveBeenCalled();
  });
});

describe('fail-closed gates', () => {
  it('owner unavailable + live_transfer → no bridge, polite hangup, never dead air', async () => {
    mocks.getTransferAvailability.mockResolvedValue({
      ownerTmagId: 'TMBA-1',
      available: false,
      transferToNumber: null,
      updatedAt: '2026-07-11T00:00:00.000Z',
    });
    arrange(amdHuman(), { dialMode: 'live_transfer' });
    await processWebhookEvent(job('wh_7'));

    expect(mocks.transferCall).not.toHaveBeenCalled();
    expect(mocks.playbackStart).not.toHaveBeenCalled();
    expect(mocks.hangupCall).toHaveBeenCalledWith('call_orig');
    expect(deliveryStatuses()).toContain('human_no_transfer');
  });

  it('owner unavailable + both → falls back to leaving the voicemail', async () => {
    mocks.getTransferAvailability.mockResolvedValue({
      ownerTmagId: 'TMBA-1',
      available: false,
      transferToNumber: null,
      updatedAt: '2026-07-11T00:00:00.000Z',
    });
    arrange(amdHuman(), { dialMode: 'both' });
    await processWebhookEvent(job('wh_8'));

    expect(mocks.transferCall).not.toHaveBeenCalled();
    expect(mocks.playbackStart).toHaveBeenCalledWith('call_orig', AUDIO_URL);
    expect(deliveryStatuses()).toEqual(
      expect.arrayContaining(['human_no_transfer', 'voicemail_fallback_started']),
    );
  });

  it('dry-run (unapproved) campaign NEVER bridges, even with dialMode both', async () => {
    arrange(amdHuman(), { dialMode: 'both', adminApprovedForLiveDelivery: false });
    await processWebhookEvent(job('wh_9'));

    expect(mocks.transferCall).not.toHaveBeenCalled();
    expect(mocks.getTransferAvailability).not.toHaveBeenCalled();
    expect(mocks.hangupCall).toHaveBeenCalledWith('call_orig');
    expect(deliveryStatuses()).toContain('live_transfer_refused_not_live');
  });

  it('transfer command failure in both → voicemail fallback + failure recorded', async () => {
    mocks.transferCall.mockRejectedValue(new Error('telnyx transfer boom'));
    arrange(amdHuman(), { dialMode: 'both' });
    await processWebhookEvent(job('wh_10'));

    expect(deliveryStatuses()).toEqual(
      expect.arrayContaining(['live_transfer_failed', 'voicemail_fallback_started']),
    );
    expect(mocks.playbackStart).toHaveBeenCalledWith('call_orig', AUDIO_URL);
  });

  it('transfer command failure in live_transfer → failure recorded, polite hangup', async () => {
    mocks.transferCall.mockRejectedValue(new Error('telnyx transfer boom'));
    arrange(amdHuman(), { dialMode: 'live_transfer' });
    await processWebhookEvent(job('wh_11'));

    expect(deliveryStatuses()).toContain('live_transfer_failed');
    expect(mocks.playbackStart).not.toHaveBeenCalled();
    expect(mocks.hangupCall).toHaveBeenCalledWith('call_orig');
  });
});

describe('transfer leg webhooks', () => {
  function transferLegPayload(eventType: string, extra: Record<string, unknown> = {}) {
    return {
      eventType,
      call_control_id: 'call_leg_b',
      client_state: clientState({
        transferLeg: true,
        dialMode: 'both',
        originalCallControlId: 'call_orig',
      }),
      ...extra,
    };
  }

  it('call.answered on the transfer leg → live_transfer_connected', async () => {
    arrange(transferLegPayload('call.answered'), { dialMode: 'both' });
    await processWebhookEvent(job('wh_12'));

    expect(deliveryStatuses()).toContain('live_transfer_connected');
  });

  it('hangup without answer in both → live_transfer_failed + voicemail fallback on the original leg', async () => {
    arrange(transferLegPayload('call.hangup', { hangup_cause: 'no_answer' }), { dialMode: 'both' });
    await processWebhookEvent(job('wh_13'));

    expect(deliveryStatuses()).toEqual(
      expect.arrayContaining(['live_transfer_failed', 'voicemail_fallback_started']),
    );
    expect(mocks.playbackStart).toHaveBeenCalledWith('call_orig', AUDIO_URL);
  });

  it('hangup after a connected bridge → live_transfer_completed, no fallback', async () => {
    arrange(transferLegPayload('call.hangup', { hangup_cause: 'normal_clearing' }), {
      dialMode: 'both',
      deliveryEvents: [{ leadId: 'lead_1', status: 'live_transfer_connected', providerMessageId: 'call_leg_b' }],
    });
    await processWebhookEvent(job('wh_14'));

    expect(deliveryStatuses()).toContain('live_transfer_completed');
    expect(mocks.playbackStart).not.toHaveBeenCalled();
  });

  it('fallback playback ending records voicemail_left', async () => {
    arrange(
      {
        eventType: 'call.playback.ended',
        call_control_id: 'call_orig',
        client_state: clientState(),
      },
      {
        dialMode: 'both',
        deliveryEvents: [
          {
            leadId: 'lead_1',
            status: 'voicemail_fallback_started',
            details: { playbackCallControlId: 'call_orig' },
          },
        ],
      },
    );
    await processWebhookEvent(job('wh_15'));

    expect(deliveryStatuses()).toContain('voicemail_left');
  });
});
