import type { RuntimeTaskType } from '@momentum/shared/runtime';
import { describe, expect, it } from 'vitest';
import {
  MICHAEL_RESPONSE_CATALOG,
  deriveMichaelResponseCatalogSelectionRequest,
  deriveMichaelResponseCatalogSelectionRequestFromAdapterContractInput,
  getMichaelResponseCatalogEntry,
  runRuntimeTurnFixtureScenario,
  selectMichaelResponseCatalogEntry,
  validateMichaelResponseContract,
} from '../index.js';
import type {
  MichaelResponseCatalogSelectionRequest,
  MichaelResponseSelectionRequestDerivationResult,
  MichaelRuntimeAdapterContractInput,
  MichaelRuntimeAdapterContractIntent,
  RuntimeTurnFixtureHarnessResult,
  RuntimeTurnFixtureScenarioType,
} from '../types.js';

// ───────────────────────────────────────────────────────────────────────────
// S2.19 — Michael response catalog selection-request derivation (adapter-contract
// input path). The derivation reuses the inert adapter classification: for a
// given runtime turn it runs the already-inert runMichaelRuntimeAdapterContract
// and reads only the resolved (scenarioFamily, responseType, language) metadata
// to build a deterministic catalog-selection request. No route, no LLM, no
// persistence, no dynamic generation are touched here — fixtures + catalog only.
// ───────────────────────────────────────────────────────────────────────────

type DeriveOverrides = {
  readonly scenario?: RuntimeTurnFixtureScenarioType;
  readonly agentKey?: unknown;
  readonly taskType?: RuntimeTaskType;
  readonly language?: unknown;
  readonly intent?: MichaelRuntimeAdapterContractIntent;
  readonly mutateRuntimeTurn?: (
    runtimeTurn: RuntimeTurnFixtureHarnessResult,
  ) => RuntimeTurnFixtureHarnessResult;
};

/**
 * Build a MichaelRuntimeAdapterContractInput from the inert runtime-turn fixture
 * harness — mirrors the `runContract` helper in
 * michaelRuntimeAdapterContract.test.ts so the derivation is exercised on the
 * same adapter inputs the contract layer is proven against.
 */
async function buildAdapterContractInput(
  overrides: DeriveOverrides = {},
): Promise<MichaelRuntimeAdapterContractInput> {
  const taskType = overrides.taskType ?? 'training_support';
  const runtimeTurn = await runRuntimeTurnFixtureScenario({
    scenario: overrides.scenario ?? 'accepted_complete',
    agentKey: overrides.agentKey ?? 'michael_magnificent',
    taskType,
  });
  const fixtureTurn = overrides.mutateRuntimeTurn
    ? overrides.mutateRuntimeTurn(runtimeTurn)
    : runtimeTurn;
  if (overrides.language !== undefined && fixtureTurn.input.identity) {
    fixtureTurn.input.identity.language = overrides.language as never;
  }
  const identity = fixtureTurn.input.identity;
  const turnId = fixtureTurn.input.turnId;

  expect(identity).toBeDefined();
  expect(turnId).toBeDefined();

  return {
    identity: identity!,
    turnId: turnId!,
    taskType,
    runtimeTurn: fixtureTurn,
    ...(overrides.intent ? { intent: overrides.intent } : {}),
    ...(overrides.language !== undefined ? { language: overrides.language } : {}),
  };
}

async function derive(
  overrides: DeriveOverrides = {},
): Promise<MichaelResponseSelectionRequestDerivationResult> {
  return deriveMichaelResponseCatalogSelectionRequest(await buildAdapterContractInput(overrides));
}

const CATALOG_KEYS = new Set(MICHAEL_RESPONSE_CATALOG.map((entry) => entry.catalogKey));

/** Narrow to a successful derivation, asserting the shared request envelope. */
function expectDerived(
  result: MichaelResponseSelectionRequestDerivationResult,
): MichaelResponseCatalogSelectionRequest {
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error('expected ok derivation');
  expect(result.selectionRequest.agentKey).toBe('michael_magnificent');
  expect(result.selectionRequest.taskType).toBe('training_support');
  return result.selectionRequest;
}

/** Prove a derived request resolves to a real, contract-valid catalog entry. */
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

describe('S2.19 Michael selection-request derivation (adapter-contract input)', () => {
  // ── 1. Complete clear → next_training_step / clear intent. ─────────────────
  it('derives complete clear → next_training_step with clear_training_support intent', async () => {
    const req = expectDerived(await derive({ intent: 'clear_training_support' }));
    expect(req.scenarioFamily).toBe('complete');
    expect(req.responseType).toBe('next_training_step');
    expect(req.intent).toBe('clear_training_support');
    expect(req.contextPacketStatus).toBe('complete');
  });

  // ── 2. Complete ambiguous → clarification_question / ambiguous intent. ─────
  it('derives complete ambiguous → clarification_question with ambiguous_training_support intent', async () => {
    const req = expectDerived(await derive({ intent: 'ambiguous_training_support' }));
    expect(req.scenarioFamily).toBe('complete');
    expect(req.responseType).toBe('clarification_question');
    expect(req.intent).toBe('ambiguous_training_support');
  });

  // ── 3. Degraded → safe_fallback. ───────────────────────────────────────────
  it('derives degraded → safe_fallback', async () => {
    const req = expectDerived(await derive({ scenario: 'accepted_degraded' }));
    expect(req.scenarioFamily).toBe('degraded');
    expect(req.responseType).toBe('safe_fallback');
  });

  // ── 4. Missing → safe_fallback. ────────────────────────────────────────────
  it('derives missing → safe_fallback', async () => {
    const req = expectDerived(await derive({ scenario: 'missing_context_manager' }));
    expect(req.scenarioFamily).toBe('missing');
    expect(req.responseType).toBe('safe_fallback');
  });

  // ── 5. Failed → safe_close. ────────────────────────────────────────────────
  it('derives failed → safe_close', async () => {
    const req = expectDerived(await derive({ scenario: 'failed_context' }));
    expect(req.scenarioFamily).toBe('failed');
    expect(req.responseType).toBe('safe_close');
  });

  // ── 6. Rejected → safe_close. ──────────────────────────────────────────────
  it('derives rejected → safe_close', async () => {
    const req = expectDerived(await derive({ scenario: 'candidate_review_only_rejected' }));
    expect(req.scenarioFamily).toBe('rejected');
    expect(req.responseType).toBe('safe_close');
  });

  // ── 7. Candidate/review-only collapses to rejected → safe_close. ───────────
  it('derives candidate/review-only → rejected safe_close', async () => {
    const req = expectDerived(await derive({ scenario: 'candidate_review_only_rejected' }));
    expect(req.scenarioFamily).toBe('rejected');
    expect(req.responseType).toBe('safe_close');
  });

  // ── 8. Wrong agent collapses to ok:true rejected → safe_close. ─────────────
  it('derives wrong agent → ok:true rejected safe_close', async () => {
    const req = expectDerived(
      await derive({ agentKey: 'steve_success', scenario: 'accepted_complete' }),
    );
    expect(req.scenarioFamily).toBe('rejected');
    expect(req.responseType).toBe('safe_close');
  });

  // ── 9. Wrong task collapses to ok:true rejected → safe_close. ──────────────
  it('derives wrong task → ok:true rejected safe_close', async () => {
    const req = expectDerived(await derive({ taskType: 'success_interview' }));
    expect(req.scenarioFamily).toBe('rejected');
    expect(req.responseType).toBe('safe_close');
  });

  // ── 10. Unsupported language → ok:true rejected safe_close, language en. ────
  it('derives unsupported language → ok:true rejected safe_close with language en', async () => {
    const req = expectDerived(await derive({ language: 'fr' }));
    expect(req.scenarioFamily).toBe('rejected');
    expect(req.responseType).toBe('safe_close');
    expect(req.language).toBe('en');
  });

  // ── 11. Non-Context-Manager assembly → ok:true rejected safe_close. ────────
  it('derives non-Context-Manager assembled packet → ok:true rejected safe_close', async () => {
    const req = expectDerived(await derive({ mutateRuntimeTurn: withNonContextManagerAssembly }));
    expect(req.scenarioFamily).toBe('rejected');
    expect(req.responseType).toBe('safe_close');
  });

  // ── 12. EN derivations select a valid catalog entry. ───────────────────────
  it('feeds EN derivations into the selector and selects ok:true', async () => {
    const results = [
      await derive({ intent: 'clear_training_support' }),
      await derive({ intent: 'ambiguous_training_support' }),
      await derive({ scenario: 'accepted_degraded' }),
      await derive({ scenario: 'missing_context_manager' }),
      await derive({ scenario: 'failed_context' }),
      await derive({ scenario: 'candidate_review_only_rejected' }),
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
      await derive({ scenario: 'accepted_degraded', language: 'es' }),
      await derive({ scenario: 'failed_context', language: 'es' }),
      await derive({ intent: 'clear_training_support', language: 'es' }),
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
      await derive({ intent: 'clear_training_support' }),
      await derive({ intent: 'ambiguous_training_support' }),
      await derive({ scenario: 'accepted_degraded' }),
      await derive({ scenario: 'missing_context_manager' }),
      await derive({ scenario: 'failed_context' }),
      await derive({ scenario: 'candidate_review_only_rejected' }),
      await derive({ agentKey: 'steve_success', scenario: 'accepted_complete' }),
      await derive({ taskType: 'success_interview' }),
      await derive({ language: 'fr' }),
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
      await derive({ intent: 'clear_training_support' }),
      await derive({ scenario: 'accepted_degraded' }),
      await derive({ scenario: 'failed_context' }),
    ]) {
      const req = expectDerived(result);
      const selection = selectMichaelResponseCatalogEntry(req);
      expect(selection.ok).toBe(true);
      if (!selection.ok) continue;
      expect(validateMichaelResponseContract(selection.response).ok).toBe(true);
    }
  });

  // ── 18. Derivation never mutates the catalog entries. ──────────────────────
  it('does not mutate MICHAEL_RESPONSE_CATALOG', async () => {
    const before = JSON.stringify(MICHAEL_RESPONSE_CATALOG);
    await derive({ intent: 'clear_training_support' });
    await derive({ scenario: 'accepted_degraded' });
    await derive({ scenario: 'failed_context' });
    await derive({ language: 'fr' });
    expect(JSON.stringify(MICHAEL_RESPONSE_CATALOG)).toBe(before);
  });

  // ── 19. Selected entry preserves agentResponseGenerated:false downstream. ──
  it('preserves agentResponseGenerated:false on the selected entry', async () => {
    const req = expectDerived(await derive({ intent: 'clear_training_support' }));
    const selection = selectMichaelResponseCatalogEntry(req);
    expect(selection.ok).toBe(true);
    if (!selection.ok) return;
    expect(selection.response.agentResponseGenerated).toBe(false);
  });

  // ── 20. Selected entry preserves persistence:'disabled' downstream. ────────
  it("preserves persistence:'disabled' on the selected entry", async () => {
    const req = expectDerived(await derive({ scenario: 'failed_context' }));
    const selection = selectMichaelResponseCatalogEntry(req);
    expect(selection.ok).toBe(true);
    if (!selection.ok) return;
    expect(selection.response.persistence).toBe('disabled');
  });

  // ── Alias parity: both adapter-contract entry points agree. ────────────────
  it('derives identically via the FromAdapterContractInput alias', async () => {
    const input = await buildAdapterContractInput({ intent: 'clear_training_support' });
    const viaPrimary = deriveMichaelResponseCatalogSelectionRequest(input);
    const viaAlias = deriveMichaelResponseCatalogSelectionRequestFromAdapterContractInput(input);
    expect(viaAlias).toEqual(viaPrimary);
  });
});

/**
 * Copy of the michaelRuntimeAdapterContract.test.ts mutator: forces the assembled
 * Context Packet to look like it was generated by the adapter rather than the
 * Context Manager, so the adapter rejects it (→ rejected / safe_close).
 */
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
