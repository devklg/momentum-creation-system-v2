import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
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
});
