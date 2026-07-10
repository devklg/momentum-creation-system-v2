import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { McsContextPacketV1 } from '@momentum/shared/runtime';
import {
  appendRuntimeContextTrace,
  listRuntimeContextTraces,
  packetFromMichaelAdapterInput,
  RUNTIME_CONTEXT_TRACE_CHROMA_COLLECTION,
  RUNTIME_CONTEXT_TRACE_COLLECTION,
} from '../runtimeContextTrace.js';

const tripleStackWriteMock = vi.hoisted(() => vi.fn());
const persistenceCallMock = vi.hoisted(() => vi.fn());

vi.mock('../tripleStack.js', () => ({
  tripleStackWrite: tripleStackWriteMock,
}));

vi.mock('../persistence/dispatch.js', () => ({
  persistenceCall: persistenceCallMock,
}));

function packet(): McsContextPacketV1 {
  return {
    packetId: 'ctx_packet_trace' as never,
    requestId: 'ctx_req_trace' as never,
    packetStatus: 'complete',
    approvedKnowledge: [
      {
        knowledgeId: 'knw_trace_1' as never,
        sourceId: 'knowledge_source_trace_1' as never,
        title: 'Trace Source',
        summary: 'A short approved context summary.',
        status: 'active',
        governanceStatus: 'approved',
        language: 'en',
        sourceTraceability: {
          sourceId: 'knowledge_source_trace_1' as never,
          sourceType: 'owned_text',
          title: 'Trace Source',
        },
        retrieval: {
          retrievalMethod: 'direct_reference',
          reasonCodes: ['agent_task_match'],
          language: 'en',
          translationStatus: 'same_language',
        },
        translationStatus: 'same_language',
      },
    ],
    retrievalAudit: {
      includedKnowledgeIds: ['knw_trace_1' as never],
      excludedSourceIds: ['candidate_source_1' as never],
      retrievalMethods: ['direct_reference'],
      candidateKnowledgeExcluded: true,
    },
  } as unknown as McsContextPacketV1;
}

describe('runtime context trace service', () => {
  beforeEach(() => {
    tripleStackWriteMock.mockReset();
    persistenceCallMock.mockReset();
  });

  it('triple-stacks a content-free trace with packet ids and approved knowledge ids', async () => {
    tripleStackWriteMock.mockResolvedValue({ mongo: { ok: true }, neo4j: { ok: true }, chroma: { ok: true } });

    const record = await appendRuntimeContextTrace({
      agentKey: 'michael_magnificent',
      taskType: 'training_support',
      runtimeSurface: 'michael-runtime',
      tmagId: 'TMAG-001' as never,
      packet: packet(),
      queryHint: '  GLP THREE metabolic support and compensation questions  ',
      routeDecision: 'proceed',
      catalogKey: 'michael_next_training_step_en',
      responseType: 'next_training_step',
      createdAt: '2026-07-08T00:00:00.000Z',
    });

    expect(record.traceId).toMatch(/^ctx_trace_/);
    expect(record.approvedKnowledgeIds).toEqual(['knw_trace_1']);
    expect(record.approvedSourceIds).toEqual(['knowledge_source_trace_1']);
    expect(record.queryHint).toBe('GLP THREE metabolic support and compensation questions');
    expect(tripleStackWriteMock).toHaveBeenCalledWith(expect.objectContaining({
      id: record.traceId,
      mongoCollection: RUNTIME_CONTEXT_TRACE_COLLECTION,
      chroma: expect.objectContaining({
        collection: RUNTIME_CONTEXT_TRACE_CHROMA_COLLECTION,
      }),
    }));
    const writeArg = tripleStackWriteMock.mock.calls[0]![0];
    expect(JSON.stringify(writeArg)).not.toContain('A short approved context summary.');
  });

  it('lists recent traces from Mongo through the service boundary', async () => {
    persistenceCallMock.mockResolvedValue({
      documents: [{ traceId: 'ctx_trace_1', agentKey: 'michael_magnificent' }],
    });

    const traces = await listRuntimeContextTraces({
      agentKey: 'michael_magnificent',
      limit: 500,
    });

    expect(traces).toHaveLength(1);
    expect(persistenceCallMock).toHaveBeenCalledWith('mongodb', 'query', {
      database: 'momentum',
      collection: RUNTIME_CONTEXT_TRACE_COLLECTION,
      filter: {
        schemaVersion: 'runtime_context_trace.v1',
        agentKey: 'michael_magnificent',
      },
      sort: { createdAt: -1 },
      limit: 50,
    });
  });

  it('extracts a Context Packet from Michael adapter input only on accepted decisions', () => {
    const accepted = packetFromMichaelAdapterInput({
      runtimeTurn: {
        result: {
          decision: 'proceed',
          consumption: { packet: packet() },
        },
      },
    });
    const rejected = packetFromMichaelAdapterInput({
      runtimeTurn: {
        result: {
          decision: 'reject',
          consumption: { packet: packet() },
        },
      },
    });

    expect(accepted?.packetId).toBe('ctx_packet_trace');
    expect(rejected).toBeNull();
  });
});
