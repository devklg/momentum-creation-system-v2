import type { Request, Response } from 'express';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  MCS_STEVE_SPONSOR_CONSENT_GRANT_COPY,
  MCS_STEVE_SPONSOR_CONSENT_REVOCATION_COPY,
  MCS_STEVE_WITHDRAW_CONFIRMATION,
} from '@momentum/shared';
import * as steveDomain from '../../domain/steve-success-interview.js';
import * as steveRuntime from '../../domain/steveConversationRuntime.js';
import * as stevePrivacy from '../../domain/stevePrivacy.js';
import { steveRoutes } from '../steve.js';

type HttpMethod = 'get' | 'post' | 'put';

type RouteLayerHandle = {
  name?: string;
  handle: (req: Request, res: Response) => unknown;
};

function findRoute(method: HttpMethod, path: string): RouteLayerHandle[] {
  const stack = (steveRoutes as unknown as {
    stack: Array<{
      route?: {
        path: string;
        methods: Record<string, boolean>;
        stack: RouteLayerHandle[];
      };
    }>;
  }).stack;
  for (const layer of stack) {
    if (layer.route?.path === path && layer.route.methods[method]) {
      return layer.route.stack;
    }
  }
  throw new Error(`${method.toUpperCase()} ${path} not found`);
}

function mockResponse() {
  const response = {
    statusCode: 200,
    body: null as unknown,
    status: vi.fn((statusCode: number) => {
      response.statusCode = statusCode;
      return response;
    }),
    set: vi.fn(() => response),
    setHeader: vi.fn(() => response),
    json: vi.fn((body: unknown) => {
      response.body = body;
      return response;
    }),
  };
  return response as unknown as Response & typeof response;
}

function finalHandler(method: HttpMethod, path: string): RouteLayerHandle['handle'] {
  const route = findRoute(method, path);
  return route[route.length - 1]!.handle;
}

afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.STEVE_WORKER_SECRET;
});

describe('Steve route gate contract', () => {
  it.each([
    ['get', '/discovery/state'],
    ['get', '/discovery/script'],
    ['get', '/discovery/conversation'],
    ['post', '/discovery/converse'],
  ] as const)('keeps %s %s authenticated and available before Steve completion', (method, path) => {
    const names = findRoute(method, path).map((layer) => layer.name);
    expect(names).toContain('requireAuth');
    expect(names).not.toContain('requireSteveComplete');
  });

  it('requires both authentication and Steve completion for sponsor profile reads', () => {
    const names = findRoute('get', '/discovery/profile/:downlineTmagId').map(
      (layer) => layer.name,
    );
    expect(names).toContain('requireAuth');
    expect(names).toContain('requireSteveComplete');
  });

  it.each([
    ['get', '/discovery/privacy'],
    ['get', '/discovery/export'],
    ['put', '/discovery/privacy/consent'],
    ['post', '/discovery/privacy/withdraw'],
  ] as const)('requires a completed authenticated BA profile for %s %s', (method, path) => {
    const names = findRoute(method, path).map((layer) => layer.name);
    expect(names).toContain('requireAuth');
    expect(names).toContain('requireSteveComplete');
  });

  it.each([
    ['get', '/discovery/system-prompt'],
    ['post', '/discovery/ingest'],
  ] as const)('keeps the worker endpoint outside BA session middleware: %s %s', (method, path) => {
    const names = findRoute(method, path).map((layer) => layer.name);
    expect(names).not.toContain('requireAuth');
    expect(names).not.toContain('requireSteveComplete');
  });
});

describe('Steve route behavior', () => {
  const emptyPrivacy = {
    policyVersion: 'acr-0031.v1' as const,
    status: 'active' as const,
    withdrawnAt: null,
    sponsorConsent: {
      why_statement: {
        field: 'why_statement' as const,
        granted: false,
        sponsorTmagId: null,
        grantedAt: null,
        revokedAt: null,
      },
      success_vision: {
        field: 'success_vision' as const,
        granted: false,
        sponsorTmagId: null,
        grantedAt: null,
        revokedAt: null,
      },
      support_obstacles: {
        field: 'support_obstacles' as const,
        granted: false,
        sponsorTmagId: null,
        grantedAt: null,
        revokedAt: null,
      },
      michael_handoff_summary: {
        field: 'michael_handoff_summary' as const,
        granted: false,
        sponsorTmagId: null,
        grantedAt: null,
        revokedAt: null,
      },
    },
  };

  it.each(['awaiting_call', 'complete'] as const)(
    'returns the authenticated BA discovery state for phase %s',
    async (phase) => {
      vi.spyOn(steveDomain, 'buildDiscoveryView').mockResolvedValueOnce({
        tmagId: 'TMAG-001',
        phase,
        transcript: [],
        artifact: null,
      });
      const response = mockResponse();

      await finalHandler('get', '/discovery/state')(
        { session: { tmagId: 'TMAG-001' } } as unknown as Request,
        response,
      );

      expect(steveDomain.buildDiscoveryView).toHaveBeenCalledWith('TMAG-001');
      expect(response.statusCode).toBe(200);
      expect(response.body).toEqual({
        ok: true,
        view: { tmagId: 'TMAG-001', phase, transcript: [], artifact: null },
      });
      expect(response.set).toHaveBeenCalledWith('Cache-Control', 'private, no-store');
    },
  );

  it('returns ALREADY_COMPLETE when the authenticated BA tries another turn', async () => {
    vi.spyOn(steveRuntime, 'converseWithSteve').mockRejectedValueOnce(
      new steveRuntime.SteveAlreadyCompleteError('Discovery already complete.'),
    );
    const response = mockResponse();

    await finalHandler('post', '/discovery/converse')(
      {
        session: { tmagId: 'TMAG-001' },
        body: { message: 'hello again' },
      } as unknown as Request,
      response,
    );

    expect(response.statusCode).toBe(409);
    expect(response.body).toEqual({
      ok: false,
      error: 'Discovery already complete.',
      code: 'ALREADY_COMPLETE',
    });
  });

  it('fails closed when the Steve worker secret is unset or wrong', async () => {
    const handler = finalHandler('get', '/discovery/system-prompt');

    const disabled = mockResponse();
    await handler(
      {
        query: {},
        header: () => undefined,
      } as unknown as Request,
      disabled,
    );
    expect(disabled.statusCode).toBe(503);
    expect(disabled.body).toEqual({
      ok: false,
      error: 'STEVE_WORKER_SECRET unset; ingest endpoint disabled.',
    });

    process.env.STEVE_WORKER_SECRET = 'expected-secret';
    const rejected = mockResponse();
    await handler(
      {
        query: {},
        header: () => 'wrong-secret',
      } as unknown as Request,
      rejected,
    );
    expect(rejected.statusCode).toBe(401);
    expect(rejected.body).toEqual({ ok: false, error: 'Invalid worker secret.' });
  });

  it('validates worker input only after a correct secret', async () => {
    process.env.STEVE_WORKER_SECRET = 'expected-secret';
    const response = mockResponse();

    await finalHandler('get', '/discovery/system-prompt')(
      {
        query: {},
        header: () => 'expected-secret',
      } as unknown as Request,
      response,
    );

    expect(response.statusCode).toBe(400);
    expect(response.body).toEqual({ ok: false, error: 'Provide tmagId.' });
  });

  it('returns a minimal private receipt instead of echoing the full artifact', async () => {
    process.env.STEVE_WORKER_SECRET = 'expected-secret';
    vi.spyOn(steveDomain, 'ingestDiscoveryArtifact').mockResolvedValueOnce({
      tmagId: 'TMAG-001',
      sponsorTmagId: 'TMAG-SPONSOR',
      callSid: 'CA-private',
      startedAt: '2026-07-16T00:00:00.000Z',
      completedAt: '2026-07-16T00:10:00.000Z',
      transcript: [{ sequence: 1, speaker: 'ba', text: 'private', occurredAt: '2026-07-16T00:00:01.000Z' }],
      answers: [{ questionId: 'q_welcome_intro', prompt: 'prompt', answerText: 'private answer' }],
      successProfile: {
        tmagId: 'TMAG-001',
        generatedAt: '2026-07-16T00:10:00.000Z',
        primaryWhy: { statement: 'private why', who: '', whyNow: '' },
        successVision: { statement: '', oneBigChange: '' },
        learningStyle: { modalities: [], feedbackPreference: '', notes: '' },
        communicationPreferences: { preferredChannels: [], cadence: null, bestTimes: '', notes: '' },
        supportNeeds: { areas: [], potentialObstacles: [], helpStyle: '', notes: '' },
        launchRecommendations: [],
        trainingRecommendations: [],
        michaelHandoffSummary: '',
        signedBy: 'Steve · Success Profile',
      },
      audioUrl: 'https://private.example/audio',
    });
    const response = mockResponse();

    await finalHandler('post', '/discovery/ingest')(
      {
        header: () => 'expected-secret',
        body: {
          tmagId: 'TMAG-001',
          callSid: null,
          startedAt: '2026-07-16T00:00:00.000Z',
          completedAt: '2026-07-16T00:10:00.000Z',
          transcript: [],
          answers: [],
          audioUrl: null,
          profile: {
            primaryWhy: { statement: '', who: '', whyNow: '' },
            successVision: { statement: '', oneBigChange: '' },
            learningStyle: { modalities: [], feedbackPreference: '', notes: '' },
            communicationPreferences: { preferredChannels: [], cadence: null, bestTimes: '', notes: '' },
            supportNeeds: { areas: [], potentialObstacles: [], helpStyle: '', notes: '' },
            launchRecommendations: [],
            trainingRecommendations: [],
            michaelHandoffSummary: '',
          },
        },
      } as unknown as Request,
      response,
    );

    expect(response.body).toEqual({
      ok: true,
      receipt: {
        discoveryId: 'SD-TMAG-001',
        tmagId: 'TMAG-001',
        completedAt: '2026-07-16T00:10:00.000Z',
        signedBy: 'Steve · Success Profile',
      },
    });
    expect(JSON.stringify(response.body)).not.toContain('private why');
    expect(JSON.stringify(response.body)).not.toContain('CA-private');
    expect(response.set).toHaveBeenCalledWith('Cache-Control', 'private, no-store');
  });

  it('maps create-only ingest collisions to a content-free 409', async () => {
    process.env.STEVE_WORKER_SECRET = 'expected-secret';
    vi.spyOn(steveDomain, 'ingestDiscoveryArtifact').mockRejectedValueOnce(
      new steveDomain.DiscoveryIngestError(
        'ALREADY_EXISTS',
        'private correction detail',
      ),
    );
    const response = mockResponse();

    await finalHandler('post', '/discovery/ingest')(
      {
        header: () => 'expected-secret',
        body: {
          tmagId: 'TMAG-001',
          callSid: null,
          startedAt: '2026-07-16T00:00:00.000Z',
          completedAt: '2026-07-16T00:10:00.000Z',
          transcript: [],
          answers: [],
          audioUrl: null,
          profile: {
            primaryWhy: { statement: '', who: '', whyNow: '' },
            successVision: { statement: '', oneBigChange: '' },
            learningStyle: { modalities: [], feedbackPreference: '', notes: '' },
            communicationPreferences: {
              preferredChannels: [],
              cadence: null,
              bestTimes: '',
              notes: '',
            },
            supportNeeds: {
              areas: [],
              potentialObstacles: [],
              helpStyle: '',
              notes: '',
            },
            launchRecommendations: [],
            trainingRecommendations: [],
            michaelHandoffSummary: '',
          },
        },
      } as unknown as Request,
      response,
    );

    expect(response.statusCode).toBe(409);
    expect(response.body).toEqual({
      ok: false,
      error: 'Discovery already exists.',
      code: 'ALREADY_EXISTS',
    });
    expect(JSON.stringify(response.body)).not.toContain('private');
  });

  it('returns the BA-owned privacy state and exact ACR consent copy', async () => {
    vi.spyOn(stevePrivacy, 'getStevePrivacyState').mockResolvedValueOnce({
      privacy: emptyPrivacy,
      currentSponsorTmagId: 'TMAG-SPONSOR',
    });
    const response = mockResponse();

    await finalHandler('get', '/discovery/privacy')(
      { session: { tmagId: 'TMAG-001' } } as unknown as Request,
      response,
    );

    expect(response.body).toEqual({
      ok: true,
      privacy: emptyPrivacy,
      currentSponsorTmagId: 'TMAG-SPONSOR',
      grantCopy: MCS_STEVE_SPONSOR_CONSENT_GRANT_COPY,
      revocationCopy: MCS_STEVE_SPONSOR_CONSENT_REVOCATION_COPY,
    });
    expect(response.set).toHaveBeenCalledWith('Cache-Control', 'private, no-store');
  });

  it('validates and applies one exact sponsor-consent field', async () => {
    const grantedPrivacy = {
      ...emptyPrivacy,
      sponsorConsent: {
        ...emptyPrivacy.sponsorConsent,
        why_statement: {
          field: 'why_statement' as const,
          granted: true,
          sponsorTmagId: 'TMAG-SPONSOR',
          grantedAt: '2026-07-16T01:00:00.000Z',
          revokedAt: null,
        },
      },
    };
    vi.spyOn(stevePrivacy, 'setSteveSponsorConsent').mockResolvedValueOnce({
      privacy: grantedPrivacy,
      currentSponsorTmagId: 'TMAG-SPONSOR',
      auditEntryId: 'audit-1',
    });
    const response = mockResponse();

    await finalHandler('put', '/discovery/privacy/consent')(
      {
        session: { tmagId: 'TMAG-001' },
        body: { field: 'why_statement', granted: true },
      } as unknown as Request,
      response,
    );

    expect(stevePrivacy.setSteveSponsorConsent).toHaveBeenCalledWith({
      tmagId: 'TMAG-001',
      field: 'why_statement',
      granted: true,
    });
    expect(response.body).toMatchObject({
      ok: true,
      privacy: grantedPrivacy,
      auditEntryId: 'audit-1',
    });
  });

  it('requires the exact one-way withdrawal confirmation and returns opaque errors', async () => {
    const invalid = mockResponse();
    await finalHandler('post', '/discovery/privacy/withdraw')(
      {
        session: { tmagId: 'TMAG-001' },
        body: { confirmation: 'yes' },
      } as unknown as Request,
      invalid,
    );
    expect(invalid.statusCode).toBe(400);
    expect(invalid.body).toEqual({
      ok: false,
      error: 'Withdrawal confirmation required.',
    });

    vi.spyOn(stevePrivacy, 'withdrawStevePersonalization').mockResolvedValueOnce({
      privacy: {
        ...emptyPrivacy,
        status: 'withdrawn',
        withdrawnAt: '2026-07-16T01:00:00.000Z',
      },
      currentSponsorTmagId: 'TMAG-SPONSOR',
      auditEntryId: 'audit-withdraw',
    });
    const response = mockResponse();
    await finalHandler('post', '/discovery/privacy/withdraw')(
      {
        session: { tmagId: 'TMAG-001' },
        body: { confirmation: MCS_STEVE_WITHDRAW_CONFIRMATION },
      } as unknown as Request,
      response,
    );
    expect(stevePrivacy.withdrawStevePersonalization).toHaveBeenCalledWith(
      'TMAG-001',
    );
    expect(response.body).toMatchObject({
      ok: true,
      auditEntryId: 'audit-withdraw',
      privacy: { status: 'withdrawn' },
    });
  });

  it('sets an attachment filename and does not add provider internals to export responses', async () => {
    vi.spyOn(stevePrivacy, 'exportStevePrivateRecord').mockResolvedValueOnce({
      export: {
        policyVersion: 'acr-0031.v1',
        exportedAt: '2026-07-16T01:00:00.000Z',
        tmagId: 'TMAG-001',
        startedAt: null,
        completedAt: '2026-07-16T00:10:00.000Z',
        transcript: [],
        answers: [],
        successProfile: {
          tmagId: 'TMAG-001',
          generatedAt: '2026-07-16T00:10:00.000Z',
          primaryWhy: { statement: '', who: '', whyNow: '' },
          successVision: { statement: '', oneBigChange: '' },
          learningStyle: { modalities: [], feedbackPreference: '', notes: '' },
          communicationPreferences: {
            preferredChannels: [],
            cadence: null,
            bestTimes: '',
            notes: '',
          },
          supportNeeds: {
            areas: [],
            potentialObstacles: [],
            helpStyle: '',
            notes: '',
          },
          launchRecommendations: [],
          trainingRecommendations: [],
          michaelHandoffSummary: '',
          signedBy: 'Steve Success · non-scored discovery profile',
        },
        privacy: emptyPrivacy,
      },
      auditEntryId: 'audit-export',
    });
    const response = mockResponse();

    await finalHandler('get', '/discovery/export')(
      { session: { tmagId: 'TMAG-001' } } as unknown as Request,
      response,
    );

    expect(response.setHeader).toHaveBeenCalledWith(
      'Content-Disposition',
      'attachment; filename="steve-success-profile-TMAG-001.json"',
    );
    expect(JSON.stringify(response.body)).not.toContain('callSid');
    expect(JSON.stringify(response.body)).not.toContain('audioUrl');
  });

  it.each(['NO_DOWNLINE', 'NOT_SPONSOR', 'NO_ARTIFACT', 'NO_COMPLETED_AT', 'CONSENT_REQUIRED'])(
    'returns one opaque sponsor-profile response for %s',
    async (code) => {
      vi.spyOn(steveDomain, 'getProfileCardForSponsor').mockRejectedValueOnce(
        new steveDomain.SponsorAccessError(code, `private ${code} detail`),
      );
      const response = mockResponse();

      await finalHandler('get', '/discovery/profile/:downlineTmagId')(
        {
          session: { tmagId: 'TMAG-SPONSOR' },
          params: { downlineTmagId: 'TMAG-TARGET' },
        } as unknown as Request,
        response,
      );

      expect(response.statusCode).toBe(404);
      expect(response.body).toEqual({
        ok: false,
        error: 'Profile unavailable.',
        code: 'PROFILE_UNAVAILABLE',
      });
      expect(JSON.stringify(response.body)).not.toContain(code);
      expect(JSON.stringify(response.body)).not.toContain('private');
    },
  );
});
