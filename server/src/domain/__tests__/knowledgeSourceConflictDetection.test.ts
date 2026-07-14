import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import {
  detectKnowledgeSourceConflicts,
  normalizeKnowledgeSourceRef,
  observeKnowledgeSourceConflicts,
} from '../knowledgeSourceConflictDetection.js';

const approvedAuthority = {
  authorityKind: 'kevin_approved',
  authorityStatus: 'active_authority',
  authorityBy: 'TMAG-01',
  authorityAt: '2026-07-14T00:00:00.000Z',
};

function source(
  id: string,
  content: string,
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    _id: id,
    sourceId: id,
    version: 1,
    originalContent: content,
    sourceRef: `https://Example.com/${id}`,
    domain: 'training',
    language: 'en',
    status: 'active',
    authorityDecision: 'active_authority',
    authority: approvedAuthority,
    ...overrides,
  };
}

function resource(id: string, content: string): Record<string, unknown> {
  return {
    _id: `knowledge:${id}:v1`,
    resourceVersionId: `knowledge:${id}:v1`,
    contentDigestSha256: sha(content),
  };
}

function sha(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

describe('knowledge source conflict detection', () => {
  it('reports a complete clean observation without exposing source material', () => {
    const result = detectKnowledgeSourceConflicts({
      sources: [source('source-a', 'canonical source material')],
      resources: [resource('source-a', 'canonical source material')],
      computedAt: '2026-07-14T00:00:00.000Z',
    });

    expect(result).toMatchObject({
      status: 'clear',
      conflictCount: 0,
      highestSeverity: null,
      scan: { sourcesObserved: 1, resourcesObserved: 1, complete: true },
      samples: [],
      mutationAuthorized: false,
    });
    expect(JSON.stringify(result)).not.toContain('canonical source material');
    expect(JSON.stringify(result)).not.toContain('Example.com');
  });

  it('detects same-identity content divergence as critical', () => {
    const result = detectKnowledgeSourceConflicts({
      sources: [
        source('source-a', 'first', { _id: 'row-a' }),
        source('source-a', 'second', { _id: 'row-b' }),
      ],
      resources: [],
    });

    expect(result.status).toBe('conflicts');
    expect(result.highestSeverity).toBe('critical');
    expect(result.counts.active_source_identity_divergence).toBe(1);
    expect(result.samples[0]).toMatchObject({
      conflictClass: 'active_source_identity_divergence',
      severity: 'critical',
    });
    expect(result.samples[0]?.fingerprint).toMatch(/^[a-f0-9]{64}$/);
  });

  it('separates source-reference divergence from exact duplicate evidence', () => {
    const divergent = detectKnowledgeSourceConflicts({
      sources: [
        source('source-a', 'first', { sourceRef: 'HTTPS://EXAMPLE.COM/Policy?Rev=A' }),
        source('source-b', 'second', { sourceRef: 'https://example.com/Policy?Rev=A' }),
      ],
      resources: [],
    });
    expect(divergent.counts.active_source_ref_divergence).toBe(1);
    expect(divergent.counts.active_exact_duplicate).toBe(0);

    const duplicate = detectKnowledgeSourceConflicts({
      sources: [
        source('source-a', 'same', { sourceRef: 'repo:policy.md' }),
        source('source-b', 'same', { sourceRef: ' repo:policy.md ' }),
      ],
      resources: [],
    });
    expect(duplicate.counts.active_exact_duplicate).toBe(1);
    expect(duplicate.highestSeverity).toBe('advisory');
  });

  it('detects resource digest and active-authority mismatches', () => {
    const result = detectKnowledgeSourceConflicts({
      sources: [
        source('source-a', 'canonical'),
        source('source-b', 'candidate', {
          authorityDecision: 'candidate_only',
          authority: { ...approvedAuthority, authorityStatus: 'candidate_only' },
        }),
      ],
      resources: [resource('source-a', 'different')],
    });

    expect(result.counts.resource_projection_digest_mismatch).toBe(1);
    expect(result.counts.active_authority_state_mismatch).toBe(1);
    expect(result.highestSeverity).toBe('high');
  });

  it('fails closed for malformed or truncated evidence', () => {
    const degraded = detectKnowledgeSourceConflicts({ sources: [{ _id: 'bad' }], resources: [] });
    expect(degraded).toMatchObject({
      status: 'degraded',
      scan: { complete: false },
      degradedReasons: [{ reason: 'malformed_source_record', count: 1 }],
    });

    const truncated = detectKnowledgeSourceConflicts({
      sources: [],
      resources: [],
      sourceTruncated: true,
      degradedReasons: ['source_scan_unavailable'],
    });
    expect(truncated.status).toBe('truncated');
    expect(truncated.scan.complete).toBe(false);
  });

  it('normalizes only surrounding whitespace plus URL scheme and host case', () => {
    expect(normalizeKnowledgeSourceRef(' HTTPS://User@EXAMPLE.COM/Policy/RevA?Key=Value '))
      .toBe('https://User@example.com/Policy/RevA?Key=Value');
    expect(normalizeKnowledgeSourceRef(' repo:Policy/RevA ')).toBe('repo:Policy/RevA');
  });

  it('uses bounded keyset pages and reports a row beyond the cap as truncated', async () => {
    const sources = Array.from({ length: 1_001 }, (_, index) => {
      const id = `source-${String(index).padStart(4, '0')}`;
      return source(id, `content-${index}`);
    });
    const persistence = vi.fn(async (_tool: string, _action: string, params: Record<string, unknown>) => {
      if (params.collection === 'tmag_resource_catalog') return { documents: [], count: 0 };
      const filter = params.filter as { _id?: { $gt?: string } };
      const after = filter._id?.$gt;
      const page = sources
        .filter((entry) => !after || String(entry._id) > after)
        .slice(0, Number(params.limit));
      return { documents: page, count: sources.filter((entry) => !after || String(entry._id) > after).length };
    });

    const result = await observeKnowledgeSourceConflicts(
      persistence as never,
      () => new Date('2026-07-14T00:00:00.000Z'),
    );

    expect(result.status).toBe('truncated');
    expect(result.scan).toMatchObject({ sourcesObserved: 1_000, resourcesObserved: 0, complete: false });
    expect(persistence).toHaveBeenCalledWith('mongodb', 'query', expect.objectContaining({
      collection: 'mcs_knowledge_sources', sort: { _id: 1 }, limit: 250,
    }));
    expect(persistence).toHaveBeenCalledWith('mongodb', 'query', expect.objectContaining({
      collection: 'mcs_knowledge_sources', limit: 1,
    }));
  });

  it('degrades without throwing when a canonical scan is unavailable', async () => {
    const persistence = vi.fn(async (_tool: string, _action: string, params: Record<string, unknown>) => {
      if (params.collection === 'mcs_knowledge_sources') throw new Error('offline');
      return { documents: [], count: 0 };
    });
    const result = await observeKnowledgeSourceConflicts(persistence as never);
    expect(result.status).toBe('degraded');
    expect(result.degradedReasons).toContainEqual({ reason: 'source_scan_unavailable', count: 1 });
    expect(result.mutationAuthorized).toBe(false);
  });
});
