import { createHash } from 'node:crypto';
import {
  MCS_KNOWLEDGE_CORRECTION_CONFIRMATION,
  MCS_KNOWLEDGE_CORRECTION_SCHEMA_VERSION,
  MCS_KNOWLEDGE_ROLLBACK_CONFIRMATION,
  type McsAdminKnowledgeCorrectionApplyRequest,
  type McsAdminKnowledgeCorrectionPreview,
  type McsAdminKnowledgeCorrectionRecord,
  type McsAdminKnowledgeCorrectionRetryRequest,
  type McsAdminKnowledgeCorrectionRollbackRequest,
  type McsAdminKnowledgeSourceVersionDetail,
  type McsAdminKnowledgeSourceVersionListResponse,
  type McsKnowledgeCorrectionDecisionBinding,
  type McsKnowledgeCorrectionExecutableStage,
  type McsKnowledgeCorrectionFailureCode,
  type McsKnowledgeCorrectionStageEvidence,
  type McsKnowledgeCorrectionState,
} from '@momentum/shared';

const PROJECTION_SCOPE = ['mongo', 'neo4j', 'chroma', 'resource_catalog', 'graphrag'] as const;
const MAX_REPLACEMENT_CHARACTERS = 50_000;
const MAX_REASON_CHARACTERS = 1_000;
const PREVIEW_TTL_MS = 15 * 60 * 1_000;

export class KnowledgeCorrectionWorkflowError extends Error {
  constructor(
    public readonly code:
      | 'source_version_not_found'
      | 'source_version_not_active'
      | 'invalid_replacement_content'
      | 'invalid_reason'
      | 'invalid_confirmation'
      | 'invalid_idempotency_key'
      | 'stale_preview'
      | 'idempotency_conflict'
      | 'optimistic_concurrency_conflict'
      | 'approval_readback_failed'
      | 'correction_not_found'
      | 'correction_not_retryable'
      | 'correction_not_verified'
      | 'stage_verification_failed'
      | 'cutover_verification_failed',
    message: string,
  ) {
    super(message);
    this.name = 'KnowledgeCorrectionWorkflowError';
  }
}

export interface KnowledgeCorrectionListOptions {
  cursor?: string;
  limit: number;
  status?: string;
}

export interface KnowledgeCorrectionExecutionContext {
  correction: McsAdminKnowledgeCorrectionRecord;
  current: McsAdminKnowledgeSourceVersionDetail;
  replacementContent: string;
}

export interface KnowledgeCorrectionStore {
  listSourceVersions(options: KnowledgeCorrectionListOptions): Promise<McsAdminKnowledgeSourceVersionListResponse>;
  getSourceVersion(sourceVersionId: string): Promise<McsAdminKnowledgeSourceVersionDetail | null>;
  findCorrectionById(correctionId: string): Promise<McsAdminKnowledgeCorrectionRecord | null>;
  findCorrectionByIdempotencyKey(idempotencyKey: string): Promise<McsAdminKnowledgeCorrectionRecord | null>;
  insertCorrection(record: McsAdminKnowledgeCorrectionRecord): Promise<McsAdminKnowledgeCorrectionRecord>;
  patchCorrection(
    correctionId: string,
    expectedRecordRevision: number,
    patch: Partial<McsAdminKnowledgeCorrectionRecord>,
  ): Promise<McsAdminKnowledgeCorrectionRecord>;
  createAndVerifyApprovalDecision(input: {
    correctionId: string;
    approvalDecisionId: string;
    preview: McsAdminKnowledgeCorrectionPreview;
    actorTmagId: string;
    idempotencyKey: string;
  }): Promise<McsKnowledgeCorrectionDecisionBinding | null>;
  stageReplacement(context: KnowledgeCorrectionExecutionContext): Promise<McsKnowledgeCorrectionStageEvidence>;
  verifyStagedReplacement(context: KnowledgeCorrectionExecutionContext): Promise<McsKnowledgeCorrectionStageEvidence>;
  cutoverExclusive(context: KnowledgeCorrectionExecutionContext): Promise<McsKnowledgeCorrectionStageEvidence>;
  verifyExclusiveCutover(context: KnowledgeCorrectionExecutionContext): Promise<McsKnowledgeCorrectionStageEvidence>;
}

export interface KnowledgeCorrectionWorkflowOptions {
  store: KnowledgeCorrectionStore;
  now?: () => Date;
}

type PreviewClock = Pick<McsAdminKnowledgeCorrectionPreview, 'previewId' | 'createdAt' | 'expiresAt'>;

export class KnowledgeCorrectionWorkflow {
  private readonly store: KnowledgeCorrectionStore;
  private readonly now: () => Date;

  constructor(options: KnowledgeCorrectionWorkflowOptions) {
    this.store = options.store;
    this.now = options.now ?? (() => new Date());
  }

  listSourceVersions(options: KnowledgeCorrectionListOptions) {
    return this.store.listSourceVersions(options);
  }

  async getSourceVersion(sourceVersionId: string) {
    const source = await this.store.getSourceVersion(sourceVersionId);
    if (!source) throw new KnowledgeCorrectionWorkflowError('source_version_not_found', 'Knowledge source version not found.');
    return source;
  }

  async preview(
    sourceVersionId: string,
    input: { replacementContent: string; reason: string },
  ): Promise<McsAdminKnowledgeCorrectionPreview> {
    const createdAt = this.now();
    return this.buildPreview(sourceVersionId, input, {
      createdAt: createdAt.toISOString(),
      expiresAt: new Date(createdAt.getTime() + PREVIEW_TTL_MS).toISOString(),
      previewId: '',
    });
  }

  async apply(
    sourceVersionId: string,
    input: McsAdminKnowledgeCorrectionApplyRequest,
    actorTmagId: string,
    rollbackOfCorrectionId: string | null = null,
  ): Promise<McsAdminKnowledgeCorrectionRecord> {
    if (input.confirmation !== MCS_KNOWLEDGE_CORRECTION_CONFIRMATION) {
      throw new KnowledgeCorrectionWorkflowError('invalid_confirmation', 'Exact correction confirmation is required.');
    }
    return this.applyValidated(sourceVersionId, input, actorTmagId, rollbackOfCorrectionId);
  }

  async getCorrection(correctionId: string): Promise<McsAdminKnowledgeCorrectionRecord> {
    const record = await this.store.findCorrectionById(correctionId);
    if (!record) throw new KnowledgeCorrectionWorkflowError('correction_not_found', 'Knowledge correction not found.');
    return record;
  }

  async retry(
    correctionId: string,
    input: McsAdminKnowledgeCorrectionRetryRequest,
  ): Promise<McsAdminKnowledgeCorrectionRecord> {
    if (input.confirmation !== MCS_KNOWLEDGE_CORRECTION_CONFIRMATION) {
      throw new KnowledgeCorrectionWorkflowError('invalid_confirmation', 'Exact correction confirmation is required.');
    }
    const correction = await this.getCorrection(correctionId);
    if (
      correction.state !== input.expectedState ||
      correction.recordRevision !== input.expectedRecordRevision ||
      correction.idempotencyKey !== validateIdempotencyKey(input.idempotencyKey) ||
      correction.approvalDecisionId !== input.approvalDecisionId
    ) {
      throw new KnowledgeCorrectionWorkflowError('optimistic_concurrency_conflict', 'Correction retry evidence is stale.');
    }
    if (correction.state !== 'failed') {
      throw new KnowledgeCorrectionWorkflowError('correction_not_retryable', 'The correction is not in a retryable state.');
    }
    const current = await this.getSourceVersion(correction.currentSourceVersionId);
    const replacement = await this.store.getSourceVersion(correction.replacementSourceVersionId);
    const replacementContent = replacement?.originalContent;
    if (!replacementContent || sha256(replacementContent) !== correction.replacementDigestSha256) {
      throw new KnowledgeCorrectionWorkflowError('stage_verification_failed', 'The staged replacement cannot be recovered with the approved digest.');
    }
    const restartState = correction.failureStage ?? 'requested';
    const reset = await this.patch(correction, {
      state: restartState,
      failureStage: null,
      failureCode: null,
      attemptCount: correction.attemptCount + 1,
      lastAttemptAt: this.now().toISOString(),
    });
    return this.resume({ correction: reset, current, replacementContent });
  }

  async rollback(
    correctionId: string,
    input: McsAdminKnowledgeCorrectionRollbackRequest,
    actorTmagId: string,
  ): Promise<McsAdminKnowledgeCorrectionRecord> {
    if (input.confirmation !== MCS_KNOWLEDGE_ROLLBACK_CONFIRMATION) {
      throw new KnowledgeCorrectionWorkflowError('invalid_confirmation', 'Exact rollback confirmation is required.');
    }
    const correction = await this.getCorrection(correctionId);
    if (
      correction.state !== input.expectedState ||
      correction.recordRevision !== input.expectedRecordRevision ||
      correction.approvalDecisionId !== input.approvalDecisionId ||
      correction.rollbackTargetSourceVersionId !== input.rollbackTargetSourceVersionId
    ) {
      throw new KnowledgeCorrectionWorkflowError('optimistic_concurrency_conflict', 'Rollback evidence is stale.');
    }
    if (correction.state !== 'verified') {
      throw new KnowledgeCorrectionWorkflowError('correction_not_verified', 'Only a verified correction can be rolled back.');
    }
    const rollbackTarget = await this.getSourceVersion(correction.rollbackTargetSourceVersionId);
    if (sha256(rollbackTarget.originalContent) !== input.rollbackTargetDigestSha256) {
      throw new KnowledgeCorrectionWorkflowError('optimistic_concurrency_conflict', 'Rollback target digest does not match.');
    }
    const preview = await this.preview(correction.replacementSourceVersionId, {
      replacementContent: rollbackTarget.originalContent,
      reason: validateReason(input.reason),
    });
    const rollback = await this.applyValidated(
      correction.replacementSourceVersionId,
      {
        replacementContent: rollbackTarget.originalContent,
        reason: input.reason,
        idempotencyKey: input.idempotencyKey,
        confirmation: MCS_KNOWLEDGE_CORRECTION_CONFIRMATION,
        previewId: preview.previewId,
        previewCreatedAt: preview.createdAt,
        previewExpiresAt: preview.expiresAt,
        previewDigestSha256: preview.previewDigestSha256,
      },
      actorTmagId,
      correctionId,
    );
    if (rollback.state === 'verified') {
      await this.patch(correction, { state: 'rolled_back', rolledBackAt: this.now().toISOString() });
    }
    return rollback;
  }

  private async buildPreview(
    sourceVersionId: string,
    input: { replacementContent: string; reason: string },
    clock: PreviewClock,
  ): Promise<McsAdminKnowledgeCorrectionPreview> {
    const current = await this.getSourceVersion(sourceVersionId);
    if (current.status !== 'active') {
      throw new KnowledgeCorrectionWorkflowError('source_version_not_active', 'Only the active source version can be corrected.');
    }
    const replacementContent = validateReplacementContent(input.replacementContent);
    const reason = validateReason(input.reason);
    const currentDigestSha256 = sha256(current.originalContent);
    if (currentDigestSha256 !== current.contentDigestSha256) {
      throw new KnowledgeCorrectionWorkflowError('stale_preview', 'The selected source digest no longer matches its content.');
    }
    const replacementDigestSha256 = sha256(replacementContent);
    if (replacementDigestSha256 === currentDigestSha256) {
      throw new KnowledgeCorrectionWorkflowError('invalid_replacement_content', 'Replacement content must differ from the active version.');
    }
    const replacementVersion = current.version + 1;
    const replacementSourceVersionId = `${current.sourceId}:v${replacementVersion}`;
    const previewId = clock.previewId || `knowledge_preview_${sha256(`${sourceVersionId}:${clock.createdAt}:${replacementDigestSha256}`).slice(0, 32)}`;
    const material = {
      schemaVersion: MCS_KNOWLEDGE_CORRECTION_SCHEMA_VERSION,
      previewId,
      createdAt: clock.createdAt,
      expiresAt: clock.expiresAt,
      sourceId: current.sourceId,
      currentSourceVersionId: current.sourceVersionId,
      currentVersion: current.version,
      expectedCurrentLifecycle: 'active' as const,
      expectedReplacementSourceVersionId: current.replacementSourceVersionId,
      replacementSourceVersionId,
      replacementVersion,
      currentDigestSha256,
      replacementDigestSha256,
      reason,
      projectionScope: PROJECTION_SCOPE,
      rollbackTargetSourceVersionId: current.sourceVersionId,
    };
    return { ...material, previewDigestSha256: sha256(stableJson(material)), liveMutationAuthorized: false };
  }

  private async applyValidated(
    sourceVersionId: string,
    input: McsAdminKnowledgeCorrectionApplyRequest,
    actorTmagId: string,
    rollbackOfCorrectionId: string | null,
  ): Promise<McsAdminKnowledgeCorrectionRecord> {
    const idempotencyKey = validateIdempotencyKey(input.idempotencyKey);
    const requestFingerprintSha256 = sha256(stableJson({
      sourceVersionId,
      previewDigestSha256: input.previewDigestSha256,
      idempotencyKey,
    }));
    const existing = await this.store.findCorrectionByIdempotencyKey(idempotencyKey);
    if (existing) {
      if (existing.requestFingerprintSha256 !== requestFingerprintSha256) {
        throw new KnowledgeCorrectionWorkflowError('idempotency_conflict', 'The idempotency key is already bound to different correction evidence.');
      }
      if (['requested', 'staged', 'projections_ready', 'cutover_pending'].includes(existing.state)) {
        const current = await this.getSourceVersion(existing.currentSourceVersionId);
        const staged = await this.store.getSourceVersion(existing.replacementSourceVersionId);
        const replacementContent = staged?.originalContent ?? validateReplacementContent(input.replacementContent);
        if (sha256(replacementContent) !== existing.replacementDigestSha256) {
          throw new KnowledgeCorrectionWorkflowError('stage_verification_failed', 'The idempotent correction replay does not match the approved replacement digest.');
        }
        return this.resume({ correction: existing, current, replacementContent });
      }
      return existing;
    }
    const preview = await this.buildPreview(sourceVersionId, input, {
      previewId: input.previewId,
      createdAt: input.previewCreatedAt,
      expiresAt: input.previewExpiresAt,
    });
    if (Date.parse(preview.expiresAt) <= this.now().getTime() || preview.previewDigestSha256 !== input.previewDigestSha256) {
      throw new KnowledgeCorrectionWorkflowError('stale_preview', 'The correction preview is stale. Generate a new preview.');
    }
    const current = await this.getSourceVersion(sourceVersionId);
    if (
      current.version !== preview.currentVersion ||
      current.status !== preview.expectedCurrentLifecycle ||
      current.replacementSourceVersionId !== preview.expectedReplacementSourceVersionId
    ) {
      throw new KnowledgeCorrectionWorkflowError('optimistic_concurrency_conflict', 'The active source version changed after preview.');
    }
    const correctionId = `knowledge_correction_${sha256(`${idempotencyKey}:${preview.previewDigestSha256}`).slice(0, 32)}`;
    const approvalDecisionId = `dec_${correctionId}`;
    const decisionBinding = await this.store.createAndVerifyApprovalDecision({ correctionId, approvalDecisionId, preview, actorTmagId, idempotencyKey });
    if (!decisionBinding || !decisionBindingMatches(decisionBinding, preview, actorTmagId, idempotencyKey, approvalDecisionId)) {
      throw new KnowledgeCorrectionWorkflowError('approval_readback_failed', 'The canonical Kevin correction decision could not be read back from every required store.');
    }
    const now = this.now().toISOString();
    const requestedEvidence: McsKnowledgeCorrectionStageEvidence = {
      stage: 'requested',
      cutoverPhase: 'not_started',
      recordedAt: now,
      checks: [
        { key: 'canonical_decision_match', passed: true, fingerprintSha256: sha256(stableJson(decisionBinding)) },
        { key: 'source_version_match', passed: true, fingerprintSha256: preview.currentDigestSha256 },
      ],
    };
    const requested: McsAdminKnowledgeCorrectionRecord = {
      correctionId,
      idempotencyKey,
      state: 'requested',
      sourceId: preview.sourceId,
      currentSourceVersionId: preview.currentSourceVersionId,
      replacementSourceVersionId: preview.replacementSourceVersionId,
      currentVersion: preview.currentVersion,
      replacementVersion: preview.replacementVersion,
      currentDigestSha256: preview.currentDigestSha256,
      replacementDigestSha256: preview.replacementDigestSha256,
      previewDigestSha256: preview.previewDigestSha256,
      reason: preview.reason,
      actorTmagId,
      approvalDecisionId,
      decisionBinding,
      rollbackTargetSourceVersionId: preview.rollbackTargetSourceVersionId,
      rollbackOfCorrectionId,
      evidence: [requestedEvidence],
      cutoverPhase: 'not_started',
      failureStage: null,
      failureCode: null,
      recordRevision: 1,
      requestFingerprintSha256,
      attemptCount: 1,
      lastAttemptAt: now,
      createdAt: now,
      updatedAt: now,
      verifiedAt: null,
      rolledBackAt: null,
    };
    const inserted = await this.store.insertCorrection(requested);
    return this.resume({ correction: inserted, current, replacementContent: validateReplacementContent(input.replacementContent) });
  }

  private async resume(context: KnowledgeCorrectionExecutionContext): Promise<McsAdminKnowledgeCorrectionRecord> {
    let record = context.correction;
    try {
      if (record.state === 'requested') {
        const evidence = await this.store.stageReplacement({ ...context, correction: record });
        assertEvidence(evidence, 'requested');
        record = await this.advance(record, 'staged', evidence);
      }
      if (record.state === 'staged') {
        const evidence = await this.store.verifyStagedReplacement({ ...context, correction: record });
        assertEvidence(evidence, 'staged');
        record = await this.advance(record, 'projections_ready', evidence);
      }
      if (record.state === 'projections_ready') {
        record = await this.patch(record, { state: 'cutover_pending' });
      }
      if (record.state === 'cutover_pending') {
        const cutover = await this.store.cutoverExclusive({ ...context, correction: record });
        assertEvidence(cutover, 'cutover_pending');
        record = await this.appendEvidence(record, cutover);
        const verified = await this.store.verifyExclusiveCutover({ ...context, correction: record });
        assertEvidence(verified, 'cutover_pending');
        const verifiedAt = this.now().toISOString();
        record = await this.patch(record, {
          state: 'verified',
          cutoverPhase: 'verified',
          evidence: [...record.evidence, verified],
          failureStage: null,
          failureCode: null,
          verifiedAt,
        });
      }
      return record;
    } catch (error) {
      const failureCode: McsKnowledgeCorrectionFailureCode =
        error instanceof KnowledgeCorrectionWorkflowError && error.code === 'stage_verification_failed'
          ? 'stage_readback_failed'
          : error instanceof KnowledgeCorrectionWorkflowError && error.code === 'approval_readback_failed'
            ? 'authority_decision_mismatch'
            : 'exclusive_active_version_failed';
      await this.fail(record, executableStage(record.state), failureCode);
      throw error;
    }
  }

  private advance(record: McsAdminKnowledgeCorrectionRecord, state: McsKnowledgeCorrectionState, evidence: McsKnowledgeCorrectionStageEvidence) {
    return this.patch(record, { state, cutoverPhase: evidence.cutoverPhase, evidence: [...record.evidence, evidence] });
  }

  private appendEvidence(record: McsAdminKnowledgeCorrectionRecord, evidence: McsKnowledgeCorrectionStageEvidence) {
    return this.patch(record, { cutoverPhase: evidence.cutoverPhase, evidence: [...record.evidence, evidence] });
  }

  private fail(record: McsAdminKnowledgeCorrectionRecord, stage: McsKnowledgeCorrectionExecutableStage, failureCode: McsKnowledgeCorrectionFailureCode) {
    return this.patch(record, { state: 'failed', failureStage: stage, failureCode });
  }

  private patch(record: McsAdminKnowledgeCorrectionRecord, patch: Partial<McsAdminKnowledgeCorrectionRecord>) {
    return this.store.patchCorrection(record.correctionId, record.recordRevision, {
      ...patch,
      recordRevision: record.recordRevision + 1,
      updatedAt: this.now().toISOString(),
    });
  }
}

export function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function validateReplacementContent(value: string): string {
  if (typeof value !== 'string' || !value.trim() || value.length > MAX_REPLACEMENT_CHARACTERS) {
    throw new KnowledgeCorrectionWorkflowError('invalid_replacement_content', `Replacement content must contain 1-${MAX_REPLACEMENT_CHARACTERS} characters.`);
  }
  return value;
}

function validateReason(value: string): string {
  const reason = typeof value === 'string' ? value.trim() : '';
  if (reason.length < 8 || reason.length > MAX_REASON_CHARACTERS) {
    throw new KnowledgeCorrectionWorkflowError('invalid_reason', `Correction reason must contain 8-${MAX_REASON_CHARACTERS} characters.`);
  }
  return reason;
}

function validateIdempotencyKey(value: string): string {
  const key = typeof value === 'string' ? value.trim() : '';
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{15,127}$/.test(key)) {
    throw new KnowledgeCorrectionWorkflowError('invalid_idempotency_key', 'Idempotency key must contain 16-128 safe characters.');
  }
  return key;
}

function assertEvidence(evidence: McsKnowledgeCorrectionStageEvidence, expectedStage: McsKnowledgeCorrectionExecutableStage): void {
  if (evidence.stage !== expectedStage || evidence.checks.length === 0 || evidence.checks.some((check) => !check.passed)) {
    throw new KnowledgeCorrectionWorkflowError(
      expectedStage === 'cutover_pending' ? 'cutover_verification_failed' : 'stage_verification_failed',
      'Knowledge correction evidence did not pass every required check.',
    );
  }
}

function executableStage(state: McsKnowledgeCorrectionState): McsKnowledgeCorrectionExecutableStage {
  return state === 'requested' || state === 'staged' || state === 'projections_ready' || state === 'cutover_pending'
    ? state
    : 'cutover_pending';
}

function decisionBindingMatches(
  binding: McsKnowledgeCorrectionDecisionBinding,
  preview: McsAdminKnowledgeCorrectionPreview,
  actorTmagId: string,
  idempotencyKey: string,
  approvalDecisionId: string,
): boolean {
  return binding.decisionId === approvalDecisionId
    && binding.status === 'active'
    && binding.decidedBy === 'kevin_gardner'
    && binding.sourceVersionId === preview.currentSourceVersionId
    && binding.expectedVersion === preview.currentVersion
    && binding.expectedLifecycle === preview.expectedCurrentLifecycle
    && binding.expectedReplacementSourceVersionId === preview.expectedReplacementSourceVersionId
    && binding.currentDigestSha256 === preview.currentDigestSha256
    && binding.replacementDigestSha256 === preview.replacementDigestSha256
    && binding.reason === preview.reason
    && binding.previewDigestSha256 === preview.previewDigestSha256
    && binding.actorTmagId === actorTmagId
    && binding.idempotencyKey === idempotencyKey;
}

function stableJson(value: unknown): string {
  return JSON.stringify(sortObject(value));
}

function sortObject(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortObject);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, sortObject(item)]));
}
