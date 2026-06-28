export type {
  BackendRuntimeBoundaryDescriptor,
  BackendRuntimeBoundaryKey,
} from './common.js';

export {
  agentRuntimeBoundary,
} from './agents/agentRuntime.js';
export type {
  AgentRuntimeBoundaryPort,
} from './agents/agentRuntime.js';
export {
  browserVoiceTextRuntimeBoundary,
} from './browser/voiceTextRuntime.js';
export type {
  BrowserVoiceTextRuntimeBoundaryPort,
} from './browser/voiceTextRuntime.js';
export type {
  BrowserRuntimeEventEnvelope,
  BrowserRuntimeEventEnvelopeInput,
  BrowserVoiceTextFoundationPort,
  BrowserVoiceTextSafeFailure,
  BrowserVoiceTextSessionFoundation,
  BrowserVoiceTextValidationCode,
  BrowserVoiceTextValidationIssue,
  BrowserVoiceTextValidationResult,
} from './browser/index.js';
export {
  BROWSER_RUNTIME_AGENT_KEYS,
  BROWSER_RUNTIME_ALLOWED_SURFACE,
  BROWSER_RUNTIME_MODES,
  BROWSER_RUNTIME_SUPPORTED_LANGUAGES,
  BrowserVoiceTextValidationError,
  INTERNAL_BROWSER_RUNTIME_EVENT_SOURCES,
  MICROPHONE_PERMISSION_POLICY,
  TEXT_FALLBACK_REQUIRED,
  assertBrowserVoiceTextSessionFoundation,
  createBrowserRuntimeEventEnvelope,
  createBrowserTextFallbackTurn,
  finalizeBrowserVoiceTurn,
  speechLanguageMap,
  validateBrowserVoiceTextSessionFoundation,
} from './browser/index.js';
export {
  contextManagerBoundary,
} from './context/contextManager.js';
export type {
  ContextManagerBoundaryPort,
} from './context/contextManager.js';
export type {
  ContextPacketFoundationBoundary,
  ContextPacketFoundationRequest,
  ContextPacketValidationCode,
  ContextPacketValidationIssue,
  ContextPacketValidationResult,
} from './context/index.js';
export {
  CONTEXT_MANAGER_ASSEMBLER,
  CONTEXT_PACKET_AGENT_KEYS,
  CONTEXT_PACKET_SUPPORTED_LANGUAGES,
  CONTEXT_PACKET_V1_SCHEMA_VERSION,
  REQUIRED_CONTEXT_RUNTIME_RULE_IDS,
  TEAM_MAGNIFICENT_KEY,
  TEAM_MAGNIFICENT_NAME,
  ContextPacketValidationError,
  assertValidContextPacketV1,
  contextPacketFoundationBoundary,
  prepareContextPacketFoundation,
  validateContextPacketV1,
} from './context/index.js';
export {
  eventRuntimeBoundary,
} from './events/eventRuntime.js';
export type {
  EventRuntimeBoundaryPort,
} from './events/eventRuntime.js';
export {
  knowledgeCoreBoundary,
} from './knowledge/knowledgeCore.js';
export type {
  KnowledgeCoreBoundaryPort,
} from './knowledge/knowledgeCore.js';

import { agentRuntimeBoundary } from './agents/agentRuntime.js';
import { browserVoiceTextRuntimeBoundary } from './browser/voiceTextRuntime.js';
import { contextManagerBoundary } from './context/contextManager.js';
import { eventRuntimeBoundary } from './events/eventRuntime.js';
import { knowledgeCoreBoundary } from './knowledge/knowledgeCore.js';

export const backendRuntimeBoundaries = [
  knowledgeCoreBoundary,
  contextManagerBoundary,
  agentRuntimeBoundary,
  eventRuntimeBoundary,
  browserVoiceTextRuntimeBoundary,
] as const;

// S2.1 Agent Runtime Orchestration skeleton (additive, inert).
// Intentionally NOT added to backendRuntimeBoundaries above: that set is the
// S1.2 inert backend boundary contract pinned by runtimeBoundarySkeleton.test.
export {
  AGENT_ORCHESTRATION_REGISTRY,
  ORCHESTRATION_AGENT_KEYS,
  ORCHESTRATION_COMPONENT_VERSION,
  ORCHESTRATION_EMITTER,
  ORCHESTRATION_EVENT_SOURCE,
  MICHAEL_RESPONSE_AGENT_KEY,
  MICHAEL_RESPONSE_CONTRACT_SCHEMA_VERSION,
  MICHAEL_RESPONSE_CONTRACT_FORBIDDEN_FIELD_ALIASES,
  MICHAEL_RESPONSE_FORBIDDEN_FIELDS,
  MICHAEL_RESPONSE_TASK_TYPE,
  MICHAEL_RESPONSE_TYPES,
  MichaelResponseValidationError,
  assertMichaelResponseContractV1,
  assertValidMichaelResponseContract,
  agentOrchestrationBoundary,
  captureOrchestrationEvent,
  buildContextPacketRequest,
  composeOrchestrationTurn,
  consumeContextPacket,
  coordinateRuntimeTurn,
  createMichaelRuntimeResponseFixtureHarness,
  createRuntimeTurnFixtureHarness,
  createAgentSession,
  createEventCapture,
  dispatchAgentRuntimeAdapter,
  draftOutcomeGuidedActionEnvelopes,
  getAgentDescriptor,
  getMichaelRuntimeResponseScenario,
  idempotencyKeys,
  isIvoryRuntimeTaskAllowed,
  isKnownAgentKey,
  isMichaelResponseContractV1,
  isMichaelMagnificentObjectiveAllowed,
  isTaskTypeAllowed,
  listOrchestrationDescriptors,
  mapMichaelMagnificentIdentity,
  planAgentTurn,
  requestContextPacketForTurn,
  runMichaelRuntimeAdapterContract,
  runMichaelRuntimeResponseFixtureScenario,
  runRuntimeTurnFixtureScenario,
  michaelRuntimeResponseScenarioEntries,
  michaelRuntimeResponseScenarios,
  michaelResponseFixtureEntries,
  michaelResponseFixtureSafeCloseCandidateReviewOnlyRejectionEs,
  michaelResponseFixtureSafeCloseFailedContextPacketEs,
  michaelResponseFixtureSafeFallbackDegradedContextPacketEs,
  michaelResponseFixtureSafeFallbackMissingContextPacketEs,
  MICHAEL_RESPONSE_CATALOG,
  getMichaelResponseCatalogEntry,
  hasMichaelResponseCatalogEntry,
  listMichaelResponseCatalogEntries,
  listMichaelResponseCatalogKeys,
  validateMichaelResponseCatalog,
  runIvoryRuntimeAdapter,
  runMichaelMagnificentRuntimeAdapter,
  runSteveSuccessRuntimeAdapter,
  validateMichaelResponseContract,
  validateMichaelResponseContractV1,
} from './orchestration/index.js';
export type {
  AgentEventFamily,
  AgentOrchestrationBoundaryDescriptor,
  AgentOrchestrationDescriptor,
  AgentRuntimeAdapterDispatchIdentity,
  AgentRuntimeAdapterDispatchRejection,
  AgentRuntimeAdapterDispatchResult,
  BuildContextPacketRequestInput,
  ComposeOrchestrationTurnInput,
  ConsumeContextPacketInput,
  ContextPacketConsumptionDecision,
  ContextPacketConsumptionIssue,
  ContextPacketConsumptionResult,
  ContextPacketRequestBundle,
  ContextPacketRequestIssue,
  ContextPacketRequestWiringResult,
  ContextManagerRequestPort,
  CreateAgentSessionInput,
  CreateAgentSessionResult,
  DispatchAgentRuntimeAdapterInput,
  DraftOutcomeGuidedActionInput,
  EventCapture,
  IvoryRuntimeAdapterInput,
  MichaelMagnificentRuntimeAdapterInput,
  OrchestrationDraftContentScope,
  OrchestrationEventInput,
  OrchestrationGuidedActionDraftEnvelope,
  OrchestrationOutcomeDraftEnvelope,
  OutcomeGuidedActionDraftResult,
  OrchestrationSessionIdentity,
  OrchestrationSessionState,
  OrchestrationSessionStatus,
  OrchestrationTurnCompositionResult,
  OrchestrationTurnPlan,
  PlanAgentTurnInput,
  RequestContextPacketForTurnInput,
  RuntimeTurnCoordinatorInput,
  RuntimeTurnCoordinatorRejection,
  RuntimeTurnCoordinatorResult,
  RuntimeTurnFixtureHarness,
  RuntimeTurnFixtureHarnessResult,
  RuntimeTurnFixtureScenarioMetadata,
  RuntimeTurnFixtureScenarioOptions,
  RuntimeTurnFixtureScenarioType,
  MichaelRuntimeAdapterContractDecision,
  MichaelRuntimeAdapterContractInput,
  MichaelRuntimeAdapterContractIntent,
  MichaelRuntimeAdapterContractIssue,
  MichaelRuntimeAdapterContractResult,
  MichaelRuntimeAdapterRuntimeTurnSummary,
  MichaelRuntimeResponseFixtureHarness,
  MichaelRuntimeResponseFixtureHarnessResult,
  MichaelRuntimeResponseFixtureScenario,
  MichaelRuntimeResponseFixtureScenarioMetadata,
  MichaelRuntimeResponseFixtureScenarioName,
  MichaelRuntimeResponseFixtureScenarioOptions,
  MichaelRuntimeResponseFixtureValidationStatus,
  MichaelRuntimeTurnOutcomeStatus,
  MichaelResponseCatalogEntry,
  MichaelResponseCatalogValidationIssue,
  MichaelResponseCatalogValidationResult,
  MichaelResponseContractValidationIssue,
  MichaelResponseContractValidationResult,
  MichaelResponseContractV1,
  MichaelResponseContextPacketStatus,
  MichaelResponseNextStep,
  MichaelResponseSafety,
  MichaelResponseScenarioFamily,
  MichaelResponseType,
  MichaelResponseValidationIssue,
  MichaelResponseValidationResult,
  MichaelResponseValidationStatus,
  SteveSuccessRuntimeAdapterInput,
} from './orchestration/index.js';
