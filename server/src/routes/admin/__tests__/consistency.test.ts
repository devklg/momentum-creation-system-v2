import type { Response } from 'express';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { adminConsistencyRoutes } from '../consistency.js';
import * as consistency from '../../../domain/adminConsistencyReport.js';
import * as auditLog from '../../../domain/auditLog.js';

type RouteLayerHandle = {
  name?: string;
  handle: (...args: unknown[]) => unknown;
};

function findRoute(path: string): RouteLayerHandle[] {
  const stack = (adminConsistencyRoutes as unknown as {
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

describe('admin consistency report route', () => {
  it('is guarded by requireAdmin and returns the report shape', async () => {
    const route = findRoute('/report');
    expect(route.map((h) => h.name)).toContain('requireAdmin');

    vi.spyOn(auditLog, 'appendAuditEntry').mockResolvedValueOnce({
      entryId: 'audit_1',
      timestamp: '2026-07-11T00:00:00.000Z',
      actor: { kind: 'system', label: 'test' },
      action: 'admin.consistency.report.viewed',
      entity: { kind: 'admin_session', id: 'TMAG-01', displayLabel: null },
      severity: 'info',
      before: null,
      after: null,
      reason: null,
      context: null,
    } as never);

    vi.spyOn(consistency, 'buildAdminConsistencyReport').mockResolvedValueOnce({
      ok: true,
      generatedAt: '2026-07-11T00:00:00.000Z',
      overall: 'green',
      totals: {
        halfWrites: 0,
        staleProjections: 0,
        failedProjections: 0,
        orphanRecords: 0,
        reconciliationIssues: 0,
        warnings: 0,
      },
      staleProjectionMinutes: 15,
      reconciliation: { limitPerSpec: 25, specs: [], issues: [] },
      halfWrites: [],
      staleProjections: [],
      orphanCategories: [],
      warnings: [],
      graphIntegrity: {
        generatedAt: '2026-07-11T00:00:00.000Z',
        status: 'clear',
        repairPolicy: 'report_only',
        sampleLimit: 25,
        topology: { nodes: 10, relationships: 20 },
        coverage: { expected: 41, completed: 41, degraded: 0 },
        totals: {
          findings: 0,
          missingIdentity: 0,
          duplicateIdentity: 0,
          missingRequiredAnchor: 0,
          ambiguousRequiredAnchor: 0,
          duplicateParallelEdge: 0,
        },
        traversals: [],
        degradedReasons: [],
      },
    });

    const handler = route[route.length - 1]!.handle;
    const res = mockRes();
    await handler(
      {
        session: { tmagId: 'TMAG-01', fullName: 'Kevin Gardner' },
        query: { limitPerSpec: '7', orphanLimit: '8', graphSampleLimit: '9' },
        ip: '127.0.0.1',
        get: () => 'vitest',
      } as unknown,
      res as unknown as Response,
    );

    expect(consistency.buildAdminConsistencyReport).toHaveBeenCalledWith({
      limitPerSpec: 7,
      orphanLimit: 8,
      graphSampleLimit: 9,
    });
    expect(auditLog.appendAuditEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'admin.consistency.report.viewed',
        severity: 'info',
      }),
    );
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ ok: true, overall: 'green' });
  });
});
