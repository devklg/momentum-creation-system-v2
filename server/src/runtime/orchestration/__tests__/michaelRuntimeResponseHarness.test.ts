import { describe, expect, it } from 'vitest';
import {
  createMichaelRuntimeResponseFixtureHarness,
  michaelRuntimeResponseScenarioEntries,
  runMichaelRuntimeResponseFixtureScenario,
  validateMichaelResponseContract,
  type MichaelResponseContractV1,
} from '../index.js';

const forbiddenFields = [
  'score',
  'rank',
  'classification',
  'readinessClassification',
  'qualification',
  'prediction',
  'incomeProjection',
  'commissionEstimate',
  'cycleMath',
  'placementPromise',
  'prospectFacingMessage',
  'prospectingList',
  'leadQualification',
  'medicalAdvice',
  'threeAuthorityDecision',
  'sendMessage',
  'callProspect',
  'scheduleCall',
  'autoSend',
  'autoCall',
  'automaticProspecting',
  'knowledgeApproval',
  'persistenceInstruction',
  'rawStoreResults',
  'rawGraphRagResults',
  'rawGatewayFallbackResponse',
] as const;

function collectForbiddenFields(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(collectForbiddenFields);
  if (typeof value !== 'object' || value === null) return [];

  return Object.entries(value).flatMap(([key, child]) => [
    ...(forbiddenFields.includes(key as (typeof forbiddenFields)[number]) ? [key] : []),
    ...collectForbiddenFields(child),
  ]);
}

function expectReturnedOnly(result: Awaited<ReturnType<typeof runMichaelRuntimeResponseFixtureScenario>>) {
  expect(result.behavior).toBe('not_implemented');
  expect(result.agentResponseGenerated).toBe(false);
  expect(result.eventPersistence).toBe('disabled');
  expect(result.outcomePersistence).toBe('disabled');
  expect(result.guidedActionPersistence).toBe('disabled');
  expect(result.envelopePersistence).toBe('disabled');
  expect(result.responsePersistence).toBe('disabled');
  expect(result.runtimeTurn.agentResponseGenerated).toBe(false);
  expect(result.runtimeTurn.result.agentResponseGenerated).toBe(false);
  expect(result.michaelResponse.agentResponseGenerated).toBe(false);
  expect(result.michaelResponse.persistence).toBe('disabled');
}

function expectValidated(contract: MichaelResponseContractV1): void {
  const validation = validateMichaelResponseContract(contract);
  expect(validation.ok).toBe(true);
}

describe('S2.13 Michael runtime response fixture harness', () => {
  it('complete Michael training-support turn returns validated next_training_step', async () => {
    const harness = createMichaelRuntimeResponseFixtureHarness();
    const result = await harness.runScenario({
      scenarioName: 'complete_training_support',
    });

    expect(result.runtimeTurn.result.decision).toBe('proceed');
    expect(result.michaelResponse).toMatchObject({
      agentKey: 'michael_magnificent',
      taskType: 'training_support',
      responseType: 'next_training_step',
      contextPacketStatus: 'complete',
      persistence: 'disabled',
      agentResponseGenerated: false,
    });
    expect(result.michaelResponse.nextStep).toMatchObject({
      baOwned: true,
      automaticSending: false,
      automaticCalling: false,
      externalSideEffect: false,
    });
    expectValidated(result.michaelResponse);
    expectReturnedOnly(result);
  });

  it('complete ambiguous Michael training-support turn returns validated clarification_question', async () => {
    const result = await runMichaelRuntimeResponseFixtureScenario({
      scenarioName: 'complete_ambiguous_training_support',
    });

    expect(result.runtimeTurn.result.decision).toBe('proceed');
    expect(result.michaelResponse.responseType).toBe('clarification_question');
    expect(result.michaelResponse.contextPacketStatus).toBe('complete');
    expect(result.michaelResponse.nextStep).toBeUndefined();
    expectValidated(result.michaelResponse);
    expectReturnedOnly(result);
  });

  it('degraded Context Packet returns validated safe_fallback', async () => {
    const result = await runMichaelRuntimeResponseFixtureScenario({
      scenarioName: 'degraded_context_packet',
    });

    expect(result.runtimeTurn.result.decision).toBe('degraded');
    expect(result.michaelResponse).toMatchObject({
      responseType: 'safe_fallback',
      contextPacketStatus: 'degraded',
      persistence: 'disabled',
      agentResponseGenerated: false,
    });
    expectValidated(result.michaelResponse);
    expectReturnedOnly(result);
  });

  it('failed Context Packet returns validated safe_close and no substantive drafts', async () => {
    const result = await runMichaelRuntimeResponseFixtureScenario({
      scenarioName: 'failed_context_packet',
    });

    expect(result.runtimeTurn.result.decision).toBe('block_substantive');
    expect(result.runtimeTurn.result.outcomeDrafts).toEqual([]);
    expect(result.runtimeTurn.result.guidedActionDrafts).toEqual([]);
    expect(result.michaelResponse.responseType).toBe('safe_close');
    expect(result.michaelResponse.contextPacketStatus).toBe('failed');
    expectValidated(result.michaelResponse);
    expectReturnedOnly(result);
  });

  it('missing Context Manager boundary returns a validated safe fallback', async () => {
    const result = await runMichaelRuntimeResponseFixtureScenario({
      scenarioName: 'missing_context_manager_boundary',
    });

    expect(result.runtimeTurn.result.decision).toBe('reject');
    expect(result.runtimeTurn.contextCalls).toEqual([]);
    expect(result.michaelResponse.responseType).toBe('safe_fallback');
    expect(result.michaelResponse.contextPacketStatus).toBe('missing');
    expectValidated(result.michaelResponse);
    expectReturnedOnly(result);
  });

  it('invalid objective, unknown agent, and candidate/review-only paths return validated safe_close', async () => {
    const scenarioNames = [
      'invalid_objective',
      'unknown_agent',
      'candidate_review_only_rejected',
      'rejected_context_packet',
    ] as const;

    for (const scenarioName of scenarioNames) {
      const result = await runMichaelRuntimeResponseFixtureScenario({ scenarioName });
      expect(result.runtimeTurn.result.decision).toBe('reject');
      expect(result.michaelResponse.responseType).toBe('safe_close');
      expect(result.michaelResponse.contextPacketStatus).toBe('rejected');
      expectValidated(result.michaelResponse);
      expectReturnedOnly(result);
    }
  });

  it('non-Michael, wrong task type, and unsupported language scenarios cannot receive substantive responses', async () => {
    const scenarioNames = [
      'non_michael_agent',
      'wrong_task_type',
      'unsupported_language',
    ] as const;

    for (const scenarioName of scenarioNames) {
      const result = await runMichaelRuntimeResponseFixtureScenario({ scenarioName });
      expect(result.michaelResponse.responseType).toBe('safe_close');
      expect(result.michaelResponse.nextStep).toBeUndefined();
      expect(result.scenario.metadata.expectedValidationStatus).toBe('safe_close');
      expectValidated(result.michaelResponse);
      expectReturnedOnly(result);
    }
  });

  it('every integrated scenario returns a validated S2.12 fixture with disabled persistence', async () => {
    for (const [, scenario] of michaelRuntimeResponseScenarioEntries) {
      const result = await runMichaelRuntimeResponseFixtureScenario({
        scenarioName: scenario.metadata.scenarioName,
      });

      expect(result.scenario.metadata).toMatchObject({
        fixtureOnly: true,
        persistence: 'disabled',
        agentResponseGenerated: false,
      });
      expect(result.validation.ok).toBe(true);
      expect(result.michaelResponse.responseType).toBe(
        scenario.metadata.expectedResponseType,
      );
      expect(result.michaelResponse.contextPacketStatus).toBe(
        scenario.metadata.expectedContextStatus,
      );
      expect(result.michaelResponse.agentKey).toBe('michael_magnificent');
      expect(result.michaelResponse.taskType).toBe('training_support');
      expectReturnedOnly(result);
    }
  });

  it('integrated fixtures do not include forbidden fields or automatic actions', async () => {
    for (const [, scenario] of michaelRuntimeResponseScenarioEntries) {
      const result = await runMichaelRuntimeResponseFixtureScenario({
        scenarioName: scenario.metadata.scenarioName,
      });

      expect(collectForbiddenFields(result.michaelResponse)).toEqual([]);
      expect(Object.hasOwn(result.michaelResponse, 'agentResponse')).toBe(false);
      expect(Object.hasOwn(result.michaelResponse, 'responseText')).toBe(false);
      expect(Object.hasOwn(result.michaelResponse, 'generatedText')).toBe(false);
      expect(Object.hasOwn(result.michaelResponse, 'sendMessage')).toBe(false);
      expect(Object.hasOwn(result.michaelResponse, 'callProspect')).toBe(false);
      expect(Object.hasOwn(result.michaelResponse, 'scheduleCall')).toBe(false);
      expect(Object.hasOwn(result.michaelResponse, 'automaticProspecting')).toBe(false);
      expect(result.runtimeTurn.result.outcomePersistence).toBe('disabled');
      expect(result.runtimeTurn.result.guidedActionPersistence).toBe('disabled');
    }
  });
});
