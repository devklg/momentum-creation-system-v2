import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SteveSuccessInterviewPage } from '../steve-success-interview';

const fields = [
  'why_statement',
  'success_vision',
  'support_obstacles',
  'michael_handoff_summary',
] as const;

const CONSENT_LABELS_FOR_TEST: Record<(typeof fields)[number], string> = {
  why_statement: 'Primary why',
  success_vision: 'Success vision',
  support_obstacles: 'Potential obstacles',
  michael_handoff_summary: 'Michael handoff summary',
};

function privacy(grantedField?: (typeof fields)[number], status = 'active') {
  return {
    policyVersion: 'acr-0031.v1',
    status,
    withdrawnAt: status === 'withdrawn' ? '2026-07-16T01:00:00.000Z' : null,
    sponsorConsent: Object.fromEntries(
      fields.map((field) => [
        field,
        {
          field,
          granted: field === grantedField,
          sponsorTmagId: field === grantedField ? 'TMAG-SPONSOR' : null,
          grantedAt: field === grantedField ? '2026-07-16T00:30:00.000Z' : null,
          revokedAt: null,
        },
      ]),
    ),
  };
}

const artifact = {
  tmagId: 'TMAG-BA',
  sponsorTmagId: 'TMAG-SPONSOR',
  callSid: null,
  startedAt: '2026-07-16T00:00:00.000Z',
  completedAt: '2026-07-16T00:10:00.000Z',
  transcript: [
    {
      sequence: 1,
      speaker: 'ba',
      text: 'Family',
      occurredAt: '2026-07-16T00:01:00.000Z',
    },
  ],
  answers: [],
  audioUrl: null,
  correctionRevision: 0,
  profileVersion: 1,
  lastCorrectedAt: null,
  successProfile: {
    tmagId: 'TMAG-BA',
    generatedAt: '2026-07-16T00:10:00.000Z',
    signedBy: 'Steve Success · non-scored discovery profile',
    primaryWhy: { statement: 'Family', who: 'family', whyNow: 'now' },
    successVision: { statement: 'Freedom', oneBigChange: 'time' },
    learningStyle: { modalities: ['doing'], feedbackPreference: 'direct', notes: '' },
    communicationPreferences: {
      preferredChannels: ['text'],
      cadence: 'weekly',
      bestTimes: 'evenings',
      notes: '',
    },
    supportNeeds: {
      areas: ['training'],
      potentialObstacles: ['time'],
      helpStyle: 'ask early',
      notes: '',
    },
    launchRecommendations: [],
    trainingRecommendations: [],
    michaelHandoffSummary: 'Small actions',
  },
};

const grantCopy =
  'Share this field with my current direct sponsor so they can support my training. I can turn sharing off later. This does not share my transcript, raw answers, audio, or the rest of my Success Profile.';
const revocationCopy =
  'Stop sharing this field with my direct sponsor. The sponsor view will remove it; a content-free audit fact will remain.';

function json(body: unknown, ok = true) {
  return {
    ok,
    json: async () => body,
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Steve Success Profile privacy controls', () => {
  it('keeps typed conversation available when local-device voice is unavailable', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.endsWith('/api/steve/discovery/state')) {
          return json({
            ok: true,
            view: {
              tmagId: 'TMAG-BA',
              phase: 'awaiting_call',
              transcript: [],
              artifact: null,
            },
          });
        }
        if (url.endsWith('/api/steve/discovery/conversation')) {
          return json({ ok: true, turns: [] });
        }
        throw new Error(`Unexpected fetch: ${url}`);
      }),
    );

    render(
      <MemoryRouter>
        <SteveSuccessInterviewPage />
      </MemoryRouter>,
    );

    expect(
      await screen.findByText(
        /Type is always available. Voice appears only when this browser reports both/,
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Voice' })).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: "I'm ready — start my conversation" }),
    ).toBeInTheDocument();
  });

  it('renders four independent off-by-default controls and sends one exact field grant', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith('/api/steve/discovery/state')) {
        return json({
          ok: true,
          view: { tmagId: 'TMAG-BA', phase: 'complete', artifact },
        });
      }
      if (url.endsWith('/api/steve/discovery/privacy') && !init?.method) {
        return json({
          ok: true,
          privacy: privacy(),
          currentSponsorTmagId: 'TMAG-SPONSOR',
          grantCopy,
          revocationCopy,
        });
      }
      if (
        url.endsWith('/api/steve/discovery/privacy/consent') &&
        init?.method === 'PUT'
      ) {
        return json({
          ok: true,
          privacy: privacy('why_statement'),
          currentSponsorTmagId: 'TMAG-SPONSOR',
          grantCopy,
          revocationCopy,
          auditEntryId: 'audit-1',
        });
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <MemoryRouter>
        <SteveSuccessInterviewPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText('Your Privacy Controls')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getAllByRole('checkbox')).toHaveLength(6);
    });
    const privacyCheckboxes = fields.map((field) =>
      screen.getByRole('checkbox', {
        name: new RegExp(`^${CONSENT_LABELS_FOR_TEST[field]}`),
      }),
    );
    expect(
      privacyCheckboxes.every(
        (checkbox) => !(checkbox as HTMLInputElement).checked,
      ),
    ).toBe(true);
    expect(screen.getAllByText(grantCopy)).toHaveLength(4);

    fireEvent.click(screen.getByRole('checkbox', { name: /Primary why/ }));
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/steve/discovery/privacy/consent',
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify({ field: 'why_statement', granted: true }),
        }),
      );
    });
    expect(
      screen.getByRole('checkbox', { name: /Primary why/ }),
    ).toBeChecked();
    expect(screen.getByText(revocationCopy)).toBeInTheDocument();
  });

  it('shows the one-way withdrawn state with self-copy preserved language', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.endsWith('/api/steve/discovery/state')) {
          return json({
            ok: true,
            view: { tmagId: 'TMAG-BA', phase: 'complete', artifact },
          });
        }
        return json({
          ok: true,
          privacy: privacy(undefined, 'withdrawn'),
          currentSponsorTmagId: 'TMAG-SPONSOR',
          grantCopy,
          revocationCopy,
        });
      }),
    );

    render(
      <MemoryRouter>
        <SteveSuccessInterviewPage />
      </MemoryRouter>,
    );

    expect(
      await screen.findByText(
        /Personalization and sponsor sharing are off. Your current profile remains visible to you./,
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Turn off personalization' })).not.toBeInTheDocument();
    expect(
      fields
        .map((field) =>
          screen.getByRole('checkbox', {
            name: new RegExp(`^${CONSENT_LABELS_FOR_TEST[field]}`),
          }),
        )
        .every((checkbox) => checkbox.hasAttribute('disabled')),
    ).toBe(true);
  });

  it('submits one confirmed exact correction and reloads the current artifact', async () => {
    let currentArtifact = structuredClone(artifact);
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith('/api/steve/discovery/state')) {
        return json({
          ok: true,
          view: {
            tmagId: 'TMAG-BA',
            phase: 'complete',
            transcript: currentArtifact.transcript,
            artifact: currentArtifact,
          },
        });
      }
      if (url.endsWith('/api/steve/discovery/privacy') && !init?.method) {
        return json({
          ok: true,
          privacy: privacy(),
          currentSponsorTmagId: 'TMAG-SPONSOR',
          grantCopy,
          revocationCopy,
        });
      }
      if (
        url.endsWith('/api/steve/discovery/correction') &&
        init?.method === 'PUT'
      ) {
        const body = JSON.parse(String(init.body)) as {
          target: unknown;
          replacement: string;
          expectedRevision: number;
          confirmation: string;
        };
        expect(body).toMatchObject({
          target: { kind: 'profile_text', path: 'primaryWhy.statement' },
          replacement: 'Family and freedom',
          expectedRevision: 0,
          confirmation: 'I CONFIRM THIS STEVE CORRECTION',
        });
        currentArtifact = {
          ...currentArtifact,
          correctionRevision: 1,
          lastCorrectedAt: '2026-07-16T02:00:00.000Z',
          successProfile: {
            ...currentArtifact.successProfile,
            primaryWhy: {
              ...currentArtifact.successProfile.primaryWhy,
              statement: 'Family and freedom',
            },
          },
        };
        return json({
          ok: true,
          artifact: currentArtifact,
          correctionRevision: 1,
          correctedAt: '2026-07-16T02:00:00.000Z',
          changedFieldPaths: ['successProfile.primaryWhy.statement'],
          auditEntryId: 'audit-correction',
        });
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <MemoryRouter>
        <SteveSuccessInterviewPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText('Correct Your Private Record')).toBeInTheDocument();
    fireEvent.change(screen.getByTestId('steve-correction-target'), {
      target: { value: 'primary-why' },
    });
    fireEvent.change(screen.getByTestId('steve-correction-replacement'), {
      target: { value: 'Family and freedom' },
    });
    fireEvent.click(
      screen.getByRole('checkbox', {
        name: /I confirm this replacement is the current private value/,
      }),
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'Save confirmed correction' }),
    );

    expect(
      await screen.findByText(
        'Your correction is saved. The prior confirmed version is preserved.',
      ),
    ).toBeInTheDocument();
    expect((await screen.findAllByText('Family and freedom')).length).toBeGreaterThan(0);
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/steve/discovery/correction',
      expect.objectContaining({ method: 'PUT' }),
    );
  });

  it('starts a retake without deleting the current active profile', async () => {
    let retakeStarted = false;
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith('/api/steve/discovery/state')) {
        return json({
          ok: true,
          view: retakeStarted
            ? {
                tmagId: 'TMAG-BA',
                phase: 'call_in_progress',
                transcript: artifact.transcript,
                artifact,
                retakeInProgress: true,
              }
            : { tmagId: 'TMAG-BA', phase: 'complete', artifact },
        });
      }
      if (url.endsWith('/api/steve/discovery/privacy') && !init?.method) {
        return json({
          ok: true,
          privacy: privacy(),
          currentSponsorTmagId: 'TMAG-SPONSOR',
          grantCopy,
          revocationCopy,
        });
      }
      if (url.endsWith('/api/steve/discovery/retake') && init?.method === 'POST') {
        expect(JSON.parse(String(init.body))).toEqual({
          confirmation: 'START A NEW STEVE INTERVIEW',
        });
        retakeStarted = true;
        return json({
          ok: true,
          retakeSessionId: 'steve_retake_123',
          profileVersion: 1,
          startedAt: '2026-07-16T03:00:00.000Z',
          auditEntryId: 'audit-retake',
        });
      }
      if (url.endsWith('/api/steve/discovery/conversation')) {
        return json({ ok: true, turns: [] });
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <MemoryRouter>
        <SteveSuccessInterviewPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText('Retake Your Interview')).toBeInTheDocument();
    expect(
      screen.getByText(/Version 1 stays active for your plan of action/),
    ).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole('checkbox', {
        name: /current profile remains active until I complete/,
      }),
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'Start a new Steve interview' }),
    );

    expect(await screen.findByText('Your discovery conversation')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/steve/discovery/retake',
      expect.objectContaining({ method: 'POST' }),
    );
  });
});
