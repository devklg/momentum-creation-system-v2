import { describe, expect, it } from 'vitest';
import type {
  ApprovedKnowledgeQueryRequest,
  ApprovedKnowledgeQueryResult,
  TmagId,
  KnowledgeId,
  KnowledgeReference,
  RuntimeLanguage,
  RuntimeRequestScope,
  RuntimeTranslationStatus,
  SessionId,
  SourceId,
  TeamId,
  TenantId,
} from '@momentum/shared/runtime';
import {
  otherLanguage,
  resolveLanguageSelection,
} from '../languageAwareRetrieval.js';
import {
  APPROVED_KNOWLEDGE_QUERY_SCHEMA_VERSION,
  createContextManagerRetrievalAdapter,
  toContextReferences,
  type ApprovedKnowledgeProvider,
} from '../index.js';
import {
  buildContextPacket,
  validateContextPacket,
  type ContextPacketBuildInput,
} from '../contextManager.js';
import { TEAM_MAGNIFICENT_KEY, TEAM_MAGNIFICENT_NAME } from '../validation.js';

function scope(): RuntimeRequestScope {
  return {
    tenantId: 'tenant_team_magnificent' as TenantId,
    teamId: 'team_magnificent' as TeamId,
    teamKey: TEAM_MAGNIFICENT_KEY,
    teamName: TEAM_MAGNIFICENT_NAME,
    tmagId: 'TMBA-P46-001' as TmagId,
  };
}

function request(overrides: Partial<ApprovedKnowledgeQueryRequest> = {}): ApprovedKnowledgeQueryRequest {
  return {
    schemaVersion: APPROVED_KNOWLEDGE_QUERY_SCHEMA_VERSION,
    scope: scope(),
    objective: 'training_support',
    domains: ['training'],
    language: 'en',
    allowLanguageFallback: false,
    ...overrides,
  };
}

function knowledge(
  id: string,
  language: RuntimeLanguage,
  translationStatus: RuntimeTranslationStatus,
): KnowledgeReference {
  return {
    knowledgeId: `knowledge_p46_${id}` as KnowledgeId,
    domain: 'training',
    status: 'approved',
    language,
    translationStatus,
    sourceId: `source_p46_${id}` as SourceId,
  };
}

function providerReturning(references: readonly KnowledgeReference[]): ApprovedKnowledgeProvider {
  return {
    async listApprovedKnowledge() {
      return references;
    },
  };
}

function languageContextFrom(
  metadata: ApprovedKnowledgeQueryResult['metadata']['language'],
): ContextPacketBuildInput['language'] {
  return {
    primary: metadata.language,
    userPreference: metadata.language,
    fallback: metadata.fallbackLanguage,
    fallbackReason: metadata.fallbackReason,
    translationAllowed: true,
    translationStatus: metadata.translationStatus,
    machineTranslationUsed: metadata.machineTranslationUsed,
    humanReviewed: metadata.humanReviewed,
  };
}

function packetInput(overrides: Partial<ContextPacketBuildInput> = {}): ContextPacketBuildInput {
  return {
    packetId: 'ctx_packet_p46_001' as ContextPacketBuildInput['packetId'],
    requestId: 'ctx_req_p46_001' as ContextPacketBuildInput['requestId'],
    tenant: {
      tenantId: 'tenant_team_magnificent' as TenantId,
      tenantName: 'Team Magnificent Tenant',
      brandName: TEAM_MAGNIFICENT_NAME,
      environment: 'development',
    },
    team: {
      teamId: 'team_magnificent' as TeamId,
      teamKey: TEAM_MAGNIFICENT_KEY,
      teamName: TEAM_MAGNIFICENT_NAME,
    },
    ba: {
      tenantId: 'tenant_team_magnificent' as TenantId,
      teamId: 'team_magnificent' as TeamId,
      teamKey: TEAM_MAGNIFICENT_KEY,
      teamName: TEAM_MAGNIFICENT_NAME,
      tmagId: 'TMBA-P46-001' as TmagId,
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
    session: {
      sessionId: 'session_p46_001' as SessionId,
      mode: 'browser_text',
      status: 'active',
      taskType: 'training_support',
      startedAt: '2026-06-30T12:00:00.000Z',
    },
    agentKey: 'michael_magnificent',
    objective: 'training_support',
    language: {
      primary: 'en',
      userPreference: 'en',
      translationAllowed: false,
      translationStatus: 'same_language',
      machineTranslationUsed: false,
      humanReviewed: true,
    },
    provenance: {
      assembledBy: 'context_manager',
      requestId: 'ctx_req_p46_001' as ContextPacketBuildInput['requestId'],
      componentVersion: 's1.5',
      traceId: 'trace_p46_001',
    },
    createdAt: '2026-06-30T12:00:01.000Z',
    ...overrides,
  };
}

describe('P4.6 resolveLanguageSelection — priority ladder within/across language', () => {
  it('picks primary-language native and never falls back when native exists', () => {
    const selection = resolveLanguageSelection(
      [knowledge('en1', 'en', 'same_language'), knowledge('es1', 'es', 'same_language')],
      request({ allowLanguageFallback: true }),
    );
    expect(selection.status).toBe('ok');
    expect(selection.fallbackUsed).toBe(false);
    expect(selection.references.map((r) => r.knowledgeId)).toEqual(['knowledge_p46_en1']);
    expect(selection.language.translationStatus).toBe('same_language');
    expect(selection.language.fallbackLanguage).toBeUndefined();
  });

  it('MARKS a machine translation that is already in the primary language (never native)', () => {
    // The critical regression: an MT *into* en must not be laundered into same_language.
    const selection = resolveLanguageSelection(
      [knowledge('enMT', 'en', 'machine_translation_marked')],
      request(),
    );
    expect(selection.status).toBe('ok');
    expect(selection.fallbackUsed).toBe(false);
    expect(selection.language.fallbackLanguage).toBeUndefined();
    expect(selection.language.translationStatus).toBe('machine_translation_marked');
    expect(selection.language.machineTranslationUsed).toBe(true);
    expect(selection.language.humanReviewed).toBe(false);
  });

  it('within the primary language, native is preferred and machine items are dropped', () => {
    const selection = resolveLanguageSelection(
      [knowledge('enMT', 'en', 'machine_translation_marked'), knowledge('enN', 'en', 'same_language')],
      request(),
    );
    expect(selection.references.map((r) => r.knowledgeId)).toEqual(['knowledge_p46_enN']);
    expect(selection.language.translationStatus).toBe('same_language');
    expect(selection.language.machineTranslationUsed).toBe(false);
  });

  it('fails closed on a primary-language clarification_required item (ask-clarify tier)', () => {
    const selection = resolveLanguageSelection(
      [knowledge('enC', 'en', 'clarification_required')],
      request(),
    );
    expect(selection.status).toBe('degraded');
    expect(selection.references).toEqual([]);
    expect(selection.degradeReason).toBe('language_unavailable');
  });

  it('degrades (fail-closed) on primary-language miss when fallback is disallowed', () => {
    const selection = resolveLanguageSelection(
      [knowledge('es1', 'es', 'human_reviewed_translation')],
      request({ allowLanguageFallback: false }),
    );
    expect(selection.status).toBe('degraded');
    expect(selection.references).toEqual([]);
    expect(selection.fallbackUsed).toBe(false);
  });

  it('delivers native fallback-language content marked same_language with a fallback language', () => {
    const selection = resolveLanguageSelection(
      [knowledge('es1', 'es', 'same_language')],
      request({ allowLanguageFallback: true }),
    );
    expect(selection.status).toBe('ok');
    expect(selection.fallbackUsed).toBe(true);
    expect(selection.language).toMatchObject({
      language: 'en',
      fallbackLanguage: 'es',
      fallbackReason: 'same_language_unavailable',
      translationStatus: 'same_language',
      machineTranslationUsed: false,
    });
  });

  it('delivers a human-reviewed fallback translation and marks it accordingly', () => {
    const selection = resolveLanguageSelection(
      [knowledge('es1', 'es', 'human_reviewed_translation')],
      request({ allowLanguageFallback: true }),
    );
    expect(selection.language).toMatchObject({
      fallbackLanguage: 'es',
      translationStatus: 'human_reviewed_translation',
      fallbackReason: 'same_language_unavailable',
      machineTranslationUsed: false,
      humanReviewed: true,
    });
  });

  it('delivers a MARKED machine fallback translation and sets machineTranslationUsed', () => {
    const selection = resolveLanguageSelection(
      [knowledge('es1', 'es', 'machine_translation_marked')],
      request({ allowLanguageFallback: true }),
    );
    expect(selection.language).toMatchObject({
      fallbackLanguage: 'es',
      translationStatus: 'machine_translation_marked',
      fallbackReason: 'machine_translation_marked',
      machineTranslationUsed: true,
      humanReviewed: false,
    });
  });

  it('within the fallback language, prefers native > human > machine', () => {
    const selection = resolveLanguageSelection(
      [
        knowledge('esM', 'es', 'machine_translation_marked'),
        knowledge('esH', 'es', 'human_reviewed_translation'),
        knowledge('esN', 'es', 'same_language'),
      ],
      request({ allowLanguageFallback: true }),
    );
    expect(selection.references.map((r) => r.knowledgeId)).toEqual(['knowledge_p46_esN']);
    expect(selection.language.translationStatus).toBe('same_language');
    expect(selection.language.machineTranslationUsed).toBe(false);
  });

  it('delivers a language-neutral fallback template tier when only neutral fallback exists', () => {
    const selection = resolveLanguageSelection(
      [knowledge('esT', 'es', 'language_neutral_template')],
      request({ allowLanguageFallback: true }),
    );
    expect(selection.language.translationStatus).toBe('language_neutral_template');
    expect(selection.language.fallbackReason).toBe('language_neutral_template');
  });

  it('fails closed when only clarification_required fallback exists', () => {
    const selection = resolveLanguageSelection(
      [knowledge('esC', 'es', 'clarification_required')],
      request({ allowLanguageFallback: true }),
    );
    expect(selection.status).toBe('degraded');
    expect(selection.references).toEqual([]);
  });

  it('otherLanguage flips en<->es', () => {
    expect(otherLanguage('en')).toBe('es');
    expect(otherLanguage('es')).toBe('en');
  });
});

describe('P4.6 through the adapter and into the packet (compliance thread)', () => {
  it('same-language native request is unchanged (backward compatible marking)', async () => {
    const adapter = createContextManagerRetrievalAdapter(
      providerReturning([knowledge('en1', 'en', 'same_language')]),
    );
    const result = await adapter.retrieveApprovedKnowledge(request({ allowLanguageFallback: true }));
    expect(result.status).toBe('ok');
    expect(result.metadata.language.translationStatus).toBe('same_language');
    expect(result.metadata.language.fallbackLanguage).toBeUndefined();

    const packet = buildContextPacket(packetInput({ knowledgeReferences: toContextReferences(result) }));
    expect(validateContextPacket(packet).ok).toBe(true);
    expect(packet.approvedKnowledge[0]?.language).toBe('en');
    expect(packet.approvedKnowledge[0]?.retrieval.translationStatus).toBe('same_language');
  });

  it('a primary-language machine translation is marked in the packet, never native', async () => {
    // End-to-end proof of the critical fix: an MT already in en must NOT reach the packet as
    // same_language.
    const adapter = createContextManagerRetrievalAdapter(
      providerReturning([knowledge('enMT', 'en', 'machine_translation_marked')]),
    );
    const result = await adapter.retrieveApprovedKnowledge(request());
    expect(result.metadata.language.machineTranslationUsed).toBe(true);

    const packet = buildContextPacket(
      packetInput({
        knowledgeReferences: toContextReferences(result),
        language: languageContextFrom(result.metadata.language),
      }),
    );
    expect(validateContextPacket(packet).ok).toBe(true);
    const item = packet.approvedKnowledge[0];
    expect(item?.language).toBe('en');
    expect(item?.retrieval.translationStatus).toBe('machine_translation_marked');
    expect(item?.retrieval.translationStatus).not.toBe('same_language');
  });

  it('marks a machine-translated fallback item honestly in the packet (never same_language)', async () => {
    const adapter = createContextManagerRetrievalAdapter(
      providerReturning([knowledge('es1', 'es', 'machine_translation_marked')]),
    );
    const result = await adapter.retrieveApprovedKnowledge(request({ allowLanguageFallback: true }));

    expect(result.status).toBe('ok');
    expect(result.metadata.language.fallbackLanguage).toBe('es');
    expect(result.metadata.language.machineTranslationUsed).toBe(true);

    const packet = buildContextPacket(
      packetInput({
        knowledgeReferences: toContextReferences(result),
        language: languageContextFrom(result.metadata.language),
      }),
    );

    expect(validateContextPacket(packet).ok).toBe(true);
    const item = packet.approvedKnowledge[0];
    expect(item?.language).toBe('es');
    expect(item?.retrieval.translationStatus).toBe('machine_translation_marked');
    expect(item?.retrieval.translationStatus).not.toBe('same_language');
    expect(packet.retrievalAudit.languageFallbackUsed).toBe(true);
  });

  it('degrades to an empty fail-closed result when fallback is disallowed and language misses', async () => {
    const adapter = createContextManagerRetrievalAdapter(
      providerReturning([knowledge('es1', 'es', 'human_reviewed_translation')]),
    );
    const result = await adapter.retrieveApprovedKnowledge(request({ allowLanguageFallback: false }));
    expect(result.status).toBe('degraded');
    expect(result.references).toEqual([]);
    expect(result.metadata.degradeReasons).toContain('language_unavailable');
    expect(toContextReferences(result)).toEqual([]);
  });

  it('reports no_approved_match (not language_unavailable) when nothing matched in any language', async () => {
    const adapter = createContextManagerRetrievalAdapter(providerReturning([]));
    const result = await adapter.retrieveApprovedKnowledge(request({ allowLanguageFallback: true }));
    expect(result.status).toBe('degraded');
    expect(result.metadata.degradeReasons).toContain('no_approved_match');
  });
});
