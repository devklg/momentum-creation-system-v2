import type { Response } from 'express';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { adminAuditRoutes } from '../audit.js';
import { adminProspectsRoutes } from '../prospects.js';
import * as auditLog from '../../../domain/auditLog.js';
import * as prospectDomain from '../../../domain/adminProspectOversight.js';
import { AdminCursorError } from '../../../domain/adminPagination.js';

type RouteLayer = { name?: string; handle: (...args: any[]) => any };

function getHandler(router: unknown, path: string): { stack: RouteLayer[]; handler: RouteLayer['handle'] } {
  const layers = (router as { stack: Array<{ route?: { path: string; methods: Record<string, boolean>; stack: RouteLayer[] } }> }).stack;
  const route = layers.find((layer) => layer.route?.path === path && layer.route.methods.get)?.route;
  if (!route) throw new Error(`GET ${path} not found`);
  return { stack: route.stack, handler: route.stack[route.stack.length - 1]!.handle };
}

function mockRes() {
  const response: any = { statusCode: 200 };
  response.status = (code: number) => { response.statusCode = code; return response; };
  response.json = (body: unknown) => { response.body = body; return response; };
  return response;
}

function request(query: Record<string, unknown>) {
  return {
    query,
    session: { tmagId: 'TMBA-ADMIN', fullName: 'Kevin' },
    ip: '127.0.0.1',
    get: () => 'vitest',
  };
}

afterEach(() => vi.restoreAllMocks());

describe('admin pagination route contracts', () => {
  it('keeps prospects admin-gated and rejects invalid page sizes', async () => {
    const route = getHandler(adminProspectsRoutes, '/');
    expect(route.stack.map((layer) => layer.name)).toContain('requireAdmin');
    const res = mockRes();
    await route.handler(request({ pageSize: '0' }), res as Response);
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe('Invalid pagination parameters.');
  });

  it('maps prospect cursor failures to 400', async () => {
    vi.spyOn(prospectDomain, 'listProspectDirectoryPage').mockRejectedValueOnce(new AdminCursorError());
    const res = mockRes();
    await getHandler(adminProspectsRoutes, '/').handler(
      request({ cursor: 'x'.repeat(24) }),
      res as Response,
    );
    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ ok: false, error: 'invalid_cursor' });
  });

  it('returns the additive prospect page contract and audits metadata only', async () => {
    vi.spyOn(prospectDomain, 'listProspectDirectoryPage').mockResolvedValueOnce({
      rows: [],
      pageInfo: { pageSize: 25, hasMore: false, nextCursor: null },
    });
    const audit = vi.spyOn(auditLog, 'appendAuditEntry').mockResolvedValueOnce({ entryId: 'audit-1' } as never);
    const res = mockRes();
    await getHandler(adminProspectsRoutes, '/').handler(
      request({ pageSize: '25', cursor: 'signed-cursor-placeholder' }),
      res as Response,
    );

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      ok: true,
      rows: [],
      appliedSort: 'createdAt_desc_prospectId_desc',
      pageInfo: { pageSize: 25, hasMore: false, nextCursor: null },
    });
    const metadata = audit.mock.calls[0]![0].after as Record<string, unknown>;
    expect(metadata).toEqual(expect.objectContaining({
      pageSize: 25,
      returnedCount: 0,
      hasMore: false,
      cursorSupplied: true,
    }));
    expect(metadata).not.toHaveProperty('cursor');
    expect(metadata).not.toHaveProperty('rows');
  });

  it('keeps audit admin-gated and maps signed cursor failures to 400', async () => {
    const route = getHandler(adminAuditRoutes, '/');
    expect(route.stack.map((layer) => layer.name)).toContain('requireAdmin');
    vi.spyOn(auditLog, 'queryAuditEntries').mockRejectedValueOnce(new AdminCursorError());
    const res = mockRes();
    await route.handler(request({ before: 'unknown-cursor' }), res as Response);
    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ ok: false, error: 'invalid_cursor' });
  });
});
