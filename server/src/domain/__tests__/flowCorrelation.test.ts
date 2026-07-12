import { describe, expect, it } from 'vitest';
import { createFlowCorrelation, withCrmCorrelation } from '../flowCorrelation.js';

describe('flow correlation', () => {
  it('creates one stable invitation envelope and enriches it without changing the id', () => {
    const base = createFlowCorrelation({ rootKind: 'invitation', rootId: 'inv_prospect_1', invitationId: 'inv_prospect_1', prospectId: 'prospect_1', tokenId: 'tok_1' });
    const crm = withCrmCorrelation(base, 'crm_prospect_1');
    expect(base.correlationId).toBe('corr_invitation_inv_prospect_1');
    expect(crm).toMatchObject({ correlationId: base.correlationId, tokenId: 'tok_1', invitationId: 'inv_prospect_1', crmRecordId: 'crm_prospect_1' });
    expect(base.crmRecordId).toBeNull();
  });

  it('links VM/RVM campaign, lead, token, prospect, and CRM identifiers', () => {
    const base = createFlowCorrelation({ rootKind: 'vm_rvm', rootId: 'lead_1', leadId: 'lead_1', vmCampaignId: 'vm_1', prospectId: 'prospect_1', tokenId: 'tok_1' });
    expect(withCrmCorrelation(base, 'crm_prospect_1')).toEqual({
      correlationId: 'corr_vm_rvm_lead_1', rootKind: 'vm_rvm', rootId: 'lead_1', tokenId: 'tok_1', invitationId: null,
      prospectId: 'prospect_1', crmRecordId: 'crm_prospect_1', vmCampaignId: 'vm_1', leadId: 'lead_1',
    });
  });
});
