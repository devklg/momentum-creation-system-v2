/**
 * requireMichaelComplete — hard 403 gate.
 *
 * Until the BA's Michael interview is `completed`, every authenticated route
 * EXCEPT the whitelisted few responds with 403. Whitelist lives next to the
 * domain (MICHAEL_GATE_WHITELIST in domain/michael-schedule.ts).
 *
 * Per Chat #97 lock:
 *   - Hard 403 on everything except /api/michael/*, /api/training/day-1,
 *     /api/profile, /api/auth/me, /api/auth/logout, /api/health.
 *
 * Mounted AFTER requireAuth (gate assumes session is already attached).
 *
 * MOUNT PATTERN (per route, NOT global):
 *   Global mount would also run the DB check on /api/admin/* (which has its
 *   own requireAdmin gate that founders pass without needing Michael) and on
 *   unauthenticated routes like /api/health. Per-route mount keeps the
 *   surface area explicit. Canonical usage when a new authenticated
 *   BA-facing route is added (cockpit, fast-start, training/day-2+,
 *   invitations, etc.):
 *
 *     import { requireAuth } from '../middleware/requireAuth.js';
 *     import { requireMichaelComplete } from '../middleware/requireMichaelComplete.js';
 *
 *     router.get('/cockpit', requireAuth, requireMichaelComplete, handler);
 *
 * Pre-gate routes (welcome, michael, auth, admin, health) MUST NOT use this
 * middleware — the new BA hasn't completed Michael yet and the welcome flow
 * is what triggers Michael in the first place.
 */

import type { Request, Response, NextFunction } from 'express';
import {
  isInterviewComplete,
  MICHAEL_GATE_WHITELIST,
} from '../domain/michael-schedule.js';

function pathInWhitelist(path: string): boolean {
  return MICHAEL_GATE_WHITELIST.some((p) => path === p || path.startsWith(p + '/'));
}

export async function requireMichaelComplete(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  // Whitelisted paths always pass.
  if (pathInWhitelist(req.path)) {
    next();
    return;
  }
  const session = req.session;
  if (!session) {
    // requireAuth should have attached it; if not, fail closed.
    res.status(401).json({ ok: false, error: 'Not authenticated.' });
    return;
  }
  try {
    const done = await isInterviewComplete(session.baId);
    if (!done) {
      res.status(403).json({
        ok: false,
        error: 'Locked. Complete your Michael interview first.',
        code: 'MICHAEL_GATE_CLOSED',
      });
      return;
    }
    next();
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown';
    // Fail closed on infrastructure errors — do not silently allow.
    res.status(500).json({ ok: false, error: `Gate check failed: ${msg}` });
  }
}
