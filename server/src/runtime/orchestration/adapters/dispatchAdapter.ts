import { isKnownAgentKey } from '../registry.js';
import type {
  AgentRuntimeAdapterDispatchRejection,
  AgentRuntimeAdapterDispatchResult,
  DispatchAgentRuntimeAdapterInput,
  OrchestrationSessionIdentity,
} from '../types.js';
import { runIvoryRuntimeAdapter } from './ivoryAdapter.js';
import { runMichaelMagnificentRuntimeAdapter } from './michaelMagnificentAdapter.js';
import { runSteveSuccessRuntimeAdapter } from './steveSuccessAdapter.js';

/**
 * S2.6 inert adapter dispatch boundary.
 *
 * Selects the approved S2.5 adapter by agent key only. It does not mount
 * routes, assemble Context Packets, persist envelopes, or generate agent
 * responses.
 */
export async function dispatchAgentRuntimeAdapter(
  input: DispatchAgentRuntimeAdapterInput,
): Promise<AgentRuntimeAdapterDispatchResult> {
  const { agentKey } = input.identity;

  if (!isKnownAgentKey(agentKey)) {
    return rejectUnknownAgent(input, agentKey);
  }

  const identity: OrchestrationSessionIdentity = {
    ...input.identity,
    agentKey,
  };

  switch (agentKey) {
    case 'steve_success':
      return runSteveSuccessRuntimeAdapter({ ...input, identity });
    case 'michael_magnificent':
      return runMichaelMagnificentRuntimeAdapter({ ...input, identity });
    case 'ivory':
      return runIvoryRuntimeAdapter({ ...input, identity });
  }
}

function rejectUnknownAgent(
  input: DispatchAgentRuntimeAdapterInput,
  agentKey: unknown,
): AgentRuntimeAdapterDispatchRejection {
  return {
    decision: 'reject',
    agentKey,
    turnId: input.turnId,
    behavior: 'not_implemented',
    issues: [
      {
        path: 'identity.agentKey',
        code: 'invalid_agent',
        message: `Unknown orchestration agent: ${String(agentKey)}.`,
      },
    ],
    events: [],
    outcomeDrafts: [],
    guidedActionDrafts: [],
    notes: [
      'Adapter dispatch rejected the turn before Context Packet request.',
      'Agent behavior is not implemented in this slice; no agent output was generated.',
    ],
    eventPersistence: 'disabled',
    outcomePersistence: 'disabled',
    guidedActionPersistence: 'disabled',
    envelopePersistence: 'disabled',
    agentResponseGenerated: false,
  };
}
