import type { McsAgentAllowedOutput, McsAgentContext, McsAgentKey, McsRuntimeMode, McsRuntimeTaskType } from './agents.js';
import type {
  McsContextPacketId,
  McsContextRequestId,
  McsGuidedActionId,
  McsJournalEntryId,
  McsKnowledgeId,
  McsRelationshipContextId,
  McsRequestId,
  McsRuntimeTurnId,
  McsSessionId,
  McsSourceId,
  McsTemplateId,
} from './ids.js';
import type { McsBaContext, McsTeamContext, McsTenantContext, McsRuntimeEnvironment } from './identity.js';
import type { McsRuntimeLanguage, McsRuntimeLanguageContext, McsRuntimeTranslationStatus } from './language.js';

export type McsContextPacketSchemaVersion = 'context_packet.v1';

export type McsContextPacketStatus = 'complete' | 'degraded' | 'failed';

export interface McsSessionContext {
  sessionId: McsSessionId;
  mode: McsRuntimeMode;
  status: 'created' | 'active' | 'paused' | 'completed' | 'failed' | 'cancelled';
  taskType: McsRuntimeTaskType;
  currentState?: string;
  previousState?: string;
  startedAt?: string;
  lastActivityAt?: string;
  workflowId?: string;
  prospectId?: string;
  guidedActionId?: McsGuidedActionId;
}

export interface McsContextPacketMetadata {
  generatedBy: 'context_manager';
  environment: McsRuntimeEnvironment;
  correlationId?: string;
  causationId?: string;
  buildDurationMs?: number;
  tokenEstimate?: number;
  compressionApplied?: boolean;
  notes?: string[];
}

export interface McsRuntimeRule {
  ruleId: string;
  category:
    | 'agent_boundary'
    | 'knowledge_boundary'
    | 'journal_privacy'
    | 'relationship_privacy'
    | 'runtime_transport'
    | 'candidate_boundary'
    | 'action_ownership'
    | 'language'
    | 'source_traceability'
    | 'governance';
  instruction: string;
  required: true;
  appliesTo: 'all_agents' | McsAgentKey;
  reason?: string;
}

export interface McsGuardrail {
  guardrailId: string;
  appliesTo: 'all_agents' | McsAgentKey;
  instruction: string;
  reason?: string;
  severity: 'info' | 'required' | 'critical';
  category:
    | 'privacy'
    | 'compliance'
    | 'knowledge_integrity'
    | 'agent_scope'
    | 'relationship_sensitivity'
    | 'journal_privacy'
    | 'language'
    | 'runtime_boundary';
}

export interface McsInterviewTemplateContext {
  templateId: McsTemplateId;
  agentKey: McsAgentKey;
  language: McsRuntimeLanguage;
  title: string;
  version: number;
  templateType: McsRuntimeTaskType;
  currentState?: string;
  states: McsInterviewTemplateState[];
  templateInstructions?: string[];
}

export interface McsInterviewTemplateState {
  stateKey: string;
  purpose: string;
  prompt: string;
  expectedCaptureFields: string[];
  nextStates: string[];
  completionCriteria?: string[];
  allowedAgentOutputs?: McsAgentAllowedOutput[];
}

export type McsKnowledgeGovernanceStatus = 'approved' | 'approval_not_required';
export type McsApprovedKnowledgeStatus = 'active';

export interface McsSourceTraceability {
  sourceId: McsSourceId;
  sourceType: string;
  title?: string;
  capturedAt?: string;
  reviewedAt?: string;
}

export type McsRetrievalMethod =
  | 'semantic_search'
  | 'graph_expansion'
  | 'direct_reference'
  | 'session_history'
  | 'rule_inclusion'
  | 'fallback';

export type McsRetrievalReasonCode =
  | 'agent_task_match'
  | 'language_match'
  | 'same_ba_scope'
  | 'session_relevance'
  | 'active_template_required'
  | 'guardrail_required'
  | 'fallback_required';

export interface McsKnowledgeRetrievalMetadata {
  retrievalMethod: McsRetrievalMethod;
  reasonCodes: McsRetrievalReasonCode[];
  score?: number;
  language: McsRuntimeLanguage;
  translationStatus: McsRuntimeTranslationStatus;
}

export interface McsApprovedKnowledgeContextItem {
  knowledgeId: McsKnowledgeId;
  title: string;
  summary: string;
  status: McsApprovedKnowledgeStatus;
  governanceStatus: McsKnowledgeGovernanceStatus;
  language: McsRuntimeLanguage;
  sourceTraceability: McsSourceTraceability;
  retrieval: McsKnowledgeRetrievalMetadata;
}

export interface McsPrivateContextItem {
  contextId: string;
  ownerTmagId: McsBaContext['tmagId'];
  summary: string;
  language: McsRuntimeLanguage;
  sourceTraceability: McsSourceTraceability;
}

export interface McsPrivateContextSection {
  included: boolean;
  items: McsPrivateContextItem[];
  reason?: string;
}

export interface McsJournalContextItem {
  journalEntryId: McsJournalEntryId;
  ownerTmagId: McsBaContext['tmagId'];
  summary: string;
  language: McsRuntimeLanguage;
  selectedForReview: boolean;
}

export interface McsJournalContextSection {
  included: boolean;
  entries: McsJournalContextItem[];
  privateByDefault: true;
}

export interface McsRelationshipContextItem {
  relationshipContextId: McsRelationshipContextId;
  ownerTmagId: McsBaContext['tmagId'];
  summary: string;
  personSensitive: true;
  language: McsRuntimeLanguage;
}

export interface McsRelationshipContextSection {
  included: boolean;
  items: McsRelationshipContextItem[];
}

export interface McsSessionTurnContextItem {
  turnId: McsRuntimeTurnId;
  sequence: number;
  speaker: 'brand_ambassador' | 'agent' | 'system';
  summary: string;
  language: McsRuntimeLanguage;
}

export interface McsSessionHistorySection {
  included: boolean;
  turns: McsSessionTurnContextItem[];
  omittedTurnCount?: number;
}

export interface McsGuidedActionContextItem {
  guidedActionId: McsGuidedActionId;
  ownerTmagId: McsBaContext['tmagId'];
  title: string;
  status: 'suggested' | 'accepted' | 'completed' | 'dismissed';
  sourceKnowledgeIds?: McsKnowledgeId[];
}

export type McsContextExclusionReason =
  | 'candidate_not_approved'
  | 'not_review_workflow'
  | 'permission_denied'
  | 'context_budget_exceeded'
  | 'language_unavailable'
  | 'privacy_boundary';

export interface McsContextExclusion {
  sourceId: McsSourceId | string;
  reason: McsContextExclusionReason;
  description?: string;
}

export interface McsRetrievalAuditItem {
  sourceId: McsSourceId | string;
  method: McsRetrievalMethod;
  included: boolean;
  reasonCodes: McsRetrievalReasonCode[];
  score?: number;
}

export interface McsRetrievalAudit {
  requestId: McsContextRequestId;
  packetId: McsContextPacketId;
  requestedScopes: string[];
  includedKnowledgeIds: McsKnowledgeId[];
  includedPrivateContextIds: string[];
  includedJournalEntryIds?: McsJournalEntryId[];
  includedRelationshipContextIds?: McsRelationshipContextId[];
  includedGuidedActionIds?: McsGuidedActionId[];
  excludedSourceIds: Array<McsSourceId | string>;
  retrievalMethods: McsRetrievalMethod[];
  tokenEstimate: number;
  languageFallbackUsed: boolean;
  candidateKnowledgeIncluded: false;
  candidateKnowledgeExcluded: true;
  privateJournalIncluded: boolean;
  degraded: boolean;
  includedItems: McsRetrievalAuditItem[];
  exclusions: McsContextExclusion[];
}

export type McsDegradedContextReason =
  | 'knowledge_unavailable'
  | 'translation_unavailable'
  | 'private_context_unavailable'
  | 'relationship_context_unavailable'
  | 'retrieval_timeout'
  | 'partial_system_failure';

export interface McsDegradedContextState {
  reasons: McsDegradedContextReason[];
  safeFallbackInstruction: string;
  missingSections: string[];
}

export interface McsContextPacketV1 {
  schemaVersion: McsContextPacketSchemaVersion;
  packetId: McsContextPacketId;
  requestId: McsContextRequestId;
  createdAt: string;
  expiresAt?: string;
  packetStatus: McsContextPacketStatus;
  tenant: McsTenantContext;
  team: McsTeamContext;
  ba: McsBaContext;
  session: McsSessionContext;
  agent: McsAgentContext;
  language: McsRuntimeLanguageContext;
  runtimeRules: McsRuntimeRule[];
  guardrails: McsGuardrail[];
  activeTemplate?: McsInterviewTemplateContext;
  approvedKnowledge: McsApprovedKnowledgeContextItem[];
  privateContext: McsPrivateContextSection;
  relationshipContext: McsRelationshipContextSection;
  journalContext: McsJournalContextSection;
  sessionHistory: McsSessionHistorySection;
  guidedActions: McsGuidedActionContextItem[];
  exclusions: McsContextExclusion[];
  retrievalAudit: McsRetrievalAudit;
  degraded?: McsDegradedContextState;
  metadata?: McsContextPacketMetadata;
}

export interface McsContextPacketRequest {
  requestId: McsRequestId;
  sessionId: McsSessionId;
  agentKey: McsAgentKey;
  language: McsRuntimeLanguage;
  taskType: McsRuntimeTaskType;
}

export type McsContextManagerTraceSchemaVersion = 'context_manager_trace.v1';

/** Content-free Planner / Executor / Tracer evidence paired to one Context Packet. */
export interface McsContextManagerExecutionTraceV1 {
  schemaVersion: McsContextManagerTraceSchemaVersion;
  requestId: McsContextRequestId;
  packetId: McsContextPacketId;
  agentKey: McsAgentKey;
  taskType: McsRuntimeTaskType;
  planner: {
    domains: readonly string[];
    language: McsRuntimeLanguage;
    allowLanguageFallback: boolean;
    maxResults?: number;
  };
  executor: {
    retrievalStatus: 'ok' | 'degraded';
    approvedCount: number;
    candidateExcludedCount: number;
    degradeReasons: readonly string[];
  };
  tracer: {
    packetStatus: McsContextPacketStatus;
    includedKnowledgeIds: readonly string[];
    excludedSourceIds: readonly string[];
    notes: readonly string[];
  };
}
