import mongoose from 'mongoose';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPermissiveCollectionSchema } from '../../services/persistence/mongo/models/registry.js';

const mocks = vi.hoisted(() => ({
  persistenceCall: vi.fn(),
  writeOperational: vi.fn(),
}));

vi.mock('../../services/persistence/dispatch.js', () => ({
  persistenceCall: mocks.persistenceCall,
}));

vi.mock('../../services/tieredWrite.js', () => ({
  writeOperational: mocks.writeOperational,
}));

type AnyRec = Record<string, unknown>;

const AuditRegressionModel =
  mongoose.models.AuditLogIdRegression ??
  mongoose.model('AuditLogIdRegression', createPermissiveCollectionSchema());

beforeEach(() => {
  mocks.persistenceCall.mockReset();
  mocks.writeOperational.mockReset();
});

describe('appendAuditEntry Mongo _id regression', () => {
  it('builds a valid admin read audit document for the Mongo insert path', async () => {
    const { appendAuditEntry } = await import('../auditLog.js');

    const entry = await appendAuditEntry({
      actor: { kind: 'admin', tmagId: 'TMBA-ADMIN', displayName: 'Kevin L. Gardner' },
      action: 'admin.agents.overview.viewed',
      entity: { kind: 'admin_session', id: 'TMBA-ADMIN', displayLabel: null },
      severity: 'info',
      after: {
        generatedAt: '2026-07-04T12:00:00.000Z',
        successProfiles: 0,
        bridgeDrafts: 0,
        warnings: 0,
      },
      reason: null,
      context: {
        ip: '127.0.0.1',
        userAgent: 'vitest',
        route: '/api/admin/agents/overview',
        method: 'GET',
        requestId: null,
      },
    });

    expect(mocks.writeOperational).toHaveBeenCalledTimes(1);
    const call = mocks.writeOperational.mock.calls[0]![0] as AnyRec;
    const mongoDoc = call.mongoDoc as AnyRec;

    expect(call.mongoCollection).toBe('mcs_audit_log');
    expect(call.id).toBe(entry.entryId);
    expect(mongoDoc.entryId).toBe(entry.entryId);
    expect(mongoDoc._id).toBe(entry.entryId);

    const insertDoc = { _id: call.id, ...mongoDoc };
    expect(insertDoc._id).toBe(entry.entryId);
    await expect(new AuditRegressionModel(insertDoc).validate()).resolves.toBeUndefined();
  });

  it('proves the previous undefined _id shape is invalid under the insert model', async () => {
    await expect(
      new AuditRegressionModel({
        _id: undefined,
        entryId: 'audit_missing_id',
      }).validate(),
    ).rejects.toThrow(/Path `_id` is required/);
  });
});

function auditEntry(entryId: string, timestamp: string): AnyRec {
  return {
    entryId,
    timestamp,
    createdAt: timestamp,
    role: 'admin',
    actor: { kind: 'admin', tmagId: 'TMBA-ADMIN', displayName: 'Kevin' },
    action: 'admin.test.viewed',
    entity: { kind: 'admin_session', id: 'TMBA-ADMIN', displayLabel: null },
    severity: 'info',
    before: null,
    after: null,
    reason: null,
    context: null,
  };
}

describe('queryAuditEntries cursor pagination', () => {
  it('uses a stable equal-timestamp tie-breaker and returns an opaque cursor', async () => {
    mocks.persistenceCall.mockResolvedValueOnce({
      documents: [
        auditEntry('audit_c', '2026-07-13T00:00:00.000Z'),
        auditEntry('audit_b', '2026-07-13T00:00:00.000Z'),
        auditEntry('audit_a', '2026-07-13T00:00:00.000Z'),
      ],
    });
    const { queryAuditEntries } = await import('../auditLog.js');
    const page = await queryAuditEntries({ severity: 'info', limit: 2 });

    expect(page.entries.map((entry) => entry.entryId)).toEqual(['audit_c', 'audit_b']);
    expect(page.nextCursor).toEqual(expect.any(String));
    expect(page.nextCursor).not.toContain('audit_b');
    expect(mocks.persistenceCall).toHaveBeenCalledWith('mongodb', 'query', expect.objectContaining({
      collection: 'mcs_audit_log',
      sort: { timestamp: -1, entryId: -1 },
      limit: 3,
    }));
  });

  it('fails closed for an unknown signed cursor instead of replaying page one', async () => {
    const { encodeAdminCursor, AdminCursorError } = await import('../adminPagination.js');
    const token = encodeAdminCursor({
      scope: 'admin_audit.v1',
      contract: {
        filters: { severity: 'info', limit: 2 },
        limit: 2,
        sort: 'timestamp_desc_entryId_desc',
      },
      keys: { timestamp: '2026-07-13T00:00:00.000Z', entryId: 'audit_missing' },
    });
    mocks.persistenceCall.mockResolvedValueOnce({ documents: [] });
    const { queryAuditEntries } = await import('../auditLog.js');

    await expect(queryAuditEntries({ severity: 'info', limit: 2, before: token }))
      .rejects.toBeInstanceOf(AdminCursorError);
    expect(mocks.persistenceCall).toHaveBeenCalledTimes(1);
  });

  it('fails closed when the cursor filter contract changes', async () => {
    const { encodeAdminCursor, AdminCursorError } = await import('../adminPagination.js');
    const token = encodeAdminCursor({
      scope: 'admin_audit.v1',
      contract: {
        filters: { severity: 'info', limit: 2 },
        limit: 2,
        sort: 'timestamp_desc_entryId_desc',
      },
      keys: { timestamp: '2026-07-13T00:00:00.000Z', entryId: 'audit_b' },
    });
    const { queryAuditEntries } = await import('../auditLog.js');

    await expect(queryAuditEntries({ severity: 'critical', limit: 2, before: token }))
      .rejects.toBeInstanceOf(AdminCursorError);
    expect(mocks.persistenceCall).not.toHaveBeenCalled();
  });
});
