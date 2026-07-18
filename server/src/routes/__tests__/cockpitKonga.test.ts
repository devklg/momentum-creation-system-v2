import { EventEmitter } from 'node:events';
import type { Request, Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getSnapshot: vi.fn(),
  getLeaderboard: vi.fn(),
  subscribePlacements: vi.fn(),
  subscribeJoins: vi.fn(),
  placementUnsubscribe: vi.fn(),
  joinUnsubscribe: vi.fn(),
}));

vi.mock('../../domain/kongaTeam.js', () => ({
  KongaTeamError: class KongaTeamError extends Error {
    constructor(public readonly code: string) {
      super(code);
    }
  },
  getKongaTeamSnapshot: mocks.getSnapshot,
  getKongaTeamLeaderboard: mocks.getLeaderboard,
}));

vi.mock('../../services/poolEvents.js', () => ({
  subscribeKongaPlacements: mocks.subscribePlacements,
  subscribeJoins: mocks.subscribeJoins,
}));

import { cockpitRoutes } from '../cockpit.js';

type RouteLayerHandle = {
  name?: string;
  handle: (req: Request, res: Response) => unknown;
};

function findRoute(path: string): RouteLayerHandle[] {
  const stack = (cockpitRoutes as unknown as {
    stack: Array<{
      route?: {
        path: string;
        methods: Record<string, boolean>;
        stack: RouteLayerHandle[];
      };
    }>;
  }).stack;
  const route = stack.find((layer) => layer.route?.path === path && layer.route.methods.get);
  if (!route?.route) throw new Error(`GET ${path} not found`);
  return route.route.stack;
}

function finalHandler(path: string): RouteLayerHandle['handle'] {
  return findRoute(path).at(-1)!.handle;
}

function mockResponse() {
  const emitter = new EventEmitter() as EventEmitter & Response & {
    statusCode: number;
    body: unknown;
    writes: string[];
  };
  emitter.statusCode = 200;
  emitter.body = null;
  emitter.writes = [];
  emitter.status = vi.fn((statusCode: number) => {
    emitter.statusCode = statusCode;
    return emitter;
  }) as never;
  emitter.set = vi.fn(() => emitter) as never;
  emitter.setHeader = vi.fn(() => emitter) as never;
  emitter.flushHeaders = vi.fn();
  emitter.json = vi.fn((body: unknown) => {
    emitter.body = body;
    return emitter;
  }) as never;
  emitter.write = vi.fn((chunk: string) => {
    emitter.writes.push(chunk);
    return true;
  }) as never;
  emitter.end = vi.fn() as never;
  return emitter;
}

function mockRequest() {
  const request = new EventEmitter() as EventEmitter & Request;
  request.session = { tmagId: 'BA-1', threeBaId: 'THREE-1', email: 'ba@example.test' };
  return request;
}

const snapshot = {
  ok: true,
  contractVersion: 'konga-v1',
  lens: { head: 'self' },
  head: { firstName: 'Jordan', lastInitial: 'R' },
  hasFirstInvite: false,
  genesis: null,
  launchProgress: {
    signupAt: '2026-07-01T00:00:00.000Z',
    deadlineAt: '2026-07-04T00:00:00.000Z',
    completedCount: 0,
    achievedAt: null,
    effortBased: true,
  },
  placementSnapshot: {
    globalMaxPosition: 0,
    recent: [],
    placementsThisWeek: 0,
    geoSpreadCount: 0,
  },
};

beforeEach(() => {
  Object.values(mocks).forEach((mock) => mock.mockReset());
  mocks.getSnapshot.mockResolvedValue(snapshot);
  mocks.getLeaderboard.mockResolvedValue({
    ok: true,
    contractVersion: 'konga-v1',
    visibility: 'members_only',
    period: 'lifetime',
    sourceAuthority: 'tmag_prospect_htank_placements',
    entries: [{ firstName: 'Jordan', lastInitial: 'R', addsCount: 2 }],
  });
  mocks.subscribePlacements.mockReturnValue({ unsubscribe: mocks.placementUnsubscribe });
  mocks.subscribeJoins.mockReturnValue({ unsubscribe: mocks.joinUnsubscribe });
});

describe('authenticated cockpit Konga routes', () => {
  it.each(['/konga', '/konga/leaderboard', '/konga/stream'])(
    'keeps GET %s behind auth and Steve completion',
    (path) => {
      const names = findRoute(path).map((layer) => layer.name);
      expect(names).toContain('requireAuth');
      expect(names).toContain('requireSteveComplete');
    },
  );

  it('scopes the snapshot to the session and never serializes leaderboard data', async () => {
    const response = mockResponse();
    await finalHandler('/konga')(mockRequest(), response);

    expect(mocks.getSnapshot).toHaveBeenCalledWith('BA-1');
    expect(mocks.getLeaderboard).not.toHaveBeenCalled();
    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual(snapshot);
    expect(JSON.stringify(response.body)).not.toContain('leaderboard');
  });

  it('serves lifetime adds only from the separate members-only route', async () => {
    const response = mockResponse();
    await finalHandler('/konga/leaderboard')(mockRequest(), response);

    expect(mocks.getLeaderboard).toHaveBeenCalledWith('BA-1');
    expect(response.body).toMatchObject({
      visibility: 'members_only',
      period: 'lifetime',
      entries: [{ firstName: 'Jordan', lastInitial: 'R', addsCount: 2 }],
    });
  });

  it('streams snapshot, placement, and join without leaderboard and detaches once', async () => {
    vi.useFakeTimers();
    try {
      const request = mockRequest();
      const response = mockResponse();
      await finalHandler('/konga/stream')(request, response);

      expect(response.writes[0]).toContain('event: snapshot');
      expect(response.writes[0]).not.toContain('leaderboard');
      const placementHandler = mocks.subscribePlacements.mock.calls[0]![0];
      placementHandler({
        contractVersion: 'konga-v1',
        eventId: 'placement-1',
        positionNumber: 1,
        firstName: 'Avery',
        lastInitial: 'Q',
        city: 'Los Angeles',
        stateOrRegion: 'CA',
        placedAt: '2026-07-18T00:00:00.000Z',
        addedBy: { firstName: 'Jordan', lastInitial: 'R' },
      });
      const joinHandler = mocks.subscribeJoins.mock.calls[0]![0];
      joinHandler({
        contractVersion: 'konga-v1',
        eventId: 'join-1',
        positionNumber: 1,
        firstName: 'Avery',
        lastInitial: 'Q',
        city: 'Los Angeles',
        stateOrRegion: 'CA',
        joinedAt: '2026-07-18T01:00:00.000Z',
        addedBy: { firstName: 'Jordan', lastInitial: 'R' },
      });
      expect(response.writes.some((frame) => frame.includes('event: placement'))).toBe(true);
      expect(response.writes.some((frame) => frame.includes('event: join'))).toBe(true);
      vi.advanceTimersByTime(30_000);
      expect(response.writes.filter((frame) => frame.includes('event: ping'))).toHaveLength(1);

      request.emit('close');
      response.emit('close');
      vi.advanceTimersByTime(60_000);
      expect(response.writes.filter((frame) => frame.includes('event: ping'))).toHaveLength(1);
      expect(mocks.placementUnsubscribe).toHaveBeenCalledTimes(1);
      expect(mocks.joinUnsubscribe).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not subscribe or start a heartbeat when the client disconnects during snapshot read', async () => {
    let resolveSnapshot!: (value: typeof snapshot) => void;
    mocks.getSnapshot.mockReturnValueOnce(new Promise((resolve) => {
      resolveSnapshot = resolve;
    }));
    const request = mockRequest();
    const response = mockResponse();
    const pending = finalHandler('/konga/stream')(request, response);

    request.emit('close');
    resolveSnapshot(snapshot);
    await pending;

    expect(response.writes).toEqual([]);
    expect(mocks.subscribePlacements).not.toHaveBeenCalled();
    expect(mocks.subscribeJoins).not.toHaveBeenCalled();
    expect(mocks.placementUnsubscribe).not.toHaveBeenCalled();
    expect(mocks.joinUnsubscribe).not.toHaveBeenCalled();
  });
});
