import { describe, expect, it, vi } from 'vitest';
import {
  deriveKongaPlacementIdentity,
  placeKongaProspect,
  projectLegacyPlacementAddedBy,
} from '../kongaPlacement.js';

const input = {
  prospectId: 'prospect-1',
  sponsorTmagId: 'TMBA-SPONSOR',
  invitationRecordId: 'immutable-invitation-1',
  prospectExpiresAt: '2026-09-01T00:00:00.000Z',
  firstName: 'Avery',
  lastInitial: 'Q',
  city: 'Los Angeles',
  stateOrRegion: 'CA',
  now: new Date('2026-07-17T18:00:00.000Z'),
};

function successfulPersistence() {
  return vi.fn(async (tool: string, action: string, params: Record<string, unknown>) => {
    const collection = params.collection;
    if (tool === 'mongodb' && action === 'query') {
      if (collection === 'tmag_prospect_htank_placements') return { documents: [] };
      if (collection === 'tmag_prospects') return { documents: [{ prospectId: input.prospectId }] };
    }
    return {};
  });
}

describe('Konga placement permanence', () => {
  it('derives stable attempt identity without exposing the invitation id', () => {
    const a = deriveKongaPlacementIdentity(input);
    const b = deriveKongaPlacementIdentity(input);
    expect(a).toEqual(b);
    expect(JSON.stringify(a)).not.toContain(input.invitationRecordId);
  });

  it('persists minimized addedBy and publishes only after strict readback', async () => {
    const persistence = successfulPersistence();
    const strictWrite = vi.fn(async (_input: unknown) => ({ mongo: {}, neo4jCount: 1, chromaId: 'x' }));
    const publish = vi.fn();
    const result = await placeKongaProspect(input, {
      persistence: persistence as never,
      strictWrite: strictWrite as never,
      publish,
      increment: vi.fn(async () => 41),
      findBa: vi.fn(async () => ({
        tmagId: input.sponsorTmagId,
        firstName: 'Jordan',
        lastName: 'Rivera',
      })) as never,
    });
    expect(result.positionNumber).toBe(41);
    const write = strictWrite.mock.calls[0]![0] as {
      id: string;
      mongoDoc: Record<string, unknown>;
      chroma: { metadata: Record<string, unknown> };
    };
    expect(write.mongoDoc.addedBy).toEqual({ firstName: 'Jordan', lastInitial: 'R' });
    expect(publish).toHaveBeenCalledTimes(1);
    expect(publish.mock.invocationCallOrder[0]).toBeGreaterThan(
      strictWrite.mock.invocationCallOrder[0]!,
    );
  });

  it('emits no SSE when a required persistence leg cannot read back', async () => {
    const publish = vi.fn();
    await expect(
      placeKongaProspect(input, {
        persistence: successfulPersistence() as never,
        strictWrite: vi.fn(async () => {
          throw new Error('konga_chroma_readback_missing');
        }) as never,
        publish,
        increment: vi.fn(async () => 42),
        findBa: vi.fn(async () => ({ firstName: 'Jordan', lastName: 'Rivera' })) as never,
      }),
    ).rejects.toThrow('konga_chroma_readback_missing');
    expect(publish).not.toHaveBeenCalled();
  });

  it('treats the same invitation attempt as idempotent', async () => {
    const ids = deriveKongaPlacementIdentity(input);
    const stored = {
      ...input,
      ...ids,
      sponsorTmagId: input.sponsorTmagId,
      positionNumber: 88,
      placedAt: input.now.toISOString(),
      expiresAt: input.prospectExpiresAt,
      flushedAt: null,
      flushReason: null,
      addedBy: { firstName: 'Jordan', lastInitial: 'R' },
    };
    const persistence = vi.fn(async () => ({ documents: [stored] }));
    const increment = vi.fn();
    const publish = vi.fn();
    const result = await placeKongaProspect(input, {
      persistence: persistence as never,
      strictVerify: vi.fn(async () => ({ mongo: stored, neo4jCount: 1, chromaId: ids.placementId })),
      increment: increment as never,
      publish,
    });
    expect(result.alreadyPlaced).toBe(true);
    expect(result.positionNumber).toBe(88);
    expect(increment).not.toHaveBeenCalled();
    expect(publish).not.toHaveBeenCalled();
  });

  it('blocks a fresh attempt while another placement is still live', async () => {
    let placementQuery = 0;
    const persistence = vi.fn(async (_tool: string, _action: string, params: Record<string, unknown>) => {
      if (params.collection === 'tmag_prospect_htank_placements') {
        placementQuery += 1;
        return placementQuery === 1
          ? { documents: [] }
          : { documents: [{ prospectId: input.prospectId, flushedAt: null, placementId: 'other', placementAttemptId: 'other-attempt' }] };
      }
      return { documents: [] };
    });
    const increment = vi.fn();
    await expect(
      placeKongaProspect(input, { persistence: persistence as never, increment: increment as never }),
    ).rejects.toThrow('konga_live_placement_exists');
    expect(increment).not.toHaveBeenCalled();
  });

  it('allows a fresh invitation after flush to receive a strictly newer position', async () => {
    let next = 100;
    const make = (invitationRecordId: string) =>
      placeKongaProspect(
        { ...input, invitationRecordId },
        {
          persistence: successfulPersistence() as never,
          strictWrite: vi.fn(async () => ({ mongo: {}, neo4jCount: 1, chromaId: 'x' })) as never,
          increment: vi.fn(async () => ++next),
          findBa: vi.fn(async () => ({ firstName: 'Jordan', lastName: 'Rivera' })) as never,
          publish: vi.fn(),
        },
      );
    const prior = await make('prior-invitation-flushed');
    const fresh = await make('fresh-invitation');
    expect('placementAttemptId' in prior).toBe(true);
    expect('placementAttemptId' in fresh).toBe(true);
    if (!('placementAttemptId' in prior) || !('placementAttemptId' in fresh)) {
      throw new Error('expected Konga placement results');
    }
    expect(fresh.placementAttemptId).not.toBe(prior.placementAttemptId);
    expect(fresh.placementId).not.toBe(prior.placementId);
    expect(fresh.positionNumber).toBeGreaterThan(prior.positionNumber);
  });

  it('projects legacy attribution as null without backfill', () => {
    expect(
      projectLegacyPlacementAddedBy({
        prospectId: 'legacy',
        sponsorTmagId: 'TMBA-X',
        positionNumber: 7,
        placedAt: '2025-01-01T00:00:00.000Z',
        expiresAt: '2025-02-01T00:00:00.000Z',
        flushedAt: null,
        flushReason: null,
      }),
    ).toBeNull();
  });
});
