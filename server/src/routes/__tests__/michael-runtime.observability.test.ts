/**
 * S3.11 — Michael runtime route observability wiring tests (Agent C).
 *
 * Confirms that handleMichaelRuntimeResolve increments the correct in-memory
 * aggregate counter on each control-flow branch, WITHOUT altering the route's
 * externally observable behavior (status codes, response shape, fail-closed
 * defaults). The handler is exercised directly with mock req/res — supertest is
 * not installed and index.ts calls app.listen() at import. The handler is ASYNC,
 * so every call is awaited.
 *
 * SERVER-OWNED contract (S3.11): the request body is server-owned (only optional
 * `language`). Any other field — including the old body-BA-scope keys and any
 * client-supplied turn / Context Packet — is rejected with 400
 * `CLIENT_RUNTIME_INPUT_NOT_ALLOWED` and increments `bodyBaOverrideRejections`.
 * The route no longer rejects a "missing turn": `missingTurnRejections` remains a
 * defined counter key but is never incremented by the route (stays 0).
 *
 * The counters store no request/response/trace data: the snapshot's structural
 * shape is asserted unchanged across every path.
 *
 * Env hygiene: the three MICHAEL_RUNTIME_* vars are snapshotted/cleared in
 * beforeEach and restored exactly in afterEach. The counter store is reset
 * around every test.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { handleMichaelRuntimeResolve } from '../michael-runtime.js';
import {
  getMichaelRuntimeObservabilitySnapshot,
  resetMichaelRuntimeObservabilityForTests,
} from '../../services/michaelRuntimeObservability.js';

const SESSION_BA_ID = 'TMBA-20240101-ABCDEF';

const FLAG_KEYS = [
  'MICHAEL_RUNTIME_ROUTE_ENABLED',
  'MICHAEL_RUNTIME_RESPONSE_ENABLED',
  'MICHAEL_RUNTIME_TRACE_ENABLED',
] as const;

type FlagKey = (typeof FLAG_KEYS)[number];

const COUNTER_KEYS = [
  'routeDisabledSkips',
  'responseDisabledSkips',
  'successfulFacadeResolutions',
  'facadeFailures',
  'bodyBaOverrideRejections',
  'missingTurnRejections',
] as const;

let envSnapshot: Record<FlagKey, string | undefined>;

beforeEach(() => {
  envSnapshot = {
    MICHAEL_RUNTIME_ROUTE_ENABLED: process.env.MICHAEL_RUNTIME_ROUTE_ENABLED,
    MICHAEL_RUNTIME_RESPONSE_ENABLED: process.env.MICHAEL_RUNTIME_RESPONSE_ENABLED,
    MICHAEL_RUNTIME_TRACE_ENABLED: process.env.MICHAEL_RUNTIME_TRACE_ENABLED,
  };
  for (const key of FLAG_KEYS) delete process.env[key];
  resetMichaelRuntimeObservabilityForTests();
});

afterEach(() => {
  resetMichaelRuntimeObservabilityForTests();
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
  sessionBaId: string = SESSION_BA_ID,
) {
  return {
    ...(withSession ? { session: { baId: sessionBaId } } : {}),
    body,
  } as any;
}

describe('S3.11 Michael runtime route — observability counter wiring', () => {
  it('1. route-disabled request increments routeDisabledSkips only, behavior unchanged (503)', async () => {
    // No flags set — route axis off.
    const res = mockRes();
    await handleMichaelRuntimeResolve(mockReq({}), res);

    expect(res.statusCode).toBe(503);
    expect(res.body.reason).toBe('michael_runtime_disabled');

    const c = getMichaelRuntimeObservabilitySnapshot().counters;
    expect(c.routeDisabledSkips).toBe(1);
    expect(c.responseDisabledSkips).toBe(0);
    expect(c.successfulFacadeResolutions).toBe(0);
    expect(c.facadeFailures).toBe(0);
    expect(c.bodyBaOverrideRejections).toBe(0);
    expect(c.missingTurnRejections).toBe(0);
  });

  it('2. response-disabled request increments responseDisabledSkips only, behavior unchanged (503)', async () => {
    process.env.MICHAEL_RUNTIME_ROUTE_ENABLED = 'true';
    // response axis left off
    const res = mockRes();
    await handleMichaelRuntimeResolve(mockReq({}), res);

    expect(res.statusCode).toBe(503);
    expect(res.body.reason).toBe('michael_runtime_response_disabled');

    const c = getMichaelRuntimeObservabilitySnapshot().counters;
    expect(c.responseDisabledSkips).toBe(1);
    expect(c.routeDisabledSkips).toBe(0);
    expect(c.successfulFacadeResolutions).toBe(0);
    expect(c.facadeFailures).toBe(0);
    expect(c.bodyBaOverrideRejections).toBe(0);
    expect(c.missingTurnRejections).toBe(0);
  });

  it('3. fully-enabled empty-body request increments successfulFacadeResolutions; response shape unchanged', async () => {
    enableRouteAndResponse();
    const res = mockRes();
    await handleMichaelRuntimeResolve(mockReq({}), res);

    expect(res.statusCode).toBe(200);
    expect(res.body.ok).toBe(true);
    // Inert-fixture invariants preserved.
    expect(res.body.response.agentResponseGenerated).toBe(false);
    expect(res.body.response.persistence).toBe('disabled');
    expect(res.body.catalogKey).toBeDefined();
    expect(res.body.selectionRequest).toBeDefined();

    const c = getMichaelRuntimeObservabilitySnapshot().counters;
    expect(c.successfulFacadeResolutions).toBe(1);
    expect(c.routeDisabledSkips).toBe(0);
    expect(c.responseDisabledSkips).toBe(0);
    expect(c.facadeFailures).toBe(0);
    expect(c.bodyBaOverrideRejections).toBe(0);
    expect(c.missingTurnRejections).toBe(0);
  });

  it('4. body baId override increments bodyBaOverrideRejections only (now via CLIENT_RUNTIME_INPUT_NOT_ALLOWED)', async () => {
    enableRouteAndResponse();
    const res = mockRes();
    await handleMichaelRuntimeResolve(mockReq({ baId: 'TMBA-EVIL-000000' }), res);

    expect(res.statusCode).toBe(400);
    expect(res.body.code).toBe('CLIENT_RUNTIME_INPUT_NOT_ALLOWED');

    const c = getMichaelRuntimeObservabilitySnapshot().counters;
    expect(c.bodyBaOverrideRejections).toBe(1);
    expect(c.routeDisabledSkips).toBe(0);
    expect(c.responseDisabledSkips).toBe(0);
    expect(c.successfulFacadeResolutions).toBe(0);
    expect(c.facadeFailures).toBe(0);
    expect(c.missingTurnRejections).toBe(0);
  });

  it('5. a client-supplied turn/contextPacket field increments bodyBaOverrideRejections; missingTurnRejections stays 0', async () => {
    enableRouteAndResponse();

    const resTurn = mockRes();
    await handleMichaelRuntimeResolve(
      mockReq({ turn: { identity: {}, taskType: 'training_support' } }),
      resTurn,
    );
    expect(resTurn.statusCode).toBe(400);
    expect(resTurn.body.code).toBe('CLIENT_RUNTIME_INPUT_NOT_ALLOWED');

    const resPacket = mockRes();
    await handleMichaelRuntimeResolve(
      mockReq({ contextPacket: { approvedKnowledge: [] } }),
      resPacket,
    );
    expect(resPacket.statusCode).toBe(400);
    expect(resPacket.body.code).toBe('CLIENT_RUNTIME_INPUT_NOT_ALLOWED');

    const c = getMichaelRuntimeObservabilitySnapshot().counters;
    expect(c.bodyBaOverrideRejections).toBe(2);
    // The route never increments missingTurnRejections — it no longer exists as a
    // control-flow branch (the turn is server-owned).
    expect(c.missingTurnRejections).toBe(0);
    expect(c.routeDisabledSkips).toBe(0);
    expect(c.responseDisabledSkips).toBe(0);
    expect(c.successfulFacadeResolutions).toBe(0);
    expect(c.facadeFailures).toBe(0);
  });

  it('6. a downstream turn-source failure (whitespace session baId) increments facadeFailures only; 422 unchanged', async () => {
    enableRouteAndResponse();
    const res = mockRes();
    // Whitespace session baId passes the 401 guard but the server-owned turn
    // source fails closed -> deterministic 422 facade-failure path.
    await handleMichaelRuntimeResolve(mockReq({}, true, '   '), res);

    expect(res.statusCode).toBe(422);
    expect(res.body.ok).toBe(false);
    expect(Array.isArray(res.body.issues)).toBe(true);

    const c = getMichaelRuntimeObservabilitySnapshot().counters;
    expect(c.facadeFailures).toBe(1);
    expect(c.routeDisabledSkips).toBe(0);
    expect(c.responseDisabledSkips).toBe(0);
    expect(c.successfulFacadeResolutions).toBe(0);
    expect(c.bodyBaOverrideRejections).toBe(0);
    expect(c.missingTurnRejections).toBe(0);
  });

  it('7. counters store no request/response/trace data — snapshot shape unchanged after a success', async () => {
    enableRouteAndResponse();
    process.env.MICHAEL_RUNTIME_TRACE_ENABLED = 'true';
    const res = mockRes();
    await handleMichaelRuntimeResolve(mockReq({}), res);

    expect(res.statusCode).toBe(200);

    const snap = getMichaelRuntimeObservabilitySnapshot();
    // Top-level keys unchanged; counter key set unchanged (all 6 present,
    // including the now-dormant missingTurnRejections).
    expect(Object.keys(snap).sort()).toEqual(
      ['counters', 'responseEnabled', 'routeEnabled', 'traceEnabled'].sort(),
    );
    expect(Object.keys(snap.counters).sort()).toEqual([...COUNTER_KEYS].sort());
    // No turn/trace/PII content leaked into the aggregate.
    const serialized = JSON.stringify(snap);
    expect(serialized).not.toContain(SESSION_BA_ID);
    expect(serialized).not.toContain('runtimeTurn');
    expect(serialized).not.toContain('identity');
  });

  it('8. default-off route does not call the turn source/facade and only counts the skip', async () => {
    const res = mockRes();
    await handleMichaelRuntimeResolve(mockReq({}), res);

    expect(res.statusCode).toBe(503);
    expect(res.body).not.toHaveProperty('response');
    expect(res.body).not.toHaveProperty('trace');

    const c = getMichaelRuntimeObservabilitySnapshot().counters;
    expect(c.routeDisabledSkips).toBe(1);
    // Turn source / facade never ran — success/failure both zero.
    expect(c.successfulFacadeResolutions).toBe(0);
    expect(c.facadeFailures).toBe(0);
  });
});
