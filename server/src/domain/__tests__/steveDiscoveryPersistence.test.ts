import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  persistenceCall: vi.fn(),
  writeKnowledge: vi.fn(),
}));

vi.mock('../../services/persistence/dispatch.js', () => ({
  persistenceCall: mocks.persistenceCall,
}));

vi.mock('../../services/tieredWrite.js', () => ({
  writeKnowledge: mocks.writeKnowledge,
}));

type AnyRec = Record<string, unknown>;

interface Store {
  ba: AnyRec | null;
  discovery: (AnyRec & { _id: string }) | null;
}

interface PersistenceOpts {
  /** list_collections throws on the first N calls, then succeeds. */
  listCollectionsFailFirst?: number;
  /** mongodb.update becomes a no-op (does not apply $set) — simulates a
   *  silently-modified-nothing update. */
  updateNoop?: boolean;
}

function makePersistenceImpl(store: Store, opts: PersistenceOpts = {}) {
  let listCalls = 0;
  return async (tool: string, action: string, params: AnyRec): Promise<unknown> => {
    if (tool === 'mongodb' && action === 'query') {
      const col = params.collection;
      if (col === 'team_magnificent_members') return { documents: store.ba ? [store.ba] : [] };
      if (col === 'tmag_steve_success_interview') {
        return { documents: store.discovery ? [store.discovery] : [] };
      }
      return { documents: [] };
    }
    if (tool === 'mongodb' && action === 'update') {
      if (!opts.updateNoop && store.discovery) {
        const set = (params.update as AnyRec | undefined)?.$set as AnyRec | undefined;
        store.discovery = { ...store.discovery, ...(set ?? {}) };
      }
      return { matchedCount: 1 };
    }
    if (tool === 'neo4j' && action === 'cypher') return {};
    if (tool === 'chromadb' && action === 'list_collections') {
      listCalls += 1;
      if (opts.listCollectionsFailFirst && listCalls <= opts.listCollectionsFailFirst) {
        throw new Error('chroma list_collections transient failure');
      }
      return { collections: [{ name: 'mcs_steve_success_interview' }] };
    }
    if (tool === 'chromadb' && action === 'create_collection') return {};
    if (tool === 'chromadb' && action === 'add') return { ok: true };
    return {};
  };
}

function makePayload(overrides: AnyRec = {}) {
  return {
    tmagId: 'TMAG-1',
    callSid: 'CA-1',
    startedAt: '2026-07-01T00:00:00.000Z',
    completedAt: '2026-07-01T00:10:00.000Z',
    transcript: [
      { sequence: 1, speaker: 'steve', text: 'hi', occurredAt: '2026-07-01T00:00:01.000Z' },
    ],
    answers: [{ questionId: 'q_welcome_intro', prompt: 'p', answerText: 'a' }],
    audioUrl: null,
    profile: {
      primaryWhy: { statement: 'family', who: 'kids', whyNow: 'now' },
      successVision: { statement: 'freedom', oneBigChange: 'time' },
      learningStyle: { modalities: ['doing'], feedbackPreference: 'direct', notes: '' },
      communicationPreferences: {
        preferredChannels: ['text'],
        cadence: 'weekly',
        bestTimes: 'evenings',
        notes: '',
      },
      supportNeeds: { areas: ['tech'], potentialObstacles: ['time'], helpStyle: 'ask', notes: '' },
      launchRecommendations: [],
      trainingRecommendations: [],
      michaelHandoffSummary: '',
    },
    ...overrides,
  } as never;
}

const BA = { tmagId: 'TMAG-1', sponsorTmagId: 'TMAG-0', firstName: 'Kev' };

async function loadSteve() {
  return import('../steve-success-interview.js');
}

beforeEach(() => {
  vi.resetModules();
  mocks.persistenceCall.mockReset();
  mocks.writeKnowledge.mockReset();
  mocks.writeKnowledge.mockImplementation(async (input: { id: string; mongoDoc: AnyRec }) => {
    return {
      tier: 'knowledge',
      id: input.id,
      mongo: { ok: true, verified: true },
    };
  });
});

describe('Steve ingestDiscoveryArtifact — persistence fixes', () => {
  it('re-ingest (existing row) refreshes the Chroma semantic doc', async () => {
    const store: Store = {
      ba: { ...BA },
      discovery: { _id: 'SD-TMAG-1', tmagId: 'TMAG-1', completedAt: '2026-06-01T00:00:00.000Z' },
    };
    mocks.persistenceCall.mockImplementation(makePersistenceImpl(store));
    const steve = await loadSteve();

    await steve.ingestDiscoveryArtifact(makePayload());

    const chromaAdd = mocks.persistenceCall.mock.calls.find(
      ([tool, action]) => tool === 'chromadb' && action === 'add',
    );
    expect(chromaAdd).toBeDefined();
    expect(chromaAdd?.[2]).toMatchObject({
      collection: 'mcs_steve_success_interview',
      ids: ['SD-TMAG-1'],
      metadatas: [
        {
          discoveryId: 'SD-TMAG-1',
          ownerTmagId: 'TMAG-1',
          kind: 'steve_discovery',
          retrievalEligible: false,
        },
      ],
    });
    expect(JSON.stringify(chromaAdd?.[2])).not.toContain('callSid');
    expect(JSON.stringify(chromaAdd?.[2])).not.toContain('sponsorTmagId');
    expect(JSON.stringify(chromaAdd?.[2])).not.toContain('Primary why');
    expect(JSON.stringify(chromaAdd?.[2])).not.toContain('Success vision');
    expect(JSON.stringify(chromaAdd?.[2])).not.toContain('Learns by');
    expect(JSON.stringify(chromaAdd?.[2])).not.toContain('Support areas');
    expect(JSON.stringify(chromaAdd?.[2])).toContain(
      'Profile content is canonical in MongoDB.',
    );

    const graphWrite = mocks.persistenceCall.mock.calls.find(
      ([tool, action]) => tool === 'neo4j' && action === 'cypher',
    );
    expect(JSON.stringify(graphWrite?.[2])).not.toContain('callSid');
    expect(JSON.stringify(graphWrite?.[2])).not.toContain('audioUrl');
  });

  it('read-back throws READBACK_FAILED when the update did not apply content', async () => {
    const store: Store = {
      ba: { ...BA },
      discovery: { _id: 'SD-TMAG-1', tmagId: 'TMAG-1', completedAt: '2026-06-01T00:00:00.000Z' },
    };
    // updateNoop: the row exists but completedAt never advances to this ingest.
    mocks.persistenceCall.mockImplementation(makePersistenceImpl(store, { updateNoop: true }));
    const steve = await loadSteve();

    await expect(steve.ingestDiscoveryArtifact(makePayload())).rejects.toMatchObject({
      code: 'READBACK_FAILED',
    });
  });

  it('TOCTOU: a raced duplicate insert falls back to the update path (no throw)', async () => {
    const store: Store = { ba: { ...BA }, discovery: null };
    mocks.persistenceCall.mockImplementation(makePersistenceImpl(store));
    // Simulate a concurrent writer: writeKnowledge lands the row then the
    // insert rejects on the duplicate _id.
    mocks.writeKnowledge.mockImplementation(async (input: { id: string; mongoDoc: AnyRec }) => {
      store.discovery = { _id: input.id, ...input.mongoDoc };
      throw new Error('E11000 duplicate key');
    });
    const steve = await loadSteve();

    const artifact = await steve.ingestDiscoveryArtifact(makePayload());
    expect(artifact.tmagId).toBe('TMAG-1');

    const updateCall = mocks.persistenceCall.mock.calls.find(
      ([tool, action]) => tool === 'mongodb' && action === 'update',
    );
    expect(updateCall).toBeDefined();
  });

  it('bootstrap self-heals: a transient list_collections failure does not poison later ingests', async () => {
    const store: Store = { ba: { ...BA }, discovery: null };
    mocks.persistenceCall.mockImplementation(
      makePersistenceImpl(store, { listCollectionsFailFirst: 1 }),
    );
    mocks.writeKnowledge.mockImplementation(async (input: { id: string; mongoDoc: AnyRec }) => {
      store.discovery = { _id: input.id, ...input.mongoDoc };
      return { mongo: { ok: true }, neo4j: { ok: true }, chroma: { ok: true, verified: true } };
    });
    const steve = await loadSteve();

    // First ingest fails inside ensureDiscoveriesCollection.
    await expect(steve.ingestDiscoveryArtifact(makePayload())).rejects.toThrow(
      /list_collections/,
    );
    // Second ingest must succeed — the rejected bootstrap promise was NOT cached.
    const artifact = await steve.ingestDiscoveryArtifact(makePayload());
    expect(artifact.tmagId).toBe('TMAG-1');
  });

  it('assembleSuccessProfile caps long free-text fields to 5000 chars', async () => {
    const steve = await loadSteve();
    const long = 'x'.repeat(6000);
    const profile = steve.assembleSuccessProfile({
      tmagId: 'TMAG-1',
      generatedAt: '2026-07-01T00:00:00.000Z',
      profile: {
        primaryWhy: { statement: long, who: 'kids', whyNow: 'now' },
        successVision: { statement: long, oneBigChange: 'time' },
        learningStyle: { modalities: ['doing'], feedbackPreference: 'direct', notes: long },
        communicationPreferences: {
          preferredChannels: ['text'],
          cadence: 'weekly',
          bestTimes: 'eve',
          notes: '',
        },
        supportNeeds: { areas: [long], potentialObstacles: [], helpStyle: 'ask', notes: long },
        launchRecommendations: [{ text: long, href: null }],
        trainingRecommendations: [],
        michaelHandoffSummary: long,
      },
    } as never);

    expect(profile.primaryWhy.statement.length).toBe(5000);
    expect(profile.successVision.statement.length).toBe(5000);
    expect(profile.supportNeeds.notes.length).toBe(5000);
    expect(profile.supportNeeds.areas[0]?.length).toBe(5000);
    expect(profile.launchRecommendations[0]?.text.length).toBe(5000);
    expect(profile.michaelHandoffSummary.length).toBe(5000);
  });
});
