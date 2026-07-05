import { describe, expect, it } from 'vitest';
import { vmDeliveryMinGapMs } from '../vmDeliveryWorker.js';

describe('VM delivery rate limiter', () => {
  it('converts rate-per-minute into a minimum dispatch gap', () => {
    expect(vmDeliveryMinGapMs(60)).toBe(1000);
    expect(vmDeliveryMinGapMs(30)).toBe(2000);
    expect(vmDeliveryMinGapMs(7)).toBe(8572);
  });
});
