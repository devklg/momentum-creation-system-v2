import type { McsKnowledgeDomain } from './runtime/knowledge.js';
import type { McsKnowledgeAuthorityStatus } from './runtime/knowledge-intake.js';

export const MCS_KNOWLEDGE_CORRECTION_SCHEMA_VERSION = 'knowledge_correction.v1' as const;
export const MCS_KNOWLEDGE_CORRECTION_CONFIRMATION = 'APPLY KNOWLEDGE CORRECTION' as const;
export const MCS_KNOWLEDGE_ROLLBACK_CONFIRMATION = 'ROLL BACK KNOWLEDGE CORRECTION' as const;

export type McsKnowledgeCorrectionState =
  | 'requested'
  | 'staged'
  | 'projections_ready'
  | 'cutover_pending'
  | 'verified'
  | 'failed'
  | 'rolled_back';

export type McsKnowledgeCorrectionExecutableStage =
  | 'requested'
  | 'staged'
  | 'projections_ready'
  | 'cutover_pending';

export type McsKnowledgeCorrectionCutoverPhase =
  | 'not_started'
  | 'old_canonical_disabled'
  | 'old_projections_excluded'
  | 'replacement_projections_ready'
  | 'replacement_canonical_activated'
  | 'verified';

export type McsKnowledgeCorrectionFailureCode =
  | 'authority_decision_missing'
  | 'authority_decision_mismatch'
  | 'preview_expired'
  | 'preview_mismatch'
  | 'optimistic_concurrency_conflict'
  | 'stage_readback_failed'
  | 'projection_readback_failed'
  | 'exclusive_active_version_failed'
  | 'rollback_readback_failed';

export type McsKnowledgeCorrectionCheckKey =
  | 'canonical_decision_match'
  | 'source_version_match'
  | 'old_canonical_ineligible'
  | 'old_mongo_chunks_ineligible'
  | 'old_resource_ineligible'
  | 'old_neo4j_ineligible'
  | 'old_chroma_ineligible'
  | 'old_graphrag_ineligible'
  | 'replacement_mongo_staged'
  | 'replacement_resource_ready'
  | 'replacement_neo4j_ready'
  | 'replacement_chroma_ready'
  | 'replacement_graphrag_ready'
  | 'projection_outbox_clear'
  | 'cache_generation_invalidated'
  | 'exclusive_active_version';

export interface McsKnowledgeCorrectionCheck {
  key: McsKnowledgeCorrectionCheckKey;
  passed: boolean;
  observedCount?: number;
  fingerprintSha256?: string;
}

export type McsKnowledgeSourceVersionLifecycle =
  | 'approved'
  | 'active'
  | 'superseded'
  | 'deprecated'
  | 'archived'
  | 'rejected';

export interface McsAdminKnowledgeSourceVersionSummary {
  sourceId: string;
  sourceVersionId: string;
  title: string;
  domain: McsKnowledgeDomain;
  language: 'en' | 'es';
  version: number;
  status: McsKnowledgeSourceVersionLifecycle;
  authorityStatus: McsKnowledgeAuthorityStatus;
  contentDigestSha256: string;
  createdAt: string;
  supersedesSourceVersionId: string | null;
  replacementSourceVersionId: string | null;
}

export interface McsAdminKnowledgeSourceVersionDetail
  extends McsAdminKnowledgeSourceVersionSummary {
  originalContent: string;
  sourceRef: string | null;
  createdBy: string;
  chunkCount: number;
}

export interface McsAdminKnowledgeSourceVersionListResponse {
  ok: true;
  items: McsAdminKnowledgeSourceVersionSummary[];
  nextCursor: string | null;
}

export interface McsAdminKnowledgeSourceVersionListRequest {
  cursor?: string;
  limit?: number;
  status?: McsKnowledgeSourceVersionLifecycle;
  domain?: McsKnowledgeDomain;
  language?: 'en' | 'es';
  order?: 'created_at_desc_source_version_id_desc';
}

export interface McsAdminKnowledgeCorrectionPreviewRequest {
  replacementContent: string;
  reason: string;
}

export interface McsAdminKnowledgeCorrectionPreview {
  schemaVersion: typeof MCS_KNOWLEDGE_CORRECTION_SCHEMA_VERSION;
  previewId: string;
  createdAt: string;
  expiresAt: string;
  sourceId: string;
  currentSourceVersionId: string;
  currentVersion: number;
  expectedCurrentLifecycle: 'active';
  expectedReplacementSourceVersionId: string | null;
  replacementSourceVersionId: string;
  replacementVersion: number;
  currentDigestSha256: string;
  replacementDigestSha256: string;
  previewDigestSha256: string;
  reason: string;
  projectionScope: readonly ['mongo', 'neo4j', 'chroma', 'resource_catalog', 'graphrag'];
  rollbackTargetSourceVersionId: string;
  liveMutationAuthorized: false;
}

export interface McsAdminKnowledgeCorrectionApplyRequest
  extends McsAdminKnowledgeCorrectionPreviewRequest {
  previewId: string;
  previewCreatedAt: string;
  previewExpiresAt: string;
  previewDigestSha256: string;
  idempotencyKey: string;
  confirmation: typeof MCS_KNOWLEDGE_CORRECTION_CONFIRMATION;
}

export interface McsKnowledgeCorrectionDecisionBinding {
  decisionId: string;
  status: 'active';
  decidedBy: string;
  decidedAt: string;
  sourceVersionId: string;
  expectedVersion: number;
  expectedLifecycle: 'active';
  expectedReplacementSourceVersionId: string | null;
  currentDigestSha256: string;
  replacementDigestSha256: string;
  reason: string;
  previewDigestSha256: string;
  actorTmagId: string;
  idempotencyKey: string;
}

export interface McsKnowledgeCorrectionStageEvidence {
  stage: McsKnowledgeCorrectionExecutableStage;
  cutoverPhase: McsKnowledgeCorrectionCutoverPhase;
  recordedAt: string;
  checks: readonly McsKnowledgeCorrectionCheck[];
}

export interface McsAdminKnowledgeCorrectionRecord {
  correctionId: string;
  idempotencyKey: string;
  state: McsKnowledgeCorrectionState;
  sourceId: string;
  currentSourceVersionId: string;
  replacementSourceVersionId: string;
  currentVersion: number;
  replacementVersion: number;
  currentDigestSha256: string;
  replacementDigestSha256: string;
  previewDigestSha256: string;
  reason: string;
  actorTmagId: string;
  approvalDecisionId: string;
  decisionBinding: McsKnowledgeCorrectionDecisionBinding;
  rollbackTargetSourceVersionId: string;
  rollbackOfCorrectionId: string | null;
  evidence: McsKnowledgeCorrectionStageEvidence[];
  cutoverPhase: McsKnowledgeCorrectionCutoverPhase;
  failureStage: McsKnowledgeCorrectionExecutableStage | null;
  failureCode: McsKnowledgeCorrectionFailureCode | null;
  recordRevision: number;
  requestFingerprintSha256: string;
  attemptCount: number;
  lastAttemptAt: string;
  createdAt: string;
  updatedAt: string;
  verifiedAt: string | null;
  rolledBackAt: string | null;
}


export interface McsAdminKnowledgeCorrectionRetryRequest {
  expectedState: Extract<McsKnowledgeCorrectionState, 'failed'>;
  expectedRecordRevision: number;
  idempotencyKey: string;
  approvalDecisionId: string;
  confirmation: typeof MCS_KNOWLEDGE_CORRECTION_CONFIRMATION;
}

export interface McsAdminKnowledgeCorrectionRollbackRequest {
  reason: string;
  idempotencyKey: string;
  expectedState: Extract<McsKnowledgeCorrectionState, 'failed' | 'verified'>;
  expectedRecordRevision: number;
  rollbackTargetSourceVersionId: string;
  rollbackTargetDigestSha256: string;
  approvalDecisionId: string;
  confirmation: typeof MCS_KNOWLEDGE_ROLLBACK_CONFIRMATION;
}

export interface McsAdminKnowledgeCorrectionResponse {
  ok: true;
  correction: McsAdminKnowledgeCorrectionRecord;
}
