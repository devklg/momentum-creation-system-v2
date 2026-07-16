import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  persistenceCall: vi.fn(),
  appendAuditEntry: vi.fn(),
}));

vi.mock('../../services/persistence/dispatch.js', () => ({
  persistenceCall: mocks.persistenceCall,
}));

vi.mock('../auditLog.js', () => ({
  appendAuditEntry: mocks.appendAuditEntry,
}));

type AnyRec = Record<string, unknown>;

const OLD_PRIVATE = 'OLD-PRIVATE-WHY';
const NEW_PRIVATE = 'NEW-PRIVATE-WHY';

function privacy() {
  const fields = [
    'why_statement',
    'success_vision',
    'support_obstacles',
    'michael_handoff_summary',
  ];
  return {
    policyVersion: 'acr-0031.v1',
    status: 'active',
    withdrawnAt: null,
    sponsorConsent: Object.fromEntries(
      fields.map((field) => [
        field,
        {
          field,
          granted: false,
          sponsorTmagId: null,
          grantedAt: null,
          revokedAt: null,
        },
      ]),
    ),
  };
}

function discovery() {
  return {
    _id: 'SD-TMAG-BA',
    tmagId: 'TMAG-BA',
    sponsorTmagId: 'TMAG-SPONSOR',
    callSid: null,
    startedAt: '2026-07-16T00:00:00.000Z',
    completedAt: '2026-07-16T00:10:00.000Z',
    transcript: [
      {
        sequence: 1,
        speaker: 'ba',
        text: OLD_PRIVATE,
        occurredAt: '2026-07-16T00:01:00.000Z',
      },
    ],
    answers: [
      {
        questionId: 'q_why',
        prompt: 'Why?',
        answerText: OLD_PRIVATE,
      },
    ],
    successProfile: {
      tmagId: 'TMAG-BA',
      primaryWhy: { statement: OLD_PRIVATE, who: 'family', whyNow: 'now' },
      successVision: { statement: 'Vision', oneBigChange: 'time' },
      learningStyle: {
        modalities: ['doing'],
        feedbackPreference: 'direct',
        notes: '',
      },
      communicationPreferences: {
        preferredChannels: ['text'],
        cadence: 'weekly',
        bestTimes: 'evenings',
        notes: '',
      },
      supportNeeds: {
        areas: ['training'],
        potentialObstacles: ['time'],
        helpStyle: 'ask early',
        notes: '',
      },
      launchRecommendations: [{ text: 'Start here', href: '/launch' }],
      trainingRecommendations: [{ text: 'Train here', href: '/training' }],
      michaelHandoffSummary: 'Private handoff',
      generatedAt: '2026-07-16T00:10:00.000Z',
      signedBy: 'Steve · Success Profile',
    },
    audioUrl: null,
    privacy: privacy(),
    correctionRevision: 0,
    lastCorrectedAt: null,
    eventBodyCompaction: {
      eligible: true,
      policyVersion: 'acr-0031.v1',
    },
  };
}

interface Store {
  discovery: AnyRec;
  versions: Map<string, AnyRec>;
  graph: AnyRec;
  graphVersions: Map<string, AnyRec>;
  chroma: Map<string, { document: string; metadata: AnyRec }>;
}

function makePersistence(store: Store) {
  return async (tool: string, action: string, params: AnyRec): Promise<unknown> => {
    if (tool === 'mongodb' && action === 'query') {
      if (params.collection === 'tmag_steve_success_interview') {
        return { documents: [structuredClone(store.discovery)], count: 1 };
      }
      if (params.collection === 'tmag_steve_success_interview_versions') {
        const id = ((params.filter ?? {}) as AnyRec)._id as string;
        const row = store.versions.get(id);
        return { documents: row ? [structuredClone(row)] : [], count: row ? 1 : 0 };
      }
      if (params.collection === 'tmag_recruiting_cycles') {
        return {
          documents: [
            {
              tmagId: 'TMAG-BA',
              enrolledAt: '2026-07-15T00:00:00.000Z',
            },
          ],
          count: 1,
        };
      }
    }
    if (
      tool === 'mongodb' &&
      action === 'insert' &&
      params.collection === 'tmag_steve_success_interview_versions'
    ) {
      const rows = params.documents as AnyRec[];
      rows.forEach((row) => store.versions.set(String(row._id), structuredClone(row)));
      return { insertedCount: rows.length };
    }
    if (
      tool === 'mongodb' &&
      action === 'update' &&
      params.collection === 'tmag_steve_success_interview'
    ) {
      const filter = params.filter as AnyRec;
      const currentRevision = (store.discovery.correctionRevision as number | undefined) ?? 0;
      const expectedRevision =
        typeof filter.correctionRevision === 'number'
          ? filter.correctionRevision
          : Array.isArray(filter.$or)
            ? 0
            : -1;
      if (
        filter._id !== store.discovery._id ||
        filter.tmagId !== store.discovery.tmagId ||
        currentRevision !== expectedRevision
      ) {
        return { matchedCount: 0, modifiedCount: 0 };
      }
      const set = ((params.update as AnyRec).$set ?? {}) as AnyRec;
      store.discovery = { ...store.discovery, ...structuredClone(set) };
      return { matchedCount: 1, modifiedCount: 1 };
    }
    if (tool === 'neo4j' && action === 'cypher') {
      const query = params.query as string;
      const queryParams = (params.params ?? {}) as AnyRec;
      if (query.includes('TmagSteveDiscoveryVersion') && query.includes('MERGE')) {
        store.graphVersions.set(String(queryParams.versionId), {
          ownerTmagId: queryParams.ownerTmagId,
          profileVersion: queryParams.profileVersion,
          correctionRevision: queryParams.correctionRevision,
        });
        return { records: [] };
      }
      if (query.includes('TmagSteveDiscoveryVersion') && query.includes('RETURN')) {
        const row = store.graphVersions.get(String(queryParams.versionId));
        return { records: row ? [structuredClone(row)] : [] };
      }
      if (query.includes('SET d.correctionRevision')) {
        store.graph = {
          correctionRevision: queryParams.correctionRevision,
          lastCorrectedAt: queryParams.lastCorrectedAt,
          profileVersion: queryParams.profileVersion,
        };
        return { records: [] };
      }
      if (query.includes('RETURN d.correctionRevision')) {
        return { records: [structuredClone(store.graph)] };
      }
      return { records: [] };
    }
    if (tool === 'chromadb' && action === 'list_collections') {
      return { collections: [{ name: 'mcs_steve_success_interview' }] };
    }
    if (tool === 'chromadb' && action === 'add') {
      const ids = params.ids as string[];
      const documents = params.documents as string[];
      const metadatas = params.metadatas as AnyRec[];
      ids.forEach((id, index) => {
        store.chroma.set(id, {
          document: documents[index] ?? '',
          metadata: structuredClone(metadatas[index] ?? {}),
        });
      });
      return { ok: true };
    }
    if (tool === 'chromadb' && action === 'get') {
      const ids = params.ids as string[];
      return {
        ids: ids.filter((id) => store.chroma.has(id)),
        documents: ids
          .filter((id) => store.chroma.has(id))
          .map((id) => store.chroma.get(id)!.document),
        metadatas: ids
          .filter((id) => store.chroma.has(id))
          .map((id) => structuredClone(store.chroma.get(id)!.metadata)),
      };
    }
    return {};
  };
}

async function loadCorrection() {
  return import('../steveCorrection.js');
}

beforeEach(() => {
  vi.resetModules();
  mocks.persistenceCall.mockReset();
  mocks.appendAuditEntry.mockReset();
  mocks.appendAuditEntry.mockResolvedValue({ entryId: 'audit-correction' });
});

describe('ACR-0032 Steve versioned BA-confirmed correction', () => {
  it('replaces one private value, updates the why projection, and audits only field paths', async () => {
    const store: Store = {
      discovery: discovery(),
      versions: new Map(),
      graph: {},
      graphVersions: new Map(),
      chroma: new Map(),
    };
    store.chroma.set('rc_TMAG-BA', {
      document: `Recruiting cycle for BA TMAG-BA. Why: ${OLD_PRIVATE}`,
      metadata: { whyStatement: OLD_PRIVATE },
    });
    mocks.persistenceCall.mockImplementation(makePersistence(store));
    const correction = await loadCorrection();

    const result = await correction.correctStevePrivateRecord({
      tmagId: 'TMAG-BA',
      payload: {
        target: { kind: 'profile_text', path: 'primaryWhy.statement' },
        replacement: NEW_PRIVATE,
        expectedRevision: 0,
        confirmation: 'I CONFIRM THIS STEVE CORRECTION',
      },
    });

    expect(
      (store.discovery.successProfile as AnyRec).primaryWhy,
    ).toMatchObject({ statement: NEW_PRIVATE });
    expect(store.discovery.correctionRevision).toBe(1);
    const archived = store.versions.get('SD-TMAG-BA-v1-r0');
    expect(archived?.successProfile).toMatchObject({
      primaryWhy: { statement: OLD_PRIVATE },
    });
    expect(store.chroma.get('SD-TMAG-BA-v1-r0')?.document).not.toContain(OLD_PRIVATE);
    expect(result.changedFieldPaths).toEqual([
      'successProfile.primaryWhy.statement',
    ]);
    expect(store.chroma.get('rc_TMAG-BA')?.document).toContain(NEW_PRIVATE);
    expect(store.chroma.get('rc_TMAG-BA')?.document).not.toContain(OLD_PRIVATE);
    expect(store.chroma.get('SD-TMAG-BA')?.document).not.toContain(NEW_PRIVATE);
    expect(JSON.stringify(mocks.appendAuditEntry.mock.calls)).not.toContain(
      OLD_PRIVATE,
    );
    expect(JSON.stringify(mocks.appendAuditEntry.mock.calls)).not.toContain(
      NEW_PRIVATE,
    );
    expect(mocks.appendAuditEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'ba.steve_profile.corrected',
        after: expect.objectContaining({
          correctionRevision: 1,
          changedFieldPaths: ['successProfile.primaryWhy.statement'],
        }),
      }),
    );
  });

  it('rejects a stale revision before any persistent write', async () => {
    const store: Store = {
      discovery: { ...discovery(), correctionRevision: 2 },
      versions: new Map(),
      graph: {},
      graphVersions: new Map(),
      chroma: new Map(),
    };
    mocks.persistenceCall.mockImplementation(makePersistence(store));
    const correction = await loadCorrection();

    await expect(
      correction.correctStevePrivateRecord({
        tmagId: 'TMAG-BA',
        payload: {
          target: { kind: 'answer_text', questionId: 'q_why' },
          replacement: NEW_PRIVATE,
          expectedRevision: 1,
          confirmation: 'I CONFIRM THIS STEVE CORRECTION',
        },
      }),
    ).rejects.toMatchObject({ code: 'STALE_REVISION' });

    expect(
      mocks.persistenceCall.mock.calls.some(
        ([tool, action]) => tool === 'mongodb' && action === 'update',
      ),
    ).toBe(false);
    expect(mocks.appendAuditEntry).not.toHaveBeenCalled();
  });

  it('rolls the canonical value and why projection back when the audit append fails', async () => {
    const store: Store = {
      discovery: discovery(),
      versions: new Map(),
      graph: {},
      graphVersions: new Map(),
      chroma: new Map(),
    };
    store.chroma.set('rc_TMAG-BA', {
      document: `Recruiting cycle for BA TMAG-BA. Why: ${OLD_PRIVATE}`,
      metadata: { whyStatement: OLD_PRIVATE },
    });
    mocks.persistenceCall.mockImplementation(makePersistence(store));
    mocks.appendAuditEntry.mockRejectedValueOnce(new Error('audit unavailable'));
    const correction = await loadCorrection();

    await expect(
      correction.correctStevePrivateRecord({
        tmagId: 'TMAG-BA',
        payload: {
          target: { kind: 'profile_text', path: 'primaryWhy.statement' },
          replacement: NEW_PRIVATE,
          expectedRevision: 0,
          confirmation: 'I CONFIRM THIS STEVE CORRECTION',
        },
      }),
    ).rejects.toMatchObject({ code: 'CORRECTION_FAILED' });

    expect(
      (store.discovery.successProfile as AnyRec).primaryWhy,
    ).toMatchObject({ statement: OLD_PRIVATE });
    expect(store.discovery.correctionRevision).toBe(0);
    expect(store.chroma.get('rc_TMAG-BA')?.document).toContain(OLD_PRIVATE);
    expect(store.chroma.get('rc_TMAG-BA')?.document).not.toContain(NEW_PRIVATE);
  });

  it('rejects a target that no longer exists without changing the record', async () => {
    const store: Store = {
      discovery: discovery(),
      versions: new Map(),
      graph: {},
      graphVersions: new Map(),
      chroma: new Map(),
    };
    mocks.persistenceCall.mockImplementation(makePersistence(store));
    const correction = await loadCorrection();

    await expect(
      correction.correctStevePrivateRecord({
        tmagId: 'TMAG-BA',
        payload: {
          target: { kind: 'transcript_text', sequence: 99 },
          replacement: NEW_PRIVATE,
          expectedRevision: 0,
          confirmation: 'I CONFIRM THIS STEVE CORRECTION',
        },
      }),
    ).rejects.toMatchObject({ code: 'INVALID_TARGET' });

    expect(store.discovery.correctionRevision).toBe(0);
    expect(mocks.appendAuditEntry).not.toHaveBeenCalled();
  });
});
