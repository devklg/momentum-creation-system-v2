import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  persistenceCall: vi.fn(),
  updatePoolPlacementOperational: vi.fn(),
}));

vi.mock('../../services/persistence/dispatch.js', () => ({
  persistenceCall: mocks.persistenceCall,
}));

vi.mock('../poolPlacementPersistence.js', () => ({
  updatePoolPlacementOperational: (...args: unknown[]) => mocks.updatePoolPlacementOperational(...args),
}));

describe('holding tank re-entry attempt selection', () => {
  beforeEach(() => {
    mocks.persistenceCall.mockReset();
    mocks.updatePoolPlacementOperational.mockReset();
    mocks.persistenceCall.mockResolvedValue({});
  });

  it('prefers the latest live placement over older flushed attempts', async () => {
    const live = {
      prospectId: 'prospect-1',
      sponsorTmagId: 'TMBA-1',
      positionNumber: 12,
      placedAt: '2026-07-17T00:00:00.000Z',
      expiresAt: '2026-09-17T00:00:00.000Z',
      flushedAt: null,
      flushReason: null,
      placementId: 'live-attempt',
    };
    const flushed = {
      prospectId: 'prospect-1',
      sponsorTmagId: 'TMBA-1',
      positionNumber: 3,
      placedAt: '2026-07-01T00:00:00.000Z',
      expiresAt: '2026-09-01T00:00:00.000Z',
      flushedAt: '2026-07-02T00:00:00.000Z',
      flushReason: 'expired',
      placementId: 'old-attempt',
    };
    mocks.persistenceCall.mockImplementation(async (_tool, _action, _params: { filter?: Record<string, unknown> }) => {
      void _params;
      if (_params.filter?.flushedAt === null) return { documents: [live] };
      return { documents: [flushed] };
    });

    const { findPlacementByProspectId } = await import('../holdingTank.js');
    const placement = await findPlacementByProspectId('prospect-1');

    expect(placement).toEqual(live);
    expect(mocks.persistenceCall).toHaveBeenCalledTimes(1);
  });

  it('lists only the newest live placement per prospect for expiry', async () => {
    const live = {
      prospectId: 'prospect-1',
      sponsorTmagId: 'TMBA-1',
      positionNumber: 12,
      placedAt: '2026-07-17T00:00:00.000Z',
      expiresAt: '2026-09-17T00:00:00.000Z',
      flushedAt: null,
      flushReason: null,
      placementId: 'live-attempt',
    };
    const other = {
      prospectId: 'prospect-2',
      sponsorTmagId: 'TMBA-2',
      positionNumber: 99,
      placedAt: '2026-07-12T00:00:00.000Z',
      expiresAt: '2026-09-12T00:00:00.000Z',
      flushedAt: null,
      flushReason: null,
      placementId: 'other-attempt',
    };
    const nowMs = Date.parse('2026-07-18T00:00:00.000Z');
    mocks.persistenceCall.mockImplementation(
      async (_tool, action, _params: { filter?: Record<string, unknown>; pipeline?: unknown[] }) => {
      void _params;
      if (action === 'aggregate') {
        return { results: [live, other] };
      }
      if (action === 'update') {
        return {};
      }
      return {};
    });

    const { listProspectsAgedBeyond } = await import('../holdingTank.js');
    const aged = await listProspectsAgedBeyond(4, nowMs);

    expect(aged.map((row) => row.prospectId)).toEqual(['prospect-1', 'prospect-2']);
    expect(aged[0]?.placementId).toBe('live-attempt');
    expect(mocks.persistenceCall).toHaveBeenCalledWith(
      'mongodb',
      'aggregate',
      expect.objectContaining({
        database: 'momentum',
        collection: 'tmag_prospect_htank_placements',
        pipeline: expect.arrayContaining([
          { $match: { flushedAt: null, placedAt: expect.any(Object) } },
        ]),
      }),
    );
  });

  it('flushes only the current live attempt and leaves historical placement state immutable', async () => {
    const candidate = {
      prospectId: 'prospect-1',
      sponsorTmagId: 'TMBA-1',
      positionNumber: 12,
      placedAt: '2026-07-17T00:00:00.000Z',
      placementId: 'live-attempt',
      expiresAt: '2026-09-17T00:00:00.000Z',
      flushedAt: null,
      flushReason: null,
    };
    const stale = {
      prospectId: 'prospect-1',
      sponsorTmagId: 'TMBA-1',
      positionNumber: 7,
      placedAt: '2026-07-01T00:00:00.000Z',
      placementId: 'stale-attempt',
      expiresAt: '2026-09-01T00:00:00.000Z',
      flushedAt: '2026-07-05T00:00:00.000Z',
      flushReason: 'expired',
    };
    mocks.persistenceCall.mockImplementation(
      async (_tool, action, _params: { collection?: string; pipeline?: unknown[]; filter?: unknown }) => {
        void _params;
        if (action === 'aggregate') return { results: [candidate] };
        if (action === 'update') return {};
        return {};
      },
    );
    const { flushExpiredPlacements } = await import('../holdingTank.js');
    const res = await flushExpiredPlacements(4, Date.parse('2026-07-18T00:00:00.000Z'));
    expect(res.flushed).toHaveLength(1);
    expect(res.flushed[0]).toMatchObject({ prospectId: 'prospect-1', positionNumber: 12 });
    expect(mocks.updatePoolPlacementOperational).toHaveBeenCalledWith(
      expect.objectContaining({
        prospectId: 'prospect-1',
        placementId: candidate.placementId,
      }),
    );
    expect(stale).toEqual({
      prospectId: 'prospect-1',
      sponsorTmagId: 'TMBA-1',
      positionNumber: 7,
      placedAt: '2026-07-01T00:00:00.000Z',
      placementId: 'stale-attempt',
      expiresAt: '2026-09-01T00:00:00.000Z',
      flushedAt: '2026-07-05T00:00:00.000Z',
      flushReason: 'expired',
    });
  });
});
