import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { handleMichaelRuntimeResolve } from '../michael-runtime.js';
import { validateMichaelResponseContract } from '../../runtime/orchestration/index.js';

/**
 * S3.11 — direct handler-level tests for the SERVER-OWNED Michael runtime route.
 *
 * The runtime turn is now built entirely server-side from the authenticated
 * session — the client NO LONGER supplies a `body.turn`. The request body is
 * server-owned: the ONLY accepted field is optional `language` ('en' | 'es').
 * Any other key — or a malformed `language` — is rejected with 400
 * `CLIENT_RUNTIME_INPUT_NOT_ALLOWED`. A valid request body is `{}` or
 * `{ language: 'en' | 'es' }`.
 *
 * supertest is not installed and `server/src/index.ts` calls `app.listen()` at
 * import, so we exercise `handleMichaelRuntimeResolve(req, res)` directly with
 * mock req/res. The handler is ASYNC — every call is awaited. Mount facts (path,
 * no clobbering of /api/michael) are covered by the static governance test, not
 * here.
 */

const SESSION_BA_ID = 'TMAG-ABC234';

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

/**
 * Build a server-owned request. The body is whatever the client sends (the
 * route accepts only `{}` or `{ language }`); session identity is server-owned.
 * Pass `withSession=false` to drop the session, or a custom `sessionTmagId` (e.g.
 * whitespace) to exercise the downstream turn-source failure path.
 */
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

// Every body key that is NOT exactly `language` must be rejected. This covers
// the former body-BA-scope keys PLUS the broader server-owned forbidden set
// (client-supplied turn, Context Packet, identifiers, tokens, …).
const FORBIDDEN_BODY_CASES: ReadonlyArray<readonly [string, Record<string, unknown>]> = [
  ['tmagId', { tmagId: 'TMAG-EVIL-000000' }],
  ['sponsorTmagId', { sponsorTmagId: 'TMAG-EVIL-000000' }],
  ['targetTmagId', { targetTmagId: 'TMAG-EVIL-000000' }],
  ['downlineTmagId', { downlineTmagId: 'TMAG-EVIL-000000' }],
  ['turn', { turn: { identity: {}, taskType: 'training_support' } }],
  ['runtimeTurn', { runtimeTurn: { scenario: 'accepted_degraded' } }],
  ['contextPacket', { contextPacket: { approvedKnowledge: [] } }],
  ['token', { token: 'prospect-token-xyz' }],
  ['sessionId', { sessionId: 'sess-123' }],
  ['correlationId', { correlationId: 'corr-123' }],
];

describe('S3.11 Michael runtime route handler — server-owned turn', () => {
  it('1. resolves an empty {} body to the degraded safe_fallback EN entry (200)', async () => {
    enableRouteAndResponse();
    const res = mockRes();
    await handleMichaelRuntimeResolve(mockReq({}), res);

    expect(res.statusCode).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.catalogKey).toBe('michael_safe_fallback_degraded_en');
    expect(res.body.response.responseType).toBe('safe_fallback');
    expect(validateMichaelResponseContract(res.body.response).ok).toBe(true);
  });

  it.each(FORBIDDEN_BODY_CASES)(
    '2. rejects a server-owned-forbidden body field %s with 400 CLIENT_RUNTIME_INPUT_NOT_ALLOWED',
    async (_label, extraBody) => {
      enableRouteAndResponse();
      const res = mockRes();
      await handleMichaelRuntimeResolve(mockReq(extraBody), res);

      expect(res.statusCode).toBe(400);
      expect(res.body.ok).toBe(false);
      expect(res.body.code).toBe('CLIENT_RUNTIME_INPUT_NOT_ALLOWED');
      expect(res.body.error).toBe('Michael runtime input must be server-owned.');
      // Forbidden input is rejected before any facade work — no resolution leaked.
      expect(res.body).not.toHaveProperty('response');
      expect(res.body).not.toHaveProperty('catalogKey');
      expect(res.body).not.toHaveProperty('trace');
    },
  );

  it('3. rejects a malformed language value with 400 CLIENT_RUNTIME_INPUT_NOT_ALLOWED', async () => {
    enableRouteAndResponse();
    const res = mockRes();
    await handleMichaelRuntimeResolve(mockReq({ language: 'fr' }), res);

    expect(res.statusCode).toBe(400);
    expect(res.body.code).toBe('CLIENT_RUNTIME_INPUT_NOT_ALLOWED');
  });

  it('4. rejects a missing session tmagId with 401 (server-owned body)', async () => {
    enableRouteAndResponse();
    const res = mockRes();
    await handleMichaelRuntimeResolve(mockReq({}, false), res);

    expect(res.statusCode).toBe(401);
    expect(res.body.ok).toBe(false);
  });

  it('5. fails closed with 503 michael_runtime_disabled and leaks no facade output when the route flag is off', async () => {
    // No flags set — route axis is off.
    const res = mockRes();
    await handleMichaelRuntimeResolve(mockReq({}), res);

    expect(res.statusCode).toBe(503);
    expect(res.body.reason).toBe('michael_runtime_disabled');
    expect(res.body.ok).toBe(false);
    expect(res.body.disabled).toBe(true);
    // Proves the turn source / facade were never called — nothing leaked.
    expect(res.body).not.toHaveProperty('response');
    expect(res.body).not.toHaveProperty('trace');
    expect(res.body).not.toHaveProperty('catalogKey');
    expect(res.body).not.toHaveProperty('selectionRequest');
  });

  it('6. fails closed with 503 michael_runtime_response_disabled when the response flag is off', async () => {
    process.env.MICHAEL_RUNTIME_ROUTE_ENABLED = 'true';
    // response axis deliberately left off
    const res = mockRes();
    await handleMichaelRuntimeResolve(mockReq({}), res);

    expect(res.statusCode).toBe(503);
    expect(res.body.reason).toBe('michael_runtime_response_disabled');
    expect(res.body).not.toHaveProperty('response');
    expect(res.body).not.toHaveProperty('trace');
  });

  it('7. returns 200 with no trace when the trace flag is absent', async () => {
    enableRouteAndResponse();
    // trace axis off
    const res = mockRes();
    await handleMichaelRuntimeResolve(mockReq({}), res);

    expect(res.statusCode).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.selectionRequest).toBeDefined();
    expect(res.body.catalogKey).toBeDefined();
    expect(res.body.response).toBeDefined();
    expect(res.body.trace).toBeUndefined();
  });

  it('8. returns 200 with a redacted trace carrying no forbidden keys when all three flags are on', async () => {
    enableRouteAndResponse();
    process.env.MICHAEL_RUNTIME_TRACE_ENABLED = 'true';
    const res = mockRes();
    await handleMichaelRuntimeResolve(mockReq({}), res);

    expect(res.statusCode).toBe(200);
    expect(res.body.trace).toBeDefined();
    expect(typeof res.body.trace).toBe('object');

    const keys = collectKeys(res.body.trace);
    for (const forbidden of FORBIDDEN_TRACE_KEYS) {
      expect(keys.has(forbidden)).toBe(false);
    }
  });

  it('9. keeps agentResponseGenerated === false on a successful response', async () => {
    enableRouteAndResponse();
    const res = mockRes();
    await handleMichaelRuntimeResolve(mockReq({}), res);

    expect(res.statusCode).toBe(200);
    expect(res.body.response.agentResponseGenerated).toBe(false);
  });

  it("10. keeps persistence === 'disabled' on a successful response", async () => {
    enableRouteAndResponse();
    const res = mockRes();
    await handleMichaelRuntimeResolve(mockReq({}), res);

    expect(res.statusCode).toBe(200);
    expect(res.body.response.persistence).toBe('disabled');
  });

  it('11. returns the verbatim catalog fixture with string text and no generated-text metadata', async () => {
    enableRouteAndResponse();
    const res = mockRes();
    await handleMichaelRuntimeResolve(mockReq({}), res);

    expect(res.statusCode).toBe(200);
    expect(res.body.response.agentResponseGenerated).toBe(false);
    expect(res.body.response.persistence).toBe('disabled');
    expect(typeof res.body.response.text).toBe('string');
  });

  it('12. maps a downstream turn-source failure (whitespace session tmagId) to a deterministic 422 without throwing', async () => {
    enableRouteAndResponse();
    const res = mockRes();

    // A whitespace session tmagId is truthy (passes the 401 guard) but the
    // server-owned turn source trims it to '' and fails closed -> 422.
    await expect(
      handleMichaelRuntimeResolve(mockReq({}, true, '   '), res),
    ).resolves.toBeDefined();
    expect(res.statusCode).toBe(422);
    expect(res.body.ok).toBe(false);
    expect(Array.isArray(res.body.issues)).toBe(true);
  });

  it('13. resolves an ES session ({ language: "es" }) to an ES catalog entry with an ES response', async () => {
    enableRouteAndResponse();
    const res = mockRes();
    await handleMichaelRuntimeResolve(mockReq({ language: 'es' }), res);

    expect(res.statusCode).toBe(200);
    expect(res.body.catalogKey.endsWith('_es')).toBe(true);
    expect(res.body.response.responseType).toBe('safe_fallback');
    expect(res.body.response.language).toBe('es');
  });
});
