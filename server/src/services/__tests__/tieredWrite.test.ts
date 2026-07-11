import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  persistenceCall: vi.fn(),
  enqueueProjection: vi.fn(),
  assertChromaCollectionExists: vi.fn(),
}));

vi.mock('../persistence/dispatch.js', () => ({
  persistenceCall: mocks.persistenceCall,
}));

vi.mock('../projectionOutbox.js', () => ({
  enqueueProjection: mocks.enqueueProjection,
  extractCount(data: { records?: Array<Record<string, unknown>> }): number {
    const row = data.records?.[0];
    const value = row?.n ?? (row ? Object.values(row).find((item) => typeof item === 'number') : undefined);
    return typeof value === 'number' ? value : 0;
  },
}));

vi.mock('../chromaCollections.js', () => ({
  assertChromaCollectionExists: mocks.assertChromaCollectionExists,
  ChromaCollectionMissingError: class ChromaCollectionMissingError extends Error {
    constructor(public readonly collection: string) {
      super(`Chroma collection not registered: ${collection}`);
      this.name = 'ChromaCollectionMissingError';
    }
  },
}));

beforeEach(() => {
  mocks.persistenceCall.mockReset();
  mocks.enqueueProjection.mockReset();
  mocks.enqueueProjection.mockResolvedValue('obx_test');
  mocks.assertChromaCollectionExists.mockReset();
  mocks.assertChromaCollectionExists.mockResolvedValue(undefined);
});

function mockMongoInsertAndReadback(): void {
  mocks.persistenceCall.mockImplementation(async (tool: string, action: string) => {
    if (tool === 'mongodb' && action === 'insert') return { insertedCount: 1 };
    if (tool === 'mongodb' && action === 'query') return { count: 1, documents: [{ _id: 'record_1' }] };
    return {};
  });
}

describe('tieredWrite failure simulation', () => {
  it('graph-critical rolls back Mongo and throws when the required graph leg fails', async () => {
    const { GraphCriticalWriteError, writeGraphCritical } = await import('../tieredWrite.js');
    mocks.persistenceCall.mockImplementation(async (tool: string, action: string) => {
      if (tool === 'mongodb' && action === 'insert') return { insertedCount: 1 };
      if (tool === 'mongodb' && action === 'query') return { count: 1, documents: [{ _id: 'member_1' }] };
      if (tool === 'mongodb' && action === 'delete') return { deletedCount: 1 };
      if (tool === 'neo4j' && action === 'cypher') throw new Error('neo4j unavailable');
      return {};
    });

    await expect(
      writeGraphCritical({
        id: 'member_1',
        mongoCollection: 'team_magnificent_members',
        mongoDoc: { tmagId: 'TMBA-1' },
        neo4j: {
          cypher: 'MATCH (s:TeamMagnificentMember {tmagId:$sponsor}) CREATE (n:TeamMagnificentMember {tmagId:$id})',
          params: { sponsor: 'TMBA-0' },
          verifyCypher: 'MATCH (n:TeamMagnificentMember {tmagId:$id}) RETURN count(n) AS n',
        },
      }),
    ).rejects.toBeInstanceOf(GraphCriticalWriteError);

    expect(mocks.persistenceCall).toHaveBeenCalledWith('mongodb', 'delete', {
      database: 'momentum',
      collection: 'team_magnificent_members',
      filter: { _id: 'member_1' },
    });
    expect(mocks.enqueueProjection).not.toHaveBeenCalled();
  });

  it('knowledge keeps Mongo success and queues a failed Neo4j projection', async () => {
    const { writeKnowledge } = await import('../tieredWrite.js');
    mockMongoInsertAndReadback();
    mocks.persistenceCall.mockImplementation(async (tool: string, action: string) => {
      if (tool === 'mongodb' && action === 'insert') return { insertedCount: 1 };
      if (tool === 'mongodb' && action === 'query') return { count: 1, documents: [{ _id: 'knowledge_1' }] };
      if (tool === 'neo4j' && action === 'cypher') throw new Error('graph lag');
      return {};
    });

    const result = await writeKnowledge({
      id: 'knowledge_1',
      mongoCollection: 'mcs_learning_candidates',
      mongoDoc: { summary: 'Approved learning record' },
      neo4j: {
        cypher: 'CREATE (k:Knowledge {id:$id})',
        params: { domain: 'training' },
      },
    });

    expect(result.mongo).toEqual({ ok: true, verified: true });
    expect(result.neo4j).toMatchObject({ ok: false, queued: true, outboxId: 'obx_test' });
    expect(mocks.enqueueProjection).toHaveBeenCalledWith(
      expect.objectContaining({
        tier: 'knowledge',
        target: 'neo4j',
        entityId: 'knowledge_1',
        mongoCollection: 'mcs_learning_candidates',
        lastError: 'graph lag',
      }),
    );
  });

  it('operational keeps Mongo success and queues a failed Chroma projection', async () => {
    const { writeOperational } = await import('../tieredWrite.js');
    mockMongoInsertAndReadback();
    mocks.assertChromaCollectionExists.mockRejectedValue(new Error('collection unavailable'));

    const result = await writeOperational({
      id: 'audit_1',
      mongoCollection: 'mcs_audit_log',
      mongoDoc: { action: 'runtime.turn.opened' },
      chroma: {
        collection: 'mcs_audit_log',
        document: 'runtime turn opened',
        metadata: { action: 'runtime.turn.opened' },
      },
    });

    expect(result.mongo).toEqual({ ok: true, verified: true });
    expect(result.chroma).toMatchObject({ ok: false, queued: true, outboxId: 'obx_test' });
    expect(mocks.enqueueProjection).toHaveBeenCalledWith(
      expect.objectContaining({
        tier: 'operational',
        target: 'chroma',
        entityId: 'audit_1',
        mongoCollection: 'mcs_audit_log',
        lastError: 'collection unavailable',
      }),
    );
    const deleteCalls = mocks.persistenceCall.mock.calls.filter(
      ([tool, action]) => tool === 'mongodb' && action === 'delete',
    );
    expect(deleteCalls).toEqual([]);
  });
});
