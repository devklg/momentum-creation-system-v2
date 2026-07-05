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
