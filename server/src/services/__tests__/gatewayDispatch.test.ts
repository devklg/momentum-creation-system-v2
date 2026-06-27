import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  chromaAdapter: vi.fn(),
  fetch: vi.fn(),
  mongoAdapter: vi.fn(),
  neo4jAdapter: vi.fn(),
}));

vi.mock('undici', () => ({
  fetch: mocks.fetch,
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

function gatewayResponse(data: unknown): Response {
  return new Response(
    JSON.stringify({
      success: true,
      tool: 'mock',
      action: 'mock',
      data,
    }),
    {
      status: 200,
      statusText: 'OK',
      headers: { 'Content-Type': 'application/json' },
    },
  );
}

function stubGatewayEnv(options: {
  directEnabled: boolean;
  mongoMode?: 'gateway' | 'direct';
  neo4jMode?: 'gateway' | 'direct';
  chromaMode?: 'gateway' | 'direct';
}): void {
  vi.stubEnv('NODE_ENV', 'test');
  vi.stubEnv('JWT_SECRET', 'test-secret-for-gateway-dispatch');
  vi.stubEnv('GATEWAY_URL', 'http://gateway.test/api');
  vi.stubEnv('PERSISTENCE_DIRECT_ENABLED', String(options.directEnabled));
  vi.stubEnv('PERSISTENCE_MONGO_MODE', options.mongoMode ?? 'gateway');
  vi.stubEnv('PERSISTENCE_NEO4J_MODE', options.neo4jMode ?? 'gateway');
  vi.stubEnv('PERSISTENCE_CHROMA_MODE', options.chromaMode ?? 'gateway');
}

async function loadGateway(options: Parameters<typeof stubGatewayEnv>[0]): Promise<
  typeof import('../gateway.js')
> {
  vi.resetModules();
  stubGatewayEnv(options);
  return import('../gateway.js');
}

describe('gateway direct persistence dispatcher', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it('uses the Gateway HTTP path for all stores when PERSISTENCE_DIRECT_ENABLED=false', async () => {
    const { gatewayCall } = await loadGateway({
      directEnabled: false,
      mongoMode: 'direct',
      neo4jMode: 'direct',
      chromaMode: 'direct',
    });
    mocks.fetch.mockImplementation(() => Promise.resolve(gatewayResponse({ via: 'gateway' })));

    await expect(gatewayCall('mongodb', 'query', { collection: 'c' })).resolves.toEqual({
      via: 'gateway',
    });
    await expect(gatewayCall('neo4j', 'cypher', { query: 'RETURN 1' })).resolves.toEqual({
      via: 'gateway',
    });
    await expect(gatewayCall('chromadb', 'search', { collection: 'c' })).resolves.toEqual({
      via: 'gateway',
    });

    expect(mocks.fetch).toHaveBeenCalledTimes(3);
    expect(mocks.mongoAdapter).not.toHaveBeenCalled();
    expect(mocks.neo4jAdapter).not.toHaveBeenCalled();
    expect(mocks.chromaAdapter).not.toHaveBeenCalled();
  });

  it('dispatches only the matching direct store when master and one store flag are direct', async () => {
    const { gatewayCall } = await loadGateway({
      directEnabled: true,
      mongoMode: 'direct',
      neo4jMode: 'gateway',
      chromaMode: 'gateway',
    });
    mocks.mongoAdapter.mockResolvedValue({ via: 'mongo-direct' });
    mocks.fetch.mockImplementation(() => Promise.resolve(gatewayResponse({ via: 'gateway' })));

    await expect(gatewayCall('mongodb', 'query', { collection: 'c' })).resolves.toEqual({
      via: 'mongo-direct',
    });
    await expect(gatewayCall('neo4j', 'cypher', { query: 'RETURN 1' })).resolves.toEqual({
      via: 'gateway',
    });
    await expect(gatewayCall('chromadb', 'search', { collection: 'c' })).resolves.toEqual({
      via: 'gateway',
    });

    expect(mocks.mongoAdapter).toHaveBeenCalledWith('query', { collection: 'c' });
    expect(mocks.neo4jAdapter).not.toHaveBeenCalled();
    expect(mocks.chromaAdapter).not.toHaveBeenCalled();
    expect(mocks.fetch).toHaveBeenCalledTimes(2);
  });

  it('supports mixed-mode progression across Mongo, Neo4j, and Chroma', async () => {
    let gateway = await loadGateway({
      directEnabled: true,
      mongoMode: 'direct',
      neo4jMode: 'gateway',
      chromaMode: 'gateway',
    });
    mocks.mongoAdapter.mockResolvedValue({ via: 'mongo-direct' });
    mocks.neo4jAdapter.mockResolvedValue({ via: 'neo4j-direct' });
    mocks.fetch.mockImplementation(() => Promise.resolve(gatewayResponse({ via: 'gateway' })));

    await expect(gateway.gatewayCall('mongodb', 'query', { collection: 'c' })).resolves.toEqual({
      via: 'mongo-direct',
    });
    await expect(gateway.gatewayCall('neo4j', 'cypher', { query: 'RETURN 1' })).resolves.toEqual({
      via: 'gateway',
    });
    await expect(gateway.gatewayCall('chromadb', 'search', { collection: 'c' })).resolves.toEqual({
      via: 'gateway',
    });

    vi.clearAllMocks();
    gateway = await loadGateway({
      directEnabled: true,
      mongoMode: 'direct',
      neo4jMode: 'direct',
      chromaMode: 'gateway',
    });
    mocks.mongoAdapter.mockResolvedValue({ via: 'mongo-direct' });
    mocks.neo4jAdapter.mockResolvedValue({ via: 'neo4j-direct' });
    mocks.fetch.mockImplementation(() => Promise.resolve(gatewayResponse({ via: 'gateway' })));

    await expect(gateway.gatewayCall('mongodb', 'query', { collection: 'c' })).resolves.toEqual({
      via: 'mongo-direct',
    });
    await expect(gateway.gatewayCall('neo4j', 'cypher', { query: 'RETURN 1' })).resolves.toEqual({
      via: 'neo4j-direct',
    });
    await expect(gateway.gatewayCall('chromadb', 'search', { collection: 'c' })).resolves.toEqual({
      via: 'gateway',
    });

    expect(mocks.mongoAdapter).toHaveBeenCalledTimes(1);
    expect(mocks.neo4jAdapter).toHaveBeenCalledTimes(1);
    expect(mocks.chromaAdapter).not.toHaveBeenCalled();
    expect(mocks.fetch).toHaveBeenCalledTimes(1);
  });

  it('keeps unsupported tools on the Gateway path and surfaces Gateway failures safely', async () => {
    const { gatewayCall } = await loadGateway({
      directEnabled: true,
      mongoMode: 'direct',
      neo4jMode: 'direct',
      chromaMode: 'direct',
    });
    mocks.fetch.mockResolvedValue(
      new Response(JSON.stringify({ success: false, error: 'unsupported tool' }), {
        status: 200,
        statusText: 'OK',
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    await expect(gatewayCall('email', 'send', { id: 'x' })).rejects.toMatchObject({
      name: 'GatewayError',
      tool: 'email',
      action: 'send',
      message: '[gateway:email.send] unsupported tool',
    });
    expect(mocks.fetch).toHaveBeenCalledTimes(1);
    expect(mocks.mongoAdapter).not.toHaveBeenCalled();
    expect(mocks.neo4jAdapter).not.toHaveBeenCalled();
    expect(mocks.chromaAdapter).not.toHaveBeenCalled();
  });

  it('wraps direct adapter failures in the existing GatewayError contract', async () => {
    const { gatewayCall } = await loadGateway({
      directEnabled: true,
      mongoMode: 'direct',
    });
    mocks.mongoAdapter.mockRejectedValue(new Error('adapter exploded'));

    await expect(gatewayCall('mongodb', 'query', { collection: 'c' })).rejects.toMatchObject({
      name: 'GatewayError',
      tool: 'mongodb',
      action: 'query',
      message: '[gateway:mongodb.query] adapter exploded',
    });
  });

  it('preserves the caller-facing gatewayCall(tool, action, params) contract unchanged', async () => {
    const { gatewayCall } = await loadGateway({
      directEnabled: true,
      mongoMode: 'direct',
    });
    const params = { collection: 'caller_contract', filter: { id: 'one' } };
    mocks.mongoAdapter.mockResolvedValue({ documents: [], count: 0 });

    await gatewayCall('mongodb', 'query', params);

    expect(mocks.mongoAdapter).toHaveBeenCalledWith('query', params);
  });
});
