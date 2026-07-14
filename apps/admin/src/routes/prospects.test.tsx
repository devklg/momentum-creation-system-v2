import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ProspectsPage } from './prospects';
import { DirectoryTable } from '@/components/prospect-oversight/DirectoryTable';
import type { McsAdminProspectDirectoryRow } from '@momentum/shared';

afterEach(() => vi.unstubAllGlobals());

function row(prospectId: string): McsAdminProspectDirectoryRow {
  return {
    prospectId,
    firstName: prospectId,
    lastName: 'Prospect',
    sponsorTmagId: 'TMBA-1',
    sponsorName: 'One BA',
    presentationStatus: 'minted',
    positionNumber: null,
    prospectUrl: '',
    token: '',
    firstContactAt: '2026-07-13T00:00:00.000Z',
    mostRecentActivity: {
      at: '2026-07-13T00:00:00.000Z',
      eventKind: 'token_minted',
      label: 'Token minted',
    },
    daysInHoldingTank: null,
    followUpNeededBy: '2026-07-20T00:00:00.000Z',
    prospectStatus: 'pending',
    deleted: false,
  };
}

describe('Prospect admin bounded directory', () => {
  it('shows static headers for the fixed server order', () => {
    render(<DirectoryTable rows={[row('p1')]} loading={false} onSelectProspect={() => undefined} />);
    expect(screen.getByRole('columnheader', { name: 'Prospect' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Prospect/ })).not.toBeInTheDocument();
    expect(screen.queryByText('↑')).not.toBeInTheDocument();
  });

  it('appends pages, deduplicates canonical ids, and reports bounded truth', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/filters')) {
        return { json: async () => ({ ok: true, bas: [], leaderGroups: [], leaderDetectionNote: 'test' }) };
      }
      const second = url.includes('cursor=cursor-2');
      return {
        json: async () => ({
          ok: true,
          rows: second ? [row('p1'), row('p2')] : [row('p1')],
          appliedFilter: { tmagId: null, leaderGroup: 'all' },
          appliedSort: 'createdAt_desc_prospectId_desc',
          computedAt: '2026-07-14T00:00:00.000Z',
          leaderDetectionNote: 'test',
          pageInfo: second
            ? { pageSize: 50, hasMore: false, nextCursor: null }
            : { pageSize: 50, hasMore: true, nextCursor: 'cursor-2' },
        }),
      };
    });
    vi.stubGlobal('fetch', fetchMock);
    render(<ProspectsPage />);

    fireEvent.click(await screen.findByRole('button', { name: 'Load more' }));
    await screen.findByText(/p2\s+Prospect/);
    expect(screen.getAllByText(/p1\s+Prospect/)).toHaveLength(1);
    expect(screen.getByText(/matched total omitted/i)).toHaveTextContent('2 loaded');
    expect(screen.getByRole('button', { name: 'All matching prospects loaded' })).toBeDisabled();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
  });
});
