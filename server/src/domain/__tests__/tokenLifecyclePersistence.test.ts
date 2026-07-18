import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';

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
  buildProspectTokenGraphCypher,
  buildVmLeadTokenGraphCypher,
  updateTokenLifecycleOperational,
  writeProspectTokenGraphCritical,
  writeVmLeadTokenGraphCritical,
} from '../tokenLifecyclePersistence.js';

beforeEach(() => {
  mocks.writeGraphCritical.mockReset();
  mocks.writeGraphCritical.mockResolvedValue({
    tier: 'graph_critical',
    id: 'TOKEN123',
    mongo: { ok: true, verified: true },
    neo4j: { ok: true, verified: true },
  });
  mocks.persistenceCall.mockReset();
  mocks.enqueueProjection.mockReset();
  mocks.enqueueProjection.mockResolvedValue('obx_1');
});

describe('token lifecycle persistence', () => {
  it('creates prospect tokens with a MATCHed prospect edge and readback', async () => {
    const tokenHash = createHash('sha256').update('TOKEN123').digest('hex');
    await writeProspectTokenGraphCritical({
      token: 'TOKEN123',
      prospectId: 'prospect_1',
      sponsorTmagId: 'TMAG-01',
      mongoDoc: { token: 'TOKEN123', prospectId: 'prospect_1' },
      tokenProps: { state: 'minted', createdAt: '2026-07-11T00:00:00.000Z' },
    });

    const call = mocks.writeGraphCritical.mock.calls[0]?.[0];
    expect(call.mongoCollection).toBe('tmag_prospect_invite_tokens');
    expect(call.neo4j.cypher).toContain('MATCH (p:TmagProspect {prospectId: $prospectId})');
    expect(call.neo4j.cypher).not.toContain('MERGE (p:TmagProspect');
    expect(call.neo4j.verifyCypher).toContain('RETURN count(t) AS n');
    expect(call.id).toBe(tokenHash);
    expect(call.neo4j.params.tokenProps).toMatchObject({
      tokenHash,
      prospectId: 'prospect_1',
      sponsorTmagId: 'TMAG-01',
      state: 'minted',
    });
    expect(call.neo4j.params).not.toHaveProperty('token');
    expect(JSON.stringify(call.neo4j)).not.toContain('TOKEN123');
  });

  it('creates VM lead tokens with a MATCHed VM lead edge and readback', async () => {
    const tokenHash = createHash('sha256').update('RVMTOKEN').digest('hex');
    await writeVmLeadTokenGraphCritical({
      token: 'RVMTOKEN',
      leadId: 'lead_1',
      ownerTmagId: 'TMAG-OWNER',
      sponsorTmagId: 'TMAG-SPONSOR',
      mongoDoc: { token: 'RVMTOKEN', leadId: 'lead_1' },
      tokenProps: { tokenKind: 'rvm', state: 'minted' },
    });

    const call = mocks.writeGraphCritical.mock.calls[0]?.[0];
    expect(call.neo4j.cypher).toContain('MATCH (l:TmagVmBulkLead {leadId: $leadId})');
    expect(call.neo4j.cypher).not.toContain('MERGE (l:TmagVmBulkLead');
    expect(call.neo4j.verifyCypher).toContain('FOR_VM_LEAD');
    expect(call.id).toBe(tokenHash);
    expect(call.neo4j.params.tokenProps).toMatchObject({
      tokenHash,
      leadId: 'lead_1',
      ownerTmagId: 'TMAG-OWNER',
      sponsorTmagId: 'TMAG-SPONSOR',
    });
    expect(call.neo4j.params).not.toHaveProperty('token');
    expect(JSON.stringify(call.neo4j)).not.toContain('RVMTOKEN');
  });

  it('documents the graph readback shapes', () => {
    expect(buildProspectTokenGraphCypher().verifyCypher).toContain('-[:FOR_PROSPECT]->');
    expect(buildVmLeadTokenGraphCypher().verifyCypher).toContain('-[:FOR_VM_LEAD]->');
  });

  it('updates Mongo, verifies the patch, and projects token state to Neo4j', async () => {
    mocks.persistenceCall
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ documents: [{ token: 'TOKEN123', state: 'clicked', updatedAt: 'now' }] })
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ records: [{ n: 1 }] });

    await updateTokenLifecycleOperational({
      token: 'TOKEN123',
      patch: { state: 'clicked', updatedAt: 'now', ignored: undefined },
    });

    expect(mocks.persistenceCall).toHaveBeenNthCalledWith(1, 'mongodb', 'update', {
      database: 'momentum',
      collection: 'tmag_prospect_invite_tokens',
      filter: { token: 'TOKEN123' },
      update: { $set: { state: 'clicked', updatedAt: 'now' } },
    });
    expect(mocks.persistenceCall).toHaveBeenNthCalledWith(
      3,
      'neo4j',
      'cypher',
      expect.objectContaining({
        query: expect.stringContaining('MATCH (t:TmagInviteToken {tokenHash: $tokenHash})'),
      }),
    );
    expect(mocks.enqueueProjection).not.toHaveBeenCalled();
  });

  it('queues the Neo4j projection if the operational graph update does not verify', async () => {
    mocks.persistenceCall
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ documents: [{ token: 'TOKEN123', state: 'expired' }] })
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ records: [{ n: 0 }] });

    await updateTokenLifecycleOperational({
      token: 'TOKEN123',
      patch: { state: 'expired' },
    });

    expect(mocks.enqueueProjection).toHaveBeenCalledWith(
      expect.objectContaining({
        tier: 'operational',
        target: 'neo4j',
        entityId: createHash('sha256').update('TOKEN123').digest('hex'),
        mongoCollection: 'tmag_prospect_invite_tokens',
      }),
    );
  });
});
