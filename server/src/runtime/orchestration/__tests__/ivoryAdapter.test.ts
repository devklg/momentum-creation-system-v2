import { describe, expect, it } from 'vitest';
import type { RuntimeTaskType } from '@momentum/shared/runtime';
import {
  isIvoryRuntimeTaskAllowed,
  runIvoryRuntimeAdapter,
} from '../adapters/ivoryAdapter.js';
import {
  createContextManagerFixture,
  requestIdentity,
  requestTurnId,
} from './contextRequestFixtures.js';

async function runIvoryTurn(taskType: RuntimeTaskType = 'relationship_coaching') {
  const fixture = createContextManagerFixture('complete');
  const result = await runIvoryRuntimeAdapter({
    identity: requestIdentity({ agentKey: 'michael_magnificent' }),
    turnId: requestTurnId(),
    taskType,
    contextManager: fixture.port,
  });

  return { fixture, result };
}

describe('S2.5 Ivory inert runtime adapter', () => {
  it('maps supplied identity to ivory in the composed orchestration result', async () => {
    const { fixture, result } = await runIvoryTurn('relationship_coaching');

    expect(fixture.calls).toHaveLength(1);
    expect(fixture.calls[0]?.request.agentKey).toBe('ivory');
    expect(result.agentKey).toBe('ivory');
    expect(result.contextRequestResult.agentKey).toBe('ivory');
    expect(result.consumption.expectedAgentKey).toBe('ivory');
    expect(result.outcomeDrafts[0]?.agentKey).toBe('ivory');
    expect(result.guidedActionDrafts[0]?.agentKey).toBe('ivory');
  });

  it('accepts only Ivory-approved task types through the registry', async () => {
    expect(isIvoryRuntimeTaskAllowed('relationship_coaching')).toBe(true);
    expect(isIvoryRuntimeTaskAllowed('invitation_drafting')).toBe(true);
    expect(isIvoryRuntimeTaskAllowed('session_resume')).toBe(true);
    expect(isIvoryRuntimeTaskAllowed('guided_action_review')).toBe(true);
    expect(isIvoryRuntimeTaskAllowed('training_support')).toBe(false);

    const { fixture, result } = await runIvoryTurn('training_support');

    expect(fixture.calls).toHaveLength(0);
    expect(result).toMatchObject({
      decision: 'reject',
      agentKey: 'ivory',
      behavior: 'not_implemented',
      agentResponseGenerated: false,
      eventPersistence: 'disabled',
      outcomePersistence: 'disabled',
      guidedActionPersistence: 'disabled',
    });
    expect(result.contextRequestResult.issues.map((issue) => issue.code)).toContain(
      'invalid_objective',
    );
    expect(result.outcomeDrafts).toEqual([]);
    expect(result.guidedActionDrafts).toEqual([]);
  });

  it('returns the composed Context Packet request result and runtime events', async () => {
    const { result } = await runIvoryTurn('invitation_drafting');

    expect(result.decision).toBe('proceed');
    expect(result.contextRequestResult.request).toMatchObject({
      agentKey: 'ivory',
      taskType: 'invitation_drafting',
      language: 'en',
    });
    expect(result.events.map((event) => event.eventType)).toEqual([
      'agent.context.requested',
      'agent.context.received',
    ]);
    expect(result.events).toEqual(result.contextRequestResult.events);
  });

  it('preserves inert behavior, no response generation, and disabled persistence', async () => {
    const { result } = await runIvoryTurn('relationship_coaching');

    expect(result.behavior).toBe('not_implemented');
    expect(result.contextRequestResult.behavior).toBe('not_implemented');
    expect(result.outcomeGuidedActionResult.behavior).toBe('not_implemented');
    expect(result.agentResponseGenerated).toBe(false);
    expect(result.outcomeGuidedActionResult.agentResponseGenerated).toBe(false);
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

  it('does not generate outreach text or direct action execution fields', async () => {
    const { result } = await runIvoryTurn('invitation_drafting');

    expect(Object.hasOwn(result, 'agentResponse')).toBe(false);
    expect(Object.hasOwn(result, 'message')).toBe(false);
    expect(Object.hasOwn(result, 'responseText')).toBe(false);
    expect(Object.hasOwn(result, 'outreachText')).toBe(false);
    expect(Object.hasOwn(result, 'invitationText')).toBe(false);
    expect(Object.hasOwn(result, 'draftText')).toBe(false);
    expect(result.guidedActionDrafts).toHaveLength(1);
    expect(result.guidedActionDrafts[0]).toMatchObject({
      actionOwner: 'brand_ambassador',
      requiresBaApproval: true,
      automaticSending: false,
      automaticCalling: false,
      agentResponseGenerated: false,
    });
  });

  it('does not auto-send, auto-call, automate prospecting, or score prospects', async () => {
    const { result } = await runIvoryTurn('relationship_coaching');
    const serialized = JSON.stringify(result).toLowerCase();

    expect(result.guidedActionDrafts[0]?.automaticSending).toBe(false);
    expect(result.guidedActionDrafts[0]?.automaticCalling).toBe(false);
    expect(Object.hasOwn(result, 'automaticProspecting')).toBe(false);
    expect(Object.hasOwn(result, 'prospectScore')).toBe(false);
    expect(Object.hasOwn(result, 'leadScore')).toBe(false);
    expect(serialized).not.toContain('auto_sent_message');
    expect(serialized).not.toContain('placed_call');
    expect(serialized).not.toContain('prospect_score');
    expect(serialized).not.toContain('automated_prospecting_list');
  });
});
