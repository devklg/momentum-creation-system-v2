import { runMichaelRuntimeAdapterContract } from './michaelRuntimeAdapterContract.js';
import { validateMichaelResponseCatalogSelection } from './michaelResponseCatalogSelector.js';
import type {
  DeriveMichaelSelectionRequestFromRuntimeTurnInput,
  MichaelCatalogSelectorIntent,
  MichaelResponseCatalogSelectionRequest,
  MichaelResponseSelectionRequestDerivationIssue,
  MichaelResponseSelectionRequestDerivationResult,
  MichaelRuntimeAdapterContractInput,
} from './types.js';

const MICHAEL_AGENT_KEY = 'michael_magnificent' as const;
const MICHAEL_TASK_TYPE = 'training_support' as const;

/** Intent that accompanies each complete-family response type. */
const INTENT_FOR_COMPLETE_RESPONSE_TYPE: Readonly<Record<string, MichaelCatalogSelectorIntent>> = {
  next_training_step: 'clear_training_support',
  clarification_question: 'ambiguous_training_support',
};

function issue(
  code: MichaelResponseSelectionRequestDerivationIssue['code'],
  message: string,
): MichaelResponseSelectionRequestDerivationIssue {
  return { code, message };
}

/**
 * Derive a catalog-selection request from a Michael adapter-contract input.
 *
 * The derivation reuses the inert adapter classification: it runs the
 * already-inert `runMichaelRuntimeAdapterContract` (no persistence, no text
 * generation, agentResponseGenerated stays false) and reads only the resolved
 * response metadata (responseType, contextPacketStatus, language) to build the
 * request. This guarantees the request side and the response side can never
 * diverge. It generates no text and mutates nothing.
 */
export function deriveMichaelResponseCatalogSelectionRequestFromAdapterContractInput(
  input: MichaelRuntimeAdapterContractInput,
): MichaelResponseSelectionRequestDerivationResult {
  const result = runMichaelRuntimeAdapterContract(input);
  const response = result.michaelResponse;

  const scenarioFamily = response.contextPacketStatus;
  const responseType = response.responseType;
  const language = response.language;

  const selectionRequest: MichaelResponseCatalogSelectionRequest = {
    agentKey: MICHAEL_AGENT_KEY,
    taskType: MICHAEL_TASK_TYPE,
    language,
    responseType,
    scenarioFamily,
    contextPacketStatus: scenarioFamily,
    ...(scenarioFamily === 'complete'
      ? { intent: INTENT_FOR_COMPLETE_RESPONSE_TYPE[responseType] }
      : {}),
  };

  // Defensive: the derived request must resolve through the S2.18 selector.
  // The inert adapter only ever yields one of the six valid catalog
  // combinations, so this never fails in practice — but we never assume.
  const validation = validateMichaelResponseCatalogSelection(selectionRequest);
  if (!validation.ok) {
    return {
      ok: false,
      issues: [
        issue(
          'selection_invalid',
          `Derived selection request did not resolve to a catalog entry: ${validation.issues
            .map((selectionIssue) => selectionIssue.code)
            .join(', ')}.`,
        ),
      ],
    };
  }

  return { ok: true, selectionRequest };
}

/**
 * Derive a catalog-selection request from a runtime turn fixture result.
 *
 * Identity / turnId / taskType default to the runtime turn's own input when not
 * overridden. Returns a deterministic rejected result (never throws) when the
 * runtime turn lacks the identity / turnId / taskType needed to classify it.
 * Never mutates the runtime turn.
 */
export function deriveMichaelResponseCatalogSelectionRequestFromRuntimeTurn(
  args: DeriveMichaelSelectionRequestFromRuntimeTurnInput,
): MichaelResponseSelectionRequestDerivationResult {
  const { runtimeTurn } = args;
  const identity = args.identity ?? runtimeTurn.input.identity;
  const turnId = args.turnId ?? runtimeTurn.input.turnId;
  const taskType = args.taskType ?? runtimeTurn.input.taskType;

  if (!identity) {
    return {
      ok: false,
      issues: [issue('missing_identity', 'Runtime turn has no identity to derive from.')],
    };
  }

  if (!turnId) {
    return {
      ok: false,
      issues: [issue('missing_turn_id', 'Runtime turn has no turnId to derive from.')],
    };
  }

  if (!taskType) {
    return {
      ok: false,
      issues: [issue('missing_task_type', 'Runtime turn has no taskType to derive from.')],
    };
  }

  const adapterInput: MichaelRuntimeAdapterContractInput = {
    identity,
    turnId,
    taskType,
    runtimeTurn,
    ...(args.turnClarity ? { turnClarity: args.turnClarity } : {}),
    ...(args.intent ? { intent: args.intent } : {}),
    ...(args.language !== undefined ? { language: args.language } : {}),
  };

  return deriveMichaelResponseCatalogSelectionRequestFromAdapterContractInput(adapterInput);
}

/**
 * Primary entry point: derive a catalog-selection request from a Michael
 * adapter-contract input. Alias of the adapter-contract-input derivation.
 */
export function deriveMichaelResponseCatalogSelectionRequest(
  input: MichaelRuntimeAdapterContractInput,
): MichaelResponseSelectionRequestDerivationResult {
  return deriveMichaelResponseCatalogSelectionRequestFromAdapterContractInput(input);
}
