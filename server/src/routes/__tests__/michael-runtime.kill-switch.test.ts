/**
 * S3.4 — Michael runtime route kill-switch behavior tests (Agent C).
 *
 * Handler-level coverage of the three-axis kill switch via direct invocation of
 * handleMichaelRuntimeResolve(req, res) with mock req/res. supertest is not
 * installed and index.ts calls app.listen() at import, so the handler is tested
 * directly — never the mounted app.
 *
 * The runtime turn is built once from the S2.8 inert fixture harness and reused.
 * Env hygiene: all three MICHAEL_RUNTIME_* vars are snapshotted/cleared in
 * beforeEach and restored exactly in afterEach (no leakage).
 */

import type { Request, Response } from 'express';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { handleMichaelRuntimeResolve } from '../michael-runtime.js';
import { runRuntimeTurnFixtureScenario } from '../../runtime/orchestration/fixtures/runtimeTurnHarness.js';

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

// Built once — the same accepted_complete clear-training turn drives every test.
let turn: Record<string, unknown>;

function createReq(extra?: {
  body?: Record<string, unknown>;
  query?: Record<string, unknown>;
}): Request {
  return {
    session: { baId: 'TMBA-20240101-ABCDEF' },
    body: { turn, ...(extra?.body ?? {}) },
    query: extra?.query ?? {},
  } as unknown as Request;
}

function invoke(req: Request, res: MockRes): void {
  handleMichaelRuntimeResolve(req, res as unknown as Response);
}

function asBody(res: MockRes): Record<string, unknown> {
  return res.body as Record<string, unknown>;
}

let snapshot: Record<EnvVarName, string | undefined>;

beforeAll(async () => {
  const rt = await runRuntimeTurnFixtureScenario({
    scenario: 'accepted_complete',
    agentKey: 'michael_magnificent',
    taskType: 'training_support',
  });
  turn = {
    identity: rt.input.identity,
    turnId: rt.input.turnId,
    taskType: 'training_support',
    runtimeTurn: rt,
    intent: 'clear_training_support',
  };
});

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

describe('S3.4 Michael runtime route — three-axis kill switch behavior', () => {
  it('1. route flag off (others on) -> 503 michael_runtime_disabled, no facade leak', () => {
    process.env.MICHAEL_RUNTIME_RESPONSE_ENABLED = 'true';
    process.env.MICHAEL_RUNTIME_TRACE_ENABLED = 'true';
    // route flag intentionally left unset (off)

    const res = createMockRes();
    invoke(createReq(), res);

    expect(res.statusCode).toBe(503);
    const body = asBody(res);
    expect(body.ok).toBe(false);
    expect(body.reason).toBe('michael_runtime_disabled');
    // No facade was called: nothing leaks.
    expect(body.response).toBeUndefined();
    expect(body.trace).toBeUndefined();
    expect(body.catalogKey).toBeUndefined();
    expect(body.selectionRequest).toBeUndefined();
  });

  it('2. route flag = "TRUE" (not exact) -> still disabled 503', () => {
    process.env.MICHAEL_RUNTIME_ROUTE_ENABLED = 'TRUE';
    process.env.MICHAEL_RUNTIME_RESPONSE_ENABLED = 'true';
    process.env.MICHAEL_RUNTIME_TRACE_ENABLED = 'true';

    const res = createMockRes();
    invoke(createReq(), res);

    expect(res.statusCode).toBe(503);
    expect(asBody(res).reason).toBe('michael_runtime_disabled');
  });

  it('3. response flag off (route on) -> 503 michael_runtime_response_disabled, no response/trace', () => {
    process.env.MICHAEL_RUNTIME_ROUTE_ENABLED = 'true';
    // response flag intentionally left unset (off)

    const res = createMockRes();
    invoke(createReq(), res);

    expect(res.statusCode).toBe(503);
    const body = asBody(res);
    expect(body.ok).toBe(false);
    expect(body.reason).toBe('michael_runtime_response_disabled');
    expect(body.response).toBeUndefined();
    expect(body.trace).toBeUndefined();
  });

  it('4. route on + response on + trace off -> 200 ok:true, trace stripped (undefined)', () => {
    process.env.MICHAEL_RUNTIME_ROUTE_ENABLED = 'true';
    process.env.MICHAEL_RUNTIME_RESPONSE_ENABLED = 'true';
    // trace flag intentionally left unset (off)

    const res = createMockRes();
    invoke(createReq(), res);

    expect(res.statusCode).toBe(200);
    const body = asBody(res);
    expect(body.ok).toBe(true);
    expect(body.trace).toBeUndefined();
    expect(body.response).toBeDefined();
  });

  it('5. route on + response on + trace on -> 200 ok:true, trace present (object)', () => {
    process.env.MICHAEL_RUNTIME_ROUTE_ENABLED = 'true';
    process.env.MICHAEL_RUNTIME_RESPONSE_ENABLED = 'true';
    process.env.MICHAEL_RUNTIME_TRACE_ENABLED = 'true';

    const res = createMockRes();
    invoke(createReq(), res);

    expect(res.statusCode).toBe(200);
    const body = asBody(res);
    expect(body.ok).toBe(true);
    expect(body.trace).toBeDefined();
    expect(typeof body.trace).toBe('object');
    expect(body.trace).not.toBeNull();
  });

  it('6. trace flag = "TRUE" (not exact) -> success WITHOUT trace', () => {
    process.env.MICHAEL_RUNTIME_ROUTE_ENABLED = 'true';
    process.env.MICHAEL_RUNTIME_RESPONSE_ENABLED = 'true';
    process.env.MICHAEL_RUNTIME_TRACE_ENABLED = 'TRUE';

    const res = createMockRes();
    invoke(createReq(), res);

    expect(res.statusCode).toBe(200);
    const body = asBody(res);
    expect(body.ok).toBe(true);
    expect(body.trace).toBeUndefined();
  });

  it('7. partial config: route on but response unset -> 503 response_disabled (axis fail-closes)', () => {
    process.env.MICHAEL_RUNTIME_ROUTE_ENABLED = 'true';
    // response + trace unset

    const res = createMockRes();
    invoke(createReq(), res);

    expect(res.statusCode).toBe(503);
    expect(asBody(res).reason).toBe('michael_runtime_response_disabled');
  });

  it('8. partial config: route on + response on but trace unset -> success without trace', () => {
    process.env.MICHAEL_RUNTIME_ROUTE_ENABLED = 'true';
    process.env.MICHAEL_RUNTIME_RESPONSE_ENABLED = 'true';
    // trace unset

    const res = createMockRes();
    invoke(createReq(), res);

    expect(res.statusCode).toBe(200);
    const body = asBody(res);
    expect(body.ok).toBe(true);
    expect(body.trace).toBeUndefined();
  });

  it('9. all unset (default) -> 503 michael_runtime_disabled (fully inert default)', () => {
    const res = createMockRes();
    invoke(createReq(), res);

    expect(res.statusCode).toBe(503);
    const body = asBody(res);
    expect(body.ok).toBe(false);
    expect(body.reason).toBe('michael_runtime_disabled');
  });

  it('10. flags are env-only: body/query MICHAEL_RUNTIME_ROUTE_ENABLED="false" is ignored', () => {
    process.env.MICHAEL_RUNTIME_ROUTE_ENABLED = 'true';
    process.env.MICHAEL_RUNTIME_RESPONSE_ENABLED = 'true';

    const res = createMockRes();
    invoke(
      createReq({
        body: { MICHAEL_RUNTIME_ROUTE_ENABLED: 'false' },
        query: { MICHAEL_RUNTIME_ROUTE_ENABLED: 'false' },
      }),
      res,
    );

    // Env wins; body/query are not a flag source.
    expect(res.statusCode).toBe(200);
    expect(asBody(res).ok).toBe(true);
  });

  it('11. enabled success path returns the inert fixture (agentResponseGenerated false, persistence disabled)', () => {
    process.env.MICHAEL_RUNTIME_ROUTE_ENABLED = 'true';
    process.env.MICHAEL_RUNTIME_RESPONSE_ENABLED = 'true';

    const res = createMockRes();
    invoke(createReq(), res);

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
