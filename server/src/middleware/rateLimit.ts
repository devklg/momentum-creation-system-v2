/**
 * In-memory sliding-window rate limiter (shared middleware) — P10 H2.
 *
 * Single-instance only: the counter lives in this process. If/when the server
 * scales horizontally this moves to Redis via the PERSISTENCE. Extracted from the
 * per-route limiter proven in routes/p-login.ts so the auth and prospect paths
 * share one implementation.
 *
 * NOTE (effectiveness): per-IP keys are only trustworthy behind a proxy once
 * `app.set('trust proxy', <hops>)` matches the deployment topology — otherwise
 * req.ip is the proxy and x-forwarded-for is spoofable. See the P10.4
 * trust-proxy finding. In direct-connection dev, req.ip is already correct.
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

/** Best-effort client IP. See the trust-proxy caveat above. */
export function clientIp(req: Request): string {
  const fwd = req.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0]?.trim() || req.ip || 'unknown';
  return req.ip || 'unknown';
}

/**
 * Per-IP sliding-window limiter middleware. Returns 429
 * { ok:false, error:'rate_limited' } — the same opaque shape /p/login uses —
 * when the window is exceeded, otherwise calls next().
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

/** Test-only: clear all counters so cases don't bleed into each other. */
export function __resetRateLimitBuckets(): void {
  buckets.clear();
}
