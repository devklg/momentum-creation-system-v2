import type { Response } from 'express';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { adminReportingRoutes } from '../reporting.js';
import * as bottlenecks from '../../../domain/adminBottlenecks.js';
import * as auditLog from '../../../domain/auditLog.js';

type RouteLayerHandle = { name?: string; handle: (...args: unknown[]) => unknown };

function findRoute(path: string): RouteLayerHandle[] {
  const stack = (adminReportingRoutes as unknown as {
    stack: Array<{ route?: { path: string; methods: Record<string, boolean>; stack: RouteLayerHandle[] } }>;
  }).stack;
  const layer = stack.find((candidate) => candidate.route?.path === path && candidate.route.methods.get);
  if (!layer?.route) throw new Error(`GET ${path} not found`);
  return layer.route.stack;
}

function mockRes() {
  const response: any = { statusCode: 200 };
  response.status = (statusCode: number) => { response.statusCode = statusCode; return response; };
  response.json = (body: unknown) => { response.body = body; return response; };
  return response;
}

afterEach(() => vi.restoreAllMocks());

describe('admin reporting bottlenecks route', () => {
  it('requires admin and audits aggregate section status only', async () => {
    const route = findRoute('/bottlenecks');
    expect(route.map((handle) => handle.name)).toContain('requireAdmin');
    const payload = bottlenecks.projectAdminBottleneckReport({
      invitations: null,
      crm: null,
      training: null,
      events: null,
      delivery: null,
      generatedAt: '2026-07-13T20:00:00.000Z',
    });
    vi.spyOn(bottlenecks, 'buildAdminBottleneckReport').mockResolvedValueOnce(payload);
    vi.spyOn(auditLog, 'appendAuditEntry').mockResolvedValueOnce({} as never);

    const handler = route[route.length - 1]!.handle;
    const res = mockRes();
    await handler({
      session: { tmagId: 'TMAG-ADMIN', fullName: 'Admin' },
      ip: '127.0.0.1',
      get: () => 'vitest',
    } as unknown, res as unknown as Response);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual(payload);
    expect(auditLog.appendAuditEntry).toHaveBeenCalledWith(expect.objectContaining({
      action: 'admin.reporting.bottlenecks.generated',
      severity: 'warn',
      after: {
        schemaVersion: payload.schemaVersion,
        generatedAt: payload.generatedAt,
        scope: 'team_aggregate_bounded',
        sectionStatus: {
          invitations: 'unavailable', crm: 'unavailable', training: 'unavailable', events: 'unavailable', delivery: 'unavailable',
        },
        partialSources: [],
        unavailableSources: ['invitations', 'crm', 'training', 'events', 'delivery'],
      },
    }));
    const audit = vi.mocked(auditLog.appendAuditEntry).mock.calls[0]![0];
    expect(JSON.stringify(audit)).not.toContain('prospectId');
    expect(JSON.stringify(audit)).not.toContain('sponsorTmagId');
    expect(JSON.stringify(audit)).not.toContain('findings');
  });
});
