import { Router } from 'express';
import type { McsResourceCenterResponse } from '@momentum/shared';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireSteveComplete } from '../middleware/requireSteveComplete.js';
import { listResourceCenterResources } from '../domain/resourceCenter.js';

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
