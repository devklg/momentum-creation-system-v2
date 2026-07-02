/**
 * Prospect session service (locked-spec 3.17).
 *
 * Opaque server-side session for the temporary prospect account.
 * NOT a JWT — the cookie carries only a random session id and the
 * server resolves it via Mongo. A leaked cookie reveals nothing
 * about the system (no claims, no algorithm, no payload to inspect),
 * and revocation is a single document delete.
 *
 * Scope: cookie is set on `.teammagnificent.com` in production. It
 * is NOT shared with `.teammagnificent.team` (the BA cookie keeps
 * its own scope per env.JWT_COOKIE_DOMAIN). The .com surface gets
 * its own identity layer; the BA surface keeps its own.
 *
 * Cookie name: `mcs_prospect_session` (distinct from `mcs_session`
 * used by BA / admin auth).
 *
 * TTL: aligned to the account's expiresAt (the 8-week flush
 * boundary). The cookie maxAge is computed as `account.expiresAt -
 * now`, so a session naturally dies when the account dies. There
 * is no mid-stream sliding-window extension — 8 weeks is the
 * hard ceiling.
 */

import { randomBytes } from 'node:crypto';
import type { CookieOptions, Request, Response } from 'express';
import { persistenceCall } from './persistence/dispatch.js';
import { env } from '../env.js';

const MONGO_DB = 'momentum';
const SESSIONS_COLLECTION = 'tmag_prospect_sessions';

const COOKIE_NAME = 'mcs_prospect_session';

/**
 * Cookie domain on .com in production. Distinct from the BA cookie's
 * .teammagnificent.team domain so the two identity surfaces stay
 * separate (the BA cookie must NOT propagate to .com, and vice
 * versa). Empty in dev so localhost works without DNS gymnastics.
 */
const PROSPECT_COOKIE_DOMAIN = '.teammagnificent.com';

export interface ProspectSessionRow {
  sessionId: string;
  accountId: string;
  prospectId: string;
  tokenId: string;
  sponsorTmagId: string;
  createdAt: string;
  expiresAt: string;
}

/**
 * Generate a random opaque session id. 32 chars from base64url.
 * Same shape as the magic-link token but a different namespace —
 * sessions live in their own collection.
 */
function randomSessionId(): string {
  return randomBytes(24)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
    .slice(0, 32);
}

function cookieOpts(maxAgeMs: number): CookieOptions {
  return {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: maxAgeMs,
    ...(env.NODE_ENV === 'production'
      ? { domain: PROSPECT_COOKIE_DOMAIN }
      : {}),
  };
}

/**
 * Create the session row in Mongo and set the cookie on the response.
 * Called from the magic-link redeem path after redeem confirms.
 *
 * maxAge is computed from the account's expiresAt — a session that
 * outlives its account would be inert anyway (any /p/{token} resolve
 * would see the token expired and bounce to the 410 view), but
 * keeping the cookie ceiling honest avoids a stale cookie sitting
 * in the browser past the 8-week window.
 */
export async function openProspectSession(
  res: Response,
  input: {
    accountId: string;
    prospectId: string;
    tokenId: string;
    sponsorTmagId: string;
    /** Account's expiresAt — the session ceiling. */
    accountExpiresAt: string;
  },
): Promise<string> {
  const sessionId = randomSessionId();
  const createdAt = new Date().toISOString();

  const row: ProspectSessionRow = {
    sessionId,
    accountId: input.accountId,
    prospectId: input.prospectId,
    tokenId: input.tokenId,
    sponsorTmagId: input.sponsorTmagId,
    createdAt,
    expiresAt: input.accountExpiresAt,
  };

  await persistenceCall('mongodb', 'insert', {
    database: MONGO_DB,
    collection: SESSIONS_COLLECTION,
    documents: [{ _id: sessionId, ...row }],
  });

  // Compute remaining lifetime so the cookie dies with the account.
  // If the account expiresAt is somehow already past, fall through to
  // a one-minute window; the next /p/{token} resolve will redirect
  // to the F.2 expired view and the cookie will be cleared.
  const remainingMs = Math.max(
    60_000,
    new Date(input.accountExpiresAt).getTime() - Date.now(),
  );
  res.cookie(COOKIE_NAME, sessionId, cookieOpts(remainingMs));

  return sessionId;
}

/**
 * Look up the session referenced by the request's cookie. Returns
 * null if the cookie is missing, the session row is missing, or
 * the session has expired.
 *
 * The route layer uses this to decorate /p/{token} resolves with
 * a "returning prospect" hint (e.g. show "welcome back" copy)
 * but the session is NEVER used to bypass token-level checks —
 * an enrolled or expired token still returns 409/410 even with
 * a valid session.
 */
export async function readProspectSession(
  req: Request,
): Promise<ProspectSessionRow | null> {
  const sessionId = (req.cookies as Record<string, string> | undefined)?.[
    COOKIE_NAME
  ];
  if (!sessionId || typeof sessionId !== 'string') return null;

  const result = await persistenceCall<{ documents: ProspectSessionRow[] }>(
    'mongodb',
    'query',
    {
      database: MONGO_DB,
      collection: SESSIONS_COLLECTION,
      filter: { sessionId },
      limit: 1,
    },
  );
  const row = result.documents[0];
  if (!row) return null;
  const expiresAtMs = new Date(row.expiresAt).getTime();
  if (Number.isFinite(expiresAtMs) && expiresAtMs <= Date.now()) {
    return null;
  }
  return row;
}

/**
 * Clear the prospect session cookie and best-effort delete the row.
 * Reserved for a future explicit logout surface; not wired in the
 * Chat #131 build because there is no `/p/logout` UI today. The
 * session naturally expires with the account.
 */
export async function closeProspectSession(
  res: Response,
  sessionId: string,
): Promise<void> {
  try {
    await persistenceCall('mongodb', 'delete', {
      database: MONGO_DB,
      collection: SESSIONS_COLLECTION,
      filter: { sessionId },
    });
  } catch {
    // Best-effort; the cookie clear below is what matters to the client.
  }
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    ...(env.NODE_ENV === 'production'
      ? { domain: PROSPECT_COOKIE_DOMAIN }
      : {}),
  });
}

/** Exported for the route layer to reference in a single place. */
export const PROSPECT_COOKIE_NAME = COOKIE_NAME;
