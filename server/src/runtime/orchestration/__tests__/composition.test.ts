import { describe, expect, it } from 'vitest';
import { composeOrchestrationTurn } from '../index.js';
import {
  createContextManagerFixture,
  requestIdentity,
  requestTurnId,
} from './contextRequestFixtures.js';

type FixtureMode = Parameters<typeof createContextManagerFixture>[0];

async function composeWithFixture(mode: FixtureMode = 'complete') {
  const identity = requestIdentity();
  const turnId = requestTurnId();
  const fixture = createContextManagerFixture(mode);
  const result = await composeOrchestrationTurn({
    identity,
    turnId,
    taskType: 'training_support',
    contextManager: fixture.port,
  });

  return { fixture, identity, result, turnId };
}

describe('S2.4 inert orchestration composition', () => {
  it('returns a combined turn result for a complete Context Packet request', async () => {
    const { fixture, identity, result } = await composeWithFixture('complete');

    expect(fixture.calls).toHaveLength(1);
    expect(result).toMatchObject({
      decision: 'proceed',
      agentKey: identity.agentKey,
      behavior: 'not_implemented',
      agentResponseGenerated: false,
      eventPersistence: 'disabled',
      outcomePersistence: 'disabled',
      guidedActionPersistence: 'disabled',
    });
    expect(result.contextRequestResult).toMatchObject({
      decision: 'proceed',
      eventPersistence: 'disabled',
      behavior: 'not_implemented',
    });
    expect(result.outcomeGuidedActionResult).toMatchObject({
      decision: 'proceed',
      envelopePersistence: 'disabled',
      behavior: 'not_implemented',
      agentResponseGenerated: false,
    });
  });

  it('returns a limited combined turn result for a degraded Context Packet request', async () => {
    const { result } = await composeWithFixture('degraded');

    expect(result.decision).toBe('degraded');
    expect(result.contextRequestResult.consumption.packetStatus).toBe('degraded');
    expect(result.outcomeDrafts).toHaveLength(1);
    expect(result.guidedActionDrafts).toHaveLength(1);
    expect(result.outcomeDrafts[0]).toMatchObject({
      contentScope: 'limited',
      status: 'not_applicable',
      persistence: 'disabled',
      agentResponseGenerated: false,
    });
    expect(result.guidedActionDrafts[0]).toMatchObject({
      contentScope: 'limited',
      persistence: 'disabled',
      automaticSending: false,
      automaticCalling: false,
      agentResponseGenerated: false,
    });
  });

  it('creates no substantive outcome/action drafts for a failed Context Packet request', async () => {
    const { result } = await composeWithFixture('failed');

    expect(result.decision).toBe('block_substantive');
    expect(result.contextRequestResult.consumption.packetStatus).toBe('failed');
    expect(result.outcomeDrafts).toEqual([]);
    expect(result.guidedActionDrafts).toEqual([]);
    expect(result.events.map((event) => event.eventType)).toContain('context.packet.failed');
  });

  it('creates no drafts for rejected candidate/review-only context', async () => {
    const { result } = await composeWithFixture('candidate_included');

    expect(result.decision).toBe('reject');
    expect(result.outcomeDrafts).toEqual([]);
    expect(result.guidedActionDrafts).toEqual([]);
    expect(result.contextRequestResult.consumption.issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining([
        'candidate_included_forbidden',
        'candidate_exclusion_required',
      ]),
    );
  });

  it('includes returned runtime event envelopes in the combined result', async () => {
    const { result } = await composeWithFixture('complete');

    expect(result.events).toHaveLength(2);
    expect(result.events.map((event) => event.eventType)).toEqual([
      'agent.context.requested',
      'agent.context.received',
    ]);
    expect(result.events).toEqual(result.contextRequestResult.events);
    expect(result.events.every((event) => event.source === 'agent_runtime')).toBe(true);
  });

  it('includes an Outcome draft envelope when allowed', async () => {
    const { result } = await composeWithFixture('complete');

    expect(result.outcomeDrafts).toHaveLength(1);
    expect(result.outcomeDrafts[0]).toMatchObject({
      schemaVersion: 'orchestration_outcome_draft.v1',
      envelopeKind: 'outcome_draft',
      agentKey: 'michael_magnificent',
      taskType: 'training_support',
      contentScope: 'substantive',
      draftStatus: 'draft_only',
      persistence: 'disabled',
      agentResponseGenerated: false,
    });
  });

  it('includes a Guided Action draft envelope when allowed', async () => {
    const { result } = await composeWithFixture('complete');

    expect(result.guidedActionDrafts).toHaveLength(1);
    expect(result.guidedActionDrafts[0]).toMatchObject({
      schemaVersion: 'orchestration_guided_action_draft.v1',
      envelopeKind: 'guided_action_draft',
      agentKey: 'michael_magnificent',
      taskType: 'training_support',
      contentScope: 'substantive',
      draftStatus: 'draft_only',
      requiresBaApproval: true,
      automaticSending: false,
      automaticCalling: false,
      persistence: 'disabled',
      agentResponseGenerated: false,
    });
  });

  it('marks all combined persistence channels disabled', async () => {
    const { result } = await composeWithFixture('complete');

    expect(result.eventPersistence).toBe('disabled');
    expect(result.outcomePersistence).toBe('disabled');
    expect(result.guidedActionPersistence).toBe('disabled');
    expect(result.contextRequestResult.eventPersistence).toBe('disabled');
    expect(result.outcomeGuidedActionResult.envelopePersistence).toBe('disabled');
    expect(result.outcomeDrafts.every((draft) => draft.persistence === 'disabled')).toBe(true);
    expect(result.guidedActionDrafts.every((draft) => draft.persistence === 'disabled')).toBe(true);
  });

  it('does not generate an agent response', async () => {
    const { result } = await composeWithFixture('complete');

    expect(result.agentResponseGenerated).toBe(false);
    expect(Object.hasOwn(result, 'agentResponse')).toBe(false);
    expect(Object.hasOwn(result, 'message')).toBe(false);
    expect(Object.hasOwn(result, 'responseText')).toBe(false);
  });

  it('preserves behavior as not implemented', async () => {
    const { result } = await composeWithFixture('complete');

    expect(result.behavior).toBe('not_implemented');
    expect(result.contextRequestResult.behavior).toBe('not_implemented');
    expect(result.outcomeGuidedActionResult.behavior).toBe('not_implemented');
  });
});
