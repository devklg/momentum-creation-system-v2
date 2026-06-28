import type {
  AgentAllowedOutput,
  AgentKey,
  BaId,
  ContextPacketV1,
  CorrelationId,
  RequestId,
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

export type { BaId, RuntimeTurnId };
