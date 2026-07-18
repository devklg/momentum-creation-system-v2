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
      .mockResolvedValueOnce({ documents: [{ _id: 'legacy-1', prospectId: 'prospect_1' }] })
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

    expect(mocks.persistenceCall).toHaveBeenNthCalledWith(1, 'mongodb', 'query', {
      database: 'momentum',
      collection: 'tmag_prospect_htank_placements',
      filter: {
        prospectId: 'prospect_1',
        placementId: { $exists: false },
        flushedAt: null,
      },
      sort: { placedAt: -1 },
      limit: 2,
    });
    expect(mocks.persistenceCall).toHaveBeenNthCalledWith(2, 'mongodb', 'update', {
      database: 'momentum',
      collection: 'tmag_prospect_htank_placements',
      filter: { _id: 'legacy-1' },
      update: { $set: { sponsorTmagId: 'TMAG-02', updatedAt: 'now' } },
    });
    expect(mocks.persistenceCall).toHaveBeenNthCalledWith(
      4,
      'neo4j',
      'cypher',
      expect.objectContaining({
        query: expect.stringContaining('IN_HOLDING_TANK'),
      }),
    );
    expect(mocks.persistenceCall).toHaveBeenNthCalledWith(
      3,
      'mongodb',
      'query',
      expect.objectContaining({
        filter: { _id: 'legacy-1' },
      }),
    );
    expect(mocks.enqueueProjection).not.toHaveBeenCalled();
  });

  it('queues placement graph projection when the operational graph patch does not verify', async () => {
    mocks.persistenceCall
      .mockResolvedValueOnce({ documents: [{ _id: 'legacy-2', placementId: undefined }] })
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

  it('updates exactly one legacy row by _id when placementId is absent', async () => {
    mocks.persistenceCall
      .mockResolvedValueOnce({
        documents: [
          { _id: 'legacy-live', prospectId: 'prospect_1', flushedAt: null },
          { _id: 'legacy-old', prospectId: 'prospect_1', flushedAt: null },
        ],
      });

    await expect(
      updatePoolPlacementOperational({
        prospectId: 'prospect_1',
        patch: { flushReason: 'archived' },
        relationshipPatch: { flushReason: 'archived' },
      }),
    ).rejects.toThrow('pool_placement_target_not_unique_legacy:prospect_1');
    expect(mocks.persistenceCall).toHaveBeenCalledTimes(1);
    expect(mocks.enqueueProjection).not.toHaveBeenCalled();
  });

  it('targets a specific konga-like placement by placementId', async () => {
    mocks.persistenceCall
      .mockResolvedValueOnce({ documents: [{ _id: 'new-live-1', placementId: 'placement-live-1' }] })
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ documents: [{ placementId: 'placement-live-1', flushReason: 'expired' }] })
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ records: [{ n: 1 }] });

    await updatePoolPlacementOperational({
      prospectId: 'prospect_1',
      placementId: 'placement-live-1',
      patch: { flushReason: 'expired' },
      relationshipPatch: { flushReason: 'expired' },
    });

    expect(mocks.persistenceCall).toHaveBeenNthCalledWith(1, 'mongodb', 'query', {
      database: 'momentum',
      collection: 'tmag_prospect_htank_placements',
      filter: {
        prospectId: 'prospect_1',
        placementId: 'placement-live-1',
      },
      sort: { placedAt: -1 },
      limit: 2,
    });
    expect(mocks.persistenceCall).toHaveBeenNthCalledWith(
      2,
      'mongodb',
      'update',
      expect.objectContaining({
        filter: { _id: 'new-live-1' },
      }),
    );
    expect(mocks.persistenceCall).toHaveBeenNthCalledWith(
      3,
      'mongodb',
      'query',
      expect.objectContaining({
        filter: { _id: 'new-live-1' },
      }),
    );
    expect(mocks.persistenceCall).toHaveBeenNthCalledWith(
      4,
      'neo4j',
      'cypher',
      expect.objectContaining({
        query: expect.stringContaining('r.placementId = $placementId'),
        params: expect.objectContaining({ placementId: 'placement-live-1' }),
      }),
    );
  });
});
