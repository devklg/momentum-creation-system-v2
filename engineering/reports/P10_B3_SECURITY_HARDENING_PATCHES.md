# P10 B3 — Security Hardening Proposed Patches (H2 / H3 / H4)

**Phase:** 10 — DevOps, Security, Environments, and Operations
**Blocker:** B3 (release-checklist §4) — auth/session & webhook hardening.
**Status:** 🔧 **PROPOSED — NOT APPLIED.** This is a security-audit document. No code in this worktree is changed by it. Applying these patches is a **production-affecting code slice** requiring Kevin's approval and a properly-scoped worktree (this worktree's Allowed Files are docs/reports only — `server/src/*` is out of scope here).
**Author:** Claude Code (Instance 2), Phase 10 worktree
**Date:** 2026-06-30
**Source findings:** verification report H2 (`routes/auth.ts`), H3 (`env.ts` / `.env.example`), H4 (`middleware/verifyTelnyxWebhook.ts`). All line anchors were read from the live worktree at HEAD `bf2575a`.

---

## 0. How to use this doc

Each patch below is copy-paste-ready against the current code. Apply in a dedicated worktree/branch (e.g. `feature/phase-10-b3-security-hardening`), run the gates in §5, add the tests in §4, then open a PR for Kevin. Nothing here sends, calls an LLM, adds a route family, or writes to a store — it only *hardens* existing surfaces. Every change is behind `NODE_ENV==='production'` or is a pure 429 throttle, so dev behavior is unchanged except the throttles.

**Order:** H3 and H4 are the smallest and highest-value (a few lines each, fail-fast at boot). H2 is the largest (a new reusable limiter + three route wires). Apply H3 → H4 → H2.

---

## 1. Patch H2 — Rate-limit `/auth/login`, `/register`, `/verify-code`

**Problem.** `routes/auth.ts` mounts `/login`, `/register`, `/verify-code` with **no throttle** (verified: no `rateLimitHit` usage in the file). `/p/login` already has a clean in-memory sliding-window limiter (`routes/p-login.ts:62-99`). Brute-force on `/login`, account-spam on `/register`, and code-enumeration on `/verify-code` (~923k `TM-XXXX` space, and it discloses sponsor PII) are all open.

**Fix.** Extract the proven `p-login` limiter into a shared middleware, then apply per-route limiters on the three auth endpoints. Reusing the existing algorithm keeps one limiter implementation in the codebase.

### 1a. New file — `server/src/middleware/rateLimit.ts`

```ts
/**
 * In-memory sliding-window rate limiter (shared middleware).
 *
 * Single-instance only — the counter lives in this process. If/when the server
 * scales horizontally this moves to Redis via the gateway. Extracted from the
 * per-route limiter proven in routes/p-login.ts so auth + prospect paths share
 * one implementation.
 *
 * NOTE (P10 H2 effectiveness): per-IP keys are only trustworthy behind a proxy
 * once `app.set('trust proxy', <hops>)` is configured to match the deployment
 * topology — otherwise req.ip is the proxy and x-forwarded-for is spoofable.
 * See §1c and verification report P10.4 (trust-proxy MED finding).
 */

import type { Request, Response, NextFunction, RequestHandler } from 'express';

export interface RateLimitConfig {
  /** Window length in ms. */
  windowMs: number;
  /** Max hits allowed per key inside the window. */
  max: number;
}

const buckets = new Map<string, number[]>();

/** Returns true when the hit is allowed; false when rate-limited. */
export function rateLimitHit(key: string, cfg: RateLimitConfig): boolean {
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

/** Best-effort client IP. See trust-proxy caveat above. */
export function clientIp(req: Request): string {
  const fwd = req.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0]?.trim() || req.ip || 'unknown';
  return req.ip || 'unknown';
}

/**
 * Per-IP sliding-window limiter middleware. Returns 429 { ok:false,
 * error:'rate_limited' } — the same opaque shape /p/login already uses.
 */
export function ipRateLimit(keyPrefix: string, cfg: RateLimitConfig): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!rateLimitHit(`${keyPrefix}:${clientIp(req)}`, cfg)) {
      res.status(429).json({ ok: false, error: 'rate_limited' });
      return;
    }
    next();
  };
}
```

### 1b. Edit — `server/src/routes/auth.ts`

Add the import (top of file, with the other imports):

```ts
import { ipRateLimit, type RateLimitConfig } from '../middleware/rateLimit.js';
```

Add the limiter configs after `export const authRoutes: Router = express.Router();`:

```ts
// P10 H2 — per-IP throttles. Windows chosen to stop automated abuse without
// impeding a human retrying a typo.
const LOGIN_LIMIT: RateLimitConfig = { windowMs: 15 * 60 * 1000, max: 10 };   // brute-force
const REGISTER_LIMIT: RateLimitConfig = { windowMs: 60 * 60 * 1000, max: 5 }; // account-spam
const VERIFY_LIMIT: RateLimitConfig = { windowMs: 15 * 60 * 1000, max: 20 };  // code-enumeration
```

Then add the middleware as the first handler on each route (single-line change per route):

```ts
authRoutes.post('/verify-code', ipRateLimit('auth_verify', VERIFY_LIMIT), async (req, res) => { … });
authRoutes.post('/register',    ipRateLimit('auth_register', REGISTER_LIMIT), async (req, res) => { … });
authRoutes.post('/login',       ipRateLimit('auth_login', LOGIN_LIMIT), async (req, res) => { … });
```

*(Only the handler-array changes; the existing async body is untouched.)*

### 1c. Optional companion — `server/src/index.ts` (`trust proxy`)

For the per-IP keys (and audit IPs) to be accurate behind the production reverse proxy, add — matched to the real hop count once B1 topology is settled:

```ts
app.set('trust proxy', 1); // number of trusted proxy hops in front of the API
```

⚠️ `index.ts` is an append-only shared file; this is a config line, not a route mount — coordinate placement with the merge discipline and set the value from the actual topology. Leave it out until the proxy layer exists (dev is direct, so `req.ip` is already correct locally).

### 1d. Follow-on (separate MED, same file)

`/verify-code` returns sponsor full name + `sponsorThreeBaId` to an unauthenticated caller (`auth.ts:27-34`). The throttle slows enumeration but does not stop disclosure. Recommend a follow-up that returns only what the signup UI needs (e.g. sponsor first name / a boolean valid), tracked separately from B3.

---

## 2. Patch H3 — Reject placeholder / low-entropy `JWT_SECRET` in production

**Problem.** `env.ts:65` requires only `min(16)`. `.env.example`'s placeholder `replace-me-with-a-long-random-string` satisfies that, so a verbatim `cp .env.example .env` in production would sign every session with a publicly-known secret.

**Fix.** A fail-fast boot assertion, production-only. Append immediately after `export const env = Env.parse(process.env);` (`env.ts:214`):

```ts
// ─── P10 H3 — production secret hardening ─────────────────────────────────
// Fail fast at boot rather than silently signing sessions with a known secret.
if (env.NODE_ENV === 'production') {
  const KNOWN_PLACEHOLDER_SECRETS = new Set([
    'replace-me-with-a-long-random-string',
    'changeme',
    'secret',
    'your-secret-here',
  ]);
  if (
    KNOWN_PLACEHOLDER_SECRETS.has(env.JWT_SECRET) ||
    env.JWT_SECRET.length < 32
  ) {
    throw new Error(
      '[env] JWT_SECRET is a known placeholder or too short (<32 chars) for ' +
        'production. Generate a strong secret, e.g. `openssl rand -base64 48`.',
    );
  }
}
```

Dev/test are unaffected (the block only runs when `NODE_ENV==='production'`). This also motivates adding `NODE_ENV` to `.env.example` — already done in the docs commit.

---

## 3. Patch H4 — Fail-closed Telnyx webhook verification in production

**Problem.** `verifyTelnyxWebhook.ts:125-130`: when `TELNYX_PUBLIC_KEY` is empty, verification is **skipped with a warning** — gated on key presence, not `NODE_ENV`. A production deploy missing the key silently accepts forged webhooks.

**Fix — defense in depth (both layers):**

### 3a. Runtime guard — `server/src/middleware/verifyTelnyxWebhook.ts`

Replace the `else` branch at `:125-130`:

```ts
  } else if (env.NODE_ENV === 'production') {
    // P10 H4 — fail closed: a missing key in production must never mean
    // "accept unsigned". Reject rather than skip.
    // eslint-disable-next-line no-console
    console.error(
      '[telnyx-webhook] TELNYX_PUBLIC_KEY not set in production — rejecting webhook.',
    );
    res
      .status(401)
      .json({ ok: false, error: 'Webhook verification not configured.' });
    return;
  } else {
    // Dev only: skip with a warning so local/ngrok replays work.
    // eslint-disable-next-line no-console
    console.warn(
      '[telnyx-webhook] TELNYX_PUBLIC_KEY not set — signature verification SKIPPED. Dev only.',
    );
  }
```

`env` is already imported (`verifyTelnyxWebhook.ts:24`). The replay-window check above stays unchanged (already always-enforced).

### 3b. Boot assertion (belt-and-suspenders) — `server/src/env.ts`

Fold into the same production block from §2 so a misconfigured prod never boots:

```ts
  // Webhook secrets that must exist in production (extends the H3 block).
  if (!env.TELNYX_PUBLIC_KEY) {
    throw new Error('[env] TELNYX_PUBLIC_KEY is required in production (webhook signature verification).');
  }
  if (env.VM_LIVE_DELIVERY_ENABLED && !env.VM_WEBHOOK_SHARED_SECRET) {
    throw new Error('[env] VM_WEBHOOK_SHARED_SECRET is required when VM_LIVE_DELIVERY_ENABLED=true.');
  }
```

> If webhooks/VM might be intentionally off in a given prod deploy, make 3b a config decision (a `WEBHOOKS_ENABLED`-style flag) rather than an unconditional throw. 3a alone already closes the forged-webhook hole; 3b is the stricter posture. Kevin's call.

---

## 4. Tests to add with the slice

- `middleware/__tests__/rateLimit.test.ts` — window allows `max` hits then 429s; window slides (old hits expire); keys are independent.
- `routes/__tests__/auth.rate-limit.test.ts` — the `max+1`-th `/login` / `/register` / `/verify-code` from one IP returns 429.
- `env.ts` prod-assertion tests — set `NODE_ENV=production` + placeholder `JWT_SECRET` → boot throws; strong secret + `TELNYX_PUBLIC_KEY` set → boot succeeds. (Env is parsed at import, so test via a helper or `vi.resetModules()` + `import()`.)
- `middleware/__tests__/verifyTelnyxWebhook.prod.test.ts` — `NODE_ENV=production` + empty key → 401; dev + empty key → passes through (existing behavior).

These extend the existing vitest suite (`server/vitest.config.ts`).

---

## 5. Gates to run after applying

```bash
pnpm build:shared
pnpm typecheck
pnpm build
pnpm --filter @momentum/server test
```

All must be green. Confirm the new rate-limit + env-assertion + telnyx-prod tests are included in the run count.

---

## 6. Standing-prohibition check (for the applying slice)

| Prohibition | Impact of these patches |
|---|---|
| No `.com` exposure | None — auth/webhook/env only; `/verify-code` disclosure is *reduced*, never increased. |
| No `/api/runtime/*` route family | None created. |
| No unapproved persistence | None — limiter is in-memory; no new writes. |
| No LLM calls / dynamic generation | None. |
| No voice/Telnyx/PSTN/call-control | Telnyx webhook is *hardened* (made stricter), never invoked or dialed. |
| No auto sending/calling/scheduling/etc. | None — these are throttles and boot assertions. |
| No income/comp/placement guarantees | None. |
| No agent approves knowledge | This doc proposes; it approves nothing. |

**Net effect:** strictly reduces attack surface. Dev behavior unchanged except the new 429 throttles; all new fail-closed logic is `NODE_ENV==='production'`-gated.
