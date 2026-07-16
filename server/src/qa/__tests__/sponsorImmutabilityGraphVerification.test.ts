import { describe, expect, it, vi } from 'vitest';
import {
  SPONSOR_IMMUTABILITY_GRAPH_VERIFICATION_CATALOG,
  validateSponsorGraphVerificationCatalog,
  verifySponsorImmutabilityGraph,
  type SponsorGraphVerificationSpec,
} from '../sponsorImmutabilityGraphVerification.js';

function spec(
  overrides: Partial<SponsorGraphVerificationSpec> = {},
): SponsorGraphVerificationSpec {
  return {
    key: 'test_invariant',
    description: 'Test invariant.',
    query:
      'MATCH (n:TestNode) WITH collect(toString(elementId(n))) AS findings ' +
      'RETURN size(findings) AS total, findings[..$sampleLimit] AS samples',
    ...overrides,
  };
}

describe('sponsor immutability graph verification catalog', () => {
  it('covers the complete approved sponsor chain with static read-only queries', () => {
    expect(validateSponsorGraphVerificationCatalog()).toEqual([]);
    expect(SPONSOR_IMMUTABILITY_GRAPH_VERIFICATION_CATALOG).toHaveLength(8);
    expect(
      new Set(SPONSOR_IMMUTABILITY_GRAPH_VERIFICATION_CATALOG.map((row) => row.key)),
    ).toEqual(
      new Set([
        'member_ambiguous_current_sponsor',
        'member_self_sponsor',
        'override_missing_current_sponsor',
        'override_missing_original_sponsor',
        'prospect_inviter_mismatch',
        'invite_token_sponsor_mismatch',
        'prospect_account_sponsor_mismatch',
        'access_code_ambiguous_owner',
      ]),
    );
    for (const row of SPONSOR_IMMUTABILITY_GRAPH_VERIFICATION_CATALOG) {
      expect(row.query).toContain('$sampleLimit');
      expect(row.query).toContain('RETURN size(findings) AS total');
      expect(row.query).not.toMatch(
        /\b(CREATE|MERGE|DELETE|DETACH|SET|REMOVE|DROP|CALL)\b/i,
      );
    }
  });

  it('rejects duplicate, mutating, and unbounded verification definitions', () => {
    const invalid = [
      spec(),
      spec({
        query:
          'MATCH (n) DELETE n WITH [] AS findings ' +
          'RETURN size(findings) AS total, findings[..$sampleLimit] AS samples',
      }),
      spec({
        key: 'unbounded',
        query:
          'MATCH (n) WITH collect(toString(elementId(n))) AS findings ' +
          'RETURN size(findings) AS total, findings AS samples',
      }),
    ];
    expect(validateSponsorGraphVerificationCatalog(invalid)).toEqual(
      expect.arrayContaining([
        'duplicate_or_missing_key:test_invariant',
        'unsafe_query:test_invariant',
        'unbounded_samples:unbounded',
      ]),
    );
  });
});

describe('sponsor immutability graph verification runner', () => {
  it('reports a complete clear scan and only executes read-only Neo4j queries', async () => {
    const persistence = vi.fn(async (tool: string, action: string, params: unknown) => {
      expect(tool).toBe('neo4j');
      expect(action).toBe('cypher');
      const query = String((params as { query: string }).query);
      expect(query).not.toMatch(/\b(CREATE|MERGE|DELETE|DETACH|SET|REMOVE|DROP|CALL)\b/i);
      expect((params as { params: { sampleLimit: number } }).params.sampleLimit).toBe(25);
      return { records: [{ total: 0, samples: [] }] };
    });

    const report = await verifySponsorImmutabilityGraph({
      persistence: persistence as never,
    });

    expect(report).toMatchObject({
      status: 'clear',
      policy: 'read_only_test',
      coverage: { expected: 8, completed: 8, degraded: 0 },
      exactFindings: 0,
    });
    expect(persistence).toHaveBeenCalledTimes(8);
  });

  it('surfaces exact findings and marks bounded samples as truncated', async () => {
    const persistence = vi.fn(async () => ({
      records: [{ total: 30, samples: Array.from({ length: 25 }, (_, i) => `id-${i}`) }],
    }));
    const report = await verifySponsorImmutabilityGraph({
      persistence: persistence as never,
      specs: [spec()],
      sampleLimit: 100,
    });

    expect(report.status).toBe('truncated');
    expect(report.exactFindings).toBe(30);
    expect(report.results[0]).toMatchObject({
      status: 'truncated',
      exactCount: 30,
    });
  });

  it('fails closed on malformed results, query failures, and invalid catalogs', async () => {
    const malformed = await verifySponsorImmutabilityGraph({
      persistence: vi.fn(async () => ({ records: [{ total: 'bad', samples: [] }] })) as never,
      specs: [spec()],
    });
    expect(malformed.status).toBe('degraded');
    expect(malformed.coverage).toEqual({ expected: 1, completed: 0, degraded: 1 });

    const failed = await verifySponsorImmutabilityGraph({
      persistence: vi.fn(async () => {
        throw new Error('neo4j_unavailable');
      }) as never,
      specs: [spec()],
    });
    expect(failed.results[0]?.degradedReason).toBe('neo4j_unavailable');

    const persistence = vi.fn();
    const invalid = await verifySponsorImmutabilityGraph({
      persistence: persistence as never,
      specs: [spec({ query: 'MATCH (n) DELETE n' })],
    });
    expect(invalid.status).toBe('degraded');
    expect(persistence).not.toHaveBeenCalled();
  });
});
