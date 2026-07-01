import type {
  McsAgentKey,
  McsContextPacketRequest,
  McsRuntimeRequestScope,
} from '@momentum/shared/runtime';
import type { RuntimeAgentEventEnvelope } from '../events/index.js';
import { consumeContextPacket } from './consumption.js';
import {
  captureOrchestrationEvent,
  idempotencyKeys,
} from './events.js';
import {
  getAgentDescriptor,
  isKnownAgentKey,
  isTaskTypeAllowed,
} from './registry.js';
import type {
  BuildContextPacketRequestInput,
  ContextPacketRequestBundle,
  ContextPacketRequestIssue,
  ContextPacketRequestWiringResult,
  RequestContextPacketForTurnInput,
} from './types.js';

/**
 * S2.2 Context Packet request wiring.
 *
 * INERT. The orchestrator can request a packet through an injected Context
 * Manager boundary, validate/consume the returned packet, and return
 * non-persistent lifecycle event envelopes. It does not assemble packets,
 * retrieve knowledge, persist events, mount routes, or invoke agent behavior.
 */

export function buildContextPacketRequest(
  input: BuildContextPacketRequestInput,
): ContextPacketRequestBundle {
  const { identity, turnId, taskType } = input;
  const requestId =
    identity.requestId ??
    (`ctx_req_${identity.sessionId}_${turnId}` as McsContextPacketRequest['requestId']);

  const scope: McsRuntimeRequestScope = {
    ...identity.scope,
    requestId,
    sessionId: identity.sessionId,
  };

  const request: McsContextPacketRequest = {
    requestId,
    sessionId: identity.sessionId,
    agentKey: identity.agentKey,
    language: identity.language,
    taskType,
  };

  return { scope, request };
}

export async function requestContextPacketForTurn(
  input: RequestContextPacketForTurnInput,
): Promise<ContextPacketRequestWiringResult> {
  const { identity, turnId, taskType } = input;
  const { scope, request } = buildContextPacketRequest({ identity, turnId, taskType });
  const events: RuntimeAgentEventEnvelope[] = [];
  const issues: ContextPacketRequestIssue[] = [];
  const notes: string[] = [
    'Agent behavior is not implemented in this slice; no agent output was generated.',
    'Context Packet request was routed through the injected Context Manager boundary.',
  ];

  if (!isKnownAgentKey(identity.agentKey)) {
    issues.push(
      requestIssue(
        'identity.agentKey',
        'invalid_agent',
        `Unknown orchestration agent: ${String(identity.agentKey)}.`,
      ),
    );
    return rejectedResult(identity.agentKey, request, scope, issues, events, notes);
  }

  const descriptor = getAgentDescriptor(identity.agentKey);
  if (!isTaskTypeAllowed(identity.agentKey, taskType)) {
    issues.push(
      requestIssue(
        'request.taskType',
        'invalid_objective',
        `Task type ${taskType} is not an allowed objective for ${identity.agentKey}.`,
      ),
    );
    return rejectedResult(identity.agentKey, request, scope, issues, events, notes);
  }

  if (input.contextManager.assembledBy !== 'context_manager') {
    issues.push(
      requestIssue(
        'contextManager.assembledBy',
        'context_manager_required',
        'Context Packet requests must use the Context Manager boundary.',
      ),
    );
    return rejectedResult(identity.agentKey, request, scope, issues, events, notes);
  }

  events.push(
    captureOrchestrationEvent({
      eventType: 'agent.context.requested',
      identity,
      idempotencyKey: idempotencyKeys.contextPacketRequested(identity.sessionId, turnId),
      payload: {
        turnId,
        taskType,
        agentKey: identity.agentKey,
        requestId: request.requestId,
        descriptor: descriptor.displayName,
      },
    }),
  );

  let response: unknown;
  try {
    response = await input.contextManager.requestContextPacket(scope, request);
  } catch (error) {
    issues.push(
      requestIssue(
        'contextManager.requestContextPacket',
        'context_manager_request_failed',
        error instanceof Error ? error.message : String(error),
      ),
    );
    events.push(
      captureOrchestrationEvent({
        eventType: 'context.packet.failed',
        identity,
        idempotencyKey: idempotencyKeys.contextPacketReceived(identity.sessionId, turnId),
        payload: {
          turnId,
          taskType,
          reason: 'context_manager_request_failed',
        },
      }),
    );
    return rejectedResult(identity.agentKey, request, scope, issues, events, notes, response);
  }

  if (response === null || response === undefined) {
    issues.push(
      requestIssue(
        'contextManager.response',
        'missing_context_packet',
        'Context Manager returned no Context Packet.',
      ),
    );
    events.push(
      captureOrchestrationEvent({
        eventType: 'context.packet.failed',
        identity,
        idempotencyKey: idempotencyKeys.contextPacketReceived(identity.sessionId, turnId),
        payload: {
          turnId,
          taskType,
          reason: 'missing_context_packet',
        },
      }),
    );
    return rejectedResult(identity.agentKey, request, scope, issues, events, notes, response);
  }

  const consumption = consumeContextPacket({
    expectedAgentKey: identity.agentKey,
    packet: response,
    requireSubstantive: input.requireSubstantive ?? true,
  });

  switch (consumption.decision) {
    case 'proceed':
    case 'degraded':
      events.push(
        captureOrchestrationEvent({
          eventType:
            consumption.decision === 'degraded'
              ? 'context.packet.degraded'
              : 'agent.context.received',
          identity,
          idempotencyKey: idempotencyKeys.contextPacketReceived(identity.sessionId, turnId),
          payload: {
            turnId,
            requestId: request.requestId,
            packetStatus: consumption.packetStatus,
            taskType: consumption.taskType,
          },
        }),
      );
      notes.push(`Context Packet response accepted with decision: ${consumption.decision}.`);
      break;
    case 'block_substantive':
      events.push(
        captureOrchestrationEvent({
          eventType: 'context.packet.failed',
          identity,
          idempotencyKey: idempotencyKeys.contextPacketReceived(identity.sessionId, turnId),
          payload: {
            turnId,
            requestId: request.requestId,
            packetStatus: consumption.packetStatus,
            reason: 'packet_failed',
          },
        }),
      );
      notes.push('Failed Context Packet blocks substantive guidance; safe fallback only.');
      break;
    case 'reject':
    default:
      events.push(
        captureOrchestrationEvent({
          eventType: 'context.packet.failed',
          identity,
          idempotencyKey: idempotencyKeys.contextPacketRejected(identity.sessionId, turnId),
          payload: {
            turnId,
            requestId: request.requestId,
            reason: 'context_packet_rejected',
            issueCodes: consumption.issues.map((entry) => entry.code),
          },
        }),
      );
      notes.push('Context Packet response rejected before any agent invocation.');
      break;
  }

  return {
    decision: consumption.decision,
    agentKey: identity.agentKey,
    behavior: 'not_implemented',
    request,
    scope,
    response,
    consumption,
    events,
    issues,
    notes,
    eventPersistence: 'disabled',
  };
}

function rejectedResult(
  agentKey: McsAgentKey,
  request: McsContextPacketRequest,
  scope: McsRuntimeRequestScope,
  issues: ContextPacketRequestIssue[],
  events: RuntimeAgentEventEnvelope[],
  notes: string[],
  response?: unknown,
): ContextPacketRequestWiringResult {
  return {
    decision: 'reject',
    agentKey,
    behavior: 'not_implemented',
    request,
    scope,
    response,
    consumption: {
      decision: 'reject',
      expectedAgentKey: agentKey,
      issues: issues.map((entry) => ({
        path: entry.path,
        code: entry.code,
        message: entry.message,
      })),
    },
    events,
    issues,
    notes,
    eventPersistence: 'disabled',
  };
}

function requestIssue(
  path: string,
  code: string,
  message: string,
): ContextPacketRequestIssue {
  return { path, code, message };
}
