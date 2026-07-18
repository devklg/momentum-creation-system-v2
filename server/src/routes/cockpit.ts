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

import { Router, type Response } from 'express';
import type { McsJoinEvent, McsKongaPlacementEvent } from '@momentum/shared';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireSteveComplete } from '../middleware/requireSteveComplete.js';
import {
  getMyInvites,
  getCockpitSummary,
  getCockpitTodaysActions,
  getProspectMomentumViewer,
  getTeamCalendar,
  getTeamLaunchCenter,
} from '../domain/cockpit.js';
import { buildCockpitProspectListPdf } from '../domain/cockpitPrint.js';
import { getUnifiedFollowUpQueue } from '../domain/followUpQueue.js';
import {
  getKongaTeamLeaderboard,
  getKongaTeamSnapshot,
  KongaTeamError,
} from '../domain/kongaTeam.js';
import {
  subscribeJoins,
  subscribeKongaPlacements,
} from '../services/poolEvents.js';

export const cockpitRoutes: Router = Router();

const KONGA_SSE_PING_INTERVAL_MS = 30_000;

function kongaSseFrame(event: string, data: unknown, id?: string): string {
  const lines: string[] = [];
  if (id) lines.push(`id: ${id}`);
  lines.push(`event: ${event}`);
  lines.push(`data: ${JSON.stringify(data)}`);
  lines.push('', '');
  return lines.join('\n');
}

function sendKongaReadError(res: Response, error: unknown) {
  if (error instanceof KongaTeamError && error.code === 'konga_team_member_not_found') {
    return res.status(404).json({ ok: false, error: 'konga_team_member_not_found' });
  }
  // eslint-disable-next-line no-console
  console.error('[GET /api/cockpit/konga] failed', error);
  return res.status(500).json({ ok: false, error: 'server_error' });
}

/**
 * Authenticated BA Konga snapshot. Leaderboard data is deliberately absent;
 * it has its own members-only endpoint below.
 */
cockpitRoutes.get('/konga', requireAuth, requireSteveComplete, async (req, res) => {
  const tmagId = req.session?.tmagId;
  if (!tmagId) return res.status(401).json({ ok: false, error: 'Not authenticated.' });
  try {
    const payload = await getKongaTeamSnapshot(tmagId);
    res.set('Cache-Control', 'private, no-store');
    return res.status(200).json(payload);
  } catch (error) {
    return sendKongaReadError(res, error);
  }
});

/** Members-only lifetime count of provable holding-tank placement events. */
cockpitRoutes.get(
  '/konga/leaderboard',
  requireAuth,
  requireSteveComplete,
  async (req, res) => {
    const tmagId = req.session?.tmagId;
    if (!tmagId) return res.status(401).json({ ok: false, error: 'Not authenticated.' });
    try {
      const payload = await getKongaTeamLeaderboard(tmagId);
      res.set('Cache-Control', 'private, no-store');
      return res.status(200).json(payload);
    } catch (error) {
      return sendKongaReadError(res, error);
    }
  },
);

/**
 * Authenticated `.team` live channel. In-process events are rehydrated from
 * the persisted snapshot on every reconnect; no leaderboard is serialized.
 */
cockpitRoutes.get(
  '/konga/stream',
  requireAuth,
  requireSteveComplete,
  async (req, res) => {
    const tmagId = req.session?.tmagId;
    if (!tmagId) return res.status(401).json({ ok: false, error: 'Not authenticated.' });

    let snapshot;
    try {
      snapshot = await getKongaTeamSnapshot(tmagId);
    } catch (error) {
      return sendKongaReadError(res, error);
    }

    res.status(200);
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'private, no-store, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();
    res.write(kongaSseFrame('snapshot', snapshot));

    const placementSub = subscribeKongaPlacements((event: McsKongaPlacementEvent) => {
      try { res.write(kongaSseFrame('placement', event, event.eventId)); } catch { /* teardown owns cleanup */ }
    });
    const joinSub = subscribeJoins((event: McsJoinEvent) => {
      try { res.write(kongaSseFrame('join', event, event.eventId)); } catch { /* teardown owns cleanup */ }
    });
    const heartbeat = setInterval(() => {
      try { res.write(kongaSseFrame('ping', { at: new Date().toISOString() })); } catch { /* teardown owns cleanup */ }
    }, KONGA_SSE_PING_INTERVAL_MS);

    let closed = false;
    const teardown = () => {
      if (closed) return;
      closed = true;
      clearInterval(heartbeat);
      placementSub.unsubscribe();
      joinSub.unsubscribe();
    };
    req.on('close', teardown);
    req.on('aborted', teardown);
    res.on('close', teardown);
    return;
  },
);

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
 * GET /api/cockpit/follow-up-queue — P2-107 cross-source human action queue.
 * Includes prospect + VM/RVM callbacks and active CRM reminders. Read-only;
 * owner identity comes exclusively from the authenticated session.
 */
cockpitRoutes.get(
  '/follow-up-queue',
  requireAuth,
  requireSteveComplete,
  async (req, res) => {
    const tmagId = req.session?.tmagId;
    if (!tmagId) return res.status(401).json({ ok: false, error: 'Not authenticated.' });

    try {
      return res.status(200).json(await getUnifiedFollowUpQueue(tmagId));
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[GET /api/cockpit/follow-up-queue] failed', err);
      return res.status(500).json({ ok: false, error: 'server_error' });
    }
  },
);

/**
 * GET /api/cockpit/team-calendar — read-only Team Calendar rail. Brief 4
 * limits this slice to existing webinar events; Brief 5's 3-way bookings will
 * fill the compatible placeholder returned by the domain.
 */
cockpitRoutes.get(
  '/team-calendar',
  requireAuth,
  requireSteveComplete,
  async (req, res) => {
    const tmagId = req.session?.tmagId;
    if (!tmagId) return res.status(401).json({ ok: false, error: 'Not authenticated.' });

    try {
      const payload = await getTeamCalendar(tmagId);
      return res.status(200).json(payload);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[GET /api/cockpit/team-calendar] failed', err);
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
