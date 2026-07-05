/**
 * BA-facing Product Gallery read endpoint.
 *
 * Gated like other .team routes; the gallery is training/member content, never
 * prospect-facing .com content.
 */

import { Router } from 'express';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireSteveComplete } from '../middleware/requireSteveComplete.js';
import { listContentVideos } from '../domain/contentVideos.js';
import type { McsContentVideosResponse } from '@momentum/shared';

export const contentVideoRoutes: Router = Router();

contentVideoRoutes.get('/videos', requireAuth, requireSteveComplete, async (_req, res) => {
  try {
    const sections = await listContentVideos();
    const body: McsContentVideosResponse = { ok: true, sections };
    res.status(200).json(body);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[GET /api/content/videos] failed', err);
    res.status(500).json({ ok: false, error: 'server_error' });
  }
});
