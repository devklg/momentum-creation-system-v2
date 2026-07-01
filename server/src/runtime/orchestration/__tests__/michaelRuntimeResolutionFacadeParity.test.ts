import type { McsRuntimeTaskType } from '@momentum/shared/runtime';
import { describe, expect, it } from 'vitest';
import {
  MICHAEL_RESPONSE_CATALOG,
  deriveMichaelResponseCatalogSelectionRequestFromRuntimeTurn,
  getMichaelResponseCatalogEntry,
  resolveMichaelRuntimeTurnResponseFromFixture,
  selectMichaelResponseCatalogEntry,
  selectMichaelResponseCatalogKey,
} from '../index.js';
import { runRuntimeTurnFixtureScenario } from '../fixtures/runtimeTurnHarness.js';
import type {
  DeriveMichaelSelectionRequestFromRuntimeTurnInput,
  MichaelResponseSelectionRequestDerivationResult,
  MichaelRuntimeResolutionResult,
  RuntimeTurnFixtureHarnessResult,
  RuntimeTurnFixtureScenarioType,
} from '../types.js';

// ───────────────────────────────────────────────────────────────────────────
// S2.20 — Michael end-to-end inert resolution facade: derivation + selector
// parity. The facade is EXACTLY the S2.19 derivation composed with the S2.18
// selector/catalog. For every runtime turn its selectionRequest deep-equals the
// derivation's, its catalogKey equals the selector's key, and its response is
// the SAME pre-authored fixture object the selector returns — no extra text, no
// extra fields. Runtime turns come from the inert S2.8 fixture harness. No
// route, no LLM, no persistence, no dynamic generation. Returned-only.
// ───────────────────────────────────────────────────────────────────────────

type TurnOverrides = {
  readonly scenario?: RuntimeTurnFixtureScenarioType;
  readonly agentKey?: unknown;
  readonly taskType?: McsRuntimeTaskType;
};

type DeriveArgs = Omit<DeriveMichaelSelectionRequestFromRuntimeTurnInput, 'runtimeTurn'>;

interface FacadeCase {
  readonly name: string;
  readonly turn: TurnOverrides;
  readonly derive: DeriveArgs;
  readonly expectedKey: string;
}

/** The six scenario families × EN/ES, each mapping to one distinct catalog key. */
const COVERAGE_CASES: readonly FacadeCase[] = [
  {
    name: 'complete clear → next_training_step (en)',
    turn: { scenario: 'accepted_complete' },
    derive: { intent: 'clear_training_support' },
    expectedKey: 'michael_next_training_step_en',
  },
  {
    name: 'complete ambiguous → clarification_question (en)',
    turn: { scenario: 'accepted_complete' },
    derive: { intent: 'ambiguous_training_support' },
    expectedKey: 'michael_clarification_question_en',
  },
  {
    name: 'degraded → safe_fallback (en)',
    turn: { scenario: 'accepted_degraded' },
    derive: {},
    expectedKey: 'michael_safe_fallback_degraded_en',
  },
  {
    name: 'missing → safe_fallback (en)',
    turn: { scenario: 'missing_context_manager' },
    derive: {},
    expectedKey: 'michael_safe_fallback_missing_en',
  },
  {
    name: 'failed → safe_close (en)',
    turn: { scenario: 'failed_context' },
    derive: {},
    expectedKey: 'michael_safe_close_failed_en',
  },
  {
    name: 'rejected/candidate → safe_close (en)',
    turn: { scenario: 'candidate_review_only_rejected' },
    derive: {},
    expectedKey: 'michael_safe_close_rejected_en',
  },
  {
    name: 'complete clear → next_training_step (es)',
    turn: { scenario: 'accepted_complete' },
    derive: { intent: 'clear_training_support', language: 'es' },
    expectedKey: 'michael_next_training_step_es',
  },
  {
    name: 'complete ambiguous → clarification_question (es)',
    turn: { scenario: 'accepted_complete' },
    derive: { intent: 'ambiguous_training_support', language: 'es' },
    expectedKey: 'michael_clarification_question_es',
  },
  {
    name: 'degraded → safe_fallback (es)',
    turn: { scenario: 'accepted_degraded' },
    derive: { language: 'es' },
    expectedKey: 'michael_safe_fallback_degraded_es',
  },
  {
    name: 'missing → safe_fallback (es)',
    turn: { scenario: 'missing_context_manager' },
    derive: { language: 'es' },
    expectedKey: 'michael_safe_fallback_missing_es',
  },
  {
    name: 'failed → safe_close (es)',
    turn: { scenario: 'failed_context' },
    derive: { language: 'es' },
    expectedKey: 'michael_safe_close_failed_es',
  },
  {
    name: 'rejected/candidate → safe_close (es)',
    turn: { scenario: 'candidate_review_only_rejected' },
    derive: { language: 'es' },
    expectedKey: 'michael_safe_close_rejected_es',
  },
];

/** Wrong-agent / wrong-task / unsupported-language all collapse to rejected safe_close. */
const COLLAPSE_CASES: readonly { readonly name: string; readonly turn: TurnOverrides; readonly derive: DeriveArgs }[] = [
  { name: 'wrong agent (steve_success)', turn: { agentKey: 'steve_success', scenario: 'accepted_complete' }, derive: {} },
  { name: 'wrong agent (ivory)', turn: { agentKey: 'ivory', scenario: 'accepted_complete' }, derive: {} },
  { name: 'unknown agent', turn: { agentKey: 'unknown_agent', scenario: 'unknown_agent' }, derive: {} },
  { name: 'wrong task (success_interview)', turn: { taskType: 'success_interview' }, derive: {} },
  { name: 'unsupported language (fr)', turn: { scenario: 'accepted_complete' }, derive: { language: 'fr' } },
];

const CATALOG_KEYS = new Set(MICHAEL_RESPONSE_CATALOG.map((entry) => entry.catalogKey));

async function buildTurn(turn: TurnOverrides = {}): Promise<RuntimeTurnFixtureHarnessResult> {
  return runRuntimeTurnFixtureScenario({
    scenario: turn.scenario ?? 'accepted_complete',
    agentKey: turn.agentKey ?? 'michael_magnificent',
    taskType: turn.taskType ?? 'training_support',
  });
}

/**
 * Resolve the same runtime turn through BOTH the facade and the raw S2.19
 * derivation. Neither mutates the turn, so a single turn drives both sides and
 * lets us prove byte-for-byte parity on the identical input.
 */
async function resolveBoth(
  turn: TurnOverrides,
  derive: DeriveArgs,
): Promise<{
  readonly facade: MichaelRuntimeResolutionResult;
  readonly derivation: MichaelResponseSelectionRequestDerivationResult;
}> {
  const runtimeTurn = await buildTurn(turn);
  const derivation = deriveMichaelResponseCatalogSelectionRequestFromRuntimeTurn({
    runtimeTurn,
    ...derive,
  });
  const facade = resolveMichaelRuntimeTurnResponseFromFixture({ runtimeTurn, ...derive });
  return { facade, derivation };
}

function expectOkFacade(
  facade: MichaelRuntimeResolutionResult,
): Extract<MichaelRuntimeResolutionResult, { ok: true }> {
  expect(facade.ok).toBe(true);
  if (!facade.ok) throw new Error('expected ok facade resolution');
  return facade;
}

describe('S2.20 Michael resolution facade — derivation + selector parity', () => {
  // ── 1. Facade selectionRequest deep-equals the S2.19 derivation result. ────
  it('selectionRequest deep-equals the S2.19 derivation for the same runtime turn', async () => {
    for (const testCase of COVERAGE_CASES) {
      const { facade, derivation } = await resolveBoth(testCase.turn, testCase.derive);
      const ok = expectOkFacade(facade);
      expect(derivation.ok).toBe(true);
      if (!derivation.ok) throw new Error(`expected ok derivation for ${testCase.name}`);
      expect(ok.selectionRequest).toEqual(derivation.selectionRequest);
    }
  });

  // ── 2. Facade catalogKey equals the S2.18 selector key for that request. ───
  it('catalogKey equals selectMichaelResponseCatalogKey/Entry for facade.selectionRequest', async () => {
    for (const testCase of COVERAGE_CASES) {
      const { facade } = await resolveBoth(testCase.turn, testCase.derive);
      const ok = expectOkFacade(facade);

      expect(ok.catalogKey).toBe(testCase.expectedKey);
      expect(ok.catalogKey).toBe(selectMichaelResponseCatalogKey(ok.selectionRequest));

      const selection = selectMichaelResponseCatalogEntry(ok.selectionRequest);
      expect(selection.ok).toBe(true);
      if (!selection.ok) throw new Error(`expected ok selection for ${testCase.name}`);
      expect(ok.catalogKey).toBe(selection.catalogKey);
    }
  });

  // ── 3. Facade response is byte-identical to the selected catalog response. ─
  it('response is byte-identical to the selected catalog entry response', async () => {
    for (const testCase of COVERAGE_CASES) {
      const { facade } = await resolveBoth(testCase.turn, testCase.derive);
      const ok = expectOkFacade(facade);
      const selection = selectMichaelResponseCatalogEntry(ok.selectionRequest);
      if (!selection.ok) throw new Error(`expected ok selection for ${testCase.name}`);
      expect(ok.response).toEqual(selection.entry.response);
    }
  });

  // ── 4. Facade response is the SAME object reference as the catalog fixture. ─
  it('response is the SAME object reference as the catalog entry response', async () => {
    for (const testCase of COVERAGE_CASES) {
      const { facade } = await resolveBoth(testCase.turn, testCase.derive);
      const ok = expectOkFacade(facade);
      const catalogEntry = getMichaelResponseCatalogEntry(ok.catalogKey);
      expect(catalogEntry).toBeDefined();
      expect(ok.response).toBe(catalogEntry!.response);
      // Also identical to the selector's own returned reference.
      const selection = selectMichaelResponseCatalogEntry(ok.selectionRequest);
      if (!selection.ok) throw new Error(`expected ok selection for ${testCase.name}`);
      expect(ok.response).toBe(selection.response);
      expect(ok.catalogEntry).toBe(catalogEntry);
    }
  });

  // ── 5. Facade adds no additional response fields beyond the fixture's. ─────
  it('response has exactly the catalog fixture fields — no extra top-level keys', async () => {
    for (const testCase of COVERAGE_CASES) {
      const { facade } = await resolveBoth(testCase.turn, testCase.derive);
      const ok = expectOkFacade(facade);
      const catalogEntry = getMichaelResponseCatalogEntry(ok.catalogKey);
      expect(catalogEntry).toBeDefined();
      expect(Object.keys(ok.response).sort()).toEqual(Object.keys(catalogEntry!.response).sort());
      expect(Object.keys(ok.response).sort()).toEqual(
        Object.keys(ok.catalogEntry.response).sort(),
      );
    }
  });

  // ── 13. Every catalog entry reachable from runtime scenarios resolves once. ─
  it('drives the scenario set to unique, real catalog keys with no substantive collision', async () => {
    const resolvedKeys: string[] = [];
    const substantiveKeysByLanguage = new Map<string, Set<string>>();

    for (const testCase of COVERAGE_CASES) {
      const { facade } = await resolveBoth(testCase.turn, testCase.derive);
      const ok = expectOkFacade(facade);

      expect(CATALOG_KEYS.has(ok.catalogKey)).toBe(true);
      resolvedKeys.push(ok.catalogKey);

      if (ok.catalogEntry.isSubstantive) {
        const seen = substantiveKeysByLanguage.get(ok.catalogEntry.language) ?? new Set<string>();
        expect(seen.has(ok.catalogKey)).toBe(false);
        seen.add(ok.catalogKey);
        substantiveKeysByLanguage.set(ok.catalogEntry.language, seen);
      }
    }

    // Each driven scenario resolved to a distinct catalog key.
    expect(new Set(resolvedKeys).size).toBe(resolvedKeys.length);
    expect(resolvedKeys.length).toBe(COVERAGE_CASES.length);
  });

  // ── 14. Safe paths never resolve substantive entries. ──────────────────────
  it('safe paths (degraded/missing/failed/rejected) resolve only non-substantive entries', async () => {
    const safeCases = COVERAGE_CASES.filter((testCase) =>
      ['accepted_degraded', 'missing_context_manager', 'failed_context', 'candidate_review_only_rejected'].includes(
        testCase.turn.scenario as string,
      ),
    );
    expect(safeCases.length).toBeGreaterThan(0);
    for (const testCase of safeCases) {
      const { facade } = await resolveBoth(testCase.turn, testCase.derive);
      const ok = expectOkFacade(facade);
      expect(ok.catalogEntry.isSubstantive).toBe(false);
      expect(ok.catalogEntry.isSafePath).toBe(true);
    }
  });

  // ── 15. Substantive paths never resolve safe entries. ──────────────────────
  it('substantive paths (complete clear/ambiguous) resolve only non-safe entries', async () => {
    const completeCases = COVERAGE_CASES.filter(
      (testCase) => testCase.turn.scenario === 'accepted_complete',
    );
    expect(completeCases.length).toBeGreaterThan(0);
    for (const testCase of completeCases) {
      const { facade } = await resolveBoth(testCase.turn, testCase.derive);
      const ok = expectOkFacade(facade);
      expect(ok.catalogEntry.isSafePath).toBe(false);
      expect(ok.catalogEntry.isSubstantive).toBe(true);
    }
  });

  // ── 16. Candidate/review-only resolves rejected safe-close only. ───────────
  it('candidate/review-only resolves rejected safe_close only', async () => {
    for (const language of [undefined, 'es'] as const) {
      const { facade } = await resolveBoth(
        { scenario: 'candidate_review_only_rejected' },
        language ? { language } : {},
      );
      const ok = expectOkFacade(facade);
      const suffix = language === 'es' ? '_safe_close_rejected_es' : '_safe_close_rejected_en';
      expect(ok.catalogKey.endsWith(suffix)).toBe(true);
      expect(ok.catalogEntry.responseType).toBe('safe_close');
      expect(ok.response.responseType).toBe('safe_close');
      expect(ok.catalogEntry.scenarioFamily).toBe('rejected');
    }
  });

  // ── 17. Wrong-agent / wrong-task / unsupported-language never substantive. ──
  it('wrong-agent/wrong-task/unsupported-language collapse to non-substantive safe_close', async () => {
    for (const testCase of COLLAPSE_CASES) {
      const { facade } = await resolveBoth(testCase.turn, testCase.derive);
      const ok = expectOkFacade(facade);
      expect(ok.catalogEntry.isSubstantive).toBe(false);
      expect(ok.catalogEntry.responseType).toBe('safe_close');
      expect(ok.response.responseType).toBe('safe_close');
      expect(ok.catalogEntry.scenarioFamily).toBe('rejected');
    }
  });
});
