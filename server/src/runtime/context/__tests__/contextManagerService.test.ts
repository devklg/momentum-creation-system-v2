import { describe, expect, it } from 'vitest';
import type {
  McsContextPacketRequest,
  McsContextPacketV1,
  McsKnowledgeReference,
  McsRuntimeRequestScope,
  McsKnowledgeId,
  McsRequestId,
  McsSessionId,
  McsSourceId,
  McsTeamId,
  McsTenantId,
  TmagId,
} from '@momentum/shared/runtime';
import {
  ContextManagerServiceError,
  createContextManagerService,
  planContextRequest,
} from '../index.js';

const scope: McsRuntimeRequestScope = {
  tenantId: 'tenant_team_magnificent' as McsTenantId,
  teamId: 'team_magnificent' as McsTeamId,
  teamKey: 'team_magnificent',
  teamName: 'Team Magnificent',
  tmagId: 'TMAG-001' as TmagId,
  requestId: 'ctx_req_1' as McsRequestId,
  sessionId: 'session_1' as McsSessionId,
};

const request: McsContextPacketRequest = {
  requestId: 'ctx_req_1' as McsRequestId,
  sessionId: 'session_1' as McsSessionId,
  agentKey: 'michael_magnificent',
  language: 'en',
  taskType: 'training_support',
};

const approvedReference: McsKnowledgeReference = {
  knowledgeId: 'knowledge_training_1' as McsKnowledgeId,
  domain: 'training',
  status: 'active',
  language: 'en',
  translationStatus: 'same_language',
  sourceId: 'source_training_1' as McsSourceId,
};

describe('Context Manager service', () => {
  it('plans a governed approved-knowledge query from agent and task context', () => {
    const plan = planContextRequest({ scope, request }, { maxApprovedKnowledgeResults: 5 });

    expect(plan.schemaVersion).toBe('context_manager_plan.v1');
    expect(plan.agentKey).toBe('michael_magnificent');
    expect(plan.domains).toEqual(['training', 'success', 'governance']);
    expect(plan.approvedKnowledgeQuery).toMatchObject({
      schemaVersion: 'approved_knowledge_query.v1',
      objective: 'training_support',
      language: 'en',
      maxResults: 5,
      allowLanguageFallback: true,
    });
  });

  it('executes retrieval through Knowledge Core, assembles a complete packet, and returns a trace', async () => {
    const service = createContextManagerService({
      async listApprovedKnowledge(receivedScope) {
        expect(receivedScope).toMatchObject({ tmagId: 'TMAG-001' });
        return [approvedReference];
      },
    }, {
      createdAt: '2026-07-04T00:00:00.000Z',
      mode: 'browser_text',
    });

    const result = await service.buildContext({ scope, request });

    expect(result.packet.packetStatus).toBe('complete');
    expect(result.packet.metadata?.generatedBy).toBe('context_manager');
    expect(result.packet.agent.agentKey).toBe('michael_magnificent');
    expect(result.packet.approvedKnowledge).toHaveLength(1);
    expect(result.packet.approvedKnowledge[0]?.knowledgeId).toBe('knowledge_training_1');
    expect(result.trace).toMatchObject({
      schemaVersion: 'context_manager_trace.v1',
      agentKey: 'michael_magnificent',
      taskType: 'training_support',
      executor: {
        retrievalStatus: 'ok',
        approvedCount: 1,
        candidateExcludedCount: 0,
      },
      tracer: {
        packetStatus: 'complete',
        includedKnowledgeIds: ['knowledge_training_1'],
      },
    });
  });

  it('degrades fail-closed when approved knowledge is unavailable', async () => {
    const service = createContextManagerService({
      async listApprovedKnowledge() {
        throw new Error('offline');
      },
    }, {
      createdAt: '2026-07-04T00:00:00.000Z',
    });

    const result = await service.buildContext({ scope, request });

    expect(result.packet.packetStatus).toBe('degraded');
    expect(result.packet.approvedKnowledge).toEqual([]);
    expect(result.packet.degraded?.safeFallbackInstruction).toContain('do not infer or fabricate');
    expect(result.trace.executor).toMatchObject({
      retrievalStatus: 'degraded',
      approvedCount: 0,
      candidateExcludedCount: 0,
      degradeReasons: ['knowledge_unavailable'],
    });
  });

  it('provides an orchestration-compatible request port without exposing trace to agents', async () => {
    const service = createContextManagerService({
      async listApprovedKnowledge() {
        return [approvedReference];
      },
    }, {
      createdAt: '2026-07-04T00:00:00.000Z',
    });

    const port = service.requestPort();
    const packet = await port.requestContextPacket(scope, request) as McsContextPacketV1;

    expect(port.assembledBy).toBe('context_manager');
    expect(packet.packetStatus).toBe('complete');
    expect(packet.approvedKnowledge[0]?.knowledgeId).toBe('knowledge_training_1');
  });

  it('rejects an agent/task mismatch before retrieval', async () => {
    const service = createContextManagerService({
      async listApprovedKnowledge() {
        throw new Error('should not be called');
      },
    });

    await expect(service.buildContext({
      scope,
      request: {
        ...request,
        agentKey: 'ivory',
        taskType: 'training_support',
      },
    })).rejects.toMatchObject({
      name: 'ContextManagerServiceError',
      code: 'agent_task_mismatch',
    } satisfies Partial<ContextManagerServiceError>);
  });
});
