/**
 * P10 H2 — shared rate-limit middleware tests.
 *
 * Covers the pure sliding-window counter, the Express middleware wrapper, the
 * clientIp helper, and a WIRING GUARD asserting the three auth routes actually
 * mount the limiter (guards against the fix being silently removed — the same
 * philosophy as the H1 projection-outbox wiring guard).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';
import {
  __resetRateLimitBuckets,
  clientIp,
  ipRateLimit,
  rateLimitHit,
  type RateLimitConfig,
} from '../rateLimit.js';

beforeEach(() => {
  __resetRateLimitBuckets();
});

afterEach(() => {
  vi.useRealTimers();
  __resetRateLimitBuckets();
});

function mockReq(ip = '203.0.113.7', fwd?: string): Request {
  return {
    ip,
    get: (h: string) =>
      h.toLowerCase() === 'x-forwarded-for' ? fwd : undefined,
  } as unknown as Request;
}

function mockRes() {
  const r: { statusCode: number; body?: unknown; status: (c: number) => typeof r; json: (b: unknown) => typeof r } = {
    statusCode: 200,
    status(c: number) {
      this.statusCode = c;
      return this;
    },
    json(b: unknown) {
      this.body = b;
      return this;
    },
  };
  return r;
}

describe('rateLimitHit — pure sliding window', () => {
  const cfg: RateLimitConfig = { windowMs: 1000, max: 3 };

  it('allows exactly `max` hits, then blocks', () => {
    expect(rateLimitHit('k', cfg)).toBe(true);
    expect(rateLimitHit('k', cfg)).toBe(true);
    expect(rateLimitHit('k', cfg)).toBe(true);
    expect(rateLimitHit('k', cfg)).toBe(false);
    expect(rateLimitHit('k', cfg)).toBe(false);
  });

  it('keys are independent', () => {
    expect(rateLimitHit('a', cfg)).toBe(true);
    expect(rateLimitHit('a', cfg)).toBe(true);
    expect(rateLimitHit('a', cfg)).toBe(true);
    expect(rateLimitHit('a', cfg)).toBe(false);
    // A different key has its own budget.
    expect(rateLimitHit('b', cfg)).toBe(true);
  });

  it('the window slides — old hits expire and free the budget', () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    expect(rateLimitHit('k', cfg)).toBe(true);
    expect(rateLimitHit('k', cfg)).toBe(true);
    expect(rateLimitHit('k', cfg)).toBe(true);
    expect(rateLimitHit('k', cfg)).toBe(false);
    // Advance past the window; the earlier hits are now outside it.
    vi.advanceTimersByTime(1001);
    expect(rateLimitHit('k', cfg)).toBe(true);
  });
});

describe('clientIp', () => {
  it('prefers the first x-forwarded-for entry', () => {
    expect(clientIp(mockReq('10.0.0.1', '198.51.100.9, 10.0.0.1'))).toBe('198.51.100.9');
  });

  it('falls back to req.ip when no forwarded header', () => {
    expect(clientIp(mockReq('10.0.0.2'))).toBe('10.0.0.2');
  });
});

describe('ipRateLimit middleware', () => {
  it('calls next() while under the limit, then 429s', () => {
    const mw = ipRateLimit('t', { windowMs: 1000, max: 2 });
    const req = mockReq('203.0.113.7');

    const next1 = vi.fn();
    mw(req, mockRes() as unknown as Response, next1);
    expect(next1).toHaveBeenCalledOnce();

    const next2 = vi.fn();
    mw(req, mockRes() as unknown as Response, next2);
    expect(next2).toHaveBeenCalledOnce();

    const next3 = vi.fn();
    const res3 = mockRes();
    mw(req, res3 as unknown as Response, next3);
    expect(next3).not.toHaveBeenCalled();
    expect(res3.statusCode).toBe(429);
    expect(res3.body).toEqual({ ok: false, error: 'rate_limited' });
  });

  it('throttles per-IP — a different IP is unaffected', () => {
    const mw = ipRateLimit('t2', { windowMs: 1000, max: 1 });

    const a = mockReq('203.0.113.10');
    const nextA1 = vi.fn();
    mw(a, mockRes() as unknown as Response, nextA1);
    expect(nextA1).toHaveBeenCalledOnce();
    const nextA2 = vi.fn();
    const resA2 = mockRes();
    mw(a, resA2 as unknown as Response, nextA2);
    expect(resA2.statusCode).toBe(429);

    // Different IP still allowed.
    const b = mockReq('203.0.113.11');
    const nextB = vi.fn();
    mw(b, mockRes() as unknown as Response, nextB);
    expect(nextB).toHaveBeenCalledOnce();
  });
});

describe('wiring guard — auth routes mount the limiter', () => {
  it('/login, /register, /verify-code each carry an extra (limiter) handler', async () => {
    const { authRoutes } = await import('../../routes/auth.js');
    // Express Router stores each route as a layer with a .route holding its
    // handler stack. With the limiter wired, the guarded routes have >=2
    // handlers (limiter + async handler).
    const layers = (authRoutes as unknown as {
      stack: Array<{ route?: { path: string; methods: Record<string, boolean>; stack: unknown[] } }>;
    }).stack;

    const guarded = ['/verify-code', '/register', '/login'];
    for (const path of guarded) {
      const layer = layers.find((l) => l.route?.path === path && l.route?.methods.post);
      expect(layer, `route POST ${path} not found`).toBeTruthy();
      expect(
        (layer!.route!.stack.length),
        `POST ${path} should have limiter + handler`,
      ).toBeGreaterThanOrEqual(2);
    }
  });
});
