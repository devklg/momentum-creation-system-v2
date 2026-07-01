import { describe, expect, it } from 'vitest';
import type {
  TmagId,
  McsCorrelationId,
  McsIdempotencyKey,
  McsSessionId,
  McsTeamId,
  McsTenantId,
  McsTranscriptTurnId,
} from '@momentum/shared/runtime';
import {
  MICROPHONE_PERMISSION_POLICY,
  TEXT_FALLBACK_REQUIRED,
  createBrowserRuntimeEventEnvelope,
  createBrowserTextFallbackTurn,
  finalizeBrowserVoiceTurn,
  speechLanguageMap,
  validateBrowserVoiceTextSessionFoundation,
} from '../index.js';

const tenantId = 'tenant_tm' as McsTenantId;
const teamId = 'team_tm' as McsTeamId;
const tmagId = 'ba_tm_001' as TmagId;
const sessionId = 'session_browser_test' as McsSessionId;

const validSession = {
  tenantId,
  teamId,
  teamKey: 'team_magnificent',
  teamName: 'Team Magnificent',
  tmagId,
  sessionId,
  agentKey: 'michael_magnificent',
  language: 'en',
  mode: 'browser_voice',
  textFallbackRequired: TEXT_FALLBACK_REQUIRED,
  microphonePermissionMayBeRequested: MICROPHONE_PERMISSION_POLICY,
  internalRuntimeOnly: true,
} as const;

describe('browser voice/text foundation compatibility', () => {
  it('accepts a .team-scoped Browser Voice/Text session foundation', () => {
    const result = validateBrowserVoiceTextSessionFoundation(validSession);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.teamKey).toBe('team_magnificent');
      expect(result.value.textFallbackRequired).toBe(true);
      expect(result.value.microphonePermissionMayBeRequested).toBe('after_explicit_ba_action_only');
    }
  });

  it('requires text fallback and permission after explicit BA action', () => {
    const result = validateBrowserVoiceTextSessionFoundation({
      ...validSession,
      textFallbackRequired: false,
      microphonePermissionMayBeRequested: 'on_page_load',
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((item) => item.code === 'text_fallback_required')).toBe(true);
      expect(result.errors.some((item) => item.code === 'permission_after_action_required')).toBe(true);
    }
  });

  it('supports English and Spanish browser speech locales', () => {
    expect(speechLanguageMap.en).toEqual(['en-US']);
    expect(speechLanguageMap.es).toEqual(['es-US', 'es-MX', 'es-ES']);
  });

  it('creates Browser Text fallback turns without microphone requirements', () => {
    const turn = createBrowserTextFallbackTurn(validSession, 'I need help practicing my invitation.');

    expect(turn.mode).toBe('browser_text');
    expect(turn.tmagId).toBe(tmagId);
    expect(turn.teamKey).toBe('team_magnificent');
    expect(turn.text).toContain('invitation');
    expect(turn.metadata?.textFallbackAvailable).toBe(true);
  });

  it('finalizes voice transcripts into Agent Runtime wire payloads', () => {
    const payload = finalizeBrowserVoiceTurn({
      tenantId,
      teamId,
      teamKey: 'team_magnificent',
      teamName: 'Team Magnificent',
      tmagId,
      sessionId,
      agentKey: 'michael_magnificent',
      mode: 'browser_voice',
      language: 'en',
      transcriptTurnId: 'transcript_test' as McsTranscriptTurnId,
      inputMode: 'voice',
      originalText: 'How do I explain the journal?',
      finalText: 'How do I explain the journal?',
      confidence: 0.91,
      isFinal: true,
      transcriptHash: 'hash_test',
      capturedAt: '2026-06-28T12:00:00.000Z',
    });

    expect(payload.mode).toBe('browser_voice');
    expect(payload.text).toBe('How do I explain the journal?');
    expect(payload.transcriptMetadata.isFinal).toBe(true);
    expect(payload.transcriptMetadata.corrected).toBe(false);
  });

  it('uses the S1.4 validation foundation for browser runtime event envelopes', () => {
    const event = createBrowserRuntimeEventEnvelope({
      tenantId,
      teamId,
      teamKey: 'team_magnificent',
      teamName: 'Team Magnificent',
      tmagId,
      eventType: 'browser_voice.final_transcript',
      sessionId,
      agentKey: 'michael_magnificent',
      correlationId: 'corr_browser_test' as McsCorrelationId,
      idempotencyKey: 'idem_browser_test' as McsIdempotencyKey,
      occurredAt: '2026-06-28T12:00:00.000Z',
      payload: {
        transcriptTurnId: 'transcript_test',
        transcriptHash: 'hash_test',
      },
    });

    expect(event.schemaVersion).toBe('agent_event.v1');
    expect(event.source).toBe('browser_voice_runtime');
    expect(event.occurredAt).toBe('2026-06-28T12:00:00.000Z');
    expect('createdAt' in event).toBe(false);
  });
});
