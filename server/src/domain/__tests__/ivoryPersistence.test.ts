import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  persistenceCall: vi.fn(),
  tripleStackWrite: vi.fn(),
  writeGraphCritical: vi.fn(),
  createInvitation: vi.fn(),
}));

vi.mock('../../services/persistence/dispatch.js', () => ({
  persistenceCall: mocks.persistenceCall,
}));

vi.mock('../../services/tripleStack.js', () => ({
  tripleStackWrite: mocks.tripleStackWrite,
}));

vi.mock('../../services/tieredWrite.js', () => ({
  writeGraphCritical: mocks.writeGraphCritical,
}));

vi.mock('../invitations.js', () => ({
  createInvitation: mocks.createInvitation,
}));

type AnyRec = Record<string, unknown>;

const IVORY_RECORD = {
  ivoryId: 'ivory_1',
  tmagId: 'TMAG-1',
  firstName: 'Dana',
  lastName: 'Smith',
  lastInitial: 'S',
  notes: 'old note',
  categories: ['friend'],
  preferredAngle: 'do_the_business',
  status: 'new',
  lastProspectId: null,
  lastTouchedAt: '2026-06-01T00:00:00.000Z',
  createdAt: '2026-06-01T00:00:00.000Z',
  updatedAt: '2026-06-01T00:00:00.000Z',
};

/** Default PERSISTENCE impl: returns the seeded ivory record for queries, ok for the rest. */
function defaultPersistence(record: AnyRec | null = { ...IVORY_RECORD }) {
  return async (tool: string, action: string, params: AnyRec): Promise<unknown> => {
    if (tool === 'mongodb' && action === 'query') {
      if (params.collection === 'tmag_ivory_prospect_names') {
        return { count: record ? 1 : 0, documents: record ? [record] : [] };
      }
      return { count: 0, documents: [] };
    }
    if (tool === 'mongodb' && action === 'update') {
      return { matchedCount: 1, modifiedCount: 1 };
    }
    return {};
  };
}

async function loadIvory() {
  return import('../ivory.js');
}

beforeEach(() => {
  vi.resetModules();
  mocks.persistenceCall.mockReset();
  mocks.tripleStackWrite.mockReset();
  mocks.writeGraphCritical.mockReset();
  mocks.writeGraphCritical.mockResolvedValue({
    tier: 'graph_critical',
    id: 'ivory_test',
    mongo: { ok: true, verified: true },
    neo4j: { ok: true, verified: true },
  });
  mocks.createInvitation.mockReset();
});

describe('Ivory persistence fixes', () => {
  it('#1 mint stays successful even if the roster linkage write fails (no double-mint)', async () => {
    mocks.createInvitation.mockResolvedValue({
      prospectId: 'P1',
      token: 'T1',
      inviteUrl: 'https://teammagnificent.com/p/T1',
      createdAt: '2026-07-01T00:00:00.000Z',
      expiresAt: '2026-07-08T00:00:00.000Z',
      message: 'Hey Dana',
    });
    // getIvoryName query returns the record; the neo4j leg of markIvoryInvited throws.
    mocks.persistenceCall.mockImplementation(async (tool: string, action: string, _params: AnyRec) => {
      if (tool === 'mongodb' && action === 'query') {
        return { count: 1, documents: [{ ...IVORY_RECORD }] };
      }
      if (tool === 'mongodb' && action === 'update') {
        return { matchedCount: 1 };
      }
      if (tool === 'neo4j' && action === 'cypher') {
        throw new Error('neo4j bolt transient failure');
      }
      return {};
    });
    const ivory = await loadIvory();

    const res = await ivory.mintIvoryInvitation('TMAG-1', {
      ivoryId: 'ivory_1',
      relationshipReason: 'old friend',
      message: 'Hey Dana',
      city: 'Dallas',
      stateOrRegion: 'TX',
      phone: '2125551234',
      email: null,
    } as never);

    expect(res.ok).toBe(true);
    expect(res.token).toBe('T1');
    expect(mocks.createInvitation).toHaveBeenCalledTimes(1);
  });

  it('#3 markIvoryInvited SETs status before MERGE-ing the prospect node', async () => {
    mocks.persistenceCall.mockImplementation(defaultPersistence());
    const ivory = await loadIvory();

    await ivory.markIvoryInvited('ivory_1', 'TMAG-1', 'P1');

    const neo = mocks.persistenceCall.mock.calls.find(
      ([tool, action]) => tool === 'neo4j' && action === 'cypher',
    );
    expect(neo).toBeDefined();
    const query = String((neo?.[2] as AnyRec).query);
    expect(query).toContain('MERGE (p:TmagProspect');
    expect(query).not.toContain('MATCH (p:TmagProspect');
    // SET on the IvoryName node must precede the prospect MERGE so a missing
    // prospect node cannot no-op the status update.
    expect(query.indexOf('SET n.status')).toBeGreaterThanOrEqual(0);
    expect(query.indexOf('SET n.status')).toBeLessThan(query.indexOf('MERGE (p:TmagProspect'));
  });

  it('#5 createIvoryName uses graph-critical rollback/readback semantics', async () => {
    mocks.persistenceCall.mockImplementation(defaultPersistence());
    const ivory = await loadIvory();

    await ivory.createIvoryName('TMAG-1', { firstName: 'Dana', lastName: 'Smith' } as never);

    const call = mocks.writeGraphCritical.mock.calls[0]?.[0] as AnyRec | undefined;
    expect(call).toBeDefined();
    expect(call?.mongoCollection).toBe('tmag_ivory_prospect_names');
    const neo4j = call?.neo4j as AnyRec | undefined;
    expect(String(neo4j?.cypher)).toContain('MATCH (b:TeamMagnificentMember {tmagId: $tmagId})');
    expect(String(neo4j?.cypher)).not.toContain('MERGE (b:TeamMagnificentMember');
    expect(String(neo4j?.verifyCypher)).toContain('RETURN count(n) AS n');
    expect(neo4j?.verifyParams).toMatchObject({ tmagId: 'TMAG-1' });
  });

  it('#6 updateIvoryName refreshes the Chroma doc with the edited fields', async () => {
    mocks.persistenceCall.mockImplementation(defaultPersistence());
    const ivory = await loadIvory();

    await ivory.updateIvoryName('ivory_1', 'TMAG-1', { notes: 'brand new note' } as never);

    const chromaAdd = mocks.persistenceCall.mock.calls.find(
      ([tool, action]) => tool === 'chromadb' && action === 'add',
    );
    expect(chromaAdd).toBeDefined();
    const params = chromaAdd?.[2] as AnyRec;
    expect(params).toMatchObject({ collection: 'mcs_ivory_prospect_names', ids: ['ivory_1'] });
    expect(String((params.documents as string[])[0])).toContain('brand new note');
  });

  it('deferred #1: updateIvoryStatus rejects a bare "invited" transition', async () => {
    mocks.persistenceCall.mockImplementation(defaultPersistence());
    const ivory = await loadIvory();

    await expect(
      ivory.updateIvoryStatus('ivory_1', 'TMAG-1', 'invited' as never),
    ).rejects.toBeInstanceOf(ivory.IvoryValidationError);
  });

  it('deferred #2: updateIvoryStatus throws NotFound when the row vanished (0-match)', async () => {
    mocks.persistenceCall.mockImplementation(async (tool: string, action: string, _p: AnyRec) => {
      if (tool === 'mongodb' && action === 'query') {
        return { count: 1, documents: [{ ...IVORY_RECORD }] };
      }
      if (tool === 'mongodb' && action === 'update') return { matchedCount: 0 };
      return {};
    });
    const ivory = await loadIvory();

    await expect(
      ivory.updateIvoryStatus('ivory_1', 'TMAG-1', 'customer' as never),
    ).rejects.toBeInstanceOf(ivory.IvoryNotFoundError);
  });

  it('deferred #2: updateIvoryName throws NotFound on a 0-match update', async () => {
    mocks.persistenceCall.mockImplementation(async (tool: string, action: string, _p: AnyRec) => {
      if (tool === 'mongodb' && action === 'query') {
        return { count: 1, documents: [{ ...IVORY_RECORD }] };
      }
      if (tool === 'mongodb' && action === 'update') return { matchedCount: 0 };
      return {};
    });
    const ivory = await loadIvory();

    await expect(
      ivory.updateIvoryName('ivory_1', 'TMAG-1', { notes: 'x' } as never),
    ).rejects.toBeInstanceOf(ivory.IvoryNotFoundError);
  });

  it('deferred #2: markIvoryInvited throws NotFound on a 0-match update', async () => {
    mocks.persistenceCall.mockImplementation(async (tool: string, action: string, _p: AnyRec) => {
      if (tool === 'mongodb' && action === 'query') {
        return { count: 1, documents: [{ ...IVORY_RECORD }] };
      }
      if (tool === 'mongodb' && action === 'update') return { matchedCount: 0 };
      return {};
    });
    const ivory = await loadIvory();

    await expect(
      ivory.markIvoryInvited('ivory_1', 'TMAG-1', 'P1'),
    ).rejects.toBeInstanceOf(ivory.IvoryNotFoundError);
  });

  it('deferred #6: ANGLE_LABEL is a single shared canonical map', async () => {
    const { ANGLE_LABEL } = await import('../ivoryAngle.js');
    expect(ANGLE_LABEL.make_money).toBe('a real way to make money');
    expect(Object.keys(ANGLE_LABEL).sort()).toEqual([
      'do_the_business',
      'lose_fat',
      'make_money',
      'unspecified',
    ]);
  });
});
