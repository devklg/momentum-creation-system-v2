import type { RuntimeTaskType } from '@momentum/shared/runtime';
import { describe, expect, it } from 'vitest';
import { runMichaelRuntimeAdapterContract } from '../michaelRuntimeAdapterContract.js';
import { runRuntimeTurnFixtureScenario } from '../fixtures/runtimeTurnHarness.js';
import {
  selectMichaelResponseCatalogEntry,
} from '../index.js';
import type {
  MichaelCatalogSelectorIntent,
  MichaelResponseCatalogSelectionRequest,
  MichaelResponseContractV1,
  MichaelRuntimeAdapterContractResult,
  RuntimeTurnFixtureHarnessResult,
  RuntimeTurnFixtureScenarioType,
} from '../types.js';

// S2.18 — Adapter <-> catalog/selector parity. The inert adapter picks a
// pre-authored fixture for each scenario; the selector resolves the same fixture
// from MICHAEL_RESPONSE_CATALOG given the equivalent request. Because both the
// adapter (validation.contract) and the catalog reference the SAME imported
// fixture object, parity is provable with reference equality (toBe).

type ContractInputOverrides = {
  readonly scenario?: RuntimeTurnFixtureScenarioType;
  readonly agentKey?: unknown;
  readonly taskType?: RuntimeTaskType;
  readonly language?: unknown;
  readonly intent?: 'clear_training_support' | 'ambiguous_training_support';
  readonly mutateRuntimeTurn?: (
    runtimeTurn: RuntimeTurnFixtureHarnessResult,
  ) => RuntimeTurnFixtureHarnessResult;
};

// Local copy of the runContract helper pattern from
// michaelRuntimeAdapterContract.test.ts — intentionally duplicated rather than
// importing a private test helper from another spec file.
async function runContract(
  overrides: ContractInputOverrides = {},
): Promise<MichaelRuntimeAdapterContractResult> {
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

  return runMichaelRuntimeAdapterContract({
    identity: identity!,
    turnId: turnId!,
    taskType,
    runtimeTurn: fixtureTurn,
    intent: overrides.intent,
    language: overrides.language,
  });
}

const MICHAEL_AGENT_KEY = 'michael_magnificent';
const MICHAEL_TASK_TYPE = 'training_support';

const INTENT_FOR_COMPLETE_RESPONSE_TYPE: Readonly<
  Record<string, MichaelCatalogSelectorIntent>
> = {
  next_training_step: 'clear_training_support',
  clarification_question: 'ambiguous_training_support',
};

/**
 * Build the canonical selection request that should resolve to the same catalog
 * entry the adapter chose, derived purely from the adapter's michaelResponse:
 * language, responseType, and scenarioFamily = contextPacketStatus.
 */
function selectionRequestFromResponse(
  response: MichaelResponseContractV1,
): MichaelResponseCatalogSelectionRequest {
  const scenarioFamily = response.contextPacketStatus;
  return {
    agentKey: MICHAEL_AGENT_KEY,
    taskType: MICHAEL_TASK_TYPE,
    language: response.language,
    responseType: response.responseType,
    scenarioFamily,
    contextPacketStatus: scenarioFamily,
    ...(scenarioFamily === 'complete'
      ? { intent: INTENT_FOR_COMPLETE_RESPONSE_TYPE[response.responseType] }
      : {}),
  };
}

/**
 * Assert the selector resolves the byte-identical fixture object the adapter
 * returned, and return the selected catalog entry for further assertions.
 */
function expectSelectorParity(result: MichaelRuntimeAdapterContractResult) {
  const request = selectionRequestFromResponse(result.michaelResponse);
  const selection = selectMichaelResponseCatalogEntry(request);

  expect(selection.ok).toBe(true);
  if (!selection.ok) {
    throw new Error('selector did not resolve the adapter fixture');
  }

  // Reference equality: adapter fixture === catalog fixture === selector output.
  expect(selection.response).toBe(result.michaelResponse);
  return selection;
}

function expectInert(result: MichaelRuntimeAdapterContractResult): void {
  expect(result.agentResponseGenerated).toBe(false);
  expect(result.michaelResponse.agentResponseGenerated).toBe(false);
  expect(result.eventPersistence).toBe('disabled');
  expect(result.outcomePersistence).toBe('disabled');
  expect(result.guidedActionPersistence).toBe('disabled');
  expect(result.envelopePersistence).toBe('disabled');
  expect(result.responsePersistence).toBe('disabled');
  expect(result.michaelResponse.persistence).toBe('disabled');
}

describe('S2.18 Michael runtime adapter <-> catalog/selector parity', () => {
  it('#6 complete CLEAR path selects next_training_step (parity)', async () => {
    const result = await runContract({ intent: 'clear_training_support', language: 'en' });

    expect(result.michaelResponse.responseType).toBe('next_training_step');
    expect(result.michaelResponse.contextPacketStatus).toBe('complete');
    const selection = expectSelectorParity(result);
    expect(selection.catalogKey).toBe('michael_next_training_step_en');
    expectInert(result);
  });

  it('#7 complete AMBIGUOUS path selects clarification_question (parity)', async () => {
    const result = await runContract({ intent: 'ambiguous_training_support', language: 'en' });

    expect(result.michaelResponse.responseType).toBe('clarification_question');
    expect(result.michaelResponse.contextPacketStatus).toBe('complete');
    const selection = expectSelectorParity(result);
    expect(selection.catalogKey).toBe('michael_clarification_question_en');
    expectInert(result);
  });

  it('#8 degraded path selects the degraded safe_fallback (parity)', async () => {
    const result = await runContract({ scenario: 'accepted_degraded' });

    expect(result.michaelResponse.contextPacketStatus).toBe('degraded');
    const selection = expectSelectorParity(result);
    expect(selection.entry.scenarioFamily).toBe('degraded');
    expectInert(result);
  });

  it('#9 missing path selects the missing safe entry (parity)', async () => {
    const result = await runContract({ scenario: 'missing_context_manager' });

    const selection = expectSelectorParity(result);
    expect(selection.entry.scenarioFamily).toBe(result.michaelResponse.contextPacketStatus);
    expectInert(result);
  });

  it('#10 failed path selects the failed safe_close (parity)', async () => {
    const result = await runContract({ scenario: 'failed_context' });

    expect(result.michaelResponse.contextPacketStatus).toBe('failed');
    const selection = expectSelectorParity(result);
    expect(selection.entry.scenarioFamily).toBe('failed');
    expectInert(result);
  });

  it('#11 rejected / candidate-review-only path selects safe_close rejected (parity)', async () => {
    const result = await runContract({ scenario: 'candidate_review_only_rejected' });

    expect(result.michaelResponse.responseType).toBe('safe_close');
    expect(result.michaelResponse.contextPacketStatus).toBe('rejected');
    const selection = expectSelectorParity(result);
    expect(selection.catalogKey).toBe('michael_safe_close_rejected_en');
    expectInert(result);
  });

  it('#12 EN/ES parity — degraded + failed in Spanish resolve to the ES catalog entries', async () => {
    const degradedEs = await runContract({ scenario: 'accepted_degraded', language: 'es' });
    expect(degradedEs.michaelResponse.language).toBe('es');
    const degradedSelection = expectSelectorParity(degradedEs);
    expect(degradedSelection.entry.language).toBe('es');
    expect(degradedSelection.catalogKey.endsWith('_es')).toBe(true);
    expectInert(degradedEs);

    const failedEs = await runContract({ scenario: 'failed_context', language: 'es' });
    expect(failedEs.michaelResponse.language).toBe('es');
    const failedSelection = expectSelectorParity(failedEs);
    expect(failedSelection.entry.language).toBe('es');
    expect(failedSelection.catalogKey).toBe('michael_safe_close_failed_es');
    expectInert(failedEs);
  });

  it('#13 safe-close / safe-fallback paths never select substantive entries', async () => {
    const safeScenarios: readonly RuntimeTurnFixtureScenarioType[] = [
      'accepted_degraded',
      'missing_context_manager',
      'failed_context',
      'candidate_review_only_rejected',
    ];

    for (const scenario of safeScenarios) {
      const result = await runContract({ scenario });
      const selection = expectSelectorParity(result);
      expect(selection.entry.isSubstantive, `${scenario} isSubstantive`).toBe(false);
      expect(selection.entry.isSafePath, `${scenario} isSafePath`).toBe(true);
    }
  });

  it('#14 substantive paths never select safe entries', async () => {
    const clear = await runContract({ intent: 'clear_training_support', language: 'en' });
    const ambiguous = await runContract({ intent: 'ambiguous_training_support', language: 'en' });

    for (const result of [clear, ambiguous]) {
      const selection = expectSelectorParity(result);
      expect(selection.entry.isSafePath).toBe(false);
      expect(selection.entry.isSubstantive).toBe(true);
    }
  });

  it('#15 candidate / review-only path selects rejected safe_close only', async () => {
    for (const language of ['en', 'es'] as const) {
      const result = await runContract({
        scenario: 'candidate_review_only_rejected',
        language,
      });
      const selection = expectSelectorParity(result);

      expect(selection.catalogKey).toBe(`michael_safe_close_rejected_${language}`);
      expect(selection.entry.responseType).toBe('safe_close');
      expect(selection.entry.contextPacketStatus).toBe('rejected');
      expect(result.michaelResponse.responseType).toBe('safe_close');
      expect(result.michaelResponse.contextPacketStatus).toBe('rejected');
    }
  });

  it('#16 wrong agent / wrong task / unsupported language safe-close WITHOUT dynamic generation; selector rejects the invalid request', async () => {
    // Wrong agent — adapter safe-closes; selector rejects the wrong-agent request.
    const wrongAgent = await runContract({
      agentKey: 'steve_success',
      scenario: 'accepted_complete',
    });
    expect(wrongAgent.michaelResponse.responseType).toBe('safe_close');
    expectInert(wrongAgent);
    const wrongAgentSelection = selectMichaelResponseCatalogEntry({
      agentKey: 'steve_success',
      taskType: MICHAEL_TASK_TYPE,
      language: 'en',
      responseType: 'safe_close',
      scenarioFamily: 'rejected',
    });
    expect(wrongAgentSelection.ok).toBe(false);
    if (!wrongAgentSelection.ok) {
      expect(wrongAgentSelection.issues.map((i) => i.code)).toContain('wrong_agent');
    }

    // Wrong task — adapter safe-closes; selector rejects the wrong-task request.
    const wrongTask = await runContract({ taskType: 'success_interview' });
    expect(wrongTask.michaelResponse.responseType).toBe('safe_close');
    expectInert(wrongTask);
    const wrongTaskSelection = selectMichaelResponseCatalogEntry({
      agentKey: MICHAEL_AGENT_KEY,
      taskType: 'success_interview',
      language: 'en',
      responseType: 'safe_close',
      scenarioFamily: 'rejected',
    });
    expect(wrongTaskSelection.ok).toBe(false);
    if (!wrongTaskSelection.ok) {
      expect(wrongTaskSelection.issues.map((i) => i.code)).toContain('wrong_task');
    }

    // Unsupported language — adapter safe-closes; selector rejects the request.
    const badLanguage = await runContract({ language: 'fr' });
    expect(badLanguage.michaelResponse.responseType).toBe('safe_close');
    expectInert(badLanguage);
    const badLanguageSelection = selectMichaelResponseCatalogEntry({
      agentKey: MICHAEL_AGENT_KEY,
      taskType: MICHAEL_TASK_TYPE,
      language: 'fr',
      responseType: 'safe_close',
      scenarioFamily: 'rejected',
    });
    expect(badLanguageSelection.ok).toBe(false);
    if (!badLanguageSelection.ok) {
      expect(badLanguageSelection.issues.map((i) => i.code)).toContain('unsupported_language');
    }
  });

  it('#17 (re-assert) adapter parity selections never mutate the selected catalog fixture', async () => {
    const result = await runContract({ scenario: 'failed_context' });
    const selection = expectSelectorParity(result);

    const before = JSON.stringify(selection.entry.response);
    // Re-run selection several times; the returned fixture must be unchanged.
    for (let i = 0; i < 3; i += 1) {
      expectSelectorParity(await runContract({ scenario: 'failed_context' }));
    }
    const after = JSON.stringify(selection.entry.response);
    expect(after).toBe(before);
  });
});
