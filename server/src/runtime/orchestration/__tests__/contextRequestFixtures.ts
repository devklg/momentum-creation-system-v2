import type {
  McsAgentId,
  McsAgentKey,
  TmagId,
  McsContextPacketId,
  McsContextRequestId,
  McsCorrelationId,
  McsKnowledgeId,
  McsRuntimeTaskType,
  McsRuntimeTurnId,
  McsSessionId,
  McsSourceId,
  McsTeamId,
  McsTenantId,
} from '@momentum/shared/runtime';
import {
  buildContextPacket,
  type ContextPacketBuildInput,
} from '../../context/contextManager.js';
import {
  TEAM_MAGNIFICENT_KEY,
  TEAM_MAGNIFICENT_NAME,
} from '../../events/index.js';
import type {
  ContextManagerRequestPort,
  OrchestrationSessionIdentity,
} from '../index.js';

type FixtureResponseMode =
  | 'complete'
  | 'degraded'
  | 'failed'
  | 'missing'
  | 'candidate_included'
  | 'throw';

const AGENT_IDS: Record<McsAgentKey, McsAgentId> = {
  steve_success: 'agent_instance_steve_default' as McsAgentId,
  michael_magnificent: 'agent_instance_michael_default' as McsAgentId,
  ivory: 'agent_instance_ivory_default' as McsAgentId,
};

export function requestIdentity(
  overrides: Partial<OrchestrationSessionIdentity> = {},
): OrchestrationSessionIdentity {
  return {
    scope: {
      tenantId: 'tenant_team_magnificent' as McsTenantId,
      teamId: 'team_magnificent' as McsTeamId,
      teamKey: TEAM_MAGNIFICENT_KEY,
      teamName: TEAM_MAGNIFICENT_NAME,
      tmagId: 'TMAG-S2-2-001' as TmagId,
    },
    sessionId: 'session_s2_2_001' as McsSessionId,
    agentKey: 'michael_magnificent',
    mode: 'browser_text',
    language: 'en',
    correlationId: 'corr_s2_2_001' as McsCorrelationId,
    ...overrides,
  };
}

export function requestTurnId(): McsRuntimeTurnId {
  return 'turn_s2_2_001' as McsRuntimeTurnId;
}

export function createContextManagerFixture(
  mode: FixtureResponseMode = 'complete',
): {
  readonly port: ContextManagerRequestPort;
  readonly calls: Array<{
    scope: Parameters<ContextManagerRequestPort['requestContextPacket']>[0];
    request: Parameters<ContextManagerRequestPort['requestContextPacket']>[1];
  }>;
} {
  const calls: Array<{
    scope: Parameters<ContextManagerRequestPort['requestContextPacket']>[0];
    request: Parameters<ContextManagerRequestPort['requestContextPacket']>[1];
  }> = [];

  return {
    calls,
    port: {
      assembledBy: 'context_manager',
      async requestContextPacket(scope, request): Promise<unknown> {
        calls.push({ scope, request });
        if (mode === 'missing') return undefined;
        if (mode === 'throw') throw new Error('fixture context request failed');

        const packetStatus = mode === 'degraded' || mode === 'failed' ? mode : 'complete';
        const packet = buildContextPacket(
          contextPacketInputForRequest(request, packetStatus),
        );

        if (mode !== 'candidate_included') return packet;

        return {
          ...packet,
          retrievalAudit: {
            ...packet.retrievalAudit,
            candidateKnowledgeIncluded: true,
            candidateKnowledgeExcluded: false,
          },
        };
      },
    },
  };
}

function contextPacketInputForRequest(
  request: Parameters<ContextManagerRequestPort['requestContextPacket']>[1],
  packetStatus: ContextPacketBuildInput['packetStatus'],
): ContextPacketBuildInput {
  const taskType = request.taskType as McsRuntimeTaskType;

  return {
    packetId: `ctx_s2_2_${request.requestId}` as McsContextPacketId,
    requestId: request.requestId as unknown as McsContextRequestId,
    tenant: {
      tenantId: 'tenant_team_magnificent' as McsTenantId,
      tenantName: 'Team Magnificent Tenant',
      brandName: 'Team Magnificent',
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
      tmagId: 'TMAG-S2-2-001' as TmagId,
      journalEnabled: true,
      languagePreference: request.language,
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
      sessionId: request.sessionId,
      mode: 'browser_text',
      status: 'active',
      taskType,
      startedAt: '2026-06-28T12:00:00.000Z',
    },
    agentKey: request.agentKey,
    agentId: AGENT_IDS[request.agentKey],
    objective: `S2.2 fixture objective for ${taskType}`,
    language: {
      primary: request.language,
      userPreference: request.language,
      translationAllowed: false,
      translationStatus: 'same_language',
      machineTranslationUsed: false,
      humanReviewed: true,
    },
    knowledgeReferences: [
      {
        sourceId: 'knowledge_s2_2_approved_001' as McsSourceId,
        knowledgeId: 'knowledge_s2_2_approved_001' as McsKnowledgeId,
        kind: 'approved_knowledge',
        title: 'Approved S2.2 training context',
        summary: 'Approved inert Context Packet fixture for request wiring tests.',
        status: 'approved',
        score: 0.96,
      },
    ],
    constraints: [
      {
        constraintId: 'context_manager_only_assembler',
        instruction: 'Context Manager remains the only Context Packet assembler.',
        severity: 'critical',
      },
    ],
    excludedKnowledge: [],
    provenance: {
      assembledBy: 'context_manager',
      requestId: request.requestId as unknown as McsContextRequestId,
      componentVersion: 's1.5',
      traceId: 'trace_s2_2_001',
    },
    packetStatus,
    createdAt: '2026-06-28T12:00:02.000Z',
  };
}
