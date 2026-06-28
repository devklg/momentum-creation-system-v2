import { describe, expect, it } from 'vitest';
import {
  draftOutcomeGuidedActionEnvelopes,
  requestContextPacketForTurn,
} from '../index.js';
import {
  createContextManagerFixture,
  requestIdentity,
  requestTurnId,
} from './contextRequestFixtures.js';

describe('S2.3 Outcome / Guided Action envelope wiring', () => {
  it('creates an outcome draft envelope from an accepted Context Packet result', async () => {
    const identity = requestIdentity();
    const requestResult = await requestContextPacketForTurn({
      identity,
      turnId: requestTurnId(),
      taskType: 'training_support',
      contextManager: createContextManagerFixture('complete').port,
    });

    const result = draftOutcomeGuidedActionEnvelopes({
      identity,
      turnId: requestTurnId(),
      consumption: requestResult.consumption,
      createdAt: '2026-06-28T13:00:00.000Z',
    });

    expect(result.outcomeDrafts).toHaveLength(1);
    expect(result.outcomeDrafts[0]).toMatchObject({
      schemaVersion: 'orchestration_outcome_draft.v1',
      envelopeKind: 'outcome_draft',
      agentKey: 'michael_magnificent',
      taskType: 'training_support',
      contentScope: 'substantive',
      category: 'training_support_completed',
      draftStatus: 'draft_only',
      persistence: 'disabled',
      agentResponseGenerated: false,
    });
    expect(result.outcomeDrafts[0]?.contextPacketId).toBe(requestResult.consumption.packet?.packetId);
  });

  it('creates a Guided Action draft envelope from an accepted Context Packet result', async () => {
    const identity = requestIdentity();
    const requestResult = await requestContextPacketForTurn({
      identity,
      turnId: requestTurnId(),
      taskType: 'training_support',
      contextManager: createContextManagerFixture('complete').port,
    });

    const result = draftOutcomeGuidedActionEnvelopes({
      identity,
      turnId: requestTurnId(),
      consumption: requestResult.consumption,
    });

    expect(result.guidedActionDrafts).toHaveLength(1);
    expect(result.guidedActionDrafts[0]).toMatchObject({
      schemaVersion: 'orchestration_guided_action_draft.v1',
      envelopeKind: 'guided_action_draft',
      agentKey: 'michael_magnificent',
      taskType: 'training_support',
      contentScope: 'substantive',
      category: 'review_training_module',
      draftStatus: 'draft_only',
      actionOwner: 'brand_ambassador',
      requiresBaApproval: true,
      automaticSending: false,
      automaticCalling: false,
      persistence: 'disabled',
      agentResponseGenerated: false,
    });
    expect(result.guidedActionDrafts[0]?.instruction).toContain('does not send, call, or contact anyone');
  });

  it('limits outcome/action envelope content for a degraded Context Packet result', async () => {
    const identity = requestIdentity();
    const requestResult = await requestContextPacketForTurn({
      identity,
      turnId: requestTurnId(),
      taskType: 'training_support',
      contextManager: createContextManagerFixture('degraded').port,
    });

    const result = draftOutcomeGuidedActionEnvelopes({
      identity,
      turnId: requestTurnId(),
      consumption: requestResult.consumption,
    });

    expect(result.decision).toBe('degraded');
    expect(result.outcomeDrafts[0]).toMatchObject({
      contentScope: 'limited',
      category: 'session_degraded',
      status: 'not_applicable',
      persistence: 'disabled',
    });
    expect(result.guidedActionDrafts[0]).toMatchObject({
      contentScope: 'limited',
      category: 'record_private_note',
      persistence: 'disabled',
      automaticSending: false,
      automaticCalling: false,
    });
    expect(result.guidedActionDrafts[0]?.instruction).toContain('Degraded context');
  });

  it('does not create substantive outcome/action drafts for a failed Context Packet result', async () => {
    const identity = requestIdentity();
    const requestResult = await requestContextPacketForTurn({
      identity,
      turnId: requestTurnId(),
      taskType: 'training_support',
      contextManager: createContextManagerFixture('failed').port,
    });

    const result = draftOutcomeGuidedActionEnvelopes({
      identity,
      turnId: requestTurnId(),
      consumption: requestResult.consumption,
    });

    expect(requestResult.decision).toBe('block_substantive');
    expect(result.outcomeDrafts).toEqual([]);
    expect(result.guidedActionDrafts).toEqual([]);
  });

  it('does not create outcome/action drafts for invalid candidate/review-only context', async () => {
    const identity = requestIdentity();
    const requestResult = await requestContextPacketForTurn({
      identity,
      turnId: requestTurnId(),
      taskType: 'training_support',
      contextManager: createContextManagerFixture('candidate_included').port,
    });

    const result = draftOutcomeGuidedActionEnvelopes({
      identity,
      turnId: requestTurnId(),
      consumption: requestResult.consumption,
    });

    expect(requestResult.decision).toBe('reject');
    expect(result.outcomeDrafts).toEqual([]);
    expect(result.guidedActionDrafts).toEqual([]);
  });

  it('returns outcome/action envelopes only and never marks them persisted', async () => {
    const identity = requestIdentity();
    const requestResult = await requestContextPacketForTurn({
      identity,
      turnId: requestTurnId(),
      taskType: 'training_support',
      contextManager: createContextManagerFixture('complete').port,
    });

    const result = draftOutcomeGuidedActionEnvelopes({
      identity,
      turnId: requestTurnId(),
      consumption: requestResult.consumption,
    });

    expect(result.envelopePersistence).toBe('disabled');
    expect(result.agentResponseGenerated).toBe(false);
    expect(result.behavior).toBe('not_implemented');
    expect(result.outcomeDrafts.every((draft) => draft.persistence === 'disabled')).toBe(true);
    expect(result.guidedActionDrafts.every((draft) => draft.persistence === 'disabled')).toBe(true);
  });

  it('does not generate an agent response', async () => {
    const identity = requestIdentity();
    const requestResult = await requestContextPacketForTurn({
      identity,
      turnId: requestTurnId(),
      taskType: 'training_support',
      contextManager: createContextManagerFixture('complete').port,
    });

    const result = draftOutcomeGuidedActionEnvelopes({
      identity,
      turnId: requestTurnId(),
      consumption: requestResult.consumption,
    });

    expect(result.behavior).toBe('not_implemented');
    expect(result.agentResponseGenerated).toBe(false);
    expect(Object.hasOwn(result, 'agentResponse')).toBe(false);
    expect(Object.hasOwn(result, 'message')).toBe(false);
  });
});
