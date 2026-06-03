/**
 * /p/login routes (locked-spec 3.17).
 *
 * Layer 3 of the prospect re-entry build (Chat #131). Closes the
 * prospect-re-entry open question from Chat #125.
 *
 *   POST /api/p/login/start    — body: { phone } → SMS magic link(s)
 *   POST /api/p/login/redeem   — body: { linkToken } → session + tokenId
 *
 * Anti-probing posture (3.17):
 *   /start ALWAYS returns the same opaque success body regardless of
 *   whether the phone matched zero, one, or multiple accounts. The
 *   page copy on .com mirrors this: "If that phone is on file, you'll
 *   receive a text shortly." This prevents anyone holding a phone
 *   book from probing the system for prospect presence.
 *
 *   /redeem returns one generic failure for invalid_link, expired_link,
 *   and already_used so a stale or guessed link reveals nothing about
 *   which case occurred.
 *
 * Rate limiting (in-memory, single-instance):
 *   Per IP — 10 /start hits per 15 minutes.
 *   Per phone-hash — 5 /start hits per 60 minutes (the link's click
 *     window — allowing more would be an SMS amplification vector).
 *   Per IP — 30 /redeem hits per 15 minutes (defense against
 *     online brute-force; the 32-char alphabet space makes this
 *     redundant but it's cheap).
 *
 * Sponsor immutability (3.5):
 *   Every link issued points at an account whose sponsorBaId was
 *   stamped from the inviting token at video_complete and never
 *   recomputed. The redeem path opens a session bound to that
 *   account; the resulting /p/{token} resolve uses the token's
 *   sponsor for personalization. Body inputs cannot influence
 *   which BA the prospect re-enters under.
 */

import { Router, type Request } from 'express';
import { z } from 'zod';
import { findBAByBaId } from '../domain/ba.js';
import { findAccountById, findAccountByPhoneAndCode } from '../domain/prospectAccount.js';
import {
  hashPhone,
  issueLinksForPhone,
  MAGIC_LINK_TOKEN_LEN,
  redeemLink,
} from '../domain/prospectMagicLink.js';
import { normalizePhone } from '../domain/prospectAccount.js';
import {
  openProspectSession,
  readProspectSession,
  closeProspectSession,
} from '../services/prospectSession.js';
import type {
  ProspectLoginRedeemError,
  ProspectLoginRedeemResponse,
  ProspectLoginStartResponse,
} from '@momentum/shared';

export const prospectLoginRoutes: Router = Router();

// ─── Rate limiter ────────────────────────────────────────────────────
//
// In-memory sliding-window counter. Single-instance only; if/when the
// server scales horizontally this moves to Redis via the gateway.
// Each key tracks an array of hit timestamps within the window.

interface RateLimitConfig {
  /** Window length in ms. */
  windowMs: number;
  /** Max hits allowed per key inside the window. */
  max: number;
}

const buckets = new Map<string, number[]>();

/** Returns true when the hit is allowed; false when rate-limited. */
function rateLimitHit(key: string, cfg: RateLimitConfig): boolean {
  const now = Date.now();
  const cutoff = now - cfg.windowMs;
  const hits = (buckets.get(key) ?? []).filter((t) => t > cutoff);
  if (hits.length >= cfg.max) {
    buckets.set(key, hits);
    return false;
  }
  hits.push(now);
  buckets.set(key, hits);
  return true;
}

const START_PER_IP: RateLimitConfig = { windowMs: 15 * 60 * 1000, max: 10 };
const START_PER_PHONE: RateLimitConfig = { windowMs: 60 * 60 * 1000, max: 5 };
const REDEEM_PER_IP: RateLimitConfig = { windowMs: 15 * 60 * 1000, max: 30 };

function clientIp(req: Request): string {
  const fwd = req.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0]?.trim() || req.ip || 'unknown';
  return req.ip || 'unknown';
}

/**
 * Derive the public .com base URL for the link embedded in the SMS.
 *
 * Order of preference:
 *   1. Request `Origin` header (set by the browser when apps/com
 *      calls /api/p/login/start — works in dev and prod).
 *   2. COM_PUBLIC_URL env if set.
 *   3. Empty string fallback (which produces a relative-path link;
 *      caller's SMS becomes `/p/login/r/...` only and may not work
 *      in an SMS client — but the request still succeeds).
 *
 * Why not derive from req.protocol + req.host: the server runs on
 * port 7700; apps/com runs on 7701. The host header on the proxied
 * request is the server's host, not the page the prospect is on.
 * Origin carries the page's URL through the proxy correctly.
 */
function comBaseUrl(req: Request): string {
  const origin = req.get('origin');
  if (origin) return origin.replace(/\/+$/, '');
  const envBase = process.env['COM_PUBLIC_URL'];
  if (envBase) return envBase.replace(/\/+$/, '');
  return '';
}

// ─── POST /api/p/login/start ────────────────────────────────────────

const StartBody = z.object({
  phone: z.string().min(4).max(40),
});

const OPAQUE_OK: ProspectLoginStartResponse = { ok: true };

prospectLoginRoutes.post('/start', async (req, res) => {
  const ip = clientIp(req);
  if (!rateLimitHit(`start_ip:${ip}`, START_PER_IP)) {
    // Even rate-limited responses are opaque. Tell the client we're
    // throttled (so the UI can render a soft retry hint) without
    // revealing whether the phone was on file.
    return res.status(429).json({ ok: false, error: 'rate_limited' });
  }

  const parsed = StartBody.safeParse(req.body);
  if (!parsed.success) {
    // Even malformed input gets opaque success — refusing here would
    // leak whether the .com client is the one talking to us.
    return res.status(200).json(OPAQUE_OK);
  }

  const e164 = normalizePhone(parsed.data.phone);
  if (!e164) {
    return res.status(200).json(OPAQUE_OK);
  }

  // Per-phone rate-limit. Use the hash so the bucket key matches what's
  // already stored on link rows for cross-reference / forensics.
  if (!rateLimitHit(`start_phone:${hashPhone(e164)}`, START_PER_PHONE)) {
    return res.status(429).json({ ok: false, error: 'rate_limited' });
  }

  // Resolve BA first name without circular-importing the BA domain
  // into the magic-link domain.
  const resolveBaFirstName = async (baId: string): Promise<string | null> => {
    const ba = await findBAByBaId(baId);
    return ba?.firstName ?? null;
  };

  try {
    await issueLinksForPhone({
      rawPhone: e164,
      resolveBaFirstName,
      baseUrl: comBaseUrl(req),
    });
    // The counts (attempted, sent) are intentionally NOT included in
    // the response — opaque success.
    return res.status(200).json(OPAQUE_OK);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[POST /api/p/login/start] failed', err);
    // Even on failure we return opaque success to avoid leaking. A
    // 500 here would tell an attacker the phone DID match (because
    // the failure happened past lookup). The /redeem path catches
    // unredeemable links cleanly enough.
    return res.status(200).json(OPAQUE_OK);
  }
});

// ─── POST /api/p/login/redeem ───────────────────────────────────────

const RedeemBody = z.object({
  linkToken: z
    .string()
    .min(MAGIC_LINK_TOKEN_LEN)
    .max(MAGIC_LINK_TOKEN_LEN)
    .regex(/^[A-Za-z0-9_-]+$/),
});

const GENERIC_REDEEM_ERROR: ProspectLoginRedeemError = {
  ok: false,
  error: 'invalid_link',
};

prospectLoginRoutes.post('/redeem', async (req, res) => {
  const ip = clientIp(req);
  if (!rateLimitHit(`redeem_ip:${ip}`, REDEEM_PER_IP)) {
    return res.status(429).json({ ok: false, error: 'rate_limited' });
  }

  const parsed = RedeemBody.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(GENERIC_REDEEM_ERROR);
  }

  try {
    const result = await redeemLink(parsed.data.linkToken);
    if (!result.ok) {
      // Collapse all three failure modes into one client-facing shape
      // so the page copy never leaks which case occurred.
      return res.status(400).json(GENERIC_REDEEM_ERROR);
    }

    // Look up the account to pull sponsorBaId + accountExpiresAt onto
    // the session row. Missing account here means the magic link
    // resolved cleanly but the underlying account row is gone — treat
    // as invalid_link (the link is dead).
    const account = await findAccountById(result.accountId);
    if (!account) {
      return res.status(400).json(GENERIC_REDEEM_ERROR);
    }

    await openProspectSession(res, {
      accountId: account.accountId,
      prospectId: account.prospectId,
      tokenId: account.tokenId,
      sponsorBaId: account.sponsorBaId,
      accountExpiresAt: account.expiresAt,
    });

    const response: ProspectLoginRedeemResponse = {
      ok: true,
      tokenId: result.tokenId,
    };
    return res.status(200).json(response);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[POST /api/p/login/redeem] failed', err);
    return res.status(500).json({ ok: false, error: 'server_error' });
  }
});

// ─── POST /api/p/login/code ──────────────────────────────
//
// #148: phone + app-generated re-entry code. The compliant, no-SMS path
// back — the prospect wrote the code down from his own page. Generic
// failure shape (never reveals whether phone or code was wrong). Same
// per-IP / per-phone rate limits as the magic-link path.

const CodeBody = z.object({
  phone: z.string().min(4).max(40),
  code: z.string().min(4).max(16).regex(/^[A-Za-z0-9]+$/),
});

const GENERIC_CODE_ERROR = { ok: false as const, error: 'invalid_credentials' as const };

prospectLoginRoutes.post('/code', async (req, res) => {
  const ip = clientIp(req);
  if (!rateLimitHit(`code_ip:${ip}`, REDEEM_PER_IP)) {
    return res.status(429).json({ ok: false, error: 'rate_limited' });
  }
  const parsed = CodeBody.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(GENERIC_CODE_ERROR);
  }
  const e164 = normalizePhone(parsed.data.phone);
  if (!e164) {
    return res.status(400).json(GENERIC_CODE_ERROR);
  }
  if (!rateLimitHit(`code_phone:${hashPhone(e164)}`, START_PER_PHONE)) {
    return res.status(429).json({ ok: false, error: 'rate_limited' });
  }
  try {
    const code = parsed.data.code.trim().toUpperCase();
    const account = await findAccountByPhoneAndCode(e164, code);
    if (!account) {
      return res.status(400).json(GENERIC_CODE_ERROR);
    }
    await openProspectSession(res, {
      accountId: account.accountId,
      prospectId: account.prospectId,
      tokenId: account.tokenId,
      sponsorBaId: account.sponsorBaId,
      accountExpiresAt: account.expiresAt,
    });
    const response: ProspectLoginRedeemResponse = {
      ok: true,
      tokenId: account.tokenId,
    };
    return res.status(200).json(response);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[POST /api/p/login/code] failed', err);
    return res.status(500).json({ ok: false, error: 'server_error' });
  }
});

// ─── POST /api/p/login/logout ────────────────────────────
//
// #148: explicit prospect sign-out. Reads the session from the cookie,
// deletes the session row, clears the cookie. Idempotent — no session is
// still a 200 (clearing an absent cookie is a no-op). Useful on a shared
// or family phone where "close the tab" is not enough.

prospectLoginRoutes.post('/logout', async (req, res) => {
  try {
    const session = await readProspectSession(req);
    await closeProspectSession(res, session ? session.sessionId : '');
    return res.status(200).json({ ok: true });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[POST /api/p/login/logout] failed', err);
    return res.status(200).json({ ok: true });
  }
});
