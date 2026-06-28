import { describe, expect, it } from 'vitest';
import type {
  AgentId,
  BaId,
  ContextPacketId,
  ContextPacketV1,
  ContextRequestId,
  GuidedActionId,
  JournalEntryId,
  KnowledgeId,
  RelationshipContextId,
  RuntimeTurnId,
  SessionId,
  SourceId,
  TeamId,
  TenantId,
} from '@momentum/shared/runtime';
import {
  REQUIRED_CONTEXT_RUNTIME_RULE_IDS,
  assertValidContextPacketV1,
  contextPacketFoundationBoundary,
  prepareContextPacketFoundation,
  validateContextPacketV1,
} from '../index.js';

const tenantId = 'tenant_tm' as TenantId;
const teamId = 'team_tm' as TeamId;
const baId = 'ba_tm_001' as BaId;
const packetId = 'ctxpkt_test' as ContextPacketId;
const requestId = 'ctxreq_test' as ContextRequestId;
const sessionId = 'session_test' as SessionId;
const sourceId = 'source_test' as SourceId;
const knowledgeId = 'knowledge_test' as KnowledgeId;

function makePacket(overrides: Partial<ContextPacketV1> = {}): ContextPacketV1 {
  const packet: ContextPacketV1 = {
    schemaVersion: 'context_packet.v1',
    packetId,
    requestId,
    createdAt: '2026-06-28T12:00:00.000Z',
    packetStatus: 'complete',
    tenant: {
      tenantId,
      tenantName: 'Momentum',
      brandName: 'Team Magnificent',
      environment: 'development',
    },
    team: {
      teamId,
      teamKey: 'team_magnificent',
      teamName: 'Team Magnificent',
    },
    ba: {
      tenantId,
      teamId,
      teamKey: 'team_magnificent',
      teamName: 'Team Magnificent',
      baId,
      journalEnabled: true,
      languagePreference: 'en',
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
      sessionId,
      mode: 'browser_text',
      status: 'active',
      taskType: 'training_support',
    },
    agent: {
      agentKey: 'michael_magnificent',
      agentId: 'agent_instance_michael_default' as AgentId,
      displayName: 'Michael Magnificent',
      primaryDomain: 'training',
      roleSummary: 'Training support.',
      allowedOutputs: ['teaching_explanation', 'clarifying_question'],
      prohibitedOutputs: ['Direct database queries.'],
      agentRuntimeMode: 'training_specialist',
      contextUsageInstruction: 'Use the Context Packet only.',
    },
    language: {
      primary: 'en',
      translationAllowed: true,
      translationStatus: 'same_language',
      machineTranslationUsed: false,
      humanReviewed: true,
    },
    runtimeRules: REQUIRED_CONTEXT_RUNTIME_RULE_IDS.map((ruleId) => ({
      ruleId,
      category: ruleId === 'candidate_knowledge_exclusion' ? 'candidate_boundary' : 'agent_boundary',
      instruction: ruleId,
      required: true,
      appliesTo: 'all_agents',
    })),
    guardrails: [
      {
        guardrailId: 'no_direct_store_access',
        appliesTo: 'all_agents',
        instruction: 'Agents must not query stores directly.',
        severity: 'critical',
        category: 'agent_scope',
      },
    ],
    approvedKnowledge: [
      {
        knowledgeId,
        title: 'Approved training knowledge',
        summary: 'Approved guidance summary.',
        status: 'active',
        governanceStatus: 'approved',
        language: 'en',
        sourceTraceability: {
          sourceId,
          sourceType: 'manual_review',
        },
        retrieval: {
          retrievalMethod: 'direct_reference',
          reasonCodes: ['agent_task_match'],
          language: 'en',
          translationStatus: 'same_language',
        },
      },
    ],
    privateContext: {
      included: true,
      items: [
        {
          contextId: 'private_context_test',
          ownerBaId: baId,
          summary: 'Private context summary.',
          language: 'en',
          sourceTraceability: {
            sourceId,
            sourceType: 'journal_summary',
          },
        },
      ],
    },
    relationshipContext: {
      included: true,
      items: [
        {
          relationshipContextId: 'relationship_test' as RelationshipContextId,
          ownerBaId: baId,
          summary: 'Relationship context summary.',
          personSensitive: true,
          language: 'en',
        },
      ],
    },
    journalContext: {
      included: true,
      privateByDefault: true,
      entries: [
        {
          journalEntryId: 'journal_test' as JournalEntryId,
          ownerBaId: baId,
          summary: 'Journal summary.',
          language: 'en',
          selectedForReview: false,
        },
      ],
    },
    sessionHistory: {
      included: true,
      turns: [
        {
          turnId: 'turn_test' as RuntimeTurnId,
          sequence: 1,
          speaker: 'brand_ambassador',
          summary: 'Turn summary.',
          language: 'en',
        },
      ],
    },
    guidedActions: [
      {
        guidedActionId: 'guided_test' as GuidedActionId,
        ownerBaId: baId,
        title: 'Practice sharing',
        status: 'suggested',
      },
    ],
    exclusions: [
      {
        sourceId: 'candidate_test',
        reason: 'candidate_not_approved',
      },
    ],
    retrievalAudit: {
      requestId,
      packetId,
      requestedScopes: ['approved_knowledge', 'runtime_rules'],
      includedKnowledgeIds: [knowledgeId],
      includedPrivateContextIds: ['private_context_test'],
      includedJournalEntryIds: ['journal_test' as JournalEntryId],
      includedRelationshipContextIds: ['relationship_test' as RelationshipContextId],
      includedGuidedActionIds: ['guided_test' as GuidedActionId],
      excludedSourceIds: ['candidate_test'],
      retrievalMethods: ['direct_reference'],
      tokenEstimate: 900,
      languageFallbackUsed: false,
      candidateKnowledgeIncluded: false,
      candidateKnowledgeExcluded: true,
      privateJournalIncluded: true,
      degraded: false,
      includedItems: [
        {
          sourceId,
          method: 'direct_reference',
          included: true,
          reasonCodes: ['agent_task_match'],
        },
      ],
      exclusions: [
        {
          sourceId: 'candidate_test',
          reason: 'candidate_not_approved',
        },
      ],
    },
    metadata: {
      generatedBy: 'context_manager',
      environment: 'development',
      tokenEstimate: 900,
    },
  };

  return {
    ...packet,
    ...overrides,
  };
}

describe('context packet foundation', () => {
  it('accepts a context_packet.v1 packet assembled by the Context Manager', () => {
    const packet = makePacket();
    const result = validateContextPacketV1(packet);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.packet.schemaVersion).toBe('context_packet.v1');
      expect(result.packet.metadata?.generatedBy).toBe('context_manager');
    }

    expect(prepareContextPacketFoundation(packet)).toBe(packet);
  });

  it('records the Context Manager-only assembly boundary', () => {
    expect(contextPacketFoundationBoundary.assembledBy).toBe('context_manager');
    expect(contextPacketFoundationBoundary.agentsMayRetrieveDirectly).toBe(false);
    expect(contextPacketFoundationBoundary.candidateKnowledgeIncludedByDefault).toBe(false);
    expect(contextPacketFoundationBoundary.supportedLanguages).toEqual(['en', 'es']);
  });

  it('rejects packets not assembled by the Context Manager', () => {
    const packet = makePacket({
      metadata: {
        generatedBy: 'agent_runtime' as 'context_manager',
        environment: 'development',
      },
    });

    const result = validateContextPacketV1(packet);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((item) => item.code === 'context_manager_required')).toBe(true);
    }
  });

  it('rejects candidate or review-only knowledge inclusion by default', () => {
    const packet = makePacket({
      retrievalAudit: {
        ...makePacket().retrievalAudit,
        candidateKnowledgeIncluded: true as false,
        candidateKnowledgeExcluded: false as true,
      },
    });

    const result = validateContextPacketV1(packet);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((item) => item.code === 'candidate_knowledge_included')).toBe(true);
    }
  });

  it('rejects BA-owned private context that does not match packet scope', () => {
    const packet = makePacket({
      privateContext: {
        included: true,
        items: [
          {
            contextId: 'other_private_context',
            ownerBaId: 'ba_other' as BaId,
            summary: 'Wrong BA private context.',
            language: 'en',
            sourceTraceability: {
              sourceId,
              sourceType: 'journal_summary',
            },
          },
        ],
      },
    });

    const result = validateContextPacketV1(packet);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((item) => item.code === 'private_context_scope_mismatch')).toBe(true);
    }
  });

  it('requires degraded state for degraded or failed packets', () => {
    const packet = makePacket({
      packetStatus: 'degraded',
      degraded: undefined,
    });

    expect(() => assertValidContextPacketV1(packet)).toThrow('Invalid context_packet.v1 packet');
  });
});
