import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  PMV_ANALYTICS_FORBIDDEN_PATTERNS,
} from '@momentum/shared';
import {
  PmvDashboard,
  buildPmvDashboardSnapshot,
  type PmvDashboardRow,
} from '../PmvDashboard';

function row(overrides: Partial<PmvDashboardRow> = {}): PmvDashboardRow {
  return {
    lifecycle: 'draft',
    tokenState: 'minted',
    sentAt: null,
    clickedAt: null,
    placedAt: null,
    latestCallbackIntent: null,
    crm: { followUpIsDue: false },
    ...overrides,
  };
}

describe('PmvDashboard', () => {
  it('derives only governed activity counts and rates from BA-scoped PMV rows', () => {
    const snapshot = buildPmvDashboardSnapshot([
      row({ lifecycle: 'draft' }),
      row({
        lifecycle: 'clicked',
        tokenState: 'clicked',
        sentAt: '2026-07-13T17:00:00.000Z',
        clickedAt: '2026-07-13T18:00:00.000Z',
      }),
      row({
        lifecycle: 'watched',
        tokenState: 'video_complete',
        sentAt: '2026-07-13T17:00:00.000Z',
        clickedAt: '2026-07-13T18:00:00.000Z',
        placedAt: '2026-07-13T19:00:00.000Z',
        crm: { followUpIsDue: true },
      }),
      row({
        lifecycle: 'callback_requested',
        tokenState: 'video_complete',
        sentAt: '2026-07-13T17:00:00.000Z',
        placedAt: '2026-07-13T19:00:00.000Z',
        latestCallbackIntent: 'have_questions',
      }),
    ]);

    expect(snapshot).toEqual({
      peopleInvited: 4,
      manualSends: 3,
      linkOpens: 3,
      videoStarts: 2,
      presentationsCompleted: 2,
      callbackRequests: 1,
      followUpsDue: 1,
      createdToOpenRate: 75,
      openToCompleteRate: 67,
      completeToCallbackRate: 50,
    });
  });

  it('does not infer presentation activity from customer or enrollment outcomes', () => {
    const snapshot = buildPmvDashboardSnapshot([
      row({ lifecycle: 'customer' }),
      row({ lifecycle: 'enrolled', tokenState: 'enrolled' }),
    ]);

    expect(snapshot).toMatchObject({
      peopleInvited: 2,
      linkOpens: 0,
      videoStarts: 0,
      presentationsCompleted: 0,
      createdToOpenRate: 0,
      openToCompleteRate: null,
    });
  });

  it('preserves completion evidence after a token advances to enrolled', () => {
    const snapshot = buildPmvDashboardSnapshot([
      row({
        lifecycle: 'enrolled',
        tokenState: 'enrolled',
        clickedAt: '2026-07-13T18:00:00.000Z',
        placedAt: '2026-07-13T19:00:00.000Z',
      }),
    ]);

    expect(snapshot).toMatchObject({
      linkOpens: 1,
      videoStarts: 1,
      presentationsCompleted: 1,
    });
  });

  it('renders empty rates without manufacturing percentages', () => {
    render(<PmvDashboard rows={[]} />);

    expect(screen.getByText('PMV activity snapshot')).toBeInTheDocument();
    expect(screen.getAllByText('—')).toHaveLength(3);
  });

  it('keeps dashboard copy outside the PMV analytics forbidden patterns', () => {
    const { container } = render(<PmvDashboard rows={[row()]} />);
    const copy = container.textContent ?? '';

    for (const pattern of PMV_ANALYTICS_FORBIDDEN_PATTERNS) {
      expect(copy).not.toMatch(new RegExp(pattern, 'i'));
    }
  });
});
