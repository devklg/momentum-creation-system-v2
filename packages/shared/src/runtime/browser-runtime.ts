import type { AgentKey, RuntimeMode } from './agents.js';
import type { RuntimeEventId, SessionId, TranscriptTurnId } from './ids.js';
import type { BaRuntimeScope } from './identity.js';
import type { BrowserSpeechLocale, RuntimeLanguage } from './language.js';

export type BrowserVoiceState =
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

export type BrowserVoiceErrorCode =
  | 'unsupported'
  | 'permission_denied'
  | 'no_microphone'
  | 'recognition_error'
  | 'synthesis_error'
  | 'network_error'
  | 'language_not_supported'
  | 'unknown';

export interface BrowserVoiceError {
  code: BrowserVoiceErrorCode;
  message: string;
  safeMessage: string;
  retryable: boolean;
  occurredAt: string;
}

export type BrowserRuntimeTransport = 'browser_voice' | 'browser_text';

export interface BrowserRuntimeSessionScope extends BaRuntimeScope {
  sessionId: SessionId;
  agentKey: AgentKey;
  mode: RuntimeMode;
  language: RuntimeLanguage;
}

export interface BrowserTranscriptTurn extends BrowserRuntimeSessionScope {
  transcriptTurnId: TranscriptTurnId;
  inputMode: 'voice';
  browserLocale?: BrowserSpeechLocale | string;
  originalText: string;
  correctedText?: string;
  finalText: string;
  confidence?: number;
  isFinal: true;
  transcriptHash: string;
  capturedAt: string;
  correctedAt?: string;
  emittedEventId?: RuntimeEventId;
  metadata?: Record<string, unknown>;
}

export interface BrowserInterimTranscript extends BrowserRuntimeSessionScope {
  text: string;
  confidence?: number;
  capturedAt: string;
}

export interface BrowserVoiceAgentTurnWirePayload extends BaRuntimeScope {
  text: string;
  language?: RuntimeLanguage;
  mode: 'browser_voice';
  transcriptMetadata: {
    transcriptTurnId: TranscriptTurnId;
    confidence?: number;
    isFinal: true;
    browserLocale?: BrowserSpeechLocale | string;
    transcriptHash: string;
    corrected: boolean;
  };
  metadata?: Record<string, unknown>;
}

export interface BrowserTextTurnWirePayload extends BaRuntimeScope {
  text: string;
  language?: RuntimeLanguage;
  mode: 'browser_text';
  metadata?: Record<string, unknown>;
}
