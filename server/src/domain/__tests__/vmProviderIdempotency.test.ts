import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ persistenceCall: vi.fn(), writeOperational: vi.fn() }));

vi.mock('../../services/persistence/dispatch.js', () => ({ persistenceCall: mocks.persistenceCall }));
vi.mock('../../services/tieredWrite.js', () => ({ writeOperational: mocks.writeOperational, writeKnowledge: vi.fn() }));
vi.mock('../../services/telnyx.js', () => ({
  TelnyxConfigError: class TelnyxConfigError extends Error {},
  TelnyxError: class TelnyxError extends Error {},
  gatherSingleDigit: vi.fn(), hangupCall: vi.fn(), playbackStart: vi.fn(), sendSms: vi.fn(),
}));

import {
  deriveVmWebhookIdempotencyKey,
  recordDeliveryEvent,
  recordProviderWebhook,
} from '../vmProviderQueue.js';

const rows = new Map<string, Map<string, Record<string, unknown>>>();

function collection(name: string): Map<string, Record<string, unknown>> {
  let value = rows.get(name);
  if (!value) { value = new Map(); rows.set(name, value); }
  return value;
}

beforeEach(() => {
  rows.clear();
  mocks.persistenceCall.mockReset();
  mocks.writeOperational.mockReset();
  mocks.persistenceCall.mockImplementation(async (_tool: string, action: string, params: { collection: string; filter?: { _id?: string } }) => {
    if (action !== 'query') return {};
    const row = params.filter?._id ? collection(params.collection).get(params.filter._id) : undefined;
    return { documents: row ? [row] : [], count: row ? 1 : 0 };
  });
  mocks.writeOperational.mockImplementation(async (input: { id: string; mongoCollection: string; mongoDoc: Record<string, unknown> }) => {
    const target = collection(input.mongoCollection);
    if (target.has(input.id)) throw new Error('E11000 duplicate key');
    target.set(input.id, { _id: input.id, ...input.mongoDoc });
    return { mongo: { ok: true, verified: true } };
  });
});

describe('VM provider event idempotency', () => {
  it('uses a provider event id when present and a canonical payload hash otherwise', () => {
    const base = { provider: 'manual_csv' as const, headers: {} };
    expect(deriveVmWebhookIdempotencyKey({ ...base, payload: { data: { id: 'evt_1' }, value: 1 } }))
      .toBe(deriveVmWebhookIdempotencyKey({ ...base, payload: { value: 999, data: { id: 'evt_1' } } }));
    expect(deriveVmWebhookIdempotencyKey({ ...base, payload: { b: 2, a: 1 } }))
      .toBe(deriveVmWebhookIdempotencyKey({ ...base, payload: { a: 1, b: 2 } }));
  });

  it('returns the original webhook and queue job for a provider retry', async () => {
    const input = { provider: 'manual_csv' as const, payload: { eventId: 'evt_retry', leadId: 'lead_1' }, headers: {} };
    const first = await recordProviderWebhook(input);
    const retry = await recordProviderWebhook(input);

    expect(first).toMatchObject({ duplicate: false });
    expect(retry).toEqual({ ...first, duplicate: true });
    expect(collection('tmag_vm_provider_webhook_events').size).toBe(1);
    expect(collection('tmag_vm_queue_jobs').size).toBe(1);
  });

  it('deduplicates repeated provider delivery states but keeps internal events append-only', async () => {
    const providerEvent = {
      provider: 'telnyx_call_control' as const,
      leadId: 'lead_1', vmCampaignId: 'vm_1', ownerTmagId: 'TMBA-1',
      status: 'voicemail_drop_delivered', providerMessageId: 'call_1',
      providerStatus: 'call.playback.ended', dryRun: false, attempt: 1, details: {},
    };
    const first = await recordDeliveryEvent(providerEvent);
    const retry = await recordDeliveryEvent({ ...providerEvent, attempt: 2 });
    await recordDeliveryEvent({ ...providerEvent, providerMessageId: null, status: 'internal_observation' });
    await recordDeliveryEvent({ ...providerEvent, providerMessageId: null, status: 'internal_observation' });

    expect(retry.eventId).toBe(first.eventId);
    expect(collection('tmag_vm_delivery_events').size).toBe(3);
  });
});
