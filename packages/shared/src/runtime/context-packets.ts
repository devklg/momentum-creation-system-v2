import type { AgentAllowedOutput, AgentContext, AgentKey, RuntimeMode, RuntimeTaskType } from './agents.js';
import type {
  ContextPacketId,
  ContextRequestId,
  GuidedActionId,
  JournalEntryId,
  KnowledgeId,
  RelationshipContextId,
  RequestId,
  RuntimeTurnId,
  SessionId,
  SourceId,
  TemplateId,
} from './ids.js';
import type { BaContext, TeamContext, TenantContext, RuntimeEnvironment } from './identity.js';
import type { RuntimeLanguage, RuntimeLanguageContext, RuntimeTranslationStatus } from './language.js';

export type ContextPacketSchemaVersion = 'context_packet.v1';

export type ContextPacketStatus = 'complete' | 'degraded' | 'failed';

export interface SessionContext {
  sessionId: SessionId;
  mode: RuntimeMode;
  status: 'created' | 'active' | 'paused' | 'completed' | 'failed' | 'cancelled';
  taskType: RuntimeTaskType;
  currentState?: string;
  previousState?: string;
  startedAt?: string;
  lastActivityAt?: string;
  workflowId?: string;
  prospectId?: string;
  guidedActionId?: GuidedActionId;
}

export interface ContextPacketMetadata {
  generatedBy: 'context_manager';
  environment: RuntimeEnvironment;
  correlationId?: string;
  causationId?: string;
  buildDurationMs?: number;
  tokenEstimate?: number;
  compressionApplied?: boolean;
  notes?: string[];
}

export interface RuntimeRule {
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
  appliesTo: 'all_agents' | AgentKey;
  reason?: string;
}

export interface Guardrail {
  guardrailId: string;
  appliesTo: 'all_agents' | AgentKey;
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

export interface InterviewTemplateContext {
  templateId: TemplateId;
  agentKey: AgentKey;
  language: RuntimeLanguage;
  title: string;
  version: number;
  templateType: RuntimeTaskType;
  currentState?: string;
  states: InterviewTemplateState[];
  templateInstructions?: string[];
}

export interface InterviewTemplateState {
  stateKey: string;
  purpose: string;
  prompt: string;
  expectedCaptureFields: string[];
  nextStates: string[];
  completionCriteria?: string[];
  allowedAgentOutputs?: AgentAllowedOutput[];
}

export type KnowledgeGovernanceStatus = 'approved' | 'approval_not_required';
export type ApprovedKnowledgeStatus = 'active';

export interface SourceTraceability {
  sourceId: SourceId;
  sourceType: string;
  title?: string;
  capturedAt?: string;
  reviewedAt?: string;
}

export type RetrievalMethod =
  | 'semantic_search'
  | 'graph_expansion'
  | 'direct_reference'
  | 'session_history'
  | 'rule_inclusion'
  | 'fallback';

export type RetrievalReasonCode =
  | 'agent_task_match'
  | 'language_match'
  | 'same_ba_scope'
  | 'session_relevance'
  | 'active_template_required'
  | 'guardrail_required'
  | 'fallback_required';

export interface KnowledgeRetrievalMetadata {
  retrievalMethod: RetrievalMethod;
  reasonCodes: RetrievalReasonCode[];
  score?: number;
  language: RuntimeLanguage;
  translationStatus: RuntimeTranslationStatus;
}

export interface ApprovedKnowledgeContextItem {
  knowledgeId: KnowledgeId;
  title: string;
  summary: string;
  status: ApprovedKnowledgeStatus;
  governanceStatus: KnowledgeGovernanceStatus;
  language: RuntimeLanguage;
  sourceTraceability: SourceTraceability;
  retrieval: KnowledgeRetrievalMetadata;
}

export interface PrivateContextItem {
  contextId: string;
  ownerBaId: BaContext['baId'];
  summary: string;
  language: RuntimeLanguage;
  sourceTraceability: SourceTraceability;
}

export interface PrivateContextSection {
  included: boolean;
  items: PrivateContextItem[];
  reason?: string;
}

export interface JournalContextItem {
  journalEntryId: JournalEntryId;
  ownerBaId: BaContext['baId'];
  summary: string;
  language: RuntimeLanguage;
  selectedForReview: boolean;
}

export interface JournalContextSection {
  included: boolean;
  entries: JournalContextItem[];
  privateByDefault: true;
}

export interface RelationshipContextItem {
  relationshipContextId: RelationshipContextId;
  ownerBaId: BaContext['baId'];
  summary: string;
  personSensitive: true;
  language: RuntimeLanguage;
}

export interface RelationshipContextSection {
  included: boolean;
  items: RelationshipContextItem[];
}

export interface SessionTurnContextItem {
  turnId: RuntimeTurnId;
  sequence: number;
  speaker: 'brand_ambassador' | 'agent' | 'system';
  summary: string;
  language: RuntimeLanguage;
}

export interface SessionHistorySection {
  included: boolean;
  turns: SessionTurnContextItem[];
  omittedTurnCount?: number;
}

export interface GuidedActionContextItem {
  guidedActionId: GuidedActionId;
  ownerBaId: BaContext['baId'];
  title: string;
  status: 'suggested' | 'accepted' | 'completed' | 'dismissed';
  sourceKnowledgeIds?: KnowledgeId[];
}

export type ContextExclusionReason =
  | 'candidate_not_approved'
  | 'not_review_workflow'
  | 'permission_denied'
  | 'context_budget_exceeded'
  | 'language_unavailable'
  | 'privacy_boundary';

export interface ContextExclusion {
  sourceId: SourceId | string;
  reason: ContextExclusionReason;
  description?: string;
}

export interface RetrievalAuditItem {
  sourceId: SourceId | string;
  method: RetrievalMethod;
  included: boolean;
  reasonCodes: RetrievalReasonCode[];
  score?: number;
}

export interface RetrievalAudit {
  requestId: ContextRequestId;
  packetId: ContextPacketId;
  requestedScopes: string[];
  includedKnowledgeIds: KnowledgeId[];
  includedPrivateContextIds: string[];
  includedJournalEntryIds?: JournalEntryId[];
  includedRelationshipContextIds?: RelationshipContextId[];
  includedGuidedActionIds?: GuidedActionId[];
  excludedSourceIds: Array<SourceId | string>;
  retrievalMethods: RetrievalMethod[];
  tokenEstimate: number;
  languageFallbackUsed: boolean;
  candidateKnowledgeIncluded: false;
  candidateKnowledgeExcluded: true;
  privateJournalIncluded: boolean;
  degraded: boolean;
  includedItems: RetrievalAuditItem[];
  exclusions: ContextExclusion[];
}

export type DegradedContextReason =
  | 'knowledge_unavailable'
  | 'translation_unavailable'
  | 'private_context_unavailable'
  | 'relationship_context_unavailable'
  | 'retrieval_timeout'
  | 'partial_system_failure';

export interface DegradedContextState {
  reasons: DegradedContextReason[];
  safeFallbackInstruction: string;
  missingSections: string[];
}

export interface ContextPacketV1 {
  schemaVersion: ContextPacketSchemaVersion;
  packetId: ContextPacketId;
  requestId: ContextRequestId;
  createdAt: string;
  expiresAt?: string;
  packetStatus: ContextPacketStatus;
  tenant: TenantContext;
  team: TeamContext;
  ba: BaContext;
  session: SessionContext;
  agent: AgentContext;
  language: RuntimeLanguageContext;
  runtimeRules: RuntimeRule[];
  guardrails: Guardrail[];
  activeTemplate?: InterviewTemplateContext;
  approvedKnowledge: ApprovedKnowledgeContextItem[];
  privateContext: PrivateContextSection;
  relationshipContext: RelationshipContextSection;
  journalContext: JournalContextSection;
  sessionHistory: SessionHistorySection;
  guidedActions: GuidedActionContextItem[];
  exclusions: ContextExclusion[];
  retrievalAudit: RetrievalAudit;
  degraded?: DegradedContextState;
  metadata?: ContextPacketMetadata;
}

export interface ContextPacketRequest {
  requestId: RequestId;
  sessionId: SessionId;
  agentKey: AgentKey;
  language: RuntimeLanguage;
  taskType: RuntimeTaskType;
}
