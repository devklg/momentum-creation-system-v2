import { describe, expect, it } from 'vitest';
import { runSteveSuccessRuntimeAdapter } from '../adapters/steveSuccessAdapter.js';
import {
  createContextManagerFixture,
  requestIdentity,
  requestTurnId,
} from './contextRequestFixtures.js';

describe('S2.5 Steve Success inert runtime adapter', () => {
  it('maps any supplied identity to steve_success in the composed orchestration result', async () => {
    const fixture = createContextManagerFixture('complete');
    const identity = requestIdentity({ agentKey: 'michael_magnificent' });
    const turnId = requestTurnId();

    const result = await runSteveSuccessRuntimeAdapter({
      identity,
      turnId,
      taskType: 'success_interview',
      contextManager: fixture.port,
    });

    expect(result.agentKey).toBe('steve_success');
    expect(result.contextRequestResult.request.agentKey).toBe('steve_success');
    expect(result.contextRequestResult.consumption.expectedAgentKey).toBe('steve_success');
    expect(result.outcomeDrafts[0]?.agentKey).toBe('steve_success');
    expect(result.guidedActionDrafts[0]?.agentKey).toBe('steve_success');
    expect(fixture.calls[0]?.request.agentKey).toBe('steve_success');
  });

  it('rejects objectives not approved for Steve by the existing registry path', async () => {
    const fixture = createContextManagerFixture('complete');

    const result = await runSteveSuccessRuntimeAdapter({
      identity: requestIdentity(),
      turnId: requestTurnId(),
      taskType: 'training_support',
      contextManager: fixture.port,
    });

    expect(result.decision).toBe('reject');
    expect(result.contextRequestResult.issues.map((issue) => issue.code)).toContain(
      'invalid_objective',
    );
    expect(result.outcomeDrafts).toEqual([]);
    expect(result.guidedActionDrafts).toEqual([]);
    expect(fixture.calls).toHaveLength(0);
  });

  it('preserves behavior as not implemented', async () => {
    const fixture = createContextManagerFixture('complete');

    const result = await runSteveSuccessRuntimeAdapter({
      identity: requestIdentity(),
      turnId: requestTurnId(),
      taskType: 'success_interview',
      contextManager: fixture.port,
    });

    expect(result.behavior).toBe('not_implemented');
    expect(result.contextRequestResult.behavior).toBe('not_implemented');
    expect(result.outcomeGuidedActionResult.behavior).toBe('not_implemented');
  });

  it('preserves agentResponseGenerated as false and does not add response text', async () => {
    const fixture = createContextManagerFixture('complete');

    const result = await runSteveSuccessRuntimeAdapter({
      identity: requestIdentity(),
      turnId: requestTurnId(),
      taskType: 'success_interview',
      contextManager: fixture.port,
    });

    expect(result.agentResponseGenerated).toBe(false);
    expect(result.contextRequestResult.consumption.packet?.agent.agentKey).toBe('steve_success');
    expect(Object.hasOwn(result, 'agentResponse')).toBe(false);
    expect(Object.hasOwn(result, 'message')).toBe(false);
    expect(Object.hasOwn(result, 'responseText')).toBe(false);
  });

  it('returns the Context Packet request result from the composed path', async () => {
    const fixture = createContextManagerFixture('complete');

    const result = await runSteveSuccessRuntimeAdapter({
      identity: requestIdentity(),
      turnId: requestTurnId(),
      taskType: 'success_interview',
      contextManager: fixture.port,
    });

    expect(result.contextRequestResult).toMatchObject({
      decision: 'proceed',
      agentKey: 'steve_success',
      behavior: 'not_implemented',
      eventPersistence: 'disabled',
    });
    expect(result.contextRequestResult.request.taskType).toBe('success_interview');
    expect(result.consumption).toBe(result.contextRequestResult.consumption);
  });

  it('returns runtime event envelopes without enabling persistence', async () => {
    const fixture = createContextManagerFixture('complete');

    const result = await runSteveSuccessRuntimeAdapter({
      identity: requestIdentity(),
      turnId: requestTurnId(),
      taskType: 'success_interview',
      contextManager: fixture.port,
    });

    expect(result.events.map((event) => event.eventType)).toEqual([
      'agent.context.requested',
      'agent.context.received',
    ]);
    expect(result.events).toEqual(result.contextRequestResult.events);
    expect(result.eventPersistence).toBe('disabled');
    expect(result.outcomePersistence).toBe('disabled');
    expect(result.guidedActionPersistence).toBe('disabled');
    expect(result.envelopePersistence).toBe('disabled');
  });

  it('keeps outcome and Guided Action drafts returned only', async () => {
    const fixture = createContextManagerFixture('complete');

    const result = await runSteveSuccessRuntimeAdapter({
      identity: requestIdentity(),
      turnId: requestTurnId(),
      taskType: 'success_interview',
      contextManager: fixture.port,
    });

    expect(result.outcomeDrafts).toHaveLength(1);
    expect(result.guidedActionDrafts).toHaveLength(1);
    expect(result.outcomeDrafts[0]).toMatchObject({
      agentKey: 'steve_success',
      taskType: 'success_interview',
      persistence: 'disabled',
      agentResponseGenerated: false,
    });
    expect(result.guidedActionDrafts[0]).toMatchObject({
      agentKey: 'steve_success',
      taskType: 'success_interview',
      persistence: 'disabled',
      automaticSending: false,
      automaticCalling: false,
      agentResponseGenerated: false,
    });
  });

  it('does not score, rank, predict, qualify, or make income or placement claims', async () => {
    const fixture = createContextManagerFixture('complete');

    const result = await runSteveSuccessRuntimeAdapter({
      identity: requestIdentity(),
      turnId: requestTurnId(),
      taskType: 'success_interview',
      contextManager: fixture.port,
    });

    for (const forbiddenField of [
      'successScore',
      'score',
      'rank',
      'prediction',
      'qualification',
      'incomeClaim',
      'placementClaim',
      'placementPromise',
    ]) {
      expect(Object.hasOwn(result, forbiddenField)).toBe(false);
    }

    const returnedDraftText = JSON.stringify({
      outcomeDrafts: result.outcomeDrafts,
      guidedActionDrafts: result.guidedActionDrafts,
      notes: result.notes,
    });

    expect(returnedDraftText).not.toMatch(
      /\b(?:income projection|placement promise|readiness classification|qualification classification|rank|prediction)\b/i,
    );
  });
});
