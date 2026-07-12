/**
 * Boot-time VM live-delivery configuration validation.
 *
 * Two known landmines: TELNYX_CONNECTION_ID pointing at Michael's call-control
 * app instead of mcs-vm-v2, and PROSPECT_BASE_URL left at the localhost dev
 * default. When live telnyx delivery is enabled, a bad config must be a LOUD
 * boot failure, not a silent 100% live-send failure.
 */

import { describe, expect, it } from 'vitest';
import { vmLiveDeliveryConfigProblems } from '../env.js';

const validLive = {
  VM_LIVE_DELIVERY_ENABLED: true,
  VM_PROVIDER_MODE: 'telnyx_call_control',
  TELNYX_CONNECTION_ID: '2995619818075325536',
  TELNYX_DIAL_FROM_NUMBER: '+13236931362',
  VM_WEBHOOK_SHARED_SECRET: 'a-long-shared-secret',
  PROSPECT_BASE_URL: 'https://teammagnificent.com',
};

describe('vmLiveDeliveryConfigProblems', () => {
  it('accepts a fully configured live telnyx setup', () => {
    expect(vmLiveDeliveryConfigProblems(validLive)).toEqual([]);
  });

  it('is silent when live delivery is disabled', () => {
    expect(
      vmLiveDeliveryConfigProblems({
        ...validLive,
        VM_LIVE_DELIVERY_ENABLED: false,
        TELNYX_CONNECTION_ID: '',
        PROSPECT_BASE_URL: 'http://localhost:7701',
      }),
    ).toEqual([]);
  });

  it('is silent for non-telnyx providers', () => {
    expect(
      vmLiveDeliveryConfigProblems({
        ...validLive,
        VM_PROVIDER_MODE: 'manual_csv',
        TELNYX_CONNECTION_ID: '',
      }),
    ).toEqual([]);
  });

  it.each([
    ['TELNYX_CONNECTION_ID', { TELNYX_CONNECTION_ID: '' }],
    ['TELNYX_DIAL_FROM_NUMBER', { TELNYX_DIAL_FROM_NUMBER: '  ' }],
    ['VM_WEBHOOK_SHARED_SECRET', { VM_WEBHOOK_SHARED_SECRET: '' }],
  ])('names %s when missing', (name, override) => {
    const problems = vmLiveDeliveryConfigProblems({ ...validLive, ...override });
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain(name);
  });

  it.each([
    'http://localhost:7701',
    'http://127.0.0.1:7701',
    'http://sub.localhost:3000',
  ])('rejects localhost PROSPECT_BASE_URL %s', (url) => {
    const problems = vmLiveDeliveryConfigProblems({ ...validLive, PROSPECT_BASE_URL: url });
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('PROSPECT_BASE_URL');
  });

  it('rejects an unparseable PROSPECT_BASE_URL', () => {
    const problems = vmLiveDeliveryConfigProblems({ ...validLive, PROSPECT_BASE_URL: 'not-a-url' });
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('PROSPECT_BASE_URL');
  });

  it('lists every missing value at once', () => {
    const problems = vmLiveDeliveryConfigProblems({
      ...validLive,
      TELNYX_CONNECTION_ID: '',
      TELNYX_DIAL_FROM_NUMBER: '',
      VM_WEBHOOK_SHARED_SECRET: '',
      PROSPECT_BASE_URL: 'http://localhost:7701',
    });
    expect(problems).toHaveLength(4);
  });
});
