import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  writeGraphCritical: vi.fn(),
}));

vi.mock('../../services/tieredWrite.js', () => ({
  writeGraphCritical: mocks.writeGraphCritical,
}));

import {
  buildCrmOwnershipGraphCypher,
  writeCrmOwnershipGraphCritical,
} from '../crmOwnershipPersistence.js';

beforeEach(() => {
  mocks.writeGraphCritical.mockReset();
  mocks.writeGraphCritical.mockResolvedValue({
    tier: 'graph_critical',
    id: 'crm_1',
    mongo: { ok: true, verified: true },
    neo4j: { ok: true, verified: true },
  });
});

describe('CRM ownership persistence', () => {
  it('creates prospect CRM records with matched owner and prospect anchors', async () => {
    await writeCrmOwnershipGraphCritical({
      id: 'crm_1',
      ownerTmagId: 'TMAG-01',
      target: { kind: 'prospect', prospectId: 'prospect_1' },
      mongoDoc: { crmRecordId: 'crm_1', prospectId: 'prospect_1' },
      crmProps: {
        prospectId: 'prospect_1',
        status: 'inactive_pre_engagement',
        ignored: undefined,
      },
    });

    const call = mocks.writeGraphCritical.mock.calls[0]?.[0];
    expect(call.mongoCollection).toBe('tmag_prospect_crm_records');
    expect(call.neo4j.cypher).toContain('MATCH (b:TeamMagnificentMember {tmagId: $ownerTmagId})');
    expect(call.neo4j.cypher).toContain('MATCH (p:TmagProspect {prospectId: $prospectId})');
    expect(call.neo4j.cypher).not.toContain('MERGE (b:TeamMagnificentMember');
    expect(call.neo4j.cypher).not.toContain('MERGE (p:TmagProspect');
    expect(call.neo4j.verifyCypher).toContain('OWNS_CRM_RECORD');
    expect(call.neo4j.verifyCypher).toContain('FOR_PROSPECT');
    expect(call.neo4j.params.crmProps).toEqual({
      crmRecordId: 'crm_1',
      ownerTmagId: 'TMAG-01',
      prospectId: 'prospect_1',
      status: 'inactive_pre_engagement',
    });
  });

  it('creates VM lead CRM records with matched owner and lead anchors', async () => {
    await writeCrmOwnershipGraphCritical({
      id: 'crm_vm_1',
      ownerTmagId: 'TMAG-OWNER',
      target: { kind: 'vm_lead', leadId: 'lead_1' },
      mongoDoc: { crmRecordId: 'crm_vm_1', leadId: 'lead_1' },
      crmProps: { leadId: 'lead_1', status: 'inactive_pre_engagement' },
    });

    const call = mocks.writeGraphCritical.mock.calls[0]?.[0];
    expect(call.neo4j.cypher).toContain('MATCH (b:TeamMagnificentMember {tmagId: $ownerTmagId})');
    expect(call.neo4j.cypher).toContain('MATCH (l:TmagVmBulkLead {leadId: $leadId})');
    expect(call.neo4j.cypher).not.toContain('MERGE (l:TmagVmBulkLead');
    expect(call.neo4j.verifyCypher).toContain('HAS_CRM_RECORD');
    expect(call.neo4j.params.crmProps).toMatchObject({
      crmRecordId: 'crm_vm_1',
      ownerTmagId: 'TMAG-OWNER',
      leadId: 'lead_1',
    });
  });

  it('documents readback shape for both ownership targets', () => {
    expect(buildCrmOwnershipGraphCypher({ kind: 'prospect', prospectId: 'prospect_1' }).verifyCypher)
      .toContain('RETURN count(c) AS n');
    expect(buildCrmOwnershipGraphCypher({ kind: 'vm_lead', leadId: 'lead_1' }).verifyCypher)
      .toContain('RETURN count(c) AS n');
  });
});
