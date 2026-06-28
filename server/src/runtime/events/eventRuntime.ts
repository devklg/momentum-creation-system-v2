import type {
  AgentEventEnvelope,
  EmitRuntimeEventRequest,
  EmitRuntimeEventResponse,
} from '@momentum/shared/runtime';
import { defineRuntimeBoundary } from '../common.js';
import type { BackendRuntimeBoundaryDescriptor } from '../common.js';

export interface EventRuntimeBoundaryPort {
  emitEvent<TPayload extends Record<string, unknown>>(
    request: EmitRuntimeEventRequest<TPayload>,
  ): Promise<EmitRuntimeEventResponse<TPayload>>;
  readEventEnvelope<TPayload extends Record<string, unknown>>(
    eventId: AgentEventEnvelope<TPayload>['eventId'],
  ): Promise<AgentEventEnvelope<TPayload> | null>;
}

export const eventRuntimeBoundary = defineRuntimeBoundary({
  key: 'event_runtime',
  label: 'Event Runtime',
  status: 'skeleton_only',
  activated: false,
  apiMounted: false,
  behaviorEnabled: false,
  persistenceAccess: 'service_boundary_only',
  sharedContractImport: '@momentum/shared/runtime',
  notes: [
    'Runtime event envelope boundary placeholder only; no outbox, replay, or subscriber behavior is active.',
    'Future implementations must preserve append-only event semantics, idempotency, correlation IDs, and causation IDs.',
  ],
} satisfies BackendRuntimeBoundaryDescriptor<'event_runtime'>);
