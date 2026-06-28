import type {
  AgentKey,
  BrowserTextTurnWirePayload,
  BrowserTranscriptTurn,
  BrowserVoiceAgentTurnWirePayload,
  RuntimeLanguage,
} from '@momentum/shared/runtime';
import {
  createRuntimeEventEnvelope,
} from '../events/index.js';
import type {
  BrowserRuntimeEventEnvelope,
  BrowserRuntimeEventEnvelopeInput,
  BrowserVoiceTextSessionFoundation,
  BrowserVoiceTextValidationCode,
  BrowserVoiceTextValidationIssue,
  BrowserVoiceTextValidationResult,
} from './types.js';

export const BROWSER_RUNTIME_ALLOWED_SURFACE = 'apps/team' as const;
export const BROWSER_RUNTIME_SUPPORTED_LANGUAGES = ['en', 'es'] as const satisfies readonly RuntimeLanguage[];
export const BROWSER_RUNTIME_AGENT_KEYS = [
  'steve_success',
  'michael_magnificent',
  'ivory',
] as const satisfies readonly AgentKey[];

export const BROWSER_RUNTIME_MODES = ['browser_voice', 'browser_text', 'mixed'] as const;
export const TEXT_FALLBACK_REQUIRED = true as const;
export const MICROPHONE_PERMISSION_POLICY = 'after_explicit_ba_action_only' as const;
export const INTERNAL_BROWSER_RUNTIME_EVENT_SOURCES = [
  'browser_voice_runtime',
  'browser_text_runtime',
] as const;

export const speechLanguageMap = {
  en: ['en-US'],
  es: ['es-US', 'es-MX', 'es-ES'],
} as const satisfies Record<RuntimeLanguage, readonly string[]>;

export function assertBrowserVoiceTextSessionFoundation(
  candidate: unknown,
): asserts candidate is BrowserVoiceTextSessionFoundation {
  const result = validateBrowserVoiceTextSessionFoundation(candidate);
  if (!result.ok) {
    const detail = result.errors.map((error) => `${error.path}: ${error.message}`).join('; ');
    throw new BrowserVoiceTextValidationError(`Invalid browser voice/text foundation: ${detail}`, result.errors);
  }
}

export function validateBrowserVoiceTextSessionFoundation(
  candidate: unknown,
): BrowserVoiceTextValidationResult<BrowserVoiceTextSessionFoundation> {
  const errors: BrowserVoiceTextValidationIssue[] = [];

  if (!isRecord(candidate)) {
    return {
      ok: false,
      errors: [
        {
          path: '$',
          code: 'invalid_scope',
          message: 'Browser Voice/Text session foundation must be an object.',
        },
      ],
    };
  }

  requireString(candidate, 'tenantId', errors);
  requireString(candidate, 'teamId', errors);
  requireString(candidate, 'baId', errors);
  requireString(candidate, 'sessionId', errors);

  if (candidate.teamKey !== 'team_magnificent') {
    errors.push(error('teamKey', 'invalid_scope', 'teamKey must be team_magnificent.'));
  }

  if (candidate.teamName !== 'Team Magnificent') {
    errors.push(error('teamName', 'invalid_scope', 'teamName must be Team Magnificent.'));
  }

  if (!BROWSER_RUNTIME_AGENT_KEYS.includes(candidate.agentKey as AgentKey)) {
    errors.push(error('agentKey', 'invalid_agent', 'agentKey must be a semantic runtime registry identity.'));
  }

  if (!BROWSER_RUNTIME_SUPPORTED_LANGUAGES.includes(candidate.language as RuntimeLanguage)) {
    errors.push(error('language', 'invalid_language', 'language must be en or es.'));
  }

  if (!BROWSER_RUNTIME_MODES.includes(candidate.mode as (typeof BROWSER_RUNTIME_MODES)[number])) {
    errors.push(error('mode', 'invalid_mode', 'mode must be browser_voice, browser_text, or mixed.'));
  }

  if (candidate.textFallbackRequired !== TEXT_FALLBACK_REQUIRED) {
    errors.push(error('textFallbackRequired', 'text_fallback_required', 'Text fallback must be required.'));
  }

  if (candidate.microphonePermissionMayBeRequested !== MICROPHONE_PERMISSION_POLICY) {
    errors.push(error('microphonePermissionMayBeRequested', 'permission_after_action_required', 'Microphone permission may be requested only after explicit BA action.'));
  }

  if (candidate.internalRuntimeOnly !== true) {
    errors.push(error('internalRuntimeOnly', 'external_telephony_forbidden', 'Browser Voice/Text foundation is internal .team runtime only.'));
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return { ok: true, value: candidate as unknown as BrowserVoiceTextSessionFoundation, errors: [] };
}

export function createBrowserTextFallbackTurn(
  session: BrowserVoiceTextSessionFoundation,
  text: string,
): BrowserTextTurnWirePayload {
  assertBrowserVoiceTextSessionFoundation(session);
  if (text.trim().length === 0) {
    throw new BrowserVoiceTextValidationError('Text fallback turn requires text.', [
      error('text', 'transcript_invalid', 'Text fallback turn requires text.'),
    ]);
  }

  return {
    tenantId: session.tenantId,
    teamId: session.teamId,
    teamKey: session.teamKey,
    teamName: session.teamName,
    baId: session.baId,
    text,
    language: session.language,
    mode: 'browser_text',
  };
}

export function finalizeBrowserVoiceTurn(
  transcript: BrowserTranscriptTurn,
): BrowserVoiceAgentTurnWirePayload {
  const validation = validateBrowserVoiceTranscript(transcript);
  if (!validation.ok) {
    throw new BrowserVoiceTextValidationError('Invalid browser voice transcript.', validation.errors);
  }

  return {
    tenantId: transcript.tenantId,
    teamId: transcript.teamId,
    teamKey: transcript.teamKey,
    teamName: transcript.teamName,
    baId: transcript.baId,
    text: transcript.finalText,
    language: transcript.language,
    mode: 'browser_voice',
    transcriptMetadata: {
      transcriptTurnId: transcript.transcriptTurnId,
      confidence: transcript.confidence,
      isFinal: true,
      browserLocale: transcript.browserLocale,
      transcriptHash: transcript.transcriptHash,
      corrected: transcript.correctedText !== undefined,
    },
    metadata: transcript.metadata,
  };
}

export function createBrowserRuntimeEventEnvelope(
  input: BrowserRuntimeEventEnvelopeInput,
): BrowserRuntimeEventEnvelope {
  const source = input.eventType.startsWith('browser_voice.')
    ? 'browser_voice_runtime'
    : 'browser_text_runtime';

  if (!INTERNAL_BROWSER_RUNTIME_EVENT_SOURCES.includes(source)) {
    throw new BrowserVoiceTextValidationError('Browser runtime event source is invalid.', [
      error('source', 'external_telephony_forbidden', 'Browser runtime events must use internal browser runtime sources.'),
    ]);
  }

  return createRuntimeEventEnvelope({
    tenantId: input.tenantId,
    teamId: input.teamId,
    teamKey: input.teamKey,
    teamName: input.teamName,
    baId: input.baId,
    eventType: input.eventType,
    sessionId: input.sessionId,
    agentKey: input.agentKey,
    correlationId: input.correlationId,
    idempotencyKey: input.idempotencyKey,
    source,
    payload: input.payload,
    occurredAt: input.occurredAt,
    actor: {
      actorType: 'ba',
      actorId: input.baId,
      baId: input.baId,
    },
    provenance: {
      emittedBy: 'browser_voice_text_foundation',
    },
  });
}

export class BrowserVoiceTextValidationError extends Error {
  readonly errors: BrowserVoiceTextValidationIssue[];

  constructor(message: string, errors: BrowserVoiceTextValidationIssue[]) {
    super(message);
    this.name = 'BrowserVoiceTextValidationError';
    this.errors = errors;
  }
}

function validateBrowserVoiceTranscript(
  transcript: BrowserTranscriptTurn,
): BrowserVoiceTextValidationResult<BrowserTranscriptTurn> {
  const sessionResult = validateBrowserVoiceTextSessionFoundation({
    tenantId: transcript.tenantId,
    teamId: transcript.teamId,
    teamKey: transcript.teamKey,
    teamName: transcript.teamName,
    baId: transcript.baId,
    sessionId: transcript.sessionId,
    agentKey: transcript.agentKey,
    language: transcript.language,
    mode: 'browser_voice',
    textFallbackRequired: true,
    microphonePermissionMayBeRequested: MICROPHONE_PERMISSION_POLICY,
    internalRuntimeOnly: true,
  });

  if (!sessionResult.ok) {
    return sessionResult;
  }

  const errors: BrowserVoiceTextValidationIssue[] = [];
  requireString(transcript as unknown as Record<string, unknown>, 'transcriptTurnId', errors);
  requireString(transcript as unknown as Record<string, unknown>, 'finalText', errors);
  requireString(transcript as unknown as Record<string, unknown>, 'transcriptHash', errors);

  if (transcript.inputMode !== 'voice') {
    errors.push(error('inputMode', 'transcript_invalid', 'Voice transcripts must use inputMode voice.'));
  }

  if (transcript.isFinal !== true) {
    errors.push(error('isFinal', 'transcript_invalid', 'Only final transcripts can become agent turns.'));
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return { ok: true, value: transcript, errors: [] };
}

function requireString(
  object: Record<string, unknown>,
  key: string,
  errors: BrowserVoiceTextValidationIssue[],
  path = key,
): void {
  if (typeof object[key] !== 'string' || object[key].trim().length === 0) {
    errors.push(error(path, 'invalid_scope', `${path} is required.`));
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function error(
  path: string,
  code: BrowserVoiceTextValidationCode,
  message: string,
): BrowserVoiceTextValidationIssue {
  return { path, code, message };
}
