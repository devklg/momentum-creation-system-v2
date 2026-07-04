import { describe, expect, it } from 'vitest';
import {
  VoiceboxConfigError,
  VoiceboxError,
  createVoiceboxClient,
} from '../voicebox.js';

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    statusText: 'OK',
    headers: { 'content-type': 'application/json' },
    ...init,
  });
}

describe('VoiceBox client', () => {
  it('posts generation requests to /generate with the VoiceBox client id header', async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const fetchImpl = (async (url, init) => {
      calls.push({ url: String(url), init: init ?? {} });
      return jsonResponse({
        id: 'gen_1',
        profile_id: 'profile_michael',
        text: 'Keep going.',
        language: 'en',
        audio_path: '/tmp/gen_1.wav',
        duration: 1.25,
        status: 'completed',
        error: null,
        created_at: '2026-07-04T00:00:00.000Z',
      });
    }) as typeof fetch;

    const client = createVoiceboxClient({
      baseUrl: 'http://voicebox.local/',
      clientId: 'mcs-test',
      timeoutMs: 1000,
      fetchImpl,
    });

    const result = await client.generateSpeech({
      profileId: 'profile_michael',
      text: 'Keep going.',
      language: 'en',
      engine: 'qwen',
      personality: false,
    });

    expect(result.id).toBe('gen_1');
    expect(client.audioUrl(result.id)).toBe('http://voicebox.local/audio/gen_1');
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe('http://voicebox.local/generate');
    expect(new Headers(calls[0]?.init.headers).get('X-Voicebox-Client-Id')).toBe('mcs-test');
    expect(JSON.parse(String(calls[0]?.init.body))).toEqual({
      profile_id: 'profile_michael',
      text: 'Keep going.',
      language: 'en',
      engine: 'qwen',
      personality: false,
    });
  });

  it('fails fast when required generation input is missing', async () => {
    const client = createVoiceboxClient({
      baseUrl: 'http://voicebox.local',
      clientId: 'mcs-test',
      fetchImpl: (async () => jsonResponse({})) as typeof fetch,
    });

    await expect(
      client.generateSpeech({ profileId: '', text: 'Hello', language: 'en' }),
    ).rejects.toBeInstanceOf(VoiceboxConfigError);
    await expect(
      client.generateSpeech({ profileId: 'profile', text: ' ', language: 'en' }),
    ).rejects.toBeInstanceOf(VoiceboxConfigError);
  });

  it('wraps non-2xx VoiceBox responses', async () => {
    const client = createVoiceboxClient({
      baseUrl: 'http://voicebox.local',
      clientId: 'mcs-test',
      fetchImpl: (async () =>
        new Response('nope', { status: 503, statusText: 'Unavailable' })) as typeof fetch,
    });

    await expect(
      client.generateSpeech({ profileId: 'profile', text: 'Hello', language: 'en' }),
    ).rejects.toMatchObject({ status: 503 });
    await expect(
      client.generateSpeech({ profileId: 'profile', text: 'Hello', language: 'en' }),
    ).rejects.toBeInstanceOf(VoiceboxError);
  });
});
