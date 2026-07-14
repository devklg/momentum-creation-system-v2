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

describe('P2-132 GraphRAG readiness batching', () => {
  beforeEach(() => { persistence.mockReset(); });

  it('uses set-oriented reads, groups Chroma by collection, and preserves caller order', async () => {
    const second = {
      ...mongoRecord,
      _id: 'mcsgraph_knowledge_2_v1_es', id: 'mcsgraph_knowledge_2_v1_es',
      knowledgeObjectId: 'knowledge_2', language: 'es', derivedFrom: ['source_2', 'chunk_2'],
    };
    const third = {
      ...mongoRecord,
      _id: 'mcsgraph_knowledge_3_v1_en', id: 'mcsgraph_knowledge_3_v1_en',
      knowledgeObjectId: 'knowledge_3', derivedFrom: ['source_3', 'chunk_3'],
    };
    const records = [mongoRecord, second, third];
    persistence.mockImplementation(async (tool: string, action: string, params: Record<string, unknown>) => {
      if (tool === 'mongodb' && params.collection === 'mcs_graphrag_records') return { documents: records };
      if (tool === 'mongodb' && params.collection === 'tmag_projection_outbox') {
        return { documents: [{ entityId: second.id, status: 'pending' }], count: 1 };
      }
      if (tool === 'neo4j') return { records: records.map(({ id: rowId, knowledgeObjectId, version, domain, language, tenantId, retrievalReady }) => ({ id: rowId, knowledgeObjectId, version, domain, language, tenantId, retrievalReady })) };
      if (tool === 'chromadb' && action === 'get') {
        const requested = params.ids as string[];
        const selected = records.filter((record) => requested.includes(record.id));
        return {
          ids: selected.map((record) => record.id),
          metadatas: selected.map(({ id: rowId, knowledgeObjectId, version, domain, language, tenantId, retrievalReady }) => ({ id: rowId, knowledgeObjectId, version, domain, language, tenantId, retrievalReady })),
        };
      }
      throw new Error(`unexpected ${tool}.${action}`);
    });
    const m = await import('../../domain/graphragReadiness.js');
    m.resetGraphRagReadinessDiagnosticsForTests();
    const result = await m.verifyGraphRagRetrievalReadinessBatch([second.id, id, second.id, third.id]);

    expect(result.map((entry) => [entry.id, entry.status])).toEqual([
      [second.id, 'blocked'], [id, 'ready'], [second.id, 'blocked'], [third.id, 'ready'],
    ]);
    expect(result[0]?.reasons).toEqual(['projection_unresolved']);
    expect(persistence.mock.calls.filter((call) => call[0] === 'mongodb')).toHaveLength(2);
    expect(persistence.mock.calls.filter((call) => call[0] === 'neo4j')).toHaveLength(1);
    expect(persistence.mock.calls.filter((call) => call[0] === 'chromadb')).toHaveLength(2);
    expect(m.getGraphRagReadinessDiagnostics()).toEqual({
      retention: 'in_process_since_restart', maxUniqueIds: 50, batches: 1, requestedIds: 4,
      storeCalls: { mongoCanonical: 1, mongoOutbox: 1, neo4j: 1, chroma: 2 },
    });
    expect(result[0]?.record).not.toBe(result[2]?.record);
    if (result[0]?.record) result[0].record.summary = 'caller mutation';
    expect(result[2]?.record?.summary).toBe(second.summary);
  });

  it('rejects more than 50 unique ids before any store read', async () => {
    const m = await import('../../domain/graphragReadiness.js');
    await expect(m.verifyGraphRagRetrievalReadinessBatch(
      Array.from({ length: 51 }, (_, index) => `graph_${index}`),
    )).rejects.toThrow('at most 50 unique ids');
    expect(persistence).not.toHaveBeenCalled();
  });

  it('isolates a failed Chroma collection without degrading healthy groups', async () => {
    const spanish = {
      ...mongoRecord,
      _id: 'mcsgraph_knowledge_2_v1_es', id: 'mcsgraph_knowledge_2_v1_es',
      knowledgeObjectId: 'knowledge_2', language: 'es', derivedFrom: ['source_2', 'chunk_2'],
    };
    const records = [mongoRecord, spanish];
    persistence.mockImplementation(async (tool: string, action: string, params: Record<string, unknown>) => {
      if (tool === 'mongodb' && params.collection === 'mcs_graphrag_records') return { documents: records };
      if (tool === 'mongodb') return { documents: [], count: 0 };
      if (tool === 'neo4j') return { records: records.map(({ id: rowId, knowledgeObjectId, version, domain, language, tenantId, retrievalReady }) => ({ id: rowId, knowledgeObjectId, version, domain, language, tenantId, retrievalReady })) };
      if (tool === 'chromadb' && action === 'get') {
        if (params.collection === 'mcs_training_knowledge_es') throw new Error('spanish collection offline');
        return { ids: [id], metadatas: [projection] };
      }
      throw new Error(`unexpected ${tool}.${action}`);
    });
    const m = await import('../../domain/graphragReadiness.js');
    const result = await m.verifyGraphRagRetrievalReadinessBatch([id, spanish.id]);
    expect(result[0]).toMatchObject({ id, status: 'ready', reasons: [] });
    expect(result[1]).toMatchObject({
      id: spanish.id, status: 'degraded', reasons: ['chroma_error:spanish collection offline'],
    });
  });

  it('fails closed for every eligible id when the bounded outbox result is truncated', async () => {
    const second = {
      ...mongoRecord,
      _id: 'mcsgraph_knowledge_2_v1_en', id: 'mcsgraph_knowledge_2_v1_en',
      knowledgeObjectId: 'knowledge_2', derivedFrom: ['source_2', 'chunk_2'],
    };
    const records = [mongoRecord, second];
    persistence.mockImplementation(async (tool: string, action: string, params: Record<string, unknown>) => {
      if (tool === 'mongodb' && params.collection === 'mcs_graphrag_records') return { documents: records };
      if (tool === 'mongodb' && params.collection === 'tmag_projection_outbox') {
        return { documents: [{ entityId: id, status: 'pending' }], count: 5 };
      }
      if (tool === 'neo4j') return {
        records: records.map(({ id: rowId, knowledgeObjectId, version, domain, language, tenantId, retrievalReady }) =>
          ({ id: rowId, knowledgeObjectId, version, domain, language, tenantId, retrievalReady })),
      };
      if (tool === 'chromadb' && action === 'get') return {
        ids: records.map((record) => record.id),
        metadatas: records.map(({ id: rowId, knowledgeObjectId, version, domain, language, tenantId, retrievalReady }) =>
          ({ id: rowId, knowledgeObjectId, version, domain, language, tenantId, retrievalReady })),
      };
      throw new Error(`unexpected ${tool}.${action}`);
    });

    const m = await import('../../domain/graphragReadiness.js');
    const result = await m.verifyGraphRagRetrievalReadinessBatch([id, second.id]);

    expect(result).toEqual([
      expect.objectContaining({ id, status: 'degraded', reasons: ['outbox_result_truncated'] }),
      expect.objectContaining({ id: second.id, status: 'degraded', reasons: ['outbox_result_truncated'] }),
    ]);
  });
});

const scope = {
  tenantId: 'tenant_team_magnificent', teamId: 'team_magnificent', teamKey: 'team_magnificent', teamName: 'Team Magnificent',
  tmagId: 'TMAG-001', requestId: 'ctx_req_p188', sessionId: 'session_p188',
} as McsRuntimeRequestScope;
const request = {
  requestId: 'ctx_req_p188', sessionId: 'session_p188', agentKey: 'michael_magnificent', language: 'en', taskType: 'training_support',
} as McsContextPacketRequest;
