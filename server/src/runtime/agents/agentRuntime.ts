import type {
  AgentContext,
  AgentRuntimeInstanceConfig,
  ContextPacketV1,
  RuntimeRequestScope,
} from '@momentum/shared/runtime';
import { defineRuntimeBoundary } from '../common.js';
import type { BackendRuntimeBoundaryDescriptor } from '../common.js';

export interface AgentRuntimeBoundaryPort {
  prepareAgentContext(
    scope: RuntimeRequestScope,
    config: AgentRuntimeInstanceConfig,
    contextPacket: ContextPacketV1,
  ): Promise<AgentContext>;
}

export const agentRuntimeBoundary = defineRuntimeBoundary({
  key: 'agent_runtime',
  label: 'Agent Runtime',
  status: 'skeleton_only',
  activated: false,
  apiMounted: false,
  behaviorEnabled: false,
  persistenceAccess: 'service_boundary_only',
  sharedContractImport: '@momentum/shared/runtime',
  notes: [
    'Agent execution boundary placeholder only; no Steve, Michael, Ivory, or future agent behavior is activated.',
    'Agents receive validated Context Packets and approved tools, never raw persistence clients or Gateway access.',
  ],
} satisfies BackendRuntimeBoundaryDescriptor<'agent_runtime'>);
