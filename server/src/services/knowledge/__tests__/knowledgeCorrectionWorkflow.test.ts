import { describe, expect, it } from 'vitest';
import {
  MCS_KNOWLEDGE_CORRECTION_CONFIRMATION,
  MCS_KNOWLEDGE_ROLLBACK_CONFIRMATION,
  type McsAdminKnowledgeCorrectionPreview,
  type McsAdminKnowledgeCorrectionRecord,
  type McsAdminKnowledgeSourceVersionDetail,
  type McsKnowledgeCorrectionDecisionBinding,
  type McsKnowledgeCorrectionStageEvidence,
} from '@momentum/shared';
import {
  KnowledgeCorrectionWorkflow,
  sha256,
  type KnowledgeCorrectionExecutionContext,
  type KnowledgeCorrectionListOptions,
  type KnowledgeCorrectionStore,
} from '../knowledgeCorrectionWorkflow.js';

const START = new Date('2026-07-14T20:00:00.000Z');

describe('KnowledgeCorrectionWorkflow', () => {
  it('builds a content-bound read-only preview without mutating the store', async () => {
    const store = new InMemoryCorrectionStore();
    const workflow = new KnowledgeCorrectionWorkflow({ store, now: () => START });

    const preview = await workflow.preview('knowledge_alpha:v1', {
      replacementContent: 'Corrected immutable content.',
      reason: 'The prior statement is no longer correct.',
    });

    expect(preview.schemaVersion).toBe('knowledge_correction.v1');
    expect(preview.replacementSourceVersionId).toBe('knowledge_alpha:v2');
    expect(preview.currentDigestSha256).toBe(sha256('Original approved content.'));
    expect(preview.liveMutationAuthorized).toBe(false);
    expect(store.stageCalls).toBe(0);
    expect(store.sources.size).toBe(1);
  });

  it('rejects an apply when preview evidence is stale', async () => {
    const store = new InMemoryCorrectionStore();
    const workflow = new KnowledgeCorrectionWorkflow({ store, now: () => START });
    const preview = await workflow.preview('knowledge_alpha:v1', replacement());

    await expect(workflow.apply('knowledge_alpha:v1', {
      ...replacement(),
      previewId: preview.previewId,
      previewCreatedAt: preview.createdAt,
      previewExpiresAt: preview.expiresAt,
      previewDigestSha256: '0'.repeat(64),
      idempotencyKey: 'correction-alpha-0001',
      confirmation: MCS_KNOWLEDGE_CORRECTION_CONFIRMATION,
    }, 'TMAG-01')).rejects.toMatchObject({ code: 'stale_preview' });
    expect(store.stageCalls).toBe(0);
  });

  it('fails closed before staging when canonical decision readback is unavailable', async () => {
    const store = new InMemoryCorrectionStore();
    store.approvalAvailable = false;
    const workflow = new KnowledgeCorrectionWorkflow({ store, now: () => START });
    const preview = await workflow.preview('knowledge_alpha:v1', replacement());

    await expect(workflow.apply('knowledge_alpha:v1', applyInput(preview), 'TMAG-01'))
      .rejects.toMatchObject({ code: 'approval_readback_failed' });
    expect(store.stageCalls).toBe(0);
    expect(store.corrections.size).toBe(0);
  });

  it('creates one immutable replacement and verifies an exclusive active cutover', async () => {
    const store = new InMemoryCorrectionStore();
    const workflow = new KnowledgeCorrectionWorkflow({ store, now: () => START });
    const preview = await workflow.preview('knowledge_alpha:v1', replacement());

    const result = await workflow.apply('knowledge_alpha:v1', applyInput(preview), 'TMAG-01');

    expect(result.state).toBe('verified');
    expect(result.cutoverPhase).toBe('verified');
    expect(store.sources.get('knowledge_alpha:v1')?.status).toBe('superseded');
    expect(store.sources.get('knowledge_alpha:v2')?.status).toBe('active');
    expect([...store.sources.values()].filter((source) => source.status === 'active')).toHaveLength(1);
    expect(result.evidence.at(-1)?.checks.find((check) => check.key === 'exclusive_active_version')?.passed).toBe(true);
  });

  it('replays the same idempotency key without creating a second version', async () => {
    const store = new InMemoryCorrectionStore();
    const workflow = new KnowledgeCorrectionWorkflow({ store, now: () => START });
    const preview = await workflow.preview('knowledge_alpha:v1', replacement());
    const input = applyInput(preview);

    const first = await workflow.apply('knowledge_alpha:v1', input, 'TMAG-01');
    const second = await workflow.apply('knowledge_alpha:v1', input, 'TMAG-01');

    expect(second.correctionId).toBe(first.correctionId);
    expect(store.stageCalls).toBe(1);
    expect(store.sources.has('knowledge_alpha:v3')).toBe(false);
  });

  it('records a failed stage and resumes it without creating another replacement', async () => {
    const store = new InMemoryCorrectionStore();
    store.failStagedVerificationOnce = true;
    const workflow = new KnowledgeCorrectionWorkflow({ store, now: () => START });
    const preview = await workflow.preview('knowledge_alpha:v1', replacement());
    const input = applyInput(preview);

    await expect(workflow.apply('knowledge_alpha:v1', input, 'TMAG-01'))
      .rejects.toMatchObject({ code: 'stage_verification_failed' });
    const failed = await store.findCorrectionByIdempotencyKey(input.idempotencyKey);
    expect(failed).toMatchObject({ state: 'failed', failureStage: 'staged', failureCode: 'stage_readback_failed' });

    const retried = await workflow.retry(failed!.correctionId, {
      idempotencyKey: failed!.idempotencyKey,
      expectedState: 'failed',
      expectedRecordRevision: failed!.recordRevision,
      approvalDecisionId: failed!.approvalDecisionId,
      confirmation: MCS_KNOWLEDGE_CORRECTION_CONFIRMATION,
    });

    expect(retried.state).toBe('verified');
    expect(retried.attemptCount).toBe(2);
    expect(store.stageCalls).toBe(1);
    expect(store.sources.has('knowledge_alpha:v3')).toBe(false);
  });

  it('rolls back by appending version 3 instead of reactivating version 1', async () => {
    const store = new InMemoryCorrectionStore();
    const workflow = new KnowledgeCorrectionWorkflow({ store, now: () => START });
    const preview = await workflow.preview('knowledge_alpha:v1', replacement());
    const applied = await workflow.apply('knowledge_alpha:v1', applyInput(preview), 'TMAG-01');

    const rollback = await workflow.rollback(applied.correctionId, {
      reason: 'Restore the last verified content through a new immutable version.',
      idempotencyKey: 'rollback-alpha-0001',
      expectedState: 'verified',
      expectedRecordRevision: applied.recordRevision,
      rollbackTargetSourceVersionId: applied.rollbackTargetSourceVersionId,
      rollbackTargetDigestSha256: applied.currentDigestSha256,
      approvalDecisionId: applied.approvalDecisionId,
      confirmation: MCS_KNOWLEDGE_ROLLBACK_CONFIRMATION,
    }, 'TMAG-01');

    expect(rollback.state).toBe('verified');
    expect(rollback.replacementSourceVersionId).toBe('knowledge_alpha:v3');
    expect(store.sources.get('knowledge_alpha:v1')?.status).toBe('superseded');
    expect(store.sources.get('knowledge_alpha:v2')?.status).toBe('superseded');
    expect(store.sources.get('knowledge_alpha:v3')?.status).toBe('active');
    expect(store.sources.get('knowledge_alpha:v3')?.originalContent).toBe('Original approved content.');
  });
});

function replacement() {
  return {
    replacementContent: 'Corrected immutable content.',
    reason: 'The prior statement is no longer correct.',
  };
}

function applyInput(preview: McsAdminKnowledgeCorrectionPreview) {
  return {
    ...replacement(),
    previewId: preview.previewId,
    previewCreatedAt: preview.createdAt,
    previewExpiresAt: preview.expiresAt,
    previewDigestSha256: preview.previewDigestSha256,
    idempotencyKey: 'correction-alpha-0001',
    confirmation: MCS_KNOWLEDGE_CORRECTION_CONFIRMATION,
  };
}

class InMemoryCorrectionStore implements KnowledgeCorrectionStore {
  readonly sources = new Map<string, McsAdminKnowledgeSourceVersionDetail>();
  readonly corrections = new Map<string, McsAdminKnowledgeCorrectionRecord>();
  approvalAvailable = true;
  failStagedVerificationOnce = false;
  stageCalls = 0;

  constructor() {
    const content = 'Original approved content.';
    this.sources.set('knowledge_alpha:v1', {
      sourceId: 'knowledge_alpha',
      sourceVersionId: 'knowledge_alpha:v1',
      title: 'Alpha source',
      domain: 'organizational',
      language: 'en',
      version: 1,
      status: 'active',
      authorityStatus: 'active_authority',
      contentDigestSha256: sha256(content),
      createdAt: START.toISOString(),
      supersedesSourceVersionId: null,
      replacementSourceVersionId: null,
      originalContent: content,
      sourceRef: null,
      createdBy: 'TMAG-01',
      chunkCount: 1,
    });
  }

  async listSourceVersions(_options: KnowledgeCorrectionListOptions) {
    return { ok: true as const, items: [...this.sources.values()].map(({ originalContent: _a, sourceRef: _b, createdBy: _c, chunkCount: _d, ...item }) => item), nextCursor: null };
  }

  async getSourceVersion(id: string) { return this.sources.get(id) ?? null; }
  async findCorrectionById(id: string) { return this.corrections.get(id) ?? null; }
  async findCorrectionByIdempotencyKey(key: string) {
    return [...this.corrections.values()].find((record) => record.idempotencyKey === key) ?? null;
  }

  async insertCorrection(record: McsAdminKnowledgeCorrectionRecord) {
    this.corrections.set(record.correctionId, structuredClone(record));
    return structuredClone(record);
  }

  async patchCorrection(id: string, expectedRevision: number, patch: Partial<McsAdminKnowledgeCorrectionRecord>) {
    const current = this.corrections.get(id);
    if (!current || current.recordRevision !== expectedRevision) throw new Error('optimistic_conflict');
    const next = { ...current, ...structuredClone(patch) };
    this.corrections.set(id, next);
    return structuredClone(next);
  }

  async createAndVerifyApprovalDecision(input: {
    correctionId: string;
    approvalDecisionId: string;
    preview: McsAdminKnowledgeCorrectionPreview;
    actorTmagId: string;
    idempotencyKey: string;
  }): Promise<McsKnowledgeCorrectionDecisionBinding | null> {
    if (!this.approvalAvailable) return null;
    return {
      decisionId: input.approvalDecisionId,
      status: 'active',
      decidedBy: 'kevin_gardner',
      decidedAt: input.preview.createdAt,
      sourceVersionId: input.preview.currentSourceVersionId,
      expectedVersion: input.preview.currentVersion,
      expectedLifecycle: 'active',
      expectedReplacementSourceVersionId: input.preview.expectedReplacementSourceVersionId,
      currentDigestSha256: input.preview.currentDigestSha256,
      replacementDigestSha256: input.preview.replacementDigestSha256,
      reason: input.preview.reason,
      previewDigestSha256: input.preview.previewDigestSha256,
      actorTmagId: input.actorTmagId,
      idempotencyKey: input.idempotencyKey,
    };
  }

  async stageReplacement(context: KnowledgeCorrectionExecutionContext) {
    this.stageCalls += 1;
    const current = this.sources.get(context.correction.currentSourceVersionId)!;
    this.sources.set(context.correction.replacementSourceVersionId, {
      ...current,
      sourceVersionId: context.correction.replacementSourceVersionId,
      version: context.correction.replacementVersion,
      status: 'approved',
      originalContent: context.replacementContent,
      contentDigestSha256: context.correction.replacementDigestSha256,
      supersedesSourceVersionId: current.sourceVersionId,
      replacementSourceVersionId: null,
    });
    return evidence('requested', 'not_started', 'replacement_mongo_staged');
  }

  async verifyStagedReplacement(_context: KnowledgeCorrectionExecutionContext) {
    if (this.failStagedVerificationOnce) {
      this.failStagedVerificationOnce = false;
      return { ...evidence('staged', 'replacement_projections_ready', 'replacement_chroma_ready'), checks: [{ key: 'replacement_chroma_ready' as const, passed: false }] };
    }
    return evidence('staged', 'replacement_projections_ready', 'replacement_chroma_ready');
  }

  async cutoverExclusive(context: KnowledgeCorrectionExecutionContext) {
    const old = this.sources.get(context.correction.currentSourceVersionId)!;
    const replacement = this.sources.get(context.correction.replacementSourceVersionId)!;
    this.sources.set(old.sourceVersionId, { ...old, status: 'superseded', authorityStatus: 'superseded', replacementSourceVersionId: replacement.sourceVersionId });
    this.sources.set(replacement.sourceVersionId, { ...replacement, status: 'active' });
    return evidence('cutover_pending', 'replacement_canonical_activated', 'old_canonical_ineligible');
  }

  async verifyExclusiveCutover(_context: KnowledgeCorrectionExecutionContext) {
    return evidence('cutover_pending', 'verified', 'exclusive_active_version');
  }
}

function evidence(
  stage: McsKnowledgeCorrectionStageEvidence['stage'],
  cutoverPhase: McsKnowledgeCorrectionStageEvidence['cutoverPhase'],
  key: McsKnowledgeCorrectionStageEvidence['checks'][number]['key'],
): McsKnowledgeCorrectionStageEvidence {
  return { stage, cutoverPhase, recordedAt: START.toISOString(), checks: [{ key, passed: true }] };
}
