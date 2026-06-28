import type {
  AgentAllowedOutput,
  AgentKey,
  BaId,
  ContextPacketRequest,
  ContextPacketV1,
  CorrelationId,
  GuidedActionId,
  OutcomeId,
  RequestId,
  RuntimeOutcomeReference,
  RuntimeRequestScope,
  RuntimeLanguage,
  RuntimeMode,
  RuntimeTaskType,
  RuntimeTurnId,
  SessionId,
} from '@momentum/shared/runtime';
import type { BaRuntimeScope } from '@momentum/shared/runtime';
import type { RuntimeAgentEventEnvelope } from '../events/index.js';

/**
 * S2.1 Agent Runtime Orchestration skeleton - shared types.
 *
 * This module is INERT. It defines registry descriptors, Context Packet
 * consumption decisions, and non-persistent event-capture shapes. It does NOT
 * implement Steve, Michael, or Ivory behavior, mount routes, or persist
 * anything. All agent behavior fields are explicitly marked not-implemented.
 */

/** Common orchestration session lifecycle (planning S2.4 section 5). */
export type OrchestrationSessionStatus =
  | 'not_started'
  | 'created'
  | 'context_requested'
  | 'context_ready'
  | 'active'
  | 'waiting_for_ba'
  | 'guided_action_pending'
  | 'paused'
  | 'completed'
  | 'cancelled'
  | 'failed';

/** Descriptive event-family label per agent (not a runtime event prefix). */
export type AgentEventFamily = 'steve' | 'michael' | 'ivory';

/**
 * Inert agent registry descriptor.
 *
 * Metadata only: it declares what an agent is *allowed* to do once behavior is
 * implemented in a later slice. It contains no behavior, prompts, or templates.
 */
export interface AgentOrchestrationDescriptor {
  agentKey: AgentKey;
  displayName: string;
  primaryDomain: 'success' | 'training' | 'relationship';
  roleSummary: string;
  /** Objectives, expressed as the validated packet `session.taskType`. */
  allowedTaskTypes: readonly RuntimeTaskType[];
  supportedModes: readonly RuntimeMode[];
  supportedLanguages: readonly RuntimeLanguage[];
  guardrailSet: readonly string[];
  requiresContextPacket: true;
  allowedOutputs: readonly AgentAllowedOutput[];
  forbiddenOutputs: readonly string[];
  eventFamily: AgentEventFamily;
  guidedActionCategories: readonly string[];
  outcomeCategories: readonly string[];
  /** Behavior is intentionally not implemented in this slice. */
  behaviorImplemented: false;
}

/** Result of a Context Packet consumption decision. */
export type ContextPacketConsumptionDecision =
  | 'proceed'
  | 'degraded'
  | 'block_substantive'
  | 'reject';

export interface ContextPacketConsumptionIssue {
  path: string;
  code: string;
  message: string;
}

export interface ConsumeContextPacketInput {
  /** The agent the orchestrator believes it is running this turn for. */
  expectedAgentKey: AgentKey;
  /** The unknown/untrusted packet returned by the Context Manager. */
  packet: unknown;
  /**
   * When false, the caller only needs structural/boundary validity and a
   * degraded packet is acceptable for limited guidance. When true (default),
   * failed packets block substantive guidance.
   */
  requireSubstantive?: boolean;
}

export interface ContextPacketConsumptionResult {
  decision: ContextPacketConsumptionDecision;
  expectedAgentKey: AgentKey;
  packetAgentKey?: AgentKey;
  taskType?: RuntimeTaskType;
  packetStatus?: ContextPacketV1['packetStatus'];
  /** Safe to pass to the agent only when decision is proceed or degraded. */
  packet?: ContextPacketV1;
  issues: ContextPacketConsumptionIssue[];
}

/** Identity carried through every orchestration session and turn. */
export interface OrchestrationSessionIdentity {
  scope: BaRuntimeScope;
  sessionId: SessionId;
  agentKey: AgentKey;
  mode: RuntimeMode;
  language: RuntimeLanguage;
  correlationId: CorrelationId;
  requestId?: RequestId;
}

export interface OrchestrationSessionState extends OrchestrationSessionIdentity {
  status: OrchestrationSessionStatus;
  createdAt: string;
}

export interface CreateAgentSessionInput extends OrchestrationSessionIdentity {
  resume?: boolean;
  createdAt?: string;
}

export interface PlanAgentTurnInput {
  identity: OrchestrationSessionIdentity;
  turnId: RuntimeTurnId;
  /** Untrusted packet returned by the Context Manager for this turn. */
  packet: unknown;
  requireSubstantive?: boolean;
}

/**
 * Narrow Context Manager boundary used by S2.2 request wiring.
 *
 * The orchestrator depends on this injected port only. It does not assemble
 * packets, retrieve knowledge, or import Context Manager builder internals.
 */
export interface ContextManagerRequestPort {
  readonly assembledBy: 'context_manager';
  requestContextPacket(
    scope: RuntimeRequestScope,
    request: ContextPacketRequest,
  ): Promise<unknown>;
}

export interface BuildContextPacketRequestInput {
  identity: OrchestrationSessionIdentity;
  turnId: RuntimeTurnId;
  taskType: RuntimeTaskType;
}

export interface ContextPacketRequestBundle {
  scope: RuntimeRequestScope;
  request: ContextPacketRequest;
}

export interface RequestContextPacketForTurnInput extends BuildContextPacketRequestInput {
  contextManager: ContextManagerRequestPort;
  requireSubstantive?: boolean;
}

export interface ContextPacketRequestIssue {
  path: string;
  code: string;
  message: string;
}

export interface ContextPacketRequestWiringResult {
  decision: ContextPacketConsumptionDecision;
  agentKey: AgentKey;
  behavior: 'not_implemented';
  request: ContextPacketRequest;
  scope: RuntimeRequestScope;
  response?: unknown;
  consumption: ContextPacketConsumptionResult;
  events: RuntimeAgentEventEnvelope[];
  issues: ContextPacketRequestIssue[];
  notes: readonly string[];
  /** Explicitly documents S2.2 event behavior: returned only, never persisted. */
  eventPersistence: 'disabled';
}

export type OrchestrationDraftContentScope = 'substantive' | 'limited';

export interface OrchestrationOutcomeDraftEnvelope extends RuntimeOutcomeReference {
  schemaVersion: 'orchestration_outcome_draft.v1';
  envelopeKind: 'outcome_draft';
  turnId: RuntimeTurnId;
  category: string;
  contentScope: OrchestrationDraftContentScope;
  summary: string;
  draftStatus: 'draft_only';
  source: 'agent_runtime_orchestrator';
  persistence: 'disabled';
  agentResponseGenerated: false;
}

export interface OrchestrationGuidedActionDraftEnvelope extends BaRuntimeScope {
  schemaVersion: 'orchestration_guided_action_draft.v1';
  envelopeKind: 'guided_action_draft';
  guidedActionId: GuidedActionId;
  sessionId: SessionId;
  agentKey: AgentKey;
  taskType: RuntimeTaskType;
  language: RuntimeLanguage;
  contextPacketId?: ContextPacketV1['packetId'];
  turnId: RuntimeTurnId;
  category: string;
  title: string;
  instruction: string;
  contentScope: OrchestrationDraftContentScope;
  draftStatus: 'draft_only';
  actionOwner: 'brand_ambassador';
  requiresBaApproval: true;
  automaticSending: false;
  automaticCalling: false;
  persistence: 'disabled';
  agentResponseGenerated: false;
  createdAt: string;
}

export interface DraftOutcomeGuidedActionInput {
  identity: OrchestrationSessionIdentity;
  turnId: RuntimeTurnId;
  consumption: ContextPacketConsumptionResult;
  createdAt?: string;
}

export interface OutcomeGuidedActionDraftResult {
  decision: ContextPacketConsumptionDecision;
  agentKey: AgentKey;
  behavior: 'not_implemented';
  outcomeDrafts: OrchestrationOutcomeDraftEnvelope[];
  guidedActionDrafts: OrchestrationGuidedActionDraftEnvelope[];
  notes: readonly string[];
  envelopePersistence: 'disabled';
  agentResponseGenerated: false;
}

export interface ComposeOrchestrationTurnInput extends BuildContextPacketRequestInput {
  contextManager: ContextManagerRequestPort;
  requireSubstantive?: boolean;
  createdAt?: string;
}

export interface OrchestrationTurnCompositionResult {
  decision: ContextPacketConsumptionDecision;
  agentKey: AgentKey;
  turnId: RuntimeTurnId;
  behavior: 'not_implemented';
  contextRequestResult: ContextPacketRequestWiringResult;
  outcomeGuidedActionResult: OutcomeGuidedActionDraftResult;
  consumption: ContextPacketConsumptionResult;
  events: RuntimeAgentEventEnvelope[];
  outcomeDrafts: OrchestrationOutcomeDraftEnvelope[];
  guidedActionDrafts: OrchestrationGuidedActionDraftEnvelope[];
  notes: readonly string[];
  eventPersistence: 'disabled';
  outcomePersistence: 'disabled';
  guidedActionPersistence: 'disabled';
  envelopePersistence: 'disabled';
  agentResponseGenerated: false;
}

export interface AgentRuntimeAdapterDispatchIdentity
  extends Omit<OrchestrationSessionIdentity, 'agentKey'> {
  agentKey: unknown;
}

export interface DispatchAgentRuntimeAdapterInput
  extends Omit<ComposeOrchestrationTurnInput, 'identity'> {
  identity: AgentRuntimeAdapterDispatchIdentity;
}

export interface AgentRuntimeAdapterDispatchRejection {
  decision: 'reject';
  agentKey: unknown;
  turnId: RuntimeTurnId;
  behavior: 'not_implemented';
  issues: ContextPacketRequestIssue[];
  events: [];
  outcomeDrafts: [];
  guidedActionDrafts: [];
  notes: readonly string[];
  eventPersistence: 'disabled';
  outcomePersistence: 'disabled';
  guidedActionPersistence: 'disabled';
  envelopePersistence: 'disabled';
  agentResponseGenerated: false;
}

export type AgentRuntimeAdapterDispatchResult =
  | OrchestrationTurnCompositionResult
  | AgentRuntimeAdapterDispatchRejection;

export interface RuntimeTurnCoordinatorInput {
  identity?: AgentRuntimeAdapterDispatchIdentity;
  turnId?: RuntimeTurnId;
  taskType?: RuntimeTaskType;
  contextManager?: ContextManagerRequestPort;
  requireSubstantive?: boolean;
  createdAt?: string;
}

export interface RuntimeTurnCoordinatorRejection {
  decision: 'reject';
  agentKey: unknown;
  turnId?: RuntimeTurnId;
  behavior: 'not_implemented';
  issues: ContextPacketRequestIssue[];
  events: [];
  outcomeDrafts: [];
  guidedActionDrafts: [];
  notes: readonly string[];
  eventPersistence: 'disabled';
  outcomePersistence: 'disabled';
  guidedActionPersistence: 'disabled';
  envelopePersistence: 'disabled';
  agentResponseGenerated: false;
}

export type RuntimeTurnCoordinatorResult =
  | AgentRuntimeAdapterDispatchResult
  | RuntimeTurnCoordinatorRejection;

export type RuntimeTurnFixtureScenarioType =
  | 'accepted_complete'
  | 'accepted_degraded'
  | 'failed_context'
  | 'invalid_objective'
  | 'unknown_agent'
  | 'missing_identity'
  | 'missing_turn_id'
  | 'missing_task_type'
  | 'missing_context_manager'
  | 'candidate_review_only_rejected';

export interface RuntimeTurnFixtureScenarioOptions {
  scenario: RuntimeTurnFixtureScenarioType;
  agentKey?: unknown;
  taskType?: RuntimeTaskType;
  requireSubstantive?: boolean;
  createdAt?: string;
}

export interface RuntimeTurnFixtureScenarioMetadata {
  scenario: RuntimeTurnFixtureScenarioType;
  description: string;
  fixtureOnly: true;
  contextManagerInjected: boolean;
  expectedContextRequest: boolean;
  expectedDecision:
    | ContextPacketConsumptionDecision
    | RuntimeTurnCoordinatorRejection['decision'];
  persistence: 'disabled';
  behavior: 'not_implemented';
  agentResponseGenerated: false;
}

export interface RuntimeTurnFixtureHarnessResult {
  scenario: RuntimeTurnFixtureScenarioType;
  metadata: RuntimeTurnFixtureScenarioMetadata;
  input: RuntimeTurnCoordinatorInput;
  result: RuntimeTurnCoordinatorResult;
  contextCalls: Array<{
    scope: RuntimeRequestScope;
    request: ContextPacketRequest;
  }>;
  eventPersistence: 'disabled';
  outcomePersistence: 'disabled';
  guidedActionPersistence: 'disabled';
  envelopePersistence: 'disabled';
  behavior: 'not_implemented';
  agentResponseGenerated: false;
}

export interface RuntimeTurnFixtureHarness {
  runScenario(
    options: RuntimeTurnFixtureScenarioOptions,
  ): Promise<RuntimeTurnFixtureHarnessResult>;
}

export type MichaelRuntimeResponseFixtureScenarioName =
  | 'complete_training_support'
  | 'complete_ambiguous_training_support'
  | 'degraded_context_packet'
  | 'missing_context_manager_boundary'
  | 'failed_context_packet'
  | 'rejected_context_packet'
  | 'invalid_objective'
  | 'unknown_agent'
  | 'candidate_review_only_rejected'
  | 'unsupported_language'
  | 'wrong_task_type'
  | 'non_michael_agent';

export type MichaelRuntimeTurnOutcomeStatus =
  | 'accepted'
  | 'degraded'
  | 'blocked'
  | 'rejected';

export type MichaelRuntimeResponseFixtureValidationStatus =
  | 'validated'
  | 'safe_close';

export interface MichaelRuntimeResponseFixtureScenarioMetadata {
  scenarioName: MichaelRuntimeResponseFixtureScenarioName;
  description: string;
  expectedResponseType: MichaelResponseType;
  expectedContextStatus: MichaelResponseContextPacketStatus;
  expectedValidationStatus: MichaelRuntimeResponseFixtureValidationStatus;
  runtimeTurnStatus: MichaelRuntimeTurnOutcomeStatus;
  runtimeScenario: RuntimeTurnFixtureScenarioType;
  agentKey: unknown;
  taskType: RuntimeTaskType;
  fixtureOnly: true;
  persistence: 'disabled';
  agentResponseGenerated: false;
}

export interface MichaelRuntimeResponseFixtureScenario {
  metadata: MichaelRuntimeResponseFixtureScenarioMetadata;
  responseFixtureKey: string;
}

export interface MichaelRuntimeResponseFixtureScenarioOptions {
  scenarioName: MichaelRuntimeResponseFixtureScenarioName;
  createdAt?: string;
}

export interface MichaelRuntimeResponseFixtureHarnessResult {
  scenarioName: MichaelRuntimeResponseFixtureScenarioName;
  scenario: MichaelRuntimeResponseFixtureScenario;
  runtimeTurn: RuntimeTurnFixtureHarnessResult;
  michaelResponse: MichaelResponseContractV1;
  validation: Extract<MichaelResponseContractValidationResult, { ok: true }>;
  eventPersistence: 'disabled';
  outcomePersistence: 'disabled';
  guidedActionPersistence: 'disabled';
  envelopePersistence: 'disabled';
  responsePersistence: 'disabled';
  behavior: 'not_implemented';
  agentResponseGenerated: false;
}

export interface MichaelRuntimeResponseFixtureHarness {
  runScenario(
    options: MichaelRuntimeResponseFixtureScenarioOptions,
  ): Promise<MichaelRuntimeResponseFixtureHarnessResult>;
}

export type MichaelRuntimeAdapterContractIntent =
  | 'clear_training_support'
  | 'ambiguous_training_support';

export type MichaelRuntimeAdapterContractDecision =
  | 'accepted'
  | 'safe_fallback'
  | 'safe_close';

export interface MichaelRuntimeAdapterContractInput {
  identity: AgentRuntimeAdapterDispatchIdentity;
  turnId: RuntimeTurnId;
  taskType: RuntimeTaskType;
  runtimeTurn: RuntimeTurnFixtureHarnessResult;
  turnClarity?: 'clear' | 'ambiguous';
  language?: unknown;
  intent?: MichaelRuntimeAdapterContractIntent;
}

export interface MichaelRuntimeAdapterContractIssue {
  path: string;
  code: string;
  message: string;
}

export interface MichaelRuntimeAdapterRuntimeTurnSummary {
  scenario: RuntimeTurnFixtureScenarioType;
  decision: ContextPacketConsumptionDecision | RuntimeTurnCoordinatorRejection['decision'];
  agentKey: unknown;
  taskType?: RuntimeTaskType;
  packetStatus?: MichaelResponseContextPacketStatus;
  contextManagerInjected: boolean;
}

export interface MichaelRuntimeAdapterContractResult {
  decision: MichaelRuntimeAdapterContractDecision;
  agentKey: 'michael_magnificent';
  taskType: 'training_support';
  turnId: RuntimeTurnId;
  selectionReason: string;
  blockedReasonCodes: string[];
  runtimeTurnStatus: MichaelRuntimeTurnOutcomeStatus;
  responseType: MichaelResponseType;
  runtimeTurn: MichaelRuntimeAdapterRuntimeTurnSummary;
  michaelResponse: MichaelResponseContractV1;
  validation: Extract<MichaelResponseContractValidationResult, { ok: true }>;
  issues: MichaelRuntimeAdapterContractIssue[];
  selectedFixtureKey: string;
  eventPersistence: 'disabled';
  outcomePersistence: 'disabled';
  guidedActionPersistence: 'disabled';
  envelopePersistence: 'disabled';
  responsePersistence: 'disabled';
  sessionPersistence: 'disabled';
  transcriptPersistence: 'disabled';
  behavior: 'not_implemented';
  agentResponseGenerated: false;
}

export type MichaelResponseContractSchemaVersion = 'michael_response_contract.v1';

export type MichaelResponseType =
  | 'next_training_step'
  | 'clarification_question'
  | 'safe_fallback'
  | 'safe_close';

export type MichaelResponseSafetyValidationStatus =
  | 'passed'
  | 'blocked'
  | 'degraded';

export type MichaelResponseValidationStatus =
  MichaelResponseSafetyValidationStatus;

export type MichaelResponseContextPacketStatus =
  | ContextPacketV1['packetStatus']
  | 'missing'
  | 'rejected';

export interface MichaelResponseSafety {
  validationStatus: MichaelResponseSafetyValidationStatus;
  guardrailIds: string[];
  blockedReasonCodes: string[];
}

export interface MichaelResponseNextStep {
  label?: string;
  title?: string;
  instruction?: string;
  baOwned: true;
  automaticSending: false;
  automaticCalling: false;
  externalSideEffect: false;
}

export interface MichaelResponseContractV1 {
  schemaVersion: MichaelResponseContractSchemaVersion;
  responseType: MichaelResponseType;
  agentKey: 'michael_magnificent';
  taskType: 'training_support';
  sessionId: SessionId;
  turnId: RuntimeTurnId;
  correlationId: CorrelationId;
  contextPacketStatus: MichaelResponseContextPacketStatus;
  language: 'en' | 'es';
  text: string;
  safety: MichaelResponseSafety;
  persistence: 'disabled';
  generatedAt: string;
  agentResponseGenerated: false;
  contextPacketId?: string;
  nextStep?: MichaelResponseNextStep;
}

export type MichaelResponseContractValidationCode =
  | 'not_object'
  | 'missing_required_field'
  | 'invalid_literal'
  | 'invalid_enum'
  | 'invalid_type'
  | 'invalid_timestamp'
  | 'forbidden_field'
  | 'unexpected_field'
  | 'context_packet_id_without_valid_packet'
  | 'substantive_response_not_allowed'
  | 'rejected_context_requires_safe_close'
  | 'next_step_not_allowed'
  | 'next_step_required'
  | 'prohibited_text';

export interface MichaelResponseContractValidationIssue {
  path: string;
  code: MichaelResponseContractValidationCode;
  message: string;
}

export type MichaelResponseValidationIssue =
  MichaelResponseContractValidationIssue;

export type MichaelResponseContractValidationResult =
  | {
      ok: true;
      contract: MichaelResponseContractV1;
      issues: [];
    }
  | {
      ok: false;
      issues: MichaelResponseContractValidationIssue[];
    };

export type MichaelResponseValidationResult =
  MichaelResponseContractValidationResult;

/**
 * Outcome of planning a single turn.
 *
 * `behavior: 'not_implemented'` is a hard marker: this slice validates,
 * gates, and captures events but never generates agent output.
 */
export interface OrchestrationTurnPlan {
  decision: ContextPacketConsumptionDecision;
  agentKey: AgentKey;
  behavior: 'not_implemented';
  consumption: ContextPacketConsumptionResult;
  /** Non-persistent event envelopes captured for this turn. */
  events: RuntimeAgentEventEnvelope[];
  notes: readonly string[];
}

/** Inert boundary descriptor for the orchestration layer. */
export interface AgentOrchestrationBoundaryDescriptor {
  key: 'agent_orchestration';
  label: string;
  status: 'skeleton_only';
  activated: false;
  apiMounted: false;
  behaviorEnabled: false;
  agentBehaviorImplemented: false;
  eventPersistence: 'disabled';
  contextPacketAssembly: 'context_manager_only';
  persistenceAccess: 'service_boundary_only';
  sharedContractImport: '@momentum/shared/runtime';
  notes: readonly string[];
}

export type { BaId, OutcomeId, RuntimeTurnId };

// ───────────────────────────────────────────────────────────────────────────
// S2.17 — Michael response catalog (inert, controlled, returned-only).
// A read-only catalog wrapper over the pre-authored EN/ES Michael response
// contract fixtures. It generates NO text, calls NO LLM, mounts NO route, and
// performs NO persistence or data access — it only lists and looks up fixtures
// that already validate against michael_response_contract.v1.
// ───────────────────────────────────────────────────────────────────────────

/** Scenario family a catalog entry belongs to (mirrors the Context Packet status). */
export type MichaelResponseScenarioFamily =
  | 'complete'
  | 'degraded'
  | 'missing'
  | 'failed'
  | 'rejected';

/** A single controlled catalog entry: metadata plus its validated fixture. */
export interface MichaelResponseCatalogEntry {
  /** Stable, deterministic lookup key (e.g. `michael_next_training_step_en`). */
  readonly catalogKey: string;
  readonly language: 'en' | 'es';
  readonly responseType: MichaelResponseType;
  readonly contextPacketStatus: MichaelResponseContextPacketStatus;
  readonly scenarioFamily: MichaelResponseScenarioFamily;
  /** True only for complete-Context-Packet substantive responses. */
  readonly isSubstantive: boolean;
  /** True for safe_fallback / safe_close (non-substantive) responses. */
  readonly isSafePath: boolean;
  /** Metadata flag: part of the governance-approved first-Michael-slice set. */
  readonly allowedForFirstMichaelSlice: boolean;
  /** The pre-authored, contract-valid response fixture (no dynamic text). */
  readonly response: MichaelResponseContractV1;
}

/** A single catalog-level validation issue (keyed by catalogKey). */
export interface MichaelResponseCatalogValidationIssue {
  readonly catalogKey: string;
  readonly code:
    | 'invalid_contract'
    | 'wrong_agent'
    | 'wrong_task'
    | 'persistence_not_disabled'
    | 'agent_response_generated'
    | 'next_step_on_safe_path';
  readonly message: string;
}

/** Result of validating the entire Michael response catalog. */
export interface MichaelResponseCatalogValidationResult {
  readonly ok: boolean;
  readonly entryCount: number;
  readonly issues: readonly MichaelResponseCatalogValidationIssue[];
}

// ───────────────────────────────────────────────────────────────────────────
// S2.18 — Michael catalog selector contract (pure, returned-only, inert).
// Maps a deterministic selection request to the matching MICHAEL_RESPONSE_CATALOG
// entry. Generates NO text, calls NO LLM, mounts NO route, performs NO
// persistence or data access, and NEVER mutates a catalog entry.
// ───────────────────────────────────────────────────────────────────────────

/** Optional intent used only to cross-check complete-Context-Packet requests. */
export type MichaelCatalogSelectorIntent =
  | 'clear_training_support'
  | 'ambiguous_training_support';

/** A deterministic catalog selection request. */
export interface MichaelResponseCatalogSelectionRequest {
  readonly agentKey: string;
  readonly taskType: string;
  readonly language: string;
  readonly responseType: string;
  readonly scenarioFamily: string;
  /** Optional; if present it must equal scenarioFamily. */
  readonly contextPacketStatus?: string;
  /** Optional; cross-checked only for the `complete` scenario family. */
  readonly intent?: MichaelCatalogSelectorIntent;
}

/** A single selection issue (why a request did not resolve to an entry). */
export interface MichaelResponseCatalogSelectionIssue {
  readonly code:
    | 'wrong_agent'
    | 'wrong_task'
    | 'unsupported_language'
    | 'invalid_response_type'
    | 'invalid_scenario_family'
    | 'inconsistent_context_status'
    | 'intent_mismatch'
    | 'invalid_combination'
    | 'catalog_key_not_found'
    | 'invalid_contract';
  readonly message: string;
}

/** Discriminated result of a catalog selection. */
export type MichaelResponseCatalogSelectionResult =
  | {
      readonly ok: true;
      readonly catalogKey: string;
      readonly entry: MichaelResponseCatalogEntry;
      readonly response: MichaelResponseContractV1;
    }
  | {
      readonly ok: false;
      readonly issues: readonly MichaelResponseCatalogSelectionIssue[];
    };

// ───────────────────────────────────────────────────────────────────────────
// S2.19 — Michael selection-request derivation (pure, inert, returned-only).
// Derives a MichaelResponseCatalogSelectionRequest from an existing runtime turn
// fixture result or Michael adapter-contract input, by reusing the inert
// adapter classification. Generates NO text, calls NO LLM, mounts NO route,
// performs NO persistence/data access, and mutates NO runtime turn or catalog.
// ───────────────────────────────────────────────────────────────────────────

/** A single derivation issue (why a runtime turn did not derive a request). */
export interface MichaelResponseSelectionRequestDerivationIssue {
  readonly code:
    | 'missing_identity'
    | 'missing_turn_id'
    | 'missing_task_type'
    | 'selection_invalid';
  readonly message: string;
}

/** Discriminated result of a selection-request derivation. */
export type MichaelResponseSelectionRequestDerivationResult =
  | {
      readonly ok: true;
      readonly selectionRequest: MichaelResponseCatalogSelectionRequest;
    }
  | {
      readonly ok: false;
      readonly issues: readonly MichaelResponseSelectionRequestDerivationIssue[];
    };

/** Input for deriving a selection request from a runtime turn fixture result. */
export interface DeriveMichaelSelectionRequestFromRuntimeTurnInput {
  readonly runtimeTurn: RuntimeTurnFixtureHarnessResult;
  /** Defaults to runtimeTurn.input.identity when omitted. */
  readonly identity?: AgentRuntimeAdapterDispatchIdentity;
  /** Defaults to runtimeTurn.input.turnId when omitted. */
  readonly turnId?: RuntimeTurnId;
  /** Defaults to runtimeTurn.input.taskType when omitted. */
  readonly taskType?: RuntimeTaskType;
  readonly turnClarity?: 'clear' | 'ambiguous';
  readonly intent?: MichaelRuntimeAdapterContractIntent;
  readonly language?: unknown;
}

// ───────────────────────────────────────────────────────────────────────────
// S2.20 — Michael end-to-end inert resolution facade (pure, returned-only).
// Composes the S2.19 derivation layer and the S2.18 selector/catalog layer to
// resolve a runtime turn / adapter input into the matching, pre-authored,
// contract-valid Michael response fixture (returned by reference). Generates NO
// text, calls NO LLM, mounts NO route, performs NO persistence/data access, and
// mutates NO runtime turn or catalog entry. Any trace is inert and redacted.
// ───────────────────────────────────────────────────────────────────────────

/** Inert, redacted classification metadata for a resolution. */
export interface MichaelRuntimeResolutionClassification {
  readonly scenarioFamily: MichaelResponseScenarioFamily;
  readonly responseType: MichaelResponseType;
  readonly language: 'en' | 'es';
  readonly intent?: MichaelCatalogSelectorIntent;
}

/**
 * Inert, returned-only resolution trace. Contains ONLY redacted, controlled
 * metadata: no raw Context Packet, no raw retrieval/store/GraphRAG/Gateway
 * output, no generated text, no tokens / request IDs / session IDs / PII.
 */
export interface MichaelRuntimeResolutionTrace {
  readonly classification: MichaelRuntimeResolutionClassification;
  readonly selectionRequest: MichaelResponseCatalogSelectionRequest;
  readonly catalogKey: string;
  readonly responseType: MichaelResponseType;
  readonly contextPacketStatus: MichaelResponseContextPacketStatus;
  readonly language: 'en' | 'es';
  readonly persistence: 'disabled';
  readonly agentResponseGenerated: false;
}

/** A single resolution issue (why a runtime turn did not resolve). */
export interface MichaelRuntimeResolutionIssue {
  readonly code:
    | 'invalid_runtime_turn'
    | 'derivation_failed'
    | 'selection_failed'
    | 'contract_validation_failed'
    | 'wrong_agent'
    | 'wrong_task'
    | 'unsupported_language';
  readonly message: string;
}

/** Discriminated result of an end-to-end inert resolution. */
export type MichaelRuntimeResolutionResult =
  | {
      readonly ok: true;
      readonly selectionRequest: MichaelResponseCatalogSelectionRequest;
      readonly catalogKey: string;
      readonly catalogEntry: MichaelResponseCatalogEntry;
      readonly response: MichaelResponseContractV1;
      readonly trace: MichaelRuntimeResolutionTrace;
    }
  | {
      readonly ok: false;
      readonly issues: readonly MichaelRuntimeResolutionIssue[];
    };
