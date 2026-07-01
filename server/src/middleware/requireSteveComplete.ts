/**
 * requireSteveComplete — hard 403 onboarding gate.
 *
 * Steve owns New BA Discovery + Success Profile. Until Steve's discovery is
 * complete, authenticated BA routes stay locked except the small set that lets
 * a new BA accept welcome, view the Launch Center, complete Steve, and start
 * the first Fast Start product module.
 */

import type { Request, Response, NextFunction } from 'express';
import { isSteveDiscoveryComplete } from '../domain/steve-success-interview.js';

const STEVE_GATE_WHITELIST: readonly string[] = [
  '/api/steve/discovery/state',
  '/api/steve/discovery/script',
  '/api/training/day-1',
  '/api/profile',
  '/api/auth/logout',
  '/api/auth/me',
  '/api/health',
  '/api/cockpit/launch',
  '/api/training/fast-start/progress',
  '/api/training/fast-start/modules/1',
];

function pathInWhitelist(path: string): boolean {
  return STEVE_GATE_WHITELIST.some((p) => path === p || path.startsWith(p + '/'));
}

function requestPathCandidates(req: Request): string[] {
  const originalPath = req.originalUrl.split('?')[0] ?? req.originalUrl;
  return [originalPath, req.path];
}

export async function requireSteveComplete(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  if (requestPathCandidates(req).some(pathInWhitelist)) {
    next();
    return;
  }

  const session = req.session;
  if (!session) {
    res.status(401).json({ ok: false, error: 'Not authenticated.' });
    return;
  }

  try {
    const done = await isSteveDiscoveryComplete(session.tmagId);
    if (!done) {
      res.status(403).json({
        ok: false,
        error: 'Locked. Complete your Steve discovery first.',
        code: 'STEVE_GATE_CLOSED',
      });
      return;
    }
    next();
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown';
    res.status(500).json({ ok: false, error: `Gate check failed: ${msg}` });
  }
}
