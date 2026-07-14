import type { Response } from 'express';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { adminOrientationRoutes } from '../orientation.js';
import * as diagnostic from '../../../domain/orientationDiagnostic.js';
import * as auditLog from '../../../domain/auditLog.js';

type RouteLayerHandle = {
  name?: string;
  handle: (...args: unknown[]) => unknown;
};

function findRoute(path: string): RouteLayerHandle[] {
  const stack = (adminOrientationRoutes as unknown as {
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
  const response: any = { statusCode: 200 };
  response.status = (statusCode: number) => {
    response.statusCode = statusCode;
    return response;
  };
  response.json = (body: unknown) => {
    response.body = body;
    return response;
  };
  return response;
}

afterEach(() => vi.restoreAllMocks());

describe('admin orientation diagnostic route', () => {
  it('requires admin, returns the read-only report, and audits counts only', async () => {
    const route = findRoute('/diagnostic');
    expect(route.map((handle) => handle.name)).toContain('requireAdmin');

    const payload = {
      ok: true as const,
      schemaVersion: 'orientation_diagnostic.v1' as const,
      stateSchemaVersion: 'orientation_state.v1' as const,
      generatedAt: '2026-07-14T01:00:00.000Z',
      policy: 'report_only' as const,
      sourceAuthority: {
        sessions: 'tmag_new_member_orientation_sessions' as const,
        reservations: 'tmag_new_member_orientation_reservations' as const,
      },
      attendanceAuthority: null,
      completionAuthority: null,
      completionInferred: false as const,
      autoRepair: false as const,
      scanLimit: 250,
      scanLimitReached: { sessions: false, reservations: false },
      scanned: { sessions: 4, reservations: 8 },
      totals: { stuck: 1, duplicate: 2, inconsistent: 3, findings: 6 },
      findings: [],
    };
    vi.spyOn(diagnostic, 'buildAdminOrientationDiagnostic').mockResolvedValueOnce(payload);
    vi.spyOn(auditLog, 'appendAuditEntry').mockResolvedValueOnce({} as never);

    const handler = route[route.length - 1]!.handle;
    const res = mockRes();
    await handler(
      {
        session: { tmagId: 'TMAG-01', fullName: 'Kevin Gardner' },
        query: { limit: '250' },
        ip: '127.0.0.1',
        get: () => 'vitest',
      } as unknown,
      res as unknown as Response,
    );

    expect(diagnostic.buildAdminOrientationDiagnostic).toHaveBeenCalledWith({ limit: 250 });
    expect(auditLog.appendAuditEntry).toHaveBeenCalledWith(expect.objectContaining({
      action: 'admin.orientation.diagnostic.viewed',
      severity: 'warn',
      after: {
        generatedAt: payload.generatedAt,
        policy: 'report_only',
        scanned: payload.scanned,
        totals: payload.totals,
      },
    }));
    const audit = vi.mocked(auditLog.appendAuditEntry).mock.calls[0]![0];
    expect(audit.after).not.toHaveProperty('findings');
    expect(JSON.stringify(audit)).not.toContain('reservationId');
    expect(JSON.stringify(audit)).not.toContain('tmagId":"TMAG-02');
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual(payload);
  });
});
