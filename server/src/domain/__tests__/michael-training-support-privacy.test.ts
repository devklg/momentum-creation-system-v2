import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  persistenceCall: vi.fn(),
}));

vi.mock('../../services/persistence/dispatch.js', () => ({
  persistenceCall: mocks.persistenceCall,
}));

function privacyState(overrides: Record<string, boolean> = {}, status = 'active') {
  const fields = [
    'why_statement',
    'success_vision',
    'support_obstacles',
    'michael_handoff_summary',
  ] as const;
  return {
    policyVersion: 'acr-0031.v1',
    status,
    withdrawnAt: status === 'withdrawn' ? '2026-07-16T01:00:00.000Z' : null,
    sponsorConsent: Object.fromEntries(
      fields.map((field) => [
        field,
        {
          field,
          granted: overrides[field] === true,
          sponsorTmagId: overrides[field] === true ? 'TMAG-SPONSOR' : null,
          grantedAt: overrides[field] === true ? '2026-07-16T00:30:00.000Z' : null,
          revokedAt: null,
        },
      ]),
    ),
  };
}

function discovery(privacy = privacyState()) {
  return {
    _id: 'SD-TMAG-BA',
    tmagId: 'TMAG-BA',
    completedAt: '2026-07-16T00:10:00.000Z',
    privacy,
    successProfile: {
      tmagId: 'TMAG-BA',
      generatedAt: '2026-07-16T00:10:00.000Z',
      signedBy: 'Steve Success · non-scored discovery profile',
      primaryWhy: { statement: 'Private why', who: 'family', whyNow: 'now' },
      successVision: { statement: 'Private vision', oneBigChange: 'time' },
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
      trainingRecommendations: [{ text: 'Start Fast Start.', href: '/training/fast-start' }],
      michaelHandoffSummary: 'Private handoff',
    },
  };
}

beforeEach(() => {
  vi.resetModules();
  mocks.persistenceCall.mockReset();
});

describe('Michael sponsor projection under ACR-0031 consent', () => {
  it('uses the bounded base projection and performs no private-field read by default', async () => {
    const record = discovery();
    mocks.persistenceCall
      .mockResolvedValueOnce({
        documents: [
          { tmagId: 'TMAG-BA', sponsorTmagId: 'TMAG-SPONSOR', firstName: 'Alex' },
        ],
      })
      .mockResolvedValueOnce({ documents: [record] });
    const domain = await import('../michael-training-support.js');

    const card = await domain.getTrainingSupportCardForSponsor({
      requestingTmagId: 'TMAG-SPONSOR',
      downlineTmagId: 'TMAG-BA',
    });

    expect(card.primaryWhy).toBe('');
    expect(card.successVision).toBe('');
    expect(card.michaelHandoffSummary).toBe('');
    expect(mocks.persistenceCall).toHaveBeenCalledTimes(2);
    const baseProjection = mocks.persistenceCall.mock.calls[1]?.[2]?.projection;
    expect(baseProjection).not.toHaveProperty('successProfile.primaryWhy.statement');
    expect(baseProjection).not.toHaveProperty('successProfile.successVision.statement');
    expect(baseProjection).not.toHaveProperty(
      'successProfile.supportNeeds.potentialObstacles',
    );
    expect(baseProjection).not.toHaveProperty(
      'successProfile.michaelHandoffSummary',
    );
  });

  it('performs a second exact projection for only the consented fields', async () => {
    const record = discovery(
      privacyState({ why_statement: true, support_obstacles: true }),
    );
    mocks.persistenceCall
      .mockResolvedValueOnce({
        documents: [
          { tmagId: 'TMAG-BA', sponsorTmagId: 'TMAG-SPONSOR', firstName: 'Alex' },
        ],
      })
      .mockResolvedValueOnce({ documents: [record] })
      .mockResolvedValueOnce({ documents: [record] });
    const domain = await import('../michael-training-support.js');

    const card = await domain.getTrainingSupportCardForSponsor({
      requestingTmagId: 'TMAG-SPONSOR',
      downlineTmagId: 'TMAG-BA',
    });

    expect(card.primaryWhy).toBe('Private why');
    expect(card.successVision).toBe('');
    expect(card.michaelHandoffSummary).toBe('');
    expect(card.supportFocus.bullets).toContain(
      'Obstacles they chose to share: time.',
    );
    const privateProjection = mocks.persistenceCall.mock.calls[2]?.[2]?.projection;
    expect(privateProjection).toEqual({
      _id: 1,
      'successProfile.primaryWhy.statement': 1,
      'successProfile.supportNeeds.potentialObstacles': 1,
    });
  });

  it('fails closed after withdrawal without reading any private field', async () => {
    mocks.persistenceCall
      .mockResolvedValueOnce({
        documents: [
          { tmagId: 'TMAG-BA', sponsorTmagId: 'TMAG-SPONSOR', firstName: 'Alex' },
        ],
      })
      .mockResolvedValueOnce({
        documents: [discovery(privacyState({}, 'withdrawn'))],
      });
    const domain = await import('../michael-training-support.js');

    await expect(
      domain.getTrainingSupportCardForSponsor({
        requestingTmagId: 'TMAG-SPONSOR',
        downlineTmagId: 'TMAG-BA',
      }),
    ).rejects.toMatchObject({ code: 'WITHDRAWN' });
    expect(mocks.persistenceCall).toHaveBeenCalledTimes(2);
  });
});
