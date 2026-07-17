import { describe, expect, it, vi } from 'vitest';
import {
  observeKongaPageVisit,
  readKongaPageVisit,
} from '../kongaVisits.js';

describe('Konga reconnect-safe page visits', () => {
  it('returns null for first visit, advances once for a later visit, and keeps reconnect read-only', async () => {
    const docs = new Map<string, Record<string, unknown>>();
    let writes = 0;
    const persistence = vi.fn(async (_tool: string, action: string, params: Record<string, unknown>) => {
      if (action !== 'query') return {};
      const filter = params.filter as Record<string, unknown>;
      if (typeof filter._id === 'string') {
        const doc = docs.get(filter._id);
        return { documents: doc ? [doc] : [] };
      }
      const latest = [...docs.values()].sort((a, b) =>
        String(b.observedAt).localeCompare(String(a.observedAt)),
      )[0];
      return { documents: latest ? [latest] : [] };
    });
    const strictWrite = vi.fn(async (input: { id: string; mongoDoc: Record<string, unknown> }) => {
      writes += 1;
      docs.set(input.id, { _id: input.id, ...input.mongoDoc });
      return { mongo: input.mongoDoc, neo4jCount: 1, chromaId: input.id };
    });
    const strictVerify = vi.fn(async () => ({ mongo: {}, neo4jCount: 1, chromaId: 'x' }));

    const first = await observeKongaPageVisit(
      {
        token: 'TOKEN-ONE',
        pageVisitId: '11111111-1111-4111-8111-111111111111',
        globalMaxPosition: 25,
        now: new Date('2026-07-17T10:00:00.000Z'),
      },
      { persistence: persistence as never, strictWrite: strictWrite as never, strictVerify },
    );
    expect(first.sinceLastVisit).toBeNull();

    const retry = await observeKongaPageVisit(
      {
        token: 'TOKEN-ONE',
        pageVisitId: '11111111-1111-4111-8111-111111111111',
        globalMaxPosition: 99,
        now: new Date('2026-07-17T10:01:00.000Z'),
      },
      { persistence: persistence as never, strictWrite: strictWrite as never, strictVerify },
    );
    expect(retry.observedGlobalPosition).toBe(25);
    expect(writes).toBe(1);

    const later = await observeKongaPageVisit(
      {
        token: 'TOKEN-ONE',
        pageVisitId: '22222222-2222-4222-8222-222222222222',
        globalMaxPosition: 31,
        now: new Date('2026-07-18T10:00:00.000Z'),
      },
      { persistence: persistence as never, strictWrite: strictWrite as never, strictVerify },
    );
    expect(later.sinceLastVisit).toBe(6);
    expect(writes).toBe(2);

    const writesBeforeReconnect = writes;
    const reconnect = await readKongaPageVisit(
      'TOKEN-ONE',
      later.pageVisitId,
      persistence as never,
    );
    expect(reconnect?.sinceLastVisit).toBe(6);
    expect(writes).toBe(writesBeforeReconnect);
  });

  it('binds the same UUID independently to each token', async () => {
    const writes: string[] = [];
    const persistence = vi.fn(async () => ({ documents: [] }));
    const strictWrite = vi.fn(async (input: { id: string }) => {
      writes.push(input.id);
      return { mongo: {}, neo4jCount: 1, chromaId: input.id };
    });
    const pageVisitId = '33333333-3333-4333-8333-333333333333';
    await observeKongaPageVisit(
      { token: 'TOKEN-A', pageVisitId, globalMaxPosition: 1 },
      { persistence: persistence as never, strictWrite: strictWrite as never },
    );
    await observeKongaPageVisit(
      { token: 'TOKEN-B', pageVisitId, globalMaxPosition: 1 },
      { persistence: persistence as never, strictWrite: strictWrite as never },
    );
    expect(writes[0]).not.toBe(writes[1]);
  });
});
