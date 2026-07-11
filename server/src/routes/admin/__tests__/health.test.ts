import type { Response } from 'express';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { adminHealthRoutes } from '../health.js';
import * as healthProbe from '../../../domain/healthProbe.js';

type RouteLayerHandle = {
  name?: string;
  handle: (...args: unknown[]) => unknown;
};

function findRoute(path: string): RouteLayerHandle[] {
  const stack = (adminHealthRoutes as unknown as {
    stack: Array<{
      route?: {
        path: string;
        methods: Record<string, boolean>;
        stack: RouteLayerHandle[];
      };
    }>;
  }).stack;
  for (const layer of stack) {
    if (layer.route?.path === path && layer.route.methods.get) return layer.route.stack;
  }
  throw new Error(`GET ${path} not found`);
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

afterEach(() => {
  vi.restoreAllMocks();
});

describe('admin health status route', () => {
  it('is guarded by requireAdmin and returns the status-file GET shape', async () => {
    const route = findRoute('/status');
    expect(route.map((h) => h.name)).toContain('requireAdmin');

    vi.spyOn(healthProbe, 'readHealthStatusFile').mockResolvedValueOnce({
      ok: true,
      error: null,
      status: {
        checkedAt: '2026-07-05T00:00:00.000Z',
        overall: 'green',
        checks: [{ name: 'api', ok: true, detail: 'ok' }],
      },
    });
    vi.spyOn(healthProbe, 'handleHealthStatusTransition').mockResolvedValueOnce({
      alertQueued: false,
      reason: 'no_transition',
      previousOverall: 'green',
    });

    const handler = route[route.length - 1]!.handle;
    const res = mockRes();
    await handler({} as unknown, res as unknown as Response);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({
      ok: true,
      status: {
        checkedAt: '2026-07-05T00:00:00.000Z',
        overall: 'green',
        checks: [{ name: 'api', ok: true, detail: 'ok' }],
      },
      alert: {
        alertQueued: false,
        reason: 'no_transition',
        previousOverall: 'green',
      },
    });
  });
});

describe('admin triple-stack health route', () => {
  it('returns 200 with heartbeat details when the probe is green', async () => {
    const route = findRoute('/triple-stack');
    expect(route.map((h) => h.name)).toContain('requireAdminOrHealthSecret');

    vi.spyOn(healthProbe, 'runTripleStackHealthProbe').mockResolvedValueOnce({
      ok: true,
      checkedAt: '2026-07-05T00:00:00.000Z',
      heartbeatId: 'health_fixed',
      legs: { mongo: true, neo4j: true, chroma: true },
      legDetails: { mongo: 'readback_ok', neo4j: 'readback_ok', chroma: 'readback_ok' },
    });

    const handler = route[route.length - 1]!.handle;
    const res = mockRes();
    await handler({} as unknown, res as unknown as Response);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({
      ok: true,
      checkedAt: '2026-07-05T00:00:00.000Z',
      heartbeatId: 'health_fixed',
      legs: { mongo: true, neo4j: true, chroma: true },
      legDetails: { mongo: 'readback_ok', neo4j: 'readback_ok', chroma: 'readback_ok' },
    });
  });

  it('returns 503 with heartbeat details when any probe leg is red', async () => {
    const route = findRoute('/triple-stack');

    vi.spyOn(healthProbe, 'runTripleStackHealthProbe').mockResolvedValueOnce({
      ok: false,
      checkedAt: '2026-07-05T00:00:00.000Z',
      heartbeatId: 'health_fixed',
      legs: { mongo: true, neo4j: true, chroma: false },
      legDetails: { mongo: 'readback_ok', neo4j: 'readback_ok', chroma: 'readback_missing' },
    });

    const handler = route[route.length - 1]!.handle;
    const res = mockRes();
    await handler({} as unknown, res as unknown as Response);

    expect(res.statusCode).toBe(503);
    expect(res.body).toEqual({
      ok: false,
      checkedAt: '2026-07-05T00:00:00.000Z',
      heartbeatId: 'health_fixed',
      legs: { mongo: true, neo4j: true, chroma: false },
      legDetails: { mongo: 'readback_ok', neo4j: 'readback_ok', chroma: 'readback_missing' },
    });
  });
});
