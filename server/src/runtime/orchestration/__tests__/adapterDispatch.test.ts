import type { AgentKey, RuntimeTaskType } from '@momentum/shared/runtime';
import { describe, expect, it } from 'vitest';
import {
  dispatchAgentRuntimeAdapter,
  type AgentRuntimeAdapterDispatchRejection,
  type AgentRuntimeAdapterDispatchIdentity,
  type AgentRuntimeAdapterDispatchResult,
  type OrchestrationTurnCompositionResult,
} from '../index.js';
import {
  createContextManagerFixture,
  requestIdentity,
  requestTurnId,
} from './contextRequestFixtures.js';

function expectComposedResult(
  result: AgentRuntimeAdapterDispatchResult,
): asserts result is OrchestrationTurnCompositionResult {
  expect('contextRequestResult' in result).toBe(true);
}

function expectDispatchRejection(
  result: AgentRuntimeAdapterDispatchResult,
): asserts result is AgentRuntimeAdapterDispatchRejection {
  expect('contextRequestResult' in result).toBe(false);
}

async function dispatchFixtureTurn(
  agentKey: AgentRuntimeAdapterDispatchIdentity['agentKey'],
  taskType: RuntimeTaskType,
) {
  const fixture = createContextManagerFixture('complete');
  const result = await dispatchAgentRuntimeAdapter({
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

describe('S2.6 inert adapter dispatch boundary', () => {
  it('selects Steve adapter for steve_success', async () => {
    const { fixture, result } = await dispatchFixtureTurn(
      'steve_success',
      'success_interview',
    );

    expectComposedResult(result);
    expect(result.agentKey).toBe('steve_success');
    expect(result.contextRequestResult.request.agentKey).toBe('steve_success');
    expect(result.consumption.expectedAgentKey).toBe('steve_success');
    expect(fixture.calls[0]?.request.agentKey).toBe('steve_success');
  });

  it('selects Michael adapter for michael_magnificent', async () => {
    const { fixture, result } = await dispatchFixtureTurn(
      'michael_magnificent',
      'training_support',
    );

    expectComposedResult(result);
    expect(result.agentKey).toBe('michael_magnificent');
    expect(result.contextRequestResult.request.agentKey).toBe('michael_magnificent');
    expect(result.consumption.expectedAgentKey).toBe('michael_magnificent');
    expect(fixture.calls[0]?.request.agentKey).toBe('michael_magnificent');
  });

  it('selects Ivory adapter for ivory', async () => {
    const { fixture, result } = await dispatchFixtureTurn(
      'ivory',
      'relationship_coaching',
    );

    expectComposedResult(result);
    expect(result.agentKey).toBe('ivory');
    expect(result.contextRequestResult.request.agentKey).toBe('ivory');
    expect(result.consumption.expectedAgentKey).toBe('ivory');
    expect(fixture.calls[0]?.request.agentKey).toBe('ivory');
  });

  it('rejects unknown agent keys before Context Packet request', async () => {
    const { fixture, result } = await dispatchFixtureTurn(
      'unknown_agent',
      'training_support',
    );

    expectDispatchRejection(result);
    expect(result).toMatchObject({
      decision: 'reject',
      agentKey: 'unknown_agent',
      behavior: 'not_implemented',
      events: [],
      outcomeDrafts: [],
      guidedActionDrafts: [],
      eventPersistence: 'disabled',
      outcomePersistence: 'disabled',
      guidedActionPersistence: 'disabled',
      envelopePersistence: 'disabled',
      agentResponseGenerated: false,
    });
    expect(result.issues.map((issue) => issue.code)).toContain('invalid_agent');
    expect(fixture.calls).toHaveLength(0);
  });

  it('preserves invalid objective rejection through the selected adapter path', async () => {
    const { fixture, result } = await dispatchFixtureTurn(
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

  it('returns the composed orchestration turn result, Context Packet request result, and runtime events', async () => {
    const { result } = await dispatchFixtureTurn(
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

  it('returns Outcome and Guided Action draft envelopes only when the selected adapter allows the turn', async () => {
    const accepted = await dispatchFixtureTurn('ivory', 'invitation_drafting');
    const invalid = await dispatchFixtureTurn('ivory', 'training_support');
    const unknown = await dispatchFixtureTurn('not_registered', 'training_support');

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
    expect(unknown.result.outcomeDrafts).toEqual([]);
    expect(unknown.result.guidedActionDrafts).toEqual([]);
  });

  it('preserves inert behavior, no response generation, and disabled persistence for approved dispatches', async () => {
    for (const [agentKey, taskType] of [
      ['steve_success', 'success_interview'],
      ['michael_magnificent', 'training_support'],
      ['ivory', 'relationship_coaching'],
    ] satisfies Array<[AgentKey, RuntimeTaskType]>) {
      const { result } = await dispatchFixtureTurn(agentKey, taskType);

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
