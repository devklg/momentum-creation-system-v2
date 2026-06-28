import type { RuntimeTaskType } from '@momentum/shared/runtime';
import type {
  MichaelResponseContextPacketStatus,
  MichaelResponseType,
  MichaelRuntimeResponseFixtureScenario,
  MichaelRuntimeResponseFixtureScenarioName,
  MichaelRuntimeResponseFixtureValidationStatus,
  MichaelRuntimeTurnOutcomeStatus,
  RuntimeTurnFixtureScenarioType,
} from '../types.js';
import type { MichaelResponseFixtureKey } from './michaelResponseFixtures.js';

type ScenarioInput = {
  readonly name: string;
  readonly scenarioName: MichaelRuntimeResponseFixtureScenarioName;
  readonly description: string;
  readonly expectedResponseType: MichaelResponseType;
  readonly expectedContextStatus: MichaelResponseContextPacketStatus;
  readonly expectedValidationStatus: MichaelRuntimeResponseFixtureValidationStatus;
  readonly runtimeTurnStatus: MichaelRuntimeTurnOutcomeStatus;
  readonly runtimeScenario: RuntimeTurnFixtureScenarioType;
  readonly agentKey: unknown;
  readonly taskType: RuntimeTaskType;
  readonly responseFixtureKey: MichaelResponseFixtureKey;
};

export type MichaelRuntimeResponseScenario =
  {
    metadata: MichaelRuntimeResponseScenarioMetadata;
    responseFixtureKey: MichaelResponseFixtureKey;
  };
export type MichaelRuntimeResponseScenarioName = string;
export type MichaelRuntimeResponseScenarioMetadata =
  MichaelRuntimeResponseFixtureScenario['metadata'] & {
    name: MichaelRuntimeResponseScenarioName;
  };
export type MichaelRuntimeTurnStatus = MichaelRuntimeTurnOutcomeStatus;

export const michaelRuntimeResponseScenarios = {
  completeTrainingSupport: scenario({
    name: 'complete_training_support_next_training_step',
    scenarioName: 'complete_training_support',
    description:
      'Complete Michael training_support runtime turn maps to next_training_step.',
    expectedResponseType: 'next_training_step',
    expectedContextStatus: 'complete',
    expectedValidationStatus: 'validated',
    runtimeTurnStatus: 'accepted',
    runtimeScenario: 'accepted_complete',
    agentKey: 'michael_magnificent',
    taskType: 'training_support',
    responseFixtureKey: 'nextTrainingStepEn',
  }),
  completeAmbiguousTrainingSupport: scenario({
    name: 'complete_ambiguous_request_clarification_question',
    scenarioName: 'complete_ambiguous_training_support',
    description:
      'Complete Michael ambiguous training request maps to clarification_question.',
    expectedResponseType: 'clarification_question',
    expectedContextStatus: 'complete',
    expectedValidationStatus: 'validated',
    runtimeTurnStatus: 'accepted',
    runtimeScenario: 'invalid_objective',
    agentKey: 'michael_magnificent',
    taskType: 'training_support',
    responseFixtureKey: 'clarificationQuestionEn',
  }),
  degradedContextPacket: scenario({
    name: 'degraded_context_packet_safe_fallback',
    scenarioName: 'degraded_context_packet',
    description: 'Degraded Context Packet maps to safe_fallback.',
    expectedResponseType: 'safe_fallback',
    expectedContextStatus: 'degraded',
    expectedValidationStatus: 'validated',
    runtimeTurnStatus: 'degraded',
    runtimeScenario: 'accepted_degraded',
    agentKey: 'michael_magnificent',
    taskType: 'training_support',
    responseFixtureKey: 'safeFallbackDegradedContextPacket',
  }),
  missingContextManagerBoundary: scenario({
    name: 'missing_context_manager_safe_fallback',
    scenarioName: 'missing_context_manager_boundary',
    description: 'Missing Context Manager boundary maps to safe_fallback.',
    expectedResponseType: 'safe_fallback',
    expectedContextStatus: 'missing',
    expectedValidationStatus: 'validated',
    runtimeTurnStatus: 'rejected',
    runtimeScenario: 'missing_context_manager',
    agentKey: 'michael_magnificent',
    taskType: 'training_support',
    responseFixtureKey: 'safeFallbackMissingContextPacket',
  }),
  failedContextPacket: scenario({
    name: 'failed_context_packet_safe_close',
    scenarioName: 'failed_context_packet',
    description: 'Failed Context Packet maps to safe_close.',
    expectedResponseType: 'safe_close',
    expectedContextStatus: 'failed',
    expectedValidationStatus: 'safe_close',
    runtimeTurnStatus: 'blocked',
    runtimeScenario: 'failed_context',
    agentKey: 'michael_magnificent',
    taskType: 'training_support',
    responseFixtureKey: 'safeCloseFailedContextPacket',
  }),
  rejectedContextPacket: scenario({
    name: 'rejected_context_packet_safe_close',
    scenarioName: 'rejected_context_packet',
    description: 'Rejected Context Packet maps to safe_close.',
    expectedResponseType: 'safe_close',
    expectedContextStatus: 'rejected',
    expectedValidationStatus: 'safe_close',
    runtimeTurnStatus: 'rejected',
    runtimeScenario: 'candidate_review_only_rejected',
    agentKey: 'michael_magnificent',
    taskType: 'training_support',
    responseFixtureKey: 'safeCloseCandidateReviewOnlyRejection',
  }),
  invalidObjective: scenario({
    name: 'invalid_objective_safe_close',
    scenarioName: 'invalid_objective',
    description: 'Invalid Michael objective maps to safe_close.',
    expectedResponseType: 'safe_close',
    expectedContextStatus: 'rejected',
    expectedValidationStatus: 'safe_close',
    runtimeTurnStatus: 'rejected',
    runtimeScenario: 'invalid_objective',
    agentKey: 'michael_magnificent',
    taskType: 'success_interview',
    responseFixtureKey: 'safeCloseCandidateReviewOnlyRejection',
  }),
  unknownAgent: scenario({
    name: 'unknown_agent_safe_close',
    scenarioName: 'unknown_agent',
    description: 'Unknown runtime agent maps to safe_close.',
    expectedResponseType: 'safe_close',
    expectedContextStatus: 'rejected',
    expectedValidationStatus: 'safe_close',
    runtimeTurnStatus: 'rejected',
    runtimeScenario: 'unknown_agent',
    agentKey: 'unknown_agent',
    taskType: 'training_support',
    responseFixtureKey: 'safeCloseCandidateReviewOnlyRejection',
  }),
  candidateReviewOnlyRejected: scenario({
    name: 'candidate_review_only_rejection_safe_close',
    scenarioName: 'candidate_review_only_rejected',
    description: 'Candidate/review-only rejection maps to safe_close.',
    expectedResponseType: 'safe_close',
    expectedContextStatus: 'rejected',
    expectedValidationStatus: 'safe_close',
    runtimeTurnStatus: 'rejected',
    runtimeScenario: 'candidate_review_only_rejected',
    agentKey: 'michael_magnificent',
    taskType: 'training_support',
    responseFixtureKey: 'safeCloseCandidateReviewOnlyRejection',
  }),
  unsupportedLanguage: scenario({
    name: 'unsupported_language_safe_close',
    scenarioName: 'unsupported_language',
    description: 'Unsupported language maps to safe_close.',
    expectedResponseType: 'safe_close',
    expectedContextStatus: 'rejected',
    expectedValidationStatus: 'safe_close',
    runtimeTurnStatus: 'rejected',
    runtimeScenario: 'accepted_complete',
    agentKey: 'michael_magnificent',
    taskType: 'success_interview',
    responseFixtureKey: 'safeCloseCandidateReviewOnlyRejection',
  }),
  wrongTaskType: scenario({
    name: 'wrong_task_type_safe_close',
    scenarioName: 'wrong_task_type',
    description: 'Wrong task type maps to safe_close.',
    expectedResponseType: 'safe_close',
    expectedContextStatus: 'rejected',
    expectedValidationStatus: 'safe_close',
    runtimeTurnStatus: 'rejected',
    runtimeScenario: 'invalid_objective',
    agentKey: 'michael_magnificent',
    taskType: 'success_interview',
    responseFixtureKey: 'safeCloseCandidateReviewOnlyRejection',
  }),
  nonMichaelAgent: scenario({
    name: 'non_michael_agent_safe_close',
    scenarioName: 'non_michael_agent',
    description: 'Non-Michael agent maps to safe_close.',
    expectedResponseType: 'safe_close',
    expectedContextStatus: 'rejected',
    expectedValidationStatus: 'safe_close',
    runtimeTurnStatus: 'rejected',
    runtimeScenario: 'invalid_objective',
    agentKey: 'steve_success',
    taskType: 'training_support',
    responseFixtureKey: 'safeCloseCandidateReviewOnlyRejection',
  }),
} as const satisfies Record<string, MichaelRuntimeResponseScenario>;

export type MichaelRuntimeResponseScenarioKey =
  keyof typeof michaelRuntimeResponseScenarios;

export const michaelRuntimeResponseScenarioEntries = Object.entries(
  michaelRuntimeResponseScenarios,
) as Array<
  [
    MichaelRuntimeResponseScenarioKey,
    (typeof michaelRuntimeResponseScenarios)[MichaelRuntimeResponseScenarioKey],
  ]
>;

export const michaelRuntimeResponseScenarioNames =
  michaelRuntimeResponseScenarioEntries.map(([, entry]) => entry.metadata.name);

export function getMichaelRuntimeResponseScenario(
  scenarioName: MichaelRuntimeResponseFixtureScenarioName | MichaelRuntimeResponseScenarioName,
): MichaelRuntimeResponseScenario {
  const match = michaelRuntimeResponseScenarioEntries.find(
    ([, entry]) =>
      entry.metadata.scenarioName === scenarioName || entry.metadata.name === scenarioName,
  );

  if (!match) {
    throw new Error(`Unknown Michael runtime response scenario: ${scenarioName}`);
  }

  return match[1];
}

function scenario(input: ScenarioInput): MichaelRuntimeResponseScenario {
  return {
    metadata: {
      name: input.name,
      scenarioName: input.scenarioName,
      description: input.description,
      expectedResponseType: input.expectedResponseType,
      expectedContextStatus: input.expectedContextStatus,
      expectedValidationStatus: input.expectedValidationStatus,
      runtimeTurnStatus: input.runtimeTurnStatus,
      runtimeScenario: input.runtimeScenario,
      agentKey: input.agentKey,
      taskType: input.taskType,
      fixtureOnly: true,
      ['persistence']: 'disabled',
      agentResponseGenerated: false,
    },
    responseFixtureKey: input.responseFixtureKey,
  };
}
