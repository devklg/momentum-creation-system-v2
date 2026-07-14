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
    sentAt: null,
    clickedAt: null,
    latestCallbackIntent: null,
    crm: { followUpIsDue: false },
    nextAction: { priority: 0 },
    ...overrides,
  };
}

describe('PmvDashboard', () => {
  it('derives only governed activity counts and rates from BA-scoped PMV rows', () => {
    const snapshot = buildPmvDashboardSnapshot([
      row({ lifecycle: 'draft' }),
      row({
        lifecycle: 'clicked',
        sentAt: '2026-07-13T17:00:00.000Z',
        clickedAt: '2026-07-13T18:00:00.000Z',
        nextAction: { priority: 2 },
      }),
      row({
        lifecycle: 'watched',
        sentAt: '2026-07-13T17:00:00.000Z',
        clickedAt: '2026-07-13T18:00:00.000Z',
        crm: { followUpIsDue: true },
        nextAction: { priority: 4 },
      }),
      row({
        lifecycle: 'callback_requested',
        sentAt: '2026-07-13T17:00:00.000Z',
        latestCallbackIntent: 'have_questions',
        nextAction: { priority: 5 },
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
      activeNextSteps: 3,
      createdToOpenRate: 75,
      openToCompleteRate: 67,
      completeToCallbackRate: 50,
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
