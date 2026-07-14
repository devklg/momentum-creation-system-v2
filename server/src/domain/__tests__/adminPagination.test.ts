import { beforeEach, describe, expect, it, vi } from 'vitest';

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv('JWT_SECRET', 'p2-131-test-secret-that-is-long-enough-for-cursors');
});

describe('admin pagination cursor authority', () => {
  it('round-trips stable keys only for the same scope and contract', async () => {
    const { decodeAdminCursor, encodeAdminCursor } = await import('../adminPagination.js');
    const contract = { filter: { leaderGroup: 'all' }, sort: 'createdAt_desc_tmagId_desc' };
    const token = encodeAdminCursor({
      scope: 'admin.bas',
      contract,
      keys: { createdAt: '2026-07-13T00:00:00.000Z', tmagId: 'TMBA-2' },
    });

    expect(decodeAdminCursor({
      token,
      scope: 'admin.bas',
      contract,
      requiredKeys: ['createdAt', 'tmagId'],
    })).toEqual({ createdAt: '2026-07-13T00:00:00.000Z', tmagId: 'TMBA-2' });
  });

  it('fails closed for tampering, scope drift, filter drift, and missing keys', async () => {
    const { AdminCursorError, decodeAdminCursor, encodeAdminCursor } = await import('../adminPagination.js');
    const token = encodeAdminCursor({
      scope: 'admin.prospects',
      contract: { filter: { tmagId: null }, sort: 'createdAt_desc_prospectId_desc' },
      keys: { createdAt: '2026-07-13T00:00:00.000Z', prospectId: 'p2' },
    });
    const attempt = (overrides: Partial<Parameters<typeof decodeAdminCursor>[0]>) =>
      decodeAdminCursor({
        token,
        scope: 'admin.prospects',
        contract: { filter: { tmagId: null }, sort: 'createdAt_desc_prospectId_desc' },
        requiredKeys: ['createdAt', 'prospectId'],
        ...overrides,
      });

    expect(() => attempt({ token: `${token.slice(0, -1)}x` })).toThrow(AdminCursorError);
    expect(() => attempt({ scope: 'admin.bas' })).toThrow(AdminCursorError);
    expect(() => attempt({ contract: { filter: { tmagId: 'TMBA-1' } } })).toThrow(AdminCursorError);
    expect(() => attempt({ requiredKeys: ['createdAt', 'missing'] })).toThrow(AdminCursorError);
  });

  it('builds deterministic descending keyset and compound filters', async () => {
    const { combineMongoFilters, descendingKeysetFilter } = await import('../adminPagination.js');
    const cursor = descendingKeysetFilter(
      'createdAt',
      'prospectId',
      '2026-07-13T00:00:00.000Z',
      'p2',
    );

    expect(cursor).toEqual({
      $or: [
        { createdAt: { $lt: '2026-07-13T00:00:00.000Z' } },
        { createdAt: '2026-07-13T00:00:00.000Z', prospectId: { $lt: 'p2' } },
      ],
    });
    expect(combineMongoFilters({}, { sponsorTmagId: 'TMBA-1' }, cursor)).toEqual({
      $and: [{ sponsorTmagId: 'TMBA-1' }, cursor],
    });
  });
});
