import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { McsContextPacket, McsContextGuardHit } from '@momentum/shared/runtime';
import type { McsOperatingContext } from '@momentum/shared';

const mocks = vi.hoisted(() => ({ compileContextPacket: vi.fn() }));

vi.mock('../../../lib/contextPacket.js', () => ({
  compileContextPacket: mocks.compileContextPacket,
}));

const { OPERATING_CONTEXT_MAX_CHARS, composeAgentContext, loadOperatingContext } = await import(
  '../operatingContext.js'
);

const BOOT_BODY = 'The world you are working in: Momentum is a Knowledge Operating System.';

function guardHit(overrides: Partial<McsContextGuardHit> = {}): McsContextGuardHit {
  return {
    provenance: {
      stack: 'memory',
      storeKey: 'memory_decisions',
      storePath: 'universal_gateway.memory_decisions',
      recordId: 'boot_operating_context_20260808',
      date: '2026-08-08T00:00:00.000Z',
      statedBy: 'kevin',
      ...(overrides.provenance ?? {}),
    },
    title: 'Boot the OS',
    summary: BOOT_BODY,
    matchKind: 'exact_handle',
    superseded: false,
    weight: 12,
    audience: 'both',
    ...overrides,
  };
}

function packet(overrides: Partial<McsContextPacket> = {}): McsContextPacket {
  return {
    schemaVersion: 'memory_context_compiler.schema.v1',
    query: 'boot',
    ladderRung: 'invocation',
    compiledAt: '2026-08-08T00:00:00.000Z',
    canonicalRecord: guardHit(),
    graphExpansion: [],
    semanticNeighbours: [],
    implementationBriefs: [],
    supersededRecords: [],
    tokenBudget: { maxChars: 24_000, usedChars: 512, truncated: false },
    warnings: [],
    audience: 'app_agents',
    ...overrides,
  } as McsContextPacket;
}

function degradedContext(): McsOperatingContext {
  return {
    schemaVersion: 'operating_context.v1',
    status: 'degraded',
    degradedReason: 'retrieval_failed:boot (gateway unreachable)',
    loads: [],
    loadedAt: '2026-08-08T00:00:00.000Z',
  };
}

beforeEach(() => {
  mocks.compileContextPacket.mockReset();
  vi.restoreAllMocks();
});

describe('loadOperatingContext — the boot sector', () => {
  it('returns status loaded with at least one load on a successful retrieval', async () => {
    mocks.compileContextPacket.mockResolvedValue(packet());

    const context = await loadOperatingContext();

    expect(context.schemaVersion).toBe('operating_context.v1');
    expect(context.status).toBe('loaded');
    expect(context.degradedReason).toBeNull();
    expect(context.loads.length).toBeGreaterThanOrEqual(1);
    expect(context.loads[0]).toMatchObject({
      handle: 'boot',
      recordId: 'boot_operating_context_20260808',
      title: 'Boot the OS',
    });
    expect(context.loads[0]?.content).toContain(BOOT_BODY);
    expect(mocks.compileContextPacket).toHaveBeenCalledWith('boot', null, expect.objectContaining({ audience: 'app_agents' }));
  });

  it('retrieves a configurable handle', async () => {
    mocks.compileContextPacket.mockResolvedValue(packet({ query: 'ground zero' }));

    const context = await loadOperatingContext({ handle: 'ground zero' });

    expect(mocks.compileContextPacket).toHaveBeenCalledWith('ground zero', null, expect.anything());
    expect(context.loads[0]?.handle).toBe('ground zero');
  });

  it('fails closed and does NOT throw when retrieval rejects, and makes absence loud', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    mocks.compileContextPacket.mockRejectedValue(new Error('gateway unreachable'));

    const context = await loadOperatingContext();

    expect(context.status).toBe('degraded');
    expect(context.loads).toEqual([]);
    expect(context.degradedReason).not.toBeNull();
    expect(context.degradedReason).toContain('gateway unreachable');
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0]?.[0])).toContain('[operating-context] DEGRADED —');
  });

  it('degrades when the handle does not deterministically resolve', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    mocks.compileContextPacket.mockResolvedValue(
      packet({ ladderRung: 'semantic_fallback', canonicalRecord: undefined }),
    );

    const context = await loadOperatingContext();

    expect(context.status).toBe('degraded');
    expect(context.loads).toEqual([]);
    expect(context.degradedReason).toContain('handle_unresolved:boot');
  });

  it('degrades rather than emitting an empty operating context', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    mocks.compileContextPacket.mockResolvedValue(
      packet({ canonicalRecord: guardHit({ summary: '   ' }) }),
    );

    const context = await loadOperatingContext();

    expect(context.status).toBe('degraded');
    expect(context.degradedReason).toContain('empty_operating_context:boot');
  });

  it('does not truncate the retrieved body', async () => {
    const long = 'x'.repeat(20_000);
    mocks.compileContextPacket.mockResolvedValue(packet({ canonicalRecord: guardHit({ summary: long }) }));

    const context = await loadOperatingContext();

    expect(context.loads[0]?.content).toBe(long);
  });

  it('asks the compiler for the WHOLE body, not the default hit summary budget', async () => {
    mocks.compileContextPacket.mockResolvedValue(packet());

    await loadOperatingContext();

    // The defect this pins: the compiler's default clips every hit to 1200
    // chars. The boot record is ~6,000. Assert the ACTUAL argument.
    const options = mocks.compileContextPacket.mock.calls[0]?.[2] as { maxSummaryChars?: number };
    expect(options.maxSummaryChars).toBe(OPERATING_CONTEXT_MAX_CHARS);
    expect(OPERATING_CONTEXT_MAX_CHARS).toBeGreaterThanOrEqual(100_000);
  });

  it('degrades rather than reporting a truncated world as loaded', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const clipped = `${'x'.repeat(1_200)}…`;
    mocks.compileContextPacket.mockResolvedValue(packet({ canonicalRecord: guardHit({ summary: clipped }) }));

    const context = await loadOperatingContext();

    expect(context.status).toBe('degraded');
    expect(context.loads).toEqual([]);
    expect(context.degradedReason?.startsWith('truncated_operating_context:')).toBe(true);
    expect(context.degradedReason).toContain('boot');
  });

  it('delivers a ~6,000-character boot body whole, with no clipping anywhere in the path', async () => {
    const body = 'LOAD 1 — the world. '.repeat(300).trim(); // ~6,000 chars
    expect(body.length).toBeGreaterThan(5_500);
    mocks.compileContextPacket.mockResolvedValue(packet({ canonicalRecord: guardHit({ summary: body }) }));

    const context = await loadOperatingContext();

    expect(context.status).toBe('loaded');
    expect(context.loads[0]?.content.length).toBe(body.length);
    expect(context.loads[0]?.content).toBe(body);
  });
});

describe('composeAgentContext — operating context first, topical second', () => {
  async function loaded(): Promise<McsOperatingContext> {
    mocks.compileContextPacket.mockResolvedValue(packet());
    return loadOperatingContext();
  }

  it('places the operating block BEFORE the topical supplement', async () => {
    const context = await loaded();
    const supplement = 'TOPICAL: the BA asked about the pool mechanic.';

    const composed = composeAgentContext(context, supplement);

    const operatingIndex = composed.indexOf('OPERATING CONTEXT (system');
    const bodyIndex = composed.indexOf(BOOT_BODY);
    const supplementIndex = composed.indexOf(supplement);
    expect(operatingIndex).toBeGreaterThanOrEqual(0);
    expect(supplementIndex).toBeGreaterThan(bodyIndex);
    expect(bodyIndex).toBeGreaterThan(operatingIndex);
  });

  it('returns the supplement alone, with no OPERATING CONTEXT header, when degraded', () => {
    const supplement = 'TOPICAL: the BA asked about the pool mechanic.';

    const composed = composeAgentContext(degradedContext(), supplement);

    expect(composed).toBe(supplement);
    expect(composed).not.toContain('OPERATING CONTEXT');
  });

  it('returns an empty string when degraded with no supplement', () => {
    expect(composeAgentContext(degradedContext())).toBe('');
    expect(composeAgentContext(degradedContext(), '   ')).toBe('');
  });

  it('still returns the operating block when there is no supplement', async () => {
    const context = await loaded();

    const composed = composeAgentContext(context);

    expect(composed).toContain('OPERATING CONTEXT (system');
    expect(composed).toContain('Boot the OS');
    expect(composed).toContain(BOOT_BODY);
  });
});
