import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  persistenceCall: vi.fn(),
}));

vi.mock('../../services/persistence/dispatch.js', () => ({
  persistenceCall: mocks.persistenceCall,
}));

vi.mock('../adminMetrics.js', () => ({
  listLeaderTmagIds: vi.fn(async () => []),
  LEADER_DETECTION_NOTE: 'test',
}));

type AnyRecord = Record<string, any>;

function prospect(prospectId: string, createdAt: string, sponsorTmagId = 'TMBA-1') {
  return {
    prospectId,
    firstName: prospectId,
    lastName: 'Prospect',
    lastInitial: 'P',
    location: { city: 'Los Angeles', stateOrRegion: 'CA', country: 'US' },
    phone: null,
    email: null,
    sponsorTmagId,
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

beforeEach(() => {
  mocks.persistenceCall.mockReset();
});

describe('admin prospect directory pagination', () => {
  it('uses pageSize + 1 and page-scoped deterministic joins', async () => {
    const docs = [
      prospect('p3', '2026-07-13T00:00:00.000Z'),
      prospect('p2', '2026-07-13T00:00:00.000Z', 'TMBA-2'),
      prospect('p1', '2026-07-12T00:00:00.000Z'),
    ];
    mocks.persistenceCall.mockImplementation(async (_tool: string, action: string, params: AnyRecord) => {
      if (params.collection === 'tmag_prospects') return { documents: docs };
      if (params.collection === 'team_magnificent_members') {
        return {
          documents: [
            { tmagId: 'TMBA-1', firstName: 'One', lastName: 'BA' },
            { tmagId: 'TMBA-2', firstName: 'Two', lastName: 'BA' },
          ],
        };
      }
      if (params.collection === 'tmag_prospect_htank_placements') return { documents: [] };
      if (action === 'aggregate' && params.collection === 'tmag_prospect_invite_tokens') {
        return { results: [
          { prospectId: 'p3', token: 'TOKEN3', sponsorTmagId: 'TMBA-1', state: 'minted', createdAt: docs[0]!.createdAt, clickedAt: null, expiresAt: docs[0]!.expiresAt },
        ] };
      }
      if (action === 'aggregate') return { results: [] };
      throw new Error(`unexpected ${action} ${params.collection}`);
    });

    const { listProspectDirectoryPage } = await import('../adminProspectOversight.js');
    const page = await listProspectDirectoryPage({
      filter: { tmagId: null, leaderGroup: 'all' },
      pageSize: 2,
      nowMs: Date.parse('2026-07-14T00:00:00.000Z'),
    });

    expect(page.rows.map((row) => row.prospectId)).toEqual(['p3', 'p2']);
    expect(page.pageInfo).toMatchObject({ pageSize: 2, hasMore: true });
    expect(page.pageInfo.nextCursor).toEqual(expect.any(String));

    const primary = mocks.persistenceCall.mock.calls.find(
      (call) => call[2].collection === 'tmag_prospects',
    )?.[2] as AnyRecord;
    expect(primary).toMatchObject({
      sort: { createdAt: -1, prospectId: -1 },
      limit: 3,
    });

    const baJoin = mocks.persistenceCall.mock.calls.find(
      (call) => call[2].collection === 'team_magnificent_members',
    )?.[2] as AnyRecord;
    expect(baJoin.filter).toEqual({ tmagId: { $in: ['TMBA-1', 'TMBA-2'] } });
    expect(baJoin.limit).toBe(2);

    for (const collection of [
      'tmag_prospect_invite_tokens',
      'tmag_prospect_callback_requests',
      'tmag_prospect_webinar_reservations',
    ]) {
      const join = mocks.persistenceCall.mock.calls.find(
        (call) => call[1] === 'aggregate' && call[2].collection === collection,
      )?.[2] as AnyRecord;
      expect(join.pipeline[0]).toEqual({ $match: { prospectId: { $in: ['p3', 'p2'] } } });
      expect(join.pipeline[1].$sort).toMatchObject({ prospectId: 1, createdAt: -1 });
      expect(join.pipeline[1].$sort[collection === 'tmag_prospect_invite_tokens'
        ? 'token'
        : collection === 'tmag_prospect_callback_requests'
          ? 'callbackRequestId'
          : 'reservationId']).toBe(-1);
    }
  });

  it('binds cursors to the active filter and rejects unknown cursor rows', async () => {
    const only = prospect('p2', '2026-07-13T00:00:00.000Z');
    mocks.persistenceCall.mockResolvedValue({ documents: [only], results: [] });
    const { listProspectDirectoryPage } = await import('../adminProspectOversight.js');
    const first = await listProspectDirectoryPage({
      filter: { tmagId: null, leaderGroup: 'all' },
      pageSize: 1,
    });
    expect(first.pageInfo.nextCursor).toBeNull();

    const { encodeAdminCursor, AdminCursorError } = await import('../adminPagination.js');
    const token = encodeAdminCursor({
      scope: 'admin_prospect_directory.v1',
      contract: {
        filter: { tmagId: null, leaderGroup: 'all' },
        sort: 'createdAt_desc_prospectId_desc',
      },
      keys: { createdAt: only.createdAt, prospectId: only.prospectId },
    });
    mocks.persistenceCall.mockResolvedValueOnce({ documents: [] });
    await expect(listProspectDirectoryPage({
      filter: { tmagId: null, leaderGroup: 'all' },
      pageSize: 1,
      cursor: token,
    })).rejects.toBeInstanceOf(AdminCursorError);

    await expect(listProspectDirectoryPage({
      filter: { tmagId: 'TMBA-9', leaderGroup: 'all' },
      pageSize: 1,
      cursor: token,
    })).rejects.toBeInstanceOf(AdminCursorError);
  });

  it('traverses equal-timestamp boundaries without gaps or duplicates', async () => {
    const docs = [
      prospect('p3', '2026-07-13T00:00:00.000Z'),
      prospect('p2', '2026-07-13T00:00:00.000Z'),
      prospect('p1', '2026-07-12T00:00:00.000Z'),
    ];
    let pageQuery = 0;
    mocks.persistenceCall.mockImplementation(async (_tool: string, action: string, params: AnyRecord) => {
      if (params.collection === 'tmag_prospects') {
        if (params.limit === 1) return { documents: [docs[1]] };
        pageQuery += 1;
        return { documents: pageQuery === 1 ? docs : [docs[2]] };
      }
      if (params.collection === 'team_magnificent_members') {
        return { documents: [{ tmagId: 'TMBA-1', firstName: 'One', lastName: 'BA' }] };
      }
      if (params.collection === 'tmag_prospect_htank_placements') return { documents: [] };
      if (action === 'aggregate') return { results: [] };
      throw new Error(`unexpected ${action} ${params.collection}`);
    });

    const { listProspectDirectoryPage } = await import('../adminProspectOversight.js');
    const filter = { tmagId: null, leaderGroup: 'all' as const };
    const first = await listProspectDirectoryPage({ filter, pageSize: 2 });
    const second = await listProspectDirectoryPage({
      filter,
      pageSize: 2,
      cursor: first.pageInfo.nextCursor!,
    });

    expect([...first.rows, ...second.rows].map((row) => row.prospectId)).toEqual(['p3', 'p2', 'p1']);
    expect(new Set([...first.rows, ...second.rows].map((row) => row.prospectId)).size).toBe(3);
    expect(second.pageInfo).toEqual({ pageSize: 2, hasMore: false, nextCursor: null });
  });
});
