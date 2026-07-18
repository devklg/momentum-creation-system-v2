import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  findProspectById: vi.fn(),
  findPlacementByProspectIdLive: vi.fn(),
  persistenceCall: vi.fn(),
  updatePoolPlacementOperational: vi.fn(),
  appendAuditEntry: vi.fn(),
}));

vi.mock('../prospects.js', () => ({
  findProspectById: (...args: unknown[]) => mocks.findProspectById(...args),
}));

vi.mock('../../services/persistence/dispatch.js', () => ({
  persistenceCall: (...args: unknown[]) => mocks.persistenceCall(...args),
}));

vi.mock('../poolPlacementPersistence.js', () => ({
  updatePoolPlacementOperational: (...args: unknown[]) => mocks.updatePoolPlacementOperational(...args),
}));

vi.mock('../holdingTank.js', () => ({
  findPlacementByProspectId: () => null,
  findPlacementByProspectIdLive: (...args: unknown[]) =>
    mocks.findPlacementByProspectIdLive(...args),
}));

vi.mock('./auditLog.js', () => ({
  appendAuditEntry: (...args: unknown[]) => mocks.appendAuditEntry(...args),
}));

import {
  executeForceEnrollIntervention,
  executeMoveIntervention,
  executeReassignSponsorIntervention,
} from '../adminProspectOversight.js';

describe('admin prospect oversight interventions', () => {
  beforeEach(() => {
    mocks.findProspectById.mockReset();
    mocks.findPlacementByProspectIdLive.mockReset();
    mocks.persistenceCall.mockReset();
    mocks.updatePoolPlacementOperational.mockReset();
    mocks.appendAuditEntry.mockReset();

    mocks.persistenceCall.mockImplementation(async (_tool: string, action: string, params: { filter?: { tmagId?: string } }) => {
      if (action === 'query') {
        const tmagId = params.filter?.tmagId;
        if (tmagId) return { documents: [{ tmagId, firstName: 'Agent', lastName: 'User' }] };
      }
      return { documents: [] };
    });
  });

  const prospect = {
    prospectId: 'prospect-1',
    sponsorTmagId: 'TMBA-OLD',
    state: 'minted',
    firstName: 'Ada',
    lastName: 'Roe',
    city: 'Austin',
    stateOrRegion: 'TX',
    sponsorTmagIdAtMint: 'TMBA-OLD',
    positionNumber: 42,
    expiresAt: '2026-08-01T00:00:00.000Z',
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-07-01T00:00:00.000Z',
    placedAt: '2026-07-17T00:00:00.000Z',
    prospectSource: 'webinar',
    phone: null,
    email: null,
    notes: '',
    deleted: false,
  } as const;
  const actor = {
    kind: 'admin',
    tmagId: 'TMBA-ADMIN',
    displayName: 'Ops Admin',
  } as const;

  it('MOVE fails when no live placement exists', async () => {
    mocks.findProspectById.mockResolvedValue(prospect);
    mocks.findPlacementByProspectIdLive.mockResolvedValue(null);

    await expect(
      executeMoveIntervention({
        prospectId: 'prospect-1',
        body: {
          requestingTmagId: 'TMBA-REQ',
          reason: 'Need to reassign this prospect to continue operations.',
          toTmagId: 'TMBA-NEW',
        },
        actor: actor as never,
        context: null,
      }),
    ).rejects.toMatchObject({ code: 'no_live_placement', status: 400 });
    expect(mocks.updatePoolPlacementOperational).not.toHaveBeenCalled();
  });

  it('REASSIGN fails when no live placement exists', async () => {
    mocks.findProspectById.mockResolvedValue(prospect);
    mocks.findPlacementByProspectIdLive.mockResolvedValue(null);

    await expect(
      executeReassignSponsorIntervention({
        prospectId: 'prospect-1',
        body: {
          requestingTmagId: 'TMBA-REQ',
          reason: 'Sponsor change required for data repair.',
          newSponsorTmagId: 'TMBA-NEW',
        },
        actor: actor as never,
        context: null,
      }),
    ).rejects.toMatchObject({ code: 'no_live_placement', status: 400 });
    expect(mocks.updatePoolPlacementOperational).not.toHaveBeenCalled();
  });

  it('FORCE ENROLL fails when no live placement exists', async () => {
    mocks.findProspectById.mockResolvedValue(prospect);
    mocks.findPlacementByProspectIdLive.mockResolvedValue(null);

    await expect(
      executeForceEnrollIntervention({
        prospectId: 'prospect-1',
        body: {
          requestingTmagId: 'TMBA-REQ',
          reason: 'Manual recovery to preserve prospect momentum.',
        },
        actor: actor as never,
        context: null,
      }),
    ).rejects.toMatchObject({ code: 'no_live_placement', status: 400 });
    expect(mocks.updatePoolPlacementOperational).not.toHaveBeenCalled();
  });
});
