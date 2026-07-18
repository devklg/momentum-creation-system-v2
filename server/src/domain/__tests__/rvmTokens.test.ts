import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  findBulkLeadByToken: vi.fn(),
  findTokenRecord: vi.fn(),
  isTokenExpired: vi.fn(),
  transitionTokenState: vi.fn(),
  findProspectById: vi.fn(),
  applyCrmLifecycleEvent: vi.fn(),
  createOrUpdateCrmRecordForToken: vi.fn(),
  findCrmRecordByProspectId: vi.fn(),
  placeKongaProspect: vi.fn(),
  findNextUpcomingEvent: vi.fn(),
}));

vi.mock('../bulkLeads.js', () => ({
  findBulkLeadByToken: mocks.findBulkLeadByToken,
}));

vi.mock('../tokens.js', () => ({
  findTokenRecord: mocks.findTokenRecord,
  isTokenExpired: mocks.isTokenExpired,
  markTokenOpened: vi.fn(),
  transitionTokenState: mocks.transitionTokenState,
}));

vi.mock('../prospects.js', async () => {
  const actual = await vi.importActual<typeof import('../prospects.js')>('../prospects.js');
  return {
    ...actual,
    findProspectById: mocks.findProspectById,
  };
});

vi.mock('../prospectCrm.js', () => ({
  applyCrmLifecycleEvent: mocks.applyCrmLifecycleEvent,
  createOrUpdateCrmRecordForToken: mocks.createOrUpdateCrmRecordForToken,
  findCrmRecordByProspectId: mocks.findCrmRecordByProspectId,
}));

vi.mock('../kongaPlacement.js', async () => {
  const actual = await vi.importActual<typeof import('../kongaPlacement.js')>('../kongaPlacement.js');
  return {
    ...actual,
    placeKongaProspect: mocks.placeKongaProspect,
  };
});

vi.mock('../webinarEvent.js', () => ({
  findNextUpcomingEvent: mocks.findNextUpcomingEvent,
}));

import { recordRvmVideoEvent } from '../rvmTokens.js';

const bulkLead = {
  leadId: 'lead-1',
  leadOwnerId: 'owner-1',
  vmCampaignId: 'campaign-1',
  token: 'TOKEN-RVM-LIVE',
};

const prospect = {
  prospectId: 'prospect-1',
  firstName: 'Avery',
  lastName: 'Quinn',
  lastInitial: 'Q',
  location: { city: 'Los Angeles', stateOrRegion: 'CA', country: 'US' },
  positionNumber: null,
  placedAt: null,
  expiresAt: '2026-09-10T00:00:00.000Z',
  sponsorTmagId: 'TMBA-SPONSOR',
};

const baseTokenRecord = {
  token: 'TOKEN-RVM-LIVE',
  prospectId: prospect.prospectId,
  sponsorTmagId: prospect.sponsorTmagId,
  state: 'clicked',
  createdAt: '2026-07-01T00:00:00.000Z',
  clickedAt: null,
  expiresAt: '2026-09-10T00:00:00.000Z',
};

const placementResult = {
  contractVersion: 'konga-v1',
  placementId: 'placement-rvm',
  placementAttemptId: 'attempt-rvm',
  positionNumber: 13,
  placedAt: '2026-07-17T00:00:00.000Z',
  alreadyPlaced: false,
};

beforeEach(() => {
  mocks.findBulkLeadByToken.mockReset();
  mocks.findTokenRecord.mockReset();
  mocks.isTokenExpired.mockReset();
  mocks.transitionTokenState.mockReset();
  mocks.findProspectById.mockReset();
  mocks.applyCrmLifecycleEvent.mockReset();
  mocks.createOrUpdateCrmRecordForToken.mockReset();
  mocks.findCrmRecordByProspectId.mockReset();
  mocks.placeKongaProspect.mockReset();
  mocks.findNextUpcomingEvent.mockReset();
});

describe('RVM placement identity', () => {
  it('passes explicit invitationRecordId to Konga placement and never uses raw token as that identity', async () => {
    mocks.findBulkLeadByToken.mockResolvedValue(bulkLead);
    mocks.findTokenRecord.mockResolvedValue({
      ...baseTokenRecord,
      invitationRecordId: 'invite-explicit',
    });
    mocks.isTokenExpired.mockReturnValue(false);
    mocks.transitionTokenState.mockResolvedValue({ state: 'video_complete', changed: true });
    mocks.findProspectById.mockResolvedValue(prospect);
    mocks.placeKongaProspect.mockResolvedValue(placementResult);

    const response = await recordRvmVideoEvent('TOKEN-RVM-LIVE', 'complete');

    const placementInput = mocks.placeKongaProspect.mock.calls[0]![0] as {
      invitationRecordId: string;
    };
    expect(response).toMatchObject({
      token: 'TOKEN-RVM-LIVE',
      state: 'video_complete',
      positionNumber: 13,
      placedAt: '2026-07-17T00:00:00.000Z',
    });
    expect(placementInput.invitationRecordId).toBe('invite-explicit');
    expect(placementInput.invitationRecordId).not.toContain('TOKEN-RVM-LIVE');
    expect('token' in placementInput).toBe(false);
  });

  it('resolves legacy invitation identity from legacy token _id for deterministic placement matching', async () => {
    mocks.findBulkLeadByToken.mockResolvedValue(bulkLead);
    mocks.findTokenRecord.mockResolvedValue({
      ...baseTokenRecord,
      token: 'TOKEN-RVM-LEGACY',
      invitationRecordId: undefined as unknown as string,
      _id: 'TOKEN-RVM-LEGACY',
      createdAt: '2026-07-10T00:00:00.000Z',
      state: 'clicked',
    });
    mocks.isTokenExpired.mockReturnValue(false);
    mocks.transitionTokenState.mockResolvedValue({ state: 'video_complete', changed: true });
    mocks.findProspectById.mockResolvedValue(prospect);
    mocks.placeKongaProspect.mockResolvedValue(placementResult);

    await recordRvmVideoEvent('TOKEN-RVM-LEGACY', 'complete');

    const placementInput = mocks.placeKongaProspect.mock.calls[0]![0] as {
      invitationRecordId: string;
    };
    expect(placementInput.invitationRecordId).toBe(
      'legacy_invitation_prospect-1|TMBA-SPONSOR|2026-07-10T00:00:00.000Z',
    );
  });

  it('rejects legacy raw-token identity without a provable non-secret fallback path', async () => {
    mocks.findBulkLeadByToken.mockResolvedValue(bulkLead);
    mocks.findTokenRecord.mockResolvedValue({
      ...baseTokenRecord,
      token: 'TOKEN-RVM-RAW',
      invitationRecordId: undefined as unknown as string,
      _id: 'TOKEN-RVM-RAW',
      createdAt: undefined as unknown as string,
      state: 'clicked',
    });
    mocks.isTokenExpired.mockReturnValue(false);
    mocks.transitionTokenState.mockResolvedValue({ state: 'video_complete', changed: true });
    mocks.findProspectById.mockResolvedValue(prospect);
    await expect(recordRvmVideoEvent('TOKEN-RVM-RAW', 'complete')).rejects.toThrow(
      'konga_invitation_attempt_identity_unresolved',
    );
  });

  it('does not emit CRM lifecycle milestones again on replayed complete milestone', async () => {
    mocks.findBulkLeadByToken.mockResolvedValue(bulkLead);
    mocks.findTokenRecord.mockResolvedValue({ ...baseTokenRecord, invitationRecordId: 'invite-explicit' });
    mocks.isTokenExpired.mockReturnValue(false);
    mocks.transitionTokenState.mockResolvedValue({ state: 'video_complete', changed: false });
    mocks.findProspectById.mockResolvedValue(prospect);
    mocks.placeKongaProspect.mockResolvedValue({ ...placementResult, alreadyPlaced: true });

    await recordRvmVideoEvent('TOKEN-RVM-LIVE', 'complete');

    expect(mocks.applyCrmLifecycleEvent).not.toHaveBeenCalled();
    expect(mocks.placeKongaProspect).toHaveBeenCalledTimes(1);
  });

  it('does not trigger placement logic on partial milestones', async () => {
    mocks.findBulkLeadByToken.mockResolvedValue(bulkLead);
    mocks.findTokenRecord.mockResolvedValue({ ...baseTokenRecord, invitationRecordId: 'invite-explicit' });
    mocks.isTokenExpired.mockReturnValue(false);
    mocks.transitionTokenState.mockResolvedValue({ state: 'video_started', changed: true });
    mocks.findProspectById.mockResolvedValue(prospect);
    const response = await recordRvmVideoEvent('TOKEN-RVM-LIVE', 'started');

    expect(mocks.placeKongaProspect).not.toHaveBeenCalled();
    expect(response).toMatchObject({
      token: 'TOKEN-RVM-LIVE',
      state: 'video_started',
      positionNumber: prospect.positionNumber,
      placedAt: prospect.placedAt,
    });
  });
});
