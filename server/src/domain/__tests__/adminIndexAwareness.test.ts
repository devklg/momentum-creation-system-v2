import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const persistence = vi.hoisted(() => ({ persistenceCall: vi.fn() }));
vi.mock('../../services/persistence/dispatch.js', () => persistence);

import { buildAdminIndexAwareness } from '../adminIndexAwareness.js';
import { ADMIN_REQUIRED_INDEXES } from '../adminIndexManifest.js';

beforeEach(() => vi.resetAllMocks());

describe('P2-131 admin index awareness', () => {
  it('keeps the runtime verifier synchronized with the approved JSON manifest', () => {
    const manifest = JSON.parse(readFileSync(
      new URL('../../../../organization/p2-131-admin-index-manifest.json', import.meta.url),
      'utf8',
    )) as { mutationAuthorized: boolean; indexes: typeof ADMIN_REQUIRED_INDEXES };
    expect(manifest.mutationAuthorized).toBe(false);
    expect(manifest.indexes.map(({ collection, name, keys, surface }) => ({ collection, name, keys, surface })))
      .toEqual(ADMIN_REQUIRED_INDEXES);
  });

  it('reports observed, missing, and definition-mismatch states without mutation', async () => {
    const observed = ADMIN_REQUIRED_INDEXES[0]!;
    const mismatch = ADMIN_REQUIRED_INDEXES[1]!;
    persistence.persistenceCall.mockImplementation(
      async (_tool: string, action: string, params: Record<string, unknown>) => {
        expect(action).toBe('list_indexes');
        const collection = String(params.collection);
        if (collection === observed.collection) {
          return { indexes: [{ name: observed.name, keys: observed.keys, unique: false }] };
        }
        if (collection === mismatch.collection) {
          return { indexes: [{ name: mismatch.name, keys: { wrong: 1 }, unique: false }] };
        }
        return { indexes: [] };
      },
    );

    const report = await buildAdminIndexAwareness();
    expect(report.mutationAuthorized).toBe(false);
    expect(report.summary).toEqual({
      required: ADMIN_REQUIRED_INDEXES.length,
      observed: 1,
      missing: ADMIN_REQUIRED_INDEXES.length - 2,
      definitionMismatch: 1,
      notChecked: 0,
    });
    expect(persistence.persistenceCall).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.stringMatching(/create|ensure|apply/i),
      expect.anything(),
    );
  });

  it('reports metadata failures as not checked instead of claiming an index is missing', async () => {
    persistence.persistenceCall.mockRejectedValue(new Error('metadata unavailable'));

    const report = await buildAdminIndexAwareness();

    expect(report.summary).toEqual({
      required: ADMIN_REQUIRED_INDEXES.length,
      observed: 0,
      missing: 0,
      definitionMismatch: 0,
      notChecked: ADMIN_REQUIRED_INDEXES.length,
    });
    expect(report.indexes.every((row) => row.state === 'not_checked')).toBe(true);
  });
});
