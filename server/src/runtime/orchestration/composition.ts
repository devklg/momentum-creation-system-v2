import { requestContextPacketForTurn } from './contextRequest.js';
import { draftOutcomeGuidedActionEnvelopes } from './outcomeGuidedAction.js';
import type {
  ComposeOrchestrationTurnInput,
  OrchestrationTurnCompositionResult,
} from './types.js';

/**
 * S2.4 inert orchestration composition.
 *
 * Combines S2.2 Context Manager request wiring with S2.3 returned-only
 * Outcome / Guided Action draft envelopes. It does not mount routes, persist
 * records, generate agent responses, or invoke agent behavior.
 */
export async function composeOrchestrationTurn(
  input: ComposeOrchestrationTurnInput,
): Promise<OrchestrationTurnCompositionResult> {
  const contextRequestResult = await requestContextPacketForTurn({
    identity: input.identity,
    turnId: input.turnId,
    taskType: input.taskType,
    contextManager: input.contextManager,
    requireSubstantive: input.requireSubstantive,
  });

  const outcomeGuidedActionResult = draftOutcomeGuidedActionEnvelopes({
    identity: input.identity,
    turnId: input.turnId,
    consumption: contextRequestResult.consumption,
    createdAt: input.createdAt,
  });

  return {
    decision: contextRequestResult.decision,
    agentKey: input.identity.agentKey,
    turnId: input.turnId,
    behavior: 'not_implemented',
    contextRequestResult,
    outcomeGuidedActionResult,
    consumption: contextRequestResult.consumption,
    events: [...contextRequestResult.events],
    outcomeDrafts: [...outcomeGuidedActionResult.outcomeDrafts],
    guidedActionDrafts: [...outcomeGuidedActionResult.guidedActionDrafts],
    notes: [
      ...contextRequestResult.notes,
      ...outcomeGuidedActionResult.notes,
      'S2.4 composition returned inert orchestration artifacts only.',
    ],
    eventPersistence: 'disabled',
    outcomePersistence: 'disabled',
    guidedActionPersistence: 'disabled',
    envelopePersistence: 'disabled',
    agentResponseGenerated: false,
  };
}
