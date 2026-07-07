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
import { createSteveRuntimeContextManagerPort } from '../steveRuntimeContextFoundation.js';

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
  requestId: 'ctx_req_steve_foundation' as McsContextPacketRequest['requestId'],
  sessionId: 'session_steve_foundation' as McsSessionId,
  agentKey: 'steve_success',
  language: 'en',
  taskType: 'success_interview',
};

describe('Steve runtime Context Manager foundation live retrieval flag', () => {
  beforeEach(() => {
    storeMock.searchApprovedKnowledge.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('flag off preserves the degraded empty-approved-knowledge packet and never touches the store', async () => {
    vi.stubEnv('STEVE_CONTEXT_MANAGER_LIVE_ENABLED', 'false');

    const port = createSteveRuntimeContextManagerPort({
      tmagId: 'TMAG-001' as TmagId,
      mode: 'browser_text',
      createdAt: '2026-07-06T00:00:00.000Z',
      turnContent: 'I learn best when someone walks me through it.',
    });

    const packet = await port.requestContextPacket(scope, request) as McsContextPacketV1;

    expect(packet).toMatchObject({
      schemaVersion: 'context_packet.v1',
      packetStatus: 'degraded',
      agent: { agentKey: 'steve_success' },
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

  it('flag on derives the semantic query from turn content and includes Steve relationship context', async () => {
    vi.stubEnv('STEVE_CONTEXT_MANAGER_LIVE_ENABLED', 'true');
    storeMock.searchApprovedKnowledge.mockResolvedValue([
      {
        knowledgeId: 'knowledge_steve_relationship' as McsKnowledgeId,
        title: 'Sponsor support preference',
        summary: 'Capture how the BA prefers to communicate so the sponsor can support them.',
        domain: 'relationship',
        status: 'active',
        language: 'en',
        translationStatus: 'same_language',
        sourceId: 'source_steve_relationship' as McsSourceId,
      },
    ]);

    const port = createSteveRuntimeContextManagerPort({
      tmagId: 'TMAG-001' as TmagId,
      mode: 'browser_text',
      createdAt: '2026-07-06T00:00:00.000Z',
      turnContent: '   I prefer weekly text check-ins from my sponsor.   ',
    });

    const packet = await port.requestContextPacket(scope, request) as McsContextPacketV1;

    expect(storeMock.searchApprovedKnowledge).toHaveBeenCalledWith(
      expect.objectContaining({ tmagId: 'TMAG-001' }),
      'I prefer weekly text check-ins from my sponsor.',
    );
    expect(packet.packetStatus).toBe('complete');
    expect(packet.approvedKnowledge.map((item) => item.knowledgeId)).toEqual([
      'knowledge_steve_relationship',
    ]);
    expect(JSON.stringify(packet)).not.toContain('searchApprovedKnowledge');
    expect(JSON.stringify(packet)).not.toContain('persistenceCall');
  });
});
