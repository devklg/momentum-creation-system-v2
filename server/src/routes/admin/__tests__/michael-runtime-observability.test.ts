/**
 * Admin Michael runtime observability endpoint tests.
 *
 * GET /api/admin/michael-runtime/observability is Kevin-only (requireAdmin) and
 * returns aggregate counters plus durable, content-free Context Manager trace
 * summaries. It does not expose raw packets, prompt text, response text, tokens,
 * or contact PII.
 *
 * supertest is not installed and index.ts calls app.listen() at import, so the
 * mounted app is never booted. Instead this test (a) introspects the router
 * stack to prove `requireAdmin` guards the route, and (b) invokes the route's
 * terminal handler directly with mock req/res to assert the response contract.
 *
 * Env hygiene: the three MICHAEL_RUNTIME_* vars are snapshotted/cleared in
 * beforeEach and restored exactly in afterEach. The counter store is reset
 * around every test.
 */

import type { Response } from 'express';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { adminMichaelRuntimeObservabilityRoutes } from '../michael-runtime-observability.js';
import {
  getMichaelRuntimeObservabilitySnapshot,
  recordMichaelRuntimeSuccess,
  resetMichaelRuntimeObservabilityForTests,
} from '../../../services/michaelRuntimeObservability.js';

const listTraceMock = vi.hoisted(() => vi.fn());

vi.mock('../../../services/runtimeContextTrace.js', () => ({
  listRuntimeContextTraces: listTraceMock,
}));

const ENV_VARS = [
  'MICHAEL_RUNTIME_ROUTE_ENABLED',
  'MICHAEL_RUNTIME_RESPONSE_ENABLED',
  'MICHAEL_RUNTIME_TRACE_ENABLED',
] as const;

type EnvVarName = (typeof ENV_VARS)[number];

let envSnapshot: Record<EnvVarName, string | undefined>;

beforeEach(() => {
  listTraceMock.mockReset();
  listTraceMock.mockResolvedValue([]);
  envSnapshot = {
    MICHAEL_RUNTIME_ROUTE_ENABLED: process.env.MICHAEL_RUNTIME_ROUTE_ENABLED,
    MICHAEL_RUNTIME_RESPONSE_ENABLED: process.env.MICHAEL_RUNTIME_RESPONSE_ENABLED,
    MICHAEL_RUNTIME_TRACE_ENABLED: process.env.MICHAEL_RUNTIME_TRACE_ENABLED,
  };
  for (const name of ENV_VARS) delete process.env[name];
  resetMichaelRuntimeObservabilityForTests();
});

afterEach(() => {
  resetMichaelRuntimeObservabilityForTests();
  for (const name of ENV_VARS) {
    const original = envSnapshot[name];
    if (original === undefined) delete process.env[name];
    else process.env[name] = original;
  }
});

interface RouteLayerHandle {
  name?: string;
  handle: (...args: unknown[]) => unknown;
}

/** Locate the GET /observability route layer in the express router stack. */
function findObservabilityRoute(): {
  handles: RouteLayerHandle[];
  path: string;
  isGet: boolean;
} {
  const stack = (adminMichaelRuntimeObservabilityRoutes as unknown as {
    stack: Array<{
      route?: {
        path: string;
        methods: Record<string, boolean>;
        stack: RouteLayerHandle[];
      };
    }>;
  }).stack;

  for (const layer of stack) {
    if (layer.route && layer.route.path === '/observability') {
      return {
        handles: layer.route.stack,
        path: layer.route.path,
        isGet: layer.route.methods.get === true,
      };
    }
  }
  throw new Error('GET /observability route not found on router');
}

function mockRes() {
  const r: any = { statusCode: 0 };
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

describe('S3.6 admin Michael runtime observability endpoint', () => {
  it('1. exposes a GET /observability route', () => {
    const route = findObservabilityRoute();
    expect(route.path).toBe('/observability');
    expect(route.isGet).toBe(true);
  });

  it('2. is guarded by requireAdmin (admin-only)', () => {
    const route = findObservabilityRoute();
    const names = route.handles.map((h) => h.name);
    expect(names).toContain('requireAdmin');
  });

  it('3. requireAdmin runs BEFORE the terminal handler', () => {
    const route = findObservabilityRoute();
    const adminIdx = route.handles.findIndex((h) => h.name === 'requireAdmin');
    expect(adminIdx).toBe(0);
    expect(route.handles.length).toBeGreaterThanOrEqual(2);
  });

  it('4. terminal handler returns { ok: true, michaelRuntime, contextTraces }', async () => {
    const route = findObservabilityRoute();
    const handler = route.handles[route.handles.length - 1]!.handle;
    const res = mockRes();
    await handler({} as unknown, res as unknown as Response);

    expect(res.statusCode).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.michaelRuntime).toBeDefined();
    expect(res.body.contextTraces).toEqual([]);
  });

  it('5. michaelRuntime payload equals the observability snapshot shape', async () => {
    const route = findObservabilityRoute();
    const handler = route.handles[route.handles.length - 1]!.handle;
    const res = mockRes();
    await handler({} as unknown, res as unknown as Response);

    const snap = getMichaelRuntimeObservabilitySnapshot();
    expect(Object.keys(res.body.michaelRuntime).sort()).toEqual(Object.keys(snap).sort());
    expect(Object.keys(res.body.michaelRuntime.counters).sort()).toEqual(
      Object.keys(snap.counters).sort(),
    );
  });

  it('6. reflects current aggregate counts and evaluated flags', async () => {
    process.env.MICHAEL_RUNTIME_ROUTE_ENABLED = 'true';
    recordMichaelRuntimeSuccess();
    recordMichaelRuntimeSuccess();

    const route = findObservabilityRoute();
    const handler = route.handles[route.handles.length - 1]!.handle;
    const res = mockRes();
    await handler({} as unknown, res as unknown as Response);

    expect(res.body.michaelRuntime.routeEnabled).toBe(true);
    expect(res.body.michaelRuntime.responseEnabled).toBe(false);
    expect(res.body.michaelRuntime.counters.successfulFacadeResolutions).toBe(2);
  });

  it('7. exposes no raw env strings — flags are evaluated booleans', async () => {
    process.env.MICHAEL_RUNTIME_ROUTE_ENABLED = 'true';
    process.env.MICHAEL_RUNTIME_RESPONSE_ENABLED = 'TRUE';
    process.env.MICHAEL_RUNTIME_TRACE_ENABLED = 'false';

    const route = findObservabilityRoute();
    const handler = route.handles[route.handles.length - 1]!.handle;
    const res = mockRes();
    await handler({} as unknown, res as unknown as Response);

    const mr = res.body.michaelRuntime;
    expect(typeof mr.routeEnabled).toBe('boolean');
    expect(typeof mr.responseEnabled).toBe('boolean');
    expect(typeof mr.traceEnabled).toBe('boolean');
    // "TRUE" is not exact "true" -> false; no raw env leaked.
    expect(mr.responseEnabled).toBe(false);
    const serialized = JSON.stringify(res.body);
    expect(serialized).not.toContain('TRUE');
  });

  it('8. exposes durable context trace summaries without raw packet/prompt/response/contact PII', async () => {
    recordMichaelRuntimeSuccess();
    listTraceMock.mockResolvedValue([
      {
        traceId: 'ctx_trace_1',
        agentKey: 'michael_magnificent',
        taskType: 'training_support',
        runtimeSurface: 'michael-runtime',
        packetStatus: 'complete',
        approvedKnowledgeCount: 2,
        approvedKnowledgeIds: ['knw_1', 'knw_2'],
        approvedSourceIds: ['knowledge_source_1'],
        excludedSourceIds: [],
        candidateKnowledgeExcluded: true,
        retrievalMethods: ['direct_reference'],
        routeDecision: 'proceed',
        catalogKey: 'michael_next_training_step_en',
        responseType: 'next_training_step',
        createdAt: '2026-07-08T00:00:00.000Z',
        tmagId: 'TMAG-HIDDEN',
        queryHint: 'hidden query text',
      },
    ]);
    const route = findObservabilityRoute();
    const handler = route.handles[route.handles.length - 1]!.handle;
    const res = mockRes();
    await handler({} as unknown, res as unknown as Response);

    expect(res.body.contextTraces).toEqual([
      expect.objectContaining({
        traceId: 'ctx_trace_1',
        approvedKnowledgeIds: ['knw_1', 'knw_2'],
        approvedKnowledgeCount: 2,
      }),
    ]);

    const allKeys = new Set<string>();
    const walk = (value: unknown): void => {
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        for (const [k, child] of Object.entries(value as Record<string, unknown>)) {
          allKeys.add(k);
          walk(child);
        }
      }
    };
    walk(res.body);
    const FORBIDDEN = [
      'trace',
      'packet',
      'contextPacket',
      'token',
      'sessionId',
      'turnId',
      'correlationId',
      'tmagId',
      'email',
      'phone',
      'prospect',
      'text',
      'queryHint',
    ];
    for (const forbidden of FORBIDDEN) {
      expect(allKeys.has(forbidden)).toBe(false);
    }
  });

  it('9. terminal handler reads durable trace summaries through the trace service', async () => {
    const route = findObservabilityRoute();
    const handler = route.handles[route.handles.length - 1]!.handle;
    const res = mockRes();
    await handler({} as unknown, res as unknown as Response);

    expect(listTraceMock).toHaveBeenCalledWith({
      agentKey: 'michael_magnificent',
      limit: 10,
    });
  });

  it('10. repeated reads are non-mutating — counts do not change just by reading', async () => {
    recordMichaelRuntimeSuccess();
    const route = findObservabilityRoute();
    const handler = route.handles[route.handles.length - 1]!.handle;

    const res1 = mockRes();
    await handler({} as unknown, res1 as unknown as Response);
    const res2 = mockRes();
    await handler({} as unknown, res2 as unknown as Response);

    expect(res1.body.michaelRuntime.counters.successfulFacadeResolutions).toBe(1);
    expect(res2.body.michaelRuntime.counters.successfulFacadeResolutions).toBe(1);
  });
});
