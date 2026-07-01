import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type {
  AgentKey,
  TmagId,
  ContextPacketId,
  ContextRequestId,
  CorrelationId,
  IdempotencyKey,
  RuntimeResponseId,
  RuntimeTurnId,
  SessionId,
  TeamId,
  TenantId,
  TranscriptTurnId,
} from '@momentum/shared/runtime';
import type { ContextPacketV1 } from '@momentum/shared/runtime';
import { validateRuntimeEventEnvelope } from '../../events/index.js';
import {
  BROWSER_SPEECH_LOCALES_BY_LANGUAGE,
  TEXT_FALLBACK_REQUIRED,
  BrowserVoiceTextBoundaryError,
  assertBrowserRuntimeSessionIdentity,
  createAgentResponseTurn,
  createBrowserRuntimeEvent,
  createBrowserRuntimeSessionIdentity,
  createContextPacketHandoff,
  createInterimTranscript,
  createLanguageSelection,
  createMicrophonePermissionBoundary,
  createTextTurn,
  createVoiceTranscriptTurn,
} from '../foundation.js';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../../../..');

function normalizePath(path: string): string {
  return path.split(sep).join('/');
}

function collectSourceFiles(root: string): Array<{ relativePath: string; text: string }> {
  const files: Array<{ relativePath: string; text: string }> = [];

  function walk(current: string): void {
    for (const entry of readdirSync(current)) {
      if (entry === 'node_modules' || entry === 'dist' || entry === '.git' || entry === '__tests__') {
        continue;
      }

      const absolutePath = resolve(current, entry);
      const stats = statSync(absolutePath);
      if (stats.isDirectory()) {
        walk(absolutePath);
        continue;
      }

      if (!/\.(ts|tsx|mts|cts|js|jsx)$/.test(entry)) continue;

      files.push({
        relativePath: normalizePath(relative(repoRoot, absolutePath)),
        text: readFileSync(absolutePath, 'utf8'),
      });
    }
  }

  walk(root);
  return files;
}

function expectNoMatches(files: Array<{ relativePath: string; text: string }>, pattern: RegExp): void {
  const matches = files.flatMap((file) =>
    file.text
      .split(/\r?\n/)
      .map((line, index) => ({ line, lineNumber: index + 1 }))
      .filter(({ line }) => pattern.test(line))
      .map(({ line, lineNumber }) => `${file.relativePath}:${lineNumber}: ${line.trim()}`),
  );

  expect(matches, matches.join('\n')).toEqual([]);
}

const tenantId = 'tenant_team_magnificent' as TenantId;
const teamId = 'team_magnificent' as TeamId;
const tmagId = 'TMBA-TEST-S16' as TmagId;
const sessionId = 'session_s16_browser' as SessionId;
const agentKey = 'michael_magnificent' as AgentKey;
const correlationId = 'corr_s16_browser' as CorrelationId;

function browserSession(mode: 'browser_text' | 'browser_voice' | 'mixed' = 'browser_voice') {
  return createBrowserRuntimeSessionIdentity({
    tenantId,
    teamId,
    teamKey: 'team_magnificent',
    teamName: 'Team Magnificent',
    tmagId,
    sessionId,
    agentKey,
    mode,
    language: 'en',
    correlationId,
    microphonePermission: createMicrophonePermissionBoundary({
      state: 'granted',
      requestedAfterUserAction: true,
    }),
  });
}

function contextPacket(session = browserSession()): ContextPacketV1 {
  return {
    schemaVersion: 'context_packet.v1',
    packetId: 'ctx_packet_s16_browser' as ContextPacketId,
    requestId: 'ctx_request_s16_browser' as ContextRequestId,
    createdAt: '2026-06-28T12:00:00.000Z',
    packetStatus: 'complete',
    tenant: {
      tenantId: session.tenantId,
      tenantName: 'Momentum Creation System',
      brandName: 'Team Magnificent',
      environment: 'development',
    },
    team: {
      teamId: session.teamId,
      teamKey: session.teamKey,
      teamName: session.teamName,
    },
    ba: {
      tenantId: session.tenantId,
      teamId: session.teamId,
      teamKey: session.teamKey,
      teamName: session.teamName,
      tmagId: session.tmagId,
      journalEnabled: true,
      languagePreference: session.language,
      permissions: {
        canUsePrivateJournal: true,
        canSelectJournalForReview: true,
        canCreateKnowledgeCandidate: true,
        canAccessRelationshipContext: true,
        canUseBrowserVoice: true,
        canUseBrowserText: true,
      },
    },
    session: {
      sessionId: session.sessionId,
      mode: session.mode,
      status: 'active',
      taskType: 'training_support',
    },
    agent: {
      agentKey: session.agentKey,
      displayName: 'Michael Magnificent',
      primaryDomain: 'training',
      roleSummary: 'Training support',
      allowedOutputs: ['teaching_explanation', 'clarifying_question'],
      prohibitedOutputs: ['raw persistence access'],
      agentRuntimeMode: 'training_specialist',
      contextUsageInstruction: 'Use this packet only.',
    },
    language: {
      primary: session.language,
      translationAllowed: true,
      translationStatus: 'same_language',
      machineTranslationUsed: false,
      humanReviewed: true,
    },
    runtimeRules: [],
    guardrails: [],
    approvedKnowledge: [],
    privateContext: { included: false, items: [] },
    relationshipContext: { included: false, items: [] },
    journalContext: { included: false, entries: [], privateByDefault: true },
    sessionHistory: { included: false, turns: [] },
    guidedActions: [],
    exclusions: [],
    retrievalAudit: {
      requestId: 'ctx_request_s16_browser' as ContextRequestId,
      packetId: 'ctx_packet_s16_browser' as ContextPacketId,
      requestedScopes: ['team_magnificent'],
      includedKnowledgeIds: [],
      includedPrivateContextIds: [],
      excludedSourceIds: [],
      retrievalMethods: [],
      tokenEstimate: 0,
      languageFallbackUsed: false,
      candidateKnowledgeIncluded: false,
      candidateKnowledgeExcluded: true,
      privateJournalIncluded: false,
      degraded: false,
      includedItems: [],
      exclusions: [],
    },
    metadata: {
      generatedBy: 'context_manager',
      environment: 'development',
      correlationId,
    },
  };
}

describe('S1.6 browser voice/text foundation', () => {
  it('preserves the .team Team Magnificent BA scope boundary', () => {
    const session = browserSession();

    expect(session.surface).toBe('team');
    expect(session.teamKey).toBe('team_magnificent');
    expect(session.teamName).toBe('Team Magnificent');
    expect(session.tmagId).toBe(tmagId);

    expect(() =>
      assertBrowserRuntimeSessionIdentity({
        ...session,
        surface: 'com' as never,
      }),
    ).toThrow(BrowserVoiceTextBoundaryError);
  });

  it('requires text fallback and microphone permission after explicit BA action', () => {
    expect(TEXT_FALLBACK_REQUIRED).toBe(true);
    expect(createMicrophonePermissionBoundary({ state: 'denied', requestedAfterUserAction: true })).toMatchObject({
      canListen: false,
      textFallbackAvailable: true,
    });
    expect(() => createMicrophonePermissionBoundary({ state: 'granted' })).toThrow(
      /explicit BA action/,
    );
  });

  it('represents EN/ES language selection with speech locale preferences', () => {
    expect(BROWSER_SPEECH_LOCALES_BY_LANGUAGE.en).toContain('en-US');
    expect(BROWSER_SPEECH_LOCALES_BY_LANGUAGE.es).toEqual(['es-US', 'es-MX', 'es-ES']);
    expect(createLanguageSelection({ language: 'es', preferredLocale: 'es-MX' })).toMatchObject({
      language: 'es',
      selectedLocale: 'es-MX',
      textFallbackAvailable: true,
    });
  });

  it('uses Context Packet handoff as the input boundary for turns and responses', () => {
    const session = browserSession('browser_text');
    const packet = contextPacket(session);
    const handoff = createContextPacketHandoff(session, packet);
    const textTurn = createTextTurn({
      session,
      contextPacket: packet,
      turnId: 'turn_text_s16' as RuntimeTurnId,
      text: 'What should I do next?',
      submittedAt: '2026-06-28T12:01:00.000Z',
    });
    const responseTurn = createAgentResponseTurn({
      session,
      contextPacket: packet,
      responseId: 'response_s16' as RuntimeResponseId,
      text: 'Start with the next training step.',
      outputMode: 'text',
      receivedAt: '2026-06-28T12:01:01.000Z',
    });

    expect(handoff.packetId).toBe(packet.packetId);
    expect(textTurn.context.packetId).toBe(packet.packetId);
    expect(textTurn.textPayload.mode).toBe('browser_text');
    expect(responseTurn.contextPacketId).toBe(packet.packetId);

    expect(() =>
      createContextPacketHandoff(
        { ...session, tmagId: 'TMBA-OTHER' as TmagId },
        packet,
      ),
    ).toThrow(/Context Packet handoff must match/);
  });

  it('creates voice final and interim transcript turn contracts without raw audio', () => {
    const session = browserSession('browser_voice');
    const packet = contextPacket(session);
    const finalTurn = createVoiceTranscriptTurn({
      session,
      contextPacket: packet,
      transcriptTurnId: 'transcript_s16' as TranscriptTurnId,
      originalText: 'What is my next step',
      correctedText: 'What is my next step?',
      confidence: 0.92,
      browserLocale: 'en-US',
      capturedAt: '2026-06-28T12:02:00.000Z',
    });
    const interim = createInterimTranscript({
      session,
      text: 'What is my',
      confidence: 0.64,
      capturedAt: '2026-06-28T12:01:58.000Z',
    });

    expect(finalTurn.transcript.finalText).toBe('What is my next step?');
    expect(finalTurn.transcript.transcriptHash).toHaveLength(64);
    expect(finalTurn.voicePayload.transcriptMetadata.corrected).toBe(true);
    expect(finalTurn.voicePayload).not.toHaveProperty('audio');
    expect(interim.voiceState).toBe('listening');
  });

  it('uses the S1.4 validation foundation for browser runtime event envelopes without persistence', () => {
    const session = browserSession('browser_voice');
    const event = createBrowserRuntimeEvent({
      session,
      eventType: 'browser_voice.final_transcript',
      idempotencyKey: 'browser_voice:session_s16_browser:transcript_s16' as IdempotencyKey,
      payload: {
        transcriptTurnId: 'transcript_s16',
        transcriptHash: 'hash_only',
      },
      contextPacketId: 'ctx_packet_s16_browser' as ContextPacketId,
      clock: { now: () => new Date('2026-06-28T12:03:00.000Z') },
    });
    const validation = validateRuntimeEventEnvelope(event);

    expect(validation.ok).toBe(true);
    expect(event.schemaVersion).toBe('agent_event.v1');
    expect(event.source).toBe('browser_voice_runtime');
    expect(event.metadata?.persisted).toBe(false);
    expect(event.payload).not.toHaveProperty('text');
  });

  it('keeps .com surfaces and runtime browser files free of forbidden browser-runtime dependencies', () => {
    const comFiles = collectSourceFiles(resolve(repoRoot, 'apps/com/src'));
    const browserRuntimeFiles = collectSourceFiles(resolve(repoRoot, 'server/src/runtime/browser'));
    const indexText = readFileSync(resolve(repoRoot, 'server/src/index.ts'), 'utf8');

    expectNoMatches(
      comFiles,
      /\b(browser-runtime|BrowserVoice|BrowserText|browser_voice|browser_text|voice\/text|browser-voice|browser-text)\b/i,
    );
    expectNoMatches(
      browserRuntimeFiles,
      /\bfrom\s+['"][^'"]*(?:telnyx|verifyTelnyxWebhook)[^'"]*['"]|\bTELNYX_|\bverifyTelnyxWebhook\b|\b(?:sendSms|makeCall|callControl|CallControl|pstnCall|PstnCall)\b/i,
    );
    expect(indexText).not.toMatch(/app\.use\(\s*['"`]\/api\/runtime\b/);
  });
});
