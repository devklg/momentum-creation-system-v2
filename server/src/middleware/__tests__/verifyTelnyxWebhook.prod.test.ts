/**
 * P10 H4 — Telnyx webhook fail-closed-in-production tests.
 *
 * env.TELNYX_PUBLIC_KEY is empty in the test env (setupEnv only stubs NODE_ENV
 * + JWT_SECRET), so every case here exercises the "no public key" branch. The
 * middleware reads process.env.NODE_ENV at call time, so we flip it per test
 * (snapshot/restore, no module reset needed).
 *
 * The replay-window check runs first and is unchanged, so each request carries
 * a fresh, valid telnyx-timestamp.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextFunction, Request, Response } from 'express';
import { verifyTelnyxWebhook } from '../verifyTelnyxWebhook.js';

let originalNodeEnv: string | undefined;

beforeEach(() => {
  originalNodeEnv = process.env.NODE_ENV;
});

afterEach(() => {
  if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = originalNodeEnv;
  vi.restoreAllMocks();
});

function freshTimestamp(): string {
  return Math.floor(Date.now() / 1000).toString();
}

function mockReq(body: Buffer, headers: Record<string, string>): Request {
  return {
    body,
    get: (h: string) => headers[h.toLowerCase()],
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

describe('verifyTelnyxWebhook — key missing', () => {
  it('production: rejects with 401 (fail closed) and does not call next()', () => {
    process.env.NODE_ENV = 'production';
    // Silence the expected error log.
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const body = Buffer.from(JSON.stringify({ data: { event_type: 'call.initiated' } }));
    const req = mockReq(body, { 'telnyx-timestamp': freshTimestamp() });
    const res = mockRes();
    const next: NextFunction = vi.fn();

    verifyTelnyxWebhook(req, res as unknown as Response, next);

    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({ ok: false, error: 'Webhook verification not configured.' });
    expect(next).not.toHaveBeenCalled();
  });

  it('development: skips verification with a warning and passes through', () => {
    process.env.NODE_ENV = 'development';
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    const body = Buffer.from(JSON.stringify({ data: { event_type: 'call.initiated' } }));
    const req = mockReq(body, { 'telnyx-timestamp': freshTimestamp() });
    const res = mockRes();
    const next: NextFunction = vi.fn();

    verifyTelnyxWebhook(req, res as unknown as Response, next);

    expect(next).toHaveBeenCalledOnce();
    expect(req.telnyxEvent?.data.event_type).toBe('call.initiated');
  });
});
