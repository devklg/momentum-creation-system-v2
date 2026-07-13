import { Router } from 'express';
import type { McsResourceCenterResponse } from '@momentum/shared';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireSteveComplete } from '../middleware/requireSteveComplete.js';
import { listResourceCenterResources } from '../domain/resourceCenter.js';
import { getResourceCenterResourceDetail } from '../domain/resourceCenter.js';

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
