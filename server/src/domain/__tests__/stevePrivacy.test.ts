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

const PRIVATE_SENTINEL = 'PRIVATE-SENTINEL-DO-NOT-PROJECT';

function profile() {
  return {
    tmagId: 'TMAG-BA',
    generatedAt: '2026-07-16T00:10:00.000Z',
    signedBy: 'Steve Success · non-scored discovery profile',
    primaryWhy: { statement: PRIVATE_SENTINEL, who: 'family', whyNow: 'now' },
    successVision: { statement: 'Vision private', oneBigChange: 'time' },
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
    michaelHandoffSummary: 'Private handoff',
  };
}

function discovery(privacy?: unknown) {
  return {
    _id: 'SD-TMAG-BA',
    tmagId: 'TMAG-BA',
    startedAt: '2026-07-16T00:00:00.000Z',
    completedAt: '2026-07-16T00:10:00.000Z',
    transcript: [
      {
        sequence: 1,
        speaker: 'ba',
        text: PRIVATE_SENTINEL,
        occurredAt: '2026-07-16T00:01:00.000Z',
      },
    ],
    answers: [
      {
        questionId: 'q_why',
        prompt: 'Why?',
        answerText: PRIVATE_SENTINEL,
      },
    ],
    successProfile: profile(),
    ...(privacy === undefined ? {} : { privacy }),
  };
}

function makePersistence(store: { discovery: AnyRec; sponsorTmagId: string | null }) {
  return async (tool: string, action: string, params: AnyRec): Promise<unknown> => {
    if (tool === 'mongodb' && action === 'query') {
      if (params.collection === 'team_magnificent_members') {
        return { documents: [{ sponsorTmagId: store.sponsorTmagId }] };
      }
      if (params.collection === 'tmag_steve_success_interview') {
        return { documents: [store.discovery] };
      }
    }
    if (tool === 'mongodb' && action === 'update') {
      const set = ((params.update as AnyRec).$set ?? {}) as AnyRec;
      store.discovery = { ...store.discovery, ...set };
      return { matchedCount: 1 };
    }
    if (tool === 'neo4j' && action === 'cypher') return { records: [] };
    if (tool === 'chromadb' && action === 'add') return { ok: true };
    return {};
  };
}

async function loadPrivacy() {
  return import('../stevePrivacy.js');
}

beforeEach(() => {
  vi.resetModules();
  mocks.persistenceCall.mockReset();
  mocks.appendAuditEntry.mockReset();
  mocks.appendAuditEntry.mockResolvedValue({ entryId: 'audit-1' });
});

describe('ACR-0031 Steve privacy state', () => {
  it('normalizes legacy records to active with every sponsor field off', async () => {
    const privacy = await loadPrivacy();
    const state = privacy.normalizeStevePrivacyState(undefined);

    expect(state).toMatchObject({
      policyVersion: 'acr-0031.v1',
      status: 'active',
      withdrawnAt: null,
    });
    expect(Object.values(state.sponsorConsent).every((grant) => !grant.granted)).toBe(true);
  });

  it('invalidates a stored grant when the current direct sponsor changes', async () => {
    const privacy = await loadPrivacy();
    const stored = privacy.defaultStevePrivacyState();
    stored.sponsorConsent.why_statement = {
      field: 'why_statement',
      granted: true,
      sponsorTmagId: 'TMAG-OLD',
      grantedAt: '2026-07-16T00:00:00.000Z',
      revokedAt: null,
    };

    const effective = privacy.effectiveStevePrivacyState(stored, 'TMAG-NEW');
    expect(effective.sponsorConsent.why_statement.granted).toBe(false);
    expect(stored.sponsorConsent.why_statement.granted).toBe(true);
  });

  it('grants and revokes one exact field for the current sponsor with content-free audit facts', async () => {
    const store = { discovery: discovery(), sponsorTmagId: 'TMAG-SPONSOR' };
    mocks.persistenceCall.mockImplementation(makePersistence(store));
    const privacy = await loadPrivacy();

    const granted = await privacy.setSteveSponsorConsent({
      tmagId: 'TMAG-BA',
      field: 'why_statement',
      granted: true,
    });
    expect(granted.privacy.sponsorConsent.why_statement).toMatchObject({
      granted: true,
      sponsorTmagId: 'TMAG-SPONSOR',
      revokedAt: null,
    });
    expect(granted.privacy.sponsorConsent.success_vision.granted).toBe(false);

    const revoked = await privacy.setSteveSponsorConsent({
      tmagId: 'TMAG-BA',
      field: 'why_statement',
      granted: false,
    });
    expect(revoked.privacy.sponsorConsent.why_statement).toMatchObject({
      granted: false,
      sponsorTmagId: 'TMAG-SPONSOR',
    });
    expect(revoked.privacy.sponsorConsent.why_statement.revokedAt).toEqual(
      expect.any(String),
    );

    const auditPayload = JSON.stringify(mocks.appendAuditEntry.mock.calls);
    expect(auditPayload).not.toContain(PRIVATE_SENTINEL);
    expect(auditPayload).not.toContain('Vision private');
    expect(auditPayload).not.toContain('Private handoff');

    const projectionPayload = JSON.stringify(
      mocks.persistenceCall.mock.calls.filter(
        ([tool]) => tool === 'neo4j' || tool === 'chromadb',
      ),
    );
    expect(projectionPayload).not.toContain(PRIVATE_SENTINEL);
    expect(projectionPayload).toContain('"completedAt":"2026-07-16T00:10:00.000Z"');
  });

  it('withdraws one way, revokes all sponsor fields, and preserves the BA self copy', async () => {
    const stateStore = {
      discovery: discovery(),
      sponsorTmagId: 'TMAG-SPONSOR',
    };
    mocks.persistenceCall.mockImplementation(makePersistence(stateStore));
    const privacy = await loadPrivacy();
    await privacy.setSteveSponsorConsent({
      tmagId: 'TMAG-BA',
      field: 'success_vision',
      granted: true,
    });

    const result = await privacy.withdrawStevePersonalization('TMAG-BA');
    expect(result.privacy.status).toBe('withdrawn');
    expect(result.privacy.withdrawnAt).toEqual(expect.any(String));
    expect(
      Object.values(result.privacy.sponsorConsent).every((grant) => !grant.granted),
    ).toBe(true);
    expect(stateStore.discovery.transcript).toEqual(
      expect.arrayContaining([expect.objectContaining({ text: PRIVATE_SENTINEL })]),
    );

    await expect(
      privacy.setSteveSponsorConsent({
        tmagId: 'TMAG-BA',
        field: 'success_vision',
        granted: true,
      }),
    ).rejects.toMatchObject({ code: 'WITHDRAWN' });
  });

  it('exports only the current BA record and excludes provider/event internals', async () => {
    const record = {
      ...discovery(),
      callSid: 'CA-provider-private',
      audioUrl: 'https://private.example/audio',
      events: [{ eventId: 'provider-event' }],
    };
    const store = { discovery: record, sponsorTmagId: 'TMAG-SPONSOR' };
    mocks.persistenceCall.mockImplementation(makePersistence(store));
    const privacy = await loadPrivacy();

    const result = await privacy.exportStevePrivateRecord('TMAG-BA');
    expect(result.export).toMatchObject({
      tmagId: 'TMAG-BA',
      transcript: record.transcript,
      answers: record.answers,
      successProfile: record.successProfile,
    });
    expect(result.export).not.toHaveProperty('callSid');
    expect(result.export).not.toHaveProperty('audioUrl');
    expect(result.export).not.toHaveProperty('events');
    expect(JSON.stringify(mocks.appendAuditEntry.mock.calls)).not.toContain(
      PRIVATE_SENTINEL,
    );
  });

  it('rolls canonical privacy state back when a projection fails', async () => {
    const store = { discovery: discovery(), sponsorTmagId: 'TMAG-SPONSOR' };
    const base = makePersistence(store);
    let chromaCalls = 0;
    mocks.persistenceCall.mockImplementation(
      async (tool: string, action: string, params: AnyRec) => {
        if (tool === 'chromadb' && action === 'add') {
          chromaCalls += 1;
          if (chromaCalls === 1) throw new Error('projection unavailable');
        }
        return base(tool, action, params);
      },
    );
    const privacy = await loadPrivacy();

    await expect(
      privacy.setSteveSponsorConsent({
        tmagId: 'TMAG-BA',
        field: 'why_statement',
        granted: true,
      }),
    ).rejects.toThrow('projection unavailable');
    expect(
      privacy.normalizeStevePrivacyState(store.discovery.privacy).sponsorConsent
        .why_statement.granted,
    ).toBe(false);
    expect(mocks.appendAuditEntry).not.toHaveBeenCalled();
  });

  it('rolls canonical privacy state back when the content-free audit append fails', async () => {
    const store = { discovery: discovery(), sponsorTmagId: 'TMAG-SPONSOR' };
    mocks.persistenceCall.mockImplementation(makePersistence(store));
    mocks.appendAuditEntry.mockRejectedValueOnce(new Error('audit unavailable'));
    const privacy = await loadPrivacy();

    await expect(
      privacy.setSteveSponsorConsent({
        tmagId: 'TMAG-BA',
        field: 'michael_handoff_summary',
        granted: true,
      }),
    ).rejects.toThrow('audit unavailable');
    expect(
      privacy.normalizeStevePrivacyState(store.discovery.privacy).sponsorConsent
        .michael_handoff_summary.granted,
    ).toBe(false);
  });
});
