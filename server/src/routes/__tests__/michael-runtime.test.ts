import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { handleMichaelRuntimeResolve } from '../michael-runtime.js';
import { validateMichaelResponseContract } from '../../runtime/orchestration/index.js';
import { runRuntimeTurnFixtureScenario } from '../../runtime/orchestration/fixtures/runtimeTurnHarness.js';
import type { RuntimeTurnFixtureScenarioType } from '../../runtime/orchestration/types.js';

/**
 * S3.4 — direct handler-level tests for the Michael runtime route.
 *
 * supertest is not installed and `server/src/index.ts` calls `app.listen()` at
 * import, so we exercise `handleMichaelRuntimeResolve(req, res)` directly with
 * mock req/res. Mount facts (path, no clobbering of /api/michael) are covered by
 * the static governance test, not here.
 */

const SESSION_BA_ID = 'TMBA-20240101-ABCDEF';

const FLAG_KEYS = [
  'MICHAEL_RUNTIME_ROUTE_ENABLED',
  'MICHAEL_RUNTIME_RESPONSE_ENABLED',
  'MICHAEL_RUNTIME_TRACE_ENABLED',
] as const;

type FlagKey = (typeof FLAG_KEYS)[number];

// ENV HYGIENE — snapshot the three flags, clear them so every test starts from
// the default-OFF state, and restore exactly on teardown so nothing leaks to
// other files sharing this vitest worker.
let envSnapshot: Record<FlagKey, string | undefined>;

beforeEach(() => {
  envSnapshot = {
    MICHAEL_RUNTIME_ROUTE_ENABLED: process.env.MICHAEL_RUNTIME_ROUTE_ENABLED,
    MICHAEL_RUNTIME_RESPONSE_ENABLED: process.env.MICHAEL_RUNTIME_RESPONSE_ENABLED,
    MICHAEL_RUNTIME_TRACE_ENABLED: process.env.MICHAEL_RUNTIME_TRACE_ENABLED,
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

function mockReq(turn: unknown, extraBody: Record<string, unknown> = {}, withSession = true) {
  return {
    ...(withSession ? { session: { baId: SESSION_BA_ID } } : {}),
    body: { ...(turn !== undefined ? { turn } : {}), ...extraBody },
  } as any;
}

interface BuildTurnOptions {
  readonly scenario?: RuntimeTurnFixtureScenarioType;
  readonly intent?: 'clear_training_support' | 'ambiguous_training_support';
  readonly language?: 'en' | 'es';
}

/**
 * Build a valid MichaelRuntimeAdapterContractInput "turn" from the inert S2.8
 * runtime turn harness — the same shape the S2.15/S2.20 tests use. Returned only.
 */
async function buildTurn(options: BuildTurnOptions = {}): Promise<Record<string, unknown>> {
  const rt = await runRuntimeTurnFixtureScenario({
    scenario: options.scenario ?? 'accepted_complete',
    agentKey: 'michael_magnificent',
    taskType: 'training_support',
  });
  if (options.language && rt.input.identity) {
    rt.input.identity.language = options.language as never;
  }
  return {
    identity: rt.input.identity,
    turnId: rt.input.turnId,
    taskType: 'training_support',
    runtimeTurn: rt,
    ...(options.intent ? { intent: options.intent } : {}),
    ...(options.language ? { language: options.language } : {}),
  };
}

/** Recursively collect every object key reachable from a value. */
function collectKeys(value: unknown, acc: Set<string> = new Set<string>()): Set<string> {
  if (value && typeof value === 'object') {
    if (Array.isArray(value)) {
      for (const item of value) collectKeys(item, acc);
    } else {
      for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
        acc.add(key);
        collectKeys(child, acc);
      }
    }
  }
  return acc;
}

const FORBIDDEN_TRACE_KEYS = [
  'packet',
  'contextPacket',
  'retrievalAudit',
  'retrieval',
  'token',
  'sessionId',
  'turnId',
  'correlationId',
  'email',
  'phone',
  'prospect',
  'text',
] as const;

describe('S3.4 Michael runtime route handler', () => {
  it('1. rejects a missing turn with 400 MISSING_RUNTIME_TURN', () => {
    enableRouteAndResponse();
    const res = mockRes();
    handleMichaelRuntimeResolve(mockReq(undefined), res);

    expect(res.statusCode).toBe(400);
    expect(res.body.code).toBe('MISSING_RUNTIME_TURN');
    expect(res.body.ok).toBe(false);
  });

  it('2. rejects a body baId with 400 BODY_BA_SCOPE_NOT_ALLOWED', async () => {
    enableRouteAndResponse();
    const turn = await buildTurn({ intent: 'clear_training_support' });
    const res = mockRes();
    handleMichaelRuntimeResolve(mockReq(turn, { baId: 'TMBA-EVIL-000000' }), res);

    expect(res.statusCode).toBe(400);
    expect(res.body.code).toBe('BODY_BA_SCOPE_NOT_ALLOWED');
  });

  it('3. rejects a body sponsorBaId with 400 BODY_BA_SCOPE_NOT_ALLOWED', async () => {
    enableRouteAndResponse();
    const turn = await buildTurn({ intent: 'clear_training_support' });
    const res = mockRes();
    handleMichaelRuntimeResolve(mockReq(turn, { sponsorBaId: 'TMBA-EVIL-000000' }), res);

    expect(res.statusCode).toBe(400);
    expect(res.body.code).toBe('BODY_BA_SCOPE_NOT_ALLOWED');
  });

  it('4. rejects a body targetBaId with 400 BODY_BA_SCOPE_NOT_ALLOWED', async () => {
    enableRouteAndResponse();
    const turn = await buildTurn({ intent: 'clear_training_support' });
    const res = mockRes();
    handleMichaelRuntimeResolve(mockReq(turn, { targetBaId: 'TMBA-EVIL-000000' }), res);

    expect(res.statusCode).toBe(400);
    expect(res.body.code).toBe('BODY_BA_SCOPE_NOT_ALLOWED');
  });

  it('5. rejects a missing session baId with 401', async () => {
    enableRouteAndResponse();
    const turn = await buildTurn({ intent: 'clear_training_support' });
    const res = mockRes();
    handleMichaelRuntimeResolve(mockReq(turn, {}, false), res);

    expect(res.statusCode).toBe(401);
    expect(res.body.ok).toBe(false);
  });

  it('6. fails closed with 503 michael_runtime_disabled and leaks no facade output when the route flag is off', async () => {
    // No flags set — route axis is off.
    const turn = await buildTurn({ intent: 'clear_training_support' });
    const res = mockRes();
    handleMichaelRuntimeResolve(mockReq(turn), res);

    expect(res.statusCode).toBe(503);
    expect(res.body.reason).toBe('michael_runtime_disabled');
    expect(res.body.ok).toBe(false);
    expect(res.body.disabled).toBe(true);
    // Proves the facade was never called — no resolution surface leaked.
    expect(res.body).not.toHaveProperty('response');
    expect(res.body).not.toHaveProperty('trace');
    expect(res.body).not.toHaveProperty('catalogKey');
    expect(res.body).not.toHaveProperty('selectionRequest');
  });

  it('7. fails closed with 503 michael_runtime_response_disabled when the response flag is off', async () => {
    process.env.MICHAEL_RUNTIME_ROUTE_ENABLED = 'true';
    // response axis deliberately left off
    const turn = await buildTurn({ intent: 'clear_training_support' });
    const res = mockRes();
    handleMichaelRuntimeResolve(mockReq(turn), res);

    expect(res.statusCode).toBe(503);
    expect(res.body.reason).toBe('michael_runtime_response_disabled');
    expect(res.body).not.toHaveProperty('response');
    expect(res.body).not.toHaveProperty('trace');
  });

  it('8. returns 200 with no trace when the trace flag is absent', async () => {
    enableRouteAndResponse();
    // trace axis off
    const turn = await buildTurn({ intent: 'clear_training_support' });
    const res = mockRes();
    handleMichaelRuntimeResolve(mockReq(turn), res);

    expect(res.statusCode).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.selectionRequest).toBeDefined();
    expect(res.body.catalogKey).toBeDefined();
    expect(res.body.response).toBeDefined();
    expect(res.body.trace).toBeUndefined();
  });

  it('9. returns 200 with a redacted trace carrying no forbidden keys when all three flags are on', async () => {
    enableRouteAndResponse();
    process.env.MICHAEL_RUNTIME_TRACE_ENABLED = 'true';
    const turn = await buildTurn({ intent: 'clear_training_support' });
    const res = mockRes();
    handleMichaelRuntimeResolve(mockReq(turn), res);

    expect(res.statusCode).toBe(200);
    expect(res.body.trace).toBeDefined();
    expect(typeof res.body.trace).toBe('object');

    const keys = collectKeys(res.body.trace);
    for (const forbidden of FORBIDDEN_TRACE_KEYS) {
      expect(keys.has(forbidden)).toBe(false);
    }
  });

  it('10. resolves an enabled clear turn to the next_training_step EN catalog entry', async () => {
    enableRouteAndResponse();
    const turn = await buildTurn({ intent: 'clear_training_support' });
    const res = mockRes();
    handleMichaelRuntimeResolve(mockReq(turn), res);

    expect(res.statusCode).toBe(200);
    expect(res.body.catalogKey).toBe('michael_next_training_step_en');
    expect(res.body.catalogKey.endsWith('_en')).toBe(true);
    expect(res.body.response.responseType).toBe('next_training_step');
    expect(validateMichaelResponseContract(res.body.response).ok).toBe(true);
  });

  it('11. keeps agentResponseGenerated === false on a successful response', async () => {
    enableRouteAndResponse();
    const turn = await buildTurn({ intent: 'clear_training_support' });
    const res = mockRes();
    handleMichaelRuntimeResolve(mockReq(turn), res);

    expect(res.statusCode).toBe(200);
    expect(res.body.response.agentResponseGenerated).toBe(false);
  });

  it("12. keeps persistence === 'disabled' on a successful response", async () => {
    enableRouteAndResponse();
    const turn = await buildTurn({ intent: 'clear_training_support' });
    const res = mockRes();
    handleMichaelRuntimeResolve(mockReq(turn), res);

    expect(res.statusCode).toBe(200);
    expect(res.body.response.persistence).toBe('disabled');
  });

  it('13. returns the verbatim catalog fixture with no generated-text metadata', async () => {
    enableRouteAndResponse();
    const turn = await buildTurn({ intent: 'clear_training_support' });
    const res = mockRes();
    handleMichaelRuntimeResolve(mockReq(turn), res);

    expect(res.statusCode).toBe(200);
    expect(res.body.response.agentResponseGenerated).toBe(false);
    expect(res.body.response.persistence).toBe('disabled');
    expect(typeof res.body.response.text).toBe('string');
  });

  it('14. maps a malformed turn to a deterministic 422 without throwing', () => {
    enableRouteAndResponse();
    const res = mockRes();

    expect(() => handleMichaelRuntimeResolve(mockReq({}), res)).not.toThrow();
    expect(res.statusCode).toBe(422);
    expect(res.body.ok).toBe(false);
    expect(Array.isArray(res.body.issues)).toBe(true);
  });

  it('15. resolves a degraded scenario to the safe_fallback degraded EN entry', async () => {
    enableRouteAndResponse();
    const turn = await buildTurn({ scenario: 'accepted_degraded' });
    const res = mockRes();
    handleMichaelRuntimeResolve(mockReq(turn), res);

    expect(res.statusCode).toBe(200);
    expect(res.body.catalogKey).toBe('michael_safe_fallback_degraded_en');
    expect(res.body.response.responseType).toBe('safe_fallback');
  });

  it('16. resolves an ES clear turn to an ES catalog entry with an ES response', async () => {
    enableRouteAndResponse();
    const turn = await buildTurn({ intent: 'clear_training_support', language: 'es' });
    const res = mockRes();
    handleMichaelRuntimeResolve(mockReq(turn), res);

    expect(res.statusCode).toBe(200);
    expect(res.body.catalogKey.endsWith('_es')).toBe(true);
    expect(res.body.response.language).toBe('es');
  });
});
