import type { RuntimeTaskType } from '@momentum/shared/runtime';
import { describe, expect, it } from 'vitest';
import { runMichaelRuntimeAdapterContract } from '../michaelRuntimeAdapterContract.js';
import {
  validateMichaelResponseContract,
} from '../michaelResponseContract.js';
import { runRuntimeTurnFixtureScenario } from '../fixtures/runtimeTurnHarness.js';
import type {
  MichaelResponseContractV1,
  MichaelResponseType,
  MichaelRuntimeAdapterContractResult,
  RuntimeTurnFixtureHarnessResult,
  RuntimeTurnFixtureScenarioType,
} from '../types.js';

const allowedCompleteResponseTypes = [
  'next_training_step',
  'clarification_question',
] as const satisfies readonly MichaelResponseType[];

const allowedLimitedResponseTypes = [
  'safe_fallback',
  'safe_close',
] as const satisfies readonly MichaelResponseType[];

const wrongTaskTypes = [
  'success_interview',
  'relationship_coaching',
  'invitation_drafting',
  'journal_teaching',
  'session_resume',
  'guided_action_review',
] as const satisfies readonly RuntimeTaskType[];

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

function expectValidated(response: MichaelResponseContractV1): void {
  const validation = validateMichaelResponseContract(response);
  expect(validation.ok).toBe(true);
}

function expectReturnedOnly(result: MichaelRuntimeAdapterContractResult): void {
  expect(result.behavior).toBe('not_implemented');
  expect(result.agentResponseGenerated).toBe(false);
  expect(result.eventPersistence).toBe('disabled');
  expect(result.outcomePersistence).toBe('disabled');
  expect(result.guidedActionPersistence).toBe('disabled');
  expect(result.envelopePersistence).toBe('disabled');
  expect(result.responsePersistence).toBe('disabled');
  expect(result.michaelResponse.persistence).toBe('disabled');
  expect(result.michaelResponse.agentResponseGenerated).toBe(false);
}

function expectSafeClose(result: MichaelRuntimeAdapterContractResult): void {
  expect(result.michaelResponse.responseType).toBe('safe_close');
  expect(result.michaelResponse.contextPacketStatus).toBe('rejected');
  expect(result.michaelResponse.nextStep).toBeUndefined();
  expectValidated(result.michaelResponse);
  expectReturnedOnly(result);
}

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

describe('S2.15 Michael runtime adapter contract', () => {
  it('accepts only michael_magnificent training_support for complete Context Packets', async () => {
    const result = await runContract();

    expect(result.michaelResponse.agentKey).toBe('michael_magnificent');
    expect(result.michaelResponse.taskType).toBe('training_support');
    expect(result.michaelResponse.contextPacketStatus).toBe('complete');
    expect(allowedCompleteResponseTypes).toContain(result.michaelResponse.responseType);
    expectValidated(result.michaelResponse);
    expectReturnedOnly(result);
  });

  it('maps complete training support only to next_training_step or clarification_question', async () => {
    const clear = await runContract({ intent: 'clear_training_support' });
    const ambiguous = await runContract({ intent: 'ambiguous_training_support' });

    expect(clear.michaelResponse.responseType).toBe('next_training_step');
    expect(ambiguous.michaelResponse.responseType).toBe('clarification_question');

    for (const result of [clear, ambiguous]) {
      expect(result.michaelResponse.contextPacketStatus).toBe('complete');
      expect(allowedCompleteResponseTypes).toContain(result.michaelResponse.responseType);
      expectValidated(result.michaelResponse);
      expectReturnedOnly(result);
    }
  });

  it('rejects Steve, Ivory, and unknown agents with safe_close only', async () => {
    for (const agentKey of ['steve_success', 'ivory', 'unknown_agent'] as const) {
      const scenario = agentKey === 'unknown_agent' ? 'unknown_agent' : 'accepted_complete';
      const result = await runContract({ agentKey, scenario });

      expectSafeClose(result);
      expect(result.issues.map((issue) => issue.code)).toContain('wrong_agent');
    }
  });

  it('rejects every non-training_support task with safe_close only', async () => {
    for (const taskType of wrongTaskTypes) {
      const result = await runContract({ taskType });

      expectSafeClose(result);
      expect(result.issues.map((issue) => issue.code)).toContain('wrong_task');
    }
  });

  it('rejects unsupported language with safe_close only', async () => {
    const result = await runContract({ language: 'fr' });

    expectSafeClose(result);
    expect(result.issues.map((issue) => issue.code)).toContain('unsupported_language');
  });

  it('rejects non-Context-Manager assembled packets with safe_close only', async () => {
    const result = await runContract({
      mutateRuntimeTurn: withNonContextManagerAssembly,
    });

    expectSafeClose(result);
    expect(result.issues.map((issue) => issue.code)).toContain('non_context_manager');
  });

  it('rejects candidate/review-only packets with safe_close only', async () => {
    const result = await runContract({
      scenario: 'candidate_review_only_rejected',
    });

    expectSafeClose(result);
    expect(result.issues.map((issue) => issue.code)).toContain('candidate_review_only');
  });

  it('returns only safe_fallback or safe_close for degraded, missing, and failed Context Packets', async () => {
    const cases = [
      ['accepted_degraded', 'degraded'],
      ['missing_context_manager', 'missing'],
      ['failed_context', 'failed'],
    ] as const satisfies readonly [RuntimeTurnFixtureScenarioType, string][];

    for (const [scenario, expectedPacketStatus] of cases) {
      const result = await runContract({ scenario });

      expect(allowedLimitedResponseTypes).toContain(result.michaelResponse.responseType);
      expect(result.michaelResponse.contextPacketStatus).toBe(expectedPacketStatus);
      expect(result.michaelResponse.nextStep).toBeUndefined();
      expectValidated(result.michaelResponse);
      expectReturnedOnly(result);
    }
  });

  it('returns only safe_close for rejected Context Packets', async () => {
    const result = await runContract({ scenario: 'candidate_review_only_rejected' });

    expectSafeClose(result);
  });

  it('allows nextStep only for next_training_step and keeps the step BA-owned with no external side effects', async () => {
    const nextStepResult = await runContract({ intent: 'clear_training_support' });

    expect(nextStepResult.michaelResponse.responseType).toBe('next_training_step');
    expect(nextStepResult.michaelResponse.nextStep).toMatchObject({
      baOwned: true,
      automaticSending: false,
      automaticCalling: false,
      externalSideEffect: false,
    });

    const nonNextStepResults = [
      await runContract({ intent: 'ambiguous_training_support' }),
      await runContract({ scenario: 'accepted_degraded' }),
      await runContract({ scenario: 'missing_context_manager' }),
      await runContract({ scenario: 'failed_context' }),
      await runContract({ scenario: 'candidate_review_only_rejected' }),
      await runContract({ language: 'fr' }),
    ];

    for (const result of nonNextStepResults) {
      expect(result.michaelResponse.responseType).not.toBe('next_training_step');
      expect(result.michaelResponse.nextStep).toBeUndefined();
      expectValidated(result.michaelResponse);
      expectReturnedOnly(result);
    }
  });
});
