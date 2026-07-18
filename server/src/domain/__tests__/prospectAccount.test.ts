import { createHash } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  persistenceCall: vi.fn(),
  writeOperational: vi.fn(),
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
  writeOperational: mocks.writeOperational,
}));

import { attachPhoneOnConsent, createProspectAccount } from '../prospectAccount.js';

describe('prospect account projection redaction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.persistenceCall.mockReset();
    mocks.writeOperational.mockReset().mockResolvedValue({
      mongo: { ok: true },
      neo4j: { ok: true },
      chroma: { ok: true },
    });
  });

  it('writes Neo/Chroma projection fields with token hash only', async () => {
    const tokenId = 'RAW_ACCOUNT_TOKEN';
    const tokenHash = createHash('sha256').update(tokenId).digest('hex');
    mocks.persistenceCall.mockResolvedValueOnce({ documents: [] });

    const record = await createProspectAccount({
      prospectId: 'prospect_1',
      tokenId,
      sponsorTmagId: 'TMBA-OWNER',
      tokenExpiresAt: '2026-07-11T00:00:00.000Z',
      invitationRecordId: 'invite-account-1',
      phone: '+12125551234',
      reentryCode: 'ABC123',
    });

    const write = mocks.writeOperational.mock.calls[0]![0] as {
      neo4j: { params: Record<string, unknown> };
      chroma: { metadata: Record<string, unknown>; document: string };
    };
    expect(record.tokenId).toBe(tokenId);
    expect(write.neo4j.params).toMatchObject({
      prospectId: 'prospect_1',
      tokenHash,
      invitationRecordId: 'invite-account-1',
    });
    expect(write.neo4j.params).not.toHaveProperty('token');
    expect(write.chroma.metadata).toMatchObject({
      tokenHash,
      invitationRecordId: 'invite-account-1',
    });
    expect(write.chroma.metadata).not.toHaveProperty('token');
    expect(serializeNonMongo(JSON.parse(JSON.stringify(write)))).not.toContain(tokenId);
  });

  it('logs a token-hash warning token-normalization failures', async () => {
    const tokenId = 'RAW_ACCOUNT_TOKEN_2';
    mocks.persistenceCall.mockResolvedValueOnce({ documents: [] });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    await attachPhoneOnConsent(tokenId, 'invalid-raw');
    const logged = warn.mock.calls.map((row) => row.join(' ')).join(' ');
    const tokenHash = createHash('sha256').update(tokenId).digest('hex');

    expect(logged).toContain(tokenHash);
    expect(logged).not.toContain(tokenId);
    expect(logged).toContain('phone failed normalization for token');
  });
});
