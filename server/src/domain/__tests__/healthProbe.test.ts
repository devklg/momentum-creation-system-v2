import { describe, expect, it, vi } from 'vitest';
import {
  handleHealthStatusTransition,
  readHealthStatusFile,
  runTripleStackHealthProbe,
  type HealthStatusFile,
} from '../healthProbe.js';
import type { McsTripleStackWriteResult } from '@momentum/shared';

type AnyRec = Record<string, unknown>;

const GREEN_STATUS: HealthStatusFile = {
  checkedAt: '2026-07-05T00:00:00.000Z',
  overall: 'green',
  checks: [{ name: 'api', ok: true, detail: 'ok' }],
};

const RED_STATUS: HealthStatusFile = {
  checkedAt: '2026-07-05T00:15:00.000Z',
  overall: 'red',
  checks: [
    { name: 'api', ok: true, detail: 'ok' },
    { name: 'triple_stack', ok: false, detail: 'failed leg(s): chroma' },
  ],
};

function persistenceWithChroma(chromaOk = true, options: { metadataOnly?: boolean } = {}) {
  return vi.fn(async (tool: string, action: string, params: AnyRec) => {
    if (tool === 'mongodb' && action === 'query') return { count: 1, documents: [{ _id: 'health_fixed' }] };
    if (tool === 'mongodb' && action === 'delete') return { deletedCount: 0 };
    if (tool === 'neo4j' && action === 'cypher') {
      const query = String(params.query ?? '');
      if (query.includes('RETURN h')) return { records: [{ h: { heartbeatId: 'health_fixed' } }] };
      return { records: [], summary: { counters: {} } };
    }
    if (tool === 'chromadb' && action === 'query_with_filter') {
      const canonicalFilter = (params.where as AnyRec | undefined)?.heartbeatId === 'health_fixed';
      return {
        results: {
          ids: chromaOk && canonicalFilter && !options.metadataOnly ? ['health_fixed'] : [],
          metadatas: chromaOk && canonicalFilter ? [{ heartbeatId: 'health_fixed' }] : [],
        },
      };
    }
    if (tool === 'chromadb' && action === 'delete') return { ok: true };
    throw new Error(`unexpected ${tool}.${action}`);
  });
}

function okTripleStackResult(): McsTripleStackWriteResult {
  return {
    mongo: { ok: true, insertedCount: 1 },
    neo4j: { ok: true, counters: {} },
    chroma: { ok: true, verified: true },
  };
}

describe('production health triple-stack probe', () => {
  it('writes through tripleStackWrite, reads all three legs back, and prunes old heartbeats', async () => {
    const write = vi.fn(async (_input: unknown) => okTripleStackResult());
    const persistence = persistenceWithChroma(true);

    const result = await runTripleStackHealthProbe({
      id: () => 'health_fixed',
      now: () => new Date('2026-07-05T00:00:00.000Z'),
      write,
      persistence: persistence as never,
    });

    expect(result.ok).toBe(true);
    expect(result.legs).toEqual({ mongo: true, neo4j: true, chroma: true });
    expect(write).toHaveBeenCalledTimes(1);
    const call = write.mock.calls[0]![0] as unknown as AnyRec;
    expect(call.mongoCollection).toBe('tmag_health_heartbeat');
    expect((call.chroma as AnyRec).collection).toBe('mcs_health_heartbeat');
    expect(((call.chroma as AnyRec).metadata as AnyRec).heartbeatId).toBe('health_fixed');
    expect(((call.chroma as AnyRec).metadata as AnyRec).healthHeartbeatId).toBeUndefined();
    expect(persistence).toHaveBeenCalledWith(
      'chromadb',
      'query_with_filter',
      expect.objectContaining({
        collection: 'mcs_health_heartbeat',
        where: { heartbeatId: 'health_fixed' },
      }),
    );
    expect(persistence).toHaveBeenCalledWith(
      'chromadb',
      'delete',
      expect.objectContaining({ collection: 'mcs_health_heartbeat' }),
    );
  });

  it('reports a specific failed Chroma leg when Chroma readback is missing', async () => {
    const result = await runTripleStackHealthProbe({
      id: () => 'health_fixed',
      write: vi.fn(async (_input: unknown) => okTripleStackResult()),
      persistence: persistenceWithChroma(false) as never,
    });

    expect(result.ok).toBe(false);
    expect(result.legs).toEqual({ mongo: true, neo4j: true, chroma: false });
    expect(result.legDetails.chroma).toBe('readback_missing');
  });

  it('accepts Chroma readback by canonical heartbeat metadata even when ids are absent', async () => {
    const result = await runTripleStackHealthProbe({
      id: () => 'health_fixed',
      write: vi.fn(async (_input: unknown) => okTripleStackResult()),
      persistence: persistenceWithChroma(true, { metadataOnly: true }) as never,
    });

    expect(result.ok).toBe(true);
    expect(result.legs.chroma).toBe(true);
  });

  it('classifies write failures by the persistence leg named in the error', async () => {
    const result = await runTripleStackHealthProbe({
      id: () => 'health_fixed',
      write: vi.fn(async () => {
        throw new Error('[persistence:neo4j.cypher] unavailable');
      }),
      persistence: persistenceWithChroma(true) as never,
    });

    expect(result.ok).toBe(false);
    expect(result.legs.neo4j).toBe(false);
    expect(result.legDetails.neo4j).toContain('neo4j');
  });
});

describe('production health status file', () => {
  it('parses the committed status-file shape', async () => {
    const reader = {
      readFile: vi.fn(async () => JSON.stringify(GREEN_STATUS)),
    };

    const result = await readHealthStatusFile('/tmp/health-status.json', reader as never);

    expect(result.ok).toBe(true);
    expect(result.status).toEqual(GREEN_STATUS);
  });
});

describe('production health alert transition', () => {
  it('queues one SMS alert only on green-to-red', async () => {
    const write = vi.fn(async (_input: unknown) => okTripleStackResult());
    const persistence = vi.fn(async () => ({}));
    const writeFile = vi.fn(async () => undefined);
    const mkdir = vi.fn(async () => undefined);

    const first = await handleHealthStatusTransition(RED_STATUS, '/tmp/health-alert-state.json', {
      readFile: vi.fn(async () => JSON.stringify({ lastOverall: 'green' })) as never,
      writeFile: writeFile as never,
      mkdir: mkdir as never,
      id: () => 'fixed',
      write,
      persistence: persistence as never,
      now: () => new Date('2026-07-05T00:16:00.000Z'),
    });

    expect(first.alertQueued).toBe(true);
    expect(first.reason).toBe('green_to_red');
    expect(write).toHaveBeenCalledTimes(1);
    expect(persistence).toHaveBeenCalledTimes(1);

    write.mockClear();
    persistence.mockClear();
    const second = await handleHealthStatusTransition(RED_STATUS, '/tmp/health-alert-state.json', {
      readFile: vi.fn(async () => JSON.stringify({ lastOverall: 'red' })) as never,
      writeFile: writeFile as never,
      mkdir: mkdir as never,
      write,
      persistence: persistence as never,
    });

    expect(second.alertQueued).toBe(false);
    expect(second.reason).toBe('no_transition');
    expect(write).not.toHaveBeenCalled();
    expect(persistence).not.toHaveBeenCalled();
  });
});
