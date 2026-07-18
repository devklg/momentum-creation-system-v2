import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  McsKongaTeamLeaderboardResponse,
  McsKongaTeamSnapshotResponse,
} from '@momentum/shared';
import { KongaTeamSurface } from './KongaTeamSurface';

const signupAt = '2026-07-17T12:00:00.000Z';

function snapshot(completedCount: 0 | 1 | 2, hasFirstInvite: boolean): McsKongaTeamSnapshotResponse {
  return {
    ok: true,
    contractVersion: 'konga-v1',
    lens: { head: 'self' },
    head: { firstName: 'Kevin', lastInitial: 'G' },
    hasFirstInvite,
    genesis: hasFirstInvite ? {
      prospectId: 'prospect-1',
      firstName: 'Jordan',
      lastInitial: 'R',
      city: 'Pasadena',
      stateOrRegion: 'CA',
      invitedAt: '2026-07-17T13:00:00.000Z',
      positionNumber: null,
      sourceAuthority: 'invitation_activity.invitation_sent',
    } : null,
    launchProgress: {
      signupAt,
      deadlineAt: '2026-07-20T12:00:00.000Z',
      completedCount,
      achievedAt: completedCount === 2 ? '2026-07-18T16:00:00.000Z' : null,
      effortBased: true,
    },
    placementSnapshot: {
      globalMaxPosition: 42,
      recent: hasFirstInvite ? [{
        positionNumber: 42,
        firstName: 'Avery',
        lastInitial: 'Q',
        city: 'Austin',
        stateOrRegion: 'TX',
        placedAt: '2026-07-17T18:00:00.000Z',
        addedBy: { firstName: 'Paul', lastInitial: 'B' },
      }] : [],
      placementsThisWeek: hasFirstInvite ? 1 : 0,
      geoSpreadCount: hasFirstInvite ? 1 : 0,
    },
  };
}

const leaderboard: McsKongaTeamLeaderboardResponse = {
  ok: true,
  contractVersion: 'konga-v1',
  visibility: 'members_only',
  period: 'lifetime',
  sourceAuthority: 'tmag_prospect_htank_placements',
  entries: [{ firstName: 'Paul', lastInitial: 'B', addsCount: 7 }],
};

class MockEventSource {
  static instances: MockEventSource[] = [];
  listeners = new Map<string, Array<(event: Event) => void>>();
  closed = false;

  constructor(public readonly url: string, public readonly options?: EventSourceInit) {
    MockEventSource.instances.push(this);
  }

  addEventListener(type: string, listener: EventListenerOrEventListenerObject) {
    const callback = typeof listener === 'function' ? listener : (event: Event) => listener.handleEvent(event);
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), callback]);
  }

  close() { this.closed = true; }

  emit(type: string, data?: unknown) {
    const event = data === undefined
      ? new Event(type)
      : new MessageEvent(type, { data: JSON.stringify(data) });
    for (const listener of this.listeners.get(type) ?? []) listener(event);
  }
}

function installFetch(value: McsKongaTeamSnapshotResponse) {
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url === '/api/cockpit/konga') {
      return new Response(JSON.stringify(value), { status: 200 });
    }
    if (url === '/api/cockpit/konga/leaderboard') {
      return new Response(JSON.stringify(leaderboard), { status: 200 });
    }
    throw new Error(`Unexpected fetch: ${url}`);
  }));
}

describe('KongaTeamSurface', () => {
  beforeEach(() => {
    MockEventSource.instances = [];
    vi.stubGlobal('EventSource', MockEventSource);
  });

  afterEach(() => vi.unstubAllGlobals());

  it('shows the exact genesis prompt and opens no line or stream before a confirmed invite', async () => {
    installFetch(snapshot(0, false));
    render(<MemoryRouter><KongaTeamSurface /></MemoryRouter>);

    expect(await screen.findByRole('heading', { name: 'Your line begins with your first invite' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Your line begins with your first invite' })).toHaveAttribute('href', '/ivory');
    expect(screen.queryByLabelText('Live collective Konga Line')).not.toBeInTheDocument();
    expect(MockEventSource.instances).toHaveLength(0);
    expect(screen.getByLabelText('0 of 2 completed')).toBeInTheDocument();
    expect(screen.queryByText('2/2 complete.')).not.toBeInTheDocument();
  });

  it('renders persisted genesis and collective facts, updates live, and reuses one stream in presentation mode', async () => {
    installFetch(snapshot(2, true));
    render(<MemoryRouter><KongaTeamSurface /></MemoryRouter>);

    expect(await screen.findByText('Your first invite · genesis')).toBeInTheDocument();
    expect(screen.getByText('Jordan R.')).toBeInTheDocument();
    expect(screen.getByText('Avery Q.')).toBeInTheDocument();
    expect(screen.queryByText(/YOU · Kevin/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Position /i)).not.toBeInTheDocument();
    expect(screen.getByText('2/2 complete.')).toBeInTheDocument();
    expect(screen.getByText('Paul B.')).toBeInTheDocument();
    expect(screen.getByText('7 adds')).toBeInTheDocument();
    expect(MockEventSource.instances).toHaveLength(1);
    expect(MockEventSource.instances[0]?.url).toBe('/api/cockpit/konga/stream');
    expect(MockEventSource.instances[0]?.options).toEqual({ withCredentials: true });

    fireEvent.click(screen.getByRole('button', { name: 'Presentation mode' }));
    expect(screen.getByRole('button', { name: 'Exit presentation' })).toBeInTheDocument();
    expect(MockEventSource.instances).toHaveLength(1);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.getByRole('button', { name: 'Presentation mode' })).toBeInTheDocument();
    expect(MockEventSource.instances).toHaveLength(1);

    MockEventSource.instances[0]?.emit('placement', {
      contractVersion: 'konga-v1',
      eventId: 'placement-43',
      positionNumber: 43,
      firstName: 'Morgan',
      lastInitial: 'S',
      city: 'Reno',
      stateOrRegion: 'NV',
      placedAt: '2026-07-17T19:00:00.000Z',
      addedBy: { firstName: 'Kevin', lastInitial: 'G' },
    });
    expect(await screen.findByText('Morgan S.')).toBeInTheDocument();
  });

  it('does not celebrate an incomplete effort window', async () => {
    installFetch(snapshot(1, true));
    render(<MemoryRouter><KongaTeamSurface /></MemoryRouter>);

    expect(await screen.findByLabelText('1 of 2 completed')).toBeInTheDocument();
    expect(screen.queryByText('2/2 complete.')).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('Paul B.')).toBeInTheDocument());
  });
});
