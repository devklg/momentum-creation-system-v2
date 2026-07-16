import { describe, expect, it, vi } from 'vitest';
import {
  POOL_POSITIONING_QUERY_CATALOG,
  validatePoolPositioningQueryCatalog,
  verifyPoolPositioningGraph,
  type PoolPositioningQuerySpec,
} from '../poolPositioningGraphVerification.js';

const placement = {
  prospectId: 'prospect_1',
  sponsorTmagId: 'TMBA-1',
  positionNumber: 4,
  placedAt: '2026-07-16T00:00:00.000Z',
  flushedAt: null,
  flushReason: null,
};

function persistenceFor(args: {
  mongo?: Record<string, unknown>[];
  graph?: Record<string, unknown>[];
  counter?: number;
  pools?: string[];
}) {
  return vi.fn(async (tool: string, action: string, params: Record<string, unknown>) => {
    const serialized = JSON.stringify(params);
    expect(serialized).not.toMatch(/\b(CREATE|MERGE|DELETE|DETACH|SET|REMOVE|DROP|CALL)\b/i);
    if (tool === 'mongodb' && action === 'aggregate') return { results: args.mongo ?? [] };
    if (tool === 'mongodb' && action === 'query') {
      return { documents: [{ current: args.counter ?? 0 }] };
    }
    const query = String(params.query);
    if (query.includes('MATCH (pool:TmagPool)')) {
      const pools = args.pools ?? [];
      return {
        records: [{
          total: pools.length,
          malformedIds: pools.filter((pool) => pool === '__MISSING__').length,
          samples: pools,
        }],
      };
    }
    return { records: args.graph ?? [] };
  });
}

describe('pool positioning query catalog', () => {
  it('is complete, bounded, and read-only', () => {
    expect(validatePoolPositioningQueryCatalog()).toEqual([]);
    expect(POOL_POSITIONING_QUERY_CATALOG.map((row) => row.key)).toEqual([
      'mongo_placements',
      'mongo_counter',
      'neo4j_placements',
      'neo4j_pools',
    ]);
  });

  it('rejects duplicate, mutating, unbounded, and incomplete catalogs', () => {
    const specs: PoolPositioningQuerySpec[] = [
      POOL_POSITIONING_QUERY_CATALOG[0]!,
      { ...POOL_POSITIONING_QUERY_CATALOG[0]! },
      {
        key: 'neo4j_placements',
        tool: 'neo4j',
        action: 'cypher',
        params: { query: 'MATCH (n) DELETE n' },
      },
    ];
    expect(validatePoolPositioningQueryCatalog(specs)).toEqual(expect.arrayContaining([
      'duplicate_key:mongo_placements',
      'unsafe_query:neo4j_placements',
      'unbounded_scan:neo4j_placements',
      'missing_query:mongo_counter',
      'missing_query:neo4j_pools',
    ]));
  });
});

describe('pool positioning verification runner', () => {
  it('reports a clear canonical Mongo-to-Neo4j snapshot and preserves valid gaps', async () => {
    const graph = {
      ...placement,
      poolId: 'tm_team_pool',
      sourceLabels: ['TmagProspect'],
      poolLabels: ['TmagPool'],
    };
    const persistence = persistenceFor({
      mongo: [placement],
      graph: [graph],
      counter: 9,
      pools: ['tm_team_pool'],
    });
    const report = await verifyPoolPositioningGraph({ persistence: persistence as never });
    expect(report).toMatchObject({
      status: 'clear',
      policy: 'read_only_test',
      exactFindings: 0,
      coverage: { expected: 7, completed: 7, degraded: 0 },
      observations: { mongoPlacements: 1, neo4jPlacements: 1, poolCounter: 9 },
    });
    expect(persistence).toHaveBeenCalledTimes(4);
  });

  it('finds duplicate positions, parity drift, invalid flush metadata, and timestamp inversion', async () => {
    const second = {
      ...placement,
      prospectId: 'prospect_2',
      positionNumber: 4,
      placedAt: '2026-07-15T00:00:00.000Z',
      flushedAt: '2026-07-16T02:00:00.000Z',
      flushReason: null,
    };
    const report = await verifyPoolPositioningGraph({
      persistence: persistenceFor({
        mongo: [placement, second],
        graph: [{
          ...placement,
          poolId: 'alternate_pool',
          sourceLabels: ['TmagProspect'],
          poolLabels: ['TmagPool'],
        }],
        counter: 3,
        pools: ['tm_team_pool', 'alternate_pool'],
      }) as never,
    });
    expect(report.status).toBe('findings');
    expect(report.exactFindings).toBeGreaterThan(0);
    expect(report.results.find((row) => row.key === 'unique_positive_position')?.exactCount).toBeGreaterThan(0);
    expect(report.results.find((row) => row.key === 'mongo_neo4j_parity')?.exactCount).toBeGreaterThan(0);
    expect(report.results.find((row) => row.key === 'flush_metadata_pair')?.exactCount).toBe(1);
    expect(report.results.find((row) => row.key === 'timestamp_position_order')?.exactCount).toBe(1);
  });

  it('returns hashed bounded samples and truncates excess findings', async () => {
    const mongo = Array.from({ length: 30 }, (_, index) => ({
      ...placement,
      prospectId: `prospect_${index}`,
      positionNumber: 1,
    }));
    const report = await verifyPoolPositioningGraph({
      persistence: persistenceFor({ mongo, counter: 30, pools: ['tm_team_pool'] }) as never,
      sampleLimit: 100,
    });
    expect(report.status).toBe('truncated');
    const row = report.results.find((entry) => entry.key === 'unique_positive_position')!;
    expect(row.samples.length).toBeLessThanOrEqual(25);
    expect(row.samples[0]).toMatch(/^[a-f0-9]{16}$/);
  });

  it('fails closed on malformed responses, errors, scan overflow, and invalid catalogs', async () => {
    const malformed = await verifyPoolPositioningGraph({
      persistence: vi.fn(async () => ({})) as never,
    });
    expect(malformed.status).toBe('degraded');

    const failed = await verifyPoolPositioningGraph({
      persistence: vi.fn(async () => { throw new Error('stack_unavailable'); }) as never,
    });
    expect(failed.results[0]?.degradedReason).toBe('stack_unavailable');

    const overflow = await verifyPoolPositioningGraph({
      persistence: persistenceFor({
        mongo: Array.from({ length: 3 }, (_, i) => ({ ...placement, prospectId: `p${i}` })),
      }) as never,
      scanLimit: 2,
    });
    expect(overflow.status).toBe('truncated');

    const persistence = vi.fn();
    const invalid = await verifyPoolPositioningGraph({
      persistence: persistence as never,
      specs: [],
    });
    expect(invalid.status).toBe('degraded');
    expect(invalid.exactFindings).toBeNull();
    expect(persistence).not.toHaveBeenCalled();
  });

  it('fails closed on wrong endpoint labels, missing pool ids, and malformed identity or flush fields', async () => {
    const wrongEndpoint = {
      ...placement,
      poolId: 'tm_team_pool',
      sourceLabels: ['WrongProspect'],
      poolLabels: ['WrongPool'],
    };
    const report = await verifyPoolPositioningGraph({
      persistence: persistenceFor({
        mongo: [{
          ...placement,
          prospectId: '',
          flushedAt: 'not-an-iso-date',
          flushReason: 7,
        }],
        graph: [wrongEndpoint],
        pools: ['__MISSING__'],
      }) as never,
    });
    expect(report.status).toBe('findings');
    expect(report.results.find((row) => row.key === 'single_team_pool')?.exactCount).toBeGreaterThan(0);
    expect(report.results.find((row) => row.key === 'one_placement_per_prospect')?.exactCount).toBeGreaterThan(0);
    expect(report.results.find((row) => row.key === 'flush_metadata_pair')?.exactCount).toBeGreaterThan(0);
  });
});
