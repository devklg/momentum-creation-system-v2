import type { NextFunction, Request, Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  isSteveDiscoveryComplete: vi.fn(),
}));

vi.mock('../../domain/steve-success-interview.js', () => ({
  isSteveDiscoveryComplete: mocks.isSteveDiscoveryComplete,
}));

import { requireSteveComplete } from '../requireSteveComplete.js';

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

function mockRequest(
  originalUrl: string,
  tmagId?: string,
): Request {
  const path = originalUrl.split('?')[0] ?? originalUrl;
  return {
    originalUrl,
    path,
    ...(tmagId ? { session: { tmagId } } : {}),
  } as unknown as Request;
}

beforeEach(() => {
  mocks.isSteveDiscoveryComplete.mockReset();
});

describe('requireSteveComplete', () => {
  it.each([
    '/api/steve/discovery/state?refresh=1',
    '/api/steve/discovery/script',
    '/api/cockpit/launch',
    '/api/training/fast-start/modules/1',
  ])('keeps the approved pre-Steve path open: %s', async (originalUrl) => {
    const next = vi.fn() as NextFunction;
    const response = mockResponse();

    await requireSteveComplete(mockRequest(originalUrl), response, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(response.json).not.toHaveBeenCalled();
    expect(mocks.isSteveDiscoveryComplete).not.toHaveBeenCalled();
  });

  it('requires authentication on a non-whitelisted Steve route', async () => {
    const next = vi.fn() as NextFunction;
    const response = mockResponse();

    await requireSteveComplete(
      mockRequest('/api/steve/discovery/conversation'),
      response,
      next,
    );

    expect(response.statusCode).toBe(401);
    expect(response.body).toEqual({ ok: false, error: 'Not authenticated.' });
    expect(next).not.toHaveBeenCalled();
  });

  it('returns STEVE_GATE_CLOSED while discovery is incomplete', async () => {
    mocks.isSteveDiscoveryComplete.mockResolvedValueOnce(false);
    const next = vi.fn() as NextFunction;
    const response = mockResponse();

    await requireSteveComplete(
      mockRequest('/api/cockpit/summary', 'TMAG-001'),
      response,
      next,
    );

    expect(mocks.isSteveDiscoveryComplete).toHaveBeenCalledWith('TMAG-001');
    expect(response.statusCode).toBe(403);
    expect(response.body).toEqual({
      ok: false,
      error: 'Locked. Complete your Steve discovery first.',
      code: 'STEVE_GATE_CLOSED',
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('opens an ordinary BA route after Steve completion', async () => {
    mocks.isSteveDiscoveryComplete.mockResolvedValueOnce(true);
    const next = vi.fn() as NextFunction;

    await requireSteveComplete(
      mockRequest('/api/cockpit/summary', 'TMAG-001'),
      mockResponse(),
      next,
    );

    expect(mocks.isSteveDiscoveryComplete).toHaveBeenCalledWith('TMAG-001');
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('does not let the module-1 exception open later Fast Start modules', async () => {
    mocks.isSteveDiscoveryComplete.mockResolvedValueOnce(false);
    const next = vi.fn() as NextFunction;
    const response = mockResponse();

    await requireSteveComplete(
      mockRequest('/api/training/fast-start/modules/2', 'TMAG-001'),
      response,
      next,
    );

    expect(mocks.isSteveDiscoveryComplete).toHaveBeenCalledWith('TMAG-001');
    expect(response.statusCode).toBe(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('fails closed when completion evidence cannot be read', async () => {
    mocks.isSteveDiscoveryComplete.mockRejectedValueOnce(new Error('store unavailable'));
    const next = vi.fn() as NextFunction;
    const response = mockResponse();

    await requireSteveComplete(
      mockRequest('/api/cockpit/summary', 'TMAG-001'),
      response,
      next,
    );

    expect(response.statusCode).toBe(500);
    expect(response.body).toEqual({
      ok: false,
      error: 'Gate check failed: store unavailable',
    });
    expect(next).not.toHaveBeenCalled();
  });
});
