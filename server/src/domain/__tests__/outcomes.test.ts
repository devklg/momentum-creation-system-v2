import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppendOutcomeInput } from '@momentum/shared';

/**
 * Phase 7 · R1 — outcome capture writer tests (P7.4).
 *
 * Canary-gated by OUTCOME_CAPTURE_PERSISTENCE_ENABLED, read from parsed env at
 * import time — each test sets the env var BEFORE resetModules + dynamic import.
 */

const mocks = vi.hoisted(() => ({
  gatewayCall: vi.fn(),
  tripleStackWrite: vi.fn(),
}));

vi.mock('../../services/gateway.js', () => ({ gatewayCall: mocks.gatewayCall }));
vi.mock('../../services/tripleStack.js', () => ({ tripleStackWrite: mocks.tripleStackWrite }));

type AnyRec = Record<string, unknown>;

const ORIGINAL_FLAG = process.env.OUTCOME_CAPTURE_PERSISTENCE_ENABLED;

function defaultGateway(existing: AnyRec | null = null) {
  return async (tool: string, action: string, _params: AnyRec): Promise<unknown> => {
    if (tool === 'mongodb' && action === 'query') {
      return { count: existing ? 1 : 0, documents: existing ? [existing] : [] };
    }
    return {};
  };
}

async function loadOutcomes(enabled: boolean) {
  process.env.OUTCOME_CAPTURE_PERSISTENCE_ENABLED = enabled ? 'true' : 'false';
  vi.resetModules();
  return import('../outcomes.js');
}

function input(overrides: Partial<AppendOutcomeInput> = {}): AppendOutcomeInput {
  return {
    kind: 'webinar_attended',
    confirmedByTmagId: 'TMAG-1',
    tenantId: 'team_magnificent',
    prospectId: 'P1',
    outcomeAt: '2026-07-01T00:00:00.000Z',
    ...overrides,
  };
}

beforeEach(() => {
  mocks.gatewayCall.mockReset();
  mocks.tripleStackWrite.mockReset();
});

afterEach(() => {
  if (ORIGINAL_FLAG === undefined) delete process.env.OUTCOME_CAPTURE_PERSISTENCE_ENABLED;
  else process.env.OUTCOME_CAPTURE_PERSISTENCE_ENABLED = ORIGINAL_FLAG;
});

describe('Phase 7 R1 — outcome capture canary gate', () => {
  it('is a no-op returning null when the flag is OFF (default)', async () => {
    const outcomes = await loadOutcomes(false);
    expect(outcomes.outcomeCapturePersistenceEnabled()).toBe(false);

    const result = await outcomes.appendOutcome(input());

    expect(result).toBeNull();
    expect(mocks.tripleStackWrite).not.toHaveBeenCalled();
    expect(mocks.gatewayCall).not.toHaveBeenCalled();
  });

  it('writes through the app-direct triple-stack into mcs_outcomes when ON', async () => {
    mocks.gatewayCall.mockImplementation(defaultGateway());
    const outcomes = await loadOutcomes(true);

    const result = await outcomes.appendOutcome(input());

    expect(result).not.toBeNull();
    expect(mocks.tripleStackWrite).toHaveBeenCalledTimes(1);
    const call = mocks.tripleStackWrite.mock.calls[0]![0] as AnyRec;
    expect(call.mongoCollection).toBe('mcs_outcomes');
    expect((call.chroma as AnyRec).collection).toBe('mcs_outcomes');
  });
});

describe('Phase 7 R1 — app-memory envelope + scope', () => {
  it('stamps the app-memory envelope (momentum namespace, system origin, no gateway fields)', async () => {
    mocks.gatewayCall.mockImplementation(defaultGateway());
    const outcomes = await loadOutcomes(true);

    const result = (await outcomes.appendOutcome(input()))!;

    expect(result.type).toBe('outcome');
    expect(result.namespace).toBe('momentum');
    expect(result.originKind).toBe('system');
    expect(result.serviceName).toBe('mcs_outcome_capture');
    expect(result.schemaVersion).toBe(1);
    expect(result.tenantId).toBe('team_magnificent');
    expect(result.teamKey).toBe('team_magnificent');
    expect(result.tmagId).toBe('TMAG-1');
    // No gateway-only fields leaked onto the app record.
    expect(result).not.toHaveProperty('chat_number');
    expect(result).not.toHaveProperty('chat_registry_id');
  });

  it('rejects an outcome with no BA / tenant / subject scope', async () => {
    const outcomes = await loadOutcomes(true);
    await expect(
      outcomes.appendOutcome(input({ prospectId: undefined, token: undefined })),
    ).rejects.toBeInstanceOf(outcomes.OutcomeValidationError);
    await expect(
      outcomes.appendOutcome(input({ tenantId: '' })),
    ).rejects.toBeInstanceOf(outcomes.OutcomeValidationError);
  });

  it('caps the optional note and never stores a body field', async () => {
    mocks.gatewayCall.mockImplementation(defaultGateway());
    const outcomes = await loadOutcomes(true);

    const result = (await outcomes.appendOutcome(input({ note: 'x'.repeat(5000) })))!;

    expect(result.note!.length).toBe(2000);
    const doc = (mocks.tripleStackWrite.mock.calls[0]![0] as AnyRec).mongoDoc as AnyRec;
    expect(doc).not.toHaveProperty('before');
    expect(doc).not.toHaveProperty('after');
  });
});

describe('Phase 7 R1 — THREE authority + no scoring', () => {
  it('records enrolled_three as a plain mirror record (no handoff, no score/rank fields)', async () => {
    mocks.gatewayCall.mockImplementation(defaultGateway());
    const outcomes = await loadOutcomes(true);

    const result = (await outcomes.appendOutcome(input({ kind: 'enrolled_three' })))!;

    expect(result.kind).toBe('enrolled_three');
    for (const banned of ['score', 'rank', 'qualification', 'commission', 'income', 'placement']) {
      expect(result).not.toHaveProperty(banned);
    }
  });
});

describe('Phase 7 R1 — deterministic id, idempotency, correction chain', () => {
  it('is idempotent — a retried confirmation returns the existing row, no double-write', async () => {
    const existing = { id: 'mcsoutcome_existing', kind: 'webinar_attended', type: 'outcome' };
    mocks.gatewayCall.mockImplementation(defaultGateway(existing));
    const outcomes = await loadOutcomes(true);

    const result = (await outcomes.appendOutcome(input()))!;

    expect(result.id).toBe('mcsoutcome_existing');
    expect(mocks.tripleStackWrite).not.toHaveBeenCalled();
  });

  it('once-per-(scope,BA) kinds get a stable id independent of outcomeAt', async () => {
    const outcomes = await loadOutcomes(true);
    const a = outcomes.deterministicOutcomeId({
      kind: 'webinar_attended', confirmedByTmagId: 'TMAG-1', prospectId: 'P1',
      outcomeAt: '2026-07-01T00:00:00.000Z',
    });
    const b = outcomes.deterministicOutcomeId({
      kind: 'webinar_attended', confirmedByTmagId: 'TMAG-1', prospectId: 'P1',
      outcomeAt: '2026-08-09T09:09:09.000Z',
    });
    expect(a).toBe(b);
  });

  it('multi-occurrence kinds (callback_completed) fold outcomeAt into the id', async () => {
    const outcomes = await loadOutcomes(true);
    const a = outcomes.deterministicOutcomeId({
      kind: 'callback_completed', confirmedByTmagId: 'TMAG-1', prospectId: 'P1',
      outcomeAt: '2026-07-01T00:00:00.000Z',
    });
    const b = outcomes.deterministicOutcomeId({
      kind: 'callback_completed', confirmedByTmagId: 'TMAG-1', prospectId: 'P1',
      outcomeAt: '2026-07-02T00:00:00.000Z',
    });
    expect(a).not.toBe(b);
  });

  it('a correction (supersedesOutcomeId) writes a new record and links the chain', async () => {
    mocks.gatewayCall.mockImplementation(defaultGateway({ id: 'whatever' }));
    const outcomes = await loadOutcomes(true);

    const result = (await outcomes.appendOutcome(
      input({ kind: 'declined', supersedesOutcomeId: 'mcsoutcome_prior' }),
    ))!;

    // Correction bypasses the dedup short-circuit and writes.
    expect(mocks.tripleStackWrite).toHaveBeenCalledTimes(1);
    expect(result.supersedesOutcomeId).toBe('mcsoutcome_prior');
    const cypher = String(
      ((mocks.tripleStackWrite.mock.calls[0]![0] as AnyRec).neo4j as AnyRec).cypher,
    );
    expect(cypher).toContain(':SUPERSEDES');
  });
});
