import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  chromaAdapter: vi.fn(),
  mongoAdapter: vi.fn(),
  neo4jAdapter: vi.fn(),
}));

vi.mock('../persistence/mongo/adapter.js', () => ({
  mongoAdapter: mocks.mongoAdapter,
}));

vi.mock('../persistence/neo4j/adapter.js', () => ({
  neo4jAdapter: mocks.neo4jAdapter,
}));

vi.mock('../persistence/chroma/adapter.js', () => ({
  chromaAdapter: mocks.chromaAdapter,
}));

function stubPersistenceEnv(
  options: {
    directEnabled?: boolean;
    mongoMode?: 'direct';
    neo4jMode?: 'direct';
    chromaMode?: 'direct';
  } = {},
): void {
  vi.stubEnv('NODE_ENV', 'test');
  vi.stubEnv('JWT_SECRET', 'test-secret-for-persistence-dispatch');
  vi.stubEnv('PERSISTENCE_DIRECT_ENABLED', String(options.directEnabled ?? true));
  vi.stubEnv('PERSISTENCE_MONGO_MODE', options.mongoMode ?? 'direct');
  vi.stubEnv('PERSISTENCE_NEO4J_MODE', options.neo4jMode ?? 'direct');
  vi.stubEnv('PERSISTENCE_CHROMA_MODE', options.chromaMode ?? 'direct');
}

async function loadPersistenceDispatch(
  options: Parameters<typeof stubPersistenceEnv>[0] = {},
): Promise<typeof import('../persistence/dispatch.js')> {
  vi.resetModules();
  stubPersistenceEnv(options);
  return import('../persistence/dispatch.js');
}

describe('direct-only persistence dispatcher (ACR-0009)', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it('dispatches every store to its direct adapter', async () => {
    const { persistenceCall } = await loadPersistenceDispatch();
    mocks.mongoAdapter.mockResolvedValue({ via: 'mongo-direct' });
    mocks.neo4jAdapter.mockResolvedValue({ via: 'neo4j-direct' });
    mocks.chromaAdapter.mockResolvedValue({ via: 'chroma-direct' });

    await expect(persistenceCall('mongodb', 'query', { collection: 'c' })).resolves.toEqual({
      via: 'mongo-direct',
    });
    await expect(persistenceCall('neo4j', 'cypher', { query: 'RETURN 1' })).resolves.toEqual({
      via: 'neo4j-direct',
    });
    await expect(persistenceCall('chromadb', 'search', { collection: 'c' })).resolves.toEqual({
      via: 'chroma-direct',
    });

    expect(mocks.mongoAdapter).toHaveBeenCalledWith('query', { collection: 'c' });
    expect(mocks.neo4jAdapter).toHaveBeenCalledWith('cypher', { query: 'RETURN 1' });
    expect(mocks.chromaAdapter).toHaveBeenCalledWith('search', { collection: 'c' });
  });

  it('refuses non-persistence tools', async () => {
    const { persistenceCall } = await loadPersistenceDispatch();

    await expect(persistenceCall('email', 'send', { id: 'x' })).rejects.toMatchObject({
      name: 'PersistenceError',
      tool: 'email',
      action: 'send',
    });
    expect(mocks.mongoAdapter).not.toHaveBeenCalled();
    expect(mocks.neo4jAdapter).not.toHaveBeenCalled();
    expect(mocks.chromaAdapter).not.toHaveBeenCalled();
  });

  it('fails loud when the master direct flag is disabled', async () => {
    const { persistenceCall } = await loadPersistenceDispatch({ directEnabled: false });

    await expect(persistenceCall('mongodb', 'query', { collection: 'c' })).rejects.toMatchObject({
      name: 'PersistenceError',
      tool: 'mongodb',
      action: 'query',
    });
    expect(mocks.mongoAdapter).not.toHaveBeenCalled();
  });

  it('wraps direct adapter failures in the existing PersistenceError contract', async () => {
    const { persistenceCall } = await loadPersistenceDispatch();
    mocks.mongoAdapter.mockRejectedValue(new Error('adapter exploded'));

    await expect(persistenceCall('mongodb', 'query', { collection: 'c' })).rejects.toMatchObject({
      name: 'PersistenceError',
      tool: 'mongodb',
      action: 'query',
      message: '[persistence:mongodb.query] adapter exploded',
    });
  });

  it('preserves the caller-facing persistenceCall(tool, action, params) contract unchanged', async () => {
    const { persistenceCall } = await loadPersistenceDispatch();
    const params = { collection: 'caller_contract', filter: { id: 'one' } };
    mocks.mongoAdapter.mockResolvedValue({ documents: [], count: 0 });

    await persistenceCall('mongodb', 'query', params);

    expect(mocks.mongoAdapter).toHaveBeenCalledWith('query', params);
  });
});
