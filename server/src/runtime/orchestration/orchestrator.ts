import type { RuntimeAgentEventEnvelope } from '../events/index.js';
import { consumeContextPacket } from './consumption.js';
import {
  captureOrchestrationEvent,
  idempotencyKeys,
} from './events.js';
import { getAgentDescriptor } from './registry.js';
import type {
  AgentOrchestrationBoundaryDescriptor,
  CreateAgentSessionInput,
  OrchestrationSessionState,
  OrchestrationTurnPlan,
  PlanAgentTurnInput,
} from './types.js';

/**
 * S2.1 Agent Runtime Orchestration skeleton.
 *
 * INERT. The orchestrator coordinates identity, session/turn lifecycle, Context
 * Packet consumption, and non-persistent event capture. It does NOT:
 *  - generate Steve/Michael/Ivory output (behavior is not implemented);
 *  - mount routes or expose a runtime HTTP API surface;
 *  - persist sessions, turns, or events;
 *  - query stores, GraphRAG, adapters, or persistence dispatch clients;
 *  - assemble Context Packets (Context Manager remains the only assembler).
 */

export const agentOrchestrationBoundary: AgentOrchestrationBoundaryDescriptor = {
  key: 'agent_orchestration',
  label: 'Agent Runtime Orchestration',
  status: 'skeleton_only',
  activated: false,
  apiMounted: false,
  behaviorEnabled: false,
  agentBehaviorImplemented: false,
  eventPersistence: 'disabled',
  contextPacketAssembly: 'context_manager_only',
  persistenceAccess: 'service_boundary_only',
  sharedContractImport: '@momentum/shared/runtime',
  notes: [
    'Coordinates agent sessions for Steve, Michael, and Ivory; no agent behavior is implemented.',
    'Agents consume validated Context Packets only; the orchestrator never assembles or retrieves context.',
    'Runtime events are captured as non-persistent envelopes returned to the caller; nothing is stored.',
  ],
};

export interface CreateAgentSessionResult {
  state: OrchestrationSessionState;
  events: RuntimeAgentEventEnvelope[];
}

/**
 * Create (or resume) an inert orchestration session. Returns the session state
 * and the non-persistent event envelope(s) captured for the lifecycle fact.
 */
export function createAgentSession(input: CreateAgentSessionInput): CreateAgentSessionResult {
  const createdAt = input.createdAt ?? new Date().toISOString();
  const identity = {
    scope: input.scope,
    sessionId: input.sessionId,
    agentKey: input.agentKey,
    mode: input.mode,
    language: input.language,
    correlationId: input.correlationId,
    requestId: input.requestId,
  };

  const state: OrchestrationSessionState = {
    ...identity,
    status: 'created',
    createdAt,
  };

  const resumed = input.resume === true;
  const event = captureOrchestrationEvent({
    eventType: resumed ? 'agent.session.resumed' : 'agent.session.created',
    identity,
    idempotencyKey: resumed
      ? idempotencyKeys.sessionResumed(input.sessionId)
      : idempotencyKeys.sessionCreated(input.sessionId),
    payload: {
      agentKey: input.agentKey,
      mode: input.mode,
      language: input.language,
      status: state.status,
    },
  });

  return { state, events: [event] };
}

/**
 * Plan a single agent turn: validate/consume the provided Context Packet and
 * capture non-persistent runtime events. Never produces agent output.
 */
export function planAgentTurn(input: PlanAgentTurnInput): OrchestrationTurnPlan {
  const { identity, turnId } = input;
  const sessionId = identity.sessionId;
  const events: RuntimeAgentEventEnvelope[] = [];

  events.push(
    captureOrchestrationEvent({
      eventType: 'agent.turn.received',
      identity,
      idempotencyKey: idempotencyKeys.turnReceived(sessionId, turnId),
      payload: { turnId },
    }),
  );

  const consumption = consumeContextPacket({
    expectedAgentKey: identity.agentKey,
    packet: input.packet,
    requireSubstantive: input.requireSubstantive ?? true,
  });

  const notes: string[] = [
    'Agent behavior is not implemented in this slice; no agent output was generated.',
  ];

  switch (consumption.decision) {
    case 'proceed':
    case 'degraded':
      events.push(
        captureOrchestrationEvent({
          eventType:
            consumption.decision === 'degraded'
              ? 'context.packet.degraded'
              : 'context.packet.received',
          identity,
          idempotencyKey: idempotencyKeys.contextPacketReceived(sessionId, turnId),
          payload: {
            turnId,
            packetStatus: consumption.packetStatus,
            taskType: consumption.taskType,
          },
        }),
      );
      notes.push(`Context Packet accepted with decision: ${consumption.decision}.`);
      break;

    case 'block_substantive':
      events.push(
        captureOrchestrationEvent({
          eventType: 'context.packet.failed',
          identity,
          idempotencyKey: idempotencyKeys.contextPacketReceived(sessionId, turnId),
          payload: { turnId, packetStatus: consumption.packetStatus },
        }),
      );
      notes.push('Failed Context Packet blocks substantive guidance; safe fallback only.');
      break;

    case 'reject':
    default:
      events.push(
        captureOrchestrationEvent({
          eventType: 'context.packet.rejected',
          identity,
          idempotencyKey: idempotencyKeys.contextPacketRejected(sessionId, turnId),
          payload: {
            turnId,
            issueCodes: consumption.issues.map((entry) => entry.code),
          },
        }),
      );
      events.push(
        captureOrchestrationEvent({
          eventType: 'agent.guardrail.blocked',
          identity,
          idempotencyKey: idempotencyKeys.guardrailBlocked(sessionId, turnId),
          payload: {
            turnId,
            reason: 'context_packet_rejected',
            issueCodes: consumption.issues.map((entry) => entry.code),
          },
        }),
      );
      notes.push('Context Packet rejected; turn blocked before any agent invocation.');
      break;
  }

  // Touch the descriptor so the registry stays the single source of agent
  // metadata; this is inert and asserts the agent is known.
  void getAgentDescriptor(identity.agentKey);

  return {
    decision: consumption.decision,
    agentKey: identity.agentKey,
    behavior: 'not_implemented',
    consumption,
    events,
    notes,
  };
}
