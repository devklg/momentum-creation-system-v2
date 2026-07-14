import { beforeEach, describe, expect, it, vi } from 'vitest';

const persistence = vi.fn();
vi.mock('../../services/persistence/dispatch.js', () => ({ persistenceCall: persistence }));

function countFor(params: { collection: string; filter: Record<string, unknown> }): number {
  if (params.collection === 'mcs_knowledge_sources') return 3;
  if (params.collection === 'mcs_knowledge_chunks') return params.filter.retrievalEligible ? 8 : 10;
  if (params.filter.target === 'chroma' && params.filter.status === 'pending') return 2;
  if (params.filter.target === 'neo4j' && params.filter.status === 'failed') return 1;
  return 0;
}

describe('buildAdminKnowledgeStatus', () => {
  beforeEach(() => {
    persistence.mockReset().mockImplementation(async (_tool, action, params) => action === 'list_collections'
      ? { collections: [{ name: 'mcs_knowledge_sources' }, { name: 'tmag_resource_catalog' }], count: 2 }
      : params.sort ? { count: 0, documents: [] } : { count: countFor(params) });
  });

  it('separates active records from retrieval readiness and projection consistency', async () => {
    const { buildAdminKnowledgeStatus } = await import('../adminKnowledgeStatus.js');
    const result = await buildAdminKnowledgeStatus();
    expect(result).toMatchObject({
      status: 'partial', activeSources: 3, activeChunks: 10, retrievalReadyChunks: 6,
      pendingChromaProjections: 2, failedChromaProjections: 0,
      pendingNeo4jProjections: 0, failedNeo4jProjections: 1,
      retrievalPerformance: {
        retention: 'in_process_since_restart',
        approvedReferenceCache: { ttlMs: 5000, maxEntries: 128 },
        graphRagReadiness: { maxUniqueIds: 50 },
      },
      integrity: { status: 'clear', conflictCount: 0, mutationAuthorized: false },
    });
    expect(result.warnings).toHaveLength(2);
    expect(persistence).toHaveBeenCalledWith('mongodb', 'query', expect.objectContaining({
      collection: 'mcs_knowledge_chunks',
      filter: expect.objectContaining({ status: 'active', retrievalEligible: true, 'scope.teamKey': 'team_magnificent' }),
    }));
    expect(JSON.stringify(result.retrievalPerformance)).not.toMatch(/query|tmagId|sessionId|packet|knowledgeId|summary|content/i);
  });

  it('reports ready only when eligible chunks have no unresolved Chroma projection', async () => {
    persistence.mockImplementation(async (_tool, action, params) => {
      if (action === 'list_collections') return {
        collections: [{ name: 'mcs_knowledge_sources' }, { name: 'tmag_resource_catalog' }], count: 2,
      };
      if (params.sort) return { count: 0, documents: [] };
      const count = params.collection === 'mcs_knowledge_sources' ? 2
        : params.collection === 'mcs_knowledge_chunks' ? 7 : 0;
      return { count };
    });
    const { buildAdminKnowledgeStatus } = await import('../adminKnowledgeStatus.js');
    await expect(buildAdminKnowledgeStatus()).resolves.toMatchObject({ status: 'ready', retrievalReadyChunks: 7 });
  });

  it('fails closed to degraded when any status read is unavailable', async () => {
    persistence.mockImplementation(async (_tool, action, params) => {
      if (action === 'list_collections') return {
        collections: [{ name: 'mcs_knowledge_sources' }, { name: 'tmag_resource_catalog' }], count: 2,
      };
      if (params.sort) return { count: 0, documents: [] };
      if (params.collection === 'mcs_knowledge_chunks' && params.filter.retrievalEligible) throw new Error('mongo offline');
      return { count: 0 };
    });
    const { buildAdminKnowledgeStatus } = await import('../adminKnowledgeStatus.js');
    const result = await buildAdminKnowledgeStatus();
    expect(result.status).toBe('degraded');
    expect(result.warnings).toContain('Retrieval-eligible knowledge chunks unavailable: mongo offline');
  });
});
