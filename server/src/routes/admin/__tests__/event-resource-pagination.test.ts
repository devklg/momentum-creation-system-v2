import type { Response } from 'express';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { adminEventRoutes } from '../events.js';
import { adminResourceCenterRoutes } from '../resourceCenter.js';
import * as eventCenter from '../../../domain/eventCenter.js';
import * as resourceUsage from '../../../domain/resourceUsage.js';
import * as auditLog from '../../../domain/auditLog.js';
import { AdminCursorError } from '../../../domain/adminPagination.js';

type RouteHandle = { name?: string; handle: (...args: any[]) => unknown };

function getHandler(router: unknown, path: string): RouteHandle[] {
  const stack = (router as { stack: Array<{ route?: { path: string; methods: Record<string, boolean>; stack: RouteHandle[] } }> }).stack;
  const route = stack.find((layer) => layer.route?.path === path && layer.route.methods.get)?.route;
  if (!route) throw new Error(`GET ${path} not found`);
  return route.stack;
}

function mockRes() {
  const response: any = { statusCode: 200 };
  response.status = (statusCode: number) => { response.statusCode = statusCode; return response; };
  response.json = (body: unknown) => { response.body = body; return response; };
  return response;
}

const request = (query: Record<string, string> = {}) => ({
  query,
  session: { tmagId: 'TMAG-01', fullName: 'Kevin Gardner' },
  ip: '127.0.0.1',
  get: () => 'vitest-agent',
});

afterEach(() => vi.restoreAllMocks());

describe('Event and Resource admin pagination routes', () => {
  it('keeps the Event route admin-only and audits page metadata without row content', async () => {
    const stack = getHandler(adminEventRoutes, '/');
    expect(stack.map((layer) => layer.name)).toContain('requireAdmin');
    const report = {
      ok: true,
      generatedAt: '2026-07-14T12:00:00.000Z',
      webinarReservations: [{ reservationId: 'private-row', name: 'Private Name' }],
      pageInfo: { pageSize: 25, hasMore: true, nextCursor: 'signed-cursor' },
      appliedFilters: { eventId: null },
      appliedSort: 'createdAt_desc_reservationId_desc',
    };
    vi.spyOn(eventCenter, 'getEventCenterForAdmin').mockResolvedValueOnce(report as never);
    vi.spyOn(auditLog, 'appendAuditEntry').mockResolvedValueOnce({} as never);
    const res = mockRes();
    await stack.at(-1)!.handle(request({ pageSize: '25' }), res as Response);
    expect(res.statusCode).toBe(200);
    const audit = vi.mocked(auditLog.appendAuditEntry).mock.calls[0]![0];
    expect(audit.after).toEqual({
      filters: { eventId: null }, sort: 'createdAt_desc_reservationId_desc', pageSize: 25,
      returnedCount: 1, hasMore: true, cursorSupplied: false,
    });
    expect(JSON.stringify(audit)).not.toContain('private-row');
    expect(JSON.stringify(audit)).not.toContain('Private Name');
    expect(audit.context).toMatchObject({ ip: null, userAgent: null });
  });

  it('returns 400 for an unknown Event cursor instead of replaying page one', async () => {
    const stack = getHandler(adminEventRoutes, '/');
    vi.spyOn(eventCenter, 'getEventCenterForAdmin').mockRejectedValueOnce(new AdminCursorError());
    const res = mockRes();
    await stack.at(-1)!.handle(request({ cursor: 'cursor-token-that-is-long-enough' }), res as Response);
    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ ok: false, error: 'invalid_cursor' });
  });

  it('keeps Resource analytics admin-only and audits only bounded page metadata', async () => {
    const stack = getHandler(adminResourceCenterRoutes, '/analytics');
    expect(stack.map((layer) => layer.name)).toContain('requireAdmin');
    const report = {
      ok: true,
      totals: { staleReviewWarnings: 0 },
      resources: [{ resourceVersionId: 'private-resource', title: 'Private title' }],
      pageInfo: { pageSize: 50, hasMore: false, nextCursor: null },
      appliedFilters: { lifecycle: 'active', surface: 'team', roles: ['brand_ambassador', 'leader'] },
      appliedSort: 'updatedAt_desc_resourceVersionId_desc',
    };
    vi.spyOn(resourceUsage, 'buildResourceUsageSummaryPage').mockResolvedValueOnce(report as never);
    vi.spyOn(auditLog, 'appendAuditEntry').mockResolvedValueOnce({} as never);
    const res = mockRes();
    await stack.at(-1)!.handle(request(), res as Response);
    expect(res.statusCode).toBe(200);
    const audit = vi.mocked(auditLog.appendAuditEntry).mock.calls[0]![0];
    expect(audit.after).toMatchObject({ pageSize: 50, returnedCount: 1, hasMore: false });
    expect(JSON.stringify(audit)).not.toContain('private-resource');
    expect(JSON.stringify(audit)).not.toContain('Private title');
    expect(audit.context).toMatchObject({ ip: null, userAgent: null });
  });
});
