import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { handleMichaelRuntimeResolve } from '../michael-runtime.js';
import { validateMichaelResponseContract } from '../../runtime/orchestration/index.js';

const traceMock = vi.hoisted(() => vi.fn());

vi.mock('../../services/runtimeContextTrace.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../services/runtimeContextTrace.js')>();
  return {
    ...actual,
    appendRuntimeContextTrace: traceMock,
  };
});

/**
 * S3.11 — focused end-to-end proof of the SERVER-OWNED Michael runtime contract.
 *
 * The runtime turn is built entirely server-side from the authenticated session.
 * The request body is server-owned: the accepted fields are optional `language`
 * ('en' | 'es') and optional `ask` (short BA-owned training/support text).
 * This file pins the new contract through the exported
 * ASYNC handler (supertest is not installed; index.ts listens at import):
 *
 *  - `{}`                 -> 200 degraded safe_fallback (EN)
 *  - `{ language: 'es' }` -> 200 degraded safe_fallback (ES sibling)
 *  - `{ ask: '...' }`      -> 200 through the controlled contract
 *  - any other body field  -> 400 CLIENT_RUNTIME_INPUT_NOT_ALLOWED
 *  - malformed allowed values -> 400 CLIENT_RUNTIME_INPUT_NOT_ALLOWED
 *  - route flag off       -> 503 michael_runtime_disabled
 *  - response flag off    -> 503 michael_runtime_response_disabled
 *  - turn-source failure  -> 422 (deterministic, never throws)
 *  - success invariants   -> agentResponseGenerated false, persistence disabled,
 *                            trace omitted unless the trace flag is on.
 */

const SESSION_BA_ID = 'TMAG-ABC234';

const FLAG_KEYS = [
  'MICHAEL_RUNTIME_ROUTE_ENABLED',
  'MICHAEL_RUNTIME_RESPONSE_ENABLED',
  'MICHAEL_RUNTIME_TRACE_ENABLED',
  'MCS_CONTEXT_MANAGER_LIVE_ENABLED',
] as const;

type FlagKey = (typeof FLAG_KEYS)[number];

let envSnapshot: Record<FlagKey, string | undefined>;

beforeEach(() => {
  traceMock.mockReset();
  traceMock.mockResolvedValue({ traceId: 'ctx_trace_test' });
  envSnapshot = {
    MICHAEL_RUNTIME_ROUTE_ENABLED: process.env.MICHAEL_RUNTIME_ROUTE_ENABLED,
    MICHAEL_RUNTIME_RESPONSE_ENABLED: process.env.MICHAEL_RUNTIME_RESPONSE_ENABLED,
    MICHAEL_RUNTIME_TRACE_ENABLED: process.env.MICHAEL_RUNTIME_TRACE_ENABLED,
    MCS_CONTEXT_MANAGER_LIVE_ENABLED: process.env.MCS_CONTEXT_MANAGER_LIVE_ENABLED,
  };
  for (const key of FLAG_KEYS) delete process.env[key];
});

afterEach(() => {
  for (const key of FLAG_KEYS) {
    const previous = envSnapshot[key];
    if (previous === undefined) delete process.env[key];
    else process.env[key] = previous;
  }
});

function enableRouteAndResponse(): void {
  process.env.MICHAEL_RUNTIME_ROUTE_ENABLED = 'true';
  process.env.MICHAEL_RUNTIME_RESPONSE_ENABLED = 'true';
}

function mockRes() {
  const r: any = { statusCode: 200 };
  r.status = (c: number) => {
    r.statusCode = c;
    return r;
  };
  r.json = (b: unknown) => {
    r.body = b;
    return r;
  };
  return r;
}

function mockReq(
  body: Record<string, unknown> = {},
  withSession = true,
  sessionTmagId: string = SESSION_BA_ID,
) {
  return {
    ...(withSession ? { session: { tmagId: sessionTmagId } } : {}),
    body,
  } as any;
}

describe('S3.11 server-owned Michael runtime turn — end-to-end contract', () => {
  it('1. {} body resolves to the degraded safe_fallback EN fixture (200, contract-valid, inert)', async () => {
    enableRouteAndResponse();
    const res = mockRes();
    await handleMichaelRuntimeResolve(mockReq({}), res);

    expect(res.statusCode).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.catalogKey).toBe('michael_safe_fallback_degraded_en');
    expect(res.body.response.responseType).toBe('safe_fallback');
    expect(res.body.response.language).toBe('en');
    expect(res.body.response.agentResponseGenerated).toBe(false);
    expect(res.body.response.persistence).toBe('disabled');
    expect(res.body.selectionRequest).toBeDefined();
    expect(res.body.selectionRequest.agentKey).toBe('michael_magnificent');
    expect(res.body.selectionRequest.taskType).toBe('training_support');
    expect(validateMichaelResponseContract(res.body.response).ok).toBe(true);
    // Trace omitted while the trace flag is off.
    expect(res.body.trace).toBeUndefined();
  });

  it('2. { language: "es" } resolves to the ES safe_fallback sibling (200, inert)', async () => {
    enableRouteAndResponse();
    const res = mockRes();
    await handleMichaelRuntimeResolve(mockReq({ language: 'es' }), res);

    expect(res.statusCode).toBe(200);
    expect(res.body.catalogKey.endsWith('_es')).toBe(true);
    expect(res.body.response.responseType).toBe('safe_fallback');
    expect(res.body.response.language).toBe('es');
    expect(res.body.response.agentResponseGenerated).toBe(false);
    expect(res.body.response.persistence).toBe('disabled');
  });

  it('3. { language: "en" } is the explicit equivalent of {} and resolves to the EN fixture', async () => {
    enableRouteAndResponse();
    const res = mockRes();
    await handleMichaelRuntimeResolve(mockReq({ language: 'en' }), res);

    expect(res.statusCode).toBe(200);
    expect(res.body.catalogKey).toBe('michael_safe_fallback_degraded_en');
    expect(res.body.response.language).toBe('en');
  });

  it('3b. { ask } is accepted as BA-owned training/support text', async () => {
    enableRouteAndResponse();
    const res = mockRes();
    await handleMichaelRuntimeResolve(mockReq({ ask: 'What should I practice next?' }), res);

    expect(res.statusCode).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(validateMichaelResponseContract(res.body.response).ok).toBe(true);
  });

  it.each([
    ['tmagId', { tmagId: 'TMAG-EVIL-000000' }],
    ['sponsorTmagId', { sponsorTmagId: 'TMAG-EVIL-000000' }],
    ['targetTmagId', { targetTmagId: 'TMAG-EVIL-000000' }],
    ['turn', { turn: {} }],
    ['runtimeTurn', { runtimeTurn: {} }],
    ['contextPacket', { contextPacket: {} }],
    ['token', { token: 'x' }],
    ['sessionId', { sessionId: 'x' }],
    ['correlationId', { correlationId: 'x' }],
    ['extra+language', { language: 'en', token: 'x' }],
  ] as ReadonlyArray<readonly [string, Record<string, unknown>]>)(
    '4. forbidden body field %s -> 400 CLIENT_RUNTIME_INPUT_NOT_ALLOWED (no facade work)',
    async (_label, body) => {
      enableRouteAndResponse();
      const res = mockRes();
      await handleMichaelRuntimeResolve(mockReq(body), res);

      expect(res.statusCode).toBe(400);
      expect(res.body.ok).toBe(false);
      expect(res.body.code).toBe('CLIENT_RUNTIME_INPUT_NOT_ALLOWED');
      expect(res.body.error).toBe('Michael runtime input must be server-owned.');
      expect(res.body).not.toHaveProperty('response');
      expect(res.body).not.toHaveProperty('catalogKey');
    },
  );

  it('5. malformed language value -> 400 CLIENT_RUNTIME_INPUT_NOT_ALLOWED', async () => {
    enableRouteAndResponse();
    const res = mockRes();
    await handleMichaelRuntimeResolve(mockReq({ language: 'de' }), res);

    expect(res.statusCode).toBe(400);
    expect(res.body.code).toBe('CLIENT_RUNTIME_INPUT_NOT_ALLOWED');
  });

  it('5b. malformed ask value -> 400 CLIENT_RUNTIME_INPUT_NOT_ALLOWED', async () => {
    enableRouteAndResponse();
    const res = mockRes();
    await handleMichaelRuntimeResolve(mockReq({ ask: 'x'.repeat(501) }), res);

    expect(res.statusCode).toBe(400);
    expect(res.body.code).toBe('CLIENT_RUNTIME_INPUT_NOT_ALLOWED');
  });

  it('6. route flag off -> 503 michael_runtime_disabled (fail-closed, no leak)', async () => {
    const res = mockRes();
    await handleMichaelRuntimeResolve(mockReq({}), res);

    expect(res.statusCode).toBe(503);
    expect(res.body.reason).toBe('michael_runtime_disabled');
    expect(res.body).not.toHaveProperty('response');
    expect(res.body).not.toHaveProperty('catalogKey');
  });

  it('7. response flag off -> 503 michael_runtime_response_disabled', async () => {
    process.env.MICHAEL_RUNTIME_ROUTE_ENABLED = 'true';
    const res = mockRes();
    await handleMichaelRuntimeResolve(mockReq({}), res);

    expect(res.statusCode).toBe(503);
    expect(res.body.reason).toBe('michael_runtime_response_disabled');
    expect(res.body).not.toHaveProperty('response');
  });

  it('8. missing session -> 401 before any turn-source/facade work', async () => {
    enableRouteAndResponse();
    const res = mockRes();
    await handleMichaelRuntimeResolve(mockReq({}, false), res);

    expect(res.statusCode).toBe(401);
    expect(res.body.ok).toBe(false);
  });

  it('9. a downstream turn-source failure (whitespace session tmagId) maps to 422 without throwing', async () => {
    enableRouteAndResponse();
    const res = mockRes();

    await expect(
      handleMichaelRuntimeResolve(mockReq({}, true, '   '), res),
    ).resolves.toBeDefined();
    expect(res.statusCode).toBe(422);
    expect(res.body.ok).toBe(false);
    expect(Array.isArray(res.body.issues)).toBe(true);
    // No success surface leaked on the failure path.
    expect(res.body).not.toHaveProperty('response');
    expect(res.body).not.toHaveProperty('catalogKey');
  });

  it('10. trace is included (redacted) only when the trace flag is on', async () => {
    enableRouteAndResponse();
    process.env.MICHAEL_RUNTIME_TRACE_ENABLED = 'true';
    const res = mockRes();
    await handleMichaelRuntimeResolve(mockReq({}), res);

    expect(res.statusCode).toBe(200);
    expect(res.body.trace).toBeDefined();
    expect(typeof res.body.trace).toBe('object');
    expect(res.body.contextTraceId).toBe('ctx_trace_test');
    expect(traceMock).toHaveBeenCalledWith(expect.objectContaining({
      agentKey: 'michael_magnificent',
      taskType: 'training_support',
      runtimeSurface: 'michael-runtime',
      tmagId: SESSION_BA_ID,
    }));
  });
});
