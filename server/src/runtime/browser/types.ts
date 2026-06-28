import type {
  AgentEventType,
  AgentKey,
  BaRuntimeScope,
  BrowserTextTurnWirePayload,
  BrowserTranscriptTurn,
  BrowserVoiceAgentTurnWirePayload,
  BrowserVoiceError,
  BrowserVoiceState,
  CorrelationId,
  IdempotencyKey,
  RuntimeLanguage,
  SessionId,
} from '@momentum/shared/runtime';
import type { RuntimeAgentEventEnvelope } from '../events/index.js';

export type BrowserVoiceTextValidationCode =
  | 'invalid_scope'
  | 'invalid_agent'
  | 'invalid_language'
  | 'invalid_mode'
  | 'text_fallback_required'
  | 'permission_after_action_required'
  | 'transcript_invalid'
  | 'external_telephony_forbidden';

export interface BrowserVoiceTextValidationIssue {
  path: string;
  code: BrowserVoiceTextValidationCode;
  message: string;
}

export type BrowserVoiceTextValidationResult<TValue> =
  | {
      ok: true;
      value: TValue;
      errors: [];
    }
  | {
      ok: false;
      errors: BrowserVoiceTextValidationIssue[];
    };

export interface BrowserVoiceTextSessionFoundation extends BaRuntimeScope {
  sessionId: SessionId;
  agentKey: AgentKey;
  language: RuntimeLanguage;
  mode: 'browser_voice' | 'browser_text' | 'mixed';
  textFallbackRequired: true;
  microphonePermissionMayBeRequested: 'after_explicit_ba_action_only';
  internalRuntimeOnly: true;
}

export interface BrowserRuntimeEventEnvelopeInput extends BaRuntimeScope {
  eventType: AgentEventType;
  sessionId: SessionId;
  agentKey: AgentKey;
  correlationId: CorrelationId;
  idempotencyKey: IdempotencyKey;
  payload: Record<string, unknown>;
  occurredAt?: string;
}

export type BrowserRuntimeEventEnvelope = RuntimeAgentEventEnvelope<Record<string, unknown>>;

export interface BrowserVoiceTextFoundationPort {
  validateSessionFoundation(candidate: unknown): BrowserVoiceTextValidationResult<BrowserVoiceTextSessionFoundation>;
  createTextFallbackTurn(
    session: BrowserVoiceTextSessionFoundation,
    text: string,
  ): BrowserTextTurnWirePayload;
  finalizeVoiceTurn(
    transcript: BrowserTranscriptTurn,
  ): BrowserVoiceAgentTurnWirePayload;
  createRuntimeEventEnvelope(
    input: BrowserRuntimeEventEnvelopeInput,
  ): BrowserRuntimeEventEnvelope;
}

export interface BrowserVoiceTextSafeFailure {
  state: BrowserVoiceState;
  error: BrowserVoiceError;
  fallback: 'browser_text';
}
