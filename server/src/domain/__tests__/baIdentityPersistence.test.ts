import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  writeGraphCritical: vi.fn(),
}));

vi.mock('../../services/tieredWrite.js', () => ({
  writeGraphCritical: mocks.writeGraphCritical,
}));

import {
  buildBaIdentityGraphCypher,
  writeBaIdentityGraphCritical,
} from '../baIdentityPersistence.js';

beforeEach(() => {
  mocks.writeGraphCritical.mockReset();
  mocks.writeGraphCritical.mockResolvedValue({
    tier: 'graph_critical',
    id: 'TMBA-1',
    mongo: { ok: true, verified: true },
    neo4j: { ok: true, verified: true },
  });
});

describe('BA identity graph-critical persistence', () => {
  it('uses MATCH for sponsor-backed writes so missing sponsors roll back Mongo', async () => {
    await writeBaIdentityGraphCritical({
      id: 'TMBA-NEW',
      mongoDoc: { tmagId: 'TMBA-NEW', firstName: 'New' },
      sponsorTmagId: 'TMBA-SPONSOR',
      nodeProps: {
        firstName: 'New',
        email: undefined,
      },
    });

    const call = mocks.writeGraphCritical.mock.calls[0]?.[0];
    expect(call.mongoCollection).toBe('team_magnificent_members');
    expect(call.neo4j.cypher).toContain('MATCH (s:TeamMagnificentMember {tmagId: $sponsorTmagId})');
    expect(call.neo4j.cypher).not.toContain('MERGE (s:TeamMagnificentMember');
    expect(call.neo4j.cypher).toContain('MERGE (n)-[:SPONSORED_BY]->(s)');
    expect(call.neo4j.verifyCypher).toContain('RETURN count(n) AS n');
    expect(call.neo4j.params.nodeProps).toEqual({ tmagId: 'TMBA-NEW', firstName: 'New' });
  });

  it('allows the explicit root-founder bootstrap without a sponsor edge', () => {
    const root = buildBaIdentityGraphCypher(null);
    expect(root.cypher).toContain('MERGE (n:TeamMagnificentMember {tmagId: $id})');
    expect(root.cypher).not.toContain('SPONSORED_BY');
    expect(root.verifyCypher).toBe(
      'MATCH (n:TeamMagnificentMember {tmagId: $id}) RETURN count(n) AS n',
    );
  });

  it('forwards founder Chroma projection through the graph-critical helper', async () => {
    await writeBaIdentityGraphCritical({
      id: 'TMAG-01',
      mongoDoc: { tmagId: 'TMAG-01', firstName: 'Kevin' },
      sponsorTmagId: null,
      nodeProps: { firstName: 'Kevin', founder: true },
      chroma: {
        collection: 'mcs_members',
        document: 'Founder member Kevin Gardner',
        metadata: { tmagId: 'TMAG-01' },
      },
    });

    const call = mocks.writeGraphCritical.mock.calls[0]?.[0];
    expect(call.chroma).toEqual({
      collection: 'mcs_members',
      document: 'Founder member Kevin Gardner',
      metadata: { tmagId: 'TMAG-01' },
    });
  });
});
