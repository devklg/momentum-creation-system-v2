import { describe, expect, it } from 'vitest';
import { vmDeliveryClaimBatchSize, vmDeliveryMinGapMs } from '../vmDeliveryWorker.js';

describe('VM delivery rate limiter', () => {
  it('converts rate-per-minute into a minimum dispatch gap', () => {
    expect(vmDeliveryMinGapMs(60)).toBe(1000);
    expect(vmDeliveryMinGapMs(30)).toBe(2000);
    expect(vmDeliveryMinGapMs(7)).toBe(8572);
  });

  it('claims only the work the configured rate can dispatch during one tick', () => {
    expect(vmDeliveryClaimBatchSize(1, 1000, 10)).toBe(1);
    expect(vmDeliveryClaimBatchSize(60, 1000, 10)).toBe(1);
    expect(vmDeliveryClaimBatchSize(120, 1000, 10)).toBe(2);
    expect(vmDeliveryClaimBatchSize(600, 1000, 10)).toBe(10);
    expect(vmDeliveryClaimBatchSize(1200, 1000, 10)).toBe(10);
  });
});
