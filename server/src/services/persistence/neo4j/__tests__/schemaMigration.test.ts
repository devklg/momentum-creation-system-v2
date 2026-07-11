import { describe, expect, it, vi } from 'vitest';
import {
  buildNeo4jSchemaMigrationPlan,
  runNeo4jSchemaMigration,
  verifyNeo4jSchemaMigration,
  type Neo4jCatalog,
} from '../schemaMigration.js';

const catalog = {
  generatedAt: '2026-07-11T00:00:00.000Z',
  constraints: [
    {
      name: 'idx_lookup',
      label: 'LookupNode',
      property: 'status',
      kind: 'index',
      status: 'declared_phase7_not_applied',
      cypher: 'CREATE INDEX idx_lookup IF NOT EXISTS FOR (n:LookupNode) ON (n.status)',
      drop: 'DROP INDEX idx_lookup IF EXISTS',
      purpose: 'Lookup support.',
    },
    {
      name: 'unique_anchor',
      label: 'AnchorNode',
      property: 'id',
      kind: 'unique_constraint',
      status: 'planned_core_not_applied',
      cypher: 'CREATE CONSTRAINT unique_anchor IF NOT EXISTS FOR (n:AnchorNode) REQUIRE n.id IS UNIQUE',
      drop: 'DROP CONSTRAINT unique_anchor IF EXISTS',
      purpose: 'Anchor uniqueness.',
    },
  ],
} satisfies Neo4jCatalog;

describe('Neo4j schema migration planning', () => {
  it('plans idempotent constraints before indexes', () => {
    const plan = buildNeo4jSchemaMigrationPlan(catalog);

    expect(plan.summary).toEqual({ constraints: 1, indexes: 1, total: 2 });
    expect(plan.statements.map((statement) => statement.name)).toEqual(['unique_anchor', 'idx_lookup']);
  });

  it('rejects non-idempotent or multi-statement Cypher', () => {
    const baseStatement = catalog.constraints?.[0];
    if (!baseStatement) throw new Error('test fixture missing statement');

    expect(() =>
      buildNeo4jSchemaMigrationPlan({
        constraints: [
          {
            ...baseStatement,
            name: 'bad',
            cypher: 'CREATE INDEX bad FOR (n:LookupNode) ON (n.status); MATCH (n) RETURN n',
          },
        ],
      }),
    ).toThrow(/idempotent CREATE/);
  });

  it('dry-runs without calling Neo4j', async () => {
    const plan = buildNeo4jSchemaMigrationPlan(catalog);
    const runner = vi.fn();

    const result = await runNeo4jSchemaMigration(plan, { mode: 'dry-run', runner });

    expect(result.ok).toBe(true);
    expect(result.summary).toEqual({ planned: 2, applied: 0, failed: 0 });
    expect(runner).not.toHaveBeenCalled();
  });

  it('applies statements through the Neo4j persistence dispatch surface', async () => {
    const plan = buildNeo4jSchemaMigrationPlan(catalog);
    const runnerMock = vi.fn(async () => ({ records: [], summary: { counters: {} } }));
    const runner = runnerMock as unknown as Parameters<typeof runNeo4jSchemaMigration>[1]['runner'];

    const result = await runNeo4jSchemaMigration(plan, { mode: 'apply', runner });

    expect(result.ok).toBe(true);
    expect(result.summary).toEqual({ planned: 0, applied: 2, failed: 0 });
    expect(runnerMock).toHaveBeenNthCalledWith(1, 'neo4j', 'cypher', {
      query: 'CREATE CONSTRAINT unique_anchor IF NOT EXISTS FOR (n:AnchorNode) REQUIRE n.id IS UNIQUE',
    });
    expect(runnerMock).toHaveBeenNthCalledWith(2, 'neo4j', 'cypher', {
      query: 'CREATE INDEX idx_lookup IF NOT EXISTS FOR (n:LookupNode) ON (n.status)',
    });
  });

  it('verifies expected catalog names against SHOW output', async () => {
    const plan = buildNeo4jSchemaMigrationPlan(catalog);
    const runner = vi
      .fn()
      .mockResolvedValueOnce({ records: [{ names: ['unique_anchor'] }] })
      .mockResolvedValueOnce({ records: [{ names: [] }] });

    const result = await verifyNeo4jSchemaMigration(plan, runner);

    expect(result.ok).toBe(false);
    expect(result.missing).toEqual({ constraints: [], indexes: ['idx_lookup'] });
    expect(runner).toHaveBeenNthCalledWith(1, 'neo4j', 'cypher', {
      query: 'SHOW CONSTRAINTS YIELD name RETURN collect(name) AS names',
    });
    expect(runner).toHaveBeenNthCalledWith(2, 'neo4j', 'cypher', {
      query: 'SHOW INDEXES YIELD name RETURN collect(name) AS names',
    });
  });
});
