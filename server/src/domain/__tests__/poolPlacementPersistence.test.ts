import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  writeGraphCritical: vi.fn(),
  persistenceCall: vi.fn(),
  enqueueProjection: vi.fn(),
}));

vi.mock('../../services/tieredWrite.js', () => ({
  writeGraphCritical: mocks.writeGraphCritical,
}));

vi.mock('../../services/persistence/dispatch.js', () => ({
  persistenceCall: mocks.persistenceCall,
}));

vi.mock('../../services/projectionOutbox.js', async () => {
  const actual = await vi.importActual<typeof import('../../services/projectionOutbox.js')>(
    '../../services/projectionOutbox.js',
  );
  return {
    ...actual,
    enqueueProjection: mocks.enqueueProjection,
  };
});

import {
  buildPoolPlacementGraphCypher,
  updatePoolPlacementOperational,
  writePoolPlacementGraphCritical,
} from '../poolPlacementPersistence.js';

beforeEach(() => {
  mocks.writeGraphCritical.mockReset();
  mocks.writeGraphCritical.mockResolvedValue({
    tier: 'graph_critical',
    id: 'prospect_1',
    mongo: { ok: true, verified: true },
    neo4j: { ok: true, verified: true },
  });
  mocks.persistenceCall.mockReset();
  mocks.enqueueProjection.mockReset();
  mocks.enqueueProjection.mockResolvedValue('obx_1');
});

describe('pool placement persistence', () => {
  it('creates placements with a MATCHed prospect edge and readback verification', async () => {
    await writePoolPlacementGraphCritical({
      poolId: 'tm_team_pool',
      placement: {
        prospectId: 'prospect_1',
        sponsorTmagId: 'TMAG-01',
        positionNumber: 42,
        placedAt: '2026-07-11T00:00:00.000Z',
        expiresAt: '2026-09-05T00:00:00.000Z',
        flushedAt: null,
        flushReason: null,
      },
      relationshipProps: {
        position: 42,
        placedAt: '2026-07-11T00:00:00.000Z',
      },
    });

    const call = mocks.writeGraphCritical.mock.calls[0]?.[0];
    expect(call.mongoCollection).toBe('tmag_prospect_htank_placements');
    expect(call.neo4j.cypher).toContain('MATCH (p:TmagProspect {prospectId: $id})');
    expect(call.neo4j.cypher).not.toContain('MERGE (p:TmagProspect');
    expect(call.neo4j.cypher).toContain('MERGE (p)-[r:IN_HOLDING_TANK]->(pool)');
    expect(call.neo4j.verifyCypher).toContain('RETURN count(r) AS n');
    expect(call.neo4j.params.relationshipProps).toMatchObject({
      position: 42,
      sponsorTmagId: 'TMAG-01',
    });
  });

  it('documents the graph readback shape', () => {
    const graph = buildPoolPlacementGraphCypher();
    expect(graph.verifyCypher).toContain('-[r:IN_HOLDING_TANK]->');
    expect(graph.verifyCypher).toContain('RETURN count(r) AS n');
  });

  it('updates Mongo, verifies the placement patch, and projects the graph patch', async () => {
    mocks.persistenceCall
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({
        documents: [{ prospectId: 'prospect_1', sponsorTmagId: 'TMAG-02', updatedAt: 'now' }],
      })
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ records: [{ n: 1 }] });

    await updatePoolPlacementOperational({
      prospectId: 'prospect_1',
      patch: { sponsorTmagId: 'TMAG-02', updatedAt: 'now', ignored: undefined },
      relationshipPatch: { sponsorTmagId: 'TMAG-02' },
    });

    expect(mocks.persistenceCall).toHaveBeenNthCalledWith(1, 'mongodb', 'update', {
      database: 'momentum',
      collection: 'tmag_prospect_htank_placements',
      filter: { prospectId: 'prospect_1' },
      update: { $set: { sponsorTmagId: 'TMAG-02', updatedAt: 'now' } },
    });
    expect(mocks.persistenceCall).toHaveBeenNthCalledWith(
      3,
      'neo4j',
      'cypher',
      expect.objectContaining({
        query: expect.stringContaining('IN_HOLDING_TANK'),
      }),
    );
    expect(mocks.enqueueProjection).not.toHaveBeenCalled();
  });

  it('queues placement graph projection when the operational graph patch does not verify', async () => {
    mocks.persistenceCall
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ documents: [{ prospectId: 'prospect_1', flushReason: 'expired' }] })
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ records: [{ n: 0 }] });

    await updatePoolPlacementOperational({
      prospectId: 'prospect_1',
      patch: { flushReason: 'expired' },
      relationshipPatch: { flushReason: 'expired' },
    });

    expect(mocks.enqueueProjection).toHaveBeenCalledWith(
      expect.objectContaining({
        tier: 'operational',
        target: 'neo4j',
        entityId: 'prospect_1',
        mongoCollection: 'tmag_prospect_htank_placements',
      }),
    );
  });
});
