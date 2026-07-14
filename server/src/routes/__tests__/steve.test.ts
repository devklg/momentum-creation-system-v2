import type { Request, Response } from 'express';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as steveDomain from '../../domain/steve-success-interview.js';
import * as steveRuntime from '../../domain/steveConversationRuntime.js';
import { steveRoutes } from '../steve.js';

type HttpMethod = 'get' | 'post';

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
    ['get', '/discovery/system-prompt'],
    ['post', '/discovery/ingest'],
  ] as const)('keeps the worker endpoint outside BA session middleware: %s %s', (method, path) => {
    const names = findRoute(method, path).map((layer) => layer.name);
    expect(names).not.toContain('requireAuth');
    expect(names).not.toContain('requireSteveComplete');
  });
});

describe('Steve route behavior', () => {
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
});
