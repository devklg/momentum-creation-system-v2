import { beforeEach, describe, expect, it, vi } from 'vitest';

const { persistenceCall } = vi.hoisted(() => ({ persistenceCall: vi.fn() }));

vi.mock('../../services/persistence/dispatch.js', () => ({ persistenceCall }));

import { listBADirectoryPage } from '../adminBaOversight.js';
import { AdminCursorError } from '../adminPagination.js';

function member(tmagId: string, createdAt: string) {
  return {
    tmagId,
    threeBaId: `THREE-${tmagId}`,
    threeUsername: tmagId.toLowerCase(),
    firstName: tmagId,
    lastName: 'Member',
    email: `${tmagId.toLowerCase()}@example.test`,
    phone: null,
    timezone: 'America/Los_Angeles',
    passwordHash: 'hash',
    sponsorTmagId: null,
    sponsorThreeBaId: '',
    accessCodeUsed: '',
    createdAt,
    lastLoginAt: null,
    entitlements: [],
  };
}

describe('P2-131 BA keyset pagination', () => {
  beforeEach(() => persistenceCall.mockReset());

  it('uses pageSize + 1, a stable tied-timestamp order, and page-scoped joins', async () => {
    const a = member('TMAG-C', '2026-07-10T00:00:00.000Z');
    const b = member('TMAG-B', '2026-07-10T00:00:00.000Z');
    const c = member('TMAG-A', '2026-07-09T00:00:00.000Z');

    persistenceCall.mockImplementation(async (_tool, action, params) => {
      if (!params) return { documents: [] };
      if (action === 'aggregate') return { results: [] };
      if (params.sort) return { documents: [a, b, c] };
      return { documents: [] };
    });

    const page = await listBADirectoryPage({ pageSize: 2 });
    expect(page.rows.map((row) => row.tmagId)).toEqual(['TMAG-C', 'TMAG-B']);
    expect(page.legacyBas.map((row) => row.tmagId)).toEqual(['TMAG-C', 'TMAG-B']);
    expect(page.legacyBas[0]?.timezone).toBe('America/Los_Angeles');
    expect(page.pageInfo).toMatchObject({ pageSize: 2, hasMore: true });
    expect(page.pageInfo.nextCursor).toEqual(expect.any(String));

    const rosterRead = persistenceCall.mock.calls.find((call) => call[2]?.sort);
    expect(rosterRead?.[2]).toMatchObject({
      sort: { createdAt: -1, tmagId: -1 },
      limit: 3,
    });
    const joinReads = persistenceCall.mock.calls.filter((call) => call[1] === 'aggregate');
    expect(joinReads).toHaveLength(6);
    for (const call of joinReads) {
      expect(JSON.stringify(call[2].pipeline)).toContain('TMAG-C');
      expect(JSON.stringify(call[2].pipeline)).toContain('TMAG-B');
      expect(JSON.stringify(call[2])).not.toContain('skip');
    }
  });

  it('continues after the exact cursor without replaying page one', async () => {
    const a = member('TMAG-C', '2026-07-10T00:00:00.000Z');
    const b = member('TMAG-B', '2026-07-10T00:00:00.000Z');
    const c = member('TMAG-A', '2026-07-09T00:00:00.000Z');
    let rosterPage = 0;

    persistenceCall.mockImplementation(async (_tool, action, params) => {
      if (!params) return { documents: [] };
      if (action === 'aggregate') return { results: [] };
      if (params.sort) {
        rosterPage += 1;
        return { documents: rosterPage === 1 ? [a, b, c] : [c] };
      }
      if (params.limit === 1) return { documents: [b] };
      return { documents: [] };
    });

    const first = await listBADirectoryPage({ pageSize: 2 });
    const second = await listBADirectoryPage({ pageSize: 2, cursor: first.pageInfo.nextCursor! });
    expect(second.rows.map((row) => row.tmagId)).toEqual(['TMAG-A']);
    expect(second.pageInfo).toEqual({ pageSize: 2, hasMore: false, nextCursor: null });

    const secondRosterRead = persistenceCall.mock.calls.filter((call) => call[2]?.sort)[1];
    expect(secondRosterRead?.[2].filter).toEqual({
      $or: [
        { createdAt: { $lt: b.createdAt } },
        { createdAt: b.createdAt, tmagId: { $lt: b.tmagId } },
      ],
    });
  });

  it('binds exact indexed lookup to the cursor contract and rejects malformed cursors', async () => {
    const match = member('TMAG-EXACT', '2026-07-10T00:00:00.000Z');
    persistenceCall.mockImplementation(async (_tool, action, params) => {
      if (!params) return { documents: [] };
      if (action === 'aggregate') return { results: [] };
      return { documents: params.sort ? [match] : [] };
    });

    const page = await listBADirectoryPage({ pageSize: 10, search: 'TMAG-exact' });
    expect(page.appliedSearch).toBe('TMAG-exact');
    const rosterRead = persistenceCall.mock.calls.find((call) => call[2]?.sort);
    expect(rosterRead?.[2].filter).toEqual({
      $or: [
        { tmagId: 'TMAG-EXACT' },
        { threeBaId: 'TMAG-EXACT' },
        { email: 'tmag-exact' },
      ],
    });
    expect(JSON.stringify(rosterRead?.[2].filter)).not.toMatch(/firstName|lastName|sponsor|code|regex/i);

    await expect(
      listBADirectoryPage({ pageSize: 10, search: 'TMAG-EXACT', cursor: 'not-a-valid-cursor' }),
    ).rejects.toBeInstanceOf(AdminCursorError);
  });
});
