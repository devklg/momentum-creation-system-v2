import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  complete: vi.fn(),
  persistenceCall: vi.fn(),
  getProspectMomentumViewer: vi.fn(),
  listIvoryNamesForBA: vi.fn(),
}));

vi.mock('../../services/anthropic.js', () => ({
  complete: mocks.complete,
  AnthropicConfigError: class AnthropicConfigError extends Error {},
  AnthropicError: class AnthropicError extends Error {},
}));

vi.mock('../../services/persistence/dispatch.js', () => ({
  persistenceCall: mocks.persistenceCall,
}));

vi.mock('../cockpit.js', () => ({
  getProspectMomentumViewer: mocks.getProspectMomentumViewer,
}));

vi.mock('../ivory.js', () => ({
  listIvoryNamesForBA: mocks.listIvoryNamesForBA,
}));

const PMV_ROW = {
  prospectId: 'prospect_1',
  firstName: 'Dana',
  lastInitial: 'S',
  sponsorTmagId: 'TMAG-1',
  source: 'ivory',
  lifecycle: 'watched',
  createdAt: '2026-07-01T00:00:00.000Z',
  sentAt: '2026-07-01T00:00:00.000Z',
  expiresAt: '2026-08-01T00:00:00.000Z',
  relationshipReason: 'old friend',
  lastSignal: {
    kind: 'video_completed',
    label: 'Video watched',
    at: '2026-07-02T00:00:00.000Z',
  },
  crm: { followUpIsDue: false },
};

beforeEach(() => {
  vi.resetModules();
  mocks.complete.mockReset();
  mocks.persistenceCall.mockReset();
  mocks.getProspectMomentumViewer.mockReset();
  mocks.listIvoryNamesForBA.mockReset();
  mocks.persistenceCall.mockResolvedValue({
    documents: [{ prospectId: 'prospect_1', sponsorTmagId: 'TMAG-1' }],
  });
  mocks.getProspectMomentumViewer.mockResolvedValue({ rows: [PMV_ROW] });
  mocks.listIvoryNamesForBA.mockResolvedValue([
    {
      ivoryId: 'ivory_1',
      tmagId: 'TMAG-1',
      firstName: 'Dana',
      lastName: 'Smith',
      lastInitial: 'S',
      notes: 'friend',
      categories: ['friend'],
      preferredAngle: 'make_money',
      status: 'invited',
      lastProspectId: 'prospect_1',
      lastTouchedAt: '2026-07-01T00:00:00.000Z',
      createdAt: '2026-07-01T00:00:00.000Z',
      updatedAt: '2026-07-01T00:00:00.000Z',
    },
  ]);
});

describe('Ivory Momentum generated-copy compliance', () => {
  it('drops noncompliant follow-up suggestions to the deterministic fallback', async () => {
    mocks.complete.mockResolvedValue({
      text: JSON.stringify({
        coaching: 'They watched, so pressure the opportunity.',
        suggestion: 'Dana, act now because this can make money and secure placement.',
      }),
    });
    const { suggestIvoryMomentumFollowUp } = await import('../ivory-momentum.js');

    const result = await suggestIvoryMomentumFollowUp('TMAG-1', 'prospect_1', {
      ask: '',
    } as never);

    expect(result.degraded).toBe(true);
    expect(`${result.coaching}\n${result.suggestion}`).not.toMatch(
      /act now|make money|placement/i,
    );
  });
});
