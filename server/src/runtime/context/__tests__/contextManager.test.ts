import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type {
  AgentId,
  TmagId,
  ContextPacketId,
  ContextRequestId,
  CorrelationId,
  IdempotencyKey,
  KnowledgeId,
  RequestId,
  RuntimeEventId,
  SessionId,
  SourceId,
  TeamId,
  TenantId,
} from '@momentum/shared/runtime';
import {
  buildContextPacket,
  ContextPacketValidationError,
  validateContextPacket,
  type ContextPacketBuildInput,
} from '../contextManager.js';
import type { RuntimeAgentEventEnvelope } from '../../events/index.js';
import {
  AGENT_EVENT_V1_SCHEMA_VERSION,
  TEAM_MAGNIFICENT_KEY,
  TEAM_MAGNIFICENT_NAME,
} from '../../events/index.js';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../../../..');

function baseEvent(): RuntimeAgentEventEnvelope {
  return {
    eventId: 'evt_context_ref_001' as RuntimeEventId,
    eventType: 'context.packet.created',
    schemaVersion: AGENT_EVENT_V1_SCHEMA_VERSION,
    tenantId: 'tenant_team_magnificent' as TenantId,
    teamId: 'team_magnificent' as TeamId,
    teamKey: TEAM_MAGNIFICENT_KEY,
    teamName: TEAM_MAGNIFICENT_NAME,
    tmagId: 'TMBA-CONTEXT-001' as TmagId,
    agentKey: 'michael_magnificent',
    agentId: 'agent_instance_michael_default' as AgentId,
    sessionId: 'session_context_001' as SessionId,
    correlationId: 'corr_context_001' as CorrelationId,
    idempotencyKey: 'context-packet:session_context_001:created' as IdempotencyKey,
    source: 'context_manager',
    payload: {
      packetId: 'ctx_packet_001',
    },
    occurredAt: '2026-06-28T12:00:00.000Z',
    recordedAt: '2026-06-28T12:00:01.000Z',
    actor: {
      actorType: 'system',
      actorId: 'context_manager',
    },
    provenance: {
      emittedBy: 'context_manager',
      requestId: 'ctx_req_001' as RequestId,
      componentVersion: 's1.4',
    },
  };
}

function baseInput(overrides: Partial<ContextPacketBuildInput> = {}): ContextPacketBuildInput {
  return {
    packetId: 'ctx_packet_001' as ContextPacketId,
    requestId: 'ctx_req_001' as ContextRequestId,
    tenant: {
      tenantId: 'tenant_team_magnificent' as TenantId,
      tenantName: 'Team Magnificent Tenant',
      brandName: 'Team Magnificent',
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
      tmagId: 'TMBA-CONTEXT-001' as TmagId,
      journalEnabled: true,
      languagePreference: 'en',
      permissions: {
        canUsePrivateJournal: true,
        canSelectJournalForReview: false,
        canCreateKnowledgeCandidate: false,
        canAccessRelationshipContext: false,
        canUseBrowserVoice: true,
        canUseBrowserText: true,
      },
    },
    session: {
      sessionId: 'session_context_001' as SessionId,
      mode: 'browser_text',
      status: 'active',
      taskType: 'training_support',
      startedAt: '2026-06-28T11:59:00.000Z',
    },
    agentKey: 'michael_magnificent',
    agentId: 'agent_instance_michael_default' as AgentId,
    objective: 'prepare a training support turn',
    language: {
      primary: 'en',
      userPreference: 'en',
      translationAllowed: false,
      translationStatus: 'same_language',
      machineTranslationUsed: false,
      humanReviewed: true,
    },
    knowledgeReferences: [
      {
        sourceId: 'knowledge_approved_001' as SourceId,
        knowledgeId: 'knowledge_approved_001' as KnowledgeId,
        kind: 'approved_knowledge',
        title: 'Approved training rule',
        summary: 'Approved guidance for the training support turn.',
        status: 'approved',
        score: 0.97,
      },
      {
        sourceId: 'knowledge_candidate_001' as SourceId,
        kind: 'approved_knowledge',
        title: 'Candidate note',
        summary: 'This candidate note must not enter the packet.',
        status: 'candidate',
        score: 0.99,
      },
    ],
    graphContextReferences: [
      {
        sourceId: 'graph_context_001' as SourceId,
        kind: 'graph',
        summary: 'Preselected graph context reference.',
        status: 'approved',
        score: 0.7,
      },
    ],
    vectorContextReferences: [
      {
        sourceId: 'vector_context_001' as SourceId,
        kind: 'vector',
        summary: 'Preselected vector context reference.',
        status: 'approved',
        score: 0.8,
      },
    ],
    eventContextReferences: [baseEvent()],
    constraints: [
      {
        constraintId: 'agent_store_boundary',
        instruction: 'Agents consume packets and do not query stores.',
        severity: 'critical',
      },
    ],
    excludedKnowledge: [],
    provenance: {
      assembledBy: 'context_manager',
      requestId: 'ctx_req_001' as ContextRequestId,
      componentVersion: 's1.5',
      traceId: 'trace_context_001',
    },
    createdAt: '2026-06-28T12:00:02.000Z',
    ...overrides,
  };
}

describe('S1.5 context packet foundation', () => {
  it('builds and validates a valid context_packet.v1 without active retrieval or persistence', () => {
    const packet = buildContextPacket(baseInput());
    const validation = validateContextPacket(packet);

    expect(validation.ok).toBe(true);
    expect(packet.schemaVersion).toBe('context_packet.v1');
    expect(packet.metadata?.generatedBy).toBe('context_manager');
    expect(packet.agent.agentKey).toBe('michael_magnificent');
    expect(packet.agent.agentId).toBe('agent_instance_michael_default');
    expect(packet.retrievalAudit.retrievalMethods).toEqual(
      expect.arrayContaining(['direct_reference', 'graph_expansion', 'semantic_search', 'session_history']),
    );
    expect(packet.metadata?.notes).toContain('s1.5:no_active_retrieval');
  });

  it('rejects invalid missing identity and scope fields', () => {
    const input = baseInput({
      packetId: '' as ContextPacketId,
      requestId: '' as ContextRequestId,
      objective: '',
      agentKey: 'michael' as ContextPacketBuildInput['agentKey'],
    });

    expect(() => buildContextPacket(input)).toThrow(ContextPacketValidationError);

    try {
      buildContextPacket(input);
    } catch (error) {
      expect(error).toBeInstanceOf(ContextPacketValidationError);
      expect((error as ContextPacketValidationError).errors.map((item) => item.code)).toEqual(
        expect.arrayContaining(['required', 'invalid_agent_key']),
      );
    }
  });

  it('enforces Team Magnificent BA scope when tmagId exists', () => {
    const input = baseInput({
      ba: {
        ...baseInput().ba,
        teamKey: 'other_team' as typeof TEAM_MAGNIFICENT_KEY,
      },
    });

    expect(() => buildContextPacket(input)).toThrow(ContextPacketValidationError);

    try {
      buildContextPacket(input);
    } catch (error) {
      expect((error as ContextPacketValidationError).errors.map((item) => item.code)).toContain(
        'team_magnificent_scope_required',
      );
    }
  });

  it('excludes candidate and review-only knowledge by default', () => {
    const packet = buildContextPacket({
      ...baseInput(),
      vectorContextReferences: [
        ...(baseInput().vectorContextReferences ?? []),
        {
          sourceId: 'vector_review_only_001' as SourceId,
          kind: 'vector',
          summary: 'Review-only vector context must be excluded.',
          status: 'review_only',
        },
      ],
    });

    expect(packet.approvedKnowledge.map((item) => item.knowledgeId)).toEqual([
      'knowledge_approved_001',
    ]);
    expect(packet.retrievalAudit.candidateKnowledgeIncluded).toBe(false);
    expect(packet.retrievalAudit.candidateKnowledgeExcluded).toBe(true);
    expect(packet.exclusions.map((item) => item.reason)).toEqual(
      expect.arrayContaining(['candidate_not_approved', 'not_review_workflow']),
    );
  });

  it('preserves the agent-store boundary in generated context and agent runtime source', () => {
    const packet = buildContextPacket(baseInput());
    const agentRuntimeSource = readFileSync(
      resolve(repoRoot, 'server/src/runtime/agents/agentRuntime.ts'),
      'utf8',
    );

    expect(packet.agent.prohibitedOutputs.join('\n')).toContain('Do not query MongoDB');
    expect(agentRuntimeSource).not.toMatch(/mongoose|mongodb|neo4j-driver|chromadb|gatewayCall|persistence\/(?:mongo|neo4j|chroma)/);
  });

  it('rejects packets not assembled by the Context Manager', () => {
    const packet = buildContextPacket(baseInput());
    const validation = validateContextPacket({
      ...packet,
      metadata: {
        ...packet.metadata,
        generatedBy: 'agent_runtime',
      },
    });

    expect(validation.ok).toBe(false);
    if (!validation.ok) {
      expect(validation.errors.map((item) => item.code)).toContain('context_manager_required');
    }
  });

  it('validates builder and validator behavior consistently', () => {
    const packet = buildContextPacket(baseInput({
      agentId: undefined,
      packetStatus: 'degraded',
    }));

    expect(packet.agent.agentId).toBeUndefined();
    expect(packet.packetStatus).toBe('degraded');
    expect(packet.retrievalAudit.degraded).toBe(true);
    expect(() => buildContextPacket({
      ...baseInput(),
      authorizeCandidateKnowledge: true,
    })).toThrow(ContextPacketValidationError);
  });

  it('validates event context references through the S1.4 foundation and does not bypass canonical timestamps', () => {
    const invalidEvent = {
      ...baseEvent(),
      createdAt: '2026-06-28T12:00:00.000Z',
    } as RuntimeAgentEventEnvelope & { createdAt: string };

    expect(() =>
      buildContextPacket(baseInput({
        eventContextReferences: [invalidEvent],
      })),
    ).toThrow(ContextPacketValidationError);

    try {
      buildContextPacket(baseInput({
        eventContextReferences: [invalidEvent],
      }));
    } catch (error) {
      expect((error as ContextPacketValidationError).errors.map((item) => item.code)).toContain(
        'created_at_forbidden',
      );
    }
  });
});
