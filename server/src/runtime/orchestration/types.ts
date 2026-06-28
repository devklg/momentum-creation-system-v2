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
