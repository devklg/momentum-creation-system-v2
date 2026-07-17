import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import {
  MCS_FAST_START_CONTENT_VERSIONING_BOUNDARY,
  MCS_ORIENTATION_CURRICULUM_RESOURCE_VERSION,
  validateContentVersionBinding,
  validateResourceCatalogEntry,
  type McsContentVersionBinding,
  type McsResourceCatalogEntry,
} from '@momentum/shared';
import {
  ContentVersioningError,
  buildOrientationCurriculumCatalogEntry,
  ensureOrientationCurriculumResourceVersion,
  resolveOrientationContentBinding,
  verifyOrientationSessionContentBinding,
} from '../contentVersioning.js';

const NOW = new Date('2026-07-16T23:00:00.000Z');

function allowed(resourceVersionId: string) {
  return {
    allowed: true,
    mode: 'retrieve' as const,
    resourceVersionId,
    reasons: [],
    evidence: {
      evidenceId: `ready_${resourceVersionId}`,
      resourceVersionId,
      contentDigestSha256: 'a'.repeat(64),
      catalogUpdatedAt: NOW.toISOString(),
      neo4jProjectedAt: NOW.toISOString(),
      chromaProjectedAt: NOW.toISOString(),
      verifiedAt: NOW.toISOString(),
    },
  };
}

function supportResource(): McsResourceCatalogEntry {
  const entry = buildOrientationCurriculumCatalogEntry(NOW);
  return {
    ...entry,
    resourceId: 'knowledge:orientation-support',
    resourceVersionId: 'knowledge:orientation-support:v2',
    version: 2,
    title: 'Orientation support',
    contentDigestSha256: 'c'.repeat(64),
    authority: { ...entry.authority, kind: 'kevin_approved' },
  };
}

describe('P2-142 content versioning', () => {
  it('defines a valid immutable orientation catalog version', () => {
    const entry = buildOrientationCurriculumCatalogEntry(NOW);
    expect(validateResourceCatalogEntry(entry)).toEqual([]);
    expect(entry).toMatchObject({
      resourceVersionId: 'training:orientation:ten_step:v1',
      version: 1,
      lifecycle: 'active',
      contentDigestSha256: MCS_ORIENTATION_CURRICULUM_RESOURCE_VERSION.contentDigestSha256,
      contentLocator: { type: 'repo_file', locator: 'apps/team/src/routes/training/10-steps.tsx' },
      authority: { kind: 'code_owned', evidenceId: 'ACR-0033' },
    });
  });

  it('fails if orientation source changes without an explicit version and digest update', async () => {
    const sourcePath = fileURLToPath(
      new URL('../../../../apps/team/src/routes/training/10-steps.tsx', import.meta.url),
    );
    const source = (await readFile(sourcePath, 'utf8')).replace(/\r\n/g, '\n');
    const digest = createHash('sha256').update(source, 'utf8').digest('hex');
    expect(digest).toBe(MCS_ORIENTATION_CURRICULUM_RESOURCE_VERSION.contentDigestSha256);
  });

  it('keeps Fast Start on the resource catalog contract without ratifying current content', () => {
    expect(MCS_FAST_START_CONTENT_VERSIONING_BOUNDARY).toMatchObject({
      contentAuthority: 'tmag_resource_catalog',
      bindingIdentity: 'resourceVersionId',
      activationStatus: 'deferred_pending_post_audit_app_review',
      currentApprovedContentVersionIds: [],
    });
  });

  it('writes a missing orientation version once and requires exact three-store readiness', async () => {
    const persistence = vi.fn(async () => ({ documents: [] }));
    const writer = vi.fn(async () => ({
      mongo: { ok: true },
      neo4j: { ok: true },
      chroma: { ok: true },
    }));
    const gate = vi.fn(async (resourceVersionId: string) => allowed(resourceVersionId));

    const entry = await ensureOrientationCurriculumResourceVersion(
      persistence as never,
      writer as never,
      gate as never,
      () => NOW,
    );

    expect(writer).toHaveBeenCalledOnce();
    expect(writer).toHaveBeenCalledWith(expect.objectContaining({
      id: entry.resourceVersionId,
      mongoCollection: 'tmag_resource_catalog',
      chroma: expect.objectContaining({ collection: 'mcs_resource_catalog' }),
    }));
    expect(gate).toHaveBeenCalledWith(entry.resourceVersionId, 'retrieve', persistence);
  });

  it('refuses an in-place digest change for an existing immutable version', async () => {
    const conflicting = {
      ...buildOrientationCurriculumCatalogEntry(NOW),
      contentDigestSha256: 'f'.repeat(64),
    };
    const persistence = vi.fn(async () => ({ documents: [conflicting] }));
    await expect(ensureOrientationCurriculumResourceVersion(persistence as never)).rejects.toThrowError(
      new ContentVersioningError('orientation_curriculum_immutable_version_conflict'),
    );
  });

  it('snapshots exact verified resource versions with a deterministic digest', async () => {
    const primary = buildOrientationCurriculumCatalogEntry(NOW);
    const support = supportResource();
    let queryCount = 0;
    const persistence = vi.fn(async (tool: string) => {
      if (tool !== 'mongodb') return {};
      queryCount += 1;
      return queryCount === 1 ? { documents: [primary] } : { documents: [support, primary] };
    });
    const writer = vi.fn();
    const gate = vi.fn(async (resourceVersionId: string) => allowed(resourceVersionId));

    const binding = await resolveOrientationContentBinding(
      persistence as never,
      writer as never,
      gate as never,
      () => NOW,
    );

    expect(writer).not.toHaveBeenCalled();
    expect(binding.resources.map((resource) => resource.resourceVersionId)).toEqual([
      'knowledge:orientation-support:v2',
      'training:orientation:ten_step:v1',
    ]);
    expect(binding.primaryResourceVersionId).toBe('training:orientation:ten_step:v1');
    expect(validateContentVersionBinding(binding)).toEqual([]);
    expect(binding.bindingDigestSha256).toMatch(/^[a-f0-9]{64}$/);
  });

  it('reads an orientation session binding back from Mongo, Neo4j, and Chroma', async () => {
    const binding: McsContentVersionBinding = {
      schemaVersion: 'content_version_binding.v1',
      catalogSchemaVersion: 'resource_catalog.v1',
      contextTag: 'context:training:10-steps',
      primaryResourceVersionId: 'training:orientation:ten_step:v1',
      resources: [{
        resourceVersionId: 'training:orientation:ten_step:v1',
        contentDigestSha256: 'a'.repeat(64),
      }],
      bindingDigestSha256: 'b'.repeat(64),
      boundAt: NOW.toISOString(),
    };
    const ids = ['training:orientation:ten_step:v1'];
    const persistence = vi.fn(async (tool: string) => {
      if (tool === 'mongodb') return { documents: [{ contentBinding: binding }] };
      if (tool === 'neo4j') return { records: [{
        primaryResourceVersionId: binding.primaryResourceVersionId,
        bindingDigestSha256: binding.bindingDigestSha256,
        resourceVersionIds: ids,
        deliveredResourceVersionIds: ids,
      }] };
      return {
        ids: ['orientation_1'],
        metadatas: [{
          primaryResourceVersionId: binding.primaryResourceVersionId,
          contentBindingDigestSha256: binding.bindingDigestSha256,
          resourceVersionIdsJson: JSON.stringify(ids),
        }],
      };
    });

    await expect(
      verifyOrientationSessionContentBinding('orientation_1', binding, persistence as never),
    ).resolves.toBeUndefined();
    expect(persistence).toHaveBeenCalledTimes(3);
  });
});
