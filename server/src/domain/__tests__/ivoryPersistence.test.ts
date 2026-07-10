import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  persistenceCall: vi.fn(),
  tripleStackWrite: vi.fn(),
  createInvitation: vi.fn(),
  complete: vi.fn(),
  appendRuntimeContextTrace: vi.fn(),
}));

vi.mock('../../services/persistence/dispatch.js', () => ({
  persistenceCall: mocks.persistenceCall,
}));

vi.mock('../../services/tripleStack.js', () => ({
  tripleStackWrite: mocks.tripleStackWrite,
}));

vi.mock('../invitations.js', () => ({
  createInvitation: mocks.createInvitation,
}));

vi.mock('../../services/anthropic.js', () => ({
  complete: mocks.complete,
  AnthropicConfigError: class AnthropicConfigError extends Error {},
  AnthropicError: class AnthropicError extends Error {},
}));

vi.mock('../../services/masterContent.js', () => ({
  readMasterContent: vi.fn(async () => 'Use Kevin-approved Team Magnificent tone.'),
  interpolateMasterContent: vi.fn((template: string) => template),
}));

vi.mock('../../services/runtimeContextTrace.js', () => ({
  appendRuntimeContextTrace: mocks.appendRuntimeContextTrace,
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
  mocks.createInvitation.mockReset();
  mocks.complete.mockReset();
  mocks.appendRuntimeContextTrace.mockReset();
  mocks.appendRuntimeContextTrace.mockResolvedValue({ traceId: 'ctx_trace_ivory_test' });
  vi.unstubAllEnvs();
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

  it('#5 createIvoryName compensates the orphaned row when the write fails', async () => {
    mocks.persistenceCall.mockImplementation(defaultPersistence());
    mocks.tripleStackWrite.mockRejectedValue(new Error('neo4j leg failed after mongo insert'));
    const ivory = await loadIvory();

    await expect(
      ivory.createIvoryName('TMAG-1', { firstName: 'Dana', lastName: 'Smith' } as never),
    ).rejects.toThrow(/neo4j leg failed/);

    const del = mocks.persistenceCall.mock.calls.find(
      ([tool, action]) => tool === 'mongodb' && action === 'delete',
    );
    const detach = mocks.persistenceCall.mock.calls.find(
      ([tool, action, p]) =>
        tool === 'neo4j' &&
        action === 'cypher' &&
        String((p as AnyRec).query).includes('DETACH DELETE'),
    );
    expect(del).toBeDefined();
    expect(del?.[2]).toMatchObject({ collection: 'tmag_ivory_prospect_names' });
    expect(detach).toBeDefined();
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

  it('Ivory coach requests and traces a Context Manager packet when tmagId is present', async () => {
    vi.stubEnv('IVORY_CONTEXT_MANAGER_LIVE_ENABLED', 'false');
    mocks.complete.mockResolvedValue({
      text: JSON.stringify({
        coaching: 'Let your memory move through the people you already know.',
        prompts: [
          'Who have you not checked in with lately?',
          'Who has asked what you are working on?',
          'Who would appreciate a low-pressure share?',
        ],
      }),
    });
    const ivory = await loadIvory();

    await ivory.ivoryCoach({
      tmagId: 'TMAG-1',
      angle: 'do_the_business',
      rosterSize: 3,
      ask: 'church friends',
    });

    expect(mocks.appendRuntimeContextTrace).toHaveBeenCalledWith(expect.objectContaining({
      agentKey: 'ivory',
      taskType: 'relationship_coaching',
      runtimeSurface: 'ivory-coach',
      tmagId: 'TMAG-1',
      responseType: 'reflection_prompt',
    }));
    expect(String(mocks.complete.mock.calls[0]?.[0]?.system)).toContain(
      'APPROVED CONTEXT MANAGER KNOWLEDGE',
    );
  });

  it('Ivory invitation draft requests and traces a Context Manager packet', async () => {
    vi.stubEnv('IVORY_CONTEXT_MANAGER_LIVE_ENABLED', 'false');
    mocks.persistenceCall.mockImplementation(defaultPersistence());
    mocks.complete.mockResolvedValue({ text: 'Hey Dana, I thought of you when I saw this. Can I send it?' });
    const ivory = await loadIvory();

    await ivory.draftIvoryInvitation('TMAG-1', {
      ivoryId: 'ivory_1',
      relationshipReason: 'old friend from work',
      productName: 'GLP THREE',
    } as never);

    expect(mocks.appendRuntimeContextTrace).toHaveBeenCalledWith(expect.objectContaining({
      agentKey: 'ivory',
      taskType: 'invitation_drafting',
      runtimeSurface: 'ivory-invitation-draft',
      tmagId: 'TMAG-1',
      responseType: 'editable_invitation_draft',
    }));
    expect(String(mocks.complete.mock.calls[0]?.[0]?.system)).toContain(
      'APPROVED CONTEXT MANAGER KNOWLEDGE',
    );
  });
});
