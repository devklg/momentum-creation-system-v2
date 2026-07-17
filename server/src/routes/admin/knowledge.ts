/**
 * /api/admin/knowledge — Kevin-only knowledge foundation.
 *
 * Lets Kevin add approved organizational knowledge into the governed Knowledge
 * Core path. The write is triple-stacked, and active chunks are immediately
 * available to the Context Manager through the stored provider.
 */

import { Router } from 'express';
import { requireAdmin } from '../../middleware/requireAuth.js';
import type {
  McsAgentKey,
  McsKnowledgeDomain,
  McsKnowledgeIntakeFormat,
  McsRuntimeLanguage,
} from '@momentum/shared/runtime';
import { createKevinApprovedKnowledgeSource } from '../../services/knowledge/approvedKnowledgeStore.js';
import {
  extractKnowledgeFile,
  KnowledgeFileExtractionError,
} from '../../runtime/knowledge/knowledgeFileExtraction.js';
import { buildAdminKnowledgeStatus } from '../../domain/adminKnowledgeStatus.js';
import {
  MCS_KNOWLEDGE_CORRECTION_CONFIRMATION,
  MCS_KNOWLEDGE_ROLLBACK_CONFIRMATION,
  type McsAdminKnowledgeCorrectionApplyRequest,
  type McsAdminKnowledgeCorrectionRetryRequest,
  type McsAdminKnowledgeCorrectionRollbackRequest,
} from '@momentum/shared';
import {
  KnowledgeCorrectionWorkflow,
  KnowledgeCorrectionWorkflowError,
} from '../../services/knowledge/knowledgeCorrectionWorkflow.js';
import { knowledgeCorrectionStore } from '../../services/knowledge/knowledgeCorrectionStore.js';
import { attachKnowledgeDocumentToSource } from '../../services/knowledge/knowledgeDocumentStorage.js';

export const adminKnowledgeRoutes: Router = Router();

const MAX_TITLE = 160;
const MAX_CONTENT = 50000;
const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
const DOMAINS = new Set([
  'success',
  'training',
  'relationship',
  'performance',
  'organizational',
  'system',
  'governance',
]);
const LANGUAGES = new Set(['en', 'es']);
const AGENTS = new Set(['steve_success', 'michael_magnificent', 'ivory']);
const CORRECTION_STATUSES = new Set(['approved', 'active', 'superseded', 'deprecated', 'archived', 'rejected']);
const correctionWorkflow = new KnowledgeCorrectionWorkflow({ store: knowledgeCorrectionStore });

adminKnowledgeRoutes.get('/status', requireAdmin, async (_req, res) => {
  try {
    return res.json(await buildAdminKnowledgeStatus());
  } catch (err) {
    console.error('[GET /api/admin/knowledge/status] failed', err);
    return res.status(500).json({ ok: false, error: 'server_error' });
  }
});

adminKnowledgeRoutes.get('/source-versions', requireAdmin, async (req, res) => {
  const limit = typeof req.query.limit === 'string' ? Number(req.query.limit) : 25;
  const status = typeof req.query.status === 'string' && CORRECTION_STATUSES.has(req.query.status)
    ? req.query.status
    : undefined;
  try {
    return res.json(await correctionWorkflow.listSourceVersions({
      limit: Number.isFinite(limit) ? limit : 25,
      ...(typeof req.query.cursor === 'string' ? { cursor: req.query.cursor } : {}),
      ...(status ? { status } : {}),
    }));
  } catch (err) {
    return correctionError(res, err, 'GET /api/admin/knowledge/source-versions');
  }
});

adminKnowledgeRoutes.get('/source-versions/:sourceVersionId', requireAdmin, async (req, res) => {
  try {
    return res.json({ ok: true, source: await correctionWorkflow.getSourceVersion(pathParam(req.params.sourceVersionId)) });
  } catch (err) {
    return correctionError(res, err, 'GET /api/admin/knowledge/source-versions/:sourceVersionId');
  }
});

adminKnowledgeRoutes.post('/source-versions/:sourceVersionId/corrections/preview', requireAdmin, async (req, res) => {
  const body = req.body as Record<string, unknown>;
  try {
    const preview = await correctionWorkflow.preview(pathParam(req.params.sourceVersionId), {
      replacementContent: typeof body.replacementContent === 'string' ? body.replacementContent : '',
      reason: typeof body.reason === 'string' ? body.reason : '',
    });
    return res.json({ ok: true, preview });
  } catch (err) {
    return correctionError(res, err, 'POST /api/admin/knowledge/source-versions/:sourceVersionId/corrections/preview');
  }
});

adminKnowledgeRoutes.post('/source-versions/:sourceVersionId/corrections', requireAdmin, async (req, res) => {
  const actorTmagId = req.session?.tmagId;
  if (!actorTmagId) return res.status(401).json({ ok: false, error: 'admin_identity_required' });
  const body = req.body as Record<string, unknown>;
  const input: McsAdminKnowledgeCorrectionApplyRequest = {
    replacementContent: typeof body.replacementContent === 'string' ? body.replacementContent : '',
    reason: typeof body.reason === 'string' ? body.reason : '',
    previewId: typeof body.previewId === 'string' ? body.previewId : '',
    previewCreatedAt: typeof body.previewCreatedAt === 'string' ? body.previewCreatedAt : '',
    previewExpiresAt: typeof body.previewExpiresAt === 'string' ? body.previewExpiresAt : '',
    previewDigestSha256: typeof body.previewDigestSha256 === 'string' ? body.previewDigestSha256 : '',
    idempotencyKey: typeof body.idempotencyKey === 'string' ? body.idempotencyKey : '',
    confirmation: body.confirmation === MCS_KNOWLEDGE_CORRECTION_CONFIRMATION
      ? MCS_KNOWLEDGE_CORRECTION_CONFIRMATION
      : '' as typeof MCS_KNOWLEDGE_CORRECTION_CONFIRMATION,
  };
  try {
    const correction = await correctionWorkflow.apply(pathParam(req.params.sourceVersionId), input, actorTmagId);
    return res.status(correction.state === 'verified' ? 201 : 202).json({ ok: true, correction });
  } catch (err) {
    return correctionError(res, err, 'POST /api/admin/knowledge/source-versions/:sourceVersionId/corrections');
  }
});

adminKnowledgeRoutes.get('/corrections/:correctionId', requireAdmin, async (req, res) => {
  try {
    return res.json({ ok: true, correction: await correctionWorkflow.getCorrection(pathParam(req.params.correctionId)) });
  } catch (err) {
    return correctionError(res, err, 'GET /api/admin/knowledge/corrections/:correctionId');
  }
});

adminKnowledgeRoutes.post('/corrections/:correctionId/retry', requireAdmin, async (req, res) => {
  const body = req.body as Record<string, unknown>;
  const input: McsAdminKnowledgeCorrectionRetryRequest = {
    expectedState: 'failed',
    expectedRecordRevision: typeof body.expectedRecordRevision === 'number' ? body.expectedRecordRevision : -1,
    idempotencyKey: typeof body.idempotencyKey === 'string' ? body.idempotencyKey : '',
    approvalDecisionId: typeof body.approvalDecisionId === 'string' ? body.approvalDecisionId : '',
    confirmation: body.confirmation === MCS_KNOWLEDGE_CORRECTION_CONFIRMATION
      ? MCS_KNOWLEDGE_CORRECTION_CONFIRMATION
      : '' as typeof MCS_KNOWLEDGE_CORRECTION_CONFIRMATION,
  };
  try {
    return res.json({ ok: true, correction: await correctionWorkflow.retry(pathParam(req.params.correctionId), input) });
  } catch (err) {
    return correctionError(res, err, 'POST /api/admin/knowledge/corrections/:correctionId/retry');
  }
});

adminKnowledgeRoutes.post('/corrections/:correctionId/rollback', requireAdmin, async (req, res) => {
  const actorTmagId = req.session?.tmagId;
  if (!actorTmagId) return res.status(401).json({ ok: false, error: 'admin_identity_required' });
  const body = req.body as Record<string, unknown>;
  const input: McsAdminKnowledgeCorrectionRollbackRequest = {
    reason: typeof body.reason === 'string' ? body.reason : '',
    idempotencyKey: typeof body.idempotencyKey === 'string' ? body.idempotencyKey : '',
    expectedState: body.expectedState === 'failed' ? 'failed' : 'verified',
    expectedRecordRevision: typeof body.expectedRecordRevision === 'number' ? body.expectedRecordRevision : -1,
    rollbackTargetSourceVersionId: typeof body.rollbackTargetSourceVersionId === 'string' ? body.rollbackTargetSourceVersionId : '',
    rollbackTargetDigestSha256: typeof body.rollbackTargetDigestSha256 === 'string' ? body.rollbackTargetDigestSha256 : '',
    approvalDecisionId: typeof body.approvalDecisionId === 'string' ? body.approvalDecisionId : '',
    confirmation: body.confirmation === MCS_KNOWLEDGE_ROLLBACK_CONFIRMATION
      ? MCS_KNOWLEDGE_ROLLBACK_CONFIRMATION
      : '' as typeof MCS_KNOWLEDGE_ROLLBACK_CONFIRMATION,
  };
  try {
    return res.status(201).json({
      ok: true,
      correction: await correctionWorkflow.rollback(pathParam(req.params.correctionId), input, actorTmagId),
    });
  } catch (err) {
    return correctionError(res, err, 'POST /api/admin/knowledge/corrections/:correctionId/rollback');
  }
});

adminKnowledgeRoutes.post('/sources', requireAdmin, async (req, res) => {
  const body = req.body as Record<string, unknown>;
  const title = typeof body.title === 'string' ? body.title.trim() : '';
  const content = typeof body.content === 'string' ? body.content : '';
  const domain = typeof body.domain === 'string' ? body.domain : '';
  const language = typeof body.language === 'string' ? body.language : 'en';

  if (!title || title.length > MAX_TITLE) {
    return res.status(400).json({ ok: false, error: 'invalid_title' });
  }
  if (!content.trim() || content.length > MAX_CONTENT) {
    return res.status(400).json({ ok: false, error: 'invalid_content' });
  }
  if (!DOMAINS.has(domain)) {
    return res.status(400).json({ ok: false, error: 'invalid_domain' });
  }
  if (!LANGUAGES.has(language)) {
    return res.status(400).json({ ok: false, error: 'invalid_language' });
  }

  const topicTags = Array.isArray(body.topicTags)
    ? body.topicTags
      .filter((tag): tag is string => typeof tag === 'string' && tag.trim().length > 0)
      .map((tag) => tag.trim())
      .slice(0, 20)
    : [];
  const agentScopes = Array.isArray(body.agentScopes)
    ? body.agentScopes.filter(
      (agent): agent is McsAgentKey => typeof agent === 'string' && AGENTS.has(agent),
    )
    : undefined;

  try {
    const result = await createKevinApprovedKnowledgeSource({
      title,
      content,
      createdBy: req.session?.tmagId ?? 'admin',
      domain: domain as McsKnowledgeDomain,
      language: language as McsRuntimeLanguage,
      topicTags,
      ...(typeof body.sourceRef === 'string' && body.sourceRef.trim()
        ? { sourceRef: body.sourceRef.trim() }
        : {}),
      ...(agentScopes ? { agentScopes } : {}),
    });

    return res.status(201).json({
      ok: true,
      sourceId: result.source.sourceId,
      title: result.source.title,
      domain: result.source.domain,
      language: result.source.language,
      chunkCount: result.chunkCount,
      referenceCount: result.references.length,
      graphRagRecordCount: result.graphRagRecordCount,
      graphRagFailureCount: result.graphRagFailureCount,
      resourceCatalogProjection: result.resourceCatalogProjection,
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[POST /api/admin/knowledge/sources] failed', err);
    return res.status(500).json({ ok: false, error: 'server_error' });
  }
});

adminKnowledgeRoutes.post('/sources/upload', requireAdmin, async (req, res) => {
  const body = req.body as Record<string, unknown>;
  const filename = typeof body.filename === 'string' ? body.filename.trim() : '';
  const mimeType = typeof body.mimeType === 'string' ? body.mimeType.trim() : undefined;
  const base64 = typeof body.base64 === 'string' ? body.base64 : '';
  const providedTitle = typeof body.title === 'string' ? body.title.trim() : '';
  const title = providedTitle || titleFromFilename(filename);
  const domain = typeof body.domain === 'string' ? body.domain : '';
  const language = typeof body.language === 'string' ? body.language : 'en';

  if (!filename || filename.length > 240) {
    return res.status(400).json({ ok: false, error: 'invalid_filename' });
  }
  if (!title || title.length > MAX_TITLE) {
    return res.status(400).json({ ok: false, error: 'invalid_title' });
  }
  if (!isBase64Payload(base64)) {
    return res.status(400).json({ ok: false, error: 'invalid_file_payload' });
  }
  if (!DOMAINS.has(domain)) {
    return res.status(400).json({ ok: false, error: 'invalid_domain' });
  }
  if (!LANGUAGES.has(language)) {
    return res.status(400).json({ ok: false, error: 'invalid_language' });
  }

  const bytes = Buffer.from(base64, 'base64');
  if (bytes.length === 0 || bytes.length > MAX_UPLOAD_BYTES) {
    return res.status(400).json({ ok: false, error: 'invalid_file_size' });
  }

  const topicTags = Array.isArray(body.topicTags)
    ? body.topicTags
      .filter((tag): tag is string => typeof tag === 'string' && tag.trim().length > 0)
      .map((tag) => tag.trim())
      .slice(0, 20)
    : [];
  const agentScopes = Array.isArray(body.agentScopes)
    ? body.agentScopes.filter(
      (agent): agent is McsAgentKey => typeof agent === 'string' && AGENTS.has(agent),
    )
    : undefined;

  try {
    const extracted = await extractKnowledgeFile({ filename, mimeType, bytes });
    if (extracted.content.length > MAX_CONTENT) {
      return res.status(400).json({
        ok: false,
        error: 'extracted_content_too_large',
        extractedCharacters: extracted.content.length,
        maxCharacters: MAX_CONTENT,
      });
    }

    const result = await createKevinApprovedKnowledgeSource({
      title,
      content: extracted.content,
      createdBy: req.session?.tmagId ?? 'admin',
      domain: domain as McsKnowledgeDomain,
      language: language as McsRuntimeLanguage,
      format: extracted.kind as McsKnowledgeIntakeFormat,
      topicTags,
      sourceRef: `upload:${filename}`,
      upload: {
        filename,
        ...(mimeType ? { mimeType } : {}),
        originalBytes: bytes.length,
        extractedCharacters: extracted.content.length,
        sourceRef: `upload:${filename}`,
      },
      ...(agentScopes ? { agentScopes } : {}),
    });
    const document = await attachKnowledgeDocumentToSource({
      sourceId: String(result.source.sourceId),
      sourceVersion: result.source.version,
      filename,
      mimeType: mimeType ?? defaultMimeType(extracted.kind),
      bytes,
      extraction: {
        engine: extracted.kind === 'pdf' ? 'pdf_parse' : extracted.kind === 'docx' ? 'mammoth' : 'plain_text',
        extractedAt: new Date().toISOString(),
      },
    });

    return res.status(201).json({
      ok: true,
      sourceId: result.source.sourceId,
      title: result.source.title,
      domain: result.source.domain,
      language: result.source.language,
      filename,
      fileKind: extracted.kind,
      extractedCharacters: extracted.content.length,
      chunkCount: result.chunkCount,
      referenceCount: result.references.length,
      graphRagRecordCount: result.graphRagRecordCount,
      graphRagFailureCount: result.graphRagFailureCount,
      resourceCatalogProjection: result.resourceCatalogProjection,
      document,
    });
  } catch (err) {
    if (err instanceof KnowledgeFileExtractionError) {
      return res.status(400).json({ ok: false, error: err.code, message: err.message });
    }
    // eslint-disable-next-line no-console
    console.error('[POST /api/admin/knowledge/sources/upload] failed', err);
    return res.status(500).json({ ok: false, error: 'server_error' });
  }
});

function isBase64Payload(value: string): boolean {
  if (!value || value.length > Math.ceil((MAX_UPLOAD_BYTES * 4) / 3) + 8) return false;
  return /^[A-Za-z0-9+/]+={0,2}$/.test(value);
}

function titleFromFilename(filename: string): string {
  const name = filename.replace(/^.*[\\/]/, '').replace(/\.[^.]+$/, '').trim();
  return name.slice(0, MAX_TITLE);
}

function defaultMimeType(kind: McsKnowledgeIntakeFormat): string {
  if (kind === 'pdf') return 'application/pdf';
  if (kind === 'docx') return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  if (kind === 'json') return 'application/json';
  if (kind === 'html') return 'text/html; charset=utf-8';
  if (kind === 'csv') return 'text/csv; charset=utf-8';
  if (kind === 'markdown') return 'text/markdown; charset=utf-8';
  return 'text/plain; charset=utf-8';
}

function pathParam(value: string | string[] | undefined): string {
  return typeof value === 'string' ? value : '';
}

function correctionError(
  res: import('express').Response,
  err: unknown,
  route: string,
) {
  if (err instanceof KnowledgeCorrectionWorkflowError) {
    const status = err.code === 'source_version_not_found' || err.code === 'correction_not_found'
      ? 404
      : err.code === 'stale_preview' || err.code === 'idempotency_conflict' || err.code === 'source_version_not_active'
        ? 409
        : err.code === 'approval_readback_failed' || err.code.endsWith('_verification_failed')
          ? 422
          : 400;
    return res.status(status).json({ ok: false, error: err.code, message: err.message });
  }
  console.error(`[${route}] failed`, err);
  return res.status(500).json({ ok: false, error: 'server_error' });
}
