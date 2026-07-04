import { describe, expect, it } from 'vitest';
import type { VoiceboxClient } from '../../../services/voicebox.js';
import {
  resolveVoiceboxAgentProfile,
  synthesizeAgentVoice,
} from '../voiceboxRuntime.js';

const generation = {
  id: 'gen_voice_1',
  profileId: 'profile_michael',
  text: 'Here is your next training step.',
  language: 'en',
  audioPath: '/tmp/gen_voice_1.wav',
  duration: 2.4,
  status: 'completed',
  error: null,
  createdAt: '2026-07-04T00:00:00.000Z',
};

describe('VoiceBox runtime adapter', () => {
  it('resolves agent profile mappings by agent key', () => {
    expect(resolveVoiceboxAgentProfile('michael_magnificent', {
      michael_magnificent: ' profile_michael ',
    })).toBe('profile_michael');
    expect(resolveVoiceboxAgentProfile('ivory', {
      michael_magnificent: 'profile_michael',
    })).toBeNull();
  });

  it('fails closed while the VoiceBox runtime flag is disabled', async () => {
    const result = await synthesizeAgentVoice({
      agentKey: 'michael_magnificent',
      text: 'Hello',
      language: 'en',
    }, {
      enabled: false,
      profiles: { michael_magnificent: 'profile_michael' },
    });

    expect(result).toMatchObject({
      ok: false,
      reason: 'voicebox_disabled',
      provider: 'voicebox',
      transport: 'browser_audio',
    });
  });

  it('requires a mapped VoiceBox profile before synthesis', async () => {
    const result = await synthesizeAgentVoice({
      agentKey: 'ivory',
      text: 'Hello',
      language: 'en',
    }, {
      enabled: true,
      profiles: { michael_magnificent: 'profile_michael' },
    });

    expect(result).toMatchObject({ ok: false, reason: 'profile_unmapped' });
  });

  it('generates browser audio through the injected VoiceBox client', async () => {
    const calls: unknown[] = [];
    const client: VoiceboxClient = {
      async generateSpeech(input) {
        calls.push(input);
        return generation;
      },
      async listProfiles() {
        return [];
      },
      audioUrl(id) {
        return `http://voicebox.local/audio/${id}`;
      },
    };

    const result = await synthesizeAgentVoice({
      agentKey: 'michael_magnificent',
      text: 'Here is your next training step.',
      language: 'en',
      personality: false,
    }, {
      enabled: true,
      profiles: { michael_magnificent: 'profile_michael' },
      client,
    });

    expect(result).toMatchObject({
      ok: true,
      generationId: 'gen_voice_1',
      audioUrl: 'http://voicebox.local/audio/gen_voice_1',
      provider: 'voicebox',
      transport: 'browser_audio',
    });
    expect(calls).toEqual([{
      profileId: 'profile_michael',
      text: 'Here is your next training step.',
      language: 'en',
      personality: false,
    }]);
  });
});
