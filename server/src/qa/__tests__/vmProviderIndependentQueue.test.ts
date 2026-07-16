import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';

const { dialCall, providerFetch } = vi.hoisted(() => ({
  dialCall: vi.fn(),
  providerFetch: vi.fn(),
}));

vi.mock('../../services/telnyx.js', () => ({
  dialCall,
}));

vi.mock('undici', () => ({
  fetch: providerFetch,
}));

import type { VmBulkLeadRecord } from '../../domain/vmProviderQueue.js';
import {
  getVmProvider,
  isVmProviderKey,
  listVmProviders,
  VM_CAMPAIGN_SELECTABLE_PROVIDER_KEYS,
  VM_PROVIDER_CATALOG,
  VM_REGISTERED_PROVIDER_KEYS,
} from '../../services/vmProviders/index.js';
import {
  VM_CAMPAIGN_SELECTABLE_PROVIDER_OPTIONS,
} from '@momentum/shared';

const repoRoot = path.resolve(process.cwd(), '..');
const read = (relative: string) => readFileSync(path.join(repoRoot, relative), 'utf8');

const lead: VmBulkLeadRecord = {
  leadId: 'vmlead_p2_139',
  importJobId: 'import_p2_139',
  leadOwnerId: 'owner_p2_139',
  vmCampaignId: 'campaign_p2_139',
  ownerTmagId: 'TMBA-P2-139',
  sponsorTmagId: 'TMBA-P2-139',
  sourceLabel: 'p2_139_test',
  sourceLeadId: null,
  firstName: 'Pat',
  lastName: 'Example',
  phone: '+13235550139',
  normalizedPhone: '+13235550139',
  email: null,
  normalizedEmail: null,
  city: 'Los Angeles',
  stateOrRegion: 'CA',
  country: 'US',
  consentStatus: 'unknown',
  dedupeKey: 'p2_139_dedupe',
  status: 'queued',
  token: 'P2_139_TOKEN',
  crmRecordId: null,
  validationIssues: [],
  activatedAt: null,
  createdAt: '2026-07-16T00:00:00.000Z',
  updatedAt: '2026-07-16T00:00:00.000Z',
};

describe('P2-139 provider-independent VM queue contract', () => {
  it('keeps one authoritative catalog for selectable, planned, and unavailable provider keys', () => {
    expect(VM_PROVIDER_CATALOG.map((entry) => entry.key)).toEqual([
      'manual_csv',
      'acquisition_provider_placeholder',
      'telnyx_call_control',
      'leadsrain_style_adapter',
      'slybroadcast_style_adapter',
      'future_telecom_adapter',
      'none',
    ]);
    expect(
      VM_PROVIDER_CATALOG
        .filter((entry) => entry.availability === 'selectable')
        .map((entry) => entry.key),
    ).toEqual(VM_CAMPAIGN_SELECTABLE_PROVIDER_KEYS);
    expect(VM_CAMPAIGN_SELECTABLE_PROVIDER_OPTIONS.map((entry) => entry.key)).toEqual(
      VM_CAMPAIGN_SELECTABLE_PROVIDER_KEYS,
    );
    expect(listVmProviders().map((provider) => provider.key)).toEqual(VM_REGISTERED_PROVIDER_KEYS);
    expect(new Set(VM_PROVIDER_CATALOG.map((entry) => entry.key)).size).toBe(
      VM_PROVIDER_CATALOG.length,
    );
  });

  it('resolves every selectable adapter and fails closed for planned or unknown keys', () => {
    for (const key of VM_REGISTERED_PROVIDER_KEYS) {
      expect(isVmProviderKey(key)).toBe(true);
      expect(getVmProvider(key).key).toBe(key);
    }

    for (const key of [
      'leadsrain_style_adapter',
      'slybroadcast_style_adapter',
      'future_telecom_adapter',
      'none',
      'unknown_provider',
      null,
    ]) {
      expect(isVmProviderKey(key)).toBe(false);
      expect(() => getVmProvider(key)).toThrowError('unsupported_vm_provider');
    }
  });

  it('keeps all registered adapters external-call-free behind the dry-run gate', async () => {
    for (const key of VM_REGISTERED_PROVIDER_KEYS) {
      const result = await getVmProvider(key).sendDrop({
        lead,
        tokenUrl: 'https://teammagnificent.com/rvm/P2_139_TOKEN',
        campaignId: lead.vmCampaignId,
        audioUrl: null,
        dryRun: true,
        adminApprovedForLiveDelivery: false,
      });
      expect(result.provider).toBe(key);
      expect(result.dryRun).toBe(true);
    }

    expect(dialCall).not.toHaveBeenCalled();
    expect(providerFetch).not.toHaveBeenCalled();
  });

  it('rejects unsupported campaign providers before campaign persistence', () => {
    const route = read('server/src/routes/vm.ts');
    const campaignHandler =
      route.match(/vmRoutes\.post\('\/campaigns'[\s\S]*?\n\}\);/)?.[0] ?? '';

    expect(campaignHandler).toContain('VM_CAMPAIGN_SELECTABLE_PROVIDER_KEYS.some');
    expect(campaignHandler).toContain("error: 'unsupported_provider'");
    expect(campaignHandler.indexOf('unsupported_provider')).toBeLessThan(
      campaignHandler.indexOf('createVMCampaign({'),
    );
  });

  it('drives the Team campaign selector from the same governed shared catalog', () => {
    const teamRoute = read('apps/team/src/routes/vm-campaigns.tsx');
    expect(teamRoute).toContain('VM_CAMPAIGN_SELECTABLE_PROVIDER_OPTIONS.map');
    expect(teamRoute).not.toContain("value: 'leadsrain_style_adapter'");
    expect(teamRoute).not.toContain("value: 'slybroadcast_style_adapter'");
    expect(teamRoute).not.toContain("value: 'acquisition_provider_placeholder'");
  });

  it('keeps provider choice at dispatch and adapter-specific fields out of the durable queue payload', () => {
    const queue = read('server/src/domain/vmProviderQueue.ts');
    const worker = read('server/src/workers/vmDeliveryWorker.ts');
    const deliveryPayload =
      worker.match(/interface DeliveryPayload extends Record<string, unknown> \{([\s\S]*?)\n\}/)?.[1] ?? '';

    expect(queue).toMatch(/export type VmQueueJobKind =[\s\S]*\| 'delivery'/);
    expect(worker).toContain(': getVmProvider(campaign.provider)');
    expect(worker).toContain(
      'job.payload.provider ?? campaignProvider?.key ?? env.VM_PROVIDER_MODE',
    );
    expect(deliveryPayload).toContain('leadId: string');
    expect(deliveryPayload).toContain('provider?: unknown');
    expect(deliveryPayload).not.toMatch(/\b(apiKey|connectionId|callControlId|vendorPayload)\b/);
  });
});
