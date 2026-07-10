import neo4j from 'neo4j-driver';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const session = {
    close: vi.fn(),
    run: vi.fn(),
  };
  return {
    getNeo4jDriver: vi.fn(() => ({ session: () => session })),
    session,
  };
});

vi.mock('../neo4j/connection.js', () => ({
  getNeo4jDriver: mocks.getNeo4jDriver,
}));

describe('Neo4j direct adapter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('normalizes driver records into the PERSISTENCE-compatible cypher shape', async () => {
    const { neo4jAdapter } = await import('../neo4j/adapter.js');
    mocks.session.run.mockResolvedValue({
      records: [
        {
          toObject: () => ({
            answer: neo4j.int(42),
            node: { properties: { id: 'n1', rank: neo4j.int(7) } },
          }),
        },
      ],
      summary: {
        counters: {
          updates: () => ({ nodesCreated: 1, propertiesSet: 2 }),
        },
      },
    });

    await expect(
      neo4jAdapter('cypher', {
        query: 'RETURN 42 AS answer',
        params: { id: 'n1' },
      }),
    ).resolves.toEqual({
      records: [{ answer: 42, node: { id: 'n1', rank: 7 } }],
      summary: { counters: { nodesCreated: 1, propertiesSet: 2 } },
    });
    expect(mocks.session.close).toHaveBeenCalledTimes(1);
  });

  it('rejects hung cypher calls instead of waiting indefinitely', async () => {
    vi.useFakeTimers();
    const { neo4jAdapter } = await import('../neo4j/adapter.js');
    mocks.session.run.mockReturnValue(new Promise(() => undefined));
    mocks.session.close.mockResolvedValue(undefined);

    const pending = neo4jAdapter('cypher', {
      query: 'RETURN 1 AS n',
      params: {},
    });
    const expectation = expect(pending).rejects.toThrow(/cypher timed out after 5000ms/);
    await vi.advanceTimersByTimeAsync(5_000);

    await expectation;
    expect(mocks.session.close).toHaveBeenCalledTimes(1);
  });
});
