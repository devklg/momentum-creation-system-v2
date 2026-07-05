import { env } from '../../env.js';
import { dialCall } from '../telnyx.js';
import type {
  DropResult,
  DropStatus,
  RinglessVoicemailProvider,
  VoicemailDropPayload,
} from './types.js';

function encodeClientState(payload: Record<string, unknown>): string {
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
}

export const telnyxCallControlProvider: RinglessVoicemailProvider = {
  key: 'telnyx_call_control',
  label: 'Telnyx Call Control AMD',
  supportsLiveSend: true,

  async sendDrop(payload: VoicemailDropPayload): Promise<DropResult> {
    if (payload.dryRun) {
      return {
        provider: 'telnyx_call_control',
        providerMessageId: null,
        status: 'dry_run',
        dryRun: true,
        details: {
          mode: 'telnyx_call_control',
          leadId: payload.lead.leadId,
          tokenUrl: payload.tokenUrl,
          audioUrl: payload.audioUrl,
          note: 'VM live delivery lock is closed; Telnyx was not called.',
        },
      };
    }

    if (!payload.audioUrl) {
      return {
        provider: 'telnyx_call_control',
        providerMessageId: null,
        status: 'voicemail_drop_failed',
        dryRun: false,
        details: { reason: 'audio_url_required', leadId: payload.lead.leadId },
      };
    }

    const call = await dialCall({
      to: payload.lead.normalizedPhone!,
      from: env.TELNYX_DIAL_FROM_NUMBER,
      connectionId: env.TELNYX_CONNECTION_ID,
      amd: true,
      clientState: encodeClientState({
        source: 'mcs_vm_dialer_v1',
        leadId: payload.lead.leadId,
        vmCampaignId: payload.campaignId,
        ownerTmagId: payload.lead.ownerTmagId,
        tokenUrl: payload.tokenUrl,
        audioUrl: payload.audioUrl,
      }),
    });

    return {
      provider: 'telnyx_call_control',
      providerMessageId: call.callControlId,
      status: 'voicemail_drop_queued',
      dryRun: false,
      details: {
        mode: 'telnyx_call_control',
        callControlId: call.callControlId,
        callLegId: call.callLegId,
        callSessionId: call.callSessionId,
      },
    };
  },

  async getStatus(providerMessageId: string): Promise<DropStatus> {
    return {
      providerMessageId,
      status: 'webhook_driven',
      details: { mode: 'telnyx_call_control' },
    };
  },

  async handleWebhook(payload: unknown): Promise<Record<string, unknown>> {
    return payload && typeof payload === 'object'
      ? (payload as Record<string, unknown>)
      : { value: payload };
  },
};
