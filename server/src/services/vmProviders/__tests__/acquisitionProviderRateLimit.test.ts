import { describe, expect, it, vi } from 'vitest';
import { VmProviderRateLimitError } from '../types.js';

const mocks = vi.hoisted(() => ({
  fetch: vi.fn(),
}));

vi.mock('undici', () => ({ fetch: mocks.fetch }));
vi.mock('../../../env.js', () => ({
  env: {
    VM_LIVE_DELIVERY_ENABLED: true,
    VM_ACQUISITION_PROVIDER_API_URL: 'https://provider.test/drop',
    VM_ACQUISITION_PROVIDER_API_KEY: 'test-only-key',
  },
}));

import { acquisitionProvider } from '../acquisitionProvider.js';

describe('acquisition provider rate limiting', () => {
  it('maps 429 Retry-After without reading or exposing the response body', async () => {
    const text = vi.fn();
    mocks.fetch.mockResolvedValue({
      status: 429,
      ok: false,
      headers: { get: () => '45' },
      text,
    });

    const promise = acquisitionProvider.sendDrop({
      lead: {
        leadId: 'lead_1',
        ownerTmagId: 'TMBA-1',
        normalizedPhone: '+13235550100',
        firstName: 'Pat',
      } as never,
      tokenUrl: 'https://example.test/rvm/token',
      campaignId: 'campaign_1',
      audioUrl: 'https://example.test/audio.mp3',
      dryRun: false,
      adminApprovedForLiveDelivery: true,
    });

    await expect(promise).rejects.toEqual(
      expect.objectContaining({
        name: 'VmProviderRateLimitError',
        message: 'provider_rate_limited',
        provider: 'acquisition_provider_placeholder',
        retryAfterMs: 45_000,
      }),
    );
    await expect(promise).rejects.toBeInstanceOf(VmProviderRateLimitError);
    expect(text).not.toHaveBeenCalled();
  });
});
