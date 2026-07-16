import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  persistenceCall: vi.fn(),
}));

vi.mock('../../services/persistence/dispatch.js', () => ({
  persistenceCall: mocks.persistenceCall,
}));

beforeEach(() => {
  vi.resetModules();
  mocks.persistenceCall.mockReset();
});

describe('ACR-0031 recruiting-cycle why replay boundary', () => {
  it('returns the active BA-owned why statement through an exact projection', async () => {
    mocks.persistenceCall.mockResolvedValueOnce({
      documents: [
        {
          successProfile: { primaryWhy: { statement: 'Support my family' } },
          privacy: { status: 'active' },
        },
      ],
    });
    const recruitingCycle = await import('../recruitingCycle.js');

    await expect(recruitingCycle.getWhyStatement('TMAG-BA')).resolves.toBe(
      'Support my family',
    );
    expect(mocks.persistenceCall).toHaveBeenCalledWith(
      'mongodb',
      'query',
      expect.objectContaining({
        projection: {
          'successProfile.primaryWhy.statement': 1,
          privacy: 1,
        },
      }),
    );
  });

  it('returns no why replay after the BA withdraws personalization', async () => {
    mocks.persistenceCall.mockResolvedValueOnce({
      documents: [
        {
          successProfile: { primaryWhy: { statement: 'Private why' } },
          privacy: {
            policyVersion: 'acr-0031.v1',
            status: 'withdrawn',
            withdrawnAt: '2026-07-16T01:00:00.000Z',
            sponsorConsent: {},
          },
        },
      ],
    });
    const recruitingCycle = await import('../recruitingCycle.js');

    await expect(recruitingCycle.getWhyStatement('TMAG-BA')).resolves.toBeNull();
  });
});
