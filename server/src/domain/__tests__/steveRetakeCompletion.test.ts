import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  persistenceCall: vi.fn(),
  writeKnowledge: vi.fn(),
  archiveSteveDiscoveryVersion: vi.fn(),
  appendAuditEntry: vi.fn(),
}));

vi.mock('../../services/persistence/dispatch.js', () => ({
  persistenceCall: mocks.persistenceCall,
}));

vi.mock('../../services/tieredWrite.js', () => ({
  writeKnowledge: mocks.writeKnowledge,
}));

vi.mock('../auditLog.js', () => ({
  appendAuditEntry: mocks.appendAuditEntry,
}));

vi.mock('../steveVersioning.js', () => ({
  STEVE_VERSIONING_POLICY_VERSION: 'acr-0032.v1',
  profileVersionOf: (row: { profileVersion?: number }) => row.profileVersion ?? 1,
  correctionRevisionOf: (row: { correctionRevision?: number }) =>
    row.correctionRevision ?? 0,
  activeRetakeSession: (row: { retakeSession?: unknown } | null) =>
    row?.retakeSession ?? null,
  archiveSteveDiscoveryVersion: mocks.archiveSteveDiscoveryVersion,
}));

type Row = Record<string, unknown>;

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
        { field, granted: false, sponsorTmagId: null, grantedAt: null, revokedAt: null },
      ]),
    ),
  };
}

function currentProfile(): Row {
  return {
    _id: 'SD-TMAG-1',
    tmagId: 'TMAG-1',
    sponsorTmagId: 'TMAG-0',
    callSid: null,
    startedAt: '2026-07-01T00:00:00.000Z',
    completedAt: '2026-07-01T00:10:00.000Z',
    transcript: [],
    answers: [],
    successProfile: {
      tmagId: 'TMAG-1',
      primaryWhy: { statement: 'OLD ACTIVE PLAN', who: 'family', whyNow: 'now' },
      successVision: { statement: 'old vision', oneBigChange: 'time' },
      learningStyle: { modalities: ['doing'], feedbackPreference: 'direct', notes: '' },
      communicationPreferences: {
        preferredChannels: ['text'], cadence: 'weekly', bestTimes: 'evenings', notes: '',
      },
      supportNeeds: { areas: [], potentialObstacles: [], helpStyle: 'ask', notes: '' },
      launchRecommendations: [],
      trainingRecommendations: [],
      michaelHandoffSummary: '',
      generatedAt: '2026-07-01T00:10:00.000Z',
      signedBy: 'Steve · Success Profile',
    },
    audioUrl: null,
    privacy: privacy(),
    profileVersion: 1,
    correctionRevision: 2,
    lastCorrectedAt: '2026-07-01T00:20:00.000Z',
    retakeSession: {
      sessionId: 'steve_retake_123',
      status: 'in_progress',
      startedAt: '2026-07-16T03:00:00.000Z',
      baseProfileVersion: 1,
      policyVersion: 'acr-0032.v1',
    },
  };
}

function retakePayload() {
  return {
    tmagId: 'TMAG-1',
    callSid: null,
    startedAt: '2026-07-16T03:00:00.000Z',
    completedAt: '2026-07-16T03:20:00.000Z',
    transcript: [
      { sequence: 1, speaker: 'ba', text: 'NEW ANSWER', occurredAt: '2026-07-16T03:01:00.000Z' },
    ],
    answers: [{ questionId: 'q_why', prompt: 'Why?', answerText: 'NEW ANSWER' }],
    audioUrl: null,
    profile: {
      primaryWhy: { statement: 'NEW ACTIVE PLAN', who: 'family', whyNow: 'now' },
      successVision: { statement: 'new vision', oneBigChange: 'freedom' },
      learningStyle: { modalities: ['doing'], feedbackPreference: 'direct', notes: '' },
      communicationPreferences: {
        preferredChannels: ['text'], cadence: 'weekly', bestTimes: 'evenings', notes: '',
      },
      supportNeeds: { areas: [], potentialObstacles: [], helpStyle: 'ask', notes: '' },
      launchRecommendations: [],
      trainingRecommendations: [],
      michaelHandoffSummary: '',
    },
  } as never;
}

beforeEach(() => {
  vi.resetModules();
  mocks.persistenceCall.mockReset();
  mocks.writeKnowledge.mockReset();
  mocks.archiveSteveDiscoveryVersion.mockReset();
  mocks.appendAuditEntry.mockReset();
  mocks.archiveSteveDiscoveryVersion.mockResolvedValue({
    versionId: 'SD-TMAG-1-v1-r2',
    alreadyArchived: false,
  });
  mocks.appendAuditEntry.mockResolvedValue({ entryId: 'audit-retake-complete' });
});

describe('ACR-0032 completed retake replacement', () => {
  it('keeps the old plan active until completion, then atomically promotes version 2', async () => {
    let current = currentProfile();
    let graph: Row = {};
    let chroma: Row = {};
    const compactedSessions: string[] = [];
    mocks.persistenceCall.mockImplementation(
      async (tool: string, action: string, params: Row) => {
        if (tool === 'mongodb' && action === 'query') {
          const collection = String(params.collection);
          if (collection === 'team_magnificent_members') {
            return { documents: [{ tmagId: 'TMAG-1', sponsorTmagId: 'TMAG-0' }] };
          }
          if (collection === 'tmag_steve_success_interview') {
            return { documents: [structuredClone(current)], count: 1 };
          }
          if (collection === 'tmag_agent_steve_events') {
            return { documents: [], count: 0 };
          }
        }
        if (tool === 'mongodb' && action === 'update') {
          if (params.collection === 'tmag_steve_success_interview') {
            const set = ((params.update as Row).$set ?? {}) as Row;
            current = { ...current, ...structuredClone(set) };
            return { matchedCount: 1, modifiedCount: 1 };
          }
          if (params.collection === 'tmag_agent_steve_events') {
            const filter = params.filter as Row;
            compactedSessions.push(String(filter['payload.sessionId']));
            return { matchedCount: 4, modifiedCount: 4 };
          }
        }
        if (tool === 'neo4j' && action === 'cypher') {
          const query = String(params.query);
          const queryParams = (params.params ?? {}) as Row;
          if (query.includes('SET d.completedAt')) {
            graph = {
              profileVersion: queryParams.profileVersion,
              correctionRevision: queryParams.correctionRevision,
              retakeStatus: queryParams.retakeStatus,
            };
            return { records: [] };
          }
          return { records: [structuredClone(graph)] };
        }
        if (tool === 'chromadb' && action === 'list_collections') {
          return { collections: [{ name: 'mcs_steve_success_interview' }] };
        }
        if (tool === 'chromadb' && action === 'add') {
          chroma = structuredClone((params.metadatas as Row[])[0] ?? {});
          return { ok: true };
        }
        if (tool === 'chromadb' && action === 'get') {
          return { ids: ['SD-TMAG-1'], metadatas: [structuredClone(chroma)] };
        }
        return {};
      },
    );

    const { ingestDiscoveryArtifact } = await import('../steve-success-interview.js');
    const artifact = await ingestDiscoveryArtifact(retakePayload(), {
      retakeSessionId: 'steve_retake_123',
    });

    expect(mocks.archiveSteveDiscoveryVersion).toHaveBeenCalledWith(
      expect.objectContaining({
        discovery: expect.objectContaining({ profileVersion: 1, correctionRevision: 2 }),
        reason: 'retake',
      }),
    );
    expect(current).toMatchObject({
      profileVersion: 2,
      correctionRevision: 0,
      lastCorrectedAt: null,
      retakeSession: null,
      successProfile: { primaryWhy: { statement: 'NEW ACTIVE PLAN' } },
      privacy: { status: 'active' },
    });
    expect(artifact.profileVersion).toBe(2);
    expect(compactedSessions).toEqual(['steve_retake_123']);
    expect(graph).toMatchObject({
      profileVersion: 2,
      correctionRevision: 0,
      retakeStatus: 'not_in_progress',
    });
    expect(chroma).toMatchObject({
      profileVersion: 2,
      correctionRevision: 0,
      retakeStatus: 'not_in_progress',
      retrievalEligible: false,
    });
  });
});
