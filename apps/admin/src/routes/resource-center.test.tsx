import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ResourceCenterAdminPage } from './resource-center';

afterEach(() => vi.unstubAllGlobals());

describe('Resource Center admin analytics', () => {
  it('renders usage and advisory review warnings', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({
      ok: true, policy: { staleReviewDays: 90, warningOnly: true, changesPublishingState: false },
      totals: { activeResources: 1, totalOpens: 4, opensLast30Days: 3, neverOpened: 0, staleReviewWarnings: 1 },
      resources: [{ resourceVersionId: 'r:v1', title: 'Field Guide', kind: 'static_resource', version: 1, openCount: 4, uniqueMemberCount: 2, opensLast30Days: 3, lastOpenedAt: '2026-07-12T00:00:00.000Z', staleReviewWarning: true, staleReviewAgeDays: 120 }],
    }) })));
    render(<ResourceCenterAdminPage />);
    expect(await screen.findByText('Field Guide')).toBeInTheDocument();
    expect(screen.getByText(/Review due · 120d/)).toBeInTheDocument();
    expect(screen.getByText(/Warnings never publish/)).toBeInTheDocument();
  });

  it('appends and deduplicates a bounded next page', async () => {
    const base = {
      ok: true as const,
      policy: { staleReviewDays: 90, warningOnly: true as const, changesPublishingState: false as const },
      totals: { activeResources: 2, totalOpens: 5, opensLast30Days: 2, neverOpened: 0, staleReviewWarnings: 0 },
    };
    const row = (id: string, title: string) => ({
      resourceVersionId: id, title, kind: 'static_resource', version: 1,
      openCount: 1, uniqueMemberCount: 1, opensLast30Days: 1,
      lastOpenedAt: null, staleReviewWarning: false, staleReviewAgeDays: 1,
    });
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({
        ...base,
        resources: [row('r1', 'First resource')],
        pageInfo: { pageSize: 1, hasMore: true, nextCursor: 'cursor-next' },
      }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({
        ...base,
        resources: [row('r1', 'First resource'), row('r2', 'Second resource')],
        pageInfo: { pageSize: 1, hasMore: false, nextCursor: null },
      }) });
    vi.stubGlobal('fetch', fetchMock);
    render(<ResourceCenterAdminPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Load more resources' }));
    expect(await screen.findByText('Second resource')).toBeInTheDocument();
    expect(screen.getAllByText('First resource')).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'All resources loaded' })).toBeDisabled();
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('cursor=cursor-next'),
      { credentials: 'include' },
    );
  });
});
