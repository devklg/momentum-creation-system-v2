import { validateMichaelResponseContract } from './michaelResponseContract.js';
import type {
  ContextPacketConsumptionResult,
  ContextPacketRequestIssue,
  MichaelResponseContextPacketStatus,
  MichaelResponseContractV1,
  MichaelResponseContractValidationResult,
  MichaelRuntimeAdapterContractInput,
  MichaelRuntimeAdapterContractIssue,
  MichaelRuntimeAdapterContractResult,
  MichaelRuntimeAdapterRuntimeTurnSummary,
  RuntimeTurnCoordinatorResult,
} from './types.js';
import {
  michaelResponseFixtureClarificationQuestionEn,
  michaelResponseFixtureClarificationQuestionEs,
  michaelResponseFixtureNextTrainingStepEn,
  michaelResponseFixtureNextTrainingStepEs,
  michaelResponseFixtureSafeCloseCandidateReviewOnlyRejection,
  michaelResponseFixtureSafeCloseFailedContextPacket,
  michaelResponseFixtureSafeFallbackDegradedContextPacket,
  michaelResponseFixtureSafeFallbackMissingContextPacket,
} from './fixtures/index.js';

const MICHAEL_AGENT_KEY = 'michael_magnificent' as const;
const MICHAEL_TASK_TYPE = 'training_support' as const;
const SUPPORTED_LANGUAGES = ['en', 'es'] as const;

type SupportedMichaelLanguage = (typeof SUPPORTED_LANGUAGES)[number];
type ValidatedMichaelResponse = Extract<
  MichaelResponseContractValidationResult,
  { ok: true }
>;

type ResolvedRuntimeTurn = RuntimeTurnCoordinatorResult & {
  readonly consumption?: ContextPacketConsumptionResult;
};

type SelectionReason =
  | 'complete_clear_context'
  | 'complete_ambiguous_context'
  | 'degraded_context'
  | 'missing_context'
  | 'failed_context'
  | 'rejected_context'
  | 'wrong_agent'
  | 'wrong_task'
  | 'unsupported_language'
  | 'non_context_manager'
  | 'candidate_review_only'
  | 'invalid_runtime_turn';

export function runMichaelRuntimeAdapterContract(
  input: MichaelRuntimeAdapterContractInput,
): MichaelRuntimeAdapterContractResult {
  const runtimeTurn = input.runtimeTurn.result as ResolvedRuntimeTurn;
  const language = resolveLanguage(input);
  const identity = input.identity;

  if (identity.agentKey !== MICHAEL_AGENT_KEY) {
    return selectResponse(input, 'wrong_agent', 'safe_close', 'rejected');
  }

  if (input.taskType !== MICHAEL_TASK_TYPE) {
    return selectResponse(input, 'wrong_task', 'safe_close', 'rejected');
  }

  if (!language) {
    return selectResponse(input, 'unsupported_language', 'safe_close', 'rejected');
  }

  const inertIssue = findInertRuntimeIssue(runtimeTurn, input);
  if (inertIssue) {
    return selectResponse(input, inertIssue, 'safe_close', 'rejected');
  }

  const issueReason = reasonFromIssueCodes(collectIssueCodes(runtimeTurn));
  if (issueReason) {
    const responseKind = issueReason === 'missing_context' ? 'safe_fallback' : 'safe_close';
    const contextKind = issueReason === 'missing_context' ? 'missing' : 'rejected';
    return selectResponse(input, issueReason, responseKind, contextKind);
  }

  const consumption = runtimeTurn.consumption;
  if (!consumption) {
    return selectResponse(input, 'invalid_runtime_turn', 'safe_close', 'rejected');
  }

  if (consumption.packetAgentKey && consumption.packetAgentKey !== MICHAEL_AGENT_KEY) {
    return selectResponse(input, 'wrong_agent', 'safe_close', 'rejected');
  }

  if (consumption.taskType && consumption.taskType !== MICHAEL_TASK_TYPE) {
    return selectResponse(input, 'wrong_task', 'safe_close', 'rejected');
  }

  if (
    (consumption.decision === 'proceed' || consumption.decision === 'degraded') &&
    !hasContextManagerAssemblyMarker(consumption)
  ) {
    return selectResponse(input, 'non_context_manager', 'safe_close', 'rejected');
  }

  if (hasCandidateReviewOnlyContext(consumption)) {
    return selectResponse(input, 'candidate_review_only', 'safe_close', 'rejected');
  }

  if (consumption.decision === 'degraded' || consumption.packetStatus === 'degraded') {
    return selectResponse(input, 'degraded_context', 'safe_fallback', 'degraded');
  }

  if (consumption.decision === 'block_substantive' || consumption.packetStatus === 'failed') {
    return selectResponse(input, 'failed_context', 'safe_close', 'failed');
  }

  if (consumption.decision === 'reject') {
    return selectResponse(input, 'rejected_context', 'safe_close', 'rejected');
  }

  if (consumption.packetStatus !== 'complete') {
    return selectResponse(input, 'invalid_runtime_turn', 'safe_close', 'rejected');
  }

  if (
    input.turnClarity === 'ambiguous' ||
    input.intent === 'ambiguous_training_support'
  ) {
    return selectResponse(
      input,
      'complete_ambiguous_context',
      'clarification_question',
      'complete',
      language,
    );
  }

  return selectResponse(
    input,
    'complete_clear_context',
    'next_training_step',
    'complete',
    language,
  );
}

function resolveLanguage(
  input: MichaelRuntimeAdapterContractInput,
): SupportedMichaelLanguage | undefined {
  const candidate = input.language ?? input.identity.language;
  return SUPPORTED_LANGUAGES.includes(candidate as SupportedMichaelLanguage)
    ? (candidate as SupportedMichaelLanguage)
    : undefined;
}

function findInertRuntimeIssue(
  runtimeTurn: ResolvedRuntimeTurn,
  input: MichaelRuntimeAdapterContractInput,
): SelectionReason | undefined {
  if (
    runtimeTurn.agentResponseGenerated !== false ||
    runtimeTurn.eventPersistence !== 'disabled' ||
    runtimeTurn.outcomePersistence !== 'disabled' ||
    runtimeTurn.guidedActionPersistence !== 'disabled' ||
    runtimeTurn.envelopePersistence !== 'disabled'
  ) {
    return 'invalid_runtime_turn';
  }

  if (
    input.runtimeTurn.agentResponseGenerated !== false ||
    input.runtimeTurn.eventPersistence !== 'disabled' ||
    input.runtimeTurn.outcomePersistence !== 'disabled' ||
    input.runtimeTurn.guidedActionPersistence !== 'disabled' ||
    input.runtimeTurn.envelopePersistence !== 'disabled'
  ) {
    return 'invalid_runtime_turn';
  }

  if (
    'events' in runtimeTurn &&
    runtimeTurn.events.length > 0 &&
    runtimeTurn.eventPersistence !== 'disabled'
  ) {
    return 'invalid_runtime_turn';
  }

  return undefined;
}

function collectIssueCodes(runtimeTurn: ResolvedRuntimeTurn): string[] {
  const issues: ContextPacketRequestIssue[] = [];

  if ('issues' in runtimeTurn) {
    issues.push(...runtimeTurn.issues);
  }

  if ('contextRequestResult' in runtimeTurn) {
    issues.push(...runtimeTurn.contextRequestResult.issues);
    issues.push(...runtimeTurn.contextRequestResult.consumption.issues);
  }

  if (runtimeTurn.consumption) {
    issues.push(...runtimeTurn.consumption.issues);
  }

  return issues.map((issue) => issue.code);
}

function reasonFromIssueCodes(
  issueCodes: readonly string[],
): SelectionReason | undefined {
  if (issueCodes.some((code) => code === 'missing_context_manager' || code === 'missing_context_packet')) {
    return 'missing_context';
  }

  if (
    issueCodes.some((code) =>
      [
        'context_manager_required',
        'assembler_not_context_manager',
        'context_manager_request_failed',
      ].includes(code),
    )
  ) {
    return 'non_context_manager';
  }

  if (
    issueCodes.some((code) =>
      [
        'candidate_knowledge_not_excluded',
        'candidate_included_forbidden',
        'candidate_exclusion_required',
        'candidate_review_only_context_rejected',
      ].includes(code),
    )
  ) {
    return 'candidate_review_only';
  }

  if (issueCodes.some((code) => code === 'invalid_agent' || code === 'agent_mismatch')) {
    return 'wrong_agent';
  }

  if (issueCodes.some((code) => code === 'invalid_objective' || code === 'objective_not_allowed')) {
    return 'wrong_task';
  }

  if (issueCodes.some((code) => code === 'language_not_supported')) {
    return 'unsupported_language';
  }

  return undefined;
}

function hasContextManagerAssemblyMarker(
  consumption: ContextPacketConsumptionResult,
): boolean {
  return consumption.packet?.metadata?.generatedBy === 'context_manager';
}

function hasCandidateReviewOnlyContext(
  consumption: ContextPacketConsumptionResult,
): boolean {
  if (!consumption.packet) return false;

  return (
    consumption.packet?.retrievalAudit?.candidateKnowledgeIncluded !== false ||
    consumption.packet?.retrievalAudit?.candidateKnowledgeExcluded !== true
  );
}

function selectResponse(
  input: MichaelRuntimeAdapterContractInput,
  selectionReason: SelectionReason,
  responseKind:
    | 'next_training_step'
    | 'clarification_question'
    | 'safe_fallback'
    | 'safe_close',
  contextKind: 'complete' | 'degraded' | 'failed' | 'missing' | 'rejected',
  language: SupportedMichaelLanguage = 'en',
): MichaelRuntimeAdapterContractResult {
  const fixture = fixtureFor(responseKind, contextKind, language);
  const validation = validateFixture(fixture);
  const responseType = validation.contract.responseType;
  const decision =
    responseType === 'safe_close'
      ? 'safe_close'
      : responseType === 'safe_fallback'
        ? 'safe_fallback'
        : 'accepted';

  return {
    decision,
    agentKey: MICHAEL_AGENT_KEY,
    taskType: MICHAEL_TASK_TYPE,
    turnId: input.turnId,
    selectionReason,
    blockedReasonCodes: issuesFor(selectionReason).map((issue) => issue.code),
    runtimeTurnStatus: runtimeStatusFor(selectionReason),
    responseType,
    runtimeTurn: summarizeRuntimeTurn(input, contextKind),
    michaelResponse: validation.contract,
    validation,
    issues: issuesFor(selectionReason),
    selectedFixtureKey: fixtureKeyFor(responseKind, contextKind, language),
    eventPersistence: 'disabled',
    outcomePersistence: 'disabled',
    guidedActionPersistence: 'disabled',
    envelopePersistence: 'disabled',
    responsePersistence: 'disabled',
    sessionPersistence: 'disabled',
    transcriptPersistence: 'disabled',
    behavior: 'not_implemented',
    agentResponseGenerated: false,
  };
}

function issuesFor(selectionReason: SelectionReason): MichaelRuntimeAdapterContractIssue[] {
  const nonBlocking: readonly SelectionReason[] = [
    'complete_clear_context',
    'complete_ambiguous_context',
    'degraded_context',
    'missing_context',
  ];

  if (nonBlocking.includes(selectionReason)) return [];

  return [
    {
      path: 'michaelRuntimeAdapterContract',
      code: selectionReason,
      message: 'Michael adapter contract selected a safe non-substantive response.',
    },
  ];
}

function summarizeRuntimeTurn(
  input: MichaelRuntimeAdapterContractInput,
  contextKind: MichaelResponseContextPacketStatus,
): MichaelRuntimeAdapterRuntimeTurnSummary {
  const result = input.runtimeTurn.result as ResolvedRuntimeTurn;
  const consumption = result.consumption;

  return {
    scenario: input.runtimeTurn.scenario,
    decision: result.decision,
    agentKey: input.runtimeTurn.input.identity?.agentKey,
    taskType: input.runtimeTurn.input.taskType,
    packetStatus: consumption?.packetStatus ?? contextKind,
    contextManagerInjected: input.runtimeTurn.metadata.contextManagerInjected,
  };
}

function fixtureFor(
  responseKind:
    | 'next_training_step'
    | 'clarification_question'
    | 'safe_fallback'
    | 'safe_close',
  contextKind: 'complete' | 'degraded' | 'failed' | 'missing' | 'rejected',
  language: SupportedMichaelLanguage,
): MichaelResponseContractV1 {
  if (responseKind === 'next_training_step') {
    return language === 'es'
      ? michaelResponseFixtureNextTrainingStepEs
      : michaelResponseFixtureNextTrainingStepEn;
  }

  if (responseKind === 'clarification_question') {
    return language === 'es'
      ? michaelResponseFixtureClarificationQuestionEs
      : michaelResponseFixtureClarificationQuestionEn;
  }

  if (responseKind === 'safe_fallback') {
    return contextKind === 'degraded'
      ? michaelResponseFixtureSafeFallbackDegradedContextPacket
      : michaelResponseFixtureSafeFallbackMissingContextPacket;
  }

  return contextKind === 'failed'
    ? michaelResponseFixtureSafeCloseFailedContextPacket
    : michaelResponseFixtureSafeCloseCandidateReviewOnlyRejection;
}

function fixtureKeyFor(
  responseKind:
    | 'next_training_step'
    | 'clarification_question'
    | 'safe_fallback'
    | 'safe_close',
  contextKind: 'complete' | 'degraded' | 'failed' | 'missing' | 'rejected',
  language: SupportedMichaelLanguage,
): string {
  if (responseKind === 'next_training_step') {
    return language === 'es' ? 'nextTrainingStepEs' : 'nextTrainingStepEn';
  }

  if (responseKind === 'clarification_question') {
    return language === 'es' ? 'clarificationQuestionEs' : 'clarificationQuestionEn';
  }

  if (responseKind === 'safe_fallback') {
    return contextKind === 'degraded'
      ? 'safeFallbackDegradedContextPacket'
      : 'safeFallbackMissingContextPacket';
  }

  return contextKind === 'failed'
    ? 'safeCloseFailedContextPacket'
    : 'safeCloseCandidateReviewOnlyRejection';
}

function validateFixture(fixture: MichaelResponseContractV1): ValidatedMichaelResponse {
  const validation = validateMichaelResponseContract(fixture);
  if (!validation.ok) {
    throw new Error('Controlled Michael response fixture failed contract validation.');
  }

  return validation;
}

function runtimeStatusFor(reason: SelectionReason) {
  if (reason === 'complete_clear_context' || reason === 'complete_ambiguous_context') {
    return 'accepted';
  }

  if (reason === 'degraded_context' || reason === 'missing_context') {
    return 'degraded';
  }

  if (reason === 'failed_context') {
    return 'blocked';
  }

  return 'rejected';
}
