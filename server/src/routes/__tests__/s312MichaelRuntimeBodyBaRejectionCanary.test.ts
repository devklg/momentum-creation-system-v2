import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { handleMichaelRuntimeResolve } from '../michael-runtime.js';
import {
  getMichaelRuntimeObservabilitySnapshot,
  resetMichaelRuntimeObservabilityForTests,
} from '../../services/michaelRuntimeObservability.js';

/**
 * S3.12 — targeted controlled canary for the S3.11 server-owned route boundary.
 *
 * The route accepts ONLY `{}` or `{ language: 'en' | 'es' }`. Every client-
 * supplied runtime input or body-supplied BA/prospect/session/correlation
 * authority field must reject with 400 CLIENT_RUNTIME_INPUT_NOT_ALLOWED.
 *
 * Direct exported-handler pattern follows the existing S3.11 tests; no real
 * Express port, no supertest, no persistence, no logging of request bodies.
 */

const SESSION_BA_ID = 'TMAG-20240101-ABCDEF';

const FLAG_KEYS = [
  'MICHAEL_RUNTIME_ROUTE_ENABLED',
  'MICHAEL_RUNTIME_RESPONSE_ENABLED',
  'MICHAEL_RUNTIME_TRACE_ENABLED',
] as const;

type FlagKey = (typeof FLAG_KEYS)[number];

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
  for (const key of FLAG_KEYS) {
    const previous = envSnapshot[key];
    if (previous === undefined) delete process.env[key];
    else process.env[key] = previous;
  }
  resetMichaelRuntimeObservabilityForTests();
});

function enableRouteAndResponse(): void {
  process.env.MICHAEL_RUNTIME_ROUTE_ENABLED = 'true';
  process.env.MICHAEL_RUNTIME_RESPONSE_ENABLED = 'true';
}

function mockRes() {
  const r: {
    statusCode: number;
    body?: unknown;
    status: (code: number) => typeof r;
    json: (body: unknown) => typeof r;
  } = {
    statusCode: 200,
    status(code: number) {
      r.statusCode = code;
      return r;
    },
    json(body: unknown) {
      r.body = body;
      return r;
    },
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

function expectClientRuntimeInputRejected(res: ReturnType<typeof mockRes>): void {
  expect(res.statusCode).toBe(400);
  expect(res.body).toMatchObject({
    ok: false,
    code: 'CLIENT_RUNTIME_INPUT_NOT_ALLOWED',
  });
  expect(res.body).not.toHaveProperty('response');
  expect(res.body).not.toHaveProperty('catalogKey');
  expect(res.body).not.toHaveProperty('selectionRequest');
}

function expectNoDownstreamWork(): void {
  const snapshot = getMichaelRuntimeObservabilitySnapshot();
  expect(snapshot.counters.successfulFacadeResolutions).toBe(0);
  expect(snapshot.counters.facadeFailures).toBe(0);
}

describe('S3.12 allowed server-owned Michael runtime resolve bodies', () => {
  it.each([
    ['empty body', {}, 'michael_safe_fallback_degraded_en', 'en'],
    ['explicit English', { language: 'en' }, 'michael_safe_fallback_degraded_en', 'en'],
    ['explicit Spanish', { language: 'es' }, 'michael_safe_fallback_degraded_es', 'es'],
  ] as const)(
    '%s succeeds through the server-owned turn path',
    async (_label, body, expectedCatalogKey, expectedLanguage) => {
      enableRouteAndResponse();
      const res = mockRes();

      await handleMichaelRuntimeResolve(mockReq(body), res as any);

      expect(res.statusCode).toBe(200);
      expect(res.body).toMatchObject({
        ok: true,
        catalogKey: expectedCatalogKey,
        response: {
          responseType: 'safe_fallback',
          agentResponseGenerated: false,
          persistence: 'disabled',
          language: expectedLanguage,
        },
      });
      expect(getMichaelRuntimeObservabilitySnapshot().counters.successfulFacadeResolutions).toBe(1);
    },
  );
});

describe('S3.12 forbidden runtime input payloads', () => {
  it.each([
    ['turn', { turn: {} }],
    ['runtimeTurn', { runtimeTurn: {} }],
    ['contextPacket', { contextPacket: {} }],
    ['retrieval', { retrieval: {} }],
    ['PERSISTENCE', { PERSISTENCE: {} }],
    ['graph', { graph: {} }],
    ['approvedKnowledge', { approvedKnowledge: [] }],
    ['candidateKnowledge', { candidateKnowledge: [] }],
  ] as ReadonlyArray<readonly [string, Record<string, unknown>]> )(
    'rejects client-supplied %s',
    async (_label, body) => {
      enableRouteAndResponse();
      const res = mockRes();

      await handleMichaelRuntimeResolve(mockReq(body), res as any);

      expectClientRuntimeInputRejected(res);
      expect(getMichaelRuntimeObservabilitySnapshot().counters.bodyBaOverrideRejections).toBe(1);
      expectNoDownstreamWork();
    },
  );
});

describe('S3.12 forbidden BA/prospect/session authority payloads', () => {
  it.each([
    ['tmagId', { tmagId: 'TMAG-EVIL-000001' }],
    ['sponsorTmagId', { sponsorTmagId: 'TMAG-EVIL-SPONSOR' }],
    ['targetTmagId', { targetTmagId: 'TMAG-EVIL-TARGET' }],
    ['downlineTmagId', { downlineTmagId: 'TMAG-EVIL-DOWNLINE' }],
    ['prospectId', { prospectId: 'PROSPECT-EVIL' }],
    ['prospectToken', { prospectToken: 'TOKEN-EVIL' }],
    ['token', { token: 'TOKEN-EVIL' }],
    ['sessionId', { sessionId: 'SESSION-EVIL' }],
    ['turnId', { turnId: 'TURN-EVIL' }],
    ['correlationId', { correlationId: 'CORR-EVIL' }],
    ['requestId', { requestId: 'REQ-EVIL' }],
  ] as ReadonlyArray<readonly [string, Record<string, unknown>]> )(
    'rejects body-supplied %s authority',
    async (_label, body) => {
      enableRouteAndResponse();
      const res = mockRes();

      await handleMichaelRuntimeResolve(mockReq(body), res as any);

      expectClientRuntimeInputRejected(res);
      expect(getMichaelRuntimeObservabilitySnapshot().counters.bodyBaOverrideRejections).toBe(1);
      expectNoDownstreamWork();
    },
  );
});

describe('S3.12 mixed forbidden payloads and malformed language', () => {
  it.each([
    ['English plus tmagId', { language: 'en', tmagId: 'TMAG-EVIL-000001' }],
    ['Spanish plus contextPacket', { language: 'es', contextPacket: {} }],
    ['English plus turn', { language: 'en', turn: {} }],
  ] as ReadonlyArray<readonly [string, Record<string, unknown>]> )(
    'rejects mixed payload: %s',
    async (_label, body) => {
      enableRouteAndResponse();
      const res = mockRes();

      await handleMichaelRuntimeResolve(mockReq(body), res as any);

      expectClientRuntimeInputRejected(res);
      expectNoDownstreamWork();
    },
  );

  it.each([
    ['unsupported string', { language: 'fr' }],
    ['empty string', { language: '' }],
    ['number', { language: 123 }],
    ['null', { language: null }],
  ] as ReadonlyArray<readonly [string, Record<string, unknown>]> )(
    'rejects malformed language: %s',
    async (_label, body) => {
      enableRouteAndResponse();
      const res = mockRes();

      await handleMichaelRuntimeResolve(mockReq(body), res as any);

      expectClientRuntimeInputRejected(res);
      expectNoDownstreamWork();
    },
  );
});

describe('S3.12 protected gate behavior', () => {
  it('missing session remains 401 and performs no turn-source/facade work', async () => {
    enableRouteAndResponse();
    const res = mockRes();

    await handleMichaelRuntimeResolve(mockReq({}, false), res as any);

    expect(res.statusCode).toBe(401);
    expect(res.body).toMatchObject({ ok: false });
    expectNoDownstreamWork();
  });

  it('default-off route remains 503 michael_runtime_disabled and performs no work', async () => {
    const res = mockRes();

    await handleMichaelRuntimeResolve(mockReq({}), res as any);

    expect(res.statusCode).toBe(503);
    expect(res.body).toMatchObject({
      ok: false,
      disabled: true,
      reason: 'michael_runtime_disabled',
    });
    expect(getMichaelRuntimeObservabilitySnapshot().counters.routeDisabledSkips).toBe(1);
    expectNoDownstreamWork();
  });
});
