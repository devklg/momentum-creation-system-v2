import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  gatewayCall: vi.fn(),
  tripleStackWrite: vi.fn(),
  createInvitation: vi.fn(),
}));

vi.mock('../../services/gateway.js', () => ({
  gatewayCall: mocks.gatewayCall,
}));

vi.mock('../../services/tripleStack.js', () => ({
  tripleStackWrite: mocks.tripleStackWrite,
}));

vi.mock('../invitations.js', () => ({
  createInvitation: mocks.createInvitation,
}));

type AnyRec = Record<string, unknown>;

const IVORY_RECORD = {
  ivoryId: 'ivory_1',
  baId: 'TMBA-1',
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

/** Default gateway impl: returns the seeded ivory record for queries, ok for the rest. */
function defaultGateway(record: AnyRec | null = { ...IVORY_RECORD }) {
  return async (tool: string, action: string, params: AnyRec): Promise<unknown> => {
    if (tool === 'mongodb' && action === 'query') {
      if (params.collection === 'ivory_names') {
        return { count: record ? 1 : 0, documents: record ? [record] : [] };
      }
      return { count: 0, documents: [] };
    }
    return {};
  };
}

async function loadIvory() {
  return import('../ivory.js');
}

beforeEach(() => {
  vi.resetModules();
  mocks.gatewayCall.mockReset();
  mocks.tripleStackWrite.mockReset();
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
    mocks.gatewayCall.mockImplementation(async (tool: string, action: string, _params: AnyRec) => {
      if (tool === 'mongodb' && action === 'query') {
        return { count: 1, documents: [{ ...IVORY_RECORD }] };
      }
      if (tool === 'neo4j' && action === 'cypher') {
        throw new Error('neo4j bolt transient failure');
      }
      return {};
    });
    const ivory = await loadIvory();

    const res = await ivory.mintIvoryInvitation('TMBA-1', {
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
    mocks.gatewayCall.mockImplementation(defaultGateway());
    const ivory = await loadIvory();

    await ivory.markIvoryInvited('ivory_1', 'TMBA-1', 'P1');

    const neo = mocks.gatewayCall.mock.calls.find(
      ([tool, action]) => tool === 'neo4j' && action === 'cypher',
    );
    expect(neo).toBeDefined();
    const query = String((neo?.[2] as AnyRec).query);
    expect(query).toContain('MERGE (p:Prospect');
    expect(query).not.toContain('MATCH (p:Prospect');
    // SET on the IvoryName node must precede the prospect MERGE so a missing
    // prospect node cannot no-op the status update.
    expect(query.indexOf('SET n.status')).toBeGreaterThanOrEqual(0);
    expect(query.indexOf('SET n.status')).toBeLessThan(query.indexOf('MERGE (p:Prospect'));
  });

  it('#5 createIvoryName compensates the orphaned row when the write fails', async () => {
    mocks.gatewayCall.mockImplementation(defaultGateway());
    mocks.tripleStackWrite.mockRejectedValue(new Error('neo4j leg failed after mongo insert'));
    const ivory = await loadIvory();

    await expect(
      ivory.createIvoryName('TMBA-1', { firstName: 'Dana', lastName: 'Smith' } as never),
    ).rejects.toThrow(/neo4j leg failed/);

    const del = mocks.gatewayCall.mock.calls.find(
      ([tool, action]) => tool === 'mongodb' && action === 'delete',
    );
    const detach = mocks.gatewayCall.mock.calls.find(
      ([tool, action, p]) =>
        tool === 'neo4j' &&
        action === 'cypher' &&
        String((p as AnyRec).query).includes('DETACH DELETE'),
    );
    expect(del).toBeDefined();
    expect(del?.[2]).toMatchObject({ collection: 'ivory_names' });
    expect(detach).toBeDefined();
  });

  it('#6 updateIvoryName refreshes the Chroma doc with the edited fields', async () => {
    mocks.gatewayCall.mockImplementation(defaultGateway());
    const ivory = await loadIvory();

    await ivory.updateIvoryName('ivory_1', 'TMBA-1', { notes: 'brand new note' } as never);

    const chromaAdd = mocks.gatewayCall.mock.calls.find(
      ([tool, action]) => tool === 'chromadb' && action === 'add',
    );
    expect(chromaAdd).toBeDefined();
    const params = chromaAdd?.[2] as AnyRec;
    expect(params).toMatchObject({ collection: 'mcs_ivory', ids: ['ivory_1'] });
    expect(String((params.documents as string[])[0])).toContain('brand new note');
  });
});
