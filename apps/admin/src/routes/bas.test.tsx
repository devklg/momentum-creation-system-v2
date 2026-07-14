import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { McsAdminBaDirectoryRow } from '@momentum/shared';
import { BAsPage } from './bas';

vi.mock('@/components/ba-oversight/launch-readiness-panel', () => ({
  LaunchReadinessPanel: () => null,
}));
vi.mock('@/components/ba-oversight/profile-drawer', () => ({ ProfileDrawer: () => null }));
vi.mock('@/components/ba-oversight/ba-crud-modal', () => ({ BaCrudModal: () => null }));

afterEach(() => vi.unstubAllGlobals());

function row(tmagId: string, fullName: string): McsAdminBaDirectoryRow {
  return {
    tmagId,
    threeBaId: `THREE-${tmagId}`,
    fullName,
    email: `${tmagId.toLowerCase()}@example.test`,
    phone: null,
    accessCodeOwned: null,
    sponsorTmagId: null,
    sponsorName: null,
    originalSponsorTmagId: null,
    originalSponsorName: null,
    joinedAt: '2026-07-10T00:00:00.000Z',
    welcomeAcceptedAt: null,
    lastLoginAt: null,
    twoInSeventyTwoCount: 0,
    twoInSeventyTwoWindowStart: '2026-07-07T00:00:00.000Z',
    profileCompletenessPct: 50,
    personalInvitesCount: 0,
    oldestOpenFollowUpDueAt: null,
    trainingModulesCompleted: 0,
    trainingComplete: false,
    status: 'inactive',
    lastActivityAt: null,
    systemDetectedLeader: false,
    curatedLeader: false,
    entitlements: [],
    deleted: false,
  };
}

function response(rows: McsAdminBaDirectoryRow[], hasMore: boolean, nextCursor: string | null) {
  return {
    ok: true,
    count: rows.length,
    rows,
    bas: [],
    leaderDetectionNote: 'Leader note',
    pageInfo: { pageSize: 50, hasMore, nextCursor },
    appliedSearch: '',
    appliedSort: 'createdAt_desc_tmagId_desc',
    computedAt: '2026-07-10T00:00:00.000Z',
  };
}

describe('P2-131 BA paged UI', () => {
  it('appends and deduplicates server pages while keeping headers static', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ json: async () => response([row('TMAG-2', 'Amy Able')], true, 'cursor-page-two-value-12345') })
      .mockResolvedValueOnce({ json: async () => response([row('TMAG-2', 'Amy Updated'), row('TMAG-1', 'Bob Baker')], false, null) });
    vi.stubGlobal('fetch', fetchMock);
    render(<MemoryRouter><BAsPage /></MemoryRouter>);

    expect(await screen.findByText('Amy Able')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Name' })).not.toBeInTheDocument();
    expect(screen.getByLabelText('newest signup first')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Load more' }));

    expect(await screen.findByText('Amy Updated')).toBeInTheDocument();
    expect(screen.getByText('Bob Baker')).toBeInTheDocument();
    expect(screen.queryByText('Amy Able')).not.toBeInTheDocument();
    expect(fetchMock.mock.calls[1]?.[0]).toContain('cursor=cursor-page-two-value-12345');
    expect(screen.getByRole('button', { name: 'All matching BAs loaded' })).toBeDisabled();
  });

  it('resets to an exact indexed lookup and discloses unsupported filters', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ json: async () => response([row('TMAG-2', 'Amy Able')], false, null) })
      .mockResolvedValueOnce({ json: async () => response([row('TMAG-1', 'Bob Baker')], false, null) });
    vi.stubGlobal('fetch', fetchMock);
    render(<MemoryRouter><BAsPage /></MemoryRouter>);
    expect(await screen.findByText('Amy Able')).toBeInTheDocument();

    expect(screen.getByText(/installed index state is reported separately/)).toBeInTheDocument();
    expect(screen.getByText(/sponsor, access-code, and derived-column filters are not supported/)).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText('Exact TM ID, THREE BA ID, or email…'), {
      target: { value: 'TMAG-1' },
    });
    expect(await screen.findByText('Bob Baker')).toBeInTheDocument();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(fetchMock.mock.calls[1]?.[0]).toContain('search=TMAG-1');
    expect(fetchMock.mock.calls[1]?.[0]).not.toContain('cursor=');
  });

  it('ignores a stale response after the exact-search contract changes', async () => {
    let resolveFirst!: (value: { json: () => Promise<unknown> }) => void;
    const first = new Promise<{ json: () => Promise<unknown> }>((resolve) => {
      resolveFirst = resolve;
    });
    const fetchMock = vi.fn()
      .mockReturnValueOnce(first)
      .mockResolvedValueOnce({ json: async () => response([row('TMAG-1', 'Current Result')], false, null) });
    vi.stubGlobal('fetch', fetchMock);
    render(<MemoryRouter><BAsPage /></MemoryRouter>);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    fireEvent.change(screen.getByPlaceholderText('Exact TM ID, THREE BA ID, or email…'), {
      target: { value: 'TMAG-1' },
    });
    expect(await screen.findByText('Current Result')).toBeInTheDocument();
    resolveFirst({ json: async () => response([row('TMAG-OLD', 'Stale Result')], false, null) });
    await Promise.resolve();
    expect(screen.queryByText('Stale Result')).not.toBeInTheDocument();
    expect(screen.getByText('Current Result')).toBeInTheDocument();
  });
});
