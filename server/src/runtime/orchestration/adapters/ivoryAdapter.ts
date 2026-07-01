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

  // Task-type admissibility is enforced downstream by composeOrchestrationTurn
  // (a disallowed objective composes to decision:'reject' with an
  // 'invalid_objective' issue — see ivoryAdapter.test.ts). The previous
  // `if (!isIvoryRuntimeTaskAllowed(...))` branch here was dead: both arms
  // returned the same composition. `isIvoryRuntimeTaskAllowed` remains exported
  // for callers that want to pre-check before dispatching.
  return composeOrchestrationTurn(ivoryInput);
}
