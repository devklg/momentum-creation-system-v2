import { beforeEach, describe, expect, it, vi } from 'vitest';

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv('JWT_SECRET', 'p2-131-resource-test-secret-that-is-long-enough');
});

function resource(resourceVersionId: string, updatedAt: string) {
  return {
    resourceId: resourceVersionId.replace(':v1', ''),
    resourceVersionId,
    title: resourceVersionId,
    kind: 'document',
    version: 1,
    updatedAt,
    lifecycle: 'active',
    audience: { surfaces: ['team'], roles: ['brand_ambassador'] },
  };
}

describe('resource analytics page-first contract', () => {
  it('uses pageSize+1 and keeps complete totals separate from page rows', async () => {
    const persistenceMock = vi.fn(async (_tool: string, action: string, params: Record<string, unknown>) => {
      const collection = String(params.collection);
      if (action === 'query') {
        expect(collection).toBe('tmag_resource_catalog');
        expect(params.sort).toEqual({ updatedAt: -1, resourceVersionId: -1 });
        expect(params.limit).toBe(3);
        return {
          documents: [
            resource('resource-c:v1', '2026-07-13T00:00:00.000Z'),
            resource('resource-b:v1', '2026-07-13T00:00:00.000Z'),
            resource('resource-a:v1', '2026-07-12T00:00:00.000Z'),
          ],
        };
      }
      if (collection === 'tmag_resource_catalog') {
        return { results: [{ activeResources: 25, totalOpens: 800, opensLast30Days: 90, neverOpened: 3, staleReviewWarnings: 4 }] };
      }
      return {
        results: [
          { _id: 'resource-c:v1', openCount: 10, memberIds: ['TM-1'], lastOpenedAt: '2026-07-13T01:00:00.000Z', opensLast30Days: 2 },
        ],
      };
    });
    const persistence = persistenceMock as unknown as typeof import('../../services/persistence/dispatch.js').persistenceCall;
    const { buildResourceUsageSummaryPage } = await import('../resourceUsage.js');
    const report = await buildResourceUsageSummaryPage({
      persistence,
      pageSize: 2,
      now: new Date('2026-07-13T12:00:00.000Z'),
    });

    expect(report.resources.map((row) => row.resourceVersionId)).toEqual([
      'resource-c:v1',
      'resource-b:v1',
    ]);
    expect(report.totals.activeResources).toBe(25);
    expect(report.pageInfo).toMatchObject({ pageSize: 2, hasMore: true });
    expect(report.pageInfo.nextCursor).toEqual(expect.any(String));
  });
});
