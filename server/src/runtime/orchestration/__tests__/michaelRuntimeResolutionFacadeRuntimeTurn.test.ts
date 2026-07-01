import type { McsRuntimeTaskType } from '@momentum/shared/runtime';
import { describe, expect, it } from 'vitest';
import {
  MICHAEL_RESPONSE_CATALOG,
  getMichaelResponseCatalogEntry,
  resolveMichaelRuntimeTurnResponseFromFixture,
  validateMichaelResponseContract,
} from '../index.js';
import { runRuntimeTurnFixtureScenario } from '../fixtures/runtimeTurnHarness.js';
import type {
  MichaelRuntimeResolutionResult,
  RuntimeTurnFixtureHarnessResult,
  RuntimeTurnFixtureScenarioType,
} from '../types.js';

type TurnOverrides = {
  readonly scenario?: RuntimeTurnFixtureScenarioType;
  readonly agentKey?: unknown;
  readonly taskType?: McsRuntimeTaskType;
  readonly language?: unknown;
  readonly intent?: 'clear_training_support' | 'ambiguous_training_support';
  readonly mutateRuntimeTurn?: (
    runtimeTurn: RuntimeTurnFixtureHarnessResult,
  ) => RuntimeTurnFixtureHarnessResult;
};

async function buildRuntimeTurn(
  overrides: TurnOverrides = {},
): Promise<RuntimeTurnFixtureHarnessResult> {
  const runtimeTurn = await runRuntimeTurnFixtureScenario({
    scenario: overrides.scenario ?? 'accepted_complete',
    agentKey: overrides.agentKey ?? 'michael_magnificent',
    taskType: overrides.taskType ?? 'training_support',
  });
  return overrides.mutateRuntimeTurn ? overrides.mutateRuntimeTurn(runtimeTurn) : runtimeTurn;
}

async function resolve(overrides: TurnOverrides = {}): Promise<MichaelRuntimeResolutionResult> {
  const runtimeTurn = await buildRuntimeTurn(overrides);
  return resolveMichaelRuntimeTurnResponseFromFixture({
    runtimeTurn,
    ...(overrides.taskType ? { taskType: overrides.taskType } : {}),
    ...(overrides.intent ? { intent: overrides.intent } : {}),
    ...(overrides.language !== undefined ? { language: overrides.language } : {}),
  });
}

function expectOk(
  result: MichaelRuntimeResolutionResult,
): asserts result is Extract<MichaelRuntimeResolutionResult, { ok: true }> {
  expect(result.ok).toBe(true);
}

// Copied verbatim from michaelRuntimeAdapterContract.test.ts.
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

describe('S2.20 Michael runtime resolution facade — runtime turn fixture', () => {
  it('1. resolves a complete clear turn to next_training_step (michael_next_training_step_en)', async () => {
    const result = await resolve({ intent: 'clear_training_support' });

    expectOk(result);
    expect(result.catalogKey).toBe('michael_next_training_step_en');
    expect(result.response.responseType).toBe('next_training_step');
    expect(result.trace.responseType).toBe('next_training_step');
  });

  it('2. resolves a complete ambiguous turn to michael_clarification_question_en', async () => {
    const result = await resolve({ intent: 'ambiguous_training_support' });

    expectOk(result);
    expect(result.catalogKey).toBe('michael_clarification_question_en');
    expect(result.response.responseType).toBe('clarification_question');
  });

  it('3. resolves a degraded turn to michael_safe_fallback_degraded_en (safe_fallback)', async () => {
    const result = await resolve({ scenario: 'accepted_degraded' });

    expectOk(result);
    expect(result.catalogKey).toBe('michael_safe_fallback_degraded_en');
    expect(result.response.responseType).toBe('safe_fallback');
  });

  it('4. resolves a missing-context-manager turn to michael_safe_fallback_missing_en', async () => {
    const result = await resolve({ scenario: 'missing_context_manager' });

    expectOk(result);
    expect(result.catalogKey).toBe('michael_safe_fallback_missing_en');
    expect(result.response.responseType).toBe('safe_fallback');
  });

  it('5. resolves a failed-context turn to michael_safe_close_failed_en (safe_close)', async () => {
    const result = await resolve({ scenario: 'failed_context' });

    expectOk(result);
    expect(result.catalogKey).toBe('michael_safe_close_failed_en');
    expect(result.response.responseType).toBe('safe_close');
  });

  it('6. resolves a candidate/review-only turn to michael_safe_close_rejected_en (safe_close)', async () => {
    const result = await resolve({ scenario: 'candidate_review_only_rejected' });

    expectOk(result);
    expect(result.catalogKey).toBe('michael_safe_close_rejected_en');
    expect(result.response.responseType).toBe('safe_close');
  });

  it('7. resolves a wrong-agent turn ok:true to a safe_close rejected entry (not substantive)', async () => {
    const result = await resolve({ agentKey: 'steve_success', scenario: 'accepted_complete' });

    expectOk(result);
    expect(result.catalogKey).toBe('michael_safe_close_rejected_en');
    expect(result.response.responseType).toBe('safe_close');
    expect(['next_training_step', 'clarification_question']).not.toContain(
      result.response.responseType,
    );
  });

  it('8. resolves a wrong-task turn ok:true to safe_close rejected', async () => {
    const result = await resolve({ taskType: 'success_interview' });

    expectOk(result);
    expect(result.catalogKey).toBe('michael_safe_close_rejected_en');
    expect(result.response.responseType).toBe('safe_close');
  });

  it('9. resolves an unsupported language (fr) ok:true to safe_close rejected with EN response', async () => {
    const result = await resolve({ language: 'fr' });

    expectOk(result);
    expect(result.catalogKey).toBe('michael_safe_close_rejected_en');
    expect(result.response.responseType).toBe('safe_close');
    expect(result.response.language).toBe('en');
  });

  it('10. resolves a non-Context-Manager assembled turn ok:true to safe_close rejected', async () => {
    const result = await resolve({ mutateRuntimeTurn: withNonContextManagerAssembly });

    expectOk(result);
    expect(result.catalogKey).toBe('michael_safe_close_rejected_en');
    expect(result.response.responseType).toBe('safe_close');
  });

  it('11. resolves EN turns to EN catalog entries', async () => {
    const results = [
      await resolve({ intent: 'clear_training_support' }),
      await resolve({ scenario: 'accepted_degraded' }),
      await resolve({ scenario: 'failed_context' }),
    ];

    for (const result of results) {
      expectOk(result);
      expect(result.catalogKey.endsWith('_en')).toBe(true);
      expect(result.response.language).toBe('en');
    }
  });

  it('12. resolves ES turns (degraded + failed + complete-clear) to ES catalog entries', async () => {
    const cases: TurnOverrides[] = [
      { scenario: 'accepted_degraded', language: 'es' },
      { scenario: 'failed_context', language: 'es' },
      { intent: 'clear_training_support', language: 'es' },
    ];

    for (const overrides of cases) {
      const result = await resolve(overrides);
      expectOk(result);
      expect(result.catalogKey.endsWith('_es')).toBe(true);
      expect(result.response.language).toBe('es');
    }
  });

  it('13. every successful result carries a valid catalogKey', async () => {
    const result = await resolve({ intent: 'clear_training_support' });

    expectOk(result);
    expect(getMichaelResponseCatalogEntry(result.catalogKey)).toBeDefined();
  });

  it('14. every successful result carries a valid Michael selectionRequest', async () => {
    const result = await resolve({ scenario: 'accepted_degraded' });

    expectOk(result);
    expect(result.selectionRequest.agentKey).toBe('michael_magnificent');
    expect(result.selectionRequest.taskType).toBe('training_support');
  });

  it('15. every successful response validates against michael_response_contract.v1', async () => {
    const result = await resolve({ intent: 'ambiguous_training_support' });

    expectOk(result);
    expect(validateMichaelResponseContract(result.response).ok).toBe(true);
  });

  it('16. every successful response preserves agentResponseGenerated === false', async () => {
    const result = await resolve({ scenario: 'missing_context_manager' });

    expectOk(result);
    expect(result.response.agentResponseGenerated).toBe(false);
    expect(result.trace.agentResponseGenerated).toBe(false);
  });

  it("17. every successful response preserves persistence === 'disabled'", async () => {
    const result = await resolve({ scenario: 'failed_context' });

    expectOk(result);
    expect(result.response.persistence).toBe('disabled');
    expect(result.trace.persistence).toBe('disabled');
  });

  it('18. deterministically rejects a runtime turn with no identity (invalid_runtime_turn) without throwing', async () => {
    const runtimeTurn = await buildRuntimeTurn({ intent: 'clear_training_support' });
    delete (runtimeTurn.input as { identity?: unknown }).identity;

    let result: MichaelRuntimeResolutionResult | undefined;
    expect(() => {
      result = resolveMichaelRuntimeTurnResponseFromFixture({ runtimeTurn });
    }).not.toThrow();

    expect(result).toBeDefined();
    expect(result!.ok).toBe(false);
    if (!result!.ok) {
      expect(result!.issues).toHaveLength(1);
      expect(result!.issues[0]!.code).toBe('invalid_runtime_turn');
    }
  });

  it('19. does not mutate the runtime turn it resolves', async () => {
    const runtimeTurn = await buildRuntimeTurn({ intent: 'clear_training_support' });
    const before = JSON.stringify(runtimeTurn);

    resolveMichaelRuntimeTurnResponseFromFixture({ runtimeTurn, intent: 'clear_training_support' });

    expect(JSON.stringify(runtimeTurn)).toBe(before);
  });

  it('20. does not mutate the catalog', async () => {
    const before = JSON.stringify(MICHAEL_RESPONSE_CATALOG);

    await resolve({ intent: 'clear_training_support' });
    await resolve({ scenario: 'failed_context' });

    expect(JSON.stringify(MICHAEL_RESPONSE_CATALOG)).toBe(before);
  });

  it('21. returns the existing catalog fixture BY REFERENCE', async () => {
    const result = await resolve({ intent: 'clear_training_support' });

    expectOk(result);
    expect(result.response).toBe(getMichaelResponseCatalogEntry(result.catalogKey)!.response);
    expect(result.response).toBe(result.catalogEntry.response);
  });

  it('22. does not generate text: response.text is the catalog fixture verbatim and no trace.text exists', async () => {
    const result = await resolve({ intent: 'clear_training_support' });

    expectOk(result);
    const catalogEntry = getMichaelResponseCatalogEntry(result.catalogKey)!;
    expect(result.response.text).toBe(catalogEntry.response.text);
    expect(result.trace).not.toHaveProperty('text');
  });
});
