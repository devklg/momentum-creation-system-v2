import { createHash } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  appendProspectTimelineEvent: vi.fn(),
  createOrUpdateCrmRecordForToken: vi.fn(),
  createProspectAccount: vi.fn(),
  findVMCampaignForOwner: vi.fn(),
  markLeadOwnerImported: vi.fn(),
  mintUniqueToken: vi.fn(),
  persistenceCall: vi.fn(),
  writeOperational: vi.fn(),
  writeGraphCritical: vi.fn(),
  writeKnowledge: vi.fn(),
  writeProspectTokenGraphCritical: vi.fn(),
  writeVmLeadTokenGraphCritical: vi.fn(),
}));

vi.mock('../../services/persistence/dispatch.js', () => ({
  persistenceCall: mocks.persistenceCall,
}));

vi.mock('../../services/tieredWrite.js', () => ({
  writeOperational: mocks.writeOperational,
  writeGraphCritical: mocks.writeGraphCritical,
  writeKnowledge: mocks.writeKnowledge,
}));

vi.mock('../tokenLifecyclePersistence.js', () => ({
  writeProspectTokenGraphCritical: mocks.writeProspectTokenGraphCritical,
  writeVmLeadTokenGraphCritical: mocks.writeVmLeadTokenGraphCritical,
}));

vi.mock('../prospectAccount.js', async () => {
  const actual = await vi.importActual<typeof import('../prospectAccount.js')>('../prospectAccount.js');
  return {
    ...actual,
    createProspectAccount: mocks.createProspectAccount,
  };
});

vi.mock('../prospectCrm.js', () => ({
  appendProspectTimelineEvent: mocks.appendProspectTimelineEvent,
  createOrUpdateCrmRecordForToken: mocks.createOrUpdateCrmRecordForToken,
}));

vi.mock('../tokens.js', async () => {
  const actual = await vi.importActual<typeof import('../tokens.js')>('../tokens.js');
  return {
    ...actual,
    mintUniqueToken: mocks.mintUniqueToken,
  };
});

vi.mock('../vmCampaigns.js', () => ({
  findVMCampaignForOwner: mocks.findVMCampaignForOwner,
}));

vi.mock('../vmLeadOwners.js', () => ({
  markLeadOwnerImported: mocks.markLeadOwnerImported,
}));

describe('invitation mint identity', () => {
  beforeEach(async () => {
    mocks.appendProspectTimelineEvent.mockReset();
    mocks.createOrUpdateCrmRecordForToken.mockReset();
    mocks.createProspectAccount.mockReset();
    mocks.findVMCampaignForOwner.mockReset();
    mocks.markLeadOwnerImported.mockReset();
    mocks.mintUniqueToken.mockReset();
    mocks.persistenceCall.mockReset();
    mocks.writeOperational.mockReset();
    mocks.writeGraphCritical.mockReset();
    mocks.writeKnowledge.mockReset();
    mocks.writeProspectTokenGraphCritical.mockReset();
    mocks.writeVmLeadTokenGraphCritical.mockReset();
    vi.resetModules();
  });

  it('writes a fresh invitationRecordId for every minted invitation', async () => {
    mocks.mintUniqueToken.mockResolvedValue('TOKEN-NEW');
    mocks.createProspectAccount.mockResolvedValue({
      tokenId: 'TOKEN-NEW',
    } as never);
    mocks.createOrUpdateCrmRecordForToken.mockResolvedValue({
      crmRecordId: 'crm_1',
      prospectId: 'prospect_new',
      status: 'active',
    } as never);
    mocks.writeGraphCritical.mockResolvedValue({
      mongo: { ok: true, insertedCount: 1 },
      neo4j: { ok: true },
      chroma: { ok: true, verified: true },
    } as never);
    mocks.writeProspectTokenGraphCritical.mockResolvedValue({
      mongo: { ok: true },
    } as never);

    const { createInvitation } = await import('../invitations.js');
    const result = await createInvitation({
      sponsorTmagId: 'TMBA-SPONSOR',
      firstName: 'Avery',
      lastName: 'Quinn',
      email: null,
      phone: '2125551000',
      city: 'Los Angeles',
      stateOrRegion: 'CA',
      country: 'US',
      message: null,
      source: 'ivory',
      relationshipReason: null,
    });

    const write = mocks.writeProspectTokenGraphCritical.mock.calls[0]![0] as {
      token: string;
      mongoDoc: { token: string; invitationRecordId?: string };
      tokenProps: Record<string, unknown>;
    };
    const graphWrite = mocks.writeGraphCritical.mock.calls[0]![0] as {
      chroma: { collection: string; document: string; metadata: Record<string, unknown> };
    };
    const tokenHash = createHash('sha256').update(result.token).digest('hex');

    expect(result.token).toBe('TOKEN-NEW');
    expect(result.inviteUrl).toContain('TOKEN-NEW');
    expect(write.token).toBe('TOKEN-NEW');
    expect(write.mongoDoc.invitationRecordId).toMatch(/^invite_/);
    expect(write.mongoDoc.invitationRecordId).not.toBe(write.token);
    expect(write.tokenProps.invitationRecordId).toBe(write.mongoDoc.invitationRecordId);
    expect(graphWrite.chroma.metadata.invitationRecordId).toBe(write.mongoDoc.invitationRecordId);
    expect(graphWrite.chroma.metadata.tokenHash).toBe(tokenHash);
    expect(graphWrite.chroma.document).not.toContain(result.token);
    expect(graphWrite.chroma.document).toContain(tokenHash);
    expect(graphWrite.chroma.metadata).not.toHaveProperty('token');
  });

  it('reinvites with a fresh invitationRecordId when the token is expired', async () => {
    mocks.persistenceCall.mockImplementation(
      async (_tool: string, action: string, params: Record<string, unknown>) => {
        if (action === 'query') {
          if (params.collection === 'tmag_prospects') {
            return {
              documents: [
                {
                  prospectId: 'prospect-1',
                  sponsorTmagId: 'TMBA-SPONSOR',
                  token: 'TOKEN-OLD',
                  state: 'video_started',
                  sentAt: '2026-07-01T00:00:00.000Z',
                  expiresAt: '2026-07-01T00:00:00.000Z',
                },
              ],
            };
          }
          return { documents: [] };
        }
        if (action === 'update') return { matchedCount: 1 };
        return { ok: true };
      },
    );

    mocks.mintUniqueToken.mockResolvedValue('TOKEN-CRM-REINVITE');
    mocks.writeKnowledge.mockResolvedValue({
      mongo: { ok: true },
      neo4j: { ok: true },
      chroma: { ok: true },
    } as never);
    mocks.writeProspectTokenGraphCritical.mockResolvedValue({
      mongo: { ok: true },
    } as never);

    const { reinvite } = await import('../crm.js');
    const response = await reinvite('prospect-1', 'TMBA-SPONSOR');
    const write = mocks.writeProspectTokenGraphCritical.mock.calls[0]![0] as {
      token: string;
      mongoDoc: { invitationRecordId?: string };
      tokenProps: Record<string, unknown>;
    };

    expect(response.fresh).toBe(true);
    expect(response.token).toBe('TOKEN-CRM-REINVITE');
    expect(write.token).toBe('TOKEN-CRM-REINVITE');
    expect(write.mongoDoc.invitationRecordId).toMatch(/^invite_/);
    expect(write.mongoDoc.invitationRecordId).not.toBe(write.token);
    expect(write.tokenProps.invitationRecordId).toBe(write.mongoDoc.invitationRecordId);
    expect(write.tokenProps).not.toHaveProperty('token');
    expect(write.mongoDoc).toHaveProperty('invitationRecordId');
  });

  it('writes fresh invitationRecordId for fresh VM provider tokens and keeps token separate', async () => {
    const { processTokenGeneration } = await import('../vmProviderQueue.js');
    mocks.mintUniqueToken.mockResolvedValue('TOKEN-VM-LIVE');
    mocks.findVMCampaignForOwner.mockResolvedValue({
      leadOwnerId: 'lead-owner-1',
      provider: 'rvm',
    } as never);
    mocks.writeVmLeadTokenGraphCritical.mockResolvedValue({
      mongo: { ok: true },
    } as never);
    mocks.writeOperational.mockResolvedValue({
      mongo: { ok: true },
      neo4j: { ok: true },
      chroma: { ok: true },
    } as never);
    mocks.persistenceCall.mockResolvedValue({ documents: [] });
    mocks.persistenceCall.mockImplementation(async (_tool: string, action: string, params: Record<string, unknown>) => {
      if (action === 'query') {
        if (params.collection === 'tmag_vm_bulk_leads') {
          return {
            documents: [
              {
                leadId: 'lead-vm-1',
                leadOwnerId: 'owner-1',
                ownerTmagId: 'TMBA-OWNER',
                sponsorTmagId: 'TMBA-SPONSOR',
                vmCampaignId: 'campaign-1',
                token: null,
                status: 'validated',
                firstName: 'Avery',
                lastName: 'Quinn',
              },
            ],
          };
        }
      }
      if (action === 'update') return { matchedCount: 1 };
      return { ok: true };
    });

    await processTokenGeneration({ jobId: 'vmjob_vm_fresh', payload: { leadId: 'lead-vm-1' } } as never);

    const write = mocks.writeVmLeadTokenGraphCritical.mock.calls[0]?.[0] as {
      token: string;
      mongoDoc: { invitationRecordId?: string; token: string };
      tokenProps: { invitationRecordId?: string; tokenHash?: string };
      chroma?: { document?: string; metadata?: Record<string, unknown> };
    };
    const tokenHash = createHash('sha256').update(write.token).digest('hex');

    expect(write.token).toBe('TOKEN-VM-LIVE');
    expect(write.mongoDoc.invitationRecordId).toMatch(/^invite_/);
    expect(write.mongoDoc.invitationRecordId).not.toBe(write.token);
    expect(write.tokenProps.invitationRecordId).toBe(write.mongoDoc.invitationRecordId);
    expect(write.tokenProps.tokenHash).toBe(tokenHash);
    expect(write.chroma?.metadata?.invitationRecordId).toBe(write.mongoDoc.invitationRecordId);
    expect(write.chroma?.metadata?.tokenHash).toBe(tokenHash);
    expect(write.chroma?.metadata).not.toHaveProperty('token');
    expect(write.chroma?.document).toBeTypeOf('string');
    expect(write.chroma?.document).not.toContain('TOKEN-VM-LIVE');
  });

  it('writes invitationRecordId during bulk import with separate identity from the token', async () => {
    mocks.findVMCampaignForOwner.mockResolvedValue({
      leadOwnerId: 'lead-owner-1',
      provider: 'rvm',
    } as never);
    mocks.markLeadOwnerImported.mockResolvedValue({
      leadOwnerId: 'lead-owner-1',
      importedCount: 1,
    } as never);
    mocks.mintUniqueToken.mockResolvedValue('TOKEN-BULK');
    mocks.writeGraphCritical.mockResolvedValue({
      mongo: { ok: true, insertedCount: 1 },
      neo4j: { ok: true },
      chroma: { ok: true, verified: true },
    } as never);
    mocks.writeProspectTokenGraphCritical.mockResolvedValue({
      mongo: { ok: true },
    } as never);
    mocks.createOrUpdateCrmRecordForToken.mockResolvedValue({
      crmRecordId: 'crm_bulk_1',
      prospectId: 'prospect_bulk_1',
      status: 'inactive_pre_engagement',
    } as never);
    mocks.appendProspectTimelineEvent.mockResolvedValue({
      prospectTimelineEventId: 'timeline_1',
    } as never);

    const { importBulkLeads } = await import('../bulkLeads.js');
    await importBulkLeads({
      ownerTmagId: 'owner-1',
      sponsorTmagId: 'TMBA-SPONSOR',
      leadOwnerId: 'lead-owner-1',
      vmCampaignId: 'campaign-1',
      leads: [
        {
          firstName: 'Avery',
          lastName: 'Quinn',
          city: 'Los Angeles',
          stateOrRegion: 'CA',
          country: 'US',
          phone: '2125551111',
          email: 'avery@example.com',
        },
      ],
    });

    expect(mocks.findVMCampaignForOwner).toHaveBeenCalledWith('campaign-1', 'owner-1');
    expect(mocks.markLeadOwnerImported).toHaveBeenCalledWith('lead-owner-1', 'owner-1', 1);

    const write = mocks.writeProspectTokenGraphCritical.mock.calls[0]![0] as {
      token: string;
      mongoDoc: { invitationRecordId?: string };
      tokenProps: Record<string, unknown>;
    };
    const graphWrite = mocks.writeGraphCritical.mock.calls[0]![0] as {
      chroma: { collection: string; document: string; metadata: Record<string, unknown> };
    };
    const tokenHash = createHash('sha256').update(write.token).digest('hex');

    expect(write.token).toBe('TOKEN-BULK');
    expect(write.mongoDoc.invitationRecordId).toMatch(/^invite_/);
    expect(write.mongoDoc.invitationRecordId).not.toBe(write.token);
    expect(write.tokenProps.invitationRecordId).toBe(write.mongoDoc.invitationRecordId);
    expect(graphWrite.chroma.metadata.invitationRecordId).toBe(write.mongoDoc.invitationRecordId);
    expect(graphWrite.chroma.metadata.tokenHash).toBe(tokenHash);
    expect(graphWrite.chroma.document).not.toContain('TOKEN-BULK');
    expect(graphWrite.chroma.metadata).not.toHaveProperty('token');
  });
});
