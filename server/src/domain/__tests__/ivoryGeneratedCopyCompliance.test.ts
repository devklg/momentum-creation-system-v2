import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  complete: vi.fn(),
  persistenceCall: vi.fn(),
  readMasterContent: vi.fn(),
  writeGraphCritical: vi.fn(),
  createInvitation: vi.fn(),
}));

vi.mock('../../services/anthropic.js', () => ({
  complete: mocks.complete,
  AnthropicConfigError: class AnthropicConfigError extends Error {},
  AnthropicError: class AnthropicError extends Error {},
}));

vi.mock('../../services/persistence/dispatch.js', () => ({
  persistenceCall: mocks.persistenceCall,
}));

vi.mock('../../services/masterContent.js', () => ({
  readMasterContent: mocks.readMasterContent,
  interpolateMasterContent: (template: string) => template,
}));

vi.mock('../../services/tieredWrite.js', () => ({
  writeGraphCritical: mocks.writeGraphCritical,
}));

vi.mock('../invitations.js', () => ({
  createInvitation: mocks.createInvitation,
}));

const IVORY_RECORD = {
  ivoryId: 'ivory_1',
  tmagId: 'TMAG-1',
  firstName: 'Dana',
  lastName: 'Smith',
  lastInitial: 'S',
  notes: 'old friend',
  categories: ['friend'],
  preferredAngle: 'make_money',
  status: 'new',
  lastProspectId: null,
  lastTouchedAt: '2026-06-01T00:00:00.000Z',
  createdAt: '2026-06-01T00:00:00.000Z',
  updatedAt: '2026-06-01T00:00:00.000Z',
};

beforeEach(() => {
  vi.resetModules();
  mocks.complete.mockReset();
  mocks.persistenceCall.mockReset();
  mocks.readMasterContent.mockReset();
  mocks.writeGraphCritical.mockReset();
  mocks.createInvitation.mockReset();
  mocks.readMasterContent.mockResolvedValue('Warm, simple Ivory framing.');
  mocks.persistenceCall.mockImplementation(async (tool: string, action: string) => {
    if (tool === 'mongodb' && action === 'query') {
      return { count: 1, documents: [{ ...IVORY_RECORD }] };
    }
    if (tool === 'mongodb' && action === 'update') return { matchedCount: 1 };
    return {};
  });
});

describe('Ivory generated-copy compliance', () => {
  it('drops noncompliant coach JSON to the safe deterministic coach fallback', async () => {
    mocks.complete.mockResolvedValue({
      text: JSON.stringify({
        coaching: 'Ask who wants to make money this month.',
        prompts: ['Who needs income?', 'Who wants a guaranteed spot?', 'Who likes GLP-THREE?'],
      }),
    });
    const { ivoryCoach } = await import('../ivory.js');

    const result = await ivoryCoach({
      angle: 'make_money',
      productName: null,
      rosterSize: 3,
      ask: '',
    });

    expect(result.degraded).toBe(true);
    expect([result.coaching, ...result.prompts].join('\n')).not.toMatch(
      /make money|income|guaranteed spot/i,
    );
  });

  it('drops noncompliant invitation-agent drafts to the safe deterministic draft fallback', async () => {
    mocks.complete.mockResolvedValue({
      text: 'Hey Dana, this can create income and lock your spillover placement.',
    });
    const { draftIvoryInvitation } = await import('../ivory.js');

    const result = await draftIvoryInvitation('TMAG-1', {
      ivoryId: 'ivory_1',
      relationshipReason: 'old friend',
      productName: 'GLP-THREE',
    } as never);

    expect(result.degraded).toBe(true);
    expect(result.draft).toContain('GLP-THREE');
    expect(result.draft).not.toMatch(/income|spillover|placement/i);
  });

  it('rejects noncompliant Ivory generated-source mint messages before persistence', async () => {
    const { mintIvoryInvitation, IvoryValidationError } = await import('../ivory.js');

    await expect(
      mintIvoryInvitation('TMAG-1', {
        ivoryId: 'ivory_1',
        relationshipReason: 'old friend',
        message: 'This can make $500 and lock your spot.',
        city: 'Dallas',
        stateOrRegion: 'TX',
        phone: '2125551234',
        email: null,
      } as never),
    ).rejects.toBeInstanceOf(IvoryValidationError);

    expect(mocks.createInvitation).not.toHaveBeenCalled();
  });
});
