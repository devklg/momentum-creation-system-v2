import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  fetch: vi.fn(),
  env: {
    ANTHROPIC_API_KEY: 'test-key',
    ANTHROPIC_MODEL: 'test-model',
  },
}));

vi.mock('undici', () => ({ fetch: mocks.fetch }));
vi.mock('../../env.js', () => ({ env: mocks.env }));

function response(status: number, body: unknown, statusText = '') {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText,
    text: vi.fn(async () => (typeof body === 'string' ? body : JSON.stringify(body))),
  };
}

async function modules() {
  const anthropic = await import('../anthropic.js');
  const observability = await import('../llmProviderObservability.js');
  return { ...anthropic, ...observability };
}

const INPUT = {
  system: 'private system prompt',
  messages: [{ role: 'user' as const, content: 'private user turn' }],
};

beforeEach(async () => {
  mocks.fetch.mockReset();
  mocks.env.ANTHROPIC_API_KEY = 'test-key';
  const { resetLlmProviderObservabilityForTests } = await modules();
  resetLlmProviderObservabilityForTests();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('P2-125 Anthropic retry and observability', () => {
  it('reports dormant configuration without attempting a request', async () => {
    const { complete, AnthropicConfigError, getLlmProviderObservabilitySnapshot } = await modules();
    mocks.env.ANTHROPIC_API_KEY = '';

    await expect(complete(INPUT)).rejects.toBeInstanceOf(AnthropicConfigError);

    expect(mocks.fetch).not.toHaveBeenCalled();
    expect(getLlmProviderObservabilitySnapshot()).toMatchObject({
      configured: false,
      state: 'dormant',
      counters: { requests: 1, attempts: 0, failures: 1, retries: 0 },
      failuresByKind: { config: 1 },
    });
  });

  it('reports a successful one-attempt request without retaining content', async () => {
    const { complete, getLlmProviderObservabilitySnapshot } = await modules();
    mocks.fetch.mockResolvedValueOnce(response(200, {
      content: [{ type: 'text', text: 'Generated copy' }],
      model: 'resolved-model',
      usage: { input_tokens: 10, output_tokens: 4 },
    }));

    await expect(complete(INPUT)).resolves.toMatchObject({ text: 'Generated copy' });

    const snapshot = getLlmProviderObservabilitySnapshot();
    expect(snapshot).toMatchObject({
      state: 'healthy',
      counters: { requests: 1, attempts: 1, successes: 1, failures: 0, retries: 0 },
    });
    expect(JSON.stringify(snapshot)).not.toContain('private system prompt');
    expect(JSON.stringify(snapshot)).not.toContain('private user turn');
    expect(JSON.stringify(snapshot)).not.toContain('Generated copy');
    expect(JSON.stringify(snapshot)).not.toContain('test-key');
  });

  it('retries one rate limit response and reports the recovered attempt', async () => {
    vi.useFakeTimers();
    const { complete, getLlmProviderObservabilitySnapshot } = await modules();
    mocks.fetch
      .mockResolvedValueOnce(response(429, { error: { message: 'rate limited' } }, 'Too Many Requests'))
      .mockResolvedValueOnce(response(200, { content: [{ type: 'text', text: 'Recovered' }] }));

    const pending = complete(INPUT);
    await vi.advanceTimersByTimeAsync(250);
    await expect(pending).resolves.toMatchObject({ text: 'Recovered' });
    expect(mocks.fetch).toHaveBeenCalledTimes(2);
    expect(getLlmProviderObservabilitySnapshot()).toMatchObject({
      state: 'healthy',
      counters: { requests: 1, attempts: 2, successes: 1, failures: 0, retries: 1 },
    });
  });

  it('retries one transport failure then reports an exhausted transient 503 safely', async () => {
    vi.useFakeTimers();
    const { complete, AnthropicError, getLlmProviderObservabilitySnapshot } = await modules();
    mocks.fetch
      .mockRejectedValueOnce(new Error('private socket detail'))
      .mockResolvedValueOnce(response(503, 'private upstream outage body', 'Unavailable'));

    const pending = complete(INPUT);
    const assertion = expect(pending).rejects.toBeInstanceOf(AnthropicError);
    await vi.advanceTimersByTimeAsync(250);
    await assertion;

    expect(mocks.fetch).toHaveBeenCalledTimes(2);
    const snapshot = getLlmProviderObservabilitySnapshot();
    expect(snapshot).toMatchObject({
      state: 'degraded',
      counters: { requests: 1, attempts: 2, failures: 1, retries: 1 },
      lastFailure: { kind: 'upstream_5xx', status: 503, attempts: 2, retryable: true },
    });
    expect(JSON.stringify(snapshot)).not.toContain('private socket detail');
    expect(JSON.stringify(snapshot)).not.toContain('private upstream outage body');
  });

  it('does not retry malformed successful responses', async () => {
    const { complete, AnthropicError, getLlmProviderObservabilitySnapshot } = await modules();
    mocks.fetch.mockResolvedValueOnce(response(200, 'not-json'));

    await expect(complete(INPUT)).rejects.toBeInstanceOf(AnthropicError);

    expect(mocks.fetch).toHaveBeenCalledTimes(1);
    expect(getLlmProviderObservabilitySnapshot()).toMatchObject({
      counters: { attempts: 1, failures: 1, retries: 0 },
      lastFailure: { kind: 'malformed_response', status: 200, retryable: false },
    });
  });

  it('does not retry a permanent 400 and reports only safe failure metadata', async () => {
    const { complete, AnthropicError, getLlmProviderObservabilitySnapshot } = await modules();
    mocks.fetch.mockResolvedValueOnce(response(400, 'secret upstream body', 'Bad Request'));

    await expect(complete(INPUT)).rejects.toBeInstanceOf(AnthropicError);

    expect(mocks.fetch).toHaveBeenCalledTimes(1);
    const snapshot = getLlmProviderObservabilitySnapshot();
    expect(snapshot).toMatchObject({
      state: 'degraded',
      counters: { requests: 1, attempts: 1, failures: 1, retries: 0 },
      lastFailure: { kind: 'upstream_4xx', status: 400, attempts: 1, retryable: false },
    });
    expect(JSON.stringify(snapshot)).not.toContain('secret upstream body');
  });

  it('reports deterministic fallback degradation by template id only', async () => {
    const { recordLlmProviderDegradation, getLlmProviderObservabilitySnapshot } = await modules();
    recordLlmProviderDegradation('ivory_wdyk_coach', '2026-07-14T00:00:00.000Z');

    expect(getLlmProviderObservabilitySnapshot()).toMatchObject({
      state: 'degraded',
      counters: { degradations: 1 },
      lastDegradation: {
        templateId: 'ivory_wdyk_coach',
        reason: 'deterministic_fallback',
      },
    });
  });
});
