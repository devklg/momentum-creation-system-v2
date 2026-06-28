import { composeOrchestrationTurn } from '../composition.js';
import type {
  ComposeOrchestrationTurnInput,
  OrchestrationSessionIdentity,
  OrchestrationTurnCompositionResult,
} from '../types.js';

/**
 * S2.5 inert Steve Success adapter.
 *
 * The adapter only maps the supplied turn identity to Steve and delegates to
 * the inert orchestration composition path. It does not implement Steve
 * interview behavior or produce substantive output.
 */
export interface SteveSuccessRuntimeAdapterInput
  extends Omit<ComposeOrchestrationTurnInput, 'identity'> {
  identity: OrchestrationSessionIdentity;
}

export async function runSteveSuccessRuntimeAdapter(
  input: SteveSuccessRuntimeAdapterInput,
): Promise<OrchestrationTurnCompositionResult> {
  const steveIdentity: OrchestrationSessionIdentity = {
    ...input.identity,
    agentKey: 'steve_success',
  };

  return composeOrchestrationTurn({
    ...input,
    identity: steveIdentity,
  });
}
