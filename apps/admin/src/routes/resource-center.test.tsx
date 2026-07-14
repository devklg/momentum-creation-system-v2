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
      pageInfo: { pageSize: 50, hasMore: false, nextCursor: null },
    }) })));
    render(<ResourceCenterAdminPage />);
    expect(await screen.findByText('Field Guide')).toBeInTheDocument();
    expect(screen.getByText(/Review due · 120d/)).toBeInTheDocument();
    expect(screen.getByText(/Warnings never publish/)).toBeInTheDocument();
  });

  it('appends catalog pages, deduplicates versions, and keeps complete totals', async () => {
    const row = (resourceVersionId: string, title: string) => ({ resourceVersionId, title, kind: 'static_resource', version: 1, openCount: 1, uniqueMemberCount: 1, opensLast30Days: 1, lastOpenedAt: null, staleReviewWarning: false, staleReviewAgeDays: 1 });
    const base = { ok: true, policy: { staleReviewDays: 90, warningOnly: true, changesPublishingState: false }, totals: { activeResources: 20, totalOpens: 99, opensLast30Days: 12, neverOpened: 3, staleReviewWarnings: 2 } };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ ...base, resources: [row('r1', 'First')], pageInfo: { pageSize: 1, hasMore: true, nextCursor: 'cursor-token-that-is-long-enough' } }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ ...base, resources: [row('r1', 'First updated'), row('r2', 'Second')], pageInfo: { pageSize: 1, hasMore: false, nextCursor: null } }) });
    vi.stubGlobal('fetch', fetchMock);
    render(<ResourceCenterAdminPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Load more resources' }));
    expect(await screen.findByText('Second')).toBeInTheDocument();
    expect(screen.getByText('First updated')).toBeInTheDocument();
    expect(screen.getByText('20')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'All resources loaded' })).toBeDisabled();
  });
});
