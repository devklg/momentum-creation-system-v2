import type {
  IdempotencyKey,
} from '@momentum/shared/runtime';
import {
  createRuntimeEventEnvelope,
} from '../events/index.js';
import type {
  CreateRuntimeEventEnvelopeInput,
  RuntimeAgentEventEnvelope,
} from '../events/index.js';
import type { OrchestrationSessionIdentity } from './types.js';

/**
 * S2.1 non-persistent runtime event capture.
 *
 * Capture helpers BUILD and RETURN `agent_event.v1` envelopes through the S1.4
 * foundation. They never persist, never create outbox records, never replay,
 * never publish to subscribers, and never call an event API. The "return shape"
 * is the contract: orchestration collects envelopes in memory and returns them.
 *
 * Only the approved S1.4 event-type namespaces are used (agent.*, context.*,
 * guided_action.*, system.*). Agent-family identity (steve/michael/ivory) is
 * carried via the envelope `agentKey`, not via the event type string.
 */

export const ORCHESTRATION_EVENT_SOURCE = 'agent_runtime' as const;
export const ORCHESTRATION_EMITTER = 'agent_runtime_orchestrator' as const;
export const ORCHESTRATION_COMPONENT_VERSION = 's2.1' as const;

export interface OrchestrationEventInput {
  /** Must use an approved S1.4 namespace, e.g. agent.* / context.* / guided_action.* */
  eventType: string;
  identity: OrchestrationSessionIdentity;
  idempotencyKey: string;
  payload?: Record<string, unknown>;
  causationId?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Build a single non-persistent event envelope for an orchestration fact.
 * Returns the validated envelope; does not store it anywhere.
 */
export function captureOrchestrationEvent(
  input: OrchestrationEventInput,
): RuntimeAgentEventEnvelope {
  const { identity } = input;

  const envelopeInput: CreateRuntimeEventEnvelopeInput = {
    eventType: input.eventType as CreateRuntimeEventEnvelopeInput['eventType'],
    tenantId: identity.scope.tenantId,
    teamId: identity.scope.teamId,
    teamKey: identity.scope.teamKey,
    teamName: identity.scope.teamName,
    baId: identity.scope.baId,
    agentKey: identity.agentKey,
    sessionId: identity.sessionId,
    correlationId: identity.correlationId,
    causationId: input.causationId as RuntimeAgentEventEnvelope['causationId'],
    idempotencyKey: input.idempotencyKey as IdempotencyKey,
    source: ORCHESTRATION_EVENT_SOURCE,
    payload: input.payload ?? {},
    actor: {
      actorType: 'system',
      actorId: ORCHESTRATION_EMITTER,
    },
    provenance: {
      emittedBy: ORCHESTRATION_EMITTER,
      requestId: identity.requestId,
      componentVersion: ORCHESTRATION_COMPONENT_VERSION,
    },
    metadata: input.metadata,
  };

  return createRuntimeEventEnvelope(envelopeInput);
}

/**
 * In-memory, non-persistent capture buffer.
 *
 * This is the explicit "return shape" for runtime events in Sprint 2: a turn
 * collects envelopes here and returns the list. There is no flush-to-store.
 */
export interface EventCapture {
  record(input: OrchestrationEventInput): RuntimeAgentEventEnvelope;
  list(): RuntimeAgentEventEnvelope[];
  readonly persisted: false;
}

export function createEventCapture(): EventCapture {
  const events: RuntimeAgentEventEnvelope[] = [];

  return {
    persisted: false,
    record(input: OrchestrationEventInput): RuntimeAgentEventEnvelope {
      const envelope = captureOrchestrationEvent(input);
      events.push(envelope);
      return envelope;
    },
    list(): RuntimeAgentEventEnvelope[] {
      return [...events];
    },
  };
}

/** Deterministic idempotency-key conventions (event capture plan section 7). */
export const idempotencyKeys = {
  sessionCreated: (sessionId: string): string => `agent-session:${sessionId}:created`,
  sessionResumed: (sessionId: string): string => `agent-session:${sessionId}:resumed`,
  sessionCompleted: (sessionId: string): string => `agent-session:${sessionId}:completed`,
  turnReceived: (sessionId: string, turnId: string): string =>
    `agent-turn:${sessionId}:${turnId}:received`,
  contextPacketReceived: (sessionId: string, turnId: string): string =>
    `context-packet:${sessionId}:${turnId}:received`,
  contextPacketRequested: (sessionId: string, turnId: string): string =>
    `context-packet:${sessionId}:${turnId}:requested`,
  contextPacketRejected: (sessionId: string, turnId: string): string =>
    `context-packet:${sessionId}:${turnId}:rejected`,
  guardrailBlocked: (sessionId: string, turnId: string): string =>
    `guardrail:${sessionId}:${turnId}:blocked`,
} as const;
