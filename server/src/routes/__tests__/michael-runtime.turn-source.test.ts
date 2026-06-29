import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { handleMichaelRuntimeResolve } from '../michael-runtime.js';

/**
 * S3.11 — proves the Michael runtime ROUTE is NOW WIRED to the server-owned turn
 * source (the inverse of the S3.10 boundary, which proved it was NOT wired).
 *
 * S3.10 created `createMichaelRuntimeTurnForAuthenticatedBa` and exported it from
 * the orchestration barrel but DID NOT wire it into the route. S3.11 swaps the
 * route's old client-supplied `body.turn` for this server-owned source. This file
 * documents that transition two ways:
 *
 *  (A) STATIC: the route source (`routes/michael-runtime.ts`) NOW imports and
 *      references `createMichaelRuntimeTurnForAuthenticatedBa`, still resolves
 *      through the inert S2.20 facade, and NO LONGER reads `body.turn`.
 *  (B) BEHAVIORAL: an empty-body request drives the server-owned turn to the
 *      degraded `safe_fallback` fixture; forbidden body input and missing session
 *      are rejected; the route fails closed behind the kill switch.
 *
 * Read-only on production source; the behavioral checks call the exported ASYNC
 * handler with mock req/res (supertest is not installed; index.ts listens at
 * import).
 */

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
const routeFilePath = 'server/src/routes/michael-runtime.ts';

function readRouteSource(): string {
  const absolute = resolve(repoRoot, routeFilePath);
  if (!existsSync(absolute)) {
    throw new Error(`S3.11 turn-source wiring test: route source not found at ${routeFilePath}`);
  }
  return readFileSync(absolute, 'utf8');
}

function sourceWithoutComments(text: string): string {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/\s+\/\/.*$/gm, '');
}

function sourceWithoutCommentsOrStrings(text: string): string {
  return sourceWithoutComments(text)
    .replace(/`(?:\\.|[^`\\])*`/g, '""')
    .replace(/'(?:\\.|[^'\\])*'/g, '""')
    .replace(/"(?:\\.|[^"\\])*"/g, '""');
}

// ---------------------------------------------------------------------------
// GROUP A — STATIC: the route IS NOW wired to the S3.10 turn source.
// ---------------------------------------------------------------------------
describe('S3.11 route is wired to the server-owned turn source (static)', () => {
  it('1. route source NOW references createMichaelRuntimeTurnForAuthenticatedBa', () => {
    const stripped = sourceWithoutCommentsOrStrings(readRouteSource());
    expect(stripped.includes('createMichaelRuntimeTurnForAuthenticatedBa')).toBe(true);
  });

  it('2. route still resolves through the inert S2.20 facade', () => {
    const stripped = sourceWithoutComments(readRouteSource());
    expect(stripped.includes('resolveMichaelRuntimeTurnResponse')).toBe(true);
  });

  it('3. route NO LONGER reads the client-supplied body.turn (server-owned input)', () => {
    const stripped = sourceWithoutComments(readRouteSource());
    expect(/body\.turn\b/.test(stripped)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// GROUP B — BEHAVIORAL: the empty-body request drives the server-owned turn.
// ---------------------------------------------------------------------------
const SESSION_BA_ID = 'TMBA-20240101-ABCDEF';

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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

describe('S3.11 route behavior — empty body drives the server-owned turn', () => {
  it('4. rejects a forbidden body baId with 400 CLIENT_RUNTIME_INPUT_NOT_ALLOWED (sponsor immutability)', async () => {
    enableRouteAndResponse();
    const res = mockRes();
    await handleMichaelRuntimeResolve(mockReq({ baId: 'TMBA-EVIL-000000' }), res);

    expect(res.statusCode).toBe(400);
    expect(res.body.code).toBe('CLIENT_RUNTIME_INPUT_NOT_ALLOWED');
  });

  it('5. rejects a missing session baId with 401', async () => {
    enableRouteAndResponse();
    const res = mockRes();
    await handleMichaelRuntimeResolve(mockReq({}, false), res);

    expect(res.statusCode).toBe(401);
    expect(res.body.ok).toBe(false);
  });

  it('6. fails closed with 503 when the route flag is off', async () => {
    const res = mockRes();
    await handleMichaelRuntimeResolve(mockReq({}), res);

    expect(res.statusCode).toBe(503);
    expect(res.body.reason).toBe('michael_runtime_disabled');
  });

  it('7. an empty-body request drives the server-owned turn to the degraded safe_fallback fixture', async () => {
    enableRouteAndResponse();
    const res = mockRes();
    await handleMichaelRuntimeResolve(mockReq({}), res);

    expect(res.statusCode).toBe(200);
    expect(res.body.catalogKey).toBe('michael_safe_fallback_degraded_en');
    expect(res.body.response.responseType).toBe('safe_fallback');
    expect(res.body.response.agentResponseGenerated).toBe(false);
    expect(res.body.response.persistence).toBe('disabled');
  });
});
