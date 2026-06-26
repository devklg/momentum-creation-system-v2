/**
 * GET /api/preview — the sandboxed token resolver (Chat #134, wireframe 3.7).
 *
 * Returns a PreviewResolvedTokenPayload for the authed session BA. The
 * payload is shaped identically to a real ResolvedTokenPayload (so the
 * .com surface components render it unchanged) but flagged `preview: true`
 * and carries a sentinel token `PREVIEW-<baId>` that no real invite token
 * will ever match.
 *
 * SANDBOX INVARIANT (the verify-by-read-back contract):
 *   - This route performs ZERO writes. No prospect record. No invite-token
 *     record. No pool placement. No counter increment. No SSE emit. No SMS.
 *   - Reads are limited to findBAByBaId, findNextUpcomingEvent, and a
 *     point-read of the pool counter (for the dashboard's "next position"
 *     card). All three are pure reads.
 *   - Downstream /api/p/<sentinel>/* calls from the .com components 404
 *     against the sentinel (real /api/p resolver does not recognize it) —
 *     which is exactly the design: a preview must consume zero real state.
 *
 * Gating: BA-FACING — requireAuth + requireSteveComplete. A BA can only
 * preview their OWN replicated page; the BA shown in the synthesized
 * payload is always derived from the session, not the request.
 */

import { Router } from 'express';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireSteveComplete } from '../middleware/requireSteveComplete.js';
import { synthesizePreviewPayload } from '../domain/previewToken.js';

export const previewRoutes: Router = Router();

previewRoutes.get(
  '/',
  requireAuth,
  requireSteveComplete,
  async (req, res) => {
    const session = req.session;
    if (!session) {
      // requireAuth should have attached it — fail closed.
      return res.status(401).json({ ok: false, error: 'Not authenticated.' });
    }
    try {
      const payload = await synthesizePreviewPayload(session.baId);
      if (!payload) {
        return res.status(404).json({ ok: false, error: 'session_ba_not_found' });
      }
      return res.status(200).json(payload);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[GET /api/preview] synthesis failed', err);
      return res.status(500).json({ ok: false, error: 'server_error' });
    }
  },
);
