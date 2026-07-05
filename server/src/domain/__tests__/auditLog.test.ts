import mongoose from 'mongoose';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPermissiveCollectionSchema } from '../../services/persistence/mongo/models/registry.js';

const mocks = vi.hoisted(() => ({
  persistenceCall: vi.fn(),
  tripleStackWrite: vi.fn(),
}));

vi.mock('../../services/persistence/dispatch.js', () => ({
  persistenceCall: mocks.persistenceCall,
}));

vi.mock('../../services/tripleStack.js', () => ({
  tripleStackWrite: mocks.tripleStackWrite,
}));

type AnyRec = Record<string, unknown>;

const AuditRegressionModel =
  mongoose.models.AuditLogIdRegression ??
  mongoose.model('AuditLogIdRegression', createPermissiveCollectionSchema());

beforeEach(() => {
  mocks.persistenceCall.mockReset();
  mocks.tripleStackWrite.mockReset();
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

    expect(mocks.tripleStackWrite).toHaveBeenCalledTimes(1);
    const call = mocks.tripleStackWrite.mock.calls[0]![0] as AnyRec;
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
