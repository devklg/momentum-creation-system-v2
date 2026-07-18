import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { runCrossStoreReconciliation } from '../crossStoreReconciliation.js';

type AnyRec = Record<string, unknown>;

function mongoDocuments(collection: string): AnyRec[] {
  if (collection === 'team_magnificent_members') {
    return [{ _id: 'TMAG-01', tmagId: 'TMAG-01', createdAt: '2026-07-01T00:00:00.000Z' }];
  }
  if (collection === 'tmag_prospects') {
    return [
      {
        _id: 'prospect_1',
        prospectId: 'prospect_1',
        sponsorTmagId: 'TMAG-01',
        token: 'tok_1',
        createdAt: '2026-07-01T00:00:00.000Z',
      },
    ];
  }
  if (collection === 'tmag_steve_success_interview') {
    return [
      {
        _id: 'steve_TMAG-02',
        tmagId: 'TMAG-02',
        completedAt: '2026-07-01T00:00:00.000Z',
      },
    ];
  }
  return [];
}

function cleanPersistence() {
  return vi.fn(async (tool: string, action: string, params: AnyRec) => {
    if (tool === 'mongodb' && action === 'query') {
      return { documents: mongoDocuments(String(params.collection)), count: 1 };
    }
    if (tool === 'neo4j' && action === 'cypher') {
      return { records: [{ n: 1 }], summary: { counters: {} } };
    }
    if (tool === 'chromadb' && action === 'query_with_filter') {
      const where = params.where as AnyRec;
      const [field, value] = Object.entries(where)[0] ?? [];
      return {
        results: {
          ids: [String(value)],
          metadatas: [{ [String(field)]: value }],
        },
      };
    }
    throw new Error(`unexpected ${tool}.${action}`);
  });
}

describe('cross-store reconciliation job', () => {
  it('samples configured Mongo rows and reports clean read-backs across stores', async () => {
    const persistence = cleanPersistence();

    const report = await runCrossStoreReconciliation({
      specKeys: ['members', 'prospects', 'steve_discoveries'],
      limitPerSpec: 3,
      now: () => new Date('2026-07-11T00:00:00.000Z'),
      persistence: persistence as never,
    });

    expect(report.ok).toBe(true);
    expect(report.generatedAt).toBe('2026-07-11T00:00:00.000Z');
    expect(report.totals).toEqual({ specs: 3, scanned: 3, issues: 0, warnings: 0 });
    expect(report.specs.find((s) => s.key === 'members')?.rows[0]?.chroma.status).toBe(
      'not_applicable',
    );
    expect(persistence).toHaveBeenCalledWith(
      'mongodb',
      'query',
      expect.objectContaining({ collection: 'tmag_prospects', limit: 3 }),
    );
    expect(persistence).toHaveBeenCalledWith(
      'chromadb',
      'query_with_filter',
      expect.objectContaining({
        collection: 'mcs_prospect_invitation_activity',
        where: { prospectId: 'prospect_1' },
      }),
    );
  });

  it('uses tokenHash params for token-derived graph checks and excludes raw token values', async () => {
    const tokenHash = createHash('sha256').update('tok_1').digest('hex');
    const persistence = vi.fn(async (tool: string, action: string, params: AnyRec) => {
      if (tool === 'mongodb' && action === 'query') {
        if (params.collection === 'tmag_prospect_invite_tokens') {
          return { documents: [{ token: 'tok_1', prospectId: 'prospect_1' }], count: 1 };
        }
        return { documents: mongoDocuments(String(params.collection)), count: 1 };
      }
      if (tool === 'neo4j' && action === 'cypher') {
        const callParams = params as AnyRec;
        const query = String(callParams.query ?? '');
        if (query.includes('INVITED')) {
          expect(callParams.params).toMatchObject({ sponsorTmagId: 'TMAG-01', tokenHash });
          expect(callParams.params).not.toMatchObject({ token: 'tok_1' });
          expect(query).toContain('{tokenHash: $tokenHash}');
        }
        if (query.includes('TmagInviteToken')) {
          expect(callParams.params).toMatchObject({ tokenHash });
          expect(callParams.params).not.toMatchObject({ token: 'tok_1' });
          expect(query).toContain('{tokenHash: $tokenHash}');
        }
        return { records: [{ n: 1 }], summary: { counters: {} } };
      }
      if (tool === 'chromadb' && action === 'query_with_filter') {
        const where = params.where as AnyRec;
        const [field, value] = Object.entries(where)[0] ?? [];
        return {
          results: {
            ids: [String(value)],
            metadatas: [{ [String(field)]: value }],
          },
        };
      }
      throw new Error(`unexpected ${tool}.${action}`);
    });

    const report = await runCrossStoreReconciliation({
      specKeys: ['prospects', 'invite_tokens'],
      persistence: persistence as never,
      now: () => new Date('2026-07-11T00:00:00.000Z'),
      limitPerSpec: 2,
    });

    expect(report.ok).toBe(true);
    expect(report.totals.issues).toBe(0);
    expect(report.totals.scanned).toBe(2);
    expect(persistence).toHaveBeenCalledWith(
      'neo4j',
      'cypher',
      expect.objectContaining({
        query: expect.stringContaining('tokenHash'),
        params: expect.objectContaining({ tokenHash }),
      }),
    );
    expect(persistence).toHaveBeenCalledWith(
      'mongodb',
      'query',
      expect.objectContaining({ collection: 'tmag_prospect_invite_tokens' }),
    );
    const neoPayloads = persistence.mock.calls.filter((entry) => entry[0] === 'neo4j' && entry[1] === 'cypher');
    expect(
      neoPayloads.every(([, , callParams]) => !JSON.stringify(callParams.params).includes('tok_1')),
    ).toBe(true);
    expect(neoPayloads.length).toBe(2);
  });

  it('flags missing Neo4j and Chroma projections without hiding the Mongo sample', async () => {
    const persistence = vi.fn(async (tool: string, action: string, params: AnyRec) => {
      if (tool === 'mongodb' && action === 'query') {
        return { documents: mongoDocuments(String(params.collection)), count: 1 };
      }
      if (tool === 'neo4j' && action === 'cypher') {
        return { records: [{ n: 0 }], summary: { counters: {} } };
      }
      if (tool === 'chromadb' && action === 'query_with_filter') {
        return { results: { ids: [], metadatas: [] } };
      }
      throw new Error(`unexpected ${tool}.${action}`);
    });

    const report = await runCrossStoreReconciliation({
      specKeys: ['prospects'],
      persistence: persistence as never,
    });

    expect(report.ok).toBe(false);
    expect(report.totals.scanned).toBe(1);
    expect(report.totals.issues).toBe(2);
    expect(report.specs[0]?.rows[0]).toMatchObject({
      id: 'prospect_1',
      issues: ['neo4j_missing', 'chroma_missing'],
      neo4j: { status: 'missing' },
      chroma: { status: 'missing' },
    });
  });

  it('keeps store exceptions as report errors instead of throwing the whole job', async () => {
    const persistence = vi.fn(async (tool: string, action: string, params: AnyRec) => {
      if (tool === 'mongodb' && action === 'query') {
        return { documents: mongoDocuments(String(params.collection)), count: 1 };
      }
      if (tool === 'neo4j' && action === 'cypher') {
        throw new Error('neo4j unavailable');
      }
      if (tool === 'chromadb' && action === 'query_with_filter') {
        throw new Error('chroma unavailable');
      }
      throw new Error(`unexpected ${tool}.${action}`);
    });

    const report = await runCrossStoreReconciliation({
      specKeys: ['steve_discoveries'],
      persistence: persistence as never,
    });

    expect(report.ok).toBe(false);
    expect(report.totals.issues).toBe(2);
    expect(report.specs[0]?.rows[0]?.neo4j.detail).toBe('neo4j unavailable');
    expect(report.specs[0]?.rows[0]?.chroma.detail).toBe('chroma unavailable');
  });
});
