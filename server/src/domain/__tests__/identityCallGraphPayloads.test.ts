import { createHash } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  findVMCampaignForOwner: vi.fn(),
  markLeadOwnerImported: vi.fn(),
  mintUniqueToken: vi.fn(),
  persistenceCall: vi.fn(),
  writeGraphCritical: vi.fn(),
  writeKnowledge: vi.fn(),
  writeOperational: vi.fn(),
  writeProspectTokenGraphCritical: vi.fn(),
}));

function serializeDownstream(payload: Record<string, unknown>): string {
  if (!payload) return '';
  const { mongoDoc, ...nonMongo } = payload;
  return JSON.stringify(nonMongo);
}

vi.mock('../../services/persistence/dispatch.js', () => ({
  persistenceCall: mocks.persistenceCall,
}));
vi.mock('../../services/tieredWrite.js', () => ({
  writeGraphCritical: mocks.writeGraphCritical,
  writeKnowledge: mocks.writeKnowledge,
  writeOperational: mocks.writeOperational,
}));
vi.mock('../tokenLifecyclePersistence.js', () => ({
  writeProspectTokenGraphCritical: mocks.writeProspectTokenGraphCritical,
}));
vi.mock('../tokens.js', async () => {
  const actual = await vi.importActual<typeof import('../tokens.js')>('../tokens.js');
  return { ...actual, mintUniqueToken: mocks.mintUniqueToken };
});
vi.mock('../vmCampaigns.js', () => ({
  findVMCampaignForOwner: mocks.findVMCampaignForOwner,
}));
vi.mock('../vmLeadOwners.js', () => ({
  markLeadOwnerImported: mocks.markLeadOwnerImported,
}));

describe('downstream payload redaction across call graph', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.writeGraphCritical.mockReset();
    mocks.writeGraphCritical.mockResolvedValue({ mongo: { ok: true }, neo4j: { ok: true }, chroma: { ok: true } });
    mocks.writeKnowledge.mockReset().mockResolvedValue({ ok: true });
    mocks.writeOperational.mockReset().mockResolvedValue({ mongo: { ok: true }, neo4j: { ok: true }, chroma: { ok: true } });
    mocks.writeProspectTokenGraphCritical.mockReset().mockResolvedValue({ mongo: { ok: true } });
    mocks.persistenceCall.mockReset();
    mocks.mintUniqueToken.mockReset().mockResolvedValue('RAW_TOKEN');
    mocks.findVMCampaignForOwner.mockReset();
    mocks.markLeadOwnerImported.mockReset();
  });

  it('keeps direct invitation graph/account/audit payloads token-redacted', async () => {
    const token = 'RAW-DIRECT-TOKEN';
    mocks.mintUniqueToken.mockResolvedValueOnce(token);
    mocks.persistenceCall.mockResolvedValue({ documents: [] });

    const { createInvitation } = await import('../invitations.js');
    await createInvitation({
      sponsorTmagId: 'TMBA-OWNER',
      firstName: 'Alex',
      lastName: 'Riley',
      email: 'alex@example.com',
      phone: '+12125550101',
      city: 'Riverton',
      stateOrRegion: 'UT',
      country: 'US',
      message: null,
      source: 'self',
      relationshipReason: 'friendship',
    });

    const tokenHash = createHash('sha256').update(token).digest('hex');
    const prospectWrite = mocks.writeGraphCritical.mock.calls[0]?.[0] as {
      neo4j: { params: Record<string, unknown> };
      chroma: { metadata: Record<string, unknown> };
    };
    const accountWrite = mocks.writeOperational.mock.calls[0]?.[0] as {
      neo4j: { params: Record<string, unknown> };
      chroma: { metadata: Record<string, unknown> };
    };
    const crmGraphWrite = mocks.writeGraphCritical.mock.calls.find(
      (call) => call[0].neo4j?.cypher.includes('OWNS_CRM_RECORD'),
    )?.[0] as {
      neo4j: { params: Record<string, unknown> };
      chroma: { metadata: Record<string, unknown> };
    };
    const timelineWrite = mocks.writeKnowledge.mock.calls[0]?.[0] as { neo4j: { params: Record<string, unknown> }; chroma: { metadata: Record<string, unknown> } };

    [prospectWrite, accountWrite, crmGraphWrite, timelineWrite].forEach((payload) => {
      expect(serializeDownstream(payload)).not.toContain(token);
    });
    expect(prospectWrite.neo4j.params).toMatchObject({ tokenHash });
    expect(crmGraphWrite).toBeDefined();
    expect((crmGraphWrite.neo4j.params as { prospectId?: string; crmProps?: Record<string, unknown> }).prospectId).toMatch(
      /^prospect_/,
    );
    expect((crmGraphWrite.neo4j.params as { crmProps?: Record<string, unknown> }).crmProps).toMatchObject({
      tokenHash,
      invitationRecordId: expect.any(String),
    });
    expect(accountWrite.neo4j.params).toMatchObject({ tokenHash });
    expect(timelineWrite.chroma.metadata).toMatchObject({ tokenHash });
  });

  it('keeps bulk-import lead/CRM/account timeline payloads token-redacted', async () => {
    const token = 'RAW-BULK-TOKEN';
    mocks.mintUniqueToken.mockResolvedValueOnce(token);
    mocks.findVMCampaignForOwner.mockResolvedValueOnce({
      vmCampaignId: 'campaign-1',
      ownerTmagId: 'owner-1',
      leadOwnerId: 'lead-owner-1',
      provider: 'rvm',
    } as never);
    mocks.markLeadOwnerImported.mockResolvedValueOnce({
      leadOwnerId: 'lead-owner-1',
      importedCount: 1,
    } as never);
    mocks.persistenceCall.mockResolvedValue({ documents: [] });

    const { importBulkLeads } = await import('../bulkLeads.js');
    await importBulkLeads({
      ownerTmagId: 'owner-1',
      sponsorTmagId: 'TMBA-OWNER',
      leadOwnerId: 'lead-owner-1',
      vmCampaignId: 'campaign-1',
      leads: [{
        firstName: 'Rory',
        lastName: 'M.',
        city: 'Riverton',
        stateOrRegion: 'UT',
        country: 'US',
        phone: '+12125551212',
        email: 'rory@example.com',
      }],
    });

    const tokenHash = createHash('sha256').update(token).digest('hex');
    for (const call of mocks.writeGraphCritical.mock.calls) {
      expect(serializeDownstream(call[0] as never)).not.toContain(token);
    }
    const crmGraphWrite = mocks.writeGraphCritical.mock.calls.find(
      (call) => call[0].neo4j?.cypher.includes('OWNS_CRM_RECORD'),
    )?.[0] as {
      neo4j: { params: Record<string, unknown> };
      chroma: { metadata: Record<string, unknown> };
    };
    const timelineWrite = mocks.writeKnowledge.mock.calls.find(
      (call) => Object.prototype.hasOwnProperty.call(
        (call[0] as { chroma?: { metadata?: Record<string, unknown> } }).chroma?.metadata ?? {},
        'tokenHash',
      ),
    )?.[0] as { chroma: { metadata: Record<string, unknown> } };
    const accountWrite = mocks.writeOperational.mock.calls[0]?.[0] as { neo4j?: { params: Record<string, unknown> } };

    expect(crmGraphWrite).toBeDefined();
    expect(crmGraphWrite.neo4j.params).toMatchObject({ crmProps: expect.objectContaining({ tokenHash }) });
    expect(crmGraphWrite.chroma?.metadata).toMatchObject({ tokenHash });
    expect(timelineWrite.chroma.metadata).toMatchObject({ tokenHash });
    if (accountWrite?.neo4j) {
      expect(accountWrite.neo4j.params).not.toMatchObject({ token });
    }
  });
});
