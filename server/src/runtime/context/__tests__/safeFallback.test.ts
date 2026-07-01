import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type {
  ApprovedKnowledgeQueryRequest,
  TmagId,
  KnowledgeId,
  KnowledgeReference,
  RuntimeRequestScope,
  SessionId,
  SourceId,
  TeamId,
  TenantId,
} from '@momentum/shared/runtime';
import {
  APPROVED_KNOWLEDGE_QUERY_SCHEMA_VERSION,
  SAFE_FALLBACK_BASE_DIRECTIVE,
  createContextManagerRetrievalAdapter,
  resolveSafeFallbackState,
  safeFallbackFromResult,
  toContextReferences,
  type ApprovedKnowledgeProvider,
} from '../index.js';
import {
  buildContextPacket,
  validateContextPacket,
  type ContextPacketBuildInput,
} from '../contextManager.js';
import { TEAM_MAGNIFICENT_KEY, TEAM_MAGNIFICENT_NAME } from '../validation.js';

describe('P4.9 resolveSafeFallbackState — reason-specific safe directives', () => {
  it('always begins with the base directive and misses approvedKnowledge', () => {
    const state = resolveSafeFallbackState({ degradeReasons: ['knowledge_unavailable'], requestedLanguage: 'en' });
    expect(state.safeFallbackInstruction.startsWith(SAFE_FALLBACK_BASE_DIRECTIVE)).toBe(true);
    expect(state.missingSections).toEqual(['approvedKnowledge']);
  });

  it('maps knowledge_unavailable and scope_empty and no_approved_match to knowledge_unavailable', () => {
    expect(resolveSafeFallbackState({ degradeReasons: ['knowledge_unavailable'], requestedLanguage: 'en' }).reasons).toEqual(['knowledge_unavailable']);
    expect(resolveSafeFallbackState({ degradeReasons: ['scope_empty'], requestedLanguage: 'en' }).reasons).toEqual(['knowledge_unavailable']);
    const noMatch = resolveSafeFallbackState({ degradeReasons: ['no_approved_match'], requestedLanguage: 'en' });
    expect(noMatch.reasons).toEqual(['knowledge_unavailable']);
    expect(noMatch.safeFallbackInstruction).toContain('No approved knowledge matched this objective');
    expect(noMatch.safeFallbackInstruction).toContain('do not fabricate');
  });

  it('maps language_unavailable to translation_unavailable and offers the fallback language', () => {
    const withFallback = resolveSafeFallbackState({
      degradeReasons: ['language_unavailable'],
      requestedLanguage: 'en',
      fallbackLanguage: 'es',
    });
    expect(withFallback.reasons).toEqual(['translation_unavailable']);
    expect(withFallback.safeFallbackInstruction).toContain('not available in English');
    expect(withFallback.safeFallbackInstruction).toContain('continue in Spanish');
    expect(withFallback.safeFallbackInstruction).toContain('never present a machine translation as approved');

    const noFallback = resolveSafeFallbackState({ degradeReasons: ['language_unavailable'], requestedLanguage: 'es' });
    expect(noFallback.safeFallbackInstruction).toContain('not available in Spanish');
    expect(noFallback.safeFallbackInstruction).toContain('rephrase or try another language');
  });

  it('maps retrieval_timeout to retrieval_timeout', () => {
    const state = resolveSafeFallbackState({ degradeReasons: ['retrieval_timeout'], requestedLanguage: 'en' });
    expect(state.reasons).toEqual(['retrieval_timeout']);
    expect(state.safeFallbackInstruction).toContain('timed out');
  });

  it('combines multiple reasons, dedupes packet reasons, and orders deterministically', () => {
    const state = resolveSafeFallbackState({
      degradeReasons: ['language_unavailable', 'no_approved_match', 'scope_empty'],
      requestedLanguage: 'en',
      fallbackLanguage: 'es',
    });
    // no_approved_match + scope_empty both map to knowledge_unavailable (deduped, ordered first).
    expect(state.reasons).toEqual(['knowledge_unavailable', 'translation_unavailable']);
    // Reason order follows REASON_ORDER regardless of input order.
    const firstIdx = state.safeFallbackInstruction.indexOf('No approved knowledge matched');
    const langIdx = state.safeFallbackInstruction.indexOf('not available in English');
    expect(firstIdx).toBeGreaterThan(-1);
    expect(langIdx).toBeGreaterThan(firstIdx);
  });

  it('degrades safely to knowledge_unavailable on empty/unknown input', () => {
    const state = resolveSafeFallbackState({ degradeReasons: [], requestedLanguage: 'en' });
    expect(state.reasons).toEqual(['knowledge_unavailable']);
    expect(state.safeFallbackInstruction).toBe(SAFE_FALLBACK_BASE_DIRECTIVE);
  });
});

// ---- bridge + end-to-end ----

function scope(): RuntimeRequestScope {
  return {
    tenantId: 'tenant_team_magnificent' as TenantId,
    teamId: 'team_magnificent' as TeamId,
    teamKey: TEAM_MAGNIFICENT_KEY,
    teamName: TEAM_MAGNIFICENT_NAME,
    tmagId: 'TMAG-P49-001' as TmagId,
  };
}

function request(overrides: Partial<ApprovedKnowledgeQueryRequest> = {}): ApprovedKnowledgeQueryRequest {
  return {
    schemaVersion: APPROVED_KNOWLEDGE_QUERY_SCHEMA_VERSION,
    scope: scope(),
    objective: 'training_support',
    domains: ['training'],
    language: 'en',
    ...overrides,
  };
}

function esReference(): KnowledgeReference {
  return {
    knowledgeId: 'knowledge_p49_es' as KnowledgeId,
    domain: 'training',
    status: 'approved',
    language: 'es',
    translationStatus: 'same_language',
    sourceId: 'source_p49_es' as SourceId,
  };
}

function providerReturning(references: readonly KnowledgeReference[]): ApprovedKnowledgeProvider {
  return { async listApprovedKnowledge() { return references; } };
}
function providerThrowing(): ApprovedKnowledgeProvider {
  return { async listApprovedKnowledge() { throw new Error('down'); } };
}

function packetInput(overrides: Partial<ContextPacketBuildInput> = {}): ContextPacketBuildInput {
  return {
    packetId: 'ctx_packet_p49_001' as ContextPacketBuildInput['packetId'],
    requestId: 'ctx_req_p49_001' as ContextPacketBuildInput['requestId'],
    tenant: { tenantId: 'tenant_team_magnificent' as TenantId, tenantName: 'TM', brandName: TEAM_MAGNIFICENT_NAME, environment: 'development' },
    team: { teamId: 'team_magnificent' as TeamId, teamKey: TEAM_MAGNIFICENT_KEY, teamName: TEAM_MAGNIFICENT_NAME },
    ba: {
      tenantId: 'tenant_team_magnificent' as TenantId,
      teamId: 'team_magnificent' as TeamId,
      teamKey: TEAM_MAGNIFICENT_KEY,
      teamName: TEAM_MAGNIFICENT_NAME,
      tmagId: 'TMAG-P49-001' as TmagId,
      journalEnabled: false,
      languagePreference: 'en',
      permissions: {
        canUsePrivateJournal: false,
        canSelectJournalForReview: false,
        canCreateKnowledgeCandidate: false,
        canAccessRelationshipContext: false,
        canUseBrowserVoice: false,
        canUseBrowserText: true,
      },
    },
    session: { sessionId: 'session_p49_001' as SessionId, mode: 'browser_text', status: 'active', taskType: 'training_support', startedAt: '2026-06-30T12:00:00.000Z' },
    agentKey: 'michael_magnificent',
    objective: 'training_support',
    language: { primary: 'en', userPreference: 'en', translationAllowed: false, translationStatus: 'same_language', machineTranslationUsed: false, humanReviewed: true },
    provenance: { assembledBy: 'context_manager', requestId: 'ctx_req_p49_001' as ContextPacketBuildInput['requestId'], componentVersion: 's1.5', traceId: 'trace_p49_001' },
    createdAt: '2026-06-30T12:00:01.000Z',
    ...overrides,
  };
}

describe('P4.9 safeFallbackFromResult — bridge', () => {
  it('returns null for an ok result', async () => {
    const adapter = createContextManagerRetrievalAdapter(
      providerReturning([{ ...esReference(), language: 'en', knowledgeId: 'knowledge_p49_en' as KnowledgeId }]),
    );
    const result = await adapter.retrieveApprovedKnowledge(request());
    expect(result.status).toBe('ok');
    expect(safeFallbackFromResult(result)).toBeNull();
  });

  it('upgrades a language_unavailable degrade into a translation_unavailable packet', async () => {
    // en request, only es content, no fallback → degraded language_unavailable.
    const adapter = createContextManagerRetrievalAdapter(providerReturning([esReference()]));
    const result = await adapter.retrieveApprovedKnowledge(request({ allowLanguageFallback: false }));
    expect(result.status).toBe('degraded');
    expect(result.metadata.degradeReasons).toContain('language_unavailable');

    const upgrade = safeFallbackFromResult(result);
    expect(upgrade).not.toBeNull();
    const packet = buildContextPacket(packetInput({
      ...upgrade!,
      knowledgeReferences: toContextReferences(result),
    }));

    expect(validateContextPacket(packet).ok).toBe(true);
    expect(packet.packetStatus).toBe('degraded');
    expect(packet.approvedKnowledge).toEqual([]);
    expect(packet.degraded?.reasons).toEqual(['translation_unavailable']);
    expect(packet.degraded?.safeFallbackInstruction).toContain('never present a machine translation as approved');
    // The bridge concretely offers the other supported language (en requested → Spanish).
    expect(packet.degraded?.safeFallbackInstruction).toContain('continue in Spanish');
    expect(packet.retrievalAudit.degraded).toBe(true);
  });

  it('upgrades a provider-failure degrade into a knowledge_unavailable packet', async () => {
    const adapter = createContextManagerRetrievalAdapter(providerThrowing());
    const result = await adapter.retrieveApprovedKnowledge(request());
    const upgrade = safeFallbackFromResult(result)!;
    const packet = buildContextPacket(packetInput({ ...upgrade, knowledgeReferences: toContextReferences(result) }));

    expect(validateContextPacket(packet).ok).toBe(true);
    expect(packet.degraded?.reasons).toEqual(['knowledge_unavailable']);
    expect(packet.degraded?.safeFallbackInstruction).toContain('could not be reached');
    expect(packet.approvedKnowledge).toEqual([]);
  });
});

describe('P4.9 static safe-fallback governance boundary', () => {
  const modulePath = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'safeFallback.ts');
  const source = readFileSync(modulePath, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');

  it('imports no store/Gateway/LLM, reads no clock, assembles no packet', () => {
    expect(/from\s+['"][^'"]*(?:mongoose|mongodb|neo4j-driver|chromadb|\/services\/gateway|anthropic|openai)/i.test(source)).toBe(false);
    expect(/\bDate\.now\s*\(|\bnew\s+Date\s*\(/.test(source)).toBe(false);
    expect(/buildContextPacket\s*\(/.test(source)).toBe(false);
  });
});
