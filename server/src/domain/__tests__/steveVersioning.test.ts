import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  persistenceCall: vi.fn(),
  appendAuditEntry: vi.fn(),
  assertChromaCollectionExists: vi.fn(),
}));

vi.mock('../../services/persistence/dispatch.js', () => ({
  persistenceCall: mocks.persistenceCall,
}));

vi.mock('../../services/chromaCollections.js', () => ({
  assertChromaCollectionExists: mocks.assertChromaCollectionExists,
}));

vi.mock('../auditLog.js', () => ({
  appendAuditEntry: mocks.appendAuditEntry,
}));

type Row = Record<string, unknown>;

function profile(): Row {
  const fields = [
    'why_statement',
    'success_vision',
    'support_obstacles',
    'michael_handoff_summary',
  ];
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
        text: 'PRIVATE INTERVIEW ANSWER',
        occurredAt: '2026-07-16T00:01:00.000Z',
      },
    ],
    answers: [
      {
        questionId: 'q_why',
        prompt: 'Why?',
        answerText: 'PRIVATE INTERVIEW ANSWER',
      },
    ],
    successProfile: {
      tmagId: 'TMAG-BA',
      primaryWhy: {
        statement: 'PRIVATE INTERVIEW ANSWER',
        who: 'family',
        whyNow: 'now',
      },
      successVision: { statement: 'Freedom', oneBigChange: 'time' },
      learningStyle: { modalities: ['doing'], feedbackPreference: 'direct', notes: '' },
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
      launchRecommendations: [],
      trainingRecommendations: [],
      michaelHandoffSummary: 'Support context',
      generatedAt: '2026-07-16T00:10:00.000Z',
      signedBy: 'Steve · Success Profile',
    },
    audioUrl: null,
    privacy: {
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
    },
    profileVersion: 2,
    correctionRevision: 3,
    lastCorrectedAt: '2026-07-16T00:20:00.000Z',
    retakeSession: null,
  };
}

beforeEach(() => {
  vi.resetModules();
  mocks.persistenceCall.mockReset();
  mocks.appendAuditEntry.mockReset();
  mocks.assertChromaCollectionExists.mockReset();
  mocks.assertChromaCollectionExists.mockResolvedValue(undefined);
  mocks.appendAuditEntry.mockResolvedValue({ entryId: 'audit-retake' });
});

describe('ACR-0032 Steve interview versioning', () => {
  it('starts a retake while leaving the completed profile in place', async () => {
    let current = profile();
    let graph: Row = {};
    let chroma: Row = {};
    mocks.persistenceCall.mockImplementation(
      async (tool: string, action: string, params: Row) => {
        if (tool === 'mongodb' && action === 'query') {
          return { documents: [structuredClone(current)], count: 1 };
        }
        if (tool === 'mongodb' && action === 'update') {
          const set = ((params.update as Row).$set ?? {}) as Row;
          current = { ...current, ...structuredClone(set) };
          return { matchedCount: 1, modifiedCount: 1 };
        }
        if (tool === 'neo4j' && action === 'cypher') {
          const query = String(params.query);
          const queryParams = (params.params ?? {}) as Row;
          if (query.includes('SET d.profileVersion')) {
            graph = {
              profileVersion: queryParams.profileVersion,
              retakeStatus: queryParams.retakeStatus,
              retakeSessionId: queryParams.retakeSessionId,
            };
            return { records: [] };
          }
          return { records: [structuredClone(graph)] };
        }
        if (tool === 'chromadb' && action === 'add') {
          chroma = structuredClone((params.metadatas as Row[])[0] ?? {});
          return { ok: true };
        }
        if (tool === 'chromadb' && action === 'get') {
          return { ids: ['SD-TMAG-BA'], metadatas: [structuredClone(chroma)] };
        }
        return {};
      },
    );

    const { startSteveRetake } = await import('../steveVersioning.js');
    const result = await startSteveRetake('TMAG-BA');

    expect(result.profileVersion).toBe(2);
    expect(result.retakeSession.baseProfileVersion).toBe(2);
    expect(current.successProfile).toMatchObject({
      primaryWhy: { statement: 'PRIVATE INTERVIEW ANSWER' },
    });
    expect(current.retakeSession).toMatchObject({ status: 'in_progress' });
    expect(graph.retakeStatus).toBe('in_progress');
    expect(chroma).toMatchObject({
      retrievalEligible: false,
      retakeStatus: 'in_progress',
      profileVersion: 2,
    });
  });

  it('archives full private history only in Mongo and content-free markers elsewhere', async () => {
    const current = profile();
    let archived: Row | null = null;
    let graphVersion: Row = {};
    let chromaDocument = '';
    let chromaMetadata: Row = {};
    mocks.persistenceCall.mockImplementation(
      async (tool: string, action: string, params: Row) => {
        if (tool === 'mongodb' && action === 'query') {
          return {
            documents: archived ? [structuredClone(archived)] : [],
            count: archived ? 1 : 0,
          };
        }
        if (tool === 'mongodb' && action === 'insert') {
          archived = structuredClone((params.documents as Row[])[0] ?? null);
          return { insertedCount: 1 };
        }
        if (tool === 'neo4j' && action === 'cypher') {
          const query = String(params.query);
          const queryParams = (params.params ?? {}) as Row;
          if (query.includes('MERGE (v:TmagSteveDiscoveryVersion')) {
            graphVersion = {
              ownerTmagId: queryParams.ownerTmagId,
              profileVersion: queryParams.profileVersion,
              correctionRevision: queryParams.correctionRevision,
            };
            return { records: [] };
          }
          return { records: [structuredClone(graphVersion)] };
        }
        if (tool === 'chromadb' && action === 'add') {
          chromaDocument = (params.documents as string[])[0] ?? '';
          chromaMetadata = structuredClone((params.metadatas as Row[])[0] ?? {});
          return { ok: true };
        }
        if (tool === 'chromadb' && action === 'get') {
          return {
            ids: ['SD-TMAG-BA-v2-r3'],
            metadatas: [structuredClone(chromaMetadata)],
          };
        }
        return {};
      },
    );

    const { archiveSteveDiscoveryVersion } = await import('../steveVersioning.js');
    const result = await archiveSteveDiscoveryVersion({
      discovery: current as never,
      reason: 'retake',
      supersededAt: '2026-07-16T03:00:00.000Z',
    });

    expect(result.versionId).toBe('SD-TMAG-BA-v2-r3');
    expect(archived).toMatchObject({
      profileVersion: 2,
      correctionRevision: 3,
      transcript: [{ text: 'PRIVATE INTERVIEW ANSWER' }],
    });
    expect(JSON.stringify(graphVersion)).not.toContain('PRIVATE INTERVIEW ANSWER');
    expect(chromaDocument).not.toContain('PRIVATE INTERVIEW ANSWER');
    expect(chromaMetadata).toMatchObject({
      retrievalEligible: false,
      profileVersion: 2,
      correctionRevision: 3,
    });
  });
});
