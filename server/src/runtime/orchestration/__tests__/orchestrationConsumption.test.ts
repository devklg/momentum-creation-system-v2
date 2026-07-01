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
  type ContextPacketBuildInput,
} from '../../context/contextManager.js';
import type { RuntimeAgentEventEnvelope } from '../../events/index.js';
import {
  AGENT_EVENT_V1_SCHEMA_VERSION,
  TEAM_MAGNIFICENT_KEY,
  TEAM_MAGNIFICENT_NAME,
} from '../../events/index.js';
import { consumeContextPacket } from '../consumption.js';

function baseEvent(): RuntimeAgentEventEnvelope {
  return {
    eventId: 'evt_consume_ref_001' as RuntimeEventId,
    eventType: 'context.packet.created',
    schemaVersion: AGENT_EVENT_V1_SCHEMA_VERSION,
    tenantId: 'tenant_team_magnificent' as TenantId,
    teamId: 'team_magnificent' as TeamId,
    teamKey: TEAM_MAGNIFICENT_KEY,
    teamName: TEAM_MAGNIFICENT_NAME,
    tmagId: 'TMBA-CONSUME-001' as TmagId,
    agentKey: 'michael_magnificent',
    agentId: 'agent_instance_michael_default' as AgentId,
    sessionId: 'session_consume_001' as SessionId,
    correlationId: 'corr_consume_001' as CorrelationId,
    idempotencyKey: 'context-packet:session_consume_001:created' as IdempotencyKey,
    source: 'context_manager',
    payload: { packetId: 'ctx_consume_001' },
    occurredAt: '2026-06-28T12:00:00.000Z',
    recordedAt: '2026-06-28T12:00:01.000Z',
    actor: { actorType: 'system', actorId: 'context_manager' },
    provenance: {
      emittedBy: 'context_manager',
      requestId: 'ctx_consume_req_001' as RequestId,
      componentVersion: 's1.4',
    },
  };
}

function baseInput(overrides: Partial<ContextPacketBuildInput> = {}): ContextPacketBuildInput {
  return {
    packetId: 'ctx_consume_001' as ContextPacketId,
    requestId: 'ctx_consume_req_001' as ContextRequestId,
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
      tmagId: 'TMBA-CONSUME-001' as TmagId,
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
      sessionId: 'session_consume_001' as SessionId,
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
      requestId: 'ctx_consume_req_001' as ContextRequestId,
      componentVersion: 's1.5',
      traceId: 'trace_consume_001',
    },
    createdAt: '2026-06-28T12:00:02.000Z',
    ...overrides,
  };
}

describe('S2.1 Context Packet consumption', () => {
  it('proceeds on a valid, complete packet for the expected agent', () => {
    const packet = buildContextPacket(baseInput());
    const result = consumeContextPacket({
      expectedAgentKey: 'michael_magnificent',
      packet,
    });

    expect(result.decision).toBe('proceed');
    expect(result.packetAgentKey).toBe('michael_magnificent');
    expect(result.taskType).toBe('training_support');
    expect(result.packet).toBeDefined();
    expect(result.issues).toEqual([]);
  });

  it('returns degraded for a degraded packet', () => {
    const packet = buildContextPacket(baseInput({ packetStatus: 'degraded' }));
    const result = consumeContextPacket({ expectedAgentKey: 'michael_magnificent', packet });

    expect(result.decision).toBe('degraded');
    expect(result.packet).toBeDefined();
  });

  it('blocks substantive guidance for a failed packet', () => {
    const packet = buildContextPacket(baseInput({ packetStatus: 'failed' }));
    const result = consumeContextPacket({ expectedAgentKey: 'michael_magnificent', packet });

    expect(result.decision).toBe('block_substantive');
    expect(result.packet).toBeUndefined();
  });

  it('rejects when the packet agent does not match the expected agent', () => {
    const packet = buildContextPacket(baseInput());
    const result = consumeContextPacket({ expectedAgentKey: 'steve_success', packet });

    expect(result.decision).toBe('reject');
    expect(result.issues.map((entry) => entry.code)).toContain('agent_mismatch');
  });

  it('rejects when the task type is not an allowed objective for the agent', () => {
    // A Steve packet carrying a training task type is not an allowed Steve objective.
    const packet = buildContextPacket(
      baseInput({
        agentKey: 'steve_success',
        agentId: 'agent_instance_steve_default' as AgentId,
        session: {
          ...baseInput().session,
          taskType: 'training_support',
        },
      }),
    );
    const result = consumeContextPacket({ expectedAgentKey: 'steve_success', packet });

    expect(result.decision).toBe('reject');
    expect(result.issues.map((entry) => entry.code)).toContain('objective_not_allowed');
  });

  it('rejects a packet not assembled by the Context Manager', () => {
    const packet = buildContextPacket(baseInput());
    const tampered = {
      ...packet,
      metadata: { ...packet.metadata, generatedBy: 'agent_runtime' },
    };
    const result = consumeContextPacket({ expectedAgentKey: 'michael_magnificent', packet: tampered });

    expect(result.decision).toBe('reject');
    expect(result.issues.length).toBeGreaterThan(0);
  });

  it('rejects a packet that includes candidate/review-only knowledge', () => {
    const packet = buildContextPacket(baseInput());
    const tampered = {
      ...packet,
      retrievalAudit: {
        ...packet.retrievalAudit,
        candidateKnowledgeIncluded: true,
        candidateKnowledgeExcluded: false,
      },
    };
    const result = consumeContextPacket({ expectedAgentKey: 'michael_magnificent', packet: tampered });

    expect(result.decision).toBe('reject');
    expect(result.issues.length).toBeGreaterThan(0);
  });

  it('rejects a structurally invalid packet', () => {
    const result = consumeContextPacket({ expectedAgentKey: 'ivory', packet: {} });

    expect(result.decision).toBe('reject');
    expect(result.issues.length).toBeGreaterThan(0);
  });
});
