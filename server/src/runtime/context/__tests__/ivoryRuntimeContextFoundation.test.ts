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
import { createIvoryRuntimeContextManagerPort } from '../ivoryRuntimeContextFoundation.js';

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
  requestId: 'ctx_req_ivory_foundation' as McsContextPacketRequest['requestId'],
  sessionId: 'session_ivory_foundation' as McsSessionId,
  agentKey: 'ivory',
  language: 'en',
  taskType: 'relationship_coaching',
};

describe('Ivory runtime Context Manager foundation live retrieval flag', () => {
  beforeEach(() => {
    storeMock.searchApprovedKnowledge.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('flag off preserves the degraded empty-approved-knowledge packet and never touches the store', async () => {
    vi.stubEnv('IVORY_CONTEXT_MANAGER_LIVE_ENABLED', 'false');
    vi.stubEnv('MCS_CONTEXT_MANAGER_LIVE_ENABLED', 'false');

    const port = createIvoryRuntimeContextManagerPort({
      tmagId: 'TMAG-001' as TmagId,
      mode: 'browser_text',
      taskType: 'relationship_coaching',
      createdAt: '2026-07-06T00:00:00.000Z',
      turnContent: 'who should I think about from church',
    });

    const packet = await port.requestContextPacket(scope, request) as McsContextPacketV1;

    expect(packet).toMatchObject({
      schemaVersion: 'context_packet.v1',
      packetStatus: 'degraded',
      agent: { agentKey: 'ivory' },
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

  it('flag on derives the semantic query from Ivory relationship context', async () => {
    vi.stubEnv('IVORY_CONTEXT_MANAGER_LIVE_ENABLED', 'true');
    vi.stubEnv('MCS_CONTEXT_MANAGER_LIVE_ENABLED', 'false');
    storeMock.searchApprovedKnowledge.mockResolvedValue([
      {
        knowledgeId: 'knowledge_ivory_relationship' as McsKnowledgeId,
        title: 'Relationship-first invitation',
        summary: 'Ivory drafts must stay personal, editable, and BA-owned.',
        domain: 'relationship',
        status: 'active',
        language: 'en',
        translationStatus: 'same_language',
        sourceId: 'source_ivory_relationship' as McsSourceId,
      },
    ]);

    const port = createIvoryRuntimeContextManagerPort({
      tmagId: 'TMAG-001' as TmagId,
      mode: 'browser_text',
      taskType: 'invitation_drafting',
      createdAt: '2026-07-06T00:00:00.000Z',
      turnContent: '   personal invitation for a work friend, low pressure   ',
    });

    const packet = await port.requestContextPacket(
      scope,
      { ...request, taskType: 'invitation_drafting' },
    ) as McsContextPacketV1;

    expect(storeMock.searchApprovedKnowledge).toHaveBeenCalledWith(
      expect.objectContaining({ tmagId: 'TMAG-001' }),
      'personal invitation for a work friend, low pressure',
    );
    expect(packet.packetStatus).toBe('complete');
    expect(packet.approvedKnowledge.map((item) => item.knowledgeId)).toEqual([
      'knowledge_ivory_relationship',
    ]);
    expect(JSON.stringify(packet)).not.toContain('persistenceCall');
  });
});
