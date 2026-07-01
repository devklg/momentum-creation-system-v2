import { describe, expect, it } from 'vitest';
import type {
  AgentKey,
  RuntimeTaskType,
} from '@momentum/shared/runtime';
import { assertValidRuntimeEventEnvelope } from '../../events/index.js';
import {
  buildContextPacketRequest,
  requestContextPacketForTurn,
  type ContextManagerRequestPort,
} from '../index.js';
import {
  createContextManagerFixture,
  requestIdentity,
  requestTurnId,
} from './contextRequestFixtures.js';

describe('S2.2 Context Packet request wiring', () => {
  it('builds a valid Context Packet request bundle for the first orchestration flow', () => {
    const identity = requestIdentity();
    const turnId = requestTurnId();
    const bundle = buildContextPacketRequest({
      identity,
      turnId,
      taskType: 'training_support',
    });

    expect(bundle.request).toEqual({
      requestId: `ctx_req_${identity.sessionId}_${turnId}`,
      sessionId: identity.sessionId,
      agentKey: 'michael_magnificent',
      language: 'en',
      taskType: 'training_support',
    });
    expect(bundle.scope.requestId).toBe(bundle.request.requestId);
    expect(bundle.scope.sessionId).toBe(identity.sessionId);
    expect(bundle.scope.tmagId).toBe(identity.scope.tmagId);
  });

  it('requests, validates, and consumes a valid Context Packet response', async () => {
    const fixture = createContextManagerFixture('complete');
    const result = await requestContextPacketForTurn({
      identity: requestIdentity(),
      turnId: requestTurnId(),
      taskType: 'training_support',
      contextManager: fixture.port,
    });

    expect(result.decision).toBe('proceed');
    expect(result.consumption.packetStatus).toBe('complete');
    expect(result.behavior).toBe('not_implemented');
    expect(result.eventPersistence).toBe('disabled');
    expect(fixture.calls).toHaveLength(1);
    expect(fixture.calls[0]?.request.agentKey).toBe('michael_magnificent');
    expect(result.events.map((event) => event.eventType)).toEqual([
      'agent.context.requested',
      'agent.context.received',
    ]);
    for (const event of result.events) {
      expect(() => assertValidRuntimeEventEnvelope(event)).not.toThrow();
      expect(Object.hasOwn(event, 'createdAt')).toBe(false);
    }
  });

  it('rejects a missing Context Packet response', async () => {
    const fixture = createContextManagerFixture('missing');
    const result = await requestContextPacketForTurn({
      identity: requestIdentity(),
      turnId: requestTurnId(),
      taskType: 'training_support',
      contextManager: fixture.port,
    });

    expect(result.decision).toBe('reject');
    expect(result.issues.map((issue) => issue.code)).toContain('missing_context_packet');
    expect(result.events.map((event) => event.eventType)).toEqual([
      'agent.context.requested',
      'context.packet.failed',
    ]);
  });

  it('returns a degraded decision for a degraded Context Packet response', async () => {
    const fixture = createContextManagerFixture('degraded');
    const result = await requestContextPacketForTurn({
      identity: requestIdentity(),
      turnId: requestTurnId(),
      taskType: 'training_support',
      contextManager: fixture.port,
    });

    expect(result.decision).toBe('degraded');
    expect(result.consumption.packetStatus).toBe('degraded');
    expect(result.events.map((event) => event.eventType)).toContain('context.packet.degraded');
  });

  it('blocks substantive guidance for a failed Context Packet response', async () => {
    const fixture = createContextManagerFixture('failed');
    const result = await requestContextPacketForTurn({
      identity: requestIdentity(),
      turnId: requestTurnId(),
      taskType: 'training_support',
      contextManager: fixture.port,
    });

    expect(result.decision).toBe('block_substantive');
    expect(result.consumption.packetStatus).toBe('failed');
    expect(result.events.map((event) => event.eventType)).toContain('context.packet.failed');
  });

  it('rejects candidate/review-only knowledge inclusion in the returned packet', async () => {
    const fixture = createContextManagerFixture('candidate_included');
    const result = await requestContextPacketForTurn({
      identity: requestIdentity(),
      turnId: requestTurnId(),
      taskType: 'training_support',
      contextManager: fixture.port,
    });

    expect(result.decision).toBe('reject');
    expect(result.consumption.issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining([
        'candidate_included_forbidden',
        'candidate_exclusion_required',
      ]),
    );
  });

  it('rejects an invalid agent before requesting context', async () => {
    const fixture = createContextManagerFixture('complete');
    const result = await requestContextPacketForTurn({
      identity: requestIdentity({ agentKey: 'unknown_agent' as AgentKey }),
      turnId: requestTurnId(),
      taskType: 'training_support',
      contextManager: fixture.port,
    });

    expect(result.decision).toBe('reject');
    expect(result.issues.map((issue) => issue.code)).toContain('invalid_agent');
    expect(fixture.calls).toHaveLength(0);
    expect(result.events).toEqual([]);
  });

  it('rejects an invalid objective before requesting context', async () => {
    const fixture = createContextManagerFixture('complete');
    const result = await requestContextPacketForTurn({
      identity: requestIdentity({ agentKey: 'steve_success' }),
      turnId: requestTurnId(),
      taskType: 'training_support' as RuntimeTaskType,
      contextManager: fixture.port,
    });

    expect(result.decision).toBe('reject');
    expect(result.issues.map((issue) => issue.code)).toContain('invalid_objective');
    expect(fixture.calls).toHaveLength(0);
    expect(result.events).toEqual([]);
  });

  it('requires the Context Manager boundary to remain the only assembler', async () => {
    const fixture = createContextManagerFixture('complete');
    const wrongBoundary: ContextManagerRequestPort = {
      ...fixture.port,
      assembledBy: 'agent_runtime' as ContextManagerRequestPort['assembledBy'],
    };
    const result = await requestContextPacketForTurn({
      identity: requestIdentity(),
      turnId: requestTurnId(),
      taskType: 'training_support',
      contextManager: wrongBoundary,
    });

    expect(result.decision).toBe('reject');
    expect(result.issues.map((issue) => issue.code)).toContain('context_manager_required');
    expect(fixture.calls).toHaveLength(0);
  });

  it('returns runtime events only and does not persist lifecycle events', async () => {
    const fixture = createContextManagerFixture('complete');
    const result = await requestContextPacketForTurn({
      identity: requestIdentity(),
      turnId: requestTurnId(),
      taskType: 'training_support',
      contextManager: fixture.port,
    });

    expect(result.eventPersistence).toBe('disabled');
    expect(result.events.length).toBeGreaterThan(0);
    expect(result.events.every((event) => event.source === 'agent_runtime')).toBe(true);
    expect(result.notes.join(' ')).toContain('no agent output was generated');
  });
});
