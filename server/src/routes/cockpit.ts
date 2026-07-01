/**
 * GET /api/cockpit/* — the BA-facing cockpit read endpoints (Chat #121).
 *
 * The READ side of the invitation module. The Chat #119/#120 spine writes
 * prospects, sentAt, and the invitation_activity timeline; these routes read
 * them back so the BA sees who they invited, each prospect's status, and the
 * per-prospect activity.
 *
 * Routes:
 *   GET /api/cockpit/launch     auth-only Launch Center projection for new BAs
 *   GET /api/cockpit/invites    the BA's My Invites list + activity timeline
 *   GET /api/cockpit/summary    headline counts + My Sponsor card
 *
 * Gating: /launch is requireAuth only so a new BA can see their current
 * onboarding action before the Steve gate. Operational PMV/CRM reads remain
 * requireAuth + requireSteveComplete.
 *
 * Sponsor immutability (locked-spec 3.5): the BA id is read from
 * req.session.tmagId — the authed session — NEVER from a query param or body.
 * The domain filters every read on that id, so a BA can only ever see their
 * own prospects.
 */

import { Router } from 'express';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireSteveComplete } from '../middleware/requireSteveComplete.js';
import {
  getMyInvites,
  getCockpitSummary,
  getCockpitTodaysActions,
  getProspectMomentumViewer,
  getTeamLaunchCenter,
} from '../domain/cockpit.js';
import { buildCockpitProspectListPdf } from '../domain/cockpitPrint.js';

export const cockpitRoutes: Router = Router();

/**
 * GET /api/cockpit/launch — Launch Center projection for new BAs. Auth-only;
 * it reads Michael status without unlocking the operational PMV early.
 */
cockpitRoutes.get('/launch', requireAuth, async (req, res) => {
  const tmagId = req.session?.tmagId;
  if (!tmagId) return res.status(401).json({ ok: false, error: 'Not authenticated.' });

  try {
    const payload = await getTeamLaunchCenter(tmagId);
    return res.status(200).json(payload);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[GET /api/cockpit/launch] failed', err);
    return res.status(500).json({ ok: false, error: 'server_error' });
  }
});

/**
 * GET /api/cockpit/invites — the BA's own prospects, newest first, with the
 * per-prospect activity timeline keyed by prospectId.
 */
cockpitRoutes.get('/invites', requireAuth, requireSteveComplete, async (req, res) => {
  const tmagId = req.session?.tmagId;
  if (!tmagId) return res.status(401).json({ ok: false, error: 'Not authenticated.' });

  try {
    const payload = await getMyInvites(tmagId);
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
cockpitRoutes.get('/summary', requireAuth, requireSteveComplete, async (req, res) => {
  const tmagId = req.session?.tmagId;
  if (!tmagId) return res.status(401).json({ ok: false, error: 'Not authenticated.' });

  try {
    const payload = await getCockpitSummary(tmagId);
    return res.status(200).json(payload);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[GET /api/cockpit/summary] failed', err);
    return res.status(500).json({ ok: false, error: 'server_error' });
  }
});

/**
 * GET /api/cockpit/pmv — BA-scoped Prospect Momentum Viewer projection.
 *
 * Returns focusQueue + table rows from the same deterministic rules the
 * cockpit Today's Actions card uses. Read-only; no outreach is sent.
 */
cockpitRoutes.get('/pmv', requireAuth, requireSteveComplete, async (req, res) => {
  const tmagId = req.session?.tmagId;
  if (!tmagId) return res.status(401).json({ ok: false, error: 'Not authenticated.' });

  try {
    const payload = await getProspectMomentumViewer(tmagId);
    return res.status(200).json(payload);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[GET /api/cockpit/pmv] failed', err);
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
  requireSteveComplete,
  async (req, res) => {
    const tmagId = req.session?.tmagId;
    if (!tmagId) return res.status(401).json({ ok: false, error: 'Not authenticated.' });

    try {
      const payload = await getCockpitTodaysActions(tmagId);
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
  requireSteveComplete,
  async (req, res) => {
    const tmagId = req.session?.tmagId;
    if (!tmagId) return res.status(401).json({ ok: false, error: 'Not authenticated.' });

    try {
      const { buffer, filename } = await buildCockpitProspectListPdf(tmagId);
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
