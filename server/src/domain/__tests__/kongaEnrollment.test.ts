import { createHash } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  attestKongaEnrollment,
  KongaEnrollmentError,
} from '../kongaEnrollment.js';
import { deriveKongaPlacementIdentity } from '../kongaPlacement.js';

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
  invitationRecordId: 'invite-match',
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

function snapshotState() {
  placement.flushedAt = null;
  placement.flushReason = null;
  placement.placementAttemptId = deriveKongaPlacementIdentity({
    prospectId: prospect.prospectId,
    invitationRecordId: 'invite-match',
  }).placementAttemptId;
  token.invitationRecordId = 'invite-match';
  token.state = 'video_complete';
  token.createdAt = '2026-07-01T00:00:00.000Z';
  prospect.state = 'video_complete';
}

function filterDocuments<T extends Record<string, unknown>>(rows: readonly T[], filter: Record<string, unknown>): T[] {
  return rows.filter((row) =>
    Object.entries(filter).every(
      ([key, value]) =>
        row[key as keyof T] === value,
    ),
  );
}

function persistenceFixture(options?: { tokenRecords?: typeof token[]; enrolleeRows?: typeof enrollee[] }) {
  const attestations: Record<string, unknown>[] = [];
  const tokenRecords = options?.tokenRecords ? options.tokenRecords.map((row) => ({ ...row })) : [token];
  const enrolleeRows = options?.enrolleeRows ? options.enrolleeRows : [enrollee];
  const call = vi.fn(async (_tool: string, action: string, params: Record<string, unknown>) => {
    const collection = params.collection;
    const filter = (params.filter ?? {}) as Record<string, unknown>;
    if (action === 'update') {
      const update = params.update as { $set: Record<string, unknown> };
      if (collection === 'tmag_prospect_htank_placements') Object.assign(placement, update.$set);
      if (collection === 'tmag_prospects') Object.assign(prospect, update.$set);
      if (collection === 'tmag_prospect_invite_tokens') {
        if (!filter) return { matchedCount: 1 };
        const target = filterDocuments(tokenRecords, filter as Record<string, unknown>).at(0);
        if (target) Object.assign(target, update.$set);
      }
      return { matchedCount: 1 };
    }
    if (action !== 'query') return {};
    if (collection === 'tmag_prospects') return { documents: filterDocuments([prospect], filter as Record<string, unknown>) };
    if (collection === 'tmag_prospect_htank_placements') {
      const docs = filterDocuments([placement], filter as Record<string, unknown>);
      if (!docs.length && filter.flushedAt === null) return { documents: [] };
      return { documents: docs };
    }
    if (collection === 'tmag_prospect_invite_tokens') {
      return { documents: filterDocuments(tokenRecords, filter as Record<string, unknown>) };
    }
    if (collection === 'team_magnificent_members') {
      return { documents: filterDocuments(enrolleeRows, filter as Record<string, unknown>) };
    }
    if (collection === 'tmag_konga_enrollment_attestations') {
      return { documents: [...attestations] };
    }
    return { documents: [] };
  });
  return { call, attestations };
}

beforeEach(() => {
  snapshotState();
});

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

  it('writes enrollment graph link by tokenHash and never passes raw token to Neo4j params', async () => {
    const fixture = persistenceFixture();
    const publish = vi.fn();
    const strictWrite = vi.fn(async (write: Record<string, unknown>) => {
      neoPayload = write;
      return { mongo: write, neo4jCount: 1, chromaId: write.id };
    }) as never;
    let neoPayload: Record<string, unknown> | null = null;
    const expectedTokenHash = createHash('sha256').update(token.token).digest('hex');

    await attestKongaEnrollment(input, {
      persistence: fixture.call as never,
      strictWrite,
      strictVerify: vi.fn(async () => ({ mongo: {}, neo4jCount: 1, chromaId: 'x' })),
      publish,
    });

    expect(strictWrite).toHaveBeenCalledTimes(1);
    expect(neoPayload).not.toBeNull();
    const neoPayloadJson = neoPayload as { neo4j?: { cypher: string; params: Record<string, unknown> } } | null;
    if (!neoPayloadJson) throw new Error('strictWrite payload missing');
    const neoQuery = neoPayloadJson.neo4j?.cypher ?? '';
    const neoParams = neoPayloadJson.neo4j?.params ?? {};
    expect(neoQuery).toContain('TmagInviteToken {tokenHash:');
    expect(neoParams).toMatchObject({ tokenHash: expectedTokenHash });
    expect(neoParams).not.toMatchObject({ token: token.token });
    expect(JSON.stringify(neoParams)).not.toContain(token.token);
    expect(publish).toHaveBeenCalledTimes(1);
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

  it('rejects enrollment when token attempt does not match the live placement attempt', async () => {
    const strictWrite = vi.fn();
    const strictVerify = vi.fn();
    placement.placementAttemptId = deriveKongaPlacementIdentity({
      prospectId: prospect.prospectId,
      invitationRecordId: 'invite-live-mismatch',
    }).placementAttemptId;
    token.invitationRecordId = 'invite-token-mismatch';
    token.createdAt = '2026-07-01T00:00:00.000Z';

    const fixture = persistenceFixture();
    const publish = vi.fn();
    await expect(
      attestKongaEnrollment(input, {
        persistence: fixture.call as never,
        strictWrite: strictWrite as never,
        strictVerify: strictVerify as never,
        publish,
      }),
    ).rejects.toEqual(new KongaEnrollmentError('exact_live_linkage_required'));
    expect(publish).not.toHaveBeenCalled();
    expect(strictWrite).not.toHaveBeenCalled();
    expect(strictVerify).not.toHaveBeenCalled();
    expect(JSON.stringify(fixture.call.mock.calls)).not.toContain(token.token);
  });

  it('rejects token A enrollment against token B placement attempt', async () => {
    placement.placementAttemptId = deriveKongaPlacementIdentity({
      prospectId: prospect.prospectId,
      invitationRecordId: 'invite-other',
    }).placementAttemptId;
    const fixture = persistenceFixture({
      tokenRecords: [
        {
          ...token,
          token: 'TOKEN-A',
          invitationRecordId: 'invite-match',
          state: 'video_complete',
          createdAt: '2026-07-01T00:00:00.000Z',
        },
      ],
    });
    const publish = vi.fn();
    await expect(
      attestKongaEnrollment(input, {
        persistence: fixture.call as never,
        publish,
        strictWrite: vi.fn(async () => {
          throw new Error('must not create enrollment');
        }) as never,
        strictVerify: vi.fn(async () => {
          throw new Error('must not verify');
        }) as never,
      }),
    ).rejects.toEqual(new KongaEnrollmentError('exact_live_linkage_required'));
    expect(publish).not.toHaveBeenCalled();
  });

  it('rejects token B enrollment against token A placement attempt', async () => {
    placement.placementAttemptId = deriveKongaPlacementIdentity({
      prospectId: prospect.prospectId,
      invitationRecordId: 'invite-match',
    }).placementAttemptId;
    const fixture = persistenceFixture({
      tokenRecords: [
        {
          ...token,
          token: 'TOKEN-B',
          invitationRecordId: 'invite-other',
          state: 'video_complete',
          createdAt: '2026-07-01T00:00:00.000Z',
        },
      ],
    });
    const publish = vi.fn();
    await expect(
      attestKongaEnrollment(input, {
        persistence: fixture.call as never,
        publish,
        strictWrite: vi.fn(async () => {
          throw new Error('must not create enrollment');
        }) as never,
        strictVerify: vi.fn(async () => {
          throw new Error('must not verify');
        }) as never,
      }),
    ).rejects.toEqual(new KongaEnrollmentError('exact_live_linkage_required'));
    expect(publish).not.toHaveBeenCalled();
  });

  it('rejects partial enrollment linkage when no video-complete token matches the placement', async () => {
    const strictWrite = vi.fn();
    const strictVerify = vi.fn();
    token.invitationRecordId = 'invite-live-match';
    token.state = 'video_started';
    token.createdAt = '2026-07-01T00:00:00.000Z';
    const fixture = persistenceFixture();
    const publish = vi.fn();
    await expect(
      attestKongaEnrollment(input, {
        persistence: fixture.call as never,
        strictWrite: strictWrite as never,
        strictVerify: strictVerify as never,
        publish,
      }),
    ).rejects.toEqual(new KongaEnrollmentError('exact_live_linkage_required'));
    expect(publish).not.toHaveBeenCalled();
    expect(strictWrite).not.toHaveBeenCalled();
    expect(strictVerify).not.toHaveBeenCalled();
  });

  it('attests the matching invitation when multiple video-complete invitations exist for one prospect', async () => {
    const matching = deriveKongaPlacementIdentity({
      prospectId: prospect.prospectId,
      invitationRecordId: 'invite-match',
    });
    const ignored = deriveKongaPlacementIdentity({
      prospectId: prospect.prospectId,
      invitationRecordId: 'invite-ignored',
    });
    placement.placementAttemptId = matching.placementAttemptId;
    token.state = 'video_complete';
    prospect.state = 'video_complete';
    const fixture = persistenceFixture({
      tokenRecords: [
        {
          ...token,
          token: 'TOKEN-IGNORED',
          invitationRecordId: 'invite-ignored',
          createdAt: '2026-07-01T00:00:00.000Z',
          state: 'video_complete',
        },
        {
          ...token,
          token: 'TOKEN-MATCH',
          invitationRecordId: 'invite-match',
          createdAt: '2026-07-02T00:00:00.000Z',
          state: 'video_complete',
        },
      ],
    });
    const publish = vi.fn();

    await attestKongaEnrollment(input, {
      persistence: fixture.call as never,
      strictWrite: vi.fn(async (write: { id: string; mongoDoc: Record<string, unknown> }) => {
        fixture.call;
        return { mongo: write.mongoDoc, neo4jCount: 1, chromaId: write.id };
      }) as never,
      strictVerify: vi.fn(async () => ({ mongo: {}, neo4jCount: 1, chromaId: 'x' })),
      publish,
    });

    const tokenUpdate = fixture.call.mock.calls.find(
      ([tool, action, params]) =>
        tool === 'mongodb' &&
        action === 'update' &&
        (params.collection as string) === 'tmag_prospect_invite_tokens',
    );
    expect(tokenUpdate?.[2]).toMatchObject({
      collection: 'tmag_prospect_invite_tokens',
      filter: { token: 'TOKEN-MATCH' },
    });
    expect(ignored.placementAttemptId).not.toBe(matching.placementAttemptId);
    expect(publish).toHaveBeenCalledTimes(1);
  });

  it('supports direct enrollment idempotence and treats repeated matching requests as already-attested', async () => {
    const fixture = persistenceFixture();
    const publish = vi.fn();
    const strictWrite = vi.fn(async (write: { id: string; mongoDoc: Record<string, unknown> }) => {
      fixture.attestations.push({ _id: write.id, ...write.mongoDoc });
      return { mongo: write.mongoDoc, neo4jCount: 1, chromaId: write.id };
    });

    const first = await attestKongaEnrollment(input, {
      persistence: fixture.call as never,
      strictWrite,
      strictVerify: vi.fn(async () => ({ mongo: placement, neo4jCount: 1, chromaId: placement.placementId })),
      publish,
    });
    const second = await attestKongaEnrollment(input, {
      persistence: fixture.call as never,
      strictWrite,
      strictVerify: vi.fn(async () => ({ mongo: placement, neo4jCount: 1, chromaId: placement.placementId })),
      publish,
    });

    expect(first.alreadyAttested).toBe(false);
    expect(second.alreadyAttested).toBe(true);
    expect(strictWrite).toHaveBeenCalledTimes(1);
    expect(publish).toHaveBeenCalledTimes(1);
  });

  it('rejects legacy legacy raw-token identity without a non-secret fallback path', async () => {
    token.invitationRecordId = undefined as unknown as string;
    token.createdAt = undefined as unknown as string;
    const fixture = persistenceFixture({
      tokenRecords: [
        ({
          ...token,
          token: 'TOKEN-RAW',
          _id: 'TOKEN-RAW',
          createdAt: undefined as unknown as string,
          state: 'video_complete',
        } as typeof token & { _id: string }),
      ],
    });
    const publish = vi.fn();
    await expect(
      attestKongaEnrollment(input, {
        persistence: fixture.call as never,
        publish,
        strictWrite: vi.fn(),
      }),
    ).rejects.toEqual(new KongaEnrollmentError('legacy_placement_requires_no_backfill'));
    expect(publish).not.toHaveBeenCalled();
  });

  it('rejects legacy placement records lacking attempt identity', async () => {
    const legacyPlacement = {
      ...placement,
      // Simulates pre-identity records: no identity fields.
      placementAttemptId: undefined as unknown as string,
    };
    const fixture = persistenceFixture({
      tokenRecords: [token],
    });
    const originalFixture = fixture.call;
    const legacyPersistence = vi.fn(async (tool: string, action: string, params: Record<string, unknown>) => {
      const result = await originalFixture(tool, action, params);
      if (action === 'query' && params.collection === 'tmag_prospect_htank_placements') {
        return { documents: [legacyPlacement] };
      }
      return result;
    });
    const publish = vi.fn();

    await expect(
      attestKongaEnrollment(input, {
        persistence: legacyPersistence as never,
        publish,
      }),
    ).rejects.toEqual(new KongaEnrollmentError('legacy_placement_requires_no_backfill'));
    expect(publish).not.toHaveBeenCalled();
  });
});
