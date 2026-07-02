import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { McsLearningCandidateInput } from '@momentum/shared';

/**
 * Phase 7 · R2 — learning candidate pipeline tests (P7.5).
 * Hard invariant under test: NO AGENT MAY APPROVE KNOWLEDGE, candidates are
 * review-only, and there is no auto-promotion path.
 */

const mocks = vi.hoisted(() => ({
  persistenceCall: vi.fn(),
  tripleStackWrite: vi.fn(),
}));

vi.mock('../../services/persistence/dispatch.js', () => ({ persistenceCall: mocks.persistenceCall }));
vi.mock('../../services/tripleStack.js', () => ({ tripleStackWrite: mocks.tripleStackWrite }));

type AnyRec = Record<string, unknown>;

const ORIGINAL_FLAG = process.env.LEARNING_CANDIDATE_PERSISTENCE_ENABLED;

function persistenceReturning(candidate: AnyRec | null = null) {
  return async (tool: string, action: string, _params: AnyRec): Promise<unknown> => {
    if (tool === 'mongodb' && action === 'query') {
      return { count: candidate ? 1 : 0, documents: candidate ? [candidate] : [] };
    }
    if (tool === 'mongodb' && action === 'update') return { matchedCount: 1 };
    return {};
  };
}

async function load(enabled: boolean) {
  process.env.LEARNING_CANDIDATE_PERSISTENCE_ENABLED = enabled ? 'true' : 'false';
  vi.resetModules();
  return import('../learningCandidates.js');
}

function input(overrides: Partial<McsLearningCandidateInput> = {}): McsLearningCandidateInput {
  return {
    tenantId: 'team_magnificent',
    domain: 'performance',
    language: 'en',
    proposedSummary: 'BAs who attend orientation within 48h convert faster.',
    sourceOutcomeIds: ['mcsoutcome_a'],
    ...overrides,
  };
}

beforeEach(() => {
  mocks.persistenceCall.mockReset();
  mocks.tripleStackWrite.mockReset();
});

afterEach(() => {
  if (ORIGINAL_FLAG === undefined) delete process.env.LEARNING_CANDIDATE_PERSISTENCE_ENABLED;
  else process.env.LEARNING_CANDIDATE_PERSISTENCE_ENABLED = ORIGINAL_FLAG;
});

describe('Phase 7 R2 — canary gate + review-only isolation', () => {
  it('is a no-op returning null when the flag is OFF (default)', async () => {
    const m = await load(false);
    expect(m.learningCandidatePersistenceEnabled()).toBe(false);
    expect(await m.appendLearningCandidate(input())).toBeNull();
    expect(mocks.tripleStackWrite).not.toHaveBeenCalled();
  });

  it('writes to the REVIEW-ONLY chroma collection, never an active-knowledge one', async () => {
    mocks.persistenceCall.mockImplementation(persistenceReturning());
    const m = await load(true);

    await m.appendLearningCandidate(input());

    const call = mocks.tripleStackWrite.mock.calls[0]![0] as AnyRec;
    expect(call.mongoCollection).toBe('mcs_learning_candidates');
    expect((call.chroma as AnyRec).collection).toBe('mcs_learning_candidates_review');
  });
});

describe('Phase 7 R2 — no agent approval, no auto-promotion', () => {
  it('appendLearningCandidate ALWAYS creates a detected candidate (no status param)', async () => {
    mocks.persistenceCall.mockImplementation(persistenceReturning());
    const m = await load(true);

    const result = (await m.appendLearningCandidate(input()))!;

    expect(result.status).toBe('detected');
    expect(result.review).toBeNull();
    expect(result.type).toBe('learning_candidate');
    expect(result.teamKey).toBe('team_magnificent');
  });

  it('reviewLearningCandidate refuses a decision without a human reviewer id', async () => {
    const m = await load(true);
    await expect(
      m.reviewLearningCandidate({ candidateId: 'mcslearn_x', decision: 'approved', reviewedByTmagId: '' }),
    ).rejects.toBeInstanceOf(m.LearningCandidateValidationError);
  });

  it('requires provenance — a candidate with no source outcomes/signals is rejected', async () => {
    const m = await load(true);
    await expect(
      m.appendLearningCandidate(input({ sourceOutcomeIds: [], sourceSignalIds: [] })),
    ).rejects.toBeInstanceOf(m.LearningCandidateValidationError);
  });
});

describe('Phase 7 R2 — human review transition', () => {
  it('a human reviewer approves a detected candidate (status → approved, review recorded)', async () => {
    mocks.persistenceCall.mockImplementation(
      persistenceReturning({ id: 'mcslearn_1', status: 'detected', review: null, type: 'learning_candidate' }),
    );
    const m = await load(true);

    const result = (await m.reviewLearningCandidate({
      candidateId: 'mcslearn_1',
      decision: 'approved',
      reviewedByTmagId: 'TMAG-KEVIN',
      reason: 'clear pattern',
    }))!;

    expect(result.status).toBe('approved');
    expect(result.review!.reviewedByTmagId).toBe('TMAG-KEVIN');
    const update = mocks.persistenceCall.mock.calls.find(
      ([tool, action]) => tool === 'mongodb' && action === 'update',
    );
    expect(update).toBeDefined();
  });

  it('refuses to re-review an already-reviewed candidate (must supersede instead)', async () => {
    mocks.persistenceCall.mockImplementation(
      persistenceReturning({
        id: 'mcslearn_1',
        status: 'approved',
        review: { decision: 'approved', reviewedByTmagId: 'TMAG-KEVIN', reviewedAt: '2026-07-01T00:00:00.000Z' },
      }),
    );
    const m = await load(true);

    await expect(
      m.reviewLearningCandidate({ candidateId: 'mcslearn_1', decision: 'rejected', reviewedByTmagId: 'TMAG-KEVIN' }),
    ).rejects.toBeInstanceOf(m.LearningCandidateValidationError);
  });

  it('throws NotFound when reviewing a candidate that does not exist', async () => {
    mocks.persistenceCall.mockImplementation(persistenceReturning(null));
    const m = await load(true);

    await expect(
      m.reviewLearningCandidate({ candidateId: 'ghost', decision: 'approved', reviewedByTmagId: 'TMAG-KEVIN' }),
    ).rejects.toBeInstanceOf(m.LearningCandidateNotFoundError);
  });
});

describe('Phase 7 R2 — deterministic id', () => {
  it('same evidence set yields the same id regardless of order', async () => {
    const m = await load(true);
    const a = m.deterministicCandidateId({ domain: 'success', sourceOutcomeIds: ['o1', 'o2'], sourceSignalIds: ['s1'] });
    const b = m.deterministicCandidateId({ domain: 'success', sourceOutcomeIds: ['o2', 'o1'], sourceSignalIds: ['s1'] });
    expect(a).toBe(b);
  });
});
