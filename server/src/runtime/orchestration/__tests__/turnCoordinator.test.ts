import type { McsAgentKey, McsRuntimeTaskType } from '@momentum/shared/runtime';
import { describe, expect, it } from 'vitest';
import {
  coordinateRuntimeTurn,
  type OrchestrationTurnCompositionResult,
  type RuntimeTurnCoordinatorInput,
  type RuntimeTurnCoordinatorRejection,
  type RuntimeTurnCoordinatorResult,
} from '../index.js';
import {
  createContextManagerFixture,
  requestIdentity,
  requestTurnId,
} from './contextRequestFixtures.js';

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

async function coordinateFixtureTurn(
  agentKey: RuntimeTurnCoordinatorInput['identity'] extends infer Identity
    ? Identity extends { agentKey?: infer Key }
      ? Key
      : unknown
    : unknown,
  taskType: McsRuntimeTaskType,
) {
  const fixture = createContextManagerFixture('complete');
  const result = await coordinateRuntimeTurn({
    identity: {
      ...requestIdentity(),
      agentKey,
    },
    turnId: requestTurnId(),
    taskType,
    contextManager: fixture.port,
  });

  return { fixture, result };
}

describe('S2.7 inert runtime turn coordinator', () => {
  it('accepts valid Steve turn input and dispatches to Steve', async () => {
    const { fixture, result } = await coordinateFixtureTurn(
      'steve_success',
      'success_interview',
    );

    expectComposedResult(result);
    expect(result.agentKey).toBe('steve_success');
    expect(result.contextRequestResult.request.agentKey).toBe('steve_success');
    expect(result.consumption.expectedAgentKey).toBe('steve_success');
    expect(fixture.calls[0]?.request.agentKey).toBe('steve_success');
  });

  it('accepts valid Michael turn input and dispatches to Michael', async () => {
    const { fixture, result } = await coordinateFixtureTurn(
      'michael_magnificent',
      'training_support',
    );

    expectComposedResult(result);
    expect(result.agentKey).toBe('michael_magnificent');
    expect(result.contextRequestResult.request.agentKey).toBe('michael_magnificent');
    expect(result.consumption.expectedAgentKey).toBe('michael_magnificent');
    expect(fixture.calls[0]?.request.agentKey).toBe('michael_magnificent');
  });

  it('accepts valid Ivory turn input and dispatches to Ivory', async () => {
    const { fixture, result } = await coordinateFixtureTurn(
      'ivory',
      'relationship_coaching',
    );

    expectComposedResult(result);
    expect(result.agentKey).toBe('ivory');
    expect(result.contextRequestResult.request.agentKey).toBe('ivory');
    expect(result.consumption.expectedAgentKey).toBe('ivory');
    expect(fixture.calls[0]?.request.agentKey).toBe('ivory');
  });

  it('rejects missing identity before dispatch', async () => {
    const fixture = createContextManagerFixture('complete');
    const result = await coordinateRuntimeTurn({
      turnId: requestTurnId(),
      taskType: 'training_support',
      contextManager: fixture.port,
    });

    expectCoordinatorRejection(result);
    expect(result.issues.map((issue) => issue.code)).toContain('missing_identity');
    expect(result.agentKey).toBeUndefined();
    expect(result.events).toEqual([]);
    expect(fixture.calls).toHaveLength(0);
  });

  it('rejects missing turn ID before dispatch', async () => {
    const fixture = createContextManagerFixture('complete');
    const result = await coordinateRuntimeTurn({
      identity: requestIdentity(),
      taskType: 'training_support',
      contextManager: fixture.port,
    });

    expectCoordinatorRejection(result);
    expect(result.issues.map((issue) => issue.code)).toContain('missing_turn_id');
    expect(result.turnId).toBeUndefined();
    expect(fixture.calls).toHaveLength(0);
  });

  it('rejects missing task type before dispatch', async () => {
    const fixture = createContextManagerFixture('complete');
    const result = await coordinateRuntimeTurn({
      identity: requestIdentity(),
      turnId: requestTurnId(),
      contextManager: fixture.port,
    });

    expectCoordinatorRejection(result);
    expect(result.issues.map((issue) => issue.code)).toContain('missing_task_type');
    expect(fixture.calls).toHaveLength(0);
  });

  it('rejects missing Context Manager boundary before dispatch', async () => {
    const result = await coordinateRuntimeTurn({
      identity: requestIdentity(),
      turnId: requestTurnId(),
      taskType: 'training_support',
    });

    expectCoordinatorRejection(result);
    expect(result.issues.map((issue) => issue.code)).toContain(
      'missing_context_manager',
    );
    expect(result.events).toEqual([]);
  });

  it('rejects unknown agent key before dispatch', async () => {
    const fixture = createContextManagerFixture('complete');
    const result = await coordinateRuntimeTurn({
      identity: {
        ...requestIdentity(),
        agentKey: 'not_registered',
      },
      turnId: requestTurnId(),
      taskType: 'training_support',
      contextManager: fixture.port,
    });

    expectCoordinatorRejection(result);
    expect(result).toMatchObject({
      decision: 'reject',
      agentKey: 'not_registered',
      behavior: 'not_implemented',
      eventPersistence: 'disabled',
      outcomePersistence: 'disabled',
      guidedActionPersistence: 'disabled',
      envelopePersistence: 'disabled',
      agentResponseGenerated: false,
    });
    expect(result.issues.map((issue) => issue.code)).toContain('invalid_agent');
    expect(fixture.calls).toHaveLength(0);
  });

  it('preserves invalid objective rejection through dispatch and adapter paths', async () => {
    const { fixture, result } = await coordinateFixtureTurn(
      'steve_success',
      'training_support',
    );

    expectComposedResult(result);
    expect(result).toMatchObject({
      decision: 'reject',
      agentKey: 'steve_success',
      behavior: 'not_implemented',
      agentResponseGenerated: false,
    });
    expect(result.contextRequestResult.issues.map((issue) => issue.code)).toContain(
      'invalid_objective',
    );
    expect(result.outcomeDrafts).toEqual([]);
    expect(result.guidedActionDrafts).toEqual([]);
    expect(fixture.calls).toHaveLength(0);
  });

  it('returns the composed orchestration turn result, Context Packet result, and runtime event envelopes', async () => {
    const { result } = await coordinateFixtureTurn(
      'michael_magnificent',
      'training_support',
    );

    expectComposedResult(result);
    expect(result.contextRequestResult).toMatchObject({
      decision: 'proceed',
      agentKey: 'michael_magnificent',
      eventPersistence: 'disabled',
    });
    expect(result.consumption).toBe(result.contextRequestResult.consumption);
    expect(result.events).toEqual(result.contextRequestResult.events);
    expect(result.events.map((event) => event.eventType)).toEqual([
      'agent.context.requested',
      'agent.context.received',
    ]);
  });

  it('returns Outcome and Guided Action draft envelopes only when allowed', async () => {
    const accepted = await coordinateFixtureTurn('ivory', 'invitation_drafting');
    const invalid = await coordinateFixtureTurn('ivory', 'training_support');
    const unknown = await coordinateFixtureTurn('not_registered', 'training_support');

    expectComposedResult(accepted.result);
    expect(accepted.result.outcomeDrafts).toHaveLength(1);
    expect(accepted.result.guidedActionDrafts).toHaveLength(1);
    expect(accepted.result.outcomeDrafts[0]).toMatchObject({
      agentKey: 'ivory',
      taskType: 'invitation_drafting',
      persistence: 'disabled',
    });
    expect(accepted.result.guidedActionDrafts[0]).toMatchObject({
      agentKey: 'ivory',
      taskType: 'invitation_drafting',
      persistence: 'disabled',
      automaticSending: false,
      automaticCalling: false,
    });

    expectComposedResult(invalid.result);
    expect(invalid.result.outcomeDrafts).toEqual([]);
    expect(invalid.result.guidedActionDrafts).toEqual([]);
    expectCoordinatorRejection(unknown.result);
    expect(unknown.result.outcomeDrafts).toEqual([]);
    expect(unknown.result.guidedActionDrafts).toEqual([]);
  });

  it('preserves inert behavior, no response generation, and disabled persistence for approved turns', async () => {
    for (const [agentKey, taskType] of [
      ['steve_success', 'success_interview'],
      ['michael_magnificent', 'training_support'],
      ['ivory', 'relationship_coaching'],
    ] satisfies Array<[McsAgentKey, McsRuntimeTaskType]>) {
      const { result } = await coordinateFixtureTurn(agentKey, taskType);

      expectComposedResult(result);
      expect(result.behavior).toBe('not_implemented');
      expect(result.contextRequestResult.behavior).toBe('not_implemented');
      expect(result.outcomeGuidedActionResult.behavior).toBe('not_implemented');
      expect(result.agentResponseGenerated).toBe(false);
      expect(Object.hasOwn(result, 'agentResponse')).toBe(false);
      expect(Object.hasOwn(result, 'message')).toBe(false);
      expect(Object.hasOwn(result, 'responseText')).toBe(false);
      expect(result.eventPersistence).toBe('disabled');
      expect(result.outcomePersistence).toBe('disabled');
      expect(result.guidedActionPersistence).toBe('disabled');
      expect(result.envelopePersistence).toBe('disabled');
    }
  });
});
