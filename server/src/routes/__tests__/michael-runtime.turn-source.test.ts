import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { handleMichaelRuntimeResolve } from '../michael-runtime.js';
import { runRuntimeTurnFixtureScenario } from '../../runtime/orchestration/fixtures/runtimeTurnHarness.js';
import type { RuntimeTurnFixtureScenarioType } from '../../runtime/orchestration/types.js';

/**
 * S3.10 — proves the Michael runtime ROUTE is UNCHANGED by the turn-source slice.
 *
 * S3.10 CREATED `createMichaelRuntimeTurnForAuthenticatedBa` and EXPORTED it from
 * the orchestration barrel, but DID NOT wire it into the route. This file
 * documents that boundary two ways:
 *
 *  (A) STATIC: the route source (`routes/michael-runtime.ts`) does not import or
 *      reference the turn source — it still consumes the client-supplied
 *      `body.turn` through the inert S2.20 facade only.
 *  (B) BEHAVIORAL: the S3.4/S3.9 handler contract is intact (body-BA rejection,
 *      session 401, degraded -> safe_fallback) — exactly as before S3.10.
 *
 * Read-only on production source; the behavioral checks call the exported
 * handler with mock req/res (supertest is not installed; index.ts listens at
 * import). Mirrors the static-scan style of s39MichaelRuntimeUiServerBoundary.
 */

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
const routeFilePath = 'server/src/routes/michael-runtime.ts';

function readRouteSource(): string {
  const absolute = resolve(repoRoot, routeFilePath);
  if (!existsSync(absolute)) {
    throw new Error(`S3.10 turn-source boundary test: route source not found at ${routeFilePath}`);
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
// GROUP A — STATIC: the route does NOT wire the S3.10 turn source.
// ---------------------------------------------------------------------------
describe('S3.10 route is not wired to the turn source (static)', () => {
  it('1. route source does NOT reference createMichaelRuntimeTurnForAuthenticatedBa', () => {
    const stripped = sourceWithoutCommentsOrStrings(readRouteSource());
    expect(stripped.includes('createMichaelRuntimeTurnForAuthenticatedBa')).toBe(false);
  });

  it('2. route source does NOT import the michaelRuntimeTurnSource module', () => {
    const stripped = sourceWithoutCommentsOrStrings(readRouteSource());
    expect(/\bmichaelRuntimeTurnSource\b/.test(stripped)).toBe(false);
    expect(/from\s+\S*michaelRuntimeTurnSource/.test(stripped)).toBe(false);
  });

  it('3. route still consumes the client-supplied body.turn through the inert facade', () => {
    const stripped = sourceWithoutComments(readRouteSource());
    // The facade is still the only resolution path.
    expect(stripped.includes('resolveMichaelRuntimeTurnResponse')).toBe(true);
    // The route still reads body.turn (the future swap target).
    expect(/body\.turn\b/.test(stripped)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// GROUP B — BEHAVIORAL: the S3.4/S3.9 handler contract is intact post-S3.10.
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

function mockReq(turn: unknown, extraBody: Record<string, unknown> = {}, withSession = true) {
  return {
    ...(withSession ? { session: { baId: SESSION_BA_ID } } : {}),
    body: { ...(turn !== undefined ? { turn } : {}), ...extraBody },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

async function buildTurn(
  scenario: RuntimeTurnFixtureScenarioType = 'accepted_complete',
  intent?: 'clear_training_support' | 'ambiguous_training_support',
): Promise<Record<string, unknown>> {
  const rt = await runRuntimeTurnFixtureScenario({
    scenario,
    agentKey: 'michael_magnificent',
    taskType: 'training_support',
  });
  return {
    identity: rt.input.identity,
    turnId: rt.input.turnId,
    taskType: 'training_support',
    runtimeTurn: rt,
    ...(intent ? { intent } : {}),
  };
}

describe('S3.10 route behavior is unchanged (S3.4/S3.9 contract intact)', () => {
  it('4. still rejects a body baId with 400 BODY_BA_SCOPE_NOT_ALLOWED (sponsor immutability)', async () => {
    enableRouteAndResponse();
    const turn = await buildTurn('accepted_complete', 'clear_training_support');
    const res = mockRes();
    handleMichaelRuntimeResolve(mockReq(turn, { baId: 'TMBA-EVIL-000000' }), res);

    expect(res.statusCode).toBe(400);
    expect(res.body.code).toBe('BODY_BA_SCOPE_NOT_ALLOWED');
  });

  it('5. still rejects a missing session baId with 401', async () => {
    enableRouteAndResponse();
    const turn = await buildTurn('accepted_complete', 'clear_training_support');
    const res = mockRes();
    handleMichaelRuntimeResolve(mockReq(turn, {}, false), res);

    expect(res.statusCode).toBe(401);
    expect(res.body.ok).toBe(false);
  });

  it('6. still fails closed with 503 when the route flag is off', async () => {
    const turn = await buildTurn('accepted_complete', 'clear_training_support');
    const res = mockRes();
    handleMichaelRuntimeResolve(mockReq(turn), res);

    expect(res.statusCode).toBe(503);
    expect(res.body.reason).toBe('michael_runtime_disabled');
  });

  it('7. still resolves the client-supplied degraded turn to safe_fallback (facade unchanged)', async () => {
    enableRouteAndResponse();
    const turn = await buildTurn('accepted_degraded');
    const res = mockRes();
    handleMichaelRuntimeResolve(mockReq(turn), res);

    expect(res.statusCode).toBe(200);
    expect(res.body.catalogKey).toBe('michael_safe_fallback_degraded_en');
    expect(res.body.response.responseType).toBe('safe_fallback');
    expect(res.body.response.agentResponseGenerated).toBe(false);
    expect(res.body.response.persistence).toBe('disabled');
  });
});
