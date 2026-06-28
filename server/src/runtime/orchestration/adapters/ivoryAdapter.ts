import { composeOrchestrationTurn } from '../composition.js';
import { isTaskTypeAllowed } from '../registry.js';
import type {
  ComposeOrchestrationTurnInput,
  OrchestrationTurnCompositionResult,
} from '../types.js';

export type IvoryRuntimeAdapterInput = ComposeOrchestrationTurnInput;

export function isIvoryRuntimeTaskAllowed(
  taskType: IvoryRuntimeAdapterInput['taskType'],
): boolean {
  return isTaskTypeAllowed('ivory', taskType);
}

export async function runIvoryRuntimeAdapter(
  input: IvoryRuntimeAdapterInput,
): Promise<OrchestrationTurnCompositionResult> {
  const ivoryInput: ComposeOrchestrationTurnInput = {
    ...input,
    identity: {
      ...input.identity,
      agentKey: 'ivory',
    },
  };

  if (!isIvoryRuntimeTaskAllowed(input.taskType)) {
    return composeOrchestrationTurn(ivoryInput);
  }

  return composeOrchestrationTurn(ivoryInput);
}
