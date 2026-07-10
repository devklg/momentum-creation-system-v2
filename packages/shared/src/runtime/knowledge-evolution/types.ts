/**
 * Knowledge Evolution Runtime — shared TypeScript contracts (Lane 0 foundation).
 *
 * These are TYPE-ONLY contracts pinned so downstream lanes (persistence, core services,
 * indexing/graph, routes/workers, QA) build against one source of truth. They are a faithful
 * transcription of the ratified `runtime/KNOWLEDGE_EVOLUTION_RUNTIME.md` v1.0 (§§10–30).
 *
 * Lane 0 ships NO production behavior: no persistence, no Chroma/Neo4j/Mongo writes, no route
 * mount, no GraphRAG activation. Types and constants only. When these contracts conflict with
 * the ratified runtime document, the ratified document wins and this file is reconciled by an
 * approved ACR — never the reverse.
 *
 * Names intentionally match the ratified spec verbatim (unprefixed) so that Lane A/B/C/D/E code
 * references the exact identifiers the runtime document defines.
 */

import type { McsKnowledgeEventType } from '../events.js';

// ---------------------------------------------------------------------------
// Team Magnificent identity scope (spec §5)
// ---------------------------------------------------------------------------

export type KnowledgeEvolutionTeamKey = 'team_magnificent';
export type KnowledgeEvolutionTeamName = 'Team Magnificent';

/** Supported runtime languages for knowledge evolution (spec §22 — EN/ES first-class). */
export type KnowledgeEvolutionLanguage = 'en' | 'es';

/** Knowledge domains an evolution record may carry (spec §11 — includes `personal`). */
export type KnowledgeEvolutionDomain =
  | 'success'
  | 'training'
  | 'relationship'
  | 'performance'
  | 'personal'
  | 'organizational'
  | 'system'
  | 'governance';

/** Domains eligible for active retrieval rollout (spec §21.2 — `personal` excluded). */
export type KnowledgeRetrievalDomain =
  | 'success'
  | 'training'
  | 'relationship'
  | 'performance'
  | 'organizational'
  | 'governance'
  | 'system';

/** Internal agents that may receive evolved knowledge (spec §21.2). */
export type KnowledgeEvolutionAgentKey = 'steve_success' | 'michael_magnificent' | 'ivory';

// ---------------------------------------------------------------------------
// Lifecycle & action enums (spec §10)
// ---------------------------------------------------------------------------

export type KnowledgeEvolutionStatus =
  | 'received'
  | 'planning'
  | 'versioning'
  | 'writing_to_knowledge_core'
  | 'indexing'
  | 'graph_syncing'
  | 'retrieval_ready'
  | 'monitoring'
  | 'completed'
  | 'failed'
  | 'rolled_back';

export type KnowledgeEvolutionInputType =
  | 'approved_candidate'
  | 'approved_translation'
  | 'approved_refinement'
  | 'approved_supersession'
  | 'approved_archive'
  | 'approved_governance_decision'
  | 'approved_admin_import'
  | 'approved_knowledge_session';

/** Evolution action carried on a record (spec §11). */
export type KnowledgeEvolutionAction =
  | 'create_new_knowledge'
  | 'update_existing_knowledge'
  | 'create_language_variant'
  | 'supersede_existing_knowledge'
  | 'archive_existing_knowledge'
  | 'restore_prior_version'
  | 'reindex_only'
  | 'graph_sync_only';

/** Plan action verb (spec §13). */
export type KnowledgeEvolutionPlanAction =
  | 'create'
  | 'update'
  | 'translate'
  | 'supersede'
  | 'archive'
  | 'restore'
  | 'reindex'
  | 'graph_sync';

/** Indexing/graph coordination status carried on a record (spec §11). */
export type KnowledgeEvolutionCoordinationStatus =
  | 'not_required'
  | 'pending'
  | 'completed'
  | 'failed';

/** Retrieval availability status carried on a record (spec §11). */
export type KnowledgeEvolutionRetrievalStatus =
  | 'not_ready'
  | 'ready'
  | 'blocked'
  | 'rolled_back';

// ---------------------------------------------------------------------------
// Approval reference (spec §12)
// ---------------------------------------------------------------------------

export type KnowledgeApprovalType =
  | 'review_workflow'
  | 'knowledge_session'
  | 'governance_decision'
  | 'admin_decision';

export interface KnowledgeApprovalReference {
  approvalId: string;
  approvedBy: string;
  approvalType: KnowledgeApprovalType;
  approvedAt: Date;
  approvalNotes?: string;
  conditions?: string[];
  sourceReviewRecordId?: string;
}

// ---------------------------------------------------------------------------
// Knowledge Evolution Record (spec §11)
// ---------------------------------------------------------------------------

export interface KnowledgeEvolutionRecord {
  evolutionId: string;

  tenantId: string;

  teamId: string;
  teamKey: KnowledgeEvolutionTeamKey;
  teamName: KnowledgeEvolutionTeamName;

  baId?: string;

  inputType: KnowledgeEvolutionInputType;
  inputId: string;

  status: KnowledgeEvolutionStatus;

  domain: KnowledgeEvolutionDomain;

  language: KnowledgeEvolutionLanguage;

  targetKnowledgeObjectId?: string;

  sourceKnowledgeObjectIds: string[];
  sourceCandidateIds: string[];
  sourceOutcomeIds: string[];
  sourceLearningSignalIds: string[];
  sourceEventIds: string[];

  evolutionAction: KnowledgeEvolutionAction;

  versionCreated?: number;

  approvalReference: KnowledgeApprovalReference;

  indexingStatus: KnowledgeEvolutionCoordinationStatus;
  graphStatus: KnowledgeEvolutionCoordinationStatus;
  retrievalStatus: KnowledgeEvolutionRetrievalStatus;

  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
  failedAt?: Date;
  failureReason?: string;

  metadata?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Evolution Plan (spec §13)
// ---------------------------------------------------------------------------

export type KnowledgeEvolutionStepKey =
  | 'validate_approval'
  | 'validate_sources'
  | 'validate_permissions'
  | 'create_version'
  | 'write_knowledge_object'
  | 'mark_superseded'
  | 'archive_knowledge'
  | 'create_language_variant'
  | 'reindex_chroma'
  | 'sync_neo4j'
  | 'mark_retrieval_ready'
  | 'emit_events'
  | 'monitor_outcomes';

export type KnowledgeEvolutionStepStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'skipped';

export interface KnowledgeEvolutionStep {
  stepKey: KnowledgeEvolutionStepKey;
  required: boolean;
  status: KnowledgeEvolutionStepStatus;
  completedAt?: Date;
  error?: string;
}

export interface KnowledgeEvolutionPlan {
  planId: string;
  evolutionId: string;

  tenantId: string;

  teamId: string;
  teamKey: KnowledgeEvolutionTeamKey;
  teamName: KnowledgeEvolutionTeamName;

  action: KnowledgeEvolutionPlanAction;

  targetKnowledgeObjectId?: string;

  sourceKnowledgeObjectIds: string[];
  sourceCandidateIds: string[];

  requiredSteps: KnowledgeEvolutionStep[];

  riskFlags: string[];

  language: KnowledgeEvolutionLanguage;

  requiresReindex: boolean;
  requiresGraphSync: boolean;
  affectsRetrieval: boolean;

  rollbackPlan?: KnowledgeRollbackPlan;

  createdAt: Date;
}

// ---------------------------------------------------------------------------
// Rollback Plan (spec §14)
// ---------------------------------------------------------------------------

export type KnowledgeRollbackType =
  | 'restore_previous_version'
  | 'mark_not_retrieval_ready'
  | 'archive_new_version'
  | 'restore_superseded_knowledge'
  | 'remove_active_embedding'
  | 'restore_graph_relationships';

export interface KnowledgeRollbackPlan {
  rollbackPlanId: string;
  evolutionId: string;
  rollbackType: KnowledgeRollbackType;
  previousKnowledgeObjectIds: string[];
  previousVersionNumbers: number[];
  rollbackReason?: string;
  createdAt: Date;
}

// ---------------------------------------------------------------------------
// Versioning (spec §16)
// ---------------------------------------------------------------------------

export type KnowledgeEvolutionChangeType =
  | 'created'
  | 'updated'
  | 'translated'
  | 'refined'
  | 'superseded'
  | 'archived'
  | 'restored';

export interface KnowledgeEvolutionVersion {
  versionRecordId: string;
  knowledgeObjectId: string;
  version: number;
  previousVersion?: number;
  evolutionId: string;
  changeType: KnowledgeEvolutionChangeType;
  snapshotBefore?: Record<string, unknown>;
  snapshotAfter: Record<string, unknown>;
  reason: string;
  approvedBy: string;
  createdAt: Date;
}

// ---------------------------------------------------------------------------
// Supersession (spec §17)
// ---------------------------------------------------------------------------

export interface KnowledgeSupersessionRecord {
  supersessionId: string;

  tenantId: string;

  teamId: string;
  teamKey: KnowledgeEvolutionTeamKey;
  teamName: KnowledgeEvolutionTeamName;

  oldKnowledgeObjectId: string;
  newKnowledgeObjectId: string;

  reason: string;
  approvalReference: KnowledgeApprovalReference;
  supersededAt: Date;
  supersededBy: string;
}

// ---------------------------------------------------------------------------
// Reindexing (spec §19)
// ---------------------------------------------------------------------------

export type KnowledgeReindexStatus =
  | 'not_required'
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed';

// ---------------------------------------------------------------------------
// Retrieval Rollout (spec §21)
// ---------------------------------------------------------------------------

export interface KnowledgeRetrievalRollout {
  rolloutId: string;
  evolutionId: string;
  knowledgeObjectId: string;
  version: number;

  tenantId: string;

  teamId?: string;
  teamKey?: KnowledgeEvolutionTeamKey;
  teamName?: KnowledgeEvolutionTeamName;

  language: KnowledgeEvolutionLanguage;

  availableToAgents: KnowledgeEvolutionAgentKey[];
  availableToDomains: KnowledgeRetrievalDomain[];

  retrievalReady: boolean;
  readyAt?: Date;
  blockedReason?: string;
}

// ---------------------------------------------------------------------------
// Bilingual language evolution (spec §22)
// ---------------------------------------------------------------------------

export type KnowledgeLanguageTranslationStatus =
  | 'human_reviewed'
  | 'approved'
  | 'active'
  | 'rejected';

export interface KnowledgeLanguageEvolutionRecord {
  languageEvolutionId: string;

  tenantId: string;

  teamId?: string;
  teamKey?: KnowledgeEvolutionTeamKey;
  teamName?: KnowledgeEvolutionTeamName;

  sourceKnowledgeObjectId: string;
  variantKnowledgeObjectId: string;

  sourceLanguage: KnowledgeEvolutionLanguage;
  targetLanguage: KnowledgeEvolutionLanguage;

  translationStatus: KnowledgeLanguageTranslationStatus;
  approvalReference: KnowledgeApprovalReference;

  createdAt: Date;
  activatedAt?: Date;
}

// ---------------------------------------------------------------------------
// Monitoring (spec §23)
// ---------------------------------------------------------------------------

export type KnowledgeMonitoringStatus =
  | 'not_started'
  | 'monitoring'
  | 'validated'
  | 'needs_refinement'
  | 'weakened'
  | 'supersession_recommended';

// ---------------------------------------------------------------------------
// Metrics (spec §28)
// ---------------------------------------------------------------------------

export interface KnowledgeEvolutionMetricsSnapshot {
  metricsSnapshotId: string;

  tenantId: string;

  teamId: string;
  teamKey: KnowledgeEvolutionTeamKey;
  teamName: KnowledgeEvolutionTeamName;

  periodStart: Date;
  periodEnd: Date;

  evolutionCompletionRate: number;
  evolutionFailureRate: number;
  averageTimeToRetrievalReadyMs: number;
  reindexSuccessRate: number;
  graphSyncSuccessRate: number;
  supersessionCount: number;
  archiveCount: number;
  rollbackCount: number;
  bilingualActivationParity: number;
  candidateToActiveRate: number;

  createdAt: Date;
}

// ---------------------------------------------------------------------------
// Failure behavior (spec §30)
// ---------------------------------------------------------------------------

export type KnowledgeEvolutionErrorType =
  | 'approval_missing'
  | 'candidate_not_approved'
  | 'source_missing'
  | 'invalid_team_scope'
  | 'invalid_ba_scope'
  | 'invalid_language'
  | 'knowledge_core_write_failed'
  | 'version_creation_failed'
  | 'supersession_failed'
  | 'archive_failed'
  | 'reindex_failed'
  | 'graph_sync_failed'
  | 'retrieval_rollout_failed'
  | 'rollback_failed'
  | 'permission_denied';

export interface KnowledgeEvolutionError {
  errorId: string;
  errorType: KnowledgeEvolutionErrorType;

  tenantId: string;
  teamId?: string;

  evolutionId?: string;
  knowledgeObjectId?: string;
  candidateId?: string;

  message: string;
  safeMessage: string;
  retryable: boolean;
  occurredAt: Date;

  metadata?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// API request / response contracts (spec §25)
// ---------------------------------------------------------------------------

/** `POST /api/runtime/knowledge-evolution` request (spec §25.1). */
export interface StartKnowledgeEvolutionRequest {
  tenantId: string;

  teamId: string;
  teamKey: KnowledgeEvolutionTeamKey;
  teamName: KnowledgeEvolutionTeamName;

  baId?: string;

  inputType: KnowledgeEvolutionInputType;
  inputId: string;

  domain: KnowledgeEvolutionDomain;

  language: KnowledgeEvolutionLanguage;

  evolutionAction: KnowledgeEvolutionAction;

  targetKnowledgeObjectId?: string;

  sourceKnowledgeObjectIds?: string[];
  sourceCandidateIds?: string[];
  sourceOutcomeIds?: string[];
  sourceLearningSignalIds?: string[];
  sourceEventIds?: string[];

  approvalReference: KnowledgeApprovalReference;

  metadata?: Record<string, unknown>;
}

/** `POST /api/runtime/knowledge-evolution` response (spec §25.1). */
export interface StartKnowledgeEvolutionResponse {
  evolution: KnowledgeEvolutionRecord;
  plan: KnowledgeEvolutionPlan;
}

/** `GET /api/runtime/knowledge-evolution/:evolutionId` response (spec §25.2). */
export interface GetKnowledgeEvolutionResponse {
  evolution: KnowledgeEvolutionRecord | null;
}

/** `POST /api/runtime/knowledge-evolution/:evolutionId/retrieval-ready` input (spec §26.2). */
export interface MarkRetrievalReadyInput {
  tenantId: string;
  teamId: string;
  evolutionId: string;
  knowledgeObjectId: string;
  version: number;
}

/** `POST /api/runtime/knowledge-evolution/:evolutionId/retrieval-ready` response (spec §25.3). */
export interface MarkRetrievalReadyResponse {
  rollout: KnowledgeRetrievalRollout;
}

/** `POST /api/runtime/knowledge-evolution/:evolutionId/rollback` request (spec §25.4). */
export interface RollbackKnowledgeEvolutionRequest {
  tenantId: string;
  teamId: string;
  evolutionId: string;
  rollbackReason: string;
  requestedBy: string;
}

/** `POST /api/runtime/knowledge-evolution/:evolutionId/rollback` response (spec §25.4). */
export interface RollbackKnowledgeEvolutionResponse {
  evolution: KnowledgeEvolutionRecord;
}

/** `GET /api/runtime/knowledge-evolution/metrics` query (spec §25.5). */
export interface KnowledgeEvolutionMetricsQuery {
  tenantId: string;
  teamId: string;
  periodStart: Date;
  periodEnd: Date;
  domain?: KnowledgeEvolutionDomain;
  language?: KnowledgeEvolutionLanguage;
  evolutionAction?: KnowledgeEvolutionAction;
}

/** `GET /api/runtime/knowledge-evolution/metrics` response (spec §25.5, §28.2). */
export interface KnowledgeEvolutionMetricsResponse {
  snapshot: KnowledgeEvolutionMetricsSnapshot;
}

// ---------------------------------------------------------------------------
// Service & worker interfaces (spec §26) — contracts only; no implementation.
// ---------------------------------------------------------------------------

export interface KnowledgeEvolutionStartResult {
  evolution: KnowledgeEvolutionRecord;
  plan: KnowledgeEvolutionPlan;
}

export interface KnowledgeEvolutionService {
  startEvolution(
    input: StartKnowledgeEvolutionRequest,
  ): Promise<KnowledgeEvolutionStartResult>;

  createEvolutionPlan(
    input: StartKnowledgeEvolutionRequest,
  ): Promise<KnowledgeEvolutionPlan>;

  executeEvolutionPlan(planId: string): Promise<KnowledgeEvolutionRecord>;

  markRetrievalReady(
    input: MarkRetrievalReadyInput,
  ): Promise<KnowledgeRetrievalRollout>;

  rollbackEvolution(
    input: RollbackKnowledgeEvolutionRequest,
  ): Promise<KnowledgeEvolutionRecord>;

  getEvolutionById(
    evolutionId: string,
  ): Promise<KnowledgeEvolutionRecord | null>;
}

export interface KnowledgeEvolutionWorker {
  processApprovedCandidate(candidateId: string): Promise<void>;
  processApprovedTranslation(translationId: string): Promise<void>;
  processApprovedSupersession(supersessionApprovalId: string): Promise<void>;
  processApprovedArchive(archiveApprovalId: string): Promise<void>;
  processReindexJob(jobId: string): Promise<void>;
  processGraphSyncJob(jobId: string): Promise<void>;
}

// ---------------------------------------------------------------------------
// Event name unions (spec §24) — value catalog lives in ./constants.ts.
// ---------------------------------------------------------------------------

/** The 14 events the runtime publishes (spec §24.1). */
export type KnowledgeEvolutionPublishedEvent =
  | 'knowledge.evolution.received'
  | 'knowledge.evolution.plan_created'
  | 'knowledge.evolution.version_created'
  | 'knowledge.evolution.knowledge_written'
  | 'knowledge.evolution.supersession_applied'
  | 'knowledge.evolution.archive_applied'
  | 'knowledge.evolution.reindex_requested'
  | 'knowledge.evolution.reindex_completed'
  | 'knowledge.evolution.graph_sync_requested'
  | 'knowledge.evolution.graph_sync_completed'
  | 'knowledge.evolution.retrieval_ready'
  | 'knowledge.evolution.rollback_applied'
  | 'knowledge.evolution.failed'
  | 'knowledge.evolution.completed';

/** The review→evolution events the runtime consumes (spec §24.2). */
export type KnowledgeEvolutionConsumedEvent =
  | 'knowledge.candidate.approved'
  | 'knowledge.translation.approved'
  | 'knowledge.refinement.approved'
  | 'knowledge.supersession.approved'
  | 'knowledge.archive.approved'
  | 'knowledge.object.activated'
  | 'knowledge.embedding.completed'
  | 'knowledge.graph_sync.completed'
  | 'learning.knowledge.validated'
  | 'learning.knowledge.weakened'
  | 'learning.knowledge.refined'
  | 'learning.knowledge.superseded';

/**
 * Every published knowledge-evolution event name is a valid `knowledge.*` runtime event type,
 * so the existing `McsAgentEventType` union already accepts it without editing `events.ts`.
 */
export type KnowledgeEvolutionEventType = KnowledgeEvolutionPublishedEvent &
  McsKnowledgeEventType;
