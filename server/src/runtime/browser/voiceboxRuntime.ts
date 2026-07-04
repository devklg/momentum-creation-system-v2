/**
 * VoiceBox adapter for internal `.team` browser voice output.
 *
 * This module maps governed runtime agents to VoiceBox profiles and asks the
 * server-side VoiceBox transport to generate browser-playable audio. It is
 * default-off, non-persistent, and never uses Telnyx/PSTN.
 */

import type { McsAgentKey, McsRuntimeLanguage } from '@momentum/shared/runtime';
import { voiceboxRuntimeEnabled } from '../../config/voiceboxRuntimeFlags.js';
import { env } from '../../env.js';
import { voiceboxClient } from '../../services/voicebox.js';
import type {
  VoiceboxClient,
  VoiceboxEngine,
  VoiceboxGenerationResult,
  VoiceboxLanguage,
} from '../../services/voicebox.js';

export interface VoiceboxAgentProfileMap {
  steve_success?: string;
  michael_magnificent?: string;
  ivory?: string;
}

export interface SynthesizeAgentVoiceInput {
  agentKey: McsAgentKey;
  text: string;
  language: McsRuntimeLanguage;
  engine?: VoiceboxEngine;
  personality?: boolean;
  instruct?: string | null;
}

export type SynthesizeAgentVoiceResult =
  | {
      ok: true;
      agentKey: McsAgentKey;
      profileId: string;
      generationId: string;
      audioUrl: string;
      generation: VoiceboxGenerationResult;
      provider: 'voicebox';
      transport: 'browser_audio';
    }
  | {
      ok: false;
      agentKey: McsAgentKey;
      reason:
        | 'voicebox_disabled'
        | 'profile_unmapped'
        | 'empty_text'
        | 'unsupported_language'
        | 'voicebox_error';
      message: string;
      provider: 'voicebox';
      transport: 'browser_audio';
    };

export function voiceboxAgentProfilesFromEnv(): VoiceboxAgentProfileMap {
  return {
    ...(env.VOICEBOX_STEVE_PROFILE_ID.trim()
      ? { steve_success: env.VOICEBOX_STEVE_PROFILE_ID.trim() }
      : {}),
    ...(env.VOICEBOX_MICHAEL_PROFILE_ID.trim()
      ? { michael_magnificent: env.VOICEBOX_MICHAEL_PROFILE_ID.trim() }
      : {}),
    ...(env.VOICEBOX_IVORY_PROFILE_ID.trim()
      ? { ivory: env.VOICEBOX_IVORY_PROFILE_ID.trim() }
      : {}),
  };
}

export function resolveVoiceboxAgentProfile(
  agentKey: McsAgentKey,
  profiles: VoiceboxAgentProfileMap = voiceboxAgentProfilesFromEnv(),
): string | null {
  return profiles[agentKey]?.trim() || null;
}

export async function synthesizeAgentVoice(
  input: SynthesizeAgentVoiceInput,
  options: {
    client?: VoiceboxClient;
    profiles?: VoiceboxAgentProfileMap;
    enabled?: boolean;
  } = {},
): Promise<SynthesizeAgentVoiceResult> {
  const enabled = options.enabled ?? voiceboxRuntimeEnabled();
  if (!enabled) {
    return disabled(input.agentKey);
  }

  const text = input.text.trim();
  if (!text) {
    return failure(input.agentKey, 'empty_text', 'VoiceBox synthesis requires non-empty text.');
  }

  const language = toVoiceboxLanguage(input.language);
  if (!language) {
    return failure(
      input.agentKey,
      'unsupported_language',
      `VoiceBox language ${String(input.language)} is not supported for MCS runtime voice.`,
    );
  }

  const profileId = resolveVoiceboxAgentProfile(input.agentKey, options.profiles);
  if (!profileId) {
    return failure(
      input.agentKey,
      'profile_unmapped',
      `No VoiceBox profile is mapped for ${input.agentKey}.`,
    );
  }

  const client = options.client ?? voiceboxClient;
  try {
    const generation = await client.generateSpeech({
      profileId,
      text,
      language,
      ...(input.engine ? { engine: input.engine } : {}),
      ...(input.personality !== undefined ? { personality: input.personality } : {}),
      ...(input.instruct !== undefined ? { instruct: input.instruct } : {}),
    });

    return {
      ok: true,
      agentKey: input.agentKey,
      profileId,
      generationId: generation.id,
      audioUrl: client.audioUrl(generation.id),
      generation,
      provider: 'voicebox',
      transport: 'browser_audio',
    };
  } catch (error) {
    return failure(
      input.agentKey,
      'voicebox_error',
      error instanceof Error ? error.message : String(error),
    );
  }
}

function toVoiceboxLanguage(language: McsRuntimeLanguage): VoiceboxLanguage | null {
  if (language === 'en' || language === 'es') return language;
  return null;
}

function disabled(agentKey: McsAgentKey): SynthesizeAgentVoiceResult {
  return failure(
    agentKey,
    'voicebox_disabled',
    'VoiceBox runtime is disabled. Set VOICEBOX_RUNTIME_ENABLED=true to enable internal browser audio generation.',
  );
}

function failure(
  agentKey: McsAgentKey,
  reason: Extract<SynthesizeAgentVoiceResult, { ok: false }>['reason'],
  message: string,
): SynthesizeAgentVoiceResult {
  return {
    ok: false,
    agentKey,
    reason,
    message,
    provider: 'voicebox',
    transport: 'browser_audio',
  };
}
