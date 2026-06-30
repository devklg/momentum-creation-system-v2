import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type {
  ApprovedKnowledgeQueryRequest,
  BaId,
  ContextPacketId,
  ContextRequestId,
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
  ApprovedKnowledgeQueryValidationError,
  createContextManagerRetrievalAdapter,
  toContextReferences,
  type ApprovedKnowledgeProvider,
} from '../index.js';
import { buildContextPacket, type ContextPacketBuildInput } from '../contextManager.js';
import { TEAM_MAGNIFICENT_KEY, TEAM_MAGNIFICENT_NAME } from '../validation.js';

const thisDir = dirname(fileURLToPath(import.meta.url));
const adapterSource = readFileSync(resolve(thisDir, '../contextManagerRetrievalAdapter.ts'), 'utf8');

function baScope(): RuntimeRequestScope {
  return {
    tenantId: 'tenant_team_magnificent' as TenantId,
    teamId: 'team_magnificent' as TeamId,
    teamKey: TEAM_MAGNIFICENT_KEY,
    teamName: TEAM_MAGNIFICENT_NAME,
    baId: 'TMBA-20260101-ABC123' as BaId,
  };
}

function request(overrides: Partial<ApprovedKnowledgeQueryRequest> = {}): ApprovedKnowledgeQueryRequest {
  return {
    schemaVersion: APPROVED_KNOWLEDGE_QUERY_SCHEMA_VERSION,
    scope: baScope(),
    objective: 'training_support',
    domains: ['training'],
    language: 'en',
    allowLanguageFallback: false,
    ...overrides,
  };
}

function ref(id: string, over: Partial<KnowledgeReference> = {}): KnowledgeReference {
  return {
    knowledgeId: `k_${id}` as KnowledgeId,
    domain: 'training',
    status: 'approved',
    language: 'en',
    translationStatus: 'same_language',
    sourceId: `src_${id}` as SourceId,
    ...over,
  };
}

function providerReturning(refs: readonly KnowledgeReference[]): ApprovedKnowledgeProvider {
  return { async listApprovedKnowledge() { return refs; } };
}

function providerThrowing(): ApprovedKnowledgeProvider {
  return {
    async listApprovedKnowledge() {
      throw new Error('boundary unavailable');
    },
  };
}

describe('ContextManagerRetrievalAdapter — approved-only inclusion', () => {
  it('returns approved/active references as an ok result', async () => {
    const adapter = createContextManagerRetrievalAdapter(providerReturning([ref('1'), ref('2', { status: 'active' })]));
    const result = await adapter.retrieveApprovedKnowledge(request());
    expect(result.status).toBe('ok');
    expect(result.references).toHaveLength(2);
    expect(result.metadata.approvedCount).toBe(2);
    expect(result.metadata.candidateExcluded).toBe(true);
  });

  it('defensively excludes a non-approved reference and never returns it', async () => {
    // Provider misbehaves and leaks a candidate; the adapter must drop + record it.
    const leaked = ref('bad', { status: 'candidate' as KnowledgeReference['status'] });
    const adapter = createContextManagerRetrievalAdapter(providerReturning([ref('1'), leaked]));
    const result = await adapter.retrieveApprovedKnowledge(request());
    expect(result.references.map((r) => r.knowledgeId)).toEqual(['k_1']);
    expect(result.excluded).toEqual([{ sourceId: 'src_bad', reason: 'candidate_not_approved' }]);
    expect(result.metadata.candidateExcludedCount).toBe(1);
  });

  it('applies the domain filter (non-matching domain is not returned, not excluded)', async () => {
    const adapter = createContextManagerRetrievalAdapter(
      providerReturning([ref('1'), ref('2', { domain: 'relationship' })]),
    );
    const result = await adapter.retrieveApprovedKnowledge(request({ domains: ['training'] }));
    expect(result.references.map((r) => r.knowledgeId)).toEqual(['k_1']);
    expect(result.excluded).toHaveLength(0); // domain mismatch is not an exclusion
  });

  it('honors maxResults', async () => {
    const adapter = createContextManagerRetrievalAdapter(providerReturning([ref('1'), ref('2'), ref('3')]));
    const result = await adapter.retrieveApprovedKnowledge(request({ maxResults: 2 }));
    expect(result.references).toHaveLength(2);
  });
});

describe('ContextManagerRetrievalAdapter — fail-closed degradation', () => {
  it('degrades to empty approved knowledge when the boundary throws', async () => {
    const adapter = createContextManagerRetrievalAdapter(providerThrowing());
    const result = await adapter.retrieveApprovedKnowledge(request());
    expect(result.status).toBe('degraded');
    expect(result.references).toHaveLength(0);
    expect(result.metadata.degradeReasons).toContain('knowledge_unavailable');
  });

  it('degrades with no_approved_match when nothing matches', async () => {
    const adapter = createContextManagerRetrievalAdapter(providerReturning([]));
    const result = await adapter.retrieveApprovedKnowledge(request());
    expect(result.status).toBe('degraded');
    expect(result.metadata.degradeReasons).toContain('no_approved_match');
  });

  it('degrades with language_unavailable when only other-language approved knowledge exists', async () => {
    const adapter = createContextManagerRetrievalAdapter(providerReturning([ref('es1', { language: 'es' })]));
    const result = await adapter.retrieveApprovedKnowledge(request({ language: 'en' }));
    expect(result.status).toBe('degraded');
    expect(result.metadata.degradeReasons).toContain('language_unavailable');
    expect(result.references).toHaveLength(0); // fail-closed: no cross-language leak in P4.4
  });

  it('never rejects for a provider failure (resolves to a degraded result)', async () => {
    const adapter = createContextManagerRetrievalAdapter(providerThrowing());
    await expect(adapter.retrieveApprovedKnowledge(request())).resolves.toBeDefined();
  });

  it('rejects a malformed request (caller bug), not degrades', async () => {
    const adapter = createContextManagerRetrievalAdapter(providerReturning([ref('1')]));
    await expect(
      adapter.retrieveApprovedKnowledge(request({ language: 'fr' as ApprovedKnowledgeQueryRequest['language'] })),
    ).rejects.toBeInstanceOf(ApprovedKnowledgeQueryValidationError);
  });
});

describe('toContextReferences — feeds buildContextPacket as approved knowledge', () => {
  it('maps an ok result to approved_knowledge ContextReferences', async () => {
    const adapter = createContextManagerRetrievalAdapter(providerReturning([ref('1'), ref('2')]));
    const result = await adapter.retrieveApprovedKnowledge(request());
    const references = toContextReferences(result);
    expect(references).toHaveLength(2);
    for (const reference of references) {
      expect(reference.kind).toBe('approved_knowledge');
      expect(reference.status).toBe('approved');
    }
  });

  it('maps a degraded result to an empty reference list', async () => {
    const adapter = createContextManagerRetrievalAdapter(providerThrowing());
    const result = await adapter.retrieveApprovedKnowledge(request());
    expect(toContextReferences(result)).toEqual([]);
  });

  it('the produced references assemble into a valid context_packet.v1 with approved knowledge', async () => {
    const adapter = createContextManagerRetrievalAdapter(providerReturning([ref('1'), ref('2')]));
    const result = await adapter.retrieveApprovedKnowledge(request());
    const knowledgeReferences = toContextReferences(result);

    const input: ContextPacketBuildInput = {
      packetId: 'ctx_packet_p44_1' as ContextPacketId,
      requestId: 'ctx_req_p44_1' as ContextRequestId,
      tenant: {
        tenantId: 'tenant_team_magnificent' as TenantId,
        tenantName: 'Team Magnificent Tenant',
        brandName: TEAM_MAGNIFICENT_NAME,
        environment: 'development',
      },
      team: { teamId: 'team_magnificent' as TeamId, teamKey: TEAM_MAGNIFICENT_KEY, teamName: TEAM_MAGNIFICENT_NAME },
      ba: {
        tenantId: 'tenant_team_magnificent' as TenantId,
        teamId: 'team_magnificent' as TeamId,
        teamKey: TEAM_MAGNIFICENT_KEY,
        teamName: TEAM_MAGNIFICENT_NAME,
        baId: 'TMBA-20260101-ABC123' as BaId,
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
      session: { sessionId: 'sess_p44_1' as SessionId, mode: 'browser_text', status: 'active', taskType: 'training_support', startedAt: new Date(0).toISOString() },
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
      knowledgeReferences,
      provenance: { assembledBy: 'context_manager', requestId: 'ctx_req_p44_1' as ContextRequestId, componentVersion: 's1.5' },
    };

    const packet = buildContextPacket(input);
    expect(packet.approvedKnowledge).toHaveLength(2);
    expect(packet.retrievalAudit.candidateKnowledgeIncluded).toBe(false);
    expect(packet.retrievalAudit.candidateKnowledgeExcluded).toBe(true);
    expect(packet.approvedKnowledge.every((k) => k.governanceStatus === 'approved')).toBe(true);
  });
});

describe('ContextManagerRetrievalAdapter — store-free boundary', () => {
  it('imports no store/Gateway/persistence client and calls no store primitive', () => {
    const forbiddenImport =
      /\bfrom\s+['"][^'"]*(?:mongoose|mongodb|neo4j-driver|chromadb|graph-?rag|\/services\/gateway|\/services\/persistence|\/persistence\/|gatewayFallback|gateway-fallback)[^'"]*['"]/i;
    const forbiddenCall =
      /\b(?:new\s+MongoClient|mongoose\.connect|neo4j\.driver|new\s+ChromaClient|gatewayCall|tripleStackWrite|directPersistenceCall)\s*\(/;
    expect(adapterSource).not.toMatch(forbiddenImport);
    expect(adapterSource).not.toMatch(forbiddenCall);
  });

  it('never calls or accesses listCandidateKnowledgeForReview (candidate path is unreachable)', () => {
    // The provider type is narrowed to Pick<…, 'listApprovedKnowledge'>, so the candidate
    // method is structurally unreachable. Assert there is no call/property access to it
    // (the doc comment may NAME it to explain why it is excluded).
    expect(adapterSource).not.toMatch(/\.listCandidateKnowledgeForReview\b/);
    expect(adapterSource).not.toMatch(/listCandidateKnowledgeForReview\s*\(/);
  });
});
