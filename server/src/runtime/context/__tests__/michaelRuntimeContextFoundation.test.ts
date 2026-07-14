import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  McsContextPacketRequest,
  McsContextPacketV1,
  McsKnowledgeId,
  McsRuntimeRequestScope,
  McsSessionId,
  McsSourceId,
  McsTeamId,
  McsTenantId,
  TmagId,
} from '@momentum/shared/runtime';
import { createMichaelRuntimeContextManagerPort } from '../michaelRuntimeContextFoundation.js';

const storeMock = vi.hoisted(() => ({
  searchApprovedKnowledge: vi.fn(),
}));

vi.mock('../../../services/knowledge/approvedKnowledgeStore.js', () => ({
  createStoredApprovedKnowledgeProvider: () => ({
    searchApprovedKnowledge: storeMock.searchApprovedKnowledge,
  }),
}));

const scope: McsRuntimeRequestScope = {
  tenantId: 'tenant_team_magnificent' as McsTenantId,
  teamId: 'team_magnificent' as McsTeamId,
  teamKey: 'team_magnificent',
  teamName: 'Team Magnificent',
  tmagId: 'TMAG-001' as TmagId,
};

const request: McsContextPacketRequest = {
  requestId: 'ctx_req_michael_foundation' as McsContextPacketRequest['requestId'],
  sessionId: 'session_michael_foundation' as McsSessionId,
  agentKey: 'michael_magnificent',
  language: 'en',
  taskType: 'training_support',
};

describe('Michael runtime Context Manager foundation live retrieval flag', () => {
  beforeEach(() => {
    storeMock.searchApprovedKnowledge.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('flag off preserves the degraded empty-approved-knowledge packet and never touches the store', async () => {
    vi.stubEnv('MCS_CONTEXT_MANAGER_LIVE_ENABLED', 'false');

    const port = createMichaelRuntimeContextManagerPort({
      tmagId: 'TMAG-001' as TmagId,
      mode: 'browser_text',
      createdAt: '2026-07-05T00:00:00.000Z',
      turnContent: 'What should I practice today?',
    });

    const packet = await port.requestContextPacket(scope, request) as McsContextPacketV1;

    expect(packet).toMatchObject({
      schemaVersion: 'context_packet.v1',
      packetStatus: 'degraded',
      agent: { agentKey: 'michael_magnificent' },
      approvedKnowledge: [],
      retrievalAudit: {
        includedKnowledgeIds: [],
        candidateKnowledgeIncluded: false,
        candidateKnowledgeExcluded: true,
        degraded: true,
      },
    });
    expect(storeMock.searchApprovedKnowledge).not.toHaveBeenCalled();
  });

  it('flag on derives the semantic query from turn content and returns a Context Packet only', async () => {
    vi.stubEnv('MCS_CONTEXT_MANAGER_LIVE_ENABLED', 'true');
    storeMock.searchApprovedKnowledge.mockResolvedValue([
      {
        knowledgeId: 'knowledge_training_live' as McsKnowledgeId,
        title: 'Daily Practice',
        summary: 'Practice the two-leg explanation with your sponsor.',
        domain: 'training',
        status: 'active',
        language: 'en',
        translationStatus: 'same_language',
        sourceId: 'source_training_live' as McsSourceId,
      },
    ]);

    const port = createMichaelRuntimeContextManagerPort({
      tmagId: 'TMAG-001' as TmagId,
      mode: 'browser_text',
      createdAt: '2026-07-05T00:00:00.000Z',
      turnContent: '   What should I practice today?   ',
    });

    const packet = await port.requestContextPacket(scope, request) as McsContextPacketV1;

    expect(storeMock.searchApprovedKnowledge).toHaveBeenCalledWith(
      expect.objectContaining({ tmagId: 'TMAG-001' }),
      'What should I practice today?',
      undefined,
      'en',
    );
    expect(packet.packetStatus).toBe('complete');
    expect(packet.approvedKnowledge.map((item) => item.knowledgeId)).toEqual([
      'knowledge_training_live',
    ]);
    expect(JSON.stringify(packet)).not.toContain('searchApprovedKnowledge');
    expect(JSON.stringify(packet)).not.toContain('persistenceCall');
  });
});
