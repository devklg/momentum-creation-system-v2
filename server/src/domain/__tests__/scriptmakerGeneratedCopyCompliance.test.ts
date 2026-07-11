import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  complete: vi.fn(),
  readMasterContent: vi.fn(),
}));

vi.mock('../../services/anthropic.js', () => ({
  complete: mocks.complete,
  AnthropicConfigError: class AnthropicConfigError extends Error {},
  AnthropicError: class AnthropicError extends Error {},
}));

vi.mock('../../services/masterContent.js', () => ({
  readMasterContent: mocks.readMasterContent,
  interpolateMasterContent: (
    template: string,
    values: Record<string, string | null | undefined>,
  ) =>
    template.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => {
      const value = values[key];
      return value === null || value === undefined ? `{{${key}}}` : String(value);
    }),
}));

beforeEach(() => {
  vi.resetModules();
  mocks.complete.mockReset();
  mocks.readMasterContent.mockReset();
  mocks.readMasterContent.mockResolvedValue(
    'Hi {{prospectFirstName}}, I came across {{productName}} and thought of you. Want to watch a short video?',
  );
});

describe('ScriptMaker generated-copy compliance', () => {
  it('drops noncompliant model output to the compliant seed fallback', async () => {
    mocks.complete.mockResolvedValue({
      text:
        'Dana, this can make $500, produce CV cycles, and lock your spillover spot when you enroll with THREE International.',
    });
    const { draftInvitation } = await import('../scriptmaker.js');

    const result = await draftInvitation({
      productName: 'GLP-THREE',
      videoTitle: 'Product overview',
      prospectFirstName: 'Dana',
      prospectContext: null,
    });

    expect(result.degraded).toBe(true);
    expect(result.draft).toContain('GLP-THREE');
    expect(result.draft).not.toMatch(/\$500|CV|spillover|THREE International/i);
  });
});
