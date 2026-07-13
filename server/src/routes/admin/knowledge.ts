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

adminKnowledgeRoutes.get('/status', requireAdmin, async (_req, res) => {
  try {
    return res.json(await buildAdminKnowledgeStatus());
  } catch (err) {
    console.error('[GET /api/admin/knowledge/status] failed', err);
    return res.status(500).json({ ok: false, error: 'server_error' });
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
