import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import type { McsResourceCatalogEntry } from '@momentum/shared';
import { listResourceCenterResources } from '../../domain/resourceCenter.js';

const NOW = '2026-07-13T09:30:00.000Z';

function entry(patch: Partial<McsResourceCatalogEntry> = {}): McsResourceCatalogEntry {
  return {
    schemaVersion: 'resource_catalog.v1',
    resourceId: 'video_product_story',
    resourceVersionId: 'video_product_story_v1',
    tenantId: 'team-magnificent',
    teamId: 'team-magnificent',
    kind: 'content_video',
    title: 'Product Story',
    summary: 'An approved product education video.',
    version: 1,
    lifecycle: 'active',
    audience: { surfaces: ['team'], roles: ['brand_ambassador'], agentScopes: [] },
    language: { mode: 'localized', code: 'en', translationOfResourceVersionId: null, translationStatus: 'approved' },
    authority: { kind: 'kevin_approved', status: 'active_authority', decidedByTmagId: 'TMAG-01', decidedAt: NOW, evidenceId: 'approval_1' },
    readiness: { retrievalMode: 'required', state: 'ready', checks: { content: 'passed', compliance: 'passed', authority: 'passed', translation: 'passed', mongo: 'passed', neo4j: 'passed', chroma: 'passed' }, evidenceIds: ['ready_1'], blockedReasons: [], evaluatedAt: NOW, evaluatedByTmagId: 'TMAG-01' },
    lineage: { originKind: 'admin_upload', sourceSystem: 'product_gallery', sourceCollection: 'tmag_content_videos', sourceRecordId: 'video_1', parentResourceVersionId: null, supersedesResourceVersionId: null, replacementResourceVersionId: null },
    contentLocator: { type: 'route', locator: '/video-library', field: null },
    contentDigestSha256: 'a'.repeat(64),
    tags: ['product', 'confidence'],
    categories: ['Product knowledge'],
    migration: { source: 'native', ambiguities: [] },
    authorTmagId: 'TMAG-01',
    createdAt: NOW,
    updatedAt: NOW,
    ...patch,
  };
}

describe('P2-100 Resource Center verified projection', () => {
  it('returns only BA-audience versions that pass exact retrieval verification', async () => {
    const allowed = entry();
    const blocked = entry({ resourceId: 'blocked', resourceVersionId: 'blocked_v1', title: 'Blocked' });
    const admin = entry({ resourceId: 'admin', resourceVersionId: 'admin_v1', title: 'Admin only', audience: { surfaces: ['admin'], roles: ['founder_admin'], agentScopes: [] } });
    const persistence = vi.fn(async (tool: string, action: string) => {
      if (tool === 'mongodb' && action === 'query') return { documents: [blocked, admin, allowed] };
      throw new Error('unexpected persistence call');
    });
    const verify = vi.fn(async (resourceVersionId: string) => ({ allowed: resourceVersionId === allowed.resourceVersionId }));

    const response = await listResourceCenterResources(persistence as never, verify as never);

    expect(response).toMatchObject({ ok: true, schemaVersion: 'resource_center.v1', categories: ['Product knowledge'], kinds: ['content_video'] });
    expect(response.items).toEqual([expect.objectContaining({ resourceVersionId: allowed.resourceVersionId, openTarget: '/video-library' })]);
    expect(verify).toHaveBeenCalledTimes(2);
  });

  it('fails closed to an empty verified list when candidates do not pass', async () => {
    const persistence = vi.fn(async () => ({ documents: [entry()] }));
    const verify = vi.fn(async () => ({ allowed: false, reasons: ['chroma_projection_stale'] }));
    expect((await listResourceCenterResources(persistence as never, verify as never)).items).toEqual([]);
  });

  it('fails closed when multiple active versions claim one resource identity', async () => {
    const first = entry();
    const second = entry({ resourceVersionId: 'video_product_story_v2', version: 2 });
    const persistence = vi.fn(async () => ({ documents: [first, second] }));
    const verify = vi.fn(async () => ({ allowed: true }));
    expect((await listResourceCenterResources(persistence as never, verify as never)).items).toEqual([]);
    expect(verify).not.toHaveBeenCalled();
  });

  it('does not expose unsafe locator schemes', async () => {
    const unsafe = entry({ contentLocator: { type: 'external_url', locator: 'javascript:alert(1)', field: null } });
    const persistence = vi.fn(async () => ({ documents: [unsafe] }));
    const verify = vi.fn(async () => ({ allowed: true }));
    expect((await listResourceCenterResources(persistence as never, verify as never)).items[0]?.openTarget).toBe('/video-library');
  });

  it('does not expose admin or API routes from a misconfigured catalog locator', async () => {
    const unsafe = entry({ kind: 'static_resource', contentLocator: { type: 'route', locator: '/admin/knowledge', field: null } });
    const persistence = vi.fn(async () => ({ documents: [unsafe] }));
    const verify = vi.fn(async () => ({ allowed: true }));
    expect((await listResourceCenterResources(persistence as never, verify as never)).items[0]?.openTarget).toBeNull();
  });

  it('mounts the authenticated route and renders search, category, and type controls', () => {
    const root = path.resolve(process.cwd(), '..');
    const index = readFileSync(path.join(root, 'server/src/index.ts'), 'utf8');
    const route = readFileSync(path.join(root, 'server/src/routes/resources.ts'), 'utf8');
    const page = readFileSync(path.join(root, 'apps/team/src/routes/resources.tsx'), 'utf8');
    expect(index).toContain("app.use('/api/resources', resourceRoutes)");
    expect(route).toContain("resourceRoutes.get('/', requireAuth, requireSteveComplete");
    expect(page).toContain('Search resources');
    expect(page).toContain('All categories');
    expect(page).toContain('All types');
  });
});
