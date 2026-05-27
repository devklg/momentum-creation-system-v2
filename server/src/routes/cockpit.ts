/**
 * GET /api/cockpit/* — the BA-facing cockpit read endpoints (Chat #121).
 *
 * The READ side of the invitation module. The Chat #119/#120 spine writes
 * prospects, sentAt, and the invitation_activity timeline; these routes read
 * them back so the BA sees who they invited, each prospect's status, and the
 * per-prospect activity.
 *
 * Routes:
 *   GET /api/cockpit/invites    the BA's My Invites list + activity timeline
 *   GET /api/cockpit/summary    headline counts + My Sponsor card
 *
 * Gating: requireAuth + requireMichaelComplete (BA-facing gated routes per
 * index.ts canonical pattern). A BA reaches the cockpit only after Michael
 * onboarding is complete.
 *
 * Sponsor immutability (locked-spec 3.5): the BA id is read from
 * req.session.baId — the authed session — NEVER from a query param or body.
 * The domain filters every read on that id, so a BA can only ever see their
 * own prospects.
 */

import { Router } from 'express';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireMichaelComplete } from '../middleware/requireMichaelComplete.js';
import { getMyInvites, getCockpitSummary } from '../domain/cockpit.js';
import { getCockpitTodaysActions } from '../domain/todaysActions.js';
import { buildCockpitProspectListPdf } from '../domain/cockpitPrint.js';

export const cockpitRoutes: Router = Router();

/**
 * GET /api/cockpit/invites — the BA's own prospects, newest first, with the
 * per-prospect activity timeline keyed by prospectId.
 */
cockpitRoutes.get('/invites', requireAuth, requireMichaelComplete, async (req, res) => {
  const baId = req.session?.baId;
  if (!baId) return res.status(401).json({ ok: false, error: 'Not authenticated.' });

  try {
    const payload = await getMyInvites(baId);
    return res.status(200).json(payload);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[GET /api/cockpit/invites] failed', err);
    return res.status(500).json({ ok: false, error: 'server_error' });
  }
});

/**
 * GET /api/cockpit/summary — headline funnel counts + the My Sponsor card.
 */
cockpitRoutes.get('/summary', requireAuth, requireMichaelComplete, async (req, res) => {
  const baId = req.session?.baId;
  if (!baId) return res.status(401).json({ ok: false, error: 'Not authenticated.' });

  try {
    const payload = await getCockpitSummary(baId);
    return res.status(200).json(payload);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[GET /api/cockpit/summary] failed', err);
    return res.status(500).json({ ok: false, error: 'server_error' });
  }
});

/**
 * GET /api/cockpit/todays-actions — derived urgency-ordered list (Chat #134,
 * wireframe 3.3, locked-spec 1.8/1.9). Callbacks > due follow-ups > expiring
 * windows. Always includes the bias prompt for the empty state.
 */
cockpitRoutes.get(
  '/todays-actions',
  requireAuth,
  requireMichaelComplete,
  async (req, res) => {
    const baId = req.session?.baId;
    if (!baId) return res.status(401).json({ ok: false, error: 'Not authenticated.' });

    try {
      const payload = await getCockpitTodaysActions(baId);
      return res.status(200).json(payload);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[GET /api/cockpit/todays-actions] failed', err);
      return res.status(500).json({ ok: false, error: 'server_error' });
    }
  },
);

/**
 * GET /api/cockpit/invites/print.pdf — the BA's prospect list as a
 * brand-locked PDF (Chat #142). Same sponsor-scoped read as /invites
 * (listInvitesForBA via the print builder); a BA can only ever print their
 * own prospects (locked-spec 3.5). Compliance: .team funnel-status artifact,
 * no income/placement claims (locked-spec 3.10).
 */
cockpitRoutes.get(
  '/invites/print.pdf',
  requireAuth,
  requireMichaelComplete,
  async (req, res) => {
    const baId = req.session?.baId;
    if (!baId) return res.status(401).json({ ok: false, error: 'Not authenticated.' });

    try {
      const { buffer, filename } = await buildCockpitProspectListPdf(baId);
      res.status(200);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Length', String(buffer.length));
      res.setHeader('Cache-Control', 'no-store');
      return res.end(buffer);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[GET /api/cockpit/invites/print.pdf] failed', err);
      return res.status(500).json({ ok: false, error: 'server_error' });
    }
  },
);
