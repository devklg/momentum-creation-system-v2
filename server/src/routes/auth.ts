import express, { type Request, type Response, type Router } from 'express';
import argon2 from 'argon2';
import { z } from 'zod';
import { findAccessCode } from '../domain/access-codes.js';
import { emailExists, threeBaIdExists, registerBA, findBAByBaId, recordLogin } from '../domain/ba.js';
import { signSession, setSessionCookie, clearSessionCookie } from '../services/session.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { ipRateLimit, type RateLimitConfig } from '../middleware/rateLimit.js';
import { env } from '../env.js';

export const authRoutes: Router = express.Router();

// P10 H2 — per-IP throttles. Windows chosen to stop automated abuse
// (brute-force, account-spam, code-enumeration) without impeding a human
// retrying a typo. In-memory / single-instance (see middleware/rateLimit.ts).
const LOGIN_LIMIT: RateLimitConfig = { windowMs: 15 * 60 * 1000, max: 10 };
const REGISTER_LIMIT: RateLimitConfig = { windowMs: 60 * 60 * 1000, max: 5 };
const VERIFY_LIMIT: RateLimitConfig = { windowMs: 15 * 60 * 1000, max: 20 };

const VerifyBody = z.object({ code: z.string().min(2).max(32) });

authRoutes.post('/verify-code', ipRateLimit('auth_verify', VERIFY_LIMIT), async (req: Request, res: Response) => {
  const parsed = VerifyBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ ok: false, error: 'Invalid request' });
    return;
  }
  const code = parsed.data.code.trim().toUpperCase();
  try {
    const rec = await findAccessCode(code);
    if (!rec) {
      res.json({ ok: false, error: 'Code not recognized. Check with your sponsor.' });
      return;
    }
    res.json({
      ok: true,
      sponsor: {
        name: `${rec.sponsorFirstName} ${rec.sponsorLastName}`,
        threeBaId: rec.sponsorThreeBaId,
        tmCode: rec.code,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown';
    res.status(500).json({ ok: false, error: `Server error: ${msg}` });
  }
});

const RegisterBody = z.object({
  accessCode: z.string().min(2).max(32),
  firstName: z.string().min(1).max(80),
  lastName: z.string().min(1).max(80),
  email: z.string().email().max(320),
  phone: z.string().min(7).max(40),
  threeUsername: z.string().min(1).max(80),
  threeBaId: z.string().min(1).max(40),
  password: z.string().min(8).max(200),
  /**
   * IANA timezone — captured client-side via
   * Intl.DateTimeFormat().resolvedOptions().timeZone. Required so Michael's
   * 18-hour slot window resolves against the BA's local clock.
   */
  timezone: z.string().min(3).max(80),
  termsAccepted: z.literal(true),
});

authRoutes.post('/register', ipRateLimit('auth_register', REGISTER_LIMIT), async (req: Request, res: Response) => {
  const parsed = RegisterBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ ok: false, error: 'Invalid input. Please check the form and try again.' });
    return;
  }
  const input = parsed.data;

  try {
    const sponsor = await findAccessCode(input.accessCode.trim().toUpperCase());
    if (!sponsor) {
      res.status(400).json({ ok: false, error: 'Access code is not valid.' });
      return;
    }

    const email = input.email.trim().toLowerCase();
    if (await emailExists(email)) {
      res.status(409).json({ ok: false, error: 'An account with that email already exists.' });
      return;
    }
    if (await threeBaIdExists(input.threeBaId.trim())) {
      res.status(409).json({ ok: false, error: 'That THREE BA ID is already registered.' });
      return;
    }

    const ba = await registerBA(
      {
        firstName: input.firstName.trim(),
        lastName: input.lastName.trim(),
        email,
        phone: input.phone.trim(),
        threeUsername: input.threeUsername.trim(),
        threeBaId: input.threeBaId.trim(),
        passwordPlain: input.password,
        timezone: input.timezone.trim(),
      },
      sponsor,
    );

    const token = await signSession(
      { baId: ba.baId, threeBaId: ba.threeBaId, email: ba.email },
      env.JWT_TTL_REMEMBER_DAYS,
    );
    setSessionCookie(res, token);

    res.json({ ok: true, baId: ba.baId });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown';
    res.status(500).json({ ok: false, error: `Registration failed: ${msg}` });
  }
});

/**
 * POST /api/auth/login — single login surface used by both .team and admin.
 *
 * Identity contract: TM BA ID + password. ONLY the TM BA ID (TMBA-...)
 * authenticates. THREE BA ID and email are tracked on the BA record but are
 * not login identifiers — they're operational facts, not credentials.
 *
 * On success: sets the session cookie and returns { ok: true, baId }.
 * On failure: returns 401 with a generic error (no "user not found" vs
 * "wrong password" distinction — standard credential-stuffing defense).
 */
const LoginBody = z.object({
  baId: z.string().min(1).max(80),
  password: z.string().min(1).max(200),
});

authRoutes.post('/login', ipRateLimit('auth_login', LOGIN_LIMIT), async (req: Request, res: Response) => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ ok: false, error: 'Invalid input.' });
    return;
  }
  const { baId, password } = parsed.data;

  try {
    const ba = await findBAByBaId(baId.trim());
    if (!ba) {
      res.status(401).json({ ok: false, error: 'Invalid credentials.' });
      return;
    }

    let valid = false;
    try {
      valid = await argon2.verify(ba.passwordHash, password);
    } catch {
      valid = false;
    }
    if (!valid) {
      res.status(401).json({ ok: false, error: 'Invalid credentials.' });
      return;
    }

    const token = await signSession(
      { baId: ba.baId, threeBaId: ba.threeBaId, email: ba.email },
      env.JWT_TTL_REMEMBER_DAYS,
    );
    setSessionCookie(res, token);

    // Stamp lastLoginAt for team-stats "active 24h" computation (Chat #115).
    // Best-effort — a failure here does not block the login response.
    void recordLogin(ba.baId);

    res.json({ ok: true, baId: ba.baId });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown';
    res.status(500).json({ ok: false, error: `Login failed: ${msg}` });
  }
});

/**
 * POST /api/auth/logout — clears the session cookie.
 * Safe to call even when not authenticated; always returns ok.
 */
authRoutes.post('/logout', async (_req: Request, res: Response) => {
  clearSessionCookie(res);
  res.json({ ok: true });
});

/**
 * GET /api/auth/me — returns the current BA's identity + admin flag.
 *
 * Shape: { ok, me: { baId, threeBaId, fullName, email, isAdmin } }
 *
 * Used by both .team and admin clients. The admin client reads `isAdmin` to
 * decide whether to render the shell or the forbidden state. The server's
 * `requireAdmin` middleware on /api/admin/* is the real gate — this endpoint
 * is just the UX hint.
 *
 * Per locked-spec Part 3.1 + ADMIN Design A.2.
 */
authRoutes.get('/me', requireAuth, async (req: Request, res: Response) => {
  const session = req.session!;
  try {
    const ba = await findBAByBaId(session.baId);
    if (!ba) {
      res.status(401).json({ ok: false, error: 'Session references missing BA.' });
      return;
    }
    const isAdmin =
      env.ADMIN_BA_IDS.includes(ba.baId) || env.ADMIN_BA_IDS.includes(ba.threeBaId);

    res.json({
      ok: true,
      me: {
        baId: ba.baId,
        threeBaId: ba.threeBaId,
        fullName: `${ba.firstName} ${ba.lastName}`.trim(),
        email: ba.email,
        isAdmin,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown';
    res.status(500).json({ ok: false, error: `Lookup failed: ${msg}` });
  }
});
