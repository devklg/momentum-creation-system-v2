import { beforeEach, describe, expect, it, vi } from 'vitest';

const persistence = vi.hoisted(() => ({ persistenceCall: vi.fn() }));
const tiered = vi.hoisted(() => ({ writeOperational: vi.fn() }));
const content = vi.hoisted(() => ({
  resolveOrientationContentBinding: vi.fn(),
  verifyOrientationSessionContentBinding: vi.fn(),
}));

vi.mock('../../services/persistence/dispatch.js', () => persistence);
vi.mock('../../services/tieredWrite.js', () => tiered);
vi.mock('../../services/contentVersioning.js', () => content);

import { createOrientationSession } from '../orientationSession.js';

beforeEach(() => {
  vi.resetAllMocks();
  persistence.persistenceCall.mockResolvedValue({});
  content.resolveOrientationContentBinding.mockResolvedValue({
    schemaVersion: 'content_version_binding.v1',
    catalogSchemaVersion: 'resource_catalog.v1',
    contextTag: 'context:training:10-steps',
    primaryResourceVersionId: 'training:orientation:ten_step:v1',
    resources: [{
      resourceVersionId: 'training:orientation:ten_step:v1',
      contentDigestSha256: 'a'.repeat(64),
    }],
    bindingDigestSha256: 'b'.repeat(64),
    boundAt: '2026-07-16T00:00:00.000Z',
  });
  content.verifyOrientationSessionContentBinding.mockResolvedValue(undefined);
  tiered.writeOperational.mockResolvedValue({
    neo4j: { ok: true },
    chroma: { ok: true },
  });
});

describe('P2-108 orientation timezone normalization', () => {
  it('canonicalizes an admin-entered offset timestamp to the same UTC instant', async () => {
    const session = await createOrientationSession({
      scheduledFor: '2026-11-01T01:30:00-08:00',
      hosts: ['Kevin Gardner'],
    });

    expect(session.scheduledFor).toBe('2026-11-01T09:30:00.000Z');
    expect(tiered.writeOperational).toHaveBeenCalledWith(expect.objectContaining({
      mongoDoc: expect.objectContaining({ scheduledFor: '2026-11-01T09:30:00.000Z' }),
      neo4j: expect.objectContaining({
        params: expect.objectContaining({ scheduledFor: '2026-11-01T09:30:00.000Z' }),
      }),
      chroma: expect.objectContaining({
        metadata: expect.objectContaining({
          scheduledFor: '2026-11-01T09:30:00.000Z',
          primaryResourceVersionId: 'training:orientation:ten_step:v1',
        }),
      }),
    }));
    expect(content.verifyOrientationSessionContentBinding).toHaveBeenCalledWith(
      session.sessionId,
      session.contentBinding,
    );
  });
});
