/**
 * VoiceBox HTTP transport.
 *
 * Thin server-side client for the local/self-hosted VoiceBox backend. This is
 * the production-shaped app runtime edge: it calls VoiceBox directly over HTTP
 * and does not go through the external Universal Gateway or MCP tooling.
 */

import { fetch as undiciFetch } from 'undici';
import { env } from '../env.js';

export type VoiceboxEngine =
  | 'qwen'
  | 'qwen_custom_voice'
  | 'luxtts'
  | 'chatterbox'
  | 'chatterbox_turbo'
  | 'tada'
  | 'kokoro';

export type VoiceboxLanguage =
  | 'en'
  | 'es'
  | 'zh'
  | 'ja'
  | 'ko'
  | 'de'
  | 'fr'
  | 'ru'
  | 'pt'
  | 'it'
  | 'he'
  | 'ar'
  | 'da'
  | 'el'
  | 'fi'
  | 'hi'
  | 'ms'
  | 'nl'
  | 'no'
  | 'pl'
  | 'sv'
  | 'sw'
  | 'tr';

export interface VoiceboxGenerateSpeechInput {
  profileId: string;
  text: string;
  language: VoiceboxLanguage;
  engine?: VoiceboxEngine;
  personality?: boolean;
  instruct?: string | null;
  modelSize?: '1.7B' | '0.6B' | '1B' | '3B' | null;
  seed?: number | null;
}

export interface VoiceboxGenerationResult {
  id: string;
  profileId: string;
  text: string;
  language: VoiceboxLanguage | string;
  audioPath: string | null;
  duration: number | null;
  status: string;
  error: string | null;
  createdAt: string;
}

export interface VoiceboxProfileSummary {
  id: string;
  name: string;
}

export interface VoiceboxClientOptions {
  baseUrl?: string;
  clientId?: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

export interface VoiceboxClient {
  generateSpeech(input: VoiceboxGenerateSpeechInput): Promise<VoiceboxGenerationResult>;
  listProfiles(): Promise<VoiceboxProfileSummary[]>;
  audioUrl(generationId: string): string;
}

export class VoiceboxConfigError extends Error {
  constructor(message: string) {
    super(`[voicebox] ${message}`);
    this.name = 'VoiceboxConfigError';
  }
}

export class VoiceboxError extends Error {
  constructor(
    public readonly status: number,
    public readonly upstreamBody: string,
    message: string,
  ) {
    super(`[voicebox] ${message}`);
    this.name = 'VoiceboxError';
  }
}

export function createVoiceboxClient(options: VoiceboxClientOptions = {}): VoiceboxClient {
  const baseUrl = normalizeBaseUrl(options.baseUrl ?? env.VOICEBOX_BASE_URL);
  const clientId = options.clientId ?? env.VOICEBOX_CLIENT_ID;
  const timeoutMs = options.timeoutMs ?? env.VOICEBOX_REQUEST_TIMEOUT_MS;
  const fetchImpl = options.fetchImpl ?? (undiciFetch as unknown as typeof fetch);

  if (!clientId.trim()) {
    throw new VoiceboxConfigError('VOICEBOX_CLIENT_ID must not be empty.');
  }

  return {
    async generateSpeech(input) {
      const profileId = input.profileId.trim();
      const text = input.text.trim();
      if (!profileId) throw new VoiceboxConfigError('profileId is required.');
      if (!text) throw new VoiceboxConfigError('text is required.');

      const body = {
        profile_id: profileId,
        text,
        language: input.language,
        ...(input.engine ? { engine: input.engine } : {}),
        ...(input.personality !== undefined ? { personality: input.personality } : {}),
        ...(input.instruct !== undefined ? { instruct: input.instruct } : {}),
        ...(input.modelSize !== undefined ? { model_size: input.modelSize } : {}),
        ...(input.seed !== undefined ? { seed: input.seed } : {}),
      };

      const parsed = await requestJson<VoiceboxGenerationApiResponse>({
        fetchImpl,
        timeoutMs,
        url: `${baseUrl}/generate`,
        clientId,
        init: {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(body),
        },
      });

      return normalizeGenerationResponse(parsed);
    },

    async listProfiles() {
      const parsed = await requestJson<unknown>({
        fetchImpl,
        timeoutMs,
        url: `${baseUrl}/profiles`,
        clientId,
        init: { method: 'GET' },
      });
      return normalizeProfiles(parsed);
    },

    audioUrl(generationId) {
      const id = generationId.trim();
      if (!id) throw new VoiceboxConfigError('generationId is required.');
      return `${baseUrl}/audio/${encodeURIComponent(id)}`;
    },
  };
}

export const voiceboxClient = createVoiceboxClient();

interface RequestJsonInput {
  fetchImpl: typeof fetch;
  timeoutMs: number;
  url: string;
  clientId: string;
  init: RequestInit;
}

async function requestJson<T>(input: RequestJsonInput): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), input.timeoutMs);
  try {
    const headers = new Headers(input.init.headers);
    headers.set('X-Voicebox-Client-Id', input.clientId);

    const res = await input.fetchImpl(input.url, {
      ...input.init,
      headers,
      signal: controller.signal,
    });
    const raw = await res.text();

    if (!res.ok) {
      throw new VoiceboxError(
        res.status,
        raw,
        `request failed: HTTP ${res.status} ${res.statusText}`,
      );
    }

    try {
      return JSON.parse(raw) as T;
    } catch {
      throw new VoiceboxError(res.status, raw, 'response was not JSON');
    }
  } catch (error) {
    if (error instanceof VoiceboxError) throw error;
    if (error instanceof Error && error.name === 'AbortError') {
      throw new VoiceboxError(0, '', `request timed out after ${input.timeoutMs}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

interface VoiceboxGenerationApiResponse {
  id?: unknown;
  profile_id?: unknown;
  text?: unknown;
  language?: unknown;
  audio_path?: unknown;
  duration?: unknown;
  status?: unknown;
  error?: unknown;
  created_at?: unknown;
}

function normalizeGenerationResponse(raw: VoiceboxGenerationApiResponse): VoiceboxGenerationResult {
  if (!raw || typeof raw !== 'object') {
    throw new VoiceboxError(200, JSON.stringify(raw), 'generation response was not an object');
  }
  const id = stringField(raw.id);
  const profileId = stringField(raw.profile_id);
  const text = stringField(raw.text);
  const language = stringField(raw.language);
  const createdAt = stringField(raw.created_at);

  if (!id || !profileId || !text || !language || !createdAt) {
    throw new VoiceboxError(200, JSON.stringify(raw), 'generation response missing required fields');
  }

  return {
    id,
    profileId,
    text,
    language,
    audioPath: nullableString(raw.audio_path),
    duration: typeof raw.duration === 'number' ? raw.duration : null,
    status: stringField(raw.status) || 'completed',
    error: nullableString(raw.error),
    createdAt,
  };
}

function normalizeProfiles(raw: unknown): VoiceboxProfileSummary[] {
  const rows = Array.isArray(raw)
    ? raw
    : isRecord(raw) && Array.isArray(raw.profiles)
      ? raw.profiles
      : [];

  return rows.flatMap((row) => {
    if (!isRecord(row)) return [];
    const id = stringField(row.id);
    const name = stringField(row.name);
    return id && name ? [{ id, name }] : [];
  });
}

function normalizeBaseUrl(value: string): string {
  const trimmed = value.trim().replace(/\/+$/, '');
  if (!trimmed) throw new VoiceboxConfigError('VOICEBOX_BASE_URL must not be empty.');
  return trimmed;
}

function stringField(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function nullableString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
