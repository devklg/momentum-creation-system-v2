import type { Request, Response } from 'express';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as michaelDomain from '../../domain/michael-training-support.js';
import { michaelRoutes } from '../michael.js';

type RouteLayerHandle = {
  handle: (req: Request, res: Response) => unknown;
};

function finalHandler(path: string): RouteLayerHandle['handle'] {
  const stack = (michaelRoutes as unknown as {
    stack: Array<{
      route?: {
        path: string;
        methods: Record<string, boolean>;
        stack: RouteLayerHandle[];
      };
    }>;
  }).stack;
  const route = stack.find(
    (layer) => layer.route?.path === path && layer.route.methods.get,
  )?.route;
  if (!route) throw new Error(`GET ${path} not found`);
  return route.stack[route.stack.length - 1]!.handle;
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
    json: vi.fn((body: unknown) => {
      response.body = body;
      return response;
    }),
  };
  return response as unknown as Response & typeof response;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Michael training-support privacy boundary', () => {
  it.each(['NO_DOWNLINE', 'NOT_SPONSOR', 'NO_PROFILE'])(
    'returns one opaque sponsor-support response for %s',
    async (code) => {
      vi.spyOn(
        michaelDomain,
        'getTrainingSupportCardForSponsor',
      ).mockRejectedValueOnce(
        new michaelDomain.TrainingSupportAccessError(
          code,
          `private ${code} detail`,
        ),
      );
      const response = mockResponse();

      await finalHandler('/training-support/:downlineTmagId')(
        {
          session: { tmagId: 'TMAG-SPONSOR' },
          params: { downlineTmagId: 'TMAG-TARGET' },
        } as unknown as Request,
        response,
      );

      expect(response.statusCode).toBe(404);
      expect(response.body).toEqual({
        ok: false,
        error: 'Training-support card unavailable.',
        code: 'TRAINING_SUPPORT_UNAVAILABLE',
      });
      expect(JSON.stringify(response.body)).not.toContain(code);
      expect(JSON.stringify(response.body)).not.toContain('private');
      expect(response.set).toHaveBeenCalledWith(
        'Cache-Control',
        'private, no-store',
      );
    },
  );
});
