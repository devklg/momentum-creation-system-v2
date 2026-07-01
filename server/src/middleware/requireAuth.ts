/**
 * Authentication middleware.
 *
 * `requireAuth` — reads the JWT cookie, verifies it, and attaches the
 * decoded session claims to req.session. Responds 401 if missing/invalid.
 *
 * `requireAdmin` — same as requireAuth, then enforces the BA-ID gate from
 * ADMIN_TMAG_IDS env. Match -> next. No match -> hard 403 with a generic error
 * (no indication that /admin exists). Logs the attempt for the audit trail.
 *
 * Per ADMIN Design Section A.2 (Locked Chat #85).
 */

import type { Request, Response, NextFunction } from 'express';
import { env } from '../env.js';
import { verifySession, type SessionClaims } from '../services/session.js';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      session?: SessionClaims;
    }
  }
}

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const cookieName = env.JWT_COOKIE_NAME;
  const token = (req.cookies as Record<string, string> | undefined)?.[cookieName];
  if (!token) {
    res.status(401).json({ ok: false, error: 'Not authenticated.' });
    return;
  }
  const claims = await verifySession(token);
  if (!claims) {
    res.status(401).json({ ok: false, error: 'Session invalid or expired.' });
    return;
  }
  req.session = claims;
  next();
}

export async function requireAdmin(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const cookieName = env.JWT_COOKIE_NAME;
  const token = (req.cookies as Record<string, string> | undefined)?.[cookieName];
  if (!token) {
    // No session at all — generic 403 so /admin's existence isn't leaked.
    res.status(403).json({ ok: false, error: 'Not found.' });
    return;
  }
  const claims = await verifySession(token);
  if (!claims) {
    res.status(403).json({ ok: false, error: 'Not found.' });
    return;
  }

  const allowed =
    env.ADMIN_TMAG_IDS.includes(claims.threeBaId) ||
    env.ADMIN_TMAG_IDS.includes(claims.tmagId);

  if (!allowed) {
    // Audit-log the denied attempt (per ADMIN Design A.2). Best-effort; never
    // block the response on logging.
    // eslint-disable-next-line no-console
    console.warn(
      `[admin-gate] DENIED tmagId=${claims.tmagId} threeBaId=${claims.threeBaId} path=${req.path} ua="${req.get('user-agent') ?? ''}"`,
    );
    res.status(403).json({ ok: false, error: 'Not found.' });
    return;
  }

  req.session = claims;
  next();
}
