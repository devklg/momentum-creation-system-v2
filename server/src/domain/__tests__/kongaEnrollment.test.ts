import { describe, expect, it, vi } from 'vitest';
import {
  attestKongaEnrollment,
  KongaEnrollmentError,
} from '../kongaEnrollment.js';

const prospect = {
  prospectId: 'prospect-1',
  firstName: 'Avery',
  lastName: 'Quinn',
  lastInitial: 'Q',
  location: { city: 'Los Angeles', stateOrRegion: 'CA', country: 'US' },
  sponsorTmagId: 'TMBA-SPONSOR',
  state: 'video_complete',
  positionNumber: 91,
  placedAt: '2026-07-10T00:00:00.000Z',
  expiresAt: '2026-09-10T00:00:00.000Z',
};
const placement = {
  prospectId: prospect.prospectId,
  sponsorTmagId: prospect.sponsorTmagId,
  placementId: 'placement-1',
  placementAttemptId: 'attempt-1',
  positionNumber: 91,
  placedAt: prospect.placedAt,
  expiresAt: prospect.expiresAt,
  flushedAt: null as string | null,
  flushReason: null as string | null,
  addedBy: { firstName: 'Jordan', lastInitial: 'R' },
};
const token = {
  token: 'TOKEN-1',
  prospectId: prospect.prospectId,
  sponsorTmagId: prospect.sponsorTmagId,
  state: 'video_complete',
  createdAt: '2026-07-01T00:00:00.000Z',
};
const enrollee = {
  tmagId: 'TMBA-NEW',
  sponsorTmagId: prospect.sponsorTmagId,
};

const input = {
  prospectId: prospect.prospectId,
  sponsorTmagId: prospect.sponsorTmagId,
  enrolleeTmagId: enrollee.tmagId,
  actorTmagId: prospect.sponsorTmagId,
  actorKind: 'sponsor' as const,
  legPlacement: 'left' as const,
  offAppEnrollmentComplete: true,
  legPlacementComplete: true,
  now: new Date('2026-07-17T12:00:00.000Z'),
};

function persistenceFixture() {
  const attestations: Record<string, unknown>[] = [];
  const call = vi.fn(async (_tool: string, action: string, params: Record<string, unknown>) => {
    const collection = params.collection;
    const filter = (params.filter ?? {}) as Record<string, unknown>;
    if (action === 'update') {
      const update = params.update as { $set: Record<string, unknown> };
      if (collection === 'tmag_prospect_htank_placements') Object.assign(placement, update.$set);
      if (collection === 'tmag_prospects') Object.assign(prospect, update.$set);
      if (collection === 'tmag_prospect_invite_tokens') Object.assign(token, update.$set);
      return { matchedCount: 1 };
    }
    if (action !== 'query') return {};
    if (collection === 'tmag_prospects') return { documents: [prospect] };
    if (collection === 'tmag_prospect_htank_placements') {
      if (filter.flushedAt === null && placement.flushedAt !== null) return { documents: [] };
      return { documents: [placement] };
    }
    if (collection === 'tmag_prospect_invite_tokens') return { documents: [token] };
    if (collection === 'team_magnificent_members') return { documents: [enrollee] };
    if (collection === 'tmag_konga_enrollment_attestations') {
      return { documents: [...attestations] };
    }
    return { documents: [] };
  });
  return { call, attestations };
}

describe('truthful Konga join boundary', () => {
  it('rejects registration/CRM-like facts without both human attestations', async () => {
    await expect(
      attestKongaEnrollment({ ...input, legPlacementComplete: false }),
    ).rejects.toEqual(new KongaEnrollmentError('human_attestation_required'));
  });

  it('publishes a minimized join only after governed persistence and final readback', async () => {
    placement.flushedAt = null;
    placement.flushReason = null;
    token.state = 'video_complete';
    prospect.state = 'video_complete';
    const fixture = persistenceFixture();
    const publish = vi.fn();
    const strictWrite = vi.fn(async (write: { id: string; mongoDoc: Record<string, unknown> }) => {
      fixture.attestations.push({ _id: write.id, ...write.mongoDoc });
      return { mongo: write.mongoDoc, neo4jCount: 1, chromaId: write.id };
    });
    const strictVerify = vi.fn(async () => ({ mongo: {}, neo4jCount: 1, chromaId: 'x' }));

    const result = await attestKongaEnrollment(input, {
      persistence: fixture.call as never,
      strictWrite: strictWrite as never,
      strictVerify,
      publish,
    });
    expect(result.event).toEqual({
      contractVersion: 'konga-v1',
      eventId: expect.any(String),
      positionNumber: 91,
      firstName: 'Avery',
      lastInitial: 'Q',
      city: 'Los Angeles',
      stateOrRegion: 'CA',
      addedBy: { firstName: 'Jordan', lastInitial: 'R' },
      joinedAt: '2026-07-17T12:00:00.000Z',
    });
    expect(JSON.stringify(result.event)).not.toContain('TMBA-');
    expect(publish).toHaveBeenCalledTimes(1);
    expect(publish.mock.invocationCallOrder[0]).toBeGreaterThan(
      strictVerify.mock.invocationCallOrder.at(-1)!,
    );
  });

  it('emits no join when one required persistence leg fails', async () => {
    placement.flushedAt = null;
    placement.flushReason = null;
    token.state = 'video_complete';
    prospect.state = 'video_complete';
    const fixture = persistenceFixture();
    const publish = vi.fn();
    await expect(
      attestKongaEnrollment(input, {
        persistence: fixture.call as never,
        strictWrite: vi.fn(async () => {
          throw new Error('konga_neo4j_readback_not_exact');
        }) as never,
        publish,
      }),
    ).rejects.toThrow('konga_neo4j_readback_not_exact');
    expect(publish).not.toHaveBeenCalled();
  });
});
