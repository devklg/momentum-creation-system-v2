import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  dialCall: vi.fn(),
}));

vi.mock('../../../env.js', () => ({
  env: {
    TELNYX_DIAL_FROM_NUMBER: '+13235550199',
    TELNYX_CONNECTION_ID: 'connection_test',
  },
}));

vi.mock('../../telnyx.js', () => ({
  TelnyxError: class TelnyxError extends Error {
    constructor(
      public readonly status: number,
      public readonly upstreamBody: string,
      message: string,
      public readonly retryAfter: string | null = null,
    ) {
      super(message);
    }
  },
  dialCall: mocks.dialCall,
}));

import { telnyxCallControlProvider } from '../telnyxCallControl.js';

describe('Telnyx Call Control rate limiting', () => {
  it('maps Telnyx 429 metadata to the content-free provider error', async () => {
    const { TelnyxError } = await import('../../telnyx.js');
    mocks.dialCall.mockRejectedValue(
      new TelnyxError(429, '{"secret":"must-not-escape"}', 'limited', '90'),
    );

    const promise = telnyxCallControlProvider.sendDrop({
      lead: {
        leadId: 'lead_1',
        ownerTmagId: 'TMBA-1',
        normalizedPhone: '+13235550100',
      } as never,
      tokenUrl: 'https://example.test/rvm/token',
      campaignId: 'campaign_1',
      audioUrl: 'https://example.test/audio.mp3',
      dryRun: false,
      adminApprovedForLiveDelivery: true,
    });

    await expect(promise).rejects.toEqual(
      expect.objectContaining({
        message: 'provider_rate_limited',
        provider: 'telnyx_call_control',
        retryAfterMs: 90_000,
      }),
    );
  });
});
