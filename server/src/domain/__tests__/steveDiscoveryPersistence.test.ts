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
  events?: AnyRec[];
}

interface PersistenceOpts {
  /** list_collections throws on the first N calls, then succeeds. */
  listCollectionsFailFirst?: number;
  leaveEventPayloadAfterUpdate?: boolean;
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
      if (col === 'tmag_agent_steve_events') {
        const filter = (params.filter as AnyRec | undefined) ?? {};
        const residualOnly = Array.isArray(filter.$or);
        const events = store.events ?? [];
        const documents = events
          .filter(
            (event) =>
              event.tmagId === filter.tmagId &&
              event.agentId === filter.agentId &&
              event.kind === filter.kind,
          )
          .filter((event) => {
            if (!residualOnly) return true;
            const compaction = event.contentCompaction as AnyRec | undefined;
            return (
              event.payload !== undefined ||
              compaction?.state !== 'compacted' ||
              compaction?.policyVersion !== 'acr-0031.v1' ||
              compaction?.discoveryId !== 'SD-TMAG-1' ||
              compaction?.boundaryCompletedAt !== '2026-07-01T00:10:00.000Z'
            );
          });
        return { documents, count: documents.length };
      }
      return { documents: [] };
    }
    if (
      tool === 'mongodb' &&
      action === 'update' &&
      params.collection === 'tmag_agent_steve_events'
    ) {
      const events = store.events ?? [];
      const filter = (params.filter as AnyRec | undefined) ?? {};
      const compaction = ((params.update as AnyRec | undefined)?.$set as AnyRec | undefined)
        ?.contentCompaction as AnyRec | undefined;
      for (const event of events) {
        if (
          event.tmagId !== filter.tmagId ||
          event.agentId !== filter.agentId ||
          event.kind !== filter.kind
        ) {
          continue;
        }
        if (!opts.leaveEventPayloadAfterUpdate) delete event.payload;
        event.contentCompaction = { ...compaction };
      }
      const matchedCount = events.filter(
        (event) =>
          event.tmagId === filter.tmagId &&
          event.agentId === filter.agentId &&
          event.kind === filter.kind,
      ).length;
      return { matchedCount, modifiedCount: matchedCount };
    }
    if (tool === 'mongodb' && action === 'update') {
      return { matchedCount: 1, modifiedCount: 1 };
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
  it('rejects ordinary re-ingest without mutating any store', async () => {
    const store: Store = {
      ba: { ...BA },
      discovery: { _id: 'SD-TMAG-1', tmagId: 'TMAG-1', completedAt: '2026-06-01T00:00:00.000Z' },
    };
    mocks.persistenceCall.mockImplementation(makePersistenceImpl(store));
    const steve = await loadSteve();

    await expect(steve.ingestDiscoveryArtifact(makePayload())).rejects.toMatchObject({
      code: 'ALREADY_EXISTS',
    });
    expect(mocks.writeKnowledge).not.toHaveBeenCalled();
    expect(
      mocks.persistenceCall.mock.calls.filter(
        ([tool, action]) =>
          (tool === 'mongodb' && action === 'update') ||
          (tool === 'neo4j' && action === 'cypher') ||
          (tool === 'chromadb' && action === 'add'),
      ),
    ).toEqual([]);
  });

  it('stores a private, consent-off marker with no provider/audio or sponsor visibility projection', async () => {
    const store: Store = { ba: { ...BA }, discovery: null };
    mocks.persistenceCall.mockImplementation(makePersistenceImpl(store));
    mocks.writeKnowledge.mockImplementation(async (input: { id: string; mongoDoc: AnyRec }) => {
      store.discovery = { _id: input.id, ...input.mongoDoc };
      return { mongo: { ok: true }, neo4j: { ok: true }, chroma: { ok: true, verified: true } };
    });
    const steve = await loadSteve();

    const artifact = await steve.ingestDiscoveryArtifact(
      makePayload({ callSid: 'CA-private', audioUrl: 'https://private.example/audio' }),
    );

    const write = mocks.writeKnowledge.mock.calls[0]?.[0] as { mongoDoc?: AnyRec } | undefined;
    expect(write?.mongoDoc).toMatchObject({
      callSid: null,
      audioUrl: null,
      privacy: {
        policyVersion: 'acr-0031.v1',
        status: 'active',
        withdrawnAt: null,
        sponsorConsent: {
          why_statement: { granted: false },
          success_vision: { granted: false },
          support_obstacles: { granted: false },
          michael_handoff_summary: { granted: false },
        },
      },
      eventBodyCompaction: {
        eligible: true,
        policyVersion: 'acr-0031.v1',
        eventKind: 'discovery_chat_message',
        boundaryCompletedAt: '2026-07-01T00:10:00.000Z',
        scope: 'new_record_only',
      },
    });
    expect(artifact.callSid).toBeNull();
    expect(artifact.audioUrl).toBeNull();
    const serializedWrite = JSON.stringify(mocks.writeKnowledge.mock.calls[0]?.[0]);
    expect(serializedWrite).not.toContain('CA-private');
    expect(serializedWrite).not.toContain('https://private.example/audio');
    expect(serializedWrite).not.toContain('VISIBLE_TO_SPONSOR');
    expect(serializedWrite).toContain('HAD_STEVE_DISCOVERY');
    expect(serializedWrite).toContain('Profile content is canonical in MongoDB.');
  });

  it('compacts private event bodies only after the canonical artifact reads back', async () => {
    const store: Store = {
      ba: { ...BA },
      discovery: null,
      events: [
        {
          _id: 'event-1',
          tmagId: 'TMAG-1',
          agentId: 'steve',
          kind: 'discovery_chat_message',
          payload: { role: 'ba', text: 'private answer', seq: 0 },
        },
        {
          _id: 'event-2',
          tmagId: 'TMAG-1',
          agentId: 'steve',
          kind: 'discovery_chat_message',
          payload: { role: 'steve', text: 'private prompt', seq: 1 },
        },
        {
          _id: 'event-unrelated',
          tmagId: 'TMAG-2',
          agentId: 'steve',
          kind: 'discovery_chat_message',
          payload: { role: 'ba', text: 'other BA private answer', seq: 0 },
        },
      ],
    };
    mocks.persistenceCall.mockImplementation(makePersistenceImpl(store));
    mocks.writeKnowledge.mockImplementation(async (input: { id: string; mongoDoc: AnyRec }) => {
      store.discovery = { _id: input.id, ...input.mongoDoc };
      return { mongo: { ok: true }, neo4j: { ok: true }, chroma: { ok: true, verified: true } };
    });
    const steve = await loadSteve();

    await steve.ingestDiscoveryArtifact(makePayload());

    expect(store.events).toEqual([
      expect.objectContaining({
        _id: 'event-1',
        contentCompaction: expect.objectContaining({
          state: 'compacted',
          policyVersion: 'acr-0031.v1',
          discoveryId: 'SD-TMAG-1',
          boundaryCompletedAt: '2026-07-01T00:10:00.000Z',
        }),
      }),
      expect.objectContaining({
        _id: 'event-2',
        contentCompaction: expect.objectContaining({
          state: 'compacted',
          policyVersion: 'acr-0031.v1',
          discoveryId: 'SD-TMAG-1',
        }),
      }),
      expect.objectContaining({
        _id: 'event-unrelated',
        payload: { role: 'ba', text: 'other BA private answer', seq: 0 },
      }),
    ]);
    expect(store.events?.[0]?.payload).toBeUndefined();
    expect(store.events?.[1]?.payload).toBeUndefined();
    expect(store.events?.[2]?.payload).toBeDefined();

    const discoveryReadbackOrder = Math.max(
      ...mocks.persistenceCall.mock.calls
        .map((call, index) => ({ call, order: mocks.persistenceCall.mock.invocationCallOrder[index] ?? 0 }))
        .filter(
          ({ call }) =>
            call[0] === 'mongodb' &&
            call[1] === 'query' &&
            (call[2] as AnyRec).collection === 'tmag_steve_success_interview' &&
            store.discovery !== null,
        )
        .map(({ order }) => order),
    );
    const compactionUpdateIndex = mocks.persistenceCall.mock.calls.findIndex(
      ([tool, action, params]) =>
        tool === 'mongodb' &&
        action === 'update' &&
        (params as AnyRec).collection === 'tmag_agent_steve_events',
    );
    expect(compactionUpdateIndex).toBeGreaterThanOrEqual(0);
    expect(
      mocks.persistenceCall.mock.invocationCallOrder[compactionUpdateIndex] ?? 0,
    ).toBeGreaterThan(discoveryReadbackOrder);
    expect(
      mocks.persistenceCall.mock.invocationCallOrder[compactionUpdateIndex] ?? 0,
    ).toBeGreaterThan(mocks.writeKnowledge.mock.invocationCallOrder[0] ?? 0);
  });

  it('fails closed when event compaction does not read back', async () => {
    const store: Store = {
      ba: { ...BA },
      discovery: null,
      events: [
        {
          _id: 'event-1',
          tmagId: 'TMAG-1',
          agentId: 'steve',
          kind: 'discovery_chat_message',
          payload: { role: 'ba', text: 'private answer', seq: 0 },
        },
      ],
    };
    mocks.persistenceCall.mockImplementation(
      makePersistenceImpl(store, { leaveEventPayloadAfterUpdate: true }),
    );
    mocks.writeKnowledge.mockImplementation(async (input: { id: string; mongoDoc: AnyRec }) => {
      store.discovery = { _id: input.id, ...input.mongoDoc };
      return { mongo: { ok: true }, neo4j: { ok: true }, chroma: { ok: true, verified: true } };
    });
    const steve = await loadSteve();

    await expect(steve.ingestDiscoveryArtifact(makePayload())).rejects.toMatchObject({
      code: 'EVENT_COMPACTION_FAILED',
    });
    expect(store.discovery?._id).toBe('SD-TMAG-1');
    expect(store.events?.[0]?.payload).toBeDefined();
  });

  it('allows an exact new-record retry to finish compaction without rewriting the artifact', async () => {
    const payload = makePayload() as unknown as AnyRec;
    const store: Store = {
      ba: { ...BA },
      discovery: {
        _id: 'SD-TMAG-1',
        ...payload,
        privacy: {
          policyVersion: 'acr-0031.v1',
          status: 'active',
          withdrawnAt: null,
          sponsorConsent: {},
        },
        eventBodyCompaction: {
          eligible: true,
          policyVersion: 'acr-0031.v1',
          eventKind: 'discovery_chat_message',
          boundaryCompletedAt: '2026-07-01T00:10:00.000Z',
          scope: 'new_record_only',
        },
      },
      events: [
        {
          _id: 'event-retry',
          tmagId: 'TMAG-1',
          agentId: 'steve',
          kind: 'discovery_chat_message',
          payload: { role: 'ba', text: 'private answer', seq: 0 },
        },
      ],
    };
    mocks.persistenceCall.mockImplementation(makePersistenceImpl(store));
    const steve = await loadSteve();

    const artifact = await steve.ingestDiscoveryArtifact(makePayload());

    expect(artifact.tmagId).toBe('TMAG-1');
    expect(mocks.writeKnowledge).not.toHaveBeenCalled();
    expect(store.events?.[0]?.payload).toBeUndefined();
  });

  it('TOCTOU: a raced duplicate insert rejects without taking correction authority', async () => {
    const store: Store = { ba: { ...BA }, discovery: null };
    mocks.persistenceCall.mockImplementation(makePersistenceImpl(store));
    // Simulate a concurrent writer: writeKnowledge lands the row then the
    // insert rejects on the duplicate _id.
    mocks.writeKnowledge.mockImplementation(async (input: { id: string; mongoDoc: AnyRec }) => {
      store.discovery = {
        _id: input.id,
        ...input.mongoDoc,
        completedAt: '2026-07-01T00:09:00.000Z',
        eventBodyCompaction: {
          eligible: true,
          policyVersion: 'acr-0031.v1',
          eventKind: 'discovery_chat_message',
          boundaryCompletedAt: '2026-07-01T00:09:00.000Z',
          scope: 'new_record_only',
        },
      };
      throw new Error('E11000 duplicate key');
    });
    const steve = await loadSteve();

    await expect(steve.ingestDiscoveryArtifact(makePayload())).rejects.toMatchObject({
      code: 'ALREADY_EXISTS',
    });
    expect(
      mocks.persistenceCall.mock.calls.some(
        ([tool, action, params]) =>
          tool === 'mongodb' &&
          action === 'update' &&
          (params as AnyRec).collection === 'tmag_steve_success_interview',
      ),
    ).toBe(false);
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
