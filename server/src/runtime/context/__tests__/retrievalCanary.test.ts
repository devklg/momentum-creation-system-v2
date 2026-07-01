import { describe, expect, it } from 'vitest';
import type {
  ApprovedKnowledgeQueryRequest,
  BaId,
  KnowledgeDomain,
  KnowledgeFreshness,
  KnowledgeId,
  KnowledgeReference,
  RawKnowledgeSource,
  RuntimeLanguage,
  RuntimeRequestScope,
  RuntimeScope,
  SessionId,
  SourceId,
  TeamId,
  TenantId,
} from '@momentum/shared/runtime';
import {
  APPROVED_KNOWLEDGE_QUERY_SCHEMA_VERSION,
  createContextManagerRetrievalAdapter,
  resolveNextTrainingStep,
  safeFallbackFromResult,
  toContextReferences,
  type ApprovedKnowledgeProvider,
  type RetrievalObservabilityRecord,
} from '../index.js';
import {
  buildContextPacket,
  validateContextPacket,
  type ContextPacketBuildInput,
} from '../contextManager.js';
import { TEAM_MAGNIFICENT_KEY, TEAM_MAGNIFICENT_NAME } from '../validation.js';
import {
  consumeContextPacket,
  selectMichaelResponseCatalogEntry,
  type MichaelResponseCatalogSelectionRequest,
} from '../../orchestration/index.js';
import { chunksToKnowledgeReferences, ingestRawKnowledgeSource } from '../../knowledge/intake/index.js';

const NOW = new Date('2026-06-30T12:00:00.000Z');
const MICHAEL = 'michael_magnificent';

// ── fixtures ────────────────────────────────────────────────────────────────

function scope(): RuntimeRequestScope {
  return {
    tenantId: 'tenant_team_magnificent' as TenantId,
    teamId: 'team_magnificent' as TeamId,
    teamKey: TEAM_MAGNIFICENT_KEY,
    teamName: TEAM_MAGNIFICENT_NAME,
    baId: 'TMBA-P411-001' as BaId,
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

interface KOpts {
  language?: RuntimeLanguage;
  translationStatus?: KnowledgeReference['translationStatus'];
  domain?: KnowledgeDomain;
  status?: KnowledgeReference['status'];
  freshness?: KnowledgeFreshness;
}

function knowledge(id: string, opts: KOpts = {}): KnowledgeReference {
  return {
    knowledgeId: `knowledge_p411_${id}` as KnowledgeId,
    domain: opts.domain ?? 'training',
    status: opts.status ?? 'approved',
    language: opts.language ?? 'en',
    translationStatus: opts.translationStatus ?? 'same_language',
    sourceId: `source_p411_${id}` as SourceId,
    ...(opts.freshness ? { freshness: opts.freshness } : {}),
  };
}

function providerReturning(references: readonly KnowledgeReference[]): ApprovedKnowledgeProvider {
  return { async listApprovedKnowledge() { return references; } };
}

function adapterFor(references: readonly KnowledgeReference[], sink?: (r: RetrievalObservabilityRecord) => void) {
  return createContextManagerRetrievalAdapter(providerReturning(references), {
    now: () => NOW,
    ...(sink ? { onRetrievalObservability: sink } : {}),
  });
}

function packetInput(language: RuntimeLanguage, overrides: Partial<ContextPacketBuildInput> = {}): ContextPacketBuildInput {
  return {
    packetId: 'ctx_packet_p411' as ContextPacketBuildInput['packetId'],
    requestId: 'ctx_req_p411' as ContextPacketBuildInput['requestId'],
    tenant: { tenantId: 'tenant_team_magnificent' as TenantId, tenantName: 'TM', brandName: TEAM_MAGNIFICENT_NAME, environment: 'development' },
    team: { teamId: 'team_magnificent' as TeamId, teamKey: TEAM_MAGNIFICENT_KEY, teamName: TEAM_MAGNIFICENT_NAME },
    ba: {
      tenantId: 'tenant_team_magnificent' as TenantId,
      teamId: 'team_magnificent' as TeamId,
      teamKey: TEAM_MAGNIFICENT_KEY,
      teamName: TEAM_MAGNIFICENT_NAME,
      baId: 'TMBA-P411-001' as BaId,
      journalEnabled: false,
      languagePreference: language,
      permissions: {
        canUsePrivateJournal: false,
        canSelectJournalForReview: false,
        canCreateKnowledgeCandidate: false,
        canAccessRelationshipContext: false,
        canUseBrowserVoice: false,
        canUseBrowserText: true,
      },
    },
    session: { sessionId: 'session_p411' as SessionId, mode: 'browser_text', status: 'active', taskType: 'training_support', startedAt: '2026-06-30T12:00:00.000Z' },
    agentKey: MICHAEL,
    objective: 'training_support',
    language: { primary: language, userPreference: language, translationAllowed: true, translationStatus: 'same_language', machineTranslationUsed: false, humanReviewed: true },
    provenance: { assembledBy: 'context_manager', requestId: 'ctx_req_p411' as ContextPacketBuildInput['requestId'], componentVersion: 's1.5', traceId: 'trace_p411' },
    createdAt: '2026-06-30T12:00:01.000Z',
    ...overrides,
  };
}

/** Assemble the packet exactly as the Context Manager would from a retrieval result. */
function assembledPacket(result: Awaited<ReturnType<ReturnType<typeof adapterFor>['retrieveApprovedKnowledge']>>, language: RuntimeLanguage) {
  const upgrade = safeFallbackFromResult(result); // null when ok; { packetStatus, degraded } when degraded
  return buildContextPacket(packetInput(language, {
    knowledgeReferences: toContextReferences(result),
    ...(upgrade ?? {}),
  }));
}

/**
 * Build the Michael selection request from the CONSUMED packet status — callers pass
 * `consumption.packetStatus` (the real output of `consumeContextPacket`) and `packet.language`,
 * so the packet genuinely drives the selection (no hand-picked literal). The
 * scenarioFamily/responseType mapping is the documented orchestration contract
 * (michaelRuntimeAdapterContract): complete→substantive, degraded→safe_fallback, failed→safe_close.
 */
function selectionFromPacketStatus(
  packetStatus: 'complete' | 'degraded' | 'failed',
  language: RuntimeLanguage,
  clarity: 'clear' | 'ambiguous' = 'clear',
): MichaelResponseCatalogSelectionRequest {
  if (packetStatus === 'complete') {
    const ambiguous = clarity === 'ambiguous';
    return {
      agentKey: MICHAEL,
      taskType: 'training_support',
      language,
      responseType: ambiguous ? 'clarification_question' : 'next_training_step',
      scenarioFamily: 'complete',
      contextPacketStatus: 'complete',
      intent: ambiguous ? 'ambiguous_training_support' : 'clear_training_support',
    };
  }
  if (packetStatus === 'degraded') {
    return { agentKey: MICHAEL, taskType: 'training_support', language, responseType: 'safe_fallback', scenarioFamily: 'degraded', contextPacketStatus: 'degraded' };
  }
  return { agentKey: MICHAEL, taskType: 'training_support', language, responseType: 'safe_close', scenarioFamily: 'failed', contextPacketStatus: 'failed' };
}

const OBSERVABILITY_KEYS = new Set([
  'schemaVersion', 'observedAt', 'scope', 'objective', 'domains', 'requestedLanguage',
  'allowLanguageFallback', 'outcome', 'degradeReasons', 'stageCounts', 'freshnessExclusions',
  'language', 'fallbackUsed', 'machineTranslationUsed', 'selectedKnowledgeIds', 'candidateExcludedSourceIds',
]);

// ── Scenario 1 — empty / degraded → safe fallback ─────────────────────────────

describe('P4.11 canary — Scenario 1: empty knowledge fails closed into safe fallback', () => {
  it('empty approved knowledge → degraded packet → michael_safe_fallback_degraded_en → unavailable step', async () => {
    const result = await adapterFor([]).retrieveApprovedKnowledge(request());
    expect(result.status).toBe('degraded');
    expect(result.metadata.degradeReasons).toContain('no_approved_match');

    const packet = assembledPacket(result, 'en');
    expect(validateContextPacket(packet).ok).toBe(true);
    expect(packet.packetStatus).toBe('degraded');
    expect(packet.approvedKnowledge).toEqual([]);
    // The P4.9 reason-aware safe fallback propagated into the packet's degraded state.
    expect(packet.degraded?.reasons).toContain('knowledge_unavailable');
    expect(packet.degraded?.safeFallbackInstruction).toContain('No approved knowledge matched this objective');

    const consumption = consumeContextPacket({ expectedAgentKey: MICHAEL, packet });
    expect(consumption.decision).toBe('degraded');
    expect(consumption.packetStatus).toBe('degraded');

    // Selection is driven by the REAL consumed packet status — not a hand-picked literal.
    const selection = selectMichaelResponseCatalogEntry(
      selectionFromPacketStatus(consumption.packetStatus!, packet.language.primary),
    );
    expect(selection.ok).toBe(true);
    if (selection.ok) expect(selection.catalogKey).toBe('michael_safe_fallback_degraded_en');

    const step = resolveNextTrainingStep({ result });
    expect(step.status).toBe('unavailable');
    expect(step.safeFallback?.missingSections).toEqual(['approvedKnowledge']);
  });
});

// ── Scenario 2 — approved available → substantive selection ───────────────────

describe('P4.11 canary — Scenario 2: approved knowledge drives substantive selection', () => {
  it('approved fresh en training knowledge → complete packet → michael_next_training_step_en → resolved step', async () => {
    const result = await adapterFor([knowledge('a'), knowledge('b')]).retrieveApprovedKnowledge(request());
    expect(result.status).toBe('ok');

    const packet = assembledPacket(result, 'en');
    expect(packet.packetStatus).toBe('complete');
    expect(packet.approvedKnowledge.map((k) => k.knowledgeId)).toEqual(['knowledge_p411_a', 'knowledge_p411_b']);

    const consumption = consumeContextPacket({ expectedAgentKey: MICHAEL, packet });
    expect(consumption.decision).toBe('proceed');
    expect(consumption.packetStatus).toBe('complete');

    const selection = selectMichaelResponseCatalogEntry(
      selectionFromPacketStatus(consumption.packetStatus!, packet.language.primary),
    );
    expect(selection.ok).toBe(true);
    if (selection.ok) {
      expect(selection.catalogKey).toBe('michael_next_training_step_en');
      expect(selection.response.responseType).toBe('next_training_step');
    }

    const step = resolveNextTrainingStep({ result });
    expect(step.status).toBe('resolved');
    expect(step.step?.knowledgeId).toBe('knowledge_p411_a');
  });
});

// ── Scenario 3 — exclusion controls ───────────────────────────────────────────

describe('P4.11 canary — Scenario 3: excluded knowledge never enters the Context Packet', () => {
  it('only the approved-active-fresh-scoped reference survives; observability counts exclusions content-free', async () => {
    const records: RetrievalObservabilityRecord[] = [];
    const mix: KnowledgeReference[] = [
      knowledge('ok'),
      { ...knowledge('candidate'), status: 'candidate' as KnowledgeReference['status'] },
      { ...knowledge('review'), status: 'queued_for_review' as KnowledgeReference['status'] },
      { ...knowledge('rejected'), status: 'rejected' as KnowledgeReference['status'] },
      { ...knowledge('archived'), status: 'archived' as KnowledgeReference['status'] },
      knowledge('deprecated', { freshness: { lifecycle: 'deprecated' } }),
      knowledge('stale', { freshness: { updatedAt: '2020-01-01T00:00:00.000Z' } }),
      knowledge('wronglang', { language: 'es' }),
      knowledge('wrongdomain', { domain: 'relationship' }),
    ];
    const result = await adapterFor(mix, (r) => records.push(r)).retrieveApprovedKnowledge(
      request({ freshness: { maxAgeDays: 10 } }),
    );

    expect(result.status).toBe('ok');
    expect(result.references.map((r) => r.knowledgeId)).toEqual(['knowledge_p411_ok']);
    // Non-approved statuses are recorded as exclusions, never returned.
    expect(result.excluded.map((e) => e.sourceId).sort()).toEqual(
      ['source_p411_archived', 'source_p411_candidate', 'source_p411_rejected', 'source_p411_review'].sort(),
    );

    const packet = assembledPacket(result, 'en');
    expect(packet.approvedKnowledge.map((k) => k.knowledgeId)).toEqual(['knowledge_p411_ok']);
    expect(consumeContextPacket({ expectedAgentKey: MICHAEL, packet }).decision).toBe('proceed');

    const record = records[0]!;
    expect(record.stageCounts).toEqual({ raw: 9, candidateExcluded: 4, statusDomainKept: 4, freshKept: 2, selected: 1 });
    expect(record.freshnessExclusions).toEqual({ deprecated: 1, stale: 1 });
    // Content-free: only sanctioned keys, no body/summary/text.
    for (const key of Object.keys(record)) expect(OBSERVABILITY_KEYS.has(key), key).toBe(true);
    expect(JSON.stringify(record)).not.toMatch(/summary|"text"|body|content/i);
  });

  it('a parse-failed source maps to zero references (P4.5A intake), so it can never enter retrieval', () => {
    const source: RawKnowledgeSource = {
      sourceId: 'source_p411_parsefail' as SourceId,
      title: 'Empty',
      sourceType: 'note',
      format: 'markdown',
      originalContent: '   \n\t  \n',
      createdBy: 'TM-01',
      createdAt: '2026-06-30T12:00:00.000Z',
      language: 'en',
      domain: 'training',
      scope: scope() as RuntimeScope,
      version: 1,
      status: 'active',
    };
    const { document, chunks } = ingestRawKnowledgeSource(source);
    expect(document.parseStatus).toBe('parse_failed');
    expect(chunks).toEqual([]);
    expect(chunksToKnowledgeReferences(chunks)).toEqual([]);
  });

  it('all-excluded input degrades safely (no approved reference survives)', async () => {
    const result = await adapterFor([
      { ...knowledge('candidate'), status: 'candidate' as KnowledgeReference['status'] },
      knowledge('deprecated', { freshness: { lifecycle: 'deprecated' } }),
    ]).retrieveApprovedKnowledge(request());
    expect(result.status).toBe('degraded');
    const packet = assembledPacket(result, 'en');
    expect(packet.approvedKnowledge).toEqual([]);
    const consumption = consumeContextPacket({ expectedAgentKey: MICHAEL, packet });
    expect(consumption.decision).toBe('degraded');
    const selection = selectMichaelResponseCatalogEntry(
      selectionFromPacketStatus(consumption.packetStatus!, packet.language.primary),
    );
    expect(selection.ok && selection.catalogKey).toBe('michael_safe_fallback_degraded_en');
  });

  it('retrieval is scope-bound: the provider (Knowledge Core boundary) receives the request scope', async () => {
    // Scope enforcement lives at the provider boundary — the adapter forwards request.scope to
    // listApprovedKnowledge and never widens it. This proves scope-bound retrieval (not a
    // post-hoc adapter scope filter, which does not and should not exist).
    let seenScope: RuntimeRequestScope | undefined;
    const provider: ApprovedKnowledgeProvider = {
      async listApprovedKnowledge(s) { seenScope = s; return [knowledge('a')]; },
    };
    const adapter = createContextManagerRetrievalAdapter(provider, { now: () => NOW });
    const req = request();
    await adapter.retrieveApprovedKnowledge(req);
    expect(seenScope).toEqual(req.scope);
  });
});

// ── Scenario 4 — language / fallback ──────────────────────────────────────────

describe('P4.11 canary — Scenario 4: language and fallback behavior', () => {
  it('en and es same-language requests select the language-specific fixture', async () => {
    const en = await adapterFor([knowledge('en1')]).retrieveApprovedKnowledge(request());
    const enPacket = assembledPacket(en, 'en');
    const enConsume = consumeContextPacket({ expectedAgentKey: MICHAEL, packet: enPacket });
    expect(enConsume.decision).toBe('proceed');
    const enSel = selectMichaelResponseCatalogEntry(
      selectionFromPacketStatus(enConsume.packetStatus!, enPacket.language.primary),
    );
    expect(enSel.ok && enSel.catalogKey).toBe('michael_next_training_step_en');
    expect(enPacket.approvedKnowledge[0]?.language).toBe('en');

    const es = await adapterFor([knowledge('es1', { language: 'es' })]).retrieveApprovedKnowledge(request({ language: 'es' }));
    const esPacket = assembledPacket(es, 'es');
    const esConsume = consumeContextPacket({ expectedAgentKey: MICHAEL, packet: esPacket });
    const esSel = selectMichaelResponseCatalogEntry(
      selectionFromPacketStatus(esConsume.packetStatus!, esPacket.language.primary),
    );
    expect(esSel.ok && esSel.catalogKey).toBe('michael_next_training_step_es');
    expect(esPacket.approvedKnowledge[0]?.language).toBe('es');
  });

  it('a machine-translated fallback is MARKED in the packet, never laundered as native', async () => {
    const result = await adapterFor([knowledge('esmt', { language: 'es', translationStatus: 'machine_translation_marked' })])
      .retrieveApprovedKnowledge(request({ allowLanguageFallback: true }));
    expect(result.status).toBe('ok');
    expect(result.metadata.language.machineTranslationUsed).toBe(true);

    const packet = assembledPacket(result, 'en');
    const item = packet.approvedKnowledge[0];
    expect(item?.language).toBe('es');
    expect(item?.retrieval.translationStatus).toBe('machine_translation_marked');
    expect(item?.retrieval.translationStatus).not.toBe('same_language');
  });

  it('an unsupported language request fails closed (rejected by the query contract)', async () => {
    const adapter = adapterFor([knowledge('a')]);
    await expect(
      adapter.retrieveApprovedKnowledge(request({ language: 'fr' as RuntimeLanguage })),
    ).rejects.toThrow();
  });
});
