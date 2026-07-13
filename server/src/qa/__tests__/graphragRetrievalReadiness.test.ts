import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { McsContextPacketRequest, McsRuntimeRequestScope } from '@momentum/shared/runtime';

const persistence = vi.fn();
vi.mock('../../services/persistence/dispatch.js', () => ({ persistenceCall: persistence }));

const id = 'mcsgraph_knowledge_1_v1_en';
const mongoRecord = {
  _id: id, id, type: 'graphrag_chunk', schemaVersion: 1, namespace: 'momentum', source: 'mcs_graphrag',
  createdAt: '2026-07-13T00:00:00.000Z', title: 'Training Rhythm', originKind: 'system', serviceName: 'mcs_graphrag',
  tenantId: 'tenant_team_magnificent', teamKey: 'team_magnificent', derivedFrom: ['source_1', 'chunk_1'],
  knowledgeObjectId: 'knowledge_1', version: 1, domain: 'training', language: 'en', summary: 'Share, follow up, and teach duplication.',
  model: 'all-MiniLM-L6-v2', modelVersion: 'all-MiniLM-L6-v2', retrievalReady: true,
};
const projection = {
  id, knowledgeObjectId: 'knowledge_1', version: 1, domain: 'training', language: 'en',
  tenantId: 'tenant_team_magnificent', retrievalReady: true,
};

function healthyStores() {
  persistence.mockImplementation(async (tool: string, action: string, params: Record<string, unknown>) => {
    if (tool === 'mongodb' && (params.collection === 'mcs_graphrag_records')) return { documents: [mongoRecord] };
    if (tool === 'mongodb' && params.collection === 'tmag_projection_outbox') return { documents: [], count: 0 };
    if (tool === 'neo4j') return { records: [projection] };
    if (tool === 'chromadb' && action === 'get') return { ids: [id], documents: [mongoRecord.summary], metadatas: [projection] };
    throw new Error(`unexpected ${tool}.${action}`);
  });
}

describe('P1-88 GraphRAG cross-store retrieval readiness', () => {
  beforeEach(() => { persistence.mockReset(); healthyStores(); });

  it('requires exact Mongo, Chroma, Neo4j, and outbox agreement before entering a Context Packet', async () => {
    const { verifyGraphRagRetrievalReadiness, graphRagReadinessReference } = await import('../../domain/graphragReadiness.js');
    const readiness = await verifyGraphRagRetrievalReadiness(id);
    expect(readiness).toMatchObject({ status: 'ready', reasons: [] });
    expect(persistence).toHaveBeenCalledWith('chromadb', 'get', { collection: 'mcs_training_knowledge_en', ids: [id] });
    const reference = graphRagReadinessReference(readiness);
    expect(reference).toMatchObject({ knowledgeId: 'knowledge_1', sourceId: 'source_1', status: 'active' });

    const { createContextManagerService } = await import('../../runtime/context/contextManagerService.js');
    const service = createContextManagerService({ async listApprovedKnowledge() { return reference ? [reference] : []; } }, { createdAt: '2026-07-13T00:00:00.000Z' });
    const result = await service.buildContext({ scope, request });
    expect(result.packet.packetStatus).toBe('complete');
    expect(result.packet.approvedKnowledge.map((item) => item.knowledgeId)).toEqual(['knowledge_1']);
  });

  it('blocks readiness when an unresolved projection exists even if all stores appear ready', async () => {
    healthyStores();
    persistence.mockImplementation(async (tool: string, action: string, params: Record<string, unknown>) => {
      if (tool === 'mongodb' && params.collection === 'mcs_graphrag_records') return { documents: [mongoRecord] };
      if (tool === 'mongodb' && params.collection === 'tmag_projection_outbox') return { documents: [{ status: 'pending', target: 'chroma' }] };
      if (tool === 'neo4j') return { records: [projection] };
      if (tool === 'chromadb' && action === 'get') return { ids: [id], metadatas: [projection] };
      throw new Error('unexpected');
    });
    const m = await import('../../domain/graphragReadiness.js');
    const result = await m.verifyGraphRagRetrievalReadiness(id);
    expect(result).toMatchObject({ status: 'blocked', reasons: ['projection_unresolved'] });
    expect(m.graphRagReadinessReference(result)).toBeNull();
  });

  it.each([
    ['Neo4j mismatch', 'neo4j'],
    ['Chroma mismatch', 'chromadb'],
  ])('fails closed on %s and yields a degraded empty Context Packet', async (_label, brokenStore) => {
    healthyStores();
    persistence.mockImplementation(async (tool: string, action: string, params: Record<string, unknown>) => {
      if (tool === 'mongodb' && params.collection === 'mcs_graphrag_records') return { documents: [mongoRecord] };
      if (tool === 'mongodb') return { documents: [] };
      if (tool === 'neo4j') return { records: [{ ...projection, tenantId: brokenStore === 'neo4j' ? 'wrong' : projection.tenantId }] };
      if (tool === 'chromadb' && action === 'get') return { ids: [id], metadatas: [{ ...projection, version: brokenStore === 'chromadb' ? 99 : 1 }] };
      throw new Error('unexpected');
    });
    const m = await import('../../domain/graphragReadiness.js');
    const readiness = await m.verifyGraphRagRetrievalReadiness(id);
    expect(readiness.status).toBe('blocked');
    expect(m.graphRagReadinessReference(readiness)).toBeNull();
    const { createContextManagerService } = await import('../../runtime/context/contextManagerService.js');
    const packet = await createContextManagerService({ async listApprovedKnowledge() { return []; } }).buildContext({ scope, request });
    expect(packet.packet.packetStatus).toBe('degraded');
    expect(packet.packet.approvedKnowledge).toEqual([]);
  });

  it('does not inspect or mutate projections when Mongo is not explicitly retrieval-ready', async () => {
    persistence.mockResolvedValueOnce({ documents: [{ ...mongoRecord, retrievalReady: false }] });
    const m = await import('../../domain/graphragReadiness.js');
    await expect(m.verifyGraphRagRetrievalReadiness(id)).resolves.toMatchObject({ status: 'blocked', reasons: ['mongo_not_retrieval_ready'] });
    expect(persistence).toHaveBeenCalledTimes(1);
    expect(persistence.mock.calls.every((call) => ['query', 'get', 'cypher'].includes(String(call[1])))).toBe(true);
  });

  it('degrades without a readiness claim when a store is unavailable', async () => {
    persistence.mockRejectedValue(new Error('store offline'));
    const m = await import('../../domain/graphragReadiness.js');
    await expect(m.verifyGraphRagRetrievalReadiness(id)).resolves.toMatchObject({ status: 'degraded', reasons: ['mongo_error:store offline'] });
  });
});

const scope = {
  tenantId: 'tenant_team_magnificent', teamId: 'team_magnificent', teamKey: 'team_magnificent', teamName: 'Team Magnificent',
  tmagId: 'TMAG-001', requestId: 'ctx_req_p188', sessionId: 'session_p188',
} as McsRuntimeRequestScope;
const request = {
  requestId: 'ctx_req_p188', sessionId: 'session_p188', agentKey: 'michael_magnificent', language: 'en', taskType: 'training_support',
} as McsContextPacketRequest;
