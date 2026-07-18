import type { McsHoldingTankSnapshot } from '@momentum/shared';
import { describe, expect, it, vi } from 'vitest';
import {
  getKongaTeamLeaderboard,
  getKongaTeamSnapshot,
  projectKongaLaunchProgress,
  projectKongaLifetimeLeaderboard,
} from '../kongaTeam.js';

const SIGNUP = '2026-07-01T00:00:00.000Z';
const DEADLINE = '2026-07-04T00:00:00.000Z';

describe('Konga `.team` truthful domain projections', () => {
  it('projects 0/1/2 from distinct completed human attestations with an inclusive 72h boundary', () => {
    const progress = projectKongaLaunchProgress('BA-1', SIGNUP, [
      {
        sponsorTmagId: 'BA-1',
        enrolleeTmagId: 'NEW-1',
        joinedAt: '2026-07-02T00:00:00.000Z',
        humanAttested: true,
        status: 'completed',
      },
      {
        sponsorTmagId: 'BA-1',
        enrolleeTmagId: 'NEW-1',
        joinedAt: '2026-07-02T01:00:00.000Z',
        humanAttested: true,
        status: 'completed',
      },
      {
        sponsorTmagId: 'BA-1',
        enrolleeTmagId: 'REGISTRATION-ONLY',
        joinedAt: '2026-07-03T00:00:00.000Z',
        humanAttested: false,
        status: 'completed',
      },
      {
        sponsorTmagId: 'BA-1',
        enrolleeTmagId: 'NEW-2',
        joinedAt: DEADLINE,
        humanAttested: true,
        status: 'completed',
      },
      {
        sponsorTmagId: 'BA-1',
        enrolleeTmagId: 'TOO-LATE',
        joinedAt: '2026-07-04T00:00:00.001Z',
        humanAttested: true,
        status: 'completed',
      },
    ]);

    expect(progress).toEqual({
      signupAt: SIGNUP,
      deadlineAt: DEADLINE,
      completedCount: 2,
      achievedAt: DEADLINE,
      effortBased: true,
    });
    expect(projectKongaLaunchProgress('BA-1', SIGNUP, []).completedCount).toBe(0);
    expect(
      projectKongaLaunchProgress('BA-1', SIGNUP, [
        {
          sponsorTmagId: 'BA-1',
          enrolleeTmagId: 'NEW-1',
          joinedAt: '2026-07-02T00:00:00.000Z',
          humanAttested: true,
          status: 'completed',
        },
      ]).completedCount,
    ).toBe(1);
  });

  it('counts lifetime persisted placement events by stable sponsor, including factual re-entry', () => {
    const entries = projectKongaLifetimeLeaderboard(
      [
        { placementId: 'p-1', prospectId: 'prospect-1', sponsorTmagId: 'BA-1', placedAt: SIGNUP },
        { placementId: 'p-1', prospectId: 'prospect-1', sponsorTmagId: 'BA-1', placedAt: SIGNUP },
        { placementId: 'p-2', prospectId: 'prospect-1', sponsorTmagId: 'BA-1', placedAt: '2026-09-01T00:00:00.000Z' },
        { _id: 'legacy-3', prospectId: 'prospect-3', sponsorTmagId: 'BA-2', placedAt: '2026-06-01T00:00:00.000Z' },
        { placementId: 'conflict', sponsorTmagId: 'BA-1', placedAt: SIGNUP },
        { placementId: 'conflict', sponsorTmagId: 'BA-2', placedAt: SIGNUP },
        { sponsorTmagId: 'BA-1', placedAt: SIGNUP },
      ],
      [
        { tmagId: 'BA-1', firstName: 'Jordan', lastName: 'Rivera' },
        { tmagId: 'BA-2', firstName: 'Jordan', lastName: 'Baker' },
      ],
    );

    expect(entries).toEqual([
      { firstName: 'Jordan', lastInitial: 'R', addsCount: 2 },
      { firstName: 'Jordan', lastInitial: 'B', addsCount: 1 },
    ]);
  });

  it('keyset-pages the complete lifetime corpus without boundary duplicate or skip', async () => {
    const rows = Array.from({ length: 2_005 }, (_, index) => ({
      _id: `row-${String(index).padStart(6, '0')}`,
      placementId: `placement-${String(index).padStart(6, '0')}`,
      prospectId: `prospect-${index}`,
      sponsorTmagId: index % 2 === 0 ? 'BA-1' : 'BA-2',
      placedAt: new Date(Date.UTC(2026, 0, 1, 0, 0, index)).toISOString(),
    }));
    const placementQueries: Array<Record<string, unknown>> = [];
    const persistence = vi.fn(async (_tool: string, action: string, params: Record<string, unknown>) => {
      expect(action).toBe('query');
      if (params.collection === 'team_magnificent_members') {
        const filter = params.filter as { tmagId?: string | { $in?: string[] } };
        if (typeof filter.tmagId === 'string') {
          return {
            documents: [{
              tmagId: 'VIEWER',
              firstName: 'Viewer',
              lastName: 'Member',
              createdAt: SIGNUP,
            }],
          };
        }
        return {
          documents: [
            { tmagId: 'BA-1', firstName: 'Alpha', lastName: 'Adder' },
            { tmagId: 'BA-2', firstName: 'Beta', lastName: 'Builder' },
          ],
        };
      }
      if (params.collection !== 'tmag_prospect_htank_placements') {
        throw new Error(`unexpected_collection:${String(params.collection)}`);
      }
      placementQueries.push(params);
      const filter = params.filter as {
        $and?: Array<Record<string, { $gt?: string }>>;
      };
      const cursor = filter.$and?.[1]?._id?.$gt;
      const remaining = cursor ? rows.filter((row) => row._id > cursor) : rows;
      const limit = Number(params.limit);
      return {
        documents: remaining.slice(0, limit),
        count: remaining.length,
      };
    });

    const result = await getKongaTeamLeaderboard('VIEWER', {
      persistence: persistence as never,
    });

    expect(result).toMatchObject({
      period: 'lifetime',
      entries: [
        { firstName: 'Alpha', lastInitial: 'A', addsCount: 1_003 },
        { firstName: 'Beta', lastInitial: 'B', addsCount: 1_002 },
      ],
    });
    expect(placementQueries).toHaveLength(3);
    expect(placementQueries.map((query) => query.limit)).toEqual([1_000, 1_000, 1_000]);
    expect(placementQueries[0]!.sort).toEqual({ _id: 1 });
    expect(
      (placementQueries[1]!.filter as { $and: Array<Record<string, { $gt: string }>> })
        .$and[1]!._id!.$gt,
    ).toBe('row-000999');
    expect(
      (placementQueries[2]!.filter as { $and: Array<Record<string, { $gt: string }>> })
        .$and[1]!._id!.$gt,
    ).toBe('row-001999');
  });

  it('builds genesis only from earliest invitation_sent and never assigns it a pool position', async () => {
    const persistence = vi.fn(async (_tool: string, action: string, params: Record<string, unknown>) => {
      expect(action).toBe('query');
      switch (params.collection) {
        case 'team_magnificent_members':
          return {
            documents: [{
              tmagId: 'BA-1',
              firstName: 'Jordan',
              lastName: 'Rivera',
              createdAt: SIGNUP,
            }],
          };
        case 'tmag_prospect_invitation_activity':
          return {
            documents: [{
              prospectId: 'PROSPECT-1',
              sponsorTmagId: 'BA-1',
              kind: 'invitation_sent',
              at: '2026-07-01T03:00:00.000Z',
            }],
          };
        case 'tmag_prospects':
          return {
            documents: [{
              prospectId: 'PROSPECT-1',
              firstName: 'Avery',
              lastName: 'Quinn',
              location: { city: 'Los Angeles', stateOrRegion: 'CA' },
            }],
          };
        case 'tmag_konga_enrollment_attestations':
          return {
            documents: [{
              sponsorTmagId: 'BA-1',
              enrolleeTmagId: 'NEW-1',
              joinedAt: '2026-07-02T00:00:00.000Z',
              humanAttested: true,
              status: 'completed',
            }],
          };
        default:
          throw new Error(`unexpected_collection:${String(params.collection)}`);
      }
    });
    const snapshot = await getKongaTeamSnapshot('BA-1', {
      persistence: persistence as never,
      buildPlacementSnapshot: vi.fn(async () => ({
        globalMaxPosition: 12,
        recent: [{
          positionNumber: 12,
          firstName: 'Taylor',
          lastInitial: 'M',
          city: 'Pasadena',
          stateOrRegion: 'CA',
          placedAt: '2026-07-02T10:00:00.000Z',
        }],
      })),
      addAttribution: vi.fn(async (recent: McsHoldingTankSnapshot['recent']) => recent.map((entry) => ({
        ...entry,
        addedBy: { firstName: 'Paul', lastInitial: 'B' },
      }))),
      readTelemetry: vi.fn(async () => ({ placementsThisWeek: 4, geoSpreadCount: 3 })),
    });

    expect(snapshot).toMatchObject({
      ok: true,
      contractVersion: 'konga-v1',
      lens: { head: 'self' },
      head: { firstName: 'Jordan', lastInitial: 'R' },
      hasFirstInvite: true,
      genesis: {
        prospectId: 'PROSPECT-1',
        firstName: 'Avery',
        lastInitial: 'Q',
        city: 'Los Angeles',
        stateOrRegion: 'CA',
        invitedAt: '2026-07-01T03:00:00.000Z',
        positionNumber: null,
        sourceAuthority: 'invitation_activity.invitation_sent',
      },
      launchProgress: { completedCount: 1, achievedAt: null },
      placementSnapshot: {
        globalMaxPosition: 12,
        placementsThisWeek: 4,
        geoSpreadCount: 3,
      },
    });
    expect(JSON.stringify(snapshot)).not.toContain('leaderboard');
    expect(persistence).toHaveBeenCalledWith(
      'mongodb',
      'query',
      expect.objectContaining({
        collection: 'tmag_prospect_invitation_activity',
        filter: { sponsorTmagId: 'BA-1', kind: 'invitation_sent' },
        sort: { at: 1 },
        limit: 1,
      }),
    );
    expect(
      persistence.mock.calls.every((call) => call[1] === 'query'),
    ).toBe(true);
  });
});
