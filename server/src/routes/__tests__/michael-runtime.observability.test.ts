/**
 * S3.6 — Michael runtime route observability wiring tests (Agent C).
 *
 * Confirms that handleMichaelRuntimeResolve increments the correct in-memory
 * aggregate counter on each control-flow branch, WITHOUT altering the route's
 * externally observable behavior (status codes, response shape, fail-closed
 * defaults). The handler is exercised directly with mock req/res — supertest is
 * not installed and index.ts calls app.listen() at import.
 *
 * The counters store no request/response/trace data: the snapshot's structural
 * shape is asserted unchanged across every path.
 *
 * Env hygiene: the three MICHAEL_RUNTIME_* vars are snapshotted/cleared in
 * beforeEach and restored exactly in afterEach. The counter store is reset
 * around every test.
 */

import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { handleMichaelRuntimeResolve } from '../michael-runtime.js';
import { runRuntimeTurnFixtureScenario } from '../../runtime/orchestration/fixtures/runtimeTurnHarness.js';
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

function mockReq(turn: unknown, extraBody: Record<string, unknown> = {}, withSession = true) {
  return {
    ...(withSession ? { session: { baId: SESSION_BA_ID } } : {}),
    body: { ...(turn !== undefined ? { turn } : {}), ...extraBody },
  } as any;
}

// Built once — the same accepted_complete clear-training turn drives the
// success/override/missing cases.
let turn: Record<string, unknown>;

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

describe('S3.6 Michael runtime route — observability counter wiring', () => {
  it('1. route-disabled request increments routeDisabledSkips only, behavior unchanged (503)', () => {
    // No flags set — route axis off.
    const res = mockRes();
    handleMichaelRuntimeResolve(mockReq(turn), res);

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

  it('2. response-disabled request increments responseDisabledSkips only, behavior unchanged (503)', () => {
    process.env.MICHAEL_RUNTIME_ROUTE_ENABLED = 'true';
    // response axis left off
    const res = mockRes();
    handleMichaelRuntimeResolve(mockReq(turn), res);

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

  it('3. fully-enabled valid turn increments successfulFacadeResolutions; response shape unchanged', () => {
    enableRouteAndResponse();
    const res = mockRes();
    handleMichaelRuntimeResolve(mockReq(turn), res);

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

  it('4. body baId override increments bodyBaOverrideRejections only (route+response enabled)', () => {
    enableRouteAndResponse();
    const res = mockRes();
    handleMichaelRuntimeResolve(mockReq(turn, { baId: 'TMBA-EVIL-000000' }), res);

    expect(res.statusCode).toBe(400);
    expect(res.body.code).toBe('BODY_BA_SCOPE_NOT_ALLOWED');

    const c = getMichaelRuntimeObservabilitySnapshot().counters;
    expect(c.bodyBaOverrideRejections).toBe(1);
    expect(c.routeDisabledSkips).toBe(0);
    expect(c.responseDisabledSkips).toBe(0);
    expect(c.successfulFacadeResolutions).toBe(0);
    expect(c.facadeFailures).toBe(0);
    expect(c.missingTurnRejections).toBe(0);
  });

  it('5. missing turn increments missingTurnRejections only (route+response enabled)', () => {
    enableRouteAndResponse();
    const res = mockRes();
    handleMichaelRuntimeResolve(mockReq(undefined), res);

    expect(res.statusCode).toBe(400);
    expect(res.body.code).toBe('MISSING_RUNTIME_TURN');

    const c = getMichaelRuntimeObservabilitySnapshot().counters;
    expect(c.missingTurnRejections).toBe(1);
    expect(c.routeDisabledSkips).toBe(0);
    expect(c.responseDisabledSkips).toBe(0);
    expect(c.successfulFacadeResolutions).toBe(0);
    expect(c.facadeFailures).toBe(0);
    expect(c.bodyBaOverrideRejections).toBe(0);
  });

  it('6. malformed turn (facade !ok) increments facadeFailures only; 422 unchanged', () => {
    enableRouteAndResponse();
    const res = mockRes();
    // An empty object turn is a well-formed object but a malformed runtime turn —
    // it forces the deterministic 422 facade-failure path (same input the S3.4
    // handler test uses).
    handleMichaelRuntimeResolve(mockReq({}), res);

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

  it('7. counters store no request/response/trace data — snapshot shape unchanged after a success', () => {
    enableRouteAndResponse();
    process.env.MICHAEL_RUNTIME_TRACE_ENABLED = 'true';
    const res = mockRes();
    handleMichaelRuntimeResolve(mockReq(turn), res);

    expect(res.statusCode).toBe(200);

    const snap = getMichaelRuntimeObservabilitySnapshot();
    // Top-level keys unchanged; counter key set unchanged.
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

  it('8. default-off route does not call the facade and only counts the skip', () => {
    const res = mockRes();
    handleMichaelRuntimeResolve(mockReq(turn), res);

    expect(res.statusCode).toBe(503);
    expect(res.body).not.toHaveProperty('response');
    expect(res.body).not.toHaveProperty('trace');

    const c = getMichaelRuntimeObservabilitySnapshot().counters;
    expect(c.routeDisabledSkips).toBe(1);
    // Facade never ran — success/failure both zero.
    expect(c.successfulFacadeResolutions).toBe(0);
    expect(c.facadeFailures).toBe(0);
  });
});
