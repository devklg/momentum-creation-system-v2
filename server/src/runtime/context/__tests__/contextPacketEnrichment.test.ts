import { describe, expect, it } from 'vitest';
import type {
  McsApprovedKnowledgeExcludedItem,
  McsApprovedKnowledgeQueryRequest,
  TmagId,
  McsContextExclusion,
  McsContextExclusionReason,
  McsContextPacketId,
  McsContextRequestId,
  McsKnowledgeId,
  McsKnowledgeReference,
  McsRuntimeRequestScope,
  McsSessionId,
  McsSourceId,
  McsTeamId,
  McsTenantId,
} from '@momentum/shared/runtime';
import {
  APPROVED_KNOWLEDGE_QUERY_SCHEMA_VERSION,
  createContextManagerRetrievalAdapter,
  toContextReferences,
  type ApprovedKnowledgeProvider,
} from '../index.js';
import { buildContextPacket, validateContextPacket, type ContextPacketBuildInput } from '../contextManager.js';
import { TEAM_MAGNIFICENT_KEY, TEAM_MAGNIFICENT_NAME } from '../validation.js';

function scope(): McsRuntimeRequestScope {
  return {
    tenantId: 'tenant_team_magnificent' as McsTenantId,
    teamId: 'team_magnificent' as McsTeamId,
    teamKey: TEAM_MAGNIFICENT_KEY,
    teamName: TEAM_MAGNIFICENT_NAME,
    tmagId: 'TMAG-P45-001' as TmagId,
  };
}

function request(overrides: Partial<McsApprovedKnowledgeQueryRequest> = {}): McsApprovedKnowledgeQueryRequest {
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

function knowledge(id: string, overrides: Partial<McsKnowledgeReference> = {}): McsKnowledgeReference {
  return {
    knowledgeId: `knowledge_p45_${id}` as McsKnowledgeId,
    domain: 'training',
    status: 'approved',
    language: 'en',
    translationStatus: 'same_language',
    sourceId: `source_p45_${id}` as McsSourceId,
    ...overrides,
  };
}

function providerReturning(references: readonly McsKnowledgeReference[]): ApprovedKnowledgeProvider {
  return {
    async listApprovedKnowledge() {
      return references;
    },
  };
}

function providerThrowing(): ApprovedKnowledgeProvider {
  return {
    async listApprovedKnowledge() {
      throw new Error('approved knowledge boundary unavailable');
    },
  };
}

function exclusionsFromAdapter(excluded: readonly McsApprovedKnowledgeExcludedItem[]): McsContextExclusion[] {
  return excluded.map((item) => ({
    sourceId: item.sourceId,
    reason: packetExclusionReason(item.reason),
    description: 'Excluded by approved_knowledge_query.v1 before packet assembly.',
  }));
}

function packetExclusionReason(reason: McsApprovedKnowledgeExcludedItem['reason']): McsContextExclusionReason {
  if (reason === 'queued_for_review') return 'not_review_workflow';
  return reason;
}

function packetInput(overrides: Partial<ContextPacketBuildInput> = {}): ContextPacketBuildInput {
  return {
    packetId: 'ctx_packet_p45_001' as McsContextPacketId,
    requestId: 'ctx_req_p45_001' as McsContextRequestId,
    tenant: {
      tenantId: 'tenant_team_magnificent' as McsTenantId,
      tenantName: 'Team Magnificent Tenant',
      brandName: TEAM_MAGNIFICENT_NAME,
      environment: 'development',
    },
    team: {
      teamId: 'team_magnificent' as McsTeamId,
      teamKey: TEAM_MAGNIFICENT_KEY,
      teamName: TEAM_MAGNIFICENT_NAME,
    },
    ba: {
      tenantId: 'tenant_team_magnificent' as McsTenantId,
      teamId: 'team_magnificent' as McsTeamId,
      teamKey: TEAM_MAGNIFICENT_KEY,
      teamName: TEAM_MAGNIFICENT_NAME,
      tmagId: 'TMAG-P45-001' as TmagId,
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
      sessionId: 'session_p45_001' as McsSessionId,
      mode: 'browser_text',
      status: 'active',
      taskType: 'training_support',
      startedAt: '2026-06-29T12:00:00.000Z',
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
      requestId: 'ctx_req_p45_001' as McsContextRequestId,
      componentVersion: 's1.5',
      traceId: 'trace_p45_001',
    },
    createdAt: '2026-06-29T12:00:01.000Z',
    ...overrides,
  };
}

describe('P4.5 context packet enrichment', () => {
  it('enriches context_packet.v1 from approved retrieval results with traceable audit entries', async () => {
    const leakedCandidate = knowledge('candidate', {
      status: 'candidate' as McsKnowledgeReference['status'],
    });
    const adapter = createContextManagerRetrievalAdapter(
      providerReturning([knowledge('001'), leakedCandidate, knowledge('002')]),
    );

    const result = await adapter.retrieveApprovedKnowledge(request());
    const packet = buildContextPacket(packetInput({
      knowledgeReferences: toContextReferences(result),
      excludedKnowledge: exclusionsFromAdapter(result.excluded),
    }));

    expect(validateContextPacket(packet).ok).toBe(true);
    expect(result.references.map((item) => item.knowledgeId)).toEqual([
      'knowledge_p45_001',
      'knowledge_p45_002',
    ]);
    expect(packet.approvedKnowledge.map((item) => item.knowledgeId)).toEqual([
      'knowledge_p45_001',
      'knowledge_p45_002',
    ]);
    expect(packet.approvedKnowledge.map((item) => item.sourceTraceability.sourceId)).toEqual([
      'source_p45_001',
      'source_p45_002',
    ]);
    expect(packet.retrievalAudit.includedKnowledgeIds).toEqual(packet.approvedKnowledge.map((item) => item.knowledgeId));
    expect(packet.retrievalAudit.includedItems).toEqual([
      {
        sourceId: 'source_p45_001',
        method: 'direct_reference',
        included: true,
        reasonCodes: ['agent_task_match'],
      },
      {
        sourceId: 'source_p45_002',
        method: 'direct_reference',
        included: true,
        reasonCodes: ['agent_task_match'],
      },
    ]);
    expect(packet.exclusions).toEqual([
      {
        sourceId: 'source_p45_candidate',
        reason: 'candidate_not_approved',
        description: 'Excluded by approved_knowledge_query.v1 before packet assembly.',
      },
    ]);
    expect(packet.retrievalAudit.candidateKnowledgeIncluded).toBe(false);
    expect(packet.retrievalAudit.excludedSourceIds).toEqual(['source_p45_candidate']);
  });

  it('assembles a degraded fail-closed packet with no approved knowledge and explicit fallback state', async () => {
    const adapter = createContextManagerRetrievalAdapter(providerThrowing());

    const result = await adapter.retrieveApprovedKnowledge(request());
    const packetStatus = result.status === 'degraded' ? 'degraded' : 'complete';
    const packet = buildContextPacket(packetInput({
      packetStatus,
      knowledgeReferences: toContextReferences(result),
      excludedKnowledge: exclusionsFromAdapter(result.excluded),
    }));

    expect(result.status).toBe('degraded');
    expect(packet.packetStatus).toBe('degraded');
    expect(packet.approvedKnowledge).toEqual([]);
    expect(packet.retrievalAudit.includedKnowledgeIds).toEqual([]);
    expect(packet.retrievalAudit.degraded).toBe(true);
    expect(packet.degraded?.reasons).toContain('knowledge_unavailable');
    expect(packet.degraded?.missingSections).toContain('approvedKnowledge');
    expect(packet.degraded?.safeFallbackInstruction).toContain('do not infer missing knowledge');
    expect(validateContextPacket(packet).ok).toBe(true);
  });
});
