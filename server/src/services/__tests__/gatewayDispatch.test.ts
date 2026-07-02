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
    mongoMode?: 'gateway' | 'direct';
    neo4jMode?: 'gateway' | 'direct';
    chromaMode?: 'gateway' | 'direct';
  } = {},
): void {
  vi.stubEnv('NODE_ENV', 'test');
  vi.stubEnv('JWT_SECRET', 'test-secret-for-persistence-dispatch');
  vi.stubEnv('PERSISTENCE_DIRECT_ENABLED', String(options.directEnabled ?? true));
  vi.stubEnv('PERSISTENCE_MONGO_MODE', options.mongoMode ?? 'direct');
  vi.stubEnv('PERSISTENCE_NEO4J_MODE', options.neo4jMode ?? 'direct');
  vi.stubEnv('PERSISTENCE_CHROMA_MODE', options.chromaMode ?? 'direct');
}

async function loadGateway(
  options: Parameters<typeof stubPersistenceEnv>[0] = {},
): Promise<typeof import('../gateway.js')> {
  vi.resetModules();
  stubPersistenceEnv(options);
  return import('../gateway.js');
}

describe('direct-only persistence dispatcher (ACR-0009 — Gateway HTTP path retired)', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it('dispatches every store to its direct adapter', async () => {
    const { gatewayCall } = await loadGateway();
    mocks.mongoAdapter.mockResolvedValue({ via: 'mongo-direct' });
    mocks.neo4jAdapter.mockResolvedValue({ via: 'neo4j-direct' });
    mocks.chromaAdapter.mockResolvedValue({ via: 'chroma-direct' });

    await expect(gatewayCall('mongodb', 'query', { collection: 'c' })).resolves.toEqual({
      via: 'mongo-direct',
    });
    await expect(gatewayCall('neo4j', 'cypher', { query: 'RETURN 1' })).resolves.toEqual({
      via: 'neo4j-direct',
    });
    await expect(gatewayCall('chromadb', 'search', { collection: 'c' })).resolves.toEqual({
      via: 'chroma-direct',
    });

    expect(mocks.mongoAdapter).toHaveBeenCalledWith('query', { collection: 'c' });
    expect(mocks.neo4jAdapter).toHaveBeenCalledWith('cypher', { query: 'RETURN 1' });
    expect(mocks.chromaAdapter).toHaveBeenCalledWith('search', { collection: 'c' });
  });

  it('refuses non-persistence tools — the Universal Gateway is developer tooling only', async () => {
    const { gatewayCall } = await loadGateway();

    await expect(gatewayCall('email', 'send', { id: 'x' })).rejects.toMatchObject({
      name: 'GatewayError',
      tool: 'email',
      action: 'send',
    });
    expect(mocks.mongoAdapter).not.toHaveBeenCalled();
    expect(mocks.neo4jAdapter).not.toHaveBeenCalled();
    expect(mocks.chromaAdapter).not.toHaveBeenCalled();
  });

  it('fails loud when a store is not in direct mode — no silent fallback of any kind', async () => {
    const { gatewayCall } = await loadGateway({ neo4jMode: 'gateway' });

    await expect(gatewayCall('neo4j', 'cypher', { query: 'RETURN 1' })).rejects.toMatchObject({
      name: 'GatewayError',
      tool: 'neo4j',
      action: 'cypher',
    });
    expect(mocks.neo4jAdapter).not.toHaveBeenCalled();
  });

  it('fails loud when the master direct flag is disabled', async () => {
    const { gatewayCall } = await loadGateway({ directEnabled: false });

    await expect(gatewayCall('mongodb', 'query', { collection: 'c' })).rejects.toMatchObject({
      name: 'GatewayError',
      tool: 'mongodb',
      action: 'query',
    });
    expect(mocks.mongoAdapter).not.toHaveBeenCalled();
  });

  it('wraps direct adapter failures in the existing GatewayError contract', async () => {
    const { gatewayCall } = await loadGateway();
    mocks.mongoAdapter.mockRejectedValue(new Error('adapter exploded'));

    await expect(gatewayCall('mongodb', 'query', { collection: 'c' })).rejects.toMatchObject({
      name: 'GatewayError',
      tool: 'mongodb',
      action: 'query',
      message: '[gateway:mongodb.query] adapter exploded',
    });
  });

  it('preserves the caller-facing gatewayCall(tool, action, params) contract unchanged', async () => {
    const { gatewayCall } = await loadGateway();
    const params = { collection: 'caller_contract', filter: { id: 'one' } };
    mocks.mongoAdapter.mockResolvedValue({ documents: [], count: 0 });

    await gatewayCall('mongodb', 'query', params);

    expect(mocks.mongoAdapter).toHaveBeenCalledWith('query', params);
  });
});
