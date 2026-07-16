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
  answers: [],
  audioUrl: null,
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
    const checkboxes = await screen.findAllByRole('checkbox');
    expect(checkboxes).toHaveLength(4);
    expect(checkboxes.every((checkbox) => !(checkbox as HTMLInputElement).checked)).toBe(
      true,
    );
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
      screen.getAllByRole('checkbox').every((checkbox) => checkbox.hasAttribute('disabled')),
    ).toBe(true);
  });
});
