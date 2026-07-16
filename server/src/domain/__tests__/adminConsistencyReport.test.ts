import { describe, expect, it, vi } from 'vitest';
import { buildAdminConsistencyReport } from '../adminConsistencyReport.js';

type AnyRec = Record<string, unknown>;

function docsFor(collection: string): AnyRec[] {
  if (collection === 'tmag_prospects') {
    return [
      {
        _id: 'prospect_1',
        prospectId: 'prospect_1',
        sponsorTmagId: 'TMAG-01',
        token: 'tok_1',
        createdAt: '2026-07-11T00:00:00.000Z',
      },
    ];
  }
  return [];
}

describe('admin consistency report', () => {
  it('classifies graph-critical missing graph legs as suspected half-writes', async () => {
    const persistence = vi.fn(async (tool: string, action: string, params: AnyRec) => {
      if (tool === 'mongodb' && action === 'query') {
        if (params.collection === 'tmag_projection_outbox') {
          return {
            documents: [
              {
                outboxId: 'obx_1',
                tier: 'knowledge',
                target: 'neo4j',
                status: 'failed',
                entityId: 'prospect_1',
                mongoCollection: 'tmag_prospects',
                attempts: 8,
                maxAttempts: 8,
                nextAttemptAt: '2026-07-11T00:00:00.000Z',
                updatedAt: '2026-07-11T00:00:00.000Z',
                lastError: 'graph down',
              },
            ],
          };
        }
        return { documents: docsFor(String(params.collection)), count: 1 };
      }
      if (tool === 'neo4j' && action === 'cypher') {
        const query = String(params.query ?? '');
        if (query.includes('RETURN nodes, count(r) AS relationships')) {
          return { records: [{ nodes: 10, relationships: 20 }] };
        }
        if (query.includes('RETURN size(findings) AS total')) {
          return { records: [{ total: 0, samples: [] }] };
        }
        if (query.includes('RETURN count')) return { records: [{ n: 0 }] };
        if (query.includes('MATCH (p:TmagProspect)')) return { records: [{ id: 'orphan_prospect' }] };
        return { records: [] };
      }
      if (tool === 'chromadb' && action === 'query_with_filter') {
        return { results: { ids: ['prospect_1'], metadatas: [{ prospectId: 'prospect_1' }] } };
      }
      throw new Error(`unexpected ${tool}.${action}`);
    });

    const report = await buildAdminConsistencyReport({
      now: () => new Date('2026-07-11T00:20:00.000Z'),
      persistence: persistence as never,
    });

    expect(report.overall).toBe('red');
    expect(report.totals).toMatchObject({
      halfWrites: 1,
      failedProjections: 1,
      orphanRecords: 1,
      reconciliationIssues: 1,
    });
    expect(report.halfWrites[0]).toMatchObject({
      specKey: 'prospects',
      id: 'prospect_1',
      neo4jStatus: 'missing',
    });
    expect(report.staleProjections[0]).toMatchObject({
      outboxId: 'obx_1',
      status: 'failed',
      stale: true,
    });
  });

  it('reports stale pending projections as yellow when no red conditions exist', async () => {
    const persistence = vi.fn(async (tool: string, action: string, params: AnyRec) => {
      if (tool === 'mongodb' && action === 'query') {
        if (params.collection === 'tmag_projection_outbox') {
          return {
            documents: [
              {
                outboxId: 'obx_pending',
                tier: 'operational',
                target: 'chroma',
                status: 'pending',
                entityId: 'cbreq_1',
                mongoCollection: 'tmag_prospect_callback_requests',
                attempts: 2,
                maxAttempts: 8,
                nextAttemptAt: '2026-07-11T00:05:00.000Z',
                updatedAt: '2026-07-11T00:00:00.000Z',
                lastError: 'timeout',
              },
            ],
          };
        }
        return { documents: [], count: 0 };
      }
      if (tool === 'neo4j' && action === 'cypher') {
        const query = String(params.query ?? '');
        if (query.includes('RETURN nodes, count(r) AS relationships')) {
          return { records: [{ nodes: 0, relationships: 0 }] };
        }
        if (query.includes('RETURN size(findings) AS total')) {
          return { records: [{ total: 0, samples: [] }] };
        }
        return { records: [] };
      }
      if (tool === 'chromadb' && action === 'query_with_filter') {
        return { results: { ids: [], metadatas: [] } };
      }
      throw new Error(`unexpected ${tool}.${action}`);
    });

    const report = await buildAdminConsistencyReport({
      now: () => new Date('2026-07-11T00:20:00.000Z'),
      persistence: persistence as never,
    });

    expect(report.overall).toBe('yellow');
    expect(report.totals).toMatchObject({
      halfWrites: 0,
      staleProjections: 1,
      failedProjections: 0,
      orphanRecords: 0,
    });
    expect(report.staleProjections[0]?.ageMinutes).toBe(20);
    expect(report.graphIntegrity.status).toBe('clear');
  });
});
