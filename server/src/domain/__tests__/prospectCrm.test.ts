import { createHash } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  appendAuditEntry: vi.fn(),
  persistenceCall: vi.fn(),
  writeKnowledge: vi.fn(),
  writeGraphCritical: vi.fn(),
}));

function serializeNonMongo(payload: Record<string, unknown>): string {
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
}));
vi.mock('../auditLog.js', () => ({
  appendAuditEntry: mocks.appendAuditEntry,
}));

import { applyCrmLifecycleEvent, createOrUpdateCrmRecordForToken } from '../prospectCrm.js';

const crmRecordInput = {
  crmRecordId: 'crm_p1',
  prospectId: 'prospect_1',
  token: 'RAW_TOKEN_123',
  ownerTmagId: 'TMBA-OWNER',
  sponsorTmagId: 'TMBA-SPONSOR',
  source: 'invite_token',
  status: 'inactive_pre_engagement' as const,
  disposition: null,
  followUpDueAt: null,
  closedAt: null,
  closedReason: null,
  updatedAt: '2026-07-10T00:00:00.000Z',
};

describe('CRM payload redaction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.persistenceCall.mockReset();
    mocks.writeKnowledge.mockReset().mockResolvedValue({ ok: true });
    mocks.appendAuditEntry.mockReset().mockResolvedValue({ entryId: 'audit_1' });
    mocks.writeGraphCritical.mockReset().mockResolvedValue({
      mongo: { ok: true },
      neo4j: { ok: true },
      chroma: { ok: true },
    });
  });

  it('creates CRM projection payloads with token hash only', async () => {
    mocks.persistenceCall.mockResolvedValue({ documents: [] });

    const token = 'RAW_TOKEN_123';
    const tokenHash = createHash('sha256').update(token).digest('hex');
    await createOrUpdateCrmRecordForToken({
      prospectId: crmRecordInput.prospectId,
      token,
      ownerTmagId: crmRecordInput.ownerTmagId,
      sponsorTmagId: crmRecordInput.sponsorTmagId,
      source: 'manual',
      leadId: null,
      leadOwnerId: null,
      vmCampaignId: null,
      invitationRecordId: 'invite-direct-1',
      createdAt: '2026-07-11T00:00:00.000Z',
      correlation: {
        correlationId: 'corr-1',
        rootKind: 'invitation',
        rootId: 'inv-1',
        invitationId: 'inv-1',
        tokenId: null,
        prospectId: crmRecordInput.prospectId,
        crmRecordId: null,
        vmCampaignId: null,
        leadId: null,
      },
    });

    const crmWrite = mocks.writeGraphCritical.mock.calls.find(
      (call) => call[0].neo4j?.cypher.includes('OWNS_CRM_RECORD'),
    )?.[0] as {
      neo4j: { params: Record<string, unknown> };
      chroma?: { metadata: Record<string, unknown> };
    };
    expect(crmWrite).toBeDefined();
    expect(crmWrite.neo4j.params).toMatchObject({
      prospectId: crmRecordInput.prospectId,
      crmProps: expect.objectContaining({
        tokenHash,
        invitationRecordId: 'invite-direct-1',
      }),
    });
    expect((crmWrite.neo4j.params as Record<string, unknown>).token).toBeUndefined();
    expect(crmWrite.chroma?.metadata).toMatchObject({ tokenHash, invitationRecordId: 'invite-direct-1' });
    expect(crmWrite.chroma?.metadata).not.toHaveProperty('token');
    expect(serializeNonMongo(JSON.parse(JSON.stringify(crmWrite)))).not.toContain(token);

    const timelineWrite = mocks.writeKnowledge.mock.calls[0]?.[0] as {
      neo4j: { params: Record<string, unknown> };
      chroma: { metadata: Record<string, unknown> };
    };
    expect(timelineWrite.chroma.metadata).toMatchObject({ tokenHash, invitationRecordId: 'invite-direct-1' });
    expect(timelineWrite.chroma.metadata).not.toHaveProperty('token');
    expect(serializeNonMongo(JSON.parse(JSON.stringify(timelineWrite)))).not.toContain(token);
    expect(JSON.stringify(timelineWrite.neo4j)).not.toContain(token);
  });

  it('keeps lifecycle audit and timeline payloads token-redacted during status transitions', async () => {
    const token = 'RAW_TOKEN_456';
    const tokenHash = createHash('sha256').update(token).digest('hex');
    mocks.persistenceCall
      .mockResolvedValueOnce({ documents: [{ ...crmRecordInput, token }] })
      .mockResolvedValueOnce({ ok: true })
      .mockResolvedValueOnce({ ok: true });

    await applyCrmLifecycleEvent(
      crmRecordInput.prospectId,
      'link_clicked',
      'link clicked',
      { token, leadId: 'lead_1' },
    );

    expect(mocks.appendAuditEntry).toHaveBeenCalledOnce();
    const audit = mocks.appendAuditEntry.mock.calls[0]![0] as { after: { tokenHash: unknown; token?: unknown } };
    expect(audit.after).toMatchObject({ tokenHash, status: 'active', timelineEventKind: 'link_clicked' });
    expect(audit.after).not.toHaveProperty('token');
    expect(serializeNonMongo(JSON.parse(JSON.stringify(audit)))).not.toContain(token);

    const timelineWrite = mocks.writeKnowledge.mock.calls[0]?.[0] as {
      neo4j: { params: Record<string, unknown> };
      chroma: { metadata: Record<string, unknown> };
    };
    expect(timelineWrite.chroma.metadata).toMatchObject({ tokenHash, leadId: 'lead_1' });
    expect(timelineWrite.chroma.metadata).not.toHaveProperty('token');
    expect(serializeNonMongo(JSON.parse(JSON.stringify(timelineWrite)))).not.toContain(token);
    expect(JSON.stringify(timelineWrite.neo4j)).not.toContain(token);
  });
});
