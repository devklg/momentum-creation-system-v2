/**
 * Placeholder acquisition-provider adapter.
 *
 * This intentionally does not copy vendor branding, UI, request shapes, or
 * code. It is a provider-shaped seam for a future ringless voicemail-drop API.
 */

import { fetch } from 'undici';
import { env } from '../../env.js';
import type {
  DropResult,
  DropStatus,
  RinglessVoicemailProvider,
  VoicemailDropPayload,
} from './types.js';

export const acquisitionProvider: RinglessVoicemailProvider = {
  key: 'acquisition_provider_placeholder',
  label: 'Acquisition provider placeholder',
  supportsLiveSend: true,

  async sendDrop(payload: VoicemailDropPayload): Promise<DropResult> {
    const liveAllowed =
      env.VM_LIVE_DELIVERY_ENABLED &&
      payload.adminApprovedForLiveDelivery &&
      !payload.dryRun;

    if (!liveAllowed) {
      return {
        provider: 'acquisition_provider_placeholder',
        providerMessageId: null,
        status: 'dry_run',
        dryRun: true,
        details: {
          mode: 'dry_run',
          liveDeliveryEnabled: env.VM_LIVE_DELIVERY_ENABLED,
          adminApprovedForLiveDelivery: payload.adminApprovedForLiveDelivery,
          leadId: payload.lead.leadId,
          tokenUrl: payload.tokenUrl,
        },
      };
    }

    if (!env.VM_ACQUISITION_PROVIDER_API_URL || !env.VM_ACQUISITION_PROVIDER_API_KEY) {
      throw new Error('vm_provider_live_config_missing');
    }

    const res = await fetch(env.VM_ACQUISITION_PROVIDER_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.VM_ACQUISITION_PROVIDER_API_KEY}`,
      },
      body: JSON.stringify({
        phone: payload.lead.normalizedPhone,
        firstName: payload.lead.firstName,
        link: payload.tokenUrl,
        campaignId: payload.campaignId,
        metadata: {
          leadId: payload.lead.leadId,
          ownerTmagId: payload.lead.ownerTmagId,
        },
      }),
    });

    const text = await res.text();
    if (!res.ok) {
      throw new Error(`vm_provider_http_${res.status}:${text.slice(0, 200)}`);
    }

    let parsed: Record<string, unknown> = {};
    try {
      parsed = JSON.parse(text) as Record<string, unknown>;
    } catch {
      parsed = { raw: text };
    }

    return {
      provider: 'acquisition_provider_placeholder',
      providerMessageId: typeof parsed.id === 'string' ? parsed.id : null,
      status: 'voicemail_drop_queued',
      dryRun: false,
      details: parsed,
    };
  },

  async getStatus(providerMessageId: string): Promise<DropStatus> {
    return {
      providerMessageId,
      status: 'status_lookup_not_configured',
      details: { provider: 'acquisition_provider_placeholder' },
    };
  },

  async handleWebhook(payload: unknown): Promise<Record<string, unknown>> {
    return payload && typeof payload === 'object'
      ? (payload as Record<string, unknown>)
      : { value: payload };
  },
};
