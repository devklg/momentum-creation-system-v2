import type {
  AgentEventEnvelope,
  AgentEventSource,
  AgentEventType,
  AgentKey,
  AgentId,
  BaId,
  RequestId,
} from '@momentum/shared/runtime';

export type RuntimeEventActorType = 'ba' | 'agent' | 'system' | 'admin' | 'subscriber';

export interface RuntimeEventActor {
  actorType: RuntimeEventActorType;
  actorId: string;
  baId?: BaId;
  agentKey?: AgentKey;
  agentId?: AgentId;
}

export interface RuntimeEventProvenance {
  emittedBy: string;
  requestId?: RequestId;
  componentVersion?: string;
  traceId?: string;
}

export type RuntimeAgentEventEnvelope<TPayload = Record<string, unknown>> =
  AgentEventEnvelope<TPayload> & {
    agentId?: AgentId;
    actor: RuntimeEventActor;
    provenance: RuntimeEventProvenance;
  };

export interface RuntimeEventValidationIssue {
  path: string;
  code: string;
  message: string;
}

export type RuntimeEventValidationResult<TPayload = Record<string, unknown>> =
  | {
      ok: true;
      event: RuntimeAgentEventEnvelope<TPayload>;
      errors: [];
    }
  | {
      ok: false;
      errors: RuntimeEventValidationIssue[];
    };

export type CreateRuntimeEventEnvelopeInput<TPayload = Record<string, unknown>> =
  Omit<
    RuntimeAgentEventEnvelope<TPayload>,
    'eventId' | 'schemaVersion' | 'recordedAt' | 'occurredAt'
  > & {
    eventId?: RuntimeAgentEventEnvelope<TPayload>['eventId'];
    occurredAt?: string;
    recordedAt?: string;
  };

export interface RuntimeEventClock {
  now(): Date;
}

export type RuntimeEventSource = AgentEventSource;
export type RuntimeEventType = AgentEventType;
