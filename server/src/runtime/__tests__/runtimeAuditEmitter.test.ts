import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { McsRuntimeAuditContext } from '@momentum/shared';

/**
 * Phase 7 · R0 activation wiring tests (P7.7). Verifies the emitter calls the
 * (already flag-gated) writer at the right lifecycle points and returns the
 * coordinator result unchanged. The writer itself is mocked here — its
 * flag-gating + persistence invariants are covered by runtimeAudit.test.ts.
 */

const mocks = vi.hoisted(() => ({
  appendRuntimeAuditEntry: vi.fn(),
  coordinateRuntimeTurn: vi.fn(),
}));

vi.mock('../../domain/auditLog.js', () => ({
  appendRuntimeAuditEntry: mocks.appendRuntimeAuditEntry,
}));
vi.mock('../orchestration/turnCoordinator.js', () => ({
  coordinateRuntimeTurn: mocks.coordinateRuntimeTurn,
}));

const CTX: McsRuntimeAuditContext = {
  turnId: 't1',
  correlationId: 'c1',
  agent: 'michael',
  tmagId: 'TMAG-1',
  tenantId: 'team_magnificent',
  gate: null,
  draftKind: null,
};

async function load() {
  return import('../runtimeAuditEmitter.js');
}

function coordinatorResult(overrides: Record<string, unknown> = {}) {
  return {
    decision: 'reject',
    agentKey: 'michael_magnificent',
    behavior: 'not_implemented',
    issues: [],
    events: [],
    outcomeDrafts: [],
    guidedActionDrafts: [],
    notes: [],
    eventPersistence: 'disabled',
    outcomePersistence: 'disabled',
    guidedActionPersistence: 'disabled',
    envelopePersistence: 'disabled',
    agentResponseGenerated: false,
    ...overrides,
  };
}

function actionsEmitted(): string[] {
  return mocks.appendRuntimeAuditEntry.mock.calls.map((c) => (c[0] as { action: string }).action);
}

beforeEach(() => {
  mocks.appendRuntimeAuditEntry.mockReset();
  mocks.appendRuntimeAuditEntry.mockResolvedValue(null);
  mocks.coordinateRuntimeTurn.mockReset();
});

describe('Phase 7 R0 activation — agent key mapping', () => {
  it('maps orchestration agent keys to runtime-audit agent labels', async () => {
    const m = await load();
    expect(m.agentKeyToRuntimeAuditAgent('steve_success')).toBe('steve');
    expect(m.agentKeyToRuntimeAuditAgent('michael_magnificent')).toBe('michael');
    expect(m.agentKeyToRuntimeAuditAgent('ivory')).toBe('ivory');
  });
});

describe('Phase 7 R0 activation — lifecycle emission', () => {
  it('emits turn.opened then turn.closed around the coordinator, returning its result unchanged', async () => {
    const result = coordinatorResult();
    mocks.coordinateRuntimeTurn.mockResolvedValue(result);
    const m = await load();

    const returned = await m.coordinateRuntimeTurnAudited({ turnId: 't1' } as never, CTX);

    expect(returned).toBe(result);
    expect(actionsEmitted()).toEqual(['runtime.turn.opened', 'runtime.turn.closed']);
    // opened is emitted BEFORE the coordinator runs.
    expect(mocks.appendRuntimeAuditEntry.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.coordinateRuntimeTurn.mock.invocationCallOrder[0]!,
    );
  });

  it('emits a draft_emitted marker per draft kind actually returned', async () => {
    mocks.coordinateRuntimeTurn.mockResolvedValue(
      coordinatorResult({ outcomeDrafts: [{ id: 'o' }], guidedActionDrafts: [{ id: 'g' }] }),
    );
    const m = await load();

    await m.coordinateRuntimeTurnAudited({ turnId: 't1' } as never, CTX);

    expect(actionsEmitted()).toEqual([
      'runtime.turn.opened',
      'runtime.turn.draft_emitted',
      'runtime.turn.draft_emitted',
      'runtime.turn.closed',
    ]);
    const draftKinds = mocks.appendRuntimeAuditEntry.mock.calls
      .filter((c) => (c[0] as { action: string }).action === 'runtime.turn.draft_emitted')
      .map((c) => (c[0] as { runtime: { draftKind: string } }).runtime.draftKind);
    expect(draftKinds).toEqual(['outcome', 'guided_action']);
  });

  it('emits no draft markers when the turn returned none', async () => {
    mocks.coordinateRuntimeTurn.mockResolvedValue(coordinatorResult());
    const m = await load();

    await m.coordinateRuntimeTurnAudited({ turnId: 't1' } as never, CTX);

    expect(actionsEmitted()).not.toContain('runtime.turn.draft_emitted');
  });
});

describe('Phase 7 R0 activation — gate emitters', () => {
  it('emitGateAllowed / emitGateDenied stamp the gate and denial reason', async () => {
    const m = await load();

    await m.emitGateAllowed(CTX, 'requireSteveComplete');
    await m.emitGateDenied(CTX, 'requireSteveComplete', 'not complete');

    const [allowed, denied] = mocks.appendRuntimeAuditEntry.mock.calls;
    expect((allowed![0] as { action: string }).action).toBe('runtime.gate.allowed');
    expect((allowed![0] as { runtime: { gate: string } }).runtime.gate).toBe('requireSteveComplete');
    expect((denied![0] as { action: string }).action).toBe('runtime.gate.denied');
    expect((denied![0] as { reason: string }).reason).toBe('not complete');
  });
});
