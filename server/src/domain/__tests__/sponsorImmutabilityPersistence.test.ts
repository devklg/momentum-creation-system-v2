import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  writeGraphCritical: vi.fn(),
}));

vi.mock('../../services/tieredWrite.js', () => ({
  writeGraphCritical: mocks.writeGraphCritical,
}));

import {
  buildAccessCodeGraphCypher,
  buildSponsorOverrideGraphCypher,
  writeAccessCodeGraphCritical,
  writeSponsorOverrideGraphCritical,
} from '../sponsorImmutabilityPersistence.js';

beforeEach(() => {
  mocks.writeGraphCritical.mockReset();
  mocks.writeGraphCritical.mockResolvedValue({
    tier: 'graph_critical',
    id: 'TMAG-CODE',
    mongo: { ok: true, verified: true },
    neo4j: { ok: true, verified: true },
  });
});

describe('sponsor immutability graph-critical persistence', () => {
  it('uses MATCH for access-code owners so missing sponsors roll back Mongo', async () => {
    await writeAccessCodeGraphCritical({
      id: 'TMAG-ABCD',
      mongoDoc: { code: 'TMAG-ABCD', sponsorTmagId: 'TMAG-01' },
      sponsorTmagId: 'TMAG-01',
      relationship: 'HOLDS_CODE',
      codeProps: {
        active: true,
        createdAt: '2026-07-11T00:00:00.000Z',
        ignored: undefined,
      },
    });

    const call = mocks.writeGraphCritical.mock.calls[0]?.[0];
    expect(call.mongoCollection).toBe('tmag_access_codes');
    expect(call.neo4j.cypher).toContain(
      'MATCH (b:TeamMagnificentMember {tmagId: $sponsorTmagId})',
    );
    expect(call.neo4j.cypher).not.toContain('MERGE (b:TeamMagnificentMember');
    expect(call.neo4j.cypher).toContain('MERGE (b)-[:HOLDS_CODE]->(c)');
    expect(call.neo4j.verifyCypher).toContain('RETURN count(c) AS n');
    expect(call.neo4j.params.codeProps).toEqual({
      code: 'TMAG-ABCD',
      active: true,
      createdAt: '2026-07-11T00:00:00.000Z',
    });
  });

  it('preserves the admin-mint USES edge shape when requested', () => {
    const graph = buildAccessCodeGraphCypher('USES');
    expect(graph.cypher).toContain('MERGE (b)-[:USES]->(c)');
    expect(graph.verifyCypher).toContain('-[:USES]->');
  });

  it('uses MATCH for sponsor override endpoints and verifies the current and original edges', async () => {
    await writeSponsorOverrideGraphCritical({
      id: 'override_1',
      mongoDoc: { overrideId: 'override_1', tmagId: 'TMAG-03' },
      tmagId: 'TMAG-03',
      previousSponsorTmagId: 'TMAG-01',
      newSponsorTmagId: 'TMAG-02',
      overrideProps: {
        performedAt: '2026-07-11T00:00:00.000Z',
        reason: 'BA requested correction',
        auditEntryId: 'audit_1',
        omitted: undefined,
      },
    });

    const call = mocks.writeGraphCritical.mock.calls[0]?.[0];
    expect(call.mongoCollection).toBe('tmag_admin_sponsor_overrides');
    expect(call.neo4j.cypher).toContain('MATCH (n:TeamMagnificentMember {tmagId: $tmagId})');
    expect(call.neo4j.cypher).toContain(
      'MATCH (newS:TeamMagnificentMember {tmagId: $newSponsorTmagId})',
    );
    expect(call.neo4j.cypher).toContain(
      'MATCH (prevS:TeamMagnificentMember {tmagId: $previousSponsorTmagId})',
    );
    expect(call.neo4j.cypher).not.toContain('MERGE (newS:TeamMagnificentMember');
    expect(call.neo4j.cypher).not.toContain('MERGE (prevS:TeamMagnificentMember');
    expect(call.neo4j.verifyCypher).toContain('RETURN count(o) AS n');
    expect(call.neo4j.verifyCypher).toContain('-[:SPONSORED_BY {current: true}]->');
    expect(call.neo4j.verifyCypher).toContain('-[:HAS_ORIGINAL_SPONSOR]->');
    expect(call.neo4j.params.overrideProps).toEqual({
      overrideId: 'override_1',
      performedAt: '2026-07-11T00:00:00.000Z',
      reason: 'BA requested correction',
      auditEntryId: 'audit_1',
    });
  });

  it('can verify an override with no previous sponsor without creating a phantom previous node', () => {
    const graph = buildSponsorOverrideGraphCypher(null);
    expect(graph.cypher).not.toContain('previousSponsorTmagId');
    expect(graph.cypher).not.toContain('HAS_ORIGINAL_SPONSOR');
    expect(graph.verifyCypher).not.toContain('HAS_ORIGINAL_SPONSOR');
    expect(graph.verifyCypher).toContain('RETURN count(o) AS n');
  });
});
