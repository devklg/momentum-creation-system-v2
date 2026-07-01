import type { McsAgentKey, McsRuntimeMode } from './agents.js';
import type { McsRuntimeEventId, McsSessionId, McsTranscriptTurnId } from './ids.js';
import type { McsBaRuntimeScope } from './identity.js';
import type { McsBrowserSpeechLocale, McsRuntimeLanguage } from './language.js';

export type McsBrowserVoiceState =
  | 'unsupported'
  | 'idle'
  | 'requesting_permission'
  | 'permission_denied'
  | 'listening'
  | 'processing'
  | 'speaking'
  | 'paused'
  | 'text_fallback'
  | 'error';

export type McsBrowserVoiceErrorCode =
  | 'unsupported'
  | 'permission_denied'
  | 'no_microphone'
  | 'recognition_error'
  | 'synthesis_error'
  | 'network_error'
  | 'language_not_supported'
  | 'unknown';

export interface McsBrowserVoiceError {
  code: McsBrowserVoiceErrorCode;
  message: string;
  safeMessage: string;
  retryable: boolean;
  occurredAt: string;
}

export type McsBrowserRuntimeTransport = 'browser_voice' | 'browser_text';

export interface McsBrowserRuntimeSessionScope extends McsBaRuntimeScope {
  sessionId: McsSessionId;
  agentKey: McsAgentKey;
  mode: McsRuntimeMode;
  language: McsRuntimeLanguage;
}

export interface McsBrowserTranscriptTurn extends McsBrowserRuntimeSessionScope {
  transcriptTurnId: McsTranscriptTurnId;
  inputMode: 'voice';
  browserLocale?: McsBrowserSpeechLocale | string;
  originalText: string;
  correctedText?: string;
  finalText: string;
  confidence?: number;
  isFinal: true;
  transcriptHash: string;
  capturedAt: string;
  correctedAt?: string;
  emittedEventId?: McsRuntimeEventId;
  metadata?: Record<string, unknown>;
}

export interface McsBrowserInterimTranscript extends McsBrowserRuntimeSessionScope {
  text: string;
  confidence?: number;
  capturedAt: string;
}

export interface McsBrowserVoiceAgentTurnWirePayload extends McsBaRuntimeScope {
  text: string;
  language?: McsRuntimeLanguage;
  mode: 'browser_voice';
  transcriptMetadata: {
    transcriptTurnId: McsTranscriptTurnId;
    confidence?: number;
    isFinal: true;
    browserLocale?: McsBrowserSpeechLocale | string;
    transcriptHash: string;
    corrected: boolean;
  };
  metadata?: Record<string, unknown>;
}

export interface McsBrowserTextTurnWirePayload extends McsBaRuntimeScope {
  text: string;
  language?: McsRuntimeLanguage;
  mode: 'browser_text';
  metadata?: Record<string, unknown>;
}
