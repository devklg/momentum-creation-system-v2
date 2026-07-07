import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import type {
  McsRecruitingCycleDerived,
  McsRecruitingCycleRecord,
  McsRecruitingStep,
} from '@momentum/shared';
import { RecruitingCycleDashboardView } from '../RecruitingCycleDashboard';

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response;
}

function cycle(overrides: Partial<McsRecruitingCycleRecord> = {}): McsRecruitingCycleRecord {
  return {
    tmagId: 'TMAG-BA-001',
    enrolledAt: '2026-07-07T12:00:00.000Z',
    fivePointTargetAt: '2026-07-09T12:00:00.000Z',
    fivePointCompletedAt: null,
    qbaTargetAt: '2026-07-10T12:00:00.000Z',
    qbaAchievedAt: null,
    qbaLeftLegTmagId: null,
    qbaRightLegTmagId: null,
    qbaAttestedBy: null,
    core3AchievedAt: null,
    core3TmagId: null,
    namesTarget: 100,
    trancheSize: 20,
    currentStep: 2,
    lastActivityAt: '2026-07-07T14:00:00.000Z',
    stallFlaggedAt: null,
    status: 'active',
    createdAt: '2026-07-07T12:00:00.000Z',
    updatedAt: '2026-07-07T14:00:00.000Z',
    ...overrides,
  };
}

function derived(overrides: Partial<McsRecruitingCycleDerived> = {}): McsRecruitingCycleDerived {
  const currentStep: McsRecruitingStep = overrides.currentStep ?? 2;
  return {
    namesCount: 42,
    namesTarget: 100,
    trancheSize: 20,
    trancheCount: 5,
    tranchesCompleted: 2,
    invitesCount: 7,
    presentationsCount: 3,
    followUpsCount: 2,
    enrollmentsCount: 1,
    currentStep,
    steps: [1, 2, 3, 4, 5].map((step) => ({
      step: step as McsRecruitingStep,
      label:
        step === 1
          ? 'Make Your List'
          : step === 2
            ? 'Connecting & Inviting'
            : step === 3
              ? 'Presenting'
              : step === 4
                ? 'Follow Up'
                : 'Onboarding New BA',
      complete: step < currentStep,
    })),
    fivePointComplete: false,
    ...overrides,
  };
}

describe('RecruitingCycleDashboardView', () => {
  it('renders active launch state with names progress, tranche progress, why, Michael touch, and supportive target copy', () => {
    render(
      <RecruitingCycleDashboardView
        me={{
          ok: true,
          cycle: cycle(),
          derived: derived(),
          why: 'I want my family to see me build with consistency.',
          michael: {
            latestTouch: {
              text: 'Pick the next warm name and keep the touch personal.',
              at: '2026-07-07T15:00:00.000Z',
            },
          },
        }}
        sponsorCycles={[]}
      />,
    );

    expect(screen.getByRole('heading', { name: /5 point recruiting cycle/i })).toBeInTheDocument();
    expect(screen.getByText(/42\/100 · tranche 2\/5/i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /connecting & inviting/i })).toBeInTheDocument();
    expect(screen.getByText(/i want my family/i)).toBeInTheDocument();
    expect(screen.getByText(/pick the next warm name/i)).toBeInTheDocument();
    expect(document.body.textContent ?? '').toMatch(/target|momentum/i);
    expect(document.body.textContent ?? '').not.toMatch(/\b(failure|shame|missed|late)\b/i);
  });

  it('handles pre-Steve state without inventing cycle progress', () => {
    render(
      <RecruitingCycleDashboardView
        me={{
          ok: true,
          cycle: null,
          derived: null,
          why: null,
        }}
        sponsorCycles={[]}
      />,
    );

    expect(screen.getByText(/your launch cycle starts from your discovery profile/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /open steve/i })).toHaveAttribute(
      'href',
      '/steve/discovery',
    );
    expect(screen.getByText(/your why appears here after steve/i)).toBeInTheDocument();
  });

  it('confirms sponsor attestation and posts the typed payload', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    fetchMock.mockResolvedValue(
      jsonResponse(200, {
        ok: true,
        cycle: cycle({ qbaLeftLegTmagId: 'TMAG-LEFT-001' }),
        milestone: null,
      }),
    );
    const onAttested = vi.fn();

    render(
      <RecruitingCycleDashboardView
        me={{
          ok: true,
          cycle: cycle(),
          derived: derived(),
          why: null,
        }}
        sponsorCycles={[
          {
            tmagId: 'TMAG-BA-002',
            fullName: 'Jordan Lee',
            firstName: 'Jordan',
            cycle: cycle({ tmagId: 'TMAG-BA-002' }),
            derived: derived({ namesCount: 20, tranchesCompleted: 1 }),
            pendingAttestations: [{ leg: 'left', label: 'Left leg' }],
          },
        ]}
        onAttested={onAttested}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText('TMAG ID'), {
      target: { value: 'TMAG-LEFT-001' },
    });
    fireEvent.change(screen.getByPlaceholderText(/optional context/i), {
      target: { value: 'Confirmed manually with sponsor.' },
    });
    fireEvent.click(screen.getByRole('button', { name: /attest/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/recruiting-cycle/TMAG-BA-002/attest');
    expect(init.method).toBe('POST');
    expect(init.credentials).toBe('include');
    expect(JSON.parse(init.body as string)).toEqual({
      leg: 'left',
      enrolleeTmagId: 'TMAG-LEFT-001',
      note: 'Confirmed manually with sponsor.',
    });
    expect(await screen.findByText(/attestation recorded/i)).toBeInTheDocument();
    expect(onAttested).toHaveBeenCalledTimes(1);
  });

  it('renders server rejection for non-sponsor attestation cleanly', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    fetchMock.mockResolvedValue(jsonResponse(403, { message: 'Only the sponsor of record may attest.' }));

    render(
      <RecruitingCycleDashboardView
        me={{ ok: true, cycle: cycle(), derived: derived(), why: null }}
        sponsorCycles={[
          {
            tmagId: 'TMAG-BA-003',
            fullName: 'Riley Morgan',
            firstName: 'Riley',
            cycle: cycle({ tmagId: 'TMAG-BA-003' }),
            derived: derived(),
            pendingAttestations: [{ leg: 'right', label: 'Right leg' }],
          },
        ]}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText('TMAG ID'), {
      target: { value: 'TMAG-RIGHT-001' },
    });
    fireEvent.click(screen.getByRole('button', { name: /attest/i }));

    expect(await screen.findByText(/only the sponsor of record may attest/i)).toBeInTheDocument();
  });
});
