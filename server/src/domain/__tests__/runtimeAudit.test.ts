import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppendRuntimeAuditEntryInput, RuntimeAuditContext } from '@momentum/shared';

/**
 * Phase 7 · R0 — runtime audit persistence writer tests (P7.2 / P7.3).
 *
 * The writer is canary-gated by RUNTIME_AUDIT_PERSISTENCE_ENABLED. Because the
 * flag is read from the parsed env at import time, each test sets the env var
 * BEFORE a `vi.resetModules()` + dynamic import of the domain module.
 */

const mocks = vi.hoisted(() => ({
  gatewayCall: vi.fn(),
  tripleStackWrite: vi.fn(),
}));

vi.mock('../../services/gateway.js', () => ({
  gatewayCall: mocks.gatewayCall,
}));

vi.mock('../../services/tripleStack.js', () => ({
  tripleStackWrite: mocks.tripleStackWrite,
}));

type AnyRec = Record<string, unknown>;

const RUNTIME: RuntimeAuditContext = {
  turnId: 'turn_abc',
  correlationId: 'corr_1',
  agent: 'michael',
  baId: 'TMBA-1',
  tenantId: 'team_magnificent',
  gate: null,
  draftKind: null,
};

const ORIGINAL_FLAG = process.env.RUNTIME_AUDIT_PERSISTENCE_ENABLED;

/** No existing entry for the dedup lookup by default; writes succeed. */
function defaultGateway(existing: AnyRec | null = null) {
  return async (tool: string, action: string, _params: AnyRec): Promise<unknown> => {
    if (tool === 'mongodb' && action === 'query') {
      return { count: existing ? 1 : 0, documents: existing ? [existing] : [] };
    }
    return {};
  };
}

async function loadAudit(enabled: boolean) {
  process.env.RUNTIME_AUDIT_PERSISTENCE_ENABLED = enabled ? 'true' : 'false';
  vi.resetModules();
  return import('../auditLog.js');
}

beforeEach(() => {
  mocks.gatewayCall.mockReset();
  mocks.tripleStackWrite.mockReset();
});

afterEach(() => {
  if (ORIGINAL_FLAG === undefined) delete process.env.RUNTIME_AUDIT_PERSISTENCE_ENABLED;
  else process.env.RUNTIME_AUDIT_PERSISTENCE_ENABLED = ORIGINAL_FLAG;
});

function input(overrides: Partial<AppendRuntimeAuditEntryInput> = {}): AppendRuntimeAuditEntryInput {
  return { action: 'runtime.turn.opened', runtime: RUNTIME, ...overrides };
}

describe('Phase 7 R0 — appendRuntimeAuditEntry canary gate', () => {
  it('is a no-op returning null when the flag is OFF (default)', async () => {
    const audit = await loadAudit(false);
    expect(audit.runtimeAuditPersistenceEnabled()).toBe(false);

    const result = await audit.appendRuntimeAuditEntry(input());

    expect(result).toBeNull();
    expect(mocks.tripleStackWrite).not.toHaveBeenCalled();
    expect(mocks.gatewayCall).not.toHaveBeenCalled();
  });

  it('writes through the triple-stack when the flag is ON', async () => {
    mocks.gatewayCall.mockImplementation(defaultGateway());
    const audit = await loadAudit(true);
    expect(audit.runtimeAuditPersistenceEnabled()).toBe(true);

    const result = await audit.appendRuntimeAuditEntry(input());

    expect(result).not.toBeNull();
    expect(mocks.tripleStackWrite).toHaveBeenCalledTimes(1);
    const call = mocks.tripleStackWrite.mock.calls[0]![0] as AnyRec;
    expect(call.mongoCollection).toBe('mcs_audit_log');
    expect((call.chroma as AnyRec).collection).toBe('mcs_audit_log');
    expect(result!.runtime).toEqual(RUNTIME);
  });
});

describe('Phase 7 R0 — metadata-only + scope invariants', () => {
  it('never persists a before/after body — lifecycle markers only', async () => {
    mocks.gatewayCall.mockImplementation(defaultGateway());
    const audit = await loadAudit(true);

    const result = await audit.appendRuntimeAuditEntry(input());

    expect(result!.before).toBeNull();
    expect(result!.after).toBeNull();
    const doc = (mocks.tripleStackWrite.mock.calls[0]![0] as AnyRec).mongoDoc as AnyRec;
    expect(doc.before).toBeNull();
    expect(doc.after).toBeNull();
  });

  it('stamps tenant + BA + agent scope and a system actor (never a BA-authored write)', async () => {
    mocks.gatewayCall.mockImplementation(defaultGateway());
    const audit = await loadAudit(true);

    const result = await audit.appendRuntimeAuditEntry(input());

    expect(result!.actor).toEqual({ kind: 'system', label: 'runtime:michael' });
    expect(result!.role).toBe('system');
    expect(result!.runtime.tenantId).toBe('team_magnificent');
    expect(result!.runtime.baId).toBe('TMBA-1');
    const meta = (mocks.tripleStackWrite.mock.calls[0]![0] as AnyRec).chroma as AnyRec;
    expect((meta.metadata as AnyRec).tenantId).toBe('team_magnificent');
    expect((meta.metadata as AnyRec).agent).toBe('michael');
  });

  it('caps the gate-denial reason and defaults denial severity to warn', async () => {
    mocks.gatewayCall.mockImplementation(defaultGateway());
    const audit = await loadAudit(true);

    const result = await audit.appendRuntimeAuditEntry(
      input({
        action: 'runtime.gate.denied',
        runtime: { ...RUNTIME, gate: 'requireSteveComplete' },
        reason: 'x'.repeat(900),
      }),
    );

    expect(result!.severity).toBe('warn');
    expect(result!.reason!.length).toBe(500);
  });

  it('marks a persistence-flag flip as critical', async () => {
    mocks.gatewayCall.mockImplementation(defaultGateway());
    const audit = await loadAudit(true);

    const result = await audit.appendRuntimeAuditEntry(input({ action: 'runtime.persistence.enabled' }));

    expect(result!.severity).toBe('critical');
  });
});

describe('Phase 7 R0 — idempotency on (turnId, action)', () => {
  it('returns the existing row and does not double-write on a retried marker', async () => {
    const existing = {
      entryId: 'audit_existing',
      action: 'runtime.turn.opened',
      runtime: RUNTIME,
      before: null,
      after: null,
    };
    mocks.gatewayCall.mockImplementation(defaultGateway(existing));
    const audit = await loadAudit(true);

    const result = await audit.appendRuntimeAuditEntry(input());

    expect(result!.entryId).toBe('audit_existing');
    expect(mocks.tripleStackWrite).not.toHaveBeenCalled();
  });

  it('queries the dedup key by action + runtime.turnId', async () => {
    mocks.gatewayCall.mockImplementation(defaultGateway());
    const audit = await loadAudit(true);

    await audit.appendRuntimeAuditEntry(input());

    const query = mocks.gatewayCall.mock.calls.find(
      ([tool, action]) => tool === 'mongodb' && action === 'query',
    );
    expect(query).toBeDefined();
    expect((query![2] as AnyRec).filter).toEqual({
      action: 'runtime.turn.opened',
      'runtime.turnId': 'turn_abc',
    });
  });
});
