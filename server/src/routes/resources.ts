import { Router } from 'express';
import type { McsResourceCenterResponse } from '@momentum/shared';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireSteveComplete } from '../middleware/requireSteveComplete.js';
import { listResourceCenterResources } from '../domain/resourceCenter.js';
import { getResourceCenterResourceDetail } from '../domain/resourceCenter.js';
import { getResourceCenterKnowledgeDocumentPointer } from '../domain/resourceCenter.js';
import { openKnowledgeDocument } from '../services/knowledge/knowledgeDocumentStorage.js';
import { recordVerifiedResourceOpen } from '../domain/resourceUsage.js';

export const resourceRoutes: Router = Router();

resourceRoutes.get('/', requireAuth, requireSteveComplete, async (_req, res) => {
  try {
    const body: McsResourceCenterResponse = await listResourceCenterResources();
    res.status(200).json(body);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('[GET /api/resources] failed', error);
    res.status(503).json({ ok: false, error: 'resource_catalog_unavailable' });
  }
});

resourceRoutes.post('/:resourceVersionId/usage', requireAuth, requireSteveComplete, async (req, res) => {
  try {
    const raw = req.params.resourceVersionId;
    const resourceVersionId = decodeURIComponent(Array.isArray(raw) ? raw[0] ?? '' : raw ?? '').trim();
    if (!resourceVersionId || resourceVersionId.length > 300) {
      return res.status(400).json({ ok: false, error: 'invalid_resource_version_id' });
    }
    const event = await recordVerifiedResourceOpen(resourceVersionId, req.session!.tmagId);
    if (!event) return res.status(404).json({ ok: false, error: 'resource_not_found' });
    return res.status(202).json({ ok: true, usageEventId: event.usageEventId });
  } catch (error) {
    console.error('[POST /api/resources/:resourceVersionId/usage] failed', error);
    return res.status(503).json({ ok: false, error: 'resource_usage_unavailable' });
  }
});

// Module 1 is intentionally available before Steve is complete. Keep the exact-version
// document stream BA-authenticated, but do not apply the later-training Steve gate here.
resourceRoutes.get('/:resourceVersionId/document', requireAuth, async (req, res) => {
  try {
    const resourceVersionId = decodedResourceVersionId(req.params.resourceVersionId);
    if (!resourceVersionId || resourceVersionId.length > 300) {
      return res.status(400).json({ ok: false, error: 'invalid_resource_version_id' });
    }
    const pointer = await getResourceCenterKnowledgeDocumentPointer(resourceVersionId);
    if (!pointer) return res.status(404).json({ ok: false, error: 'resource_document_not_found' });
    const document = await openKnowledgeDocument(pointer);
    res.setHeader('Content-Type', document.mimeType);
    res.setHeader('Content-Length', String(document.originalBytes));
    res.setHeader('Cache-Control', 'private, max-age=0, must-revalidate');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Disposition', inlineContentDisposition(document.filename));
    document.stream.on('error', (error) => {
      console.error('[GET /api/resources/:resourceVersionId/document] stream failed', error);
      if (!res.headersSent) res.status(503).end();
      else res.destroy(error);
    });
    document.stream.pipe(res);
    return;
  } catch (error) {
    console.error('[GET /api/resources/:resourceVersionId/document] failed', error);
    if (!res.headersSent) return res.status(503).json({ ok: false, error: 'resource_document_unavailable' });
    return res.destroy(error instanceof Error ? error : undefined);
  }
});

resourceRoutes.get('/:resourceVersionId', requireAuth, requireSteveComplete, async (req, res) => {
  try {
    const rawResourceVersionId = req.params.resourceVersionId;
    const resourceVersionId = decodeURIComponent(
      Array.isArray(rawResourceVersionId) ? rawResourceVersionId[0] ?? '' : rawResourceVersionId ?? '',
    ).trim();
    if (!resourceVersionId || resourceVersionId.length > 300) {
      return res.status(400).json({ ok: false, error: 'invalid_resource_version_id' });
    }
    const body = await getResourceCenterResourceDetail(resourceVersionId);
    if (!body) return res.status(404).json({ ok: false, error: 'resource_not_found' });
    return res.status(200).json(body);
  } catch (error) {
    console.error('[GET /api/resources/:resourceVersionId] failed', error);
    return res.status(503).json({ ok: false, error: 'resource_catalog_unavailable' });
  }
});

function decodedResourceVersionId(value: string | string[] | undefined): string {
  const raw = Array.isArray(value) ? value[0] ?? '' : value ?? '';
  return decodeURIComponent(raw).trim();
}

function inlineContentDisposition(filename: string): string {
  const ascii = filename.replace(/[^A-Za-z0-9._ -]/g, '_').replace(/["\\]/g, '_').slice(0, 180) || 'document.pdf';
  const unicodeSafe = filename.replace(/[\uD800-\uDFFF]/g, '_');
  return `inline; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(unicodeSafe)}`;
}
