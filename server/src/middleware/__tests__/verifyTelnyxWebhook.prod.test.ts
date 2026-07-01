/**
 * P10 H4 — Telnyx webhook fail-closed-in-production tests.
 *
 * env.ts loads the developer's real .env at import time, so these tests import
 * the middleware only after stubbing TELNYX_PUBLIC_KEY='' for the process. That
 * keeps local secrets from changing which branch the test exercises.
 *
 * The replay-window check runs first and is unchanged, so each request carries
 * a fresh, valid telnyx-timestamp.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import type { NextFunction, Request, Response } from 'express';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.resetModules();
});

async function loadVerifyTelnyxWebhook(nodeEnv: 'production' | 'development') {
  vi.resetModules();
  vi.unstubAllEnvs();
  vi.stubEnv('NODE_ENV', nodeEnv);
  vi.stubEnv('JWT_SECRET', 'S3cure-random-secret-value-that-is-well-over-32-chars');
  vi.stubEnv('TELNYX_PUBLIC_KEY', '');
  const mod = await import('../verifyTelnyxWebhook.js');
  return mod.verifyTelnyxWebhook;
}

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
  it('production: rejects with 401 (fail closed) and does not call next()', async () => {
    // Silence the expected env boot warning + middleware error log.
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const verifyTelnyxWebhook = await loadVerifyTelnyxWebhook('production');

    const body = Buffer.from(JSON.stringify({ data: { event_type: 'call.initiated' } }));
    const req = mockReq(body, { 'telnyx-timestamp': freshTimestamp() });
    const res = mockRes();
    const next: NextFunction = vi.fn();

    verifyTelnyxWebhook(req, res as unknown as Response, next);

    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({ ok: false, error: 'Webhook verification not configured.' });
    expect(next).not.toHaveBeenCalled();
  });

  it('development: skips verification with a warning and passes through', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const verifyTelnyxWebhook = await loadVerifyTelnyxWebhook('development');

    const body = Buffer.from(JSON.stringify({ data: { event_type: 'call.initiated' } }));
    const req = mockReq(body, { 'telnyx-timestamp': freshTimestamp() });
    const res = mockRes();
    const next: NextFunction = vi.fn();

    verifyTelnyxWebhook(req, res as unknown as Response, next);

    expect(next).toHaveBeenCalledOnce();
    expect(req.telnyxEvent?.data.event_type).toBe('call.initiated');
  });
});
