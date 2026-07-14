import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { LaunchCenter, type TeamLaunchCenter } from '../LaunchCenter';

function launch(overrides: Partial<TeamLaunchCenter> = {}): TeamLaunchCenter {
  return {
    ok: true,
    generatedAt: '2026-07-13T00:00:00.000Z',
    baFirstName: 'Alex',
    progress: { completed: 2, total: 8, percent: 25 },
    nextAction: {
      stepId: 'day_1_started',
      label: 'Start Day 1 training',
      href: '/training/fast-start/product',
      reason: 'Open the first Fast Start module.',
    },
    steps: [],
    steve: { phase: 'complete', completedAt: '2026-07-13T00:00:00.000Z' },
    michael: { enabled: false, complete: false, completedAt: null },
    firstInvitation: { ivoryNames: 0, draftedCount: 0, mintedCount: 0, sentCount: 0 },
    fastStart: { day1State: 'not_started', day1StartedAt: null, day1CompletedAt: null, complete: false },
    readiness: { items: [], attentionDomains: [] },
    guidance: {
      schemaVersion: 'steve_guidance.v1',
      status: 'available',
      reason: 'profile_available',
      source: 'steve_success_profile',
      provenance: { generatedAt: '2026-07-13T00:00:00.000Z', signedBy: 'Steve' },
      training: [{ text: 'Start with the product module.', href: '/training/fast-start/product' }],
      launch: [{ text: 'Write down the people you know.', href: null }],
      policy: {
        guidanceNotRequirement: true,
        equalAccess: true,
        changesAccess: false,
        changesCurriculumOrder: false,
        changesCompletion: false,
        changesLaunchNextAction: false,
        approvedKnowledge: false,
        scoring: false,
        ranking: false,
        classification: false,
        qualification: false,
        prediction: false,
        comparison: false,
      },
    },
    launchComplete: false,
    ...overrides,
  };
}

describe('P2-118 Launch Center Steve guidance', () => {
  it('renders training and launch suggestions as optional profile guidance', () => {
    render(<LaunchCenter launch={launch()} onNavigate={vi.fn()} />);
    expect(screen.getByTestId('steve-tailored-guidance')).toBeInTheDocument();
    expect(screen.getByText('Start with the product module.')).toBeInTheDocument();
    expect(screen.getByText('Write down the people you know.')).toBeInTheDocument();
    expect(screen.getByText(/Suggestions, not requirements/)).toBeInTheDocument();
  });

  it('uses only allowlisted projected links and leaves the factual next action unchanged', () => {
    const onNavigate = vi.fn();
    render(<LaunchCenter launch={launch()} onNavigate={onNavigate} />);
    fireEvent.click(screen.getByRole('button', { name: 'Open' }));
    expect(onNavigate).toHaveBeenCalledWith('/training/fast-start/product');
    expect(screen.getByText('Start Day 1 training')).toBeInTheDocument();
  });

  it('does not expose unavailable or inconsistent guidance', () => {
    const unavailable = launch({
      guidance: {
        ...launch().guidance,
        status: 'needs_attention',
        reason: 'profile_duplicate_or_identity_inconsistent',
        training: [],
        launch: [],
      },
    });
    render(<LaunchCenter launch={unavailable} onNavigate={vi.fn()} />);
    expect(screen.queryByTestId('steve-tailored-guidance')).not.toBeInTheDocument();
  });
});
