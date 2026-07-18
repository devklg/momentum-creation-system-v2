import { describe, expect, it, vi } from 'vitest';
import {
  readCurrentKongaReplay,
  recordKongaReplayCompletion,
  rotateKongaReplay,
} from '../kongaReplay.js';

const replay = {
  contractVersion: 'konga-v1' as const,
  eventId: 'webinar-past',
  resourceVersionId: 'resource-version-approved',
  recordedAt: '2026-07-10T00:00:00.000Z',
  availableAt: '2026-07-11T00:00:00.000Z',
  displayDate: 'July 9, 2026',
  publicationStatus: 'active' as const,
};

describe('Konga replay authority and isolation', () => {
  it('rotates only to an already-authorized ACR-0033 resource version', async () => {
    const strictWrite = vi.fn(async (_input: unknown) => ({ mongo: {}, neo4jCount: 1, chromaId: 'x' }));
    const result = await rotateKongaReplay(
      { ...replay, authorizedByTmagId: 'TMBA-ADMIN', now: new Date('2026-07-17T00:00:00Z') },
      {
        persistence: vi.fn(async () => ({ documents: [] })) as never,
        eventFinder: vi.fn(async () => ({
          eventId: replay.eventId,
          scheduledFor: '2026-07-09T00:00:00.000Z',
        })) as never,
        gate: vi.fn(async () => ({
          allowed: true,
          evidence: { evidenceId: 'authority-evidence' },
        })) as never,
        strictWrite: strictWrite as never,
      },
    );
    expect(result.resourceVersionId).toBe(replay.resourceVersionId);
    expect(strictWrite).toHaveBeenCalledTimes(1);
  });

  it('fails closed when resource authority is absent', async () => {
    await expect(
      rotateKongaReplay(
        { ...replay, authorizedByTmagId: 'TMBA-ADMIN' },
        {
          persistence: vi.fn(async () => ({ documents: [] })) as never,
          eventFinder: vi.fn(async () => ({
            eventId: replay.eventId,
            scheduledFor: '2026-07-09T00:00:00.000Z',
          })) as never,
          gate: vi.fn(async () => ({ allowed: false, evidence: null })) as never,
        },
      ),
    ).rejects.toThrow('konga_replay_resource_not_authorized');
  });

  it('replay_complete persists only a completion/unlock record and never a placement', async () => {
    const strictWrite = vi.fn(async (_input: unknown) => ({ mongo: {}, neo4jCount: 1, chromaId: 'x' }));
    const completion = await recordKongaReplayCompletion(
      {
        token: 'TOKEN-REPLAY',
        replayEventId: replay.eventId,
        resourceVersionId: replay.resourceVersionId,
        now: new Date('2026-07-17T12:00:00.000Z'),
      },
      {
        persistence: vi.fn(async () => ({ documents: [] })) as never,
        replayReader: vi.fn(async () => replay),
        strictWrite: strictWrite as never,
      },
    );
    expect(completion.completedAt).toBe('2026-07-17T12:00:00.000Z');
    const write = strictWrite.mock.calls[0]![0] as {
      mongoCollection: string;
      mongoDoc: Record<string, unknown>;
    };
    expect(write.mongoCollection).toBe('tmag_konga_replay_completions');
    expect(write.mongoDoc.callbackUnlocked).toBe(true);
    expect(write.mongoCollection).not.toContain('placement');
  });

  it('reads only the current authorized pointer', async () => {
    const result = await readCurrentKongaReplay(
      new Date('2026-07-17T00:00:00Z'),
      {
        persistence: vi.fn(async () => ({ documents: [replay] })) as never,
        gate: vi.fn(async () => ({ allowed: true })) as never,
      },
    );
    expect(result).toEqual(replay);
  });
});
