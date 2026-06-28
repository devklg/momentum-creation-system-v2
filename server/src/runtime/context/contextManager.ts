import type {
  ContextPacketRequest,
  ContextPacketV1,
  RuntimeRequestScope,
} from '@momentum/shared/runtime';
import { defineRuntimeBoundary } from '../common.js';
import type { BackendRuntimeBoundaryDescriptor } from '../common.js';

export interface ContextManagerBoundaryPort {
  buildContextPacket(
    scope: RuntimeRequestScope,
    request: ContextPacketRequest,
  ): Promise<ContextPacketV1>;
}

export const contextManagerBoundary = defineRuntimeBoundary({
  key: 'context_manager',
  label: 'Context Manager',
  status: 'skeleton_only',
  activated: false,
  apiMounted: false,
  behaviorEnabled: false,
  persistenceAccess: 'service_boundary_only',
  sharedContractImport: '@momentum/shared/runtime',
  notes: [
    'Only approved path from memory services into agents.',
    'Future implementations must apply Team Magnificent scope, BA scope, privacy filters, exclusions, and retrieval audit.',
  ],
} satisfies BackendRuntimeBoundaryDescriptor<'context_manager'>);
