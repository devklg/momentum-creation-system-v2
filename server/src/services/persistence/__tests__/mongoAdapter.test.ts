import { describe, expect, it, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => {
  const fakeModel = {
    aggregate: vi.fn(),
    countDocuments: vi.fn(),
    deleteMany: vi.fn(),
    find: vi.fn(),
    insertMany: vi.fn(),
    updateMany: vi.fn(),
    collection: { indexes: vi.fn() },
  };
  return {
    fakeModel,
    getMongoModel: vi.fn(() => fakeModel),
  };
});

vi.mock('../mongo/models/registry.js', () => ({
  getMongoModel: mocks.getMongoModel,
}));

// Per-describe timeout bump (default 5000ms). The dynamic `await import('../mongo/adapter.js')`
// in each test pays a contended module-transform cost on the FIRST full-suite run under
// parallel load, which can exceed the 5s default. Known parallel-load timing flake, not a
// logic bug (passes in isolation and on re-run). Kept local to this file; no global config change.
describe('Mongo direct adapter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns PERSISTENCE-compatible insert response shapes', async () => {
    const { mongoAdapter } = await import('../mongo/adapter.js');
    mocks.fakeModel.insertMany.mockResolvedValue([
      { toObject: () => ({ _id: 'one' }) },
      { toObject: () => ({ _id: 'two' }) },
    ]);

    await expect(
      mongoAdapter('insert', {
        collection: 'adapter_contracts',
        documents: [{ _id: 'one' }, { _id: 'two' }],
      }),
    ).resolves.toEqual({
      insertedCount: 2,
      insertedIds: { 0: 'one', 1: 'two' },
    });
  });

  it('returns PERSISTENCE-compatible query/update/delete/aggregate shapes', async () => {
    const { mongoAdapter } = await import('../mongo/adapter.js');
    const queryChain = {
      exec: vi.fn().mockResolvedValue([{ _id: 'one' }]),
      limit: vi.fn(),
      select: vi.fn(),
      sort: vi.fn(),
    };
    queryChain.sort.mockReturnValue(queryChain);
    queryChain.limit.mockReturnValue(queryChain);
    queryChain.select.mockReturnValue(queryChain);
    mocks.fakeModel.find.mockReturnValue({ lean: () => queryChain });
    mocks.fakeModel.countDocuments.mockReturnValue({ exec: vi.fn().mockResolvedValue(1) });
    mocks.fakeModel.updateMany.mockResolvedValue({ matchedCount: 1, modifiedCount: 1 });
    mocks.fakeModel.deleteMany.mockResolvedValue({ deletedCount: 1 });
    mocks.fakeModel.aggregate.mockReturnValue({ exec: vi.fn().mockResolvedValue([{ ok: true }]) });

    await expect(
      mongoAdapter('query', {
        collection: 'adapter_contracts',
        filter: { active: true },
        projection: { _id: 1, active: 1 },
        sort: { createdAt: -1 },
        limit: 1,
      }),
    ).resolves.toEqual({ documents: [{ _id: 'one' }], count: 1 });
    expect(queryChain.select).toHaveBeenCalledWith({ _id: 1, active: 1 });

    await expect(
      mongoAdapter('update', {
        collection: 'adapter_contracts',
        filter: { _id: 'one' },
        update: { $set: { active: false } },
      }),
    ).resolves.toEqual({ matchedCount: 1, modifiedCount: 1, upsertedCount: 0 });

    await expect(
      mongoAdapter('delete', {
        collection: 'adapter_contracts',
        filter: { _id: 'one' },
      }),
    ).resolves.toEqual({ deletedCount: 1 });

    await expect(
      mongoAdapter('aggregate', {
        collection: 'adapter_contracts',
        pipeline: [{ $match: { active: true } }],
      }),
    ).resolves.toEqual({ results: [{ ok: true }], count: 1 });
  });

  it('lists index metadata while leaving mutation unsupported', async () => {
    const { mongoAdapter } = await import('../mongo/adapter.js');
    mocks.fakeModel.collection.indexes.mockResolvedValue([
      { name: '_id_', key: { _id: 1 }, unique: true },
      { name: 'admin_createdAt_tmagId', key: { createdAt: -1, tmagId: -1 } },
    ]);

    await expect(mongoAdapter('list_indexes', { collection: 'members' })).resolves.toEqual({
      collectionExists: true,
      indexes: [
        { name: '_id_', keys: { _id: 1 }, unique: true },
        { name: 'admin_createdAt_tmagId', keys: { createdAt: -1, tmagId: -1 }, unique: false },
      ],
    });
    await expect(mongoAdapter('create_index', { collection: 'members' })).rejects.toThrow(
      'unsupported mongodb action',
    );
  });
}, 15000);
