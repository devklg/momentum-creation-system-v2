import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { NextFunction, Request, Response } from 'express';

const mocks = vi.hoisted(() => ({
  findBAByTmagId: vi.fn(),
}));

vi.mock('../../domain/ba.js', () => ({
  findBAByTmagId: mocks.findBAByTmagId,
}));

import { requireVmDialerAccess } from '../requireVmDialerAccess.js';

function res() {
  const out = {
    statusCode: 200,
    body: null as unknown,
    status: vi.fn((code: number) => {
      out.statusCode = code;
      return out;
    }),
    json: vi.fn((body: unknown) => {
      out.body = body;
      return out;
    }),
  };
  return out as unknown as Response & typeof out;
}

beforeEach(() => {
  mocks.findBAByTmagId.mockReset();
});

describe('requireVmDialerAccess', () => {
  it('returns VM_DIALER_NOT_ENABLED when the member lacks the entitlement', async () => {
    mocks.findBAByTmagId.mockResolvedValue({ tmagId: 'TMBA-1', entitlements: [] });
    const response = res();
    const next = vi.fn() as NextFunction;

    await requireVmDialerAccess(
      { session: { tmagId: 'TMBA-1' } } as unknown as Request,
      response,
      next,
    );

    expect(response.status).toHaveBeenCalledWith(403);
    expect(response.json).toHaveBeenCalledWith({ ok: false, error: 'VM_DIALER_NOT_ENABLED' });
    expect(next).not.toHaveBeenCalled();
  });

  it('allows the request when vm_dialer is granted', async () => {
    mocks.findBAByTmagId.mockResolvedValue({ tmagId: 'TMBA-1', entitlements: ['vm_dialer'] });
    const next = vi.fn() as NextFunction;

    await requireVmDialerAccess(
      { session: { tmagId: 'TMBA-1' } } as unknown as Request,
      res(),
      next,
    );

    expect(next).toHaveBeenCalledTimes(1);
  });
});
