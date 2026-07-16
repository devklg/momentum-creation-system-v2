import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import {
  GRAPH_INTEGRITY_TRAVERSAL_CATALOG,
  observeNeo4jGraphIntegrity,
  validateGraphIntegrityCatalog,
  type GraphIntegrityTraversalSpec,
} from '../neo4jGraphIntegrity.js';

type AnyRec = Record<string, unknown>;

function spec(
  overrides: Partial<GraphIntegrityTraversalSpec> = {},
): GraphIntegrityTraversalSpec {
  return {
    key: 'test_missing_identity',
    label: 'Test missing identity',
    findingClass: 'missing_identity',
    severity: 'critical',
    identityField: 'id',
    query:
      'MATCH (n:TestNode) WHERE n.id IS NULL WITH collect(toString(elementId(n))) AS findings ' +
      'RETURN size(findings) AS total, findings[..$sampleLimit] AS samples',
    ...overrides,
  };
}

function mockPersistence(rows: Record<string, { total: number; samples: string[] }>) {
  return vi.fn(async (tool: string, action: string, params: AnyRec) => {
    expect(tool).toBe('neo4j');
    expect(action).toBe('cypher');
    const query = String(params.query);
    expect(query).not.toMatch(/\b(CREATE|MERGE|DELETE|DETACH|SET|REMOVE|DROP)\b/i);
    if (query.includes('RETURN nodes, count(r) AS relationships')) {
      return { records: [{ nodes: 2527, relationships: 18057 }] };
    }
    const key = String((params as { marker?: string }).marker ?? '');
    const row = rows[key] ?? Object.values(rows)[0] ?? { total: 0, samples: [] };
    return { records: [row] };
  });
}

describe('Neo4j graph integrity catalog', () => {
  it('is static, unique, bounded, and covers every approved finding class', () => {
    expect(validateGraphIntegrityCatalog()).toEqual([]);
    expect(GRAPH_INTEGRITY_TRAVERSAL_CATALOG).toHaveLength(41);
    expect(new Set(GRAPH_INTEGRITY_TRAVERSAL_CATALOG.map((row) => row.key)).size).toBe(41);
    expect(new Set(GRAPH_INTEGRITY_TRAVERSAL_CATALOG.map((row) => row.findingClass))).toEqual(
      new Set([
        'missing_identity',
        'duplicate_identity',
        'missing_required_anchor',
        'ambiguous_required_anchor',
        'duplicate_parallel_edge',
      ]),
    );
    for (const row of GRAPH_INTEGRITY_TRAVERSAL_CATALOG) {
      expect(row.query).toContain('$sampleLimit');
      expect(row.query).not.toMatch(/\b(CREATE|MERGE|DELETE|DETACH|SET|REMOVE|DROP)\b/i);
    }
  });

  it('rejects duplicate keys, unsafe Cypher, and missing structural contracts', () => {
    const invalid = [
      spec(),
      spec({ query: 'MATCH (n) DELETE n RETURN 0 AS total, [][..$sampleLimit] AS samples' }),
      spec({
        key: 'anchor',
        findingClass: 'missing_required_anchor',
        relationship: undefined,
      }),
    ];
    expect(validateGraphIntegrityCatalog(invalid)).toEqual(
      expect.arrayContaining([
        'duplicate_or_missing_spec_key:test_missing_identity',
        'mutation_or_unsafe_query:test_missing_identity',
        'missing_relationship_contract:anchor',
      ]),
    );
  });
});

describe('Neo4j graph integrity observation', () => {
  it('reports a complete clean read-only scan with topology counts', async () => {
    const persistence = mockPersistence({});
    const report = await observeNeo4jGraphIntegrity({
      persistence: persistence as never,
      specs: [spec()],
      now: () => new Date('2026-07-16T00:00:00.000Z'),
    });
    expect(report).toMatchObject({
      status: 'clear',
      repairPolicy: 'report_only',
      topology: { nodes: 2527, relationships: 18057 },
      coverage: { expected: 1, completed: 1, degraded: 0 },
      totals: { findings: 0 },
    });
    expect(persistence).toHaveBeenCalledTimes(2);
  });

  it('classifies findings and exposes hashes rather than canonical identities', async () => {
    const identity = 'sensitive-canonical-id';
    const persistence = vi.fn(async (_tool: string, _action: string, params: AnyRec) => {
      const query = String(params.query);
      if (query.includes('RETURN nodes, count(r) AS relationships')) {
        return { records: [{ nodes: 2, relationships: 1 }] };
      }
      return { records: [{ total: 1, samples: [identity] }] };
    });
    const report = await observeNeo4jGraphIntegrity({
      persistence: persistence as never,
      specs: [spec()],
    });
    expect(report.status).toBe('findings');
    expect(report.traversals[0]).toMatchObject({
      status: 'findings',
      exactCount: 1,
      sampleFingerprints: [
        createHash('sha256').update(`test_missing_identity|${identity}`).digest('hex'),
      ],
    });
    expect(JSON.stringify(report)).not.toContain(identity);
  });

  it('distinguishes truncation from degradation and never claims clear', async () => {
    const truncatedPersistence = vi.fn(async (_tool: string, _action: string, params: AnyRec) =>
      String(params.query).includes('RETURN nodes, count(r) AS relationships')
        ? { records: [{ nodes: 30, relationships: 0 }] }
        : { records: [{ total: 30, samples: Array.from({ length: 25 }, (_, i) => `id-${i}`) }] },
    );
    const truncated = await observeNeo4jGraphIntegrity({
      persistence: truncatedPersistence as never,
      specs: [spec()],
    });
    expect(truncated.status).toBe('truncated');
    expect(truncated.traversals[0]?.status).toBe('truncated');

    const degradedPersistence = vi.fn(async (_tool: string, _action: string, params: AnyRec) =>
      String(params.query).includes('RETURN nodes, count(r) AS relationships')
        ? { records: [{ nodes: 1, relationships: 0 }] }
        : { records: [{ total: 'bad', samples: [] }] },
    );
    const degraded = await observeNeo4jGraphIntegrity({
      persistence: degradedPersistence as never,
      specs: [spec()],
    });
    expect(degraded.status).toBe('degraded');
    expect(degraded.coverage).toEqual({ expected: 1, completed: 0, degraded: 1 });
    expect(degraded.degradedReasons[0]).toContain('malformed_aggregate_or_samples');
  });

  it('fails closed before execution when catalog validation fails', async () => {
    const persistence = vi.fn();
    const report = await observeNeo4jGraphIntegrity({
      persistence: persistence as never,
      specs: [spec({ identityField: '' })],
    });
    expect(report.status).toBe('degraded');
    expect(report.coverage).toEqual({ expected: 1, completed: 0, degraded: 1 });
    expect(persistence).not.toHaveBeenCalled();
  });
});
