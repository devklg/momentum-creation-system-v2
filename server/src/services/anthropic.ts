/**
 * Anthropic Messages API transport (Chat #122).
 *
 * Single responsibility: send one Messages request and return the assistant's
 * text. Mirrors the shape of services/resend.ts and services/telnyx.ts — a
 * thin transport with two error types (Config + transport) and one bounded
 * transient retry. Callers treat a final throw as a soft failure on the LLM-optional surfaces
 * (ScriptMaker / Ivory): if the draft can't be generated, the BA still has
 * the manual compose form.
 *
 * DIRECT API by design (Chat #118): the external MCP tool server has no LLM
 * connector, so the invitation front doors call Anthropic directly rather
 * than through the PERSISTENCE. Persistence still goes through the PERSISTENCE; only
 * the text generation is direct.
 *
 * DORMANT BY DESIGN, mirroring resend.ts: until ANTHROPIC_API_KEY is set,
 * complete() throws AnthropicConfigError; the caller catches it and surfaces
 * the manual path. The day the key lands in .env, drafts begin — no code
 * change (Chat #120 correction: Kevin HAS the key; it needs wiring into the
 * running process env).
 *
 * Per Anthropic Messages API (POST https://api.anthropic.com/v1/messages):
 *   Required headers: x-api-key, anthropic-version, content-type
 *   Required body: model, max_tokens, messages
 *   Optional: system (array of blocks; we attach cache_control to the stable
 *             prefix for prompt-caching — Chat #118 cost lock)
 *   2xx returns { content: [{ type:'text', text }], ... }.
 *   4xx/5xx returns { error: { type, message } }.
 */

import { fetch } from 'undici';
import { env } from '../env.js';
import {
  recordLlmProviderAttempt,
  recordLlmProviderFailure,
  recordLlmProviderRequest,
  recordLlmProviderRetry,
  recordLlmProviderSuccess,
  type LlmProviderErrorKind,
} from './llmProviderObservability.js';

export class AnthropicError extends Error {
  constructor(
    public readonly status: number,
    public readonly upstreamBody: string,
    message: string,
    public readonly kind: LlmProviderErrorKind = classifyErrorKind(status),
    public readonly retryable: boolean = retryableStatus(status),
  ) {
    super(`[anthropic] ${message}`);
    this.name = 'AnthropicError';
  }
}

export class AnthropicConfigError extends Error {
  constructor() {
    super(
      '[anthropic] missing ANTHROPIC_API_KEY. Set it in .env ' +
        '(console.anthropic.com > API Keys) before generating drafts. ' +
        'Until then the LLM front doors fall back to the manual compose form.',
    );
    this.name = 'AnthropicConfigError';
  }
}

function assertAnthropicConfig(): void {
  if (!env.ANTHROPIC_API_KEY) throw new AnthropicConfigError();
}

export interface AnthropicMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface CompleteInput {
  /**
   * The stable, reusable instruction prefix (role + compliance rules +
   * product context). Attached as a cache_control system block so repeated
   * calls with the same prefix hit the prompt cache (Chat #118: ~90% off the
   * stable prefix). Keep everything that does NOT vary per-prospect here.
   */
  system: string;
  /** The per-call conversation. Usually a single user turn with the ask. */
  messages: AnthropicMessage[];
  /** Cap on generated tokens. Drafts are short; default 1024. */
  maxTokens?: number;
  /**
   * Optional model override. Defaults to env.ANTHROPIC_MODEL (Haiku 4.5).
   * Lets a caller A/B against Sonnet without an env change.
   */
  model?: string;
}

export interface CompleteResult {
  /** Concatenated text from all text blocks in the response. */
  text: string;
  model: string;
  /** Token usage for cost tracking / aggregation in /admin later. */
  usage: { inputTokens: number; outputTokens: number };
}

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';
const MAX_ATTEMPTS = 2;
const RETRY_DELAY_MS = 250;

interface AnthropicApiResponse {
  content?: Array<{ type: string; text?: string }>;
  model?: string;
  usage?: { input_tokens?: number; output_tokens?: number };
  error?: { type?: string; message?: string };
}

function retryableStatus(status: number): boolean {
  return status === 0 || status === 408 || status === 429 || status >= 500;
}

function classifyErrorKind(status: number): LlmProviderErrorKind {
  if (status === 0) return 'transport';
  if (status === 429) return 'rate_limit';
  if (status >= 500) return 'upstream_5xx';
  return 'upstream_4xx';
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function requestOnce(input: CompleteInput, model: string): Promise<CompleteResult> {
  const body = {
    model,
    max_tokens: input.maxTokens ?? 1024,
    system: [
      {
        type: 'text',
        text: input.system,
        cache_control: { type: 'ephemeral' },
      },
    ],
    messages: input.messages.map((m) => ({ role: m.role, content: m.content })),
  };

  let res: Awaited<ReturnType<typeof fetch>>;
  try {
    res = await fetch(ANTHROPIC_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': env.ANTHROPIC_API_KEY,
        'anthropic-version': ANTHROPIC_VERSION,
        'anthropic-beta': 'prompt-caching-2024-07-31',
      },
      body: JSON.stringify(body),
    });
  } catch {
    throw new AnthropicError(0, '', 'transport request failed', 'transport', true);
  }

  const raw = await res.text();
  if (!res.ok) {
    throw new AnthropicError(
      res.status,
      raw,
      `request failed: HTTP ${res.status} ${res.statusText}`,
    );
  }

  let parsed: AnthropicApiResponse;
  try {
    parsed = JSON.parse(raw) as AnthropicApiResponse;
  } catch {
    throw new AnthropicError(res.status, raw, 'response was not JSON', 'malformed_response', false);
  }

  if (parsed.error) {
    throw new AnthropicError(
      res.status,
      raw,
      parsed.error.message ?? 'API returned an error',
    );
  }

  const text = (parsed.content ?? [])
    .filter((b) => b.type === 'text' && typeof b.text === 'string')
    .map((b) => b.text as string)
    .join('')
    .trim();

  if (!text) {
    throw new AnthropicError(res.status, raw, 'response contained no text', 'empty_response', false);
  }

  return {
    text,
    model: parsed.model ?? model,
    usage: {
      inputTokens: parsed.usage?.input_tokens ?? 0,
      outputTokens: parsed.usage?.output_tokens ?? 0,
    },
  };
}

/**
 * Send one Messages request and return the assistant's text.
 *
 * Throws AnthropicConfigError if the key is unset (dormant state today).
 * Throws AnthropicError on a non-2xx response or a malformed body. Callers
 * MUST wrap in try/catch and degrade to the manual path on any throw — never
 * fail the BA's flow because a draft couldn't be generated.
 */
export async function complete(input: CompleteInput): Promise<CompleteResult> {
  const model = input.model ?? env.ANTHROPIC_MODEL;
  recordLlmProviderRequest();
  try {
    assertAnthropicConfig();
  } catch (err) {
    recordLlmProviderFailure({
      kind: 'config',
      status: null,
      model,
      attempts: 0,
      retryable: false,
    });
    throw err;
  }

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    recordLlmProviderAttempt();
    try {
      const result = await requestOnce(input, model);
      recordLlmProviderSuccess();
      return result;
    } catch (err) {
      const providerError = err instanceof AnthropicError
        ? err
        : new AnthropicError(0, '', 'transport request failed', 'transport', true);
      if (providerError.retryable && attempt < MAX_ATTEMPTS) {
        recordLlmProviderRetry();
        await wait(RETRY_DELAY_MS);
        continue;
      }
      recordLlmProviderFailure({
        kind: providerError.kind,
        status: providerError.status || null,
        model,
        attempts: attempt,
        retryable: providerError.retryable,
      });
      throw providerError;
    }
  }

  throw new Error('Anthropic retry loop exhausted unexpectedly');
}
