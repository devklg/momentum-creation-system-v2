import { createHash } from 'node:crypto';
import type {
  AgentEventType,
  AgentKey,
  TmagId,
  BrowserInterimTranscript,
  BrowserRuntimeSessionScope,
  BrowserSpeechLocale,
  BrowserTextTurnWirePayload,
  BrowserTranscriptTurn,
  BrowserVoiceAgentTurnWirePayload,
  BrowserVoiceState,
  ContextPacketId,
  ContextPacketV1,
  CorrelationId,
  IdempotencyKey,
  RuntimeLanguage,
  RuntimeMode,
  RuntimeResponseId,
  RuntimeTurnId,
  SessionId,
  TranscriptTurnId,
} from '@momentum/shared/runtime';
import {
  TEAM_MAGNIFICENT_KEY,
  TEAM_MAGNIFICENT_NAME,
  createRuntimeEventEnvelope,
  type RuntimeAgentEventEnvelope,
  type RuntimeEventClock,
} from '../events/index.js';
import type {
  BrowserRuntimeEventEnvelope,
  BrowserRuntimeEventEnvelopeInput,
  BrowserVoiceTextSessionFoundation,
  BrowserVoiceTextValidationCode,
  BrowserVoiceTextValidationIssue,
  BrowserVoiceTextValidationResult,
} from './types.js';

export const BROWSER_RUNTIME_SURFACE = 'team' as const;
export const BROWSER_RUNTIME_ALLOWED_SURFACE = 'apps/team' as const;
export const TEXT_FALLBACK_REQUIRED = true as const;
export const SUPPORTED_BROWSER_RUNTIME_LANGUAGES = ['en', 'es'] as const satisfies readonly RuntimeLanguage[];
export const BROWSER_RUNTIME_SUPPORTED_LANGUAGES = SUPPORTED_BROWSER_RUNTIME_LANGUAGES;
export const BROWSER_RUNTIME_AGENT_KEYS = [
  'steve_success',
  'michael_magnificent',
  'ivory',
] as const satisfies readonly AgentKey[];
export const BROWSER_RUNTIME_MODES = ['browser_voice', 'browser_text', 'mixed'] as const;
export const MICROPHONE_PERMISSION_POLICY = 'after_explicit_ba_action_only' as const;
export const INTERNAL_BROWSER_RUNTIME_EVENT_SOURCES = [
  'browser_voice_runtime',
  'browser_text_runtime',
] as const;
export const BROWSER_SPEECH_LOCALES_BY_LANGUAGE = {
  en: ['en-US'],
  es: ['es-US', 'es-MX', 'es-ES'],
} as const satisfies Record<RuntimeLanguage, readonly BrowserSpeechLocale[]>;
export const speechLanguageMap = BROWSER_SPEECH_LOCALES_BY_LANGUAGE;

export type BrowserRuntimeSurface = typeof BROWSER_RUNTIME_SURFACE;
export type MicrophonePermissionState =
  | 'not_requested'
  | 'checking_capability'
  | 'prompt_required'
  | 'requested'
  | 'granted'
  | 'denied'
  | 'unsupported'
  | 'error';

export interface MicrophonePermissionBoundary {
  state: MicrophonePermissionState;
  requestedAfterUserAction: boolean;
  canRequestPermission: boolean;
  canListen: boolean;
  textFallbackAvailable: true;
  reason?: string;
}

export interface BrowserRuntimeLanguageSelection {
  language: RuntimeLanguage;
  recognitionLocales: readonly BrowserSpeechLocale[];
  synthesisLocales: readonly BrowserSpeechLocale[];
  selectedLocale: BrowserSpeechLocale;
  textFallbackAvailable: true;
}

export interface BrowserRuntimeSessionIdentity extends BrowserRuntimeSessionScope {
  surface: BrowserRuntimeSurface;
  textFallbackAvailable: true;
  microphonePermission: MicrophonePermissionBoundary;
  correlationId: CorrelationId;
  currentState?: string;
}

export interface BrowserContextPacketHandoff {
  packetId: ContextPacketId;
  status: ContextPacketV1['packetStatus'];
  contextPacket: ContextPacketV1;
  sessionId: SessionId;
  agentKey: AgentKey;
  language: RuntimeLanguage;
  mode: RuntimeMode;
  tmagId: TmagId;
}

export interface BrowserTextTurn {
  kind: 'text_turn';
  turnId: RuntimeTurnId;
  session: BrowserRuntimeSessionIdentity;
  textPayload: BrowserTextTurnWirePayload;
  context: BrowserContextPacketHandoff;
  submittedAt: string;
}

export interface BrowserVoiceTranscriptTurn {
  kind: 'voice_transcript_turn';
  session: BrowserRuntimeSessionIdentity;
  transcript: BrowserTranscriptTurn;
  voicePayload: BrowserVoiceAgentTurnWirePayload;
  context: BrowserContextPacketHandoff;
}

export interface BrowserInterimTranscriptTurn {
  kind: 'interim_transcript';
  session: BrowserRuntimeSessionIdentity;
  transcript: BrowserInterimTranscript;
  voiceState: Extract<BrowserVoiceState, 'listening' | 'processing' | 'text_fallback'>;
}

export interface BrowserAgentResponseTurn {
  kind: 'agent_response_turn';
  responseId: RuntimeResponseId;
  session: BrowserRuntimeSessionIdentity;
  contextPacketId: ContextPacketId;
  text: string;
  outputMode: 'text' | 'voice_text';
  language: RuntimeLanguage;
  textFallbackAvailable: true;
  receivedAt: string;
  suggestedActionIds?: readonly string[];
}

export interface BrowserRuntimeEventInput<TPayload extends Record<string, unknown>> {
  session: BrowserRuntimeSessionIdentity;
  eventType: Extract<AgentEventType, `browser_voice.${string}` | `browser_text.${string}`>;
  idempotencyKey: IdempotencyKey;
  payload: TPayload;
  occurredAt?: string;
  clock?: RuntimeEventClock;
  contextPacketId?: ContextPacketId;
}

export class BrowserVoiceTextBoundaryError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'BrowserVoiceTextBoundaryError';
    this.code = code;
  }
}

export class BrowserVoiceTextValidationError extends Error {
  readonly errors: BrowserVoiceTextValidationIssue[];

  constructor(message: string, errors: BrowserVoiceTextValidationIssue[]) {
    super(message);
    this.name = 'BrowserVoiceTextValidationError';
    this.errors = errors;
  }
}

export function assertBrowserVoiceTextSessionFoundation(
  candidate: unknown,
): asserts candidate is BrowserVoiceTextSessionFoundation {
  const result = validateBrowserVoiceTextSessionFoundation(candidate);
  if (!result.ok) {
    const detail = result.errors.map((issue) => `${issue.path}: ${issue.message}`).join('; ');
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
  requireString(candidate, 'tmagId', errors);
  requireString(candidate, 'sessionId', errors);

  if (candidate.teamKey !== TEAM_MAGNIFICENT_KEY || candidate.teamName !== TEAM_MAGNIFICENT_NAME) {
    errors.push(validationIssue('teamKey', 'invalid_scope', 'Browser runtime requires Team Magnificent scope.'));
  }

  if (!BROWSER_RUNTIME_AGENT_KEYS.includes(candidate.agentKey as AgentKey)) {
    errors.push(validationIssue('agentKey', 'invalid_agent', 'agentKey must be a semantic runtime registry identity.'));
  }

  if (!BROWSER_RUNTIME_SUPPORTED_LANGUAGES.includes(candidate.language as RuntimeLanguage)) {
    errors.push(validationIssue('language', 'invalid_language', 'language must be en or es.'));
  }

  if (!BROWSER_RUNTIME_MODES.includes(candidate.mode as (typeof BROWSER_RUNTIME_MODES)[number])) {
    errors.push(validationIssue('mode', 'invalid_mode', 'mode must be browser_voice, browser_text, or mixed.'));
  }

  if (candidate.textFallbackRequired !== TEXT_FALLBACK_REQUIRED) {
    errors.push(validationIssue('textFallbackRequired', 'text_fallback_required', 'Text fallback must be required.'));
  }

  if (candidate.microphonePermissionMayBeRequested !== MICROPHONE_PERMISSION_POLICY) {
    errors.push(validationIssue(
      'microphonePermissionMayBeRequested',
      'permission_after_action_required',
      'Microphone permission may be requested only after explicit BA action.',
    ));
  }

  if (candidate.internalRuntimeOnly !== true) {
    errors.push(validationIssue(
      'internalRuntimeOnly',
      'external_telephony_forbidden',
      'Browser Voice/Text foundation is internal .team runtime only.',
    ));
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
  return {
    tenantId: session.tenantId,
    teamId: session.teamId,
    teamKey: session.teamKey,
    teamName: session.teamName,
    tmagId: session.tmagId,
    text: normalizeText(text, 'text_turn_empty'),
    language: session.language,
    mode: 'browser_text',
    metadata: {
      surface: BROWSER_RUNTIME_SURFACE,
      sessionId: session.sessionId,
      textFallbackAvailable: TEXT_FALLBACK_REQUIRED,
    },
  };
}

export function finalizeBrowserVoiceTurn(
  transcript: BrowserTranscriptTurn,
): BrowserVoiceAgentTurnWirePayload {
  const result = validateBrowserVoiceTranscript(transcript);
  if (!result.ok) {
    throw new BrowserVoiceTextValidationError('Invalid browser voice transcript.', result.errors);
  }

  const corrected = transcript.correctedText !== undefined && transcript.correctedText !== transcript.originalText;
  return {
    tenantId: transcript.tenantId,
    teamId: transcript.teamId,
    teamKey: transcript.teamKey,
    teamName: transcript.teamName,
    tmagId: transcript.tmagId,
    text: transcript.finalText,
    language: transcript.language,
    mode: 'browser_voice',
    transcriptMetadata: {
      transcriptTurnId: transcript.transcriptTurnId,
      confidence: transcript.confidence,
      isFinal: true,
      browserLocale: transcript.browserLocale,
      transcriptHash: transcript.transcriptHash,
      corrected,
    },
    metadata: transcript.metadata,
  };
}

export function createBrowserRuntimeEventEnvelope(
  input: BrowserRuntimeEventEnvelopeInput,
): BrowserRuntimeEventEnvelope {
  const session = createBrowserRuntimeSessionIdentity({
    tenantId: input.tenantId,
    teamId: input.teamId,
    teamKey: input.teamKey,
    teamName: input.teamName,
    tmagId: input.tmagId,
    sessionId: input.sessionId,
    agentKey: input.agentKey,
    mode: input.eventType.startsWith('browser_text.') ? 'browser_text' : 'browser_voice',
    language: 'en',
    correlationId: input.correlationId,
    microphonePermission: createMicrophonePermissionBoundary({
      state: input.eventType.startsWith('browser_voice.') ? 'granted' : 'not_requested',
      requestedAfterUserAction: input.eventType.startsWith('browser_voice.') ? true : undefined,
    }),
  });

  return createBrowserRuntimeEvent({
    session,
    eventType: input.eventType as Extract<AgentEventType, `browser_voice.${string}` | `browser_text.${string}`>,
    idempotencyKey: input.idempotencyKey,
    payload: input.payload,
    occurredAt: input.occurredAt,
  });
}

export function createMicrophonePermissionBoundary(input: {
  state: MicrophonePermissionState;
  requestedAfterUserAction?: boolean;
  reason?: string;
}): MicrophonePermissionBoundary {
  const requestedAfterUserAction = input.requestedAfterUserAction === true;
  const permissionRequested =
    input.state === 'requested' || input.state === 'granted' || input.state === 'denied';

  if (permissionRequested && !requestedAfterUserAction) {
    throw new BrowserVoiceTextBoundaryError(
      'microphone_permission_requires_user_action',
      'Microphone permission may only be requested after an explicit BA action.',
    );
  }

  return {
    state: input.state,
    requestedAfterUserAction,
    canRequestPermission: input.state === 'prompt_required' || input.state === 'not_requested',
    canListen: input.state === 'granted' && requestedAfterUserAction,
    textFallbackAvailable: TEXT_FALLBACK_REQUIRED,
    reason: input.reason,
  };
}

export function createLanguageSelection(input: {
  language: RuntimeLanguage;
  preferredLocale?: BrowserSpeechLocale;
}): BrowserRuntimeLanguageSelection {
  assertSupportedLanguage(input.language);
  const recognitionLocales = BROWSER_SPEECH_LOCALES_BY_LANGUAGE[input.language];
  const selectedLocale =
    input.preferredLocale && (recognitionLocales as readonly BrowserSpeechLocale[]).includes(input.preferredLocale)
      ? input.preferredLocale
      : recognitionLocales[0];

  if (!selectedLocale) {
    throw new BrowserVoiceTextBoundaryError(
      'language_locale_unavailable',
      'Browser runtime language must resolve to a speech locale.',
    );
  }

  return {
    language: input.language,
    recognitionLocales,
    synthesisLocales: recognitionLocales,
    selectedLocale,
    textFallbackAvailable: TEXT_FALLBACK_REQUIRED,
  };
}

export function createBrowserRuntimeSessionIdentity(
  input: Omit<BrowserRuntimeSessionIdentity, 'surface' | 'textFallbackAvailable'>,
): BrowserRuntimeSessionIdentity {
  const session: BrowserRuntimeSessionIdentity = {
    ...input,
    surface: BROWSER_RUNTIME_SURFACE,
    textFallbackAvailable: TEXT_FALLBACK_REQUIRED,
  };

  assertBrowserRuntimeSessionIdentity(session);
  return session;
}

export function assertBrowserRuntimeSessionIdentity(
  session: BrowserRuntimeSessionIdentity,
): asserts session is BrowserRuntimeSessionIdentity {
  if (session.surface !== BROWSER_RUNTIME_SURFACE) {
    throw new BrowserVoiceTextBoundaryError('team_surface_required', 'Browser runtime is .team only.');
  }

  if (session.teamKey !== TEAM_MAGNIFICENT_KEY || session.teamName !== TEAM_MAGNIFICENT_NAME) {
    throw new BrowserVoiceTextBoundaryError(
      'team_magnificent_scope_required',
      'Browser runtime requires Team Magnificent BA scope.',
    );
  }

  assertNonEmpty('tenantId', session.tenantId);
  assertNonEmpty('teamId', session.teamId);
  assertNonEmpty('tmagId', session.tmagId);
  assertNonEmpty('sessionId', session.sessionId);
  assertNonEmpty('agentKey', session.agentKey);
  assertSupportedMode(session.mode);
  assertSupportedLanguage(session.language);

  if (session.textFallbackAvailable !== true || session.microphonePermission.textFallbackAvailable !== true) {
    throw new BrowserVoiceTextBoundaryError(
      'text_fallback_required',
      'Text fallback must remain available in every browser runtime state.',
    );
  }
}

export function createContextPacketHandoff(
  session: BrowserRuntimeSessionIdentity,
  contextPacket: ContextPacketV1,
): BrowserContextPacketHandoff {
  assertBrowserRuntimeSessionIdentity(session);

  if (contextPacket.schemaVersion !== 'context_packet.v1') {
    throw new BrowserVoiceTextBoundaryError(
      'context_packet_required',
      'Browser runtime only accepts context_packet.v1 handoffs.',
    );
  }

  if (
    contextPacket.tenant.tenantId !== session.tenantId ||
    contextPacket.team.teamId !== session.teamId ||
    contextPacket.team.teamKey !== session.teamKey ||
    contextPacket.team.teamName !== session.teamName ||
    contextPacket.ba.tmagId !== session.tmagId ||
    contextPacket.session.sessionId !== session.sessionId ||
    contextPacket.session.mode !== session.mode ||
    contextPacket.agent.agentKey !== session.agentKey ||
    contextPacket.language.primary !== session.language
  ) {
    throw new BrowserVoiceTextBoundaryError(
      'context_packet_scope_mismatch',
      'Context Packet handoff must match the browser runtime session identity.',
    );
  }

  return {
    packetId: contextPacket.packetId,
    status: contextPacket.packetStatus,
    contextPacket,
    sessionId: session.sessionId,
    agentKey: session.agentKey,
    language: session.language,
    mode: session.mode,
    tmagId: session.tmagId,
  };
}

export function createTextTurn(input: {
  session: BrowserRuntimeSessionIdentity;
  contextPacket: ContextPacketV1;
  turnId: RuntimeTurnId;
  text: string;
  submittedAt: string;
  metadata?: Record<string, unknown>;
}): BrowserTextTurn {
  const context = createContextPacketHandoff(input.session, input.contextPacket);
  const text = normalizeText(input.text, 'text_turn_empty');

  return {
    kind: 'text_turn',
    turnId: input.turnId,
    session: input.session,
    submittedAt: input.submittedAt,
    context,
    textPayload: {
      tenantId: input.session.tenantId,
      teamId: input.session.teamId,
      teamKey: input.session.teamKey,
      teamName: input.session.teamName,
      tmagId: input.session.tmagId,
      text,
      language: input.session.language,
      mode: 'browser_text',
      metadata: {
        ...input.metadata,
        surface: BROWSER_RUNTIME_SURFACE,
        sessionId: input.session.sessionId,
        turnId: input.turnId,
        contextPacketId: context.packetId,
        textFallbackAvailable: TEXT_FALLBACK_REQUIRED,
      },
    },
  };
}

export function createVoiceTranscriptTurn(input: {
  session: BrowserRuntimeSessionIdentity;
  contextPacket: ContextPacketV1;
  transcriptTurnId: TranscriptTurnId;
  originalText: string;
  correctedText?: string;
  confidence?: number;
  browserLocale?: BrowserSpeechLocale | string;
  capturedAt: string;
  correctedAt?: string;
  emittedEventId?: BrowserTranscriptTurn['emittedEventId'];
  metadata?: Record<string, unknown>;
}): BrowserVoiceTranscriptTurn {
  if (!input.session.microphonePermission.canListen) {
    throw new BrowserVoiceTextBoundaryError(
      'microphone_permission_not_granted',
      'Final voice transcript requires microphone permission after explicit BA action.',
    );
  }

  const context = createContextPacketHandoff(input.session, input.contextPacket);
  const originalText = normalizeText(input.originalText, 'voice_transcript_empty');
  const finalText = normalizeText(input.correctedText ?? input.originalText, 'voice_transcript_empty');
  const transcriptHash = hashTranscript(finalText);
  const corrected = input.correctedText !== undefined && input.correctedText !== input.originalText;
  const transcript: BrowserTranscriptTurn = {
    tenantId: input.session.tenantId,
    teamId: input.session.teamId,
    teamKey: input.session.teamKey,
    teamName: input.session.teamName,
    tmagId: input.session.tmagId,
    sessionId: input.session.sessionId,
    agentKey: input.session.agentKey,
    mode: 'browser_voice',
    language: input.session.language,
    transcriptTurnId: input.transcriptTurnId,
    inputMode: 'voice',
    browserLocale: input.browserLocale,
    originalText,
    correctedText: input.correctedText,
    finalText,
    confidence: input.confidence,
    isFinal: true,
    transcriptHash,
    capturedAt: input.capturedAt,
    correctedAt: input.correctedAt,
    emittedEventId: input.emittedEventId,
    metadata: input.metadata,
  };

  return {
    kind: 'voice_transcript_turn',
    session: input.session,
    transcript,
    context,
    voicePayload: {
      tenantId: input.session.tenantId,
      teamId: input.session.teamId,
      teamKey: input.session.teamKey,
      teamName: input.session.teamName,
      tmagId: input.session.tmagId,
      text: finalText,
      language: input.session.language,
      mode: 'browser_voice',
      transcriptMetadata: {
        transcriptTurnId: input.transcriptTurnId,
        confidence: input.confidence,
        isFinal: true,
        browserLocale: input.browserLocale,
        transcriptHash,
        corrected,
      },
      metadata: {
        surface: BROWSER_RUNTIME_SURFACE,
        sessionId: input.session.sessionId,
        contextPacketId: context.packetId,
        textFallbackAvailable: TEXT_FALLBACK_REQUIRED,
      },
    },
  };
}

export function createInterimTranscript(input: {
  session: BrowserRuntimeSessionIdentity;
  text: string;
  capturedAt: string;
  confidence?: number;
}): BrowserInterimTranscriptTurn {
  const text = normalizeText(input.text, 'interim_transcript_empty');
  const voiceState = input.session.microphonePermission.canListen ? 'listening' : 'text_fallback';

  return {
    kind: 'interim_transcript',
    session: input.session,
    voiceState,
    transcript: {
      tenantId: input.session.tenantId,
      teamId: input.session.teamId,
      teamKey: input.session.teamKey,
      teamName: input.session.teamName,
      tmagId: input.session.tmagId,
      sessionId: input.session.sessionId,
      agentKey: input.session.agentKey,
      mode: input.session.mode,
      language: input.session.language,
      text,
      confidence: input.confidence,
      capturedAt: input.capturedAt,
    },
  };
}

export function createAgentResponseTurn(input: {
  session: BrowserRuntimeSessionIdentity;
  contextPacket: ContextPacketV1;
  responseId: RuntimeResponseId;
  text: string;
  outputMode: 'text' | 'voice_text';
  receivedAt: string;
  suggestedActionIds?: readonly string[];
}): BrowserAgentResponseTurn {
  const context = createContextPacketHandoff(input.session, input.contextPacket);

  return {
    kind: 'agent_response_turn',
    responseId: input.responseId,
    session: input.session,
    contextPacketId: context.packetId,
    text: normalizeText(input.text, 'agent_response_empty'),
    outputMode: input.outputMode,
    language: input.session.language,
    textFallbackAvailable: TEXT_FALLBACK_REQUIRED,
    receivedAt: input.receivedAt,
    suggestedActionIds: input.suggestedActionIds,
  };
}

export function createBrowserRuntimeEvent<TPayload extends Record<string, unknown>>(
  input: BrowserRuntimeEventInput<TPayload>,
): RuntimeAgentEventEnvelope<TPayload> {
  assertBrowserRuntimeSessionIdentity(input.session);

  const source = input.eventType.startsWith('browser_voice.')
    ? 'browser_voice_runtime'
    : 'browser_text_runtime';

  return createRuntimeEventEnvelope<TPayload>(
    {
      tenantId: input.session.tenantId,
      teamId: input.session.teamId,
      teamKey: input.session.teamKey,
      teamName: input.session.teamName,
      tmagId: input.session.tmagId,
      agentKey: input.session.agentKey,
      sessionId: input.session.sessionId,
      eventType: input.eventType,
      correlationId: input.session.correlationId,
      idempotencyKey: input.idempotencyKey,
      source,
      payload: input.payload,
      occurredAt: input.occurredAt,
      metadata: {
        surface: BROWSER_RUNTIME_SURFACE,
        mode: input.session.mode,
        language: input.session.language,
        contextPacketId: input.contextPacketId,
        textFallbackAvailable: TEXT_FALLBACK_REQUIRED,
        persisted: false,
      },
      actor: {
        actorType: 'ba',
        actorId: input.session.tmagId,
        tmagId: input.session.tmagId,
      },
      provenance: {
        emittedBy: 'browser_voice_text_foundation',
      },
    },
    input.clock,
  );
}

function assertSupportedLanguage(language: RuntimeLanguage): void {
  if (!SUPPORTED_BROWSER_RUNTIME_LANGUAGES.includes(language)) {
    throw new BrowserVoiceTextBoundaryError(
      'unsupported_language',
      'Browser runtime supports English and Spanish only.',
    );
  }
}

function assertSupportedMode(mode: RuntimeMode): void {
  if (mode !== 'browser_text' && mode !== 'browser_voice' && mode !== 'mixed') {
    throw new BrowserVoiceTextBoundaryError(
      'unsupported_browser_runtime_mode',
      'Browser runtime mode must be browser_text, browser_voice, or mixed.',
    );
  }
}

function assertNonEmpty(field: string, value: string): void {
  if (value.trim().length === 0) {
    throw new BrowserVoiceTextBoundaryError(`${field}_required`, `${field} is required.`);
  }
}

function normalizeText(text: string, code: string): string {
  const normalized = text.trim();
  if (normalized.length === 0) {
    throw new BrowserVoiceTextBoundaryError(code, 'Runtime turn text cannot be empty.');
  }
  return normalized;
}

function hashTranscript(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

function validateBrowserVoiceTranscript(
  transcript: BrowserTranscriptTurn,
): BrowserVoiceTextValidationResult<BrowserTranscriptTurn> {
  const sessionResult = validateBrowserVoiceTextSessionFoundation({
    tenantId: transcript.tenantId,
    teamId: transcript.teamId,
    teamKey: transcript.teamKey,
    teamName: transcript.teamName,
    tmagId: transcript.tmagId,
    sessionId: transcript.sessionId,
    agentKey: transcript.agentKey,
    language: transcript.language,
    mode: 'browser_voice',
    textFallbackRequired: TEXT_FALLBACK_REQUIRED,
    microphonePermissionMayBeRequested: MICROPHONE_PERMISSION_POLICY,
    internalRuntimeOnly: true,
  });

  if (!sessionResult.ok) {
    return sessionResult;
  }

  const errors: BrowserVoiceTextValidationIssue[] = [];
  requireString(transcript, 'transcriptTurnId', errors);
  requireString(transcript, 'finalText', errors);
  requireString(transcript, 'transcriptHash', errors);

  if (transcript.inputMode !== 'voice') {
    errors.push(validationIssue('inputMode', 'transcript_invalid', 'Voice transcripts must use inputMode voice.'));
  }

  if (transcript.isFinal !== true) {
    errors.push(validationIssue('isFinal', 'transcript_invalid', 'Only final transcripts can become agent turns.'));
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return { ok: true, value: transcript, errors: [] };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requireString(
  object: object,
  key: string,
  errors: BrowserVoiceTextValidationIssue[],
  path = key,
): void {
  const value = (object as Record<string, unknown>)[key];
  if (typeof value !== 'string' || value.trim().length === 0) {
    errors.push(validationIssue(path, 'invalid_scope', `${path} is required.`));
  }
}

function validationIssue(
  path: string,
  code: BrowserVoiceTextValidationCode,
  message: string,
): BrowserVoiceTextValidationIssue {
  return { path, code, message };
}
