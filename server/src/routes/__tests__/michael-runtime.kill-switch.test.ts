/**
 * S3.11 — Michael runtime route kill-switch behavior tests (Agent C).
 *
 * Handler-level coverage of the three-axis kill switch via direct invocation of
 * the now-ASYNC handleMichaelRuntimeResolve(req, res) with mock req/res.
 * supertest is not installed and index.ts calls app.listen() at import, so the
 * handler is tested directly — never the mounted app.
 *
 * SERVER-OWNED contract (S3.11): the runtime turn is built server-side from the
 * authenticated session; the request body is server-owned (only optional
 * `language`). The route no longer accepts a client-supplied `body.turn`, so the
 * kill-switch cases drive an empty `{}` body. Flags remain the SOLE source of
 * truth: read from process.env only, default-off, enabled only on exact "true".
 *
 * Env hygiene: all three MICHAEL_RUNTIME_* vars are snapshotted/cleared in
 * beforeEach and restored exactly in afterEach (no leakage).
 */

import type { Request, Response } from 'express';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { handleMichaelRuntimeResolve } from '../michael-runtime.js';

const ENV_VARS = [
  'MICHAEL_RUNTIME_ROUTE_ENABLED',
  'MICHAEL_RUNTIME_RESPONSE_ENABLED',
  'MICHAEL_RUNTIME_TRACE_ENABLED',
] as const;

type EnvVarName = (typeof ENV_VARS)[number];

interface MockRes {
  statusCode: number;
  body: unknown;
  status(code: number): MockRes;
  json(payload: unknown): MockRes;
}

function createMockRes(): MockRes {
  return {
    statusCode: 0,
    body: undefined,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
  };
}

/**
 * Build a server-owned request. The body defaults to `{}` (the only valid client
 * body is `{}` or `{ language }`); `extra.body` lets a test deliberately send a
 * forbidden key to prove the body cannot smuggle configuration. `extra.query`
 * proves query is not a flag source — the handler reads neither query nor body
 * for flags, only process.env.
 */
function createReq(extra?: {
  body?: Record<string, unknown>;
  query?: Record<string, unknown>;
}): Request {
  return {
    session: { tmagId: 'TMAG-20240101-ABCDEF' },
    body: { ...(extra?.body ?? {}) },
    query: extra?.query ?? {},
  } as unknown as Request;
}

async function invoke(req: Request, res: MockRes): Promise<void> {
  await handleMichaelRuntimeResolve(req, res as unknown as Response);
}

function asBody(res: MockRes): Record<string, unknown> {
  return res.body as Record<string, unknown>;
}

let snapshot: Record<EnvVarName, string | undefined>;

beforeEach(() => {
  snapshot = {
    MICHAEL_RUNTIME_ROUTE_ENABLED: process.env.MICHAEL_RUNTIME_ROUTE_ENABLED,
    MICHAEL_RUNTIME_RESPONSE_ENABLED: process.env.MICHAEL_RUNTIME_RESPONSE_ENABLED,
    MICHAEL_RUNTIME_TRACE_ENABLED: process.env.MICHAEL_RUNTIME_TRACE_ENABLED,
  };
  for (const name of ENV_VARS) {
    delete process.env[name];
  }
});

afterEach(() => {
  for (const name of ENV_VARS) {
    const original = snapshot[name];
    if (original === undefined) {
      delete process.env[name];
    } else {
      process.env[name] = original;
    }
  }
});

describe('S3.11 Michael runtime route — three-axis kill switch behavior', () => {
  it('1. route flag off (others on) -> 503 michael_runtime_disabled, no facade leak', async () => {
    process.env.MICHAEL_RUNTIME_RESPONSE_ENABLED = 'true';
    process.env.MICHAEL_RUNTIME_TRACE_ENABLED = 'true';
    // route flag intentionally left unset (off)

    const res = createMockRes();
    await invoke(createReq(), res);

    expect(res.statusCode).toBe(503);
    const body = asBody(res);
    expect(body.ok).toBe(false);
    expect(body.reason).toBe('michael_runtime_disabled');
    // No turn source / facade was called: nothing leaks.
    expect(body.response).toBeUndefined();
    expect(body.trace).toBeUndefined();
    expect(body.catalogKey).toBeUndefined();
    expect(body.selectionRequest).toBeUndefined();
  });

  it('2. route flag = "TRUE" (not exact) -> still disabled 503', async () => {
    process.env.MICHAEL_RUNTIME_ROUTE_ENABLED = 'TRUE';
    process.env.MICHAEL_RUNTIME_RESPONSE_ENABLED = 'true';
    process.env.MICHAEL_RUNTIME_TRACE_ENABLED = 'true';

    const res = createMockRes();
    await invoke(createReq(), res);

    expect(res.statusCode).toBe(503);
    expect(asBody(res).reason).toBe('michael_runtime_disabled');
  });

  it('3. response flag off (route on) -> 503 michael_runtime_response_disabled, no response/trace', async () => {
    process.env.MICHAEL_RUNTIME_ROUTE_ENABLED = 'true';
    // response flag intentionally left unset (off)

    const res = createMockRes();
    await invoke(createReq(), res);

    expect(res.statusCode).toBe(503);
    const body = asBody(res);
    expect(body.ok).toBe(false);
    expect(body.reason).toBe('michael_runtime_response_disabled');
    expect(body.response).toBeUndefined();
    expect(body.trace).toBeUndefined();
  });

  it('4. route on + response on + trace off -> 200 ok:true, trace stripped (undefined)', async () => {
    process.env.MICHAEL_RUNTIME_ROUTE_ENABLED = 'true';
    process.env.MICHAEL_RUNTIME_RESPONSE_ENABLED = 'true';
    // trace flag intentionally left unset (off)

    const res = createMockRes();
    await invoke(createReq(), res);

    expect(res.statusCode).toBe(200);
    const body = asBody(res);
    expect(body.ok).toBe(true);
    expect(body.trace).toBeUndefined();
    expect(body.response).toBeDefined();
  });

  it('5. route on + response on + trace on -> 200 ok:true, trace present (object)', async () => {
    process.env.MICHAEL_RUNTIME_ROUTE_ENABLED = 'true';
    process.env.MICHAEL_RUNTIME_RESPONSE_ENABLED = 'true';
    process.env.MICHAEL_RUNTIME_TRACE_ENABLED = 'true';

    const res = createMockRes();
    await invoke(createReq(), res);

    expect(res.statusCode).toBe(200);
    const body = asBody(res);
    expect(body.ok).toBe(true);
    expect(body.trace).toBeDefined();
    expect(typeof body.trace).toBe('object');
    expect(body.trace).not.toBeNull();
  });

  it('6. trace flag = "TRUE" (not exact) -> success WITHOUT trace', async () => {
    process.env.MICHAEL_RUNTIME_ROUTE_ENABLED = 'true';
    process.env.MICHAEL_RUNTIME_RESPONSE_ENABLED = 'true';
    process.env.MICHAEL_RUNTIME_TRACE_ENABLED = 'TRUE';

    const res = createMockRes();
    await invoke(createReq(), res);

    expect(res.statusCode).toBe(200);
    const body = asBody(res);
    expect(body.ok).toBe(true);
    expect(body.trace).toBeUndefined();
  });

  it('7. partial config: route on but response unset -> 503 response_disabled (axis fail-closes)', async () => {
    process.env.MICHAEL_RUNTIME_ROUTE_ENABLED = 'true';
    // response + trace unset

    const res = createMockRes();
    await invoke(createReq(), res);

    expect(res.statusCode).toBe(503);
    expect(asBody(res).reason).toBe('michael_runtime_response_disabled');
  });

  it('8. partial config: route on + response on but trace unset -> success without trace', async () => {
    process.env.MICHAEL_RUNTIME_ROUTE_ENABLED = 'true';
    process.env.MICHAEL_RUNTIME_RESPONSE_ENABLED = 'true';
    // trace unset

    const res = createMockRes();
    await invoke(createReq(), res);

    expect(res.statusCode).toBe(200);
    const body = asBody(res);
    expect(body.ok).toBe(true);
    expect(body.trace).toBeUndefined();
  });

  it('9. all unset (default) -> 503 michael_runtime_disabled (fully inert default)', async () => {
    const res = createMockRes();
    await invoke(createReq(), res);

    expect(res.statusCode).toBe(503);
    const body = asBody(res);
    expect(body.ok).toBe(false);
    expect(body.reason).toBe('michael_runtime_disabled');
  });

  it('10. flags are env-only: a query flag override is ignored (env wins)', async () => {
    process.env.MICHAEL_RUNTIME_ROUTE_ENABLED = 'true';
    process.env.MICHAEL_RUNTIME_RESPONSE_ENABLED = 'true';

    const res = createMockRes();
    // The query carries a "disable" flag — the handler reads neither query nor
    // body for configuration, so env wins and the request still succeeds.
    await invoke(createReq({ query: { MICHAEL_RUNTIME_ROUTE_ENABLED: 'false' } }), res);

    expect(res.statusCode).toBe(200);
    expect(asBody(res).ok).toBe(true);
  });

  it('11. the request BODY cannot smuggle config — a non-`language` flag key is rejected 400 (env stays the sole flag source)', async () => {
    process.env.MICHAEL_RUNTIME_ROUTE_ENABLED = 'true';
    process.env.MICHAEL_RUNTIME_RESPONSE_ENABLED = 'true';

    const res = createMockRes();
    // A flag-shaped body key is not `language`, so the server-owned body guard
    // rejects it outright — the body can neither enable nor disable the route.
    await invoke(createReq({ body: { MICHAEL_RUNTIME_ROUTE_ENABLED: 'false' } }), res);

    expect(res.statusCode).toBe(400);
    const body = asBody(res);
    expect(body.ok).toBe(false);
    expect(body.code).toBe('CLIENT_RUNTIME_INPUT_NOT_ALLOWED');
  });

  it('12. enabled success path returns the inert fixture (agentResponseGenerated false, persistence disabled)', async () => {
    process.env.MICHAEL_RUNTIME_ROUTE_ENABLED = 'true';
    process.env.MICHAEL_RUNTIME_RESPONSE_ENABLED = 'true';

    const res = createMockRes();
    await invoke(createReq(), res);

    expect(res.statusCode).toBe(200);
    const body = asBody(res);
    expect(body.ok).toBe(true);
    expect(body.catalogKey).toBeDefined();
    expect(body.selectionRequest).toBeDefined();

    const response = body.response as Record<string, unknown>;
    expect(response).toBeDefined();
    expect(response.agentResponseGenerated).toBe(false);
    expect(response.persistence).toBe('disabled');
  });
});
