import type {
  McsAgentEventEnvelope,
  McsAgentEventSource,
  McsAgentEventType,
  McsAgentKey,
  McsAgentId,
  TmagId,
  McsRequestId,
} from '@momentum/shared/runtime';

export type RuntimeEventActorType = 'ba' | 'agent' | 'system' | 'admin' | 'subscriber';

export interface RuntimeEventActor {
  actorType: RuntimeEventActorType;
  actorId: string;
  tmagId?: TmagId;
  agentKey?: McsAgentKey;
  agentId?: McsAgentId;
}

export interface RuntimeEventProvenance {
  emittedBy: string;
  requestId?: McsRequestId;
  componentVersion?: string;
  traceId?: string;
}

export type RuntimeAgentEventEnvelope<TPayload = Record<string, unknown>> =
  McsAgentEventEnvelope<TPayload> & {
    agentId?: McsAgentId;
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

export type RuntimeEventSource = McsAgentEventSource;
export type RuntimeEventType = McsAgentEventType;
