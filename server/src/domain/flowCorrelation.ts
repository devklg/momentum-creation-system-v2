import type { McsFlowCorrelation } from '@momentum/shared';

export function createFlowCorrelation(input: {
  rootKind: McsFlowCorrelation['rootKind'];
  rootId: string;
  tokenId?: string | null;
  invitationId?: string | null;
  prospectId?: string | null;
  crmRecordId?: string | null;
  vmCampaignId?: string | null;
  leadId?: string | null;
}): McsFlowCorrelation {
  const safeRoot = input.rootId.replace(/[^a-zA-Z0-9_-]/g, '_');
  return {
    correlationId: `corr_${input.rootKind}_${safeRoot}`,
    rootKind: input.rootKind,
    rootId: input.rootId,
    tokenId: input.tokenId ?? null,
    invitationId: input.invitationId ?? null,
    prospectId: input.prospectId ?? null,
    crmRecordId: input.crmRecordId ?? null,
    vmCampaignId: input.vmCampaignId ?? null,
    leadId: input.leadId ?? null,
  };
}

export function withCrmCorrelation(correlation: McsFlowCorrelation, crmRecordId: string): McsFlowCorrelation {
  return { ...correlation, crmRecordId };
}
