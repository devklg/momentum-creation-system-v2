import { composeOrchestrationTurn } from '../composition.js';
import { isTaskTypeAllowed } from '../registry.js';
import type {
  ComposeOrchestrationTurnInput,
  OrchestrationSessionIdentity,
  OrchestrationTurnCompositionResult,
} from '../types.js';

const MICHAEL_MAGNIFICENT_AGENT_KEY = 'michael_magnificent' as const;

export interface MichaelMagnificentRuntimeAdapterInput
  extends Omit<ComposeOrchestrationTurnInput, 'identity'> {
  identity: OrchestrationSessionIdentity;
}

export function mapMichaelMagnificentIdentity(
  identity: OrchestrationSessionIdentity,
): OrchestrationSessionIdentity {
  return {
    ...identity,
    agentKey: MICHAEL_MAGNIFICENT_AGENT_KEY,
  };
}

export function isMichaelMagnificentObjectiveAllowed(
  taskType: MichaelMagnificentRuntimeAdapterInput['taskType'],
): boolean {
  return isTaskTypeAllowed(MICHAEL_MAGNIFICENT_AGENT_KEY, taskType);
}

export async function runMichaelMagnificentRuntimeAdapter(
  input: MichaelMagnificentRuntimeAdapterInput,
): Promise<OrchestrationTurnCompositionResult> {
  const michaelIdentity = mapMichaelMagnificentIdentity(input.identity);
  const objectiveAllowed = isMichaelMagnificentObjectiveAllowed(input.taskType);

  if (!objectiveAllowed) {
    return composeOrchestrationTurn({
      ...input,
      identity: michaelIdentity,
    });
  }

  return composeOrchestrationTurn({
    ...input,
    identity: michaelIdentity,
  });
}
