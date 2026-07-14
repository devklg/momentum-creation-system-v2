import { beforeEach, describe, expect, it, vi } from 'vitest';

const persistence = vi.hoisted(() => ({ persistenceCall: vi.fn() }));
vi.mock('../../services/persistence/dispatch.js', () => persistence);

beforeEach(() => {
  vi.resetModules();
  vi.resetAllMocks();
  vi.stubEnv('JWT_SECRET', 'p2-131-directory-test-secret-that-is-long-enough');
});

function ba(tmagId: string, createdAt: string) {
  return {
    tmagId,
    threeBaId: `THREE-${tmagId}`,
    threeUsername: tmagId,
    firstName: tmagId,
    lastName: 'Member',
    email: `${tmagId.toLowerCase()}@example.test`,
    phone: '',
    timezone: 'America/Los_Angeles',
    passwordHash: 'x',
    sponsorTmagId: '',
    sponsorThreeBaId: '',
    accessCodeUsed: 'TM-TEST',
    createdAt,
    lastLoginAt: null,
    entitlements: [],
  };
}

function prospect(prospectId: string, createdAt: string) {
  return {
    prospectId,
    firstName: prospectId,
    lastName: 'Prospect',
    lastInitial: 'P',
    location: { city: 'Los Angeles', region: 'CA', country: 'US' },
    phone: null,
    email: null,
    sponsorTmagId: 'TMBA-SPONSOR',
    state: 'minted',
    positionNumber: null,
    placedAt: null,
    becameCustomer: false,
    becameCustomerAt: null,
    customerNote: null,
    createdAt,
    updatedAt: createdAt,
    expiresAt: '2027-01-01T00:00:00.000Z',
  };
}

describe('admin directory keyset traversal', () => {
  it('traverses equal-time BA rows without gaps and never repeats a skip batch', async () => {
    const rows = [
      ba('TMBA-3', '2026-07-13T00:00:00.000Z'),
      ba('TMBA-2', '2026-07-13T00:00:00.000Z'),
      ba('TMBA-1', '2026-07-12T00:00:00.000Z'),
    ];
    persistence.persistenceCall.mockImplementation(
      async (_tool: string, action: string, params: Record<string, unknown>) => {
        const collection = String(params.collection);
        if (collection === 'team_magnificent_members') {
          const filter = params.filter as Record<string, unknown>;
          if (typeof filter.tmagId === 'string') {
            return { documents: rows.filter((row) => row.tmagId === filter.tmagId) };
          }
          if ('$and' in filter || '$or' in filter) return { documents: [rows[2]] };
          return { documents: rows };
        }
        if (action === 'aggregate' && collection === 'tmag_prospect_invite_tokens') {
          const match = (params.pipeline as Array<{ $match: Record<string, unknown> }>)[0]!.$match;
          const ids = (match.sponsorTmagId as { $in: string[] }).$in;
          return {
            results: ids.includes('TMBA-3')
              ? Array.from({ length: 1000 }, (_, index) => ({
                  sponsorTmagId: 'TMBA-3',
                  createdAt: `2026-07-13T00:00:${String(index % 60).padStart(2, '0')}.000Z`,
                }))
              : [],
          };
        }
        return action === 'aggregate' ? { results: [] } : { documents: [] };
      },
    );
    const { listBADirectoryPage } = await import('../adminBaOversight.js');

    const first = await listBADirectoryPage({ pageSize: 2 });
    expect(first.rows.map((row) => row.tmagId)).toEqual(['TMBA-3', 'TMBA-2']);
    expect(first.rows[0]?.personalInvitesCount).toBe(1000);
    expect(first.pageInfo.hasMore).toBe(true);
    const second = await listBADirectoryPage({ pageSize: 2, cursor: first.pageInfo.nextCursor! });
    expect(second.rows.map((row) => row.tmagId)).toEqual(['TMBA-1']);
    expect(second.pageInfo).toMatchObject({ hasMore: false, nextCursor: null });
    const allIds = [...first.rows, ...second.rows].map((row) => row.tmagId);
    expect(new Set(allIds).size).toBe(3);
    expect(persistence.persistenceCall.mock.calls.every((call) => !('skip' in call[2]))).toBe(true);
  });

  it('keeps prospect joins scoped to the current page and traverses the terminal page', async () => {
    const rows = [
      prospect('prospect-3', '2026-07-13T00:00:00.000Z'),
      prospect('prospect-2', '2026-07-13T00:00:00.000Z'),
      prospect('prospect-1', '2026-07-12T00:00:00.000Z'),
    ];
    const joinFilters: string[][] = [];
    persistence.persistenceCall.mockImplementation(
      async (_tool: string, action: string, params: Record<string, unknown>) => {
        expect(action).toBe('query');
        const collection = String(params.collection);
        const filter = params.filter as Record<string, unknown>;
        if (collection === 'tmag_prospects') {
          if (typeof filter.prospectId === 'string') {
            return { documents: rows.filter((row) => row.prospectId === filter.prospectId) };
          }
          if ('$and' in filter || '$or' in filter) return { documents: [rows[2]] };
          return { documents: rows };
        }
        if (collection === 'team_magnificent_members') {
          return { documents: [{ tmagId: 'TMBA-SPONSOR', firstName: 'Sponsor', lastName: 'Name' }] };
        }
        const ids = ((filter.prospectId as { $in?: string[] } | undefined)?.$in ?? []);
        joinFilters.push(ids);
        return { documents: [] };
      },
    );
    const { listProspectDirectoryPage } = await import('../adminProspectOversight.js');
    const filter = { tmagId: null, leaderGroup: 'all' as const };

    const first = await listProspectDirectoryPage({ filter, pageSize: 2 });
    const second = await listProspectDirectoryPage({
      filter,
      pageSize: 2,
      cursor: first.pageInfo.nextCursor!,
    });
    expect([...first.rows, ...second.rows].map((row) => row.prospectId))
      .toEqual(['prospect-3', 'prospect-2', 'prospect-1']);
    expect(second.pageInfo.hasMore).toBe(false);
    expect(joinFilters.filter((ids) => ids.length > 0).every((ids) => ids.length <= 2)).toBe(true);
  });
});
