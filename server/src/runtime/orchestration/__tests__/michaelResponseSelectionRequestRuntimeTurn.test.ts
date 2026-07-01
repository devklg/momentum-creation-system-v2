import type { McsRuntimeTaskType } from '@momentum/shared/runtime';
import { describe, expect, it } from 'vitest';
import {
  MICHAEL_RESPONSE_CATALOG,
  deriveMichaelResponseCatalogSelectionRequestFromRuntimeTurn,
  getMichaelResponseCatalogEntry,
  runRuntimeTurnFixtureScenario,
  selectMichaelResponseCatalogEntry,
  validateMichaelResponseContract,
} from '../index.js';
import type {
  DeriveMichaelSelectionRequestFromRuntimeTurnInput,
  MichaelResponseCatalogSelectionRequest,
  MichaelResponseSelectionRequestDerivationResult,
  RuntimeTurnFixtureHarnessResult,
  RuntimeTurnFixtureScenarioType,
} from '../types.js';

// ───────────────────────────────────────────────────────────────────────────
// S2.19 — Michael selection-request derivation via the runtime-turn entry point
// (deriveMichaelResponseCatalogSelectionRequestFromRuntimeTurn). The runtime turn
// is produced by the inert S2.8 fixture harness; identity / turnId / taskType
// default to the turn's own input. The derivation reuses the inert adapter
// classification, never mutates the runtime turn or catalog, and is deterministic
// (returns issues, never throws) when the turn cannot be classified. No route,
// no LLM, no persistence, no dynamic generation.
// ───────────────────────────────────────────────────────────────────────────

type TurnOverrides = {
  readonly scenario?: RuntimeTurnFixtureScenarioType;
  readonly agentKey?: unknown;
  readonly taskType?: McsRuntimeTaskType;
};

async function makeRuntimeTurn(
  overrides: TurnOverrides = {},
): Promise<RuntimeTurnFixtureHarnessResult> {
  return runRuntimeTurnFixtureScenario({
    scenario: overrides.scenario ?? 'accepted_complete',
    agentKey: overrides.agentKey ?? 'michael_magnificent',
    taskType: overrides.taskType ?? 'training_support',
  });
}

async function deriveTurn(
  turnOverrides: TurnOverrides = {},
  deriveArgs: Omit<DeriveMichaelSelectionRequestFromRuntimeTurnInput, 'runtimeTurn'> = {},
): Promise<MichaelResponseSelectionRequestDerivationResult> {
  const runtimeTurn = await makeRuntimeTurn(turnOverrides);
  return deriveMichaelResponseCatalogSelectionRequestFromRuntimeTurn({ runtimeTurn, ...deriveArgs });
}

const CATALOG_KEYS = new Set(MICHAEL_RESPONSE_CATALOG.map((entry) => entry.catalogKey));

function expectDerived(
  result: MichaelResponseSelectionRequestDerivationResult,
): MichaelResponseCatalogSelectionRequest {
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error('expected ok derivation');
  expect(result.selectionRequest.agentKey).toBe('michael_magnificent');
  expect(result.selectionRequest.taskType).toBe('training_support');
  return result.selectionRequest;
}

function expectSelectsValidEntry(req: MichaelResponseCatalogSelectionRequest): void {
  const selection = selectMichaelResponseCatalogEntry(req);
  expect(selection.ok).toBe(true);
  if (!selection.ok) return;
  expect(CATALOG_KEYS.has(selection.catalogKey)).toBe(true);
  expect(getMichaelResponseCatalogEntry(selection.catalogKey)).toBeDefined();
  expect(validateMichaelResponseContract(selection.response).ok).toBe(true);
  expect(selection.response.agentResponseGenerated).toBe(false);
  expect(selection.response.persistence).toBe('disabled');
}

/** Copy of the michaelRuntimeAdapterContract.test.ts non-Context-Manager mutator. */
function withNonContextManagerAssembly(
  runtimeTurn: RuntimeTurnFixtureHarnessResult,
): RuntimeTurnFixtureHarnessResult {
  const result = runtimeTurn.result;
  if ('contextRequestResult' in result && result.contextRequestResult.consumption.packet) {
    result.contextRequestResult.consumption.packet.metadata = {
      ...result.contextRequestResult.consumption.packet.metadata,
      generatedBy: 'adapter',
    } as never;
  }
  return runtimeTurn;
}

describe('S2.19 Michael selection-request derivation (runtime-turn entry point)', () => {
  // ── 1. Complete clear → next_training_step / clear intent. ─────────────────
  it('derives complete clear → next_training_step with clear_training_support intent', async () => {
    const req = expectDerived(await deriveTurn({}, { intent: 'clear_training_support' }));
    expect(req.scenarioFamily).toBe('complete');
    expect(req.responseType).toBe('next_training_step');
    expect(req.intent).toBe('clear_training_support');
    expect(req.contextPacketStatus).toBe('complete');
  });

  // ── 2. Complete ambiguous → clarification_question / ambiguous intent. ─────
  it('derives complete ambiguous → clarification_question with ambiguous_training_support intent', async () => {
    const req = expectDerived(await deriveTurn({}, { intent: 'ambiguous_training_support' }));
    expect(req.scenarioFamily).toBe('complete');
    expect(req.responseType).toBe('clarification_question');
    expect(req.intent).toBe('ambiguous_training_support');
  });

  // ── 3. Degraded → safe_fallback. ───────────────────────────────────────────
  it('derives degraded → safe_fallback', async () => {
    const req = expectDerived(await deriveTurn({ scenario: 'accepted_degraded' }));
    expect(req.scenarioFamily).toBe('degraded');
    expect(req.responseType).toBe('safe_fallback');
  });

  // ── 4. Missing → safe_fallback. ────────────────────────────────────────────
  it('derives missing → safe_fallback', async () => {
    const req = expectDerived(await deriveTurn({ scenario: 'missing_context_manager' }));
    expect(req.scenarioFamily).toBe('missing');
    expect(req.responseType).toBe('safe_fallback');
  });

  // ── 5. Failed → safe_close. ────────────────────────────────────────────────
  it('derives failed → safe_close', async () => {
    const req = expectDerived(await deriveTurn({ scenario: 'failed_context' }));
    expect(req.scenarioFamily).toBe('failed');
    expect(req.responseType).toBe('safe_close');
  });

  // ── 6. Rejected → safe_close. ──────────────────────────────────────────────
  it('derives rejected → safe_close', async () => {
    const req = expectDerived(await deriveTurn({ scenario: 'candidate_review_only_rejected' }));
    expect(req.scenarioFamily).toBe('rejected');
    expect(req.responseType).toBe('safe_close');
  });

  // ── 7. Candidate/review-only collapses to rejected → safe_close. ───────────
  it('derives candidate/review-only → rejected safe_close', async () => {
    const req = expectDerived(await deriveTurn({ scenario: 'candidate_review_only_rejected' }));
    expect(req.scenarioFamily).toBe('rejected');
    expect(req.responseType).toBe('safe_close');
  });

  // ── 8. Wrong agent collapses to ok:true rejected → safe_close. ─────────────
  it('derives wrong agent → ok:true rejected safe_close', async () => {
    const req = expectDerived(
      await deriveTurn({ agentKey: 'steve_success', scenario: 'accepted_complete' }),
    );
    expect(req.scenarioFamily).toBe('rejected');
    expect(req.responseType).toBe('safe_close');
  });

  // ── 9. Wrong task collapses to ok:true rejected → safe_close. ──────────────
  it('derives wrong task → ok:true rejected safe_close', async () => {
    const req = expectDerived(await deriveTurn({ taskType: 'success_interview' }));
    expect(req.scenarioFamily).toBe('rejected');
    expect(req.responseType).toBe('safe_close');
  });

  // ── 10. Unsupported language → ok:true rejected safe_close, language en. ────
  it('derives unsupported language → ok:true rejected safe_close with language en', async () => {
    const req = expectDerived(await deriveTurn({}, { language: 'fr' }));
    expect(req.scenarioFamily).toBe('rejected');
    expect(req.responseType).toBe('safe_close');
    expect(req.language).toBe('en');
  });

  // ── 11. Non-Context-Manager assembly → ok:true rejected safe_close. ────────
  it('derives non-Context-Manager assembled packet → ok:true rejected safe_close', async () => {
    const runtimeTurn = withNonContextManagerAssembly(await makeRuntimeTurn());
    const req = expectDerived(
      deriveMichaelResponseCatalogSelectionRequestFromRuntimeTurn({ runtimeTurn }),
    );
    expect(req.scenarioFamily).toBe('rejected');
    expect(req.responseType).toBe('safe_close');
  });

  // ── 12. EN derivations select a valid catalog entry. ───────────────────────
  it('feeds EN derivations into the selector and selects ok:true', async () => {
    const results = [
      await deriveTurn({}, { intent: 'clear_training_support' }),
      await deriveTurn({}, { intent: 'ambiguous_training_support' }),
      await deriveTurn({ scenario: 'accepted_degraded' }),
      await deriveTurn({ scenario: 'missing_context_manager' }),
      await deriveTurn({ scenario: 'failed_context' }),
      await deriveTurn({ scenario: 'candidate_review_only_rejected' }),
    ];
    for (const result of results) {
      const req = expectDerived(result);
      expect(req.language).toBe('en');
      expectSelectsValidEntry(req);
    }
  });

  // ── 13. ES derivations select a valid catalog entry, language es. ──────────
  it('feeds ES derivations (degraded + failed + complete clear) into the selector', async () => {
    const results = [
      await deriveTurn({ scenario: 'accepted_degraded' }, { language: 'es' }),
      await deriveTurn({ scenario: 'failed_context' }, { language: 'es' }),
      await deriveTurn({}, { intent: 'clear_training_support', language: 'es' }),
    ];
    for (const result of results) {
      const req = expectDerived(result);
      expect(req.language).toBe('es');
      expectSelectsValidEntry(req);
    }
  });

  // ── 14. Every successful derivation maps to a real catalog key. ────────────
  it('maps every successful derivation to an existing catalog key', async () => {
    const results = [
      await deriveTurn({}, { intent: 'clear_training_support' }),
      await deriveTurn({}, { intent: 'ambiguous_training_support' }),
      await deriveTurn({ scenario: 'accepted_degraded' }),
      await deriveTurn({ scenario: 'missing_context_manager' }),
      await deriveTurn({ scenario: 'failed_context' }),
      await deriveTurn({ scenario: 'candidate_review_only_rejected' }),
      await deriveTurn({ agentKey: 'steve_success', scenario: 'accepted_complete' }),
      await deriveTurn({ taskType: 'success_interview' }),
      await deriveTurn({}, { language: 'fr' }),
    ];
    for (const result of results) {
      const req = expectDerived(result);
      const selection = selectMichaelResponseCatalogEntry(req);
      expect(selection.ok).toBe(true);
      if (!selection.ok) continue;
      expect(getMichaelResponseCatalogEntry(selection.catalogKey)).toBeDefined();
      expect(CATALOG_KEYS.has(selection.catalogKey)).toBe(true);
    }
  });

  // ── 15. Every successful derivation selects a contract-valid entry. ────────
  it('selects a contract-valid entry for every successful derivation', async () => {
    for (const result of [
      await deriveTurn({}, { intent: 'clear_training_support' }),
      await deriveTurn({ scenario: 'accepted_degraded' }),
      await deriveTurn({ scenario: 'candidate_review_only_rejected' }),
    ]) {
      const req = expectDerived(result);
      const selection = selectMichaelResponseCatalogEntry(req);
      expect(selection.ok).toBe(true);
      if (!selection.ok) continue;
      expect(validateMichaelResponseContract(selection.response).ok).toBe(true);
    }
  });

  // ── 16. Deterministic, no-throw failure when identity / turnId are absent. ─
  it('returns missing_identity (no throw) when the runtime turn has no identity', async () => {
    const runtimeTurn = await makeRuntimeTurn();
    delete (runtimeTurn.input as { identity?: unknown }).identity;

    let result: MichaelResponseSelectionRequestDerivationResult | undefined;
    expect(() => {
      result = deriveMichaelResponseCatalogSelectionRequestFromRuntimeTurn({ runtimeTurn });
    }).not.toThrow();
    expect(result?.ok).toBe(false);
    if (!result || result.ok) return;
    expect(result.issues.map((issue) => issue.code)).toContain('missing_identity');
  });

  it('returns missing_turn_id (no throw) when the runtime turn has no turnId', async () => {
    const runtimeTurn = await makeRuntimeTurn();
    delete (runtimeTurn.input as { turnId?: unknown }).turnId;

    let result: MichaelResponseSelectionRequestDerivationResult | undefined;
    expect(() => {
      result = deriveMichaelResponseCatalogSelectionRequestFromRuntimeTurn({ runtimeTurn });
    }).not.toThrow();
    expect(result?.ok).toBe(false);
    if (!result || result.ok) return;
    expect(result.issues.map((issue) => issue.code)).toContain('missing_turn_id');
  });

  // ── 17. Derivation does not mutate the runtime turn fixture. ───────────────
  it('does not mutate the runtime turn fixture', async () => {
    const runtimeTurn = await makeRuntimeTurn();
    const before = JSON.stringify(runtimeTurn);
    deriveMichaelResponseCatalogSelectionRequestFromRuntimeTurn({
      runtimeTurn,
      intent: 'clear_training_support',
    });
    expect(JSON.stringify(runtimeTurn)).toBe(before);
  });

  // ── 18. Derivation never mutates the catalog entries. ──────────────────────
  it('does not mutate MICHAEL_RESPONSE_CATALOG', async () => {
    const before = JSON.stringify(MICHAEL_RESPONSE_CATALOG);
    await deriveTurn({}, { intent: 'clear_training_support' });
    await deriveTurn({ scenario: 'accepted_degraded' });
    await deriveTurn({ scenario: 'failed_context' });
    await deriveTurn({}, { language: 'fr' });
    expect(JSON.stringify(MICHAEL_RESPONSE_CATALOG)).toBe(before);
  });

  // ── 19. Selected entry preserves agentResponseGenerated:false downstream. ──
  it('preserves agentResponseGenerated:false on the selected entry', async () => {
    const req = expectDerived(await deriveTurn({}, { intent: 'clear_training_support' }));
    const selection = selectMichaelResponseCatalogEntry(req);
    expect(selection.ok).toBe(true);
    if (!selection.ok) return;
    expect(selection.response.agentResponseGenerated).toBe(false);
  });

  // ── 20. Selected entry preserves persistence:'disabled' downstream. ────────
  it("preserves persistence:'disabled' on the selected entry", async () => {
    const req = expectDerived(await deriveTurn({ scenario: 'failed_context' }));
    const selection = selectMichaelResponseCatalogEntry(req);
    expect(selection.ok).toBe(true);
    if (!selection.ok) return;
    expect(selection.response.persistence).toBe('disabled');
  });
});
