import type { RuntimeTaskType } from '@momentum/shared/runtime';
import { describe, expect, it } from 'vitest';
import {
  createRuntimeTurnFixtureHarness,
  runRuntimeTurnFixtureScenario,
  type OrchestrationTurnCompositionResult,
  type RuntimeTurnCoordinatorRejection,
  type RuntimeTurnCoordinatorResult,
  type RuntimeTurnFixtureHarnessResult,
} from '../index.js';

function expectComposedResult(
  result: RuntimeTurnCoordinatorResult,
): asserts result is OrchestrationTurnCompositionResult {
  expect('contextRequestResult' in result).toBe(true);
}

function expectCoordinatorRejection(
  result: RuntimeTurnCoordinatorResult,
): asserts result is RuntimeTurnCoordinatorRejection {
  expect('contextRequestResult' in result).toBe(false);
}

function expectReturnedOnlyInert(result: RuntimeTurnFixtureHarnessResult): void {
  expect(result.behavior).toBe('not_implemented');
  expect(result.agentResponseGenerated).toBe(false);
  expect(result.eventPersistence).toBe('disabled');
  expect(result.outcomePersistence).toBe('disabled');
  expect(result.guidedActionPersistence).toBe('disabled');
  expect(result.envelopePersistence).toBe('disabled');
  expect(result.metadata.behavior).toBe('not_implemented');
  expect(result.metadata.agentResponseGenerated).toBe(false);
  expect(result.metadata.persistence).toBe('disabled');
  expect(result.result.behavior).toBe('not_implemented');
  expect(result.result.agentResponseGenerated).toBe(false);
  expect(result.result.eventPersistence).toBe('disabled');
  expect(result.result.outcomePersistence).toBe('disabled');
  expect(result.result.guidedActionPersistence).toBe('disabled');
  expect(result.result.envelopePersistence).toBe('disabled');
  expect(Object.hasOwn(result.result, 'agentResponse')).toBe(false);
  expect(Object.hasOwn(result.result, 'message')).toBe(false);
  expect(Object.hasOwn(result.result, 'responseText')).toBe(false);
}

async function acceptedComplete(agentKey: unknown, taskType: RuntimeTaskType) {
  return runRuntimeTurnFixtureScenario({
    scenario: 'accepted_complete',
    agentKey,
    taskType,
  });
}

describe('S2.8 runtime turn fixture harness', () => {
  it('accepted complete Steve turn scenario returns composed result', async () => {
    const result = await acceptedComplete('steve_success', 'success_interview');

    expectComposedResult(result.result);
    expect(result.scenario).toBe('accepted_complete');
    expect(result.result).toMatchObject({
      decision: 'proceed',
      agentKey: 'steve_success',
      behavior: 'not_implemented',
      agentResponseGenerated: false,
    });
    expect(result.contextCalls[0]?.request.agentKey).toBe('steve_success');
    expect(result.contextCalls[0]?.request.taskType).toBe('success_interview');
    expectReturnedOnlyInert(result);
  });

  it('accepted complete Michael turn scenario returns composed result', async () => {
    const harness = createRuntimeTurnFixtureHarness();
    const result = await harness.runScenario({
      scenario: 'accepted_complete',
      agentKey: 'michael_magnificent',
      taskType: 'training_support',
    });

    expectComposedResult(result.result);
    expect(result.result).toMatchObject({
      decision: 'proceed',
      agentKey: 'michael_magnificent',
    });
    expect(result.contextCalls[0]?.request.agentKey).toBe('michael_magnificent');
    expect(result.contextCalls[0]?.request.taskType).toBe('training_support');
    expectReturnedOnlyInert(result);
  });

  it('accepted complete Ivory turn scenario returns composed result', async () => {
    const result = await acceptedComplete('ivory', 'relationship_coaching');

    expectComposedResult(result.result);
    expect(result.result).toMatchObject({
      decision: 'proceed',
      agentKey: 'ivory',
    });
    expect(result.contextCalls[0]?.request.agentKey).toBe('ivory');
    expect(result.contextCalls[0]?.request.taskType).toBe('relationship_coaching');
    expectReturnedOnlyInert(result);
  });

  it('degraded context scenario returns limited outcome and action draft behavior', async () => {
    const result = await runRuntimeTurnFixtureScenario({
      scenario: 'accepted_degraded',
      agentKey: 'michael_magnificent',
      taskType: 'training_support',
    });

    expectComposedResult(result.result);
    expect(result.result.decision).toBe('degraded');
    expect(result.result.contextRequestResult.consumption.packetStatus).toBe('degraded');
    expect(result.result.outcomeDrafts).toHaveLength(1);
    expect(result.result.guidedActionDrafts).toHaveLength(1);
    expect(result.result.outcomeDrafts[0]).toMatchObject({
      contentScope: 'limited',
      persistence: 'disabled',
    });
    expect(result.result.guidedActionDrafts[0]).toMatchObject({
      contentScope: 'limited',
      persistence: 'disabled',
      automaticSending: false,
      automaticCalling: false,
    });
    expectReturnedOnlyInert(result);
  });

  it('failed context scenario returns no substantive outcome or action drafts', async () => {
    const result = await runRuntimeTurnFixtureScenario({
      scenario: 'failed_context',
      agentKey: 'michael_magnificent',
      taskType: 'training_support',
    });

    expectComposedResult(result.result);
    expect(result.result.decision).toBe('block_substantive');
    expect(result.result.contextRequestResult.consumption.packetStatus).toBe('failed');
    expect(result.result.events.map((event) => event.eventType)).toEqual([
      'agent.context.requested',
      'context.packet.failed',
    ]);
    expect(result.result.outcomeDrafts).toEqual([]);
    expect(result.result.guidedActionDrafts).toEqual([]);
    expectReturnedOnlyInert(result);
  });

  it('invalid objective scenario is rejected before Context Packet request', async () => {
    const result = await runRuntimeTurnFixtureScenario({
      scenario: 'invalid_objective',
      agentKey: 'steve_success',
      taskType: 'training_support',
    });

    expectComposedResult(result.result);
    expect(result.result.decision).toBe('reject');
    expect(result.result.contextRequestResult.issues.map((issue) => issue.code)).toContain(
      'invalid_objective',
    );
    expect(result.contextCalls).toHaveLength(0);
    expect(result.result.outcomeDrafts).toEqual([]);
    expect(result.result.guidedActionDrafts).toEqual([]);
    expectReturnedOnlyInert(result);
  });

  it('unknown agent scenario is rejected before dispatch and Context Packet request', async () => {
    const result = await runRuntimeTurnFixtureScenario({
      scenario: 'unknown_agent',
      agentKey: 'not_registered',
      taskType: 'training_support',
    });

    expectCoordinatorRejection(result.result);
    expect(result.result.decision).toBe('reject');
    expect(result.result.issues.map((issue) => issue.code)).toContain('invalid_agent');
    expect(result.contextCalls).toHaveLength(0);
    expect(result.result.outcomeDrafts).toEqual([]);
    expect(result.result.guidedActionDrafts).toEqual([]);
    expectReturnedOnlyInert(result);
  });

  it('candidate/review-only context scenario is rejected', async () => {
    const result = await runRuntimeTurnFixtureScenario({
      scenario: 'candidate_review_only_rejected',
      agentKey: 'michael_magnificent',
      taskType: 'training_support',
    });

    expectComposedResult(result.result);
    expect(result.result.decision).toBe('reject');
    expect(result.contextCalls).toHaveLength(1);
    expect(result.result.contextRequestResult.consumption.issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining([
        'candidate_included_forbidden',
        'candidate_exclusion_required',
      ]),
    );
    expect(result.result.outcomeDrafts).toEqual([]);
    expect(result.result.guidedActionDrafts).toEqual([]);
    expectReturnedOnlyInert(result);
  });

  it('missing identity scenario is rejected before dispatch', async () => {
    const result = await runRuntimeTurnFixtureScenario({
      scenario: 'missing_identity',
      taskType: 'training_support',
    });

    expectCoordinatorRejection(result.result);
    expect(result.result.issues.map((issue) => issue.code)).toContain('missing_identity');
    expect(result.contextCalls).toHaveLength(0);
    expectReturnedOnlyInert(result);
  });

  it('missing turn ID scenario is rejected before dispatch', async () => {
    const result = await runRuntimeTurnFixtureScenario({
      scenario: 'missing_turn_id',
      agentKey: 'michael_magnificent',
      taskType: 'training_support',
    });

    expectCoordinatorRejection(result.result);
    expect(result.result.issues.map((issue) => issue.code)).toContain('missing_turn_id');
    expect(result.contextCalls).toHaveLength(0);
    expectReturnedOnlyInert(result);
  });

  it('missing task type scenario is rejected before dispatch', async () => {
    const result = await runRuntimeTurnFixtureScenario({
      scenario: 'missing_task_type',
      agentKey: 'michael_magnificent',
    });

    expectCoordinatorRejection(result.result);
    expect(result.result.issues.map((issue) => issue.code)).toContain('missing_task_type');
    expect(result.contextCalls).toHaveLength(0);
    expectReturnedOnlyInert(result);
  });

  it('missing Context Manager boundary scenario is rejected before dispatch', async () => {
    const result = await runRuntimeTurnFixtureScenario({
      scenario: 'missing_context_manager',
      agentKey: 'michael_magnificent',
      taskType: 'training_support',
    });

    expectCoordinatorRejection(result.result);
    expect(result.result.issues.map((issue) => issue.code)).toContain(
      'missing_context_manager',
    );
    expect(result.contextCalls).toHaveLength(0);
    expect(result.metadata.contextManagerInjected).toBe(false);
    expectReturnedOnlyInert(result);
  });

  it('accepted scenarios return runtime event envelopes and Context Packet request results', async () => {
    const result = await acceptedComplete('michael_magnificent', 'training_support');

    expectComposedResult(result.result);
    expect(result.result.contextRequestResult).toMatchObject({
      decision: 'proceed',
      agentKey: 'michael_magnificent',
      eventPersistence: 'disabled',
    });
    expect(result.result.events).toEqual(result.result.contextRequestResult.events);
    expect(result.result.events.map((event) => event.eventType)).toEqual([
      'agent.context.requested',
      'agent.context.received',
    ]);
  });

  it('outcome and Guided Action drafts appear only when allowed', async () => {
    const accepted = await acceptedComplete('ivory', 'invitation_drafting');
    const degraded = await runRuntimeTurnFixtureScenario({
      scenario: 'accepted_degraded',
      agentKey: 'ivory',
      taskType: 'invitation_drafting',
    });
    const failed = await runRuntimeTurnFixtureScenario({
      scenario: 'failed_context',
      agentKey: 'ivory',
      taskType: 'invitation_drafting',
    });
    const invalid = await runRuntimeTurnFixtureScenario({
      scenario: 'invalid_objective',
      agentKey: 'ivory',
      taskType: 'training_support',
    });

    expectComposedResult(accepted.result);
    expectComposedResult(degraded.result);
    expectComposedResult(failed.result);
    expectComposedResult(invalid.result);
    expect(accepted.result.outcomeDrafts).toHaveLength(1);
    expect(accepted.result.guidedActionDrafts).toHaveLength(1);
    expect(degraded.result.outcomeDrafts).toHaveLength(1);
    expect(degraded.result.guidedActionDrafts).toHaveLength(1);
    expect(failed.result.outcomeDrafts).toEqual([]);
    expect(failed.result.guidedActionDrafts).toEqual([]);
    expect(invalid.result.outcomeDrafts).toEqual([]);
    expect(invalid.result.guidedActionDrafts).toEqual([]);
  });
});
