import { dispatchAgentRuntimeAdapter } from './adapters/dispatchAdapter.js';
import { isKnownAgentKey } from './registry.js';
import type {
  ContextPacketRequestIssue,
  RuntimeTurnCoordinatorInput,
  RuntimeTurnCoordinatorRejection,
  RuntimeTurnCoordinatorResult,
} from './types.js';

/**
 * S2.7 inert runtime turn coordinator.
 *
 * Validates the minimum preconditions for a runtime turn and delegates valid
 * input to the S2.6 adapter dispatch boundary. It does not mount routes,
 * assemble Context Packets, persist envelopes, or generate agent responses.
 */
export async function coordinateRuntimeTurn(
  input: RuntimeTurnCoordinatorInput,
): Promise<RuntimeTurnCoordinatorResult> {
  const issues = validateRuntimeTurnInput(input);

  if (issues.length > 0) {
    return rejectRuntimeTurn(input, issues);
  }

  const { identity, turnId, taskType, contextManager } = input;
  if (!identity || !turnId || !taskType || !contextManager) {
    return rejectRuntimeTurn(input, issues);
  }

  return dispatchAgentRuntimeAdapter({
    identity,
    turnId,
    taskType,
    contextManager,
    requireSubstantive: input.requireSubstantive,
    createdAt: input.createdAt,
  });
}

function validateRuntimeTurnInput(
  input: RuntimeTurnCoordinatorInput,
): ContextPacketRequestIssue[] {
  const issues: ContextPacketRequestIssue[] = [];

  if (!input.identity) {
    issues.push(
      runtimeTurnIssue(
        'identity',
        'missing_identity',
        'Runtime turn coordination requires an orchestration identity.',
      ),
    );
  }

  if (!input.turnId) {
    issues.push(
      runtimeTurnIssue(
        'turnId',
        'missing_turn_id',
        'Runtime turn coordination requires a turn ID.',
      ),
    );
  }

  if (!input.taskType) {
    issues.push(
      runtimeTurnIssue(
        'taskType',
        'missing_task_type',
        'Runtime turn coordination requires a task type.',
      ),
    );
  }

  if (!input.contextManager) {
    issues.push(
      runtimeTurnIssue(
        'contextManager',
        'missing_context_manager',
        'Runtime turn coordination requires the Context Manager request boundary.',
      ),
    );
  }

  if (input.identity && !isKnownAgentKey(input.identity.agentKey)) {
    issues.push(
      runtimeTurnIssue(
        'identity.agentKey',
        'invalid_agent',
        `Unknown orchestration agent: ${String(input.identity.agentKey)}.`,
      ),
    );
  }

  return issues;
}

function rejectRuntimeTurn(
  input: RuntimeTurnCoordinatorInput,
  issues: ContextPacketRequestIssue[],
): RuntimeTurnCoordinatorRejection {
  return {
    decision: 'reject',
    agentKey: input.identity?.agentKey,
    turnId: input.turnId,
    behavior: 'not_implemented',
    issues,
    events: [],
    outcomeDrafts: [],
    guidedActionDrafts: [],
    notes: [
      'Runtime turn coordinator rejected the turn before adapter dispatch.',
      'Agent behavior is not implemented in this slice; no agent output was generated.',
    ],
    eventPersistence: 'disabled',
    outcomePersistence: 'disabled',
    guidedActionPersistence: 'disabled',
    envelopePersistence: 'disabled',
    agentResponseGenerated: false,
  };
}

function runtimeTurnIssue(
  path: string,
  code: string,
  message: string,
): ContextPacketRequestIssue {
  return { path, code, message };
}
