import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import {
  runProviderReleaseSmoke,
  smokeAnthropicReleaseKey,
  smokeResendReleaseKey,
} from '../providerReleaseSmoke.js';

function response(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: vi.fn(async () => (typeof body === 'string' ? body : JSON.stringify(body))),
  };
}

const CONFIG = {
  EMAIL_API_KEY: 're_private_key',
  EMAIL_FROM: 'Team Magnificent <webinars@teammagnificent.com>',
  ANTHROPIC_API_KEY: 'sk-ant-private-key',
  ANTHROPIC_MODEL: 'claude-haiku-4-5-20251001',
};

describe('P2-143 live provider-key release smoke', () => {
  it('fails closed without contacting either provider when keys are dormant', async () => {
    const fetchMock = vi.fn();
    const results = await runProviderReleaseSmoke({
      ...CONFIG,
      EMAIL_API_KEY: '',
      ANTHROPIC_API_KEY: '',
    }, 'all', fetchMock as never);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(results).toEqual([
      expect.objectContaining({ provider: 'resend', ok: false, state: 'not_configured' }),
      expect.objectContaining({ provider: 'anthropic', ok: false, state: 'not_configured' }),
    ]);
  });

  it('verifies the exact Resend sending domain using a GET with no message body', async () => {
    const fetchMock = vi.fn(async (_url: string, _options?: Record<string, unknown>) => response(200, {
      data: [{
        name: 'teammagnificent.com',
        status: 'verified',
        capabilities: { sending: 'enabled' },
      }],
    }));

    const result = await smokeResendReleaseKey(CONFIG, fetchMock as never);

    expect(result).toMatchObject({
      provider: 'resend',
      ok: true,
      state: 'ready',
      target: 'teammagnificent.com',
      request: { method: 'GET', bodyIncluded: false, sendsEmail: false },
    });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.resend.com/domains?limit=100',
      expect.objectContaining({ method: 'GET' }),
    );
    const options = fetchMock.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(options).not.toHaveProperty('body');
  });

  it('fails when the configured Resend domain is present but not verified', async () => {
    const fetchMock = vi.fn(async (_url: string, _options?: Record<string, unknown>) => response(200, {
      data: [{
        name: 'teammagnificent.com',
        status: 'pending',
        capabilities: { sending: 'disabled' },
      }],
    }));

    await expect(smokeResendReleaseKey(CONFIG, fetchMock as never)).resolves.toMatchObject({
      ok: false,
      state: 'target_not_ready',
      providerStatus: 'pending',
    });
  });

  it('verifies the exact Anthropic model using a GET with no prompt or request body', async () => {
    const fetchMock = vi.fn(async (_url: string, _options?: Record<string, unknown>) => response(200, {
      id: CONFIG.ANTHROPIC_MODEL,
      display_name: 'Claude Haiku',
      type: 'model',
    }));

    const result = await smokeAnthropicReleaseKey(CONFIG, fetchMock as never);

    expect(result).toMatchObject({
      provider: 'anthropic',
      ok: true,
      state: 'ready',
      target: CONFIG.ANTHROPIC_MODEL,
      privacy: { interviewDataSent: false, upstreamBodyReturned: false },
      request: { method: 'GET', bodyIncluded: false, sendsLlmPrompt: false },
    });
    expect(fetchMock).toHaveBeenCalledWith(
      `https://api.anthropic.com/v1/models/${CONFIG.ANTHROPIC_MODEL}`,
      expect.objectContaining({ method: 'GET' }),
    );
    const options = fetchMock.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(options).not.toHaveProperty('body');
  });

  it('reports credential rejection without returning a key or upstream body', async () => {
    const fetchMock = vi.fn(async () => response(401, 'private provider response'));

    const results = await runProviderReleaseSmoke(CONFIG, 'all', fetchMock as never);
    const serialized = JSON.stringify(results);

    expect(results).toEqual([
      expect.objectContaining({ provider: 'resend', state: 'credential_rejected', httpStatus: 401 }),
      expect.objectContaining({ provider: 'anthropic', state: 'credential_rejected', httpStatus: 401 }),
    ]);
    expect(serialized).not.toContain(CONFIG.EMAIL_API_KEY);
    expect(serialized).not.toContain(CONFIG.ANTHROPIC_API_KEY);
    expect(serialized).not.toContain('private provider response');
  });

  it('reports provider transport failure using safe metadata only', async () => {
    const fetchMock = vi.fn(async () => {
      throw new Error('private network detail');
    });

    const result = await smokeAnthropicReleaseKey(CONFIG, fetchMock as never);

    expect(result).toMatchObject({
      ok: false,
      state: 'provider_unavailable',
      httpStatus: null,
    });
    expect(JSON.stringify(result)).not.toContain('private network detail');
  });

  it('keeps the executable behind explicit --live consent and imports no send/generation path', async () => {
    const scriptPath = fileURLToPath(
      new URL('../../../scripts/smoke-provider-keys.ts', import.meta.url),
    );
    const source = await readFile(scriptPath, 'utf8');

    expect(source).toContain("args.includes('--live')");
    expect(source).not.toMatch(/\bsendEmail\s*\(|\bcomplete\s*\(/);
    expect(source).not.toMatch(/\/v1\/messages|\/emails(?:['"`])/);
  });
});
