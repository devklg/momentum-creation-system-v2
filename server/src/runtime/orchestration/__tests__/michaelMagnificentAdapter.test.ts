import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  isMichaelMagnificentObjectiveAllowed,
  mapMichaelMagnificentIdentity,
  runMichaelMagnificentRuntimeAdapter,
} from '../adapters/michaelMagnificentAdapter.js';
import {
  createContextManagerFixture,
  requestIdentity,
  requestTurnId,
} from './contextRequestFixtures.js';

const ADAPTER_SOURCE = fileURLToPath(
  new URL('../adapters/michaelMagnificentAdapter.ts', import.meta.url),
);

describe('S2.5 inert Michael Magnificent runtime adapter', () => {
  it('maps any supplied identity to michael_magnificent in the composed result', async () => {
    const suppliedIdentity = requestIdentity({ agentKey: 'steve_success' });
    const fixture = createContextManagerFixture('complete');
    const turnId = requestTurnId();

    const result = await runMichaelMagnificentRuntimeAdapter({
      identity: suppliedIdentity,
      turnId,
      taskType: 'training_support',
      contextManager: fixture.port,
    });

    expect(suppliedIdentity.agentKey).toBe('steve_success');
    expect(mapMichaelMagnificentIdentity(suppliedIdentity).agentKey).toBe(
      'michael_magnificent',
    );
    expect(result.agentKey).toBe('michael_magnificent');
    expect(result.contextRequestResult.request.agentKey).toBe('michael_magnificent');
    expect(result.consumption.expectedAgentKey).toBe('michael_magnificent');
    expect(fixture.calls[0]?.request.agentKey).toBe('michael_magnificent');
  });

  it('rejects task types outside the Michael registry objectives', async () => {
    const fixture = createContextManagerFixture('complete');

    const result = await runMichaelMagnificentRuntimeAdapter({
      identity: requestIdentity({ agentKey: 'ivory' }),
      turnId: requestTurnId(),
      taskType: 'success_interview',
      contextManager: fixture.port,
    });

    expect(isMichaelMagnificentObjectiveAllowed('success_interview')).toBe(false);
    expect(result).toMatchObject({
      agentKey: 'michael_magnificent',
      decision: 'reject',
      behavior: 'not_implemented',
      agentResponseGenerated: false,
    });
    expect(result.contextRequestResult.issues.map((issue) => issue.code)).toContain(
      'invalid_objective',
    );
    expect(fixture.calls).toHaveLength(0);
  });

  it('allows only Michael-approved objective task types from the registry', () => {
    expect(isMichaelMagnificentObjectiveAllowed('training_support')).toBe(true);
    expect(isMichaelMagnificentObjectiveAllowed('journal_teaching')).toBe(true);
    expect(isMichaelMagnificentObjectiveAllowed('session_resume')).toBe(true);
    expect(isMichaelMagnificentObjectiveAllowed('guided_action_review')).toBe(true);
    expect(isMichaelMagnificentObjectiveAllowed('invitation_drafting')).toBe(false);
    expect(isMichaelMagnificentObjectiveAllowed('relationship_coaching')).toBe(false);
  });

  it('preserves inert behavior and disabled persistence markers', async () => {
    const fixture = createContextManagerFixture('complete');

    const result = await runMichaelMagnificentRuntimeAdapter({
      identity: requestIdentity(),
      turnId: requestTurnId(),
      taskType: 'training_support',
      contextManager: fixture.port,
    });

    expect(result.behavior).toBe('not_implemented');
    expect(result.contextRequestResult.behavior).toBe('not_implemented');
    expect(result.outcomeGuidedActionResult.behavior).toBe('not_implemented');
    expect(result.agentResponseGenerated).toBe(false);
    expect(result.eventPersistence).toBe('disabled');
    expect(result.outcomePersistence).toBe('disabled');
    expect(result.guidedActionPersistence).toBe('disabled');
    expect(result.envelopePersistence).toBe('disabled');
    expect(result.outcomeDrafts.every((draft) => draft.persistence === 'disabled')).toBe(
      true,
    );
    expect(
      result.guidedActionDrafts.every((draft) => draft.persistence === 'disabled'),
    ).toBe(true);
  });

  it('returns Context Packet request results and runtime event envelopes', async () => {
    const fixture = createContextManagerFixture('complete');

    const result = await runMichaelMagnificentRuntimeAdapter({
      identity: requestIdentity(),
      turnId: requestTurnId(),
      taskType: 'training_support',
      contextManager: fixture.port,
    });

    expect(result.contextRequestResult).toMatchObject({
      decision: 'proceed',
      agentKey: 'michael_magnificent',
      eventPersistence: 'disabled',
    });
    expect(result.events.map((event) => event.eventType)).toEqual([
      'agent.context.requested',
      'agent.context.received',
    ]);
    expect(result.events).toEqual(result.contextRequestResult.events);
    expect(fixture.calls).toHaveLength(1);
  });

  it('does not generate training advice or any agent response text', async () => {
    const fixture = createContextManagerFixture('complete');

    const result = await runMichaelMagnificentRuntimeAdapter({
      identity: requestIdentity(),
      turnId: requestTurnId(),
      taskType: 'training_support',
      contextManager: fixture.port,
    });

    expect(result.agentResponseGenerated).toBe(false);
    expect(Object.hasOwn(result, 'agentResponse')).toBe(false);
    expect(Object.hasOwn(result, 'trainingAdvice')).toBe(false);
    expect(Object.hasOwn(result, 'teachingResponse')).toBe(false);
    expect(Object.hasOwn(result, 'message')).toBe(false);
    expect(Object.hasOwn(result, 'responseText')).toBe(false);
  });

  it('does not introduce prospect-facing, Telnyx, PSTN, or call-control behavior', () => {
    const source = readFileSync(ADAPTER_SOURCE, 'utf8');

    expect(source).not.toMatch(/apps\/com|prospect-facing|prospectFacing/i);
    expect(source).not.toMatch(/telnyx|pstn|call-control|callControl/i);
    expect(source).not.toMatch(/sendInvitation|automaticSending|placed_call/i);
  });
});
