/**
 * The pilot readout math — callback rate = callbacks ÷ voicemails left, and
 * median time-to-callback from the last delivered drop before each callback.
 */
import { describe, expect, it } from 'vitest';
import { computeReadoutRow, median } from '../vmPilotCockpit.js';

const campaign = { vmCampaignId: 'vm_1', name: 'lp-2026-q1-fresh' };

function event(leadId: string, status: string, createdAt: string) {
  return { leadId, status, createdAt };
}

describe('median', () => {
  it('handles empty, odd, and even inputs', () => {
    expect(median([])).toBeNull();
    expect(median([5])).toBe(5);
    expect(median([1, 100, 3])).toBe(3);
    expect(median([1, 3, 5, 100])).toBe(4);
  });
});

describe('computeReadoutRow', () => {
  it('computes counts and callback rate from seeded delivery events', () => {
    const row = computeReadoutRow(campaign, [
      // 5 dials placed
      event('l1', 'voicemail_drop_queued', '2026-07-11T10:00:00.000Z'),
      event('l2', 'voicemail_drop_queued', '2026-07-11T10:01:00.000Z'),
      event('l3', 'voicemail_drop_queued', '2026-07-11T10:02:00.000Z'),
      event('l4', 'voicemail_drop_queued', '2026-07-11T10:03:00.000Z'),
      event('l5', 'voicemail_drop_queued', '2026-07-11T10:04:00.000Z'),
      // 4 voicemails left (3 machine drops + 1 human fallback)
      event('l1', 'voicemail_drop_delivered', '2026-07-11T10:05:00.000Z'),
      event('l2', 'voicemail_drop_delivered', '2026-07-11T10:06:00.000Z'),
      event('l3', 'voicemail_drop_delivered', '2026-07-11T10:07:00.000Z'),
      event('l4', 'voicemail_left', '2026-07-11T10:08:00.000Z'),
      // 1 live transfer
      event('l5', 'live_transfer_connected', '2026-07-11T10:09:00.000Z'),
      // 2 callbacks: l1 30 minutes after its drop, l2 90 minutes after
      event('l1', 'inbound_callback_received', '2026-07-11T10:35:00.000Z'),
      event('l2', 'inbound_callback_received', '2026-07-11T11:36:00.000Z'),
    ]);

    expect(row.dropped).toBe(5);
    expect(row.voicemailsLeft).toBe(4);
    expect(row.liveTransfers).toBe(1);
    expect(row.callbacks).toBe(2);
    expect(row.callbackRate).toBeCloseTo(2 / 4);
    // deltas: 30m and 90m → median 60m
    expect(row.medianTimeToCallbackMs).toBe(60 * 60_000);
  });

  it('uses the LATEST delivered drop before the callback', () => {
    const row = computeReadoutRow(campaign, [
      event('l1', 'voicemail_drop_delivered', '2026-07-10T09:00:00.000Z'),
      event('l1', 'voicemail_drop_delivered', '2026-07-11T10:00:00.000Z'),
      event('l1', 'inbound_callback_received', '2026-07-11T10:20:00.000Z'),
    ]);
    expect(row.medianTimeToCallbackMs).toBe(20 * 60_000);
  });

  it('returns null rate when nothing was delivered — never divides by zero', () => {
    const row = computeReadoutRow(campaign, [
      event('l1', 'voicemail_drop_queued', '2026-07-11T10:00:00.000Z'),
      event('l1', 'inbound_callback_received', '2026-07-11T10:30:00.000Z'),
    ]);
    expect(row.voicemailsLeft).toBe(0);
    expect(row.callbacks).toBe(1);
    expect(row.callbackRate).toBeNull();
    expect(row.medianTimeToCallbackMs).toBeNull();
  });

  it('ignores statuses outside the readout sets', () => {
    const row = computeReadoutRow(campaign, [
      event('l1', 'human_no_transfer', '2026-07-11T10:00:00.000Z'),
      event('l1', 'no_answer', '2026-07-11T10:01:00.000Z'),
      event('l1', 'failed', '2026-07-11T10:02:00.000Z'),
      event('l1', 'provider_retry_scheduled', '2026-07-11T10:03:00.000Z'),
    ]);
    expect(row.dropped).toBe(0);
    expect(row.voicemailsLeft).toBe(0);
    expect(row.liveTransfers).toBe(0);
    expect(row.callbacks).toBe(0);
  });
});
