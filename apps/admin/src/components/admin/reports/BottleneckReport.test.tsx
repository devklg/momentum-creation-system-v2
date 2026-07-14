import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { McsAdminBottleneckReportResponse } from '@momentum/shared';
import { BottleneckReport } from './BottleneckReport';

const coverage = {
  mode: 'bounded_snapshot' as const,
  note: 'Current bounded source rows only.',
  constraints: ['Maximum bounded rows.'],
};

const report = {
  ok: true,
  schemaVersion: 'admin_bottlenecks.v1',
  generatedAt: '2026-07-13T20:00:00.000Z',
  scope: 'team_aggregate_bounded',
  policy: 'aggregate_observations_only_no_ranking_or_scoring',
  partialSources: ['invitations', 'crm', 'training', 'events', 'delivery'],
  unavailableSources: [],
  sections: {
    invitations: {
      status: 'observed', sourceStatus: 'partial', summary: 'Invitation observation.', sourceGeneratedAt: '2026-07-13T20:00:00.000Z', coverage,
      currentStates: { scanned: 12, sentUnopened: 4, openedNotStarted: 2, presentationInProgress: 2, presentationComplete: 2, enrolled: 1, expired: 1 },
    },
    crm: {
      status: 'attention', sourceStatus: 'partial', summary: 'Two findings.', sourceGeneratedAt: '2026-07-13T20:00:00.000Z', coverage,
      scanned: { crmRecords: 10, followUps: 5, prospects: 11 },
      findings: { stuck: 1, duplicate: 1, orphan: 0, inconsistent: 0, ambiguous: 0, total: 2, cleanupCandidates: 1 },
    },
    training: {
      status: 'observed', sourceStatus: 'partial', summary: 'Curriculum states.', sourceGeneratedAt: '2026-07-13T20:00:00.000Z', coverage, scopeBaCount: 10,
      programStates: { notStarted: 4, underway: 4, allModulesComplete: 2 }, allModulesCompletionPct: 20,
      dataQuality: { duplicateProgressRecords: 0, invalidProgressRecords: 0 },
    },
    events: {
      status: 'attention', sourceStatus: 'partial', summary: 'Follow-up review.', sourceGeneratedAt: '2026-07-13T20:00:00.000Z',
      coverage: { ...coverage, mode: 'current_window' }, events: { upcoming: 2, past: 1, cancelled: 0, fullUpcoming: 1 },
      attendance: { recorded: 3, missed: 2, missedWithoutActiveReminder: 1 }, remindersNotConfigured: 2,
      governanceDependencies: ['Event reminders remain not configured pending P2-109 governance decisions.'],
    },
    delivery: {
      status: 'attention', sourceStatus: 'partial', summary: 'Delivery review.', sourceGeneratedAt: '2026-07-13T20:00:00.000Z',
      coverage: { ...coverage, mode: 'operations_subset' }, operationalScope: 'vm_rvm_and_projection_health',
      delivered24h: 9, failed24h: 2, providers: 1,
      projections: { pending: 4, due: 2, deadLettered: 1, oldestPendingAt: '2026-07-13T20:00:00.000Z' },
      stoppedWorkers: ['Projection outbox'], warningCount: 1,
    },
  },
} satisfies McsAdminBottleneckReportResponse;

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('BottleneckReport', () => {
  it('renders all five bounded authorities without person rows', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => report })));
    render(<BottleneckReport />);

    expect(await screen.findByRole('heading', { name: 'Bottleneck Report' })).toBeInTheDocument();
    for (const title of ['Invitations', 'CRM integrity', 'Training', 'Events', 'Delivery operations']) {
      expect(screen.getByRole('heading', { name: title })).toBeInTheDocument();
    }
    expect(screen.getByText(/1 without active reminder/i)).toBeInTheDocument();
    expect(screen.getByText(/Bounded sources: 5/i)).toBeInTheDocument();
    expect(screen.queryByText(/Private Person/i)).not.toBeInTheDocument();
  });

  it('labels unavailable source counts while leaving available cards visible', async () => {
    const partial = structuredClone(report);
    partial.unavailableSources = ['crm'];
    partial.sections.crm.status = 'unavailable';
    partial.sections.crm.sourceStatus = 'unavailable';
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => partial })));

    render(<BottleneckReport />);

    expect(await screen.findByRole('heading', { name: 'Invitations' })).toBeInTheDocument();
    expect(screen.getByText(/Unavailable sources: 1/i)).toBeInTheDocument();
  });

  it('shows a contained error when the aggregate endpoint fails', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 503, json: async () => ({}) })));
    render(<BottleneckReport />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Report request failed (503).');
  });
});
