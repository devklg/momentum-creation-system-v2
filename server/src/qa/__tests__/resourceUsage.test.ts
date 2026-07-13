import { describe, expect, it, vi } from 'vitest';
import type { McsResourceCatalogEntry } from '@momentum/shared';
import { buildResourceUsageSummary, recordVerifiedResourceOpen } from '../../domain/resourceUsage.js';
import { persistenceCall } from '../../services/persistence/dispatch.js';
import { verifyResourcePublishingGate } from '../../domain/resourcePublishingGate.js';

const ENTRY: McsResourceCatalogEntry = {
  schemaVersion: 'resource_catalog.v1', resourceId: 'resource-1', resourceVersionId: 'resource-1:v1',
  tenantId: 'team-magnificent', teamId: 'team-magnificent', kind: 'static_resource', title: 'Field Guide', summary: 'Guide', version: 1, lifecycle: 'active',
  audience: { surfaces: ['team'], roles: ['brand_ambassador'], agentScopes: [] },
  language: { mode: 'localized', code: 'en', translationOfResourceVersionId: null, translationStatus: 'approved' },
  authority: { kind: 'kevin_approved', status: 'active_authority', decidedByTmagId: 'TM-01', decidedAt: '2026-01-01T00:00:00.000Z', evidenceId: null },
  readiness: { retrievalMode: 'required', state: 'ready', checks: { content: 'passed', compliance: 'passed', authority: 'passed', translation: 'passed', mongo: 'passed', neo4j: 'passed', chroma: 'passed' }, evidenceIds: [], blockedReasons: [], evaluatedAt: '2026-01-01T00:00:00.000Z', evaluatedByTmagId: 'TM-01' },
  lineage: { originKind: 'admin_upload', sourceSystem: 'knowledge_core', sourceCollection: 'mcs_knowledge_sources', sourceRecordId: 'source-1', parentResourceVersionId: null, supersedesResourceVersionId: null, replacementResourceVersionId: null },
  contentLocator: { type: 'route', locator: '/resources/resource-1%3Av1', field: null }, contentDigestSha256: 'a'.repeat(64), tags: [], categories: ['Training'], migration: { source: 'native', ambiguities: [] }, authorTmagId: 'TM-01', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('P2-102 resource usage analytics', () => {
  it('records only a verified active team resource through all three stores', async () => {
    const persistence = vi.fn(async () => ({ documents: [ENTRY] }));
    const verifyGate = vi.fn(async () => ({ allowed: true, reasons: [] }));
    const write = vi.fn(async () => ({ mongo: { ok: true }, neo4j: { ok: true }, chroma: { ok: true, verified: true } }));
    const event = await recordVerifiedResourceOpen('resource-1:v1', 'TMBA-1', {
      persistence: persistence as unknown as typeof persistenceCall,
      verifyGate: verifyGate as unknown as typeof verifyResourcePublishingGate,
      write,
      now: new Date('2026-07-13T12:00:00.000Z'),
    });
    expect(event).toMatchObject({ schemaVersion: 'resource_usage.v1', resourceVersionId: 'resource-1:v1', actorTmagId: 'TMBA-1', eventType: 'opened' });
    expect(write).toHaveBeenCalledWith(expect.objectContaining({ mongoCollection: 'tmag_resource_usage_events', neo4j: expect.any(Object), chroma: expect.objectContaining({ collection: 'mcs_resource_usage_events' }) }));
  });

  it('reports opens and review warnings without changing publishing state', async () => {
    const persistence = vi.fn()
      .mockResolvedValueOnce({ documents: [ENTRY] })
      .mockResolvedValueOnce({ results: [{ _id: 'resource-1:v1', openCount: 4, memberIds: ['A', 'B'], lastOpenedAt: '2026-07-12T00:00:00.000Z' }] })
      .mockResolvedValueOnce({ results: [{ _id: 'resource-1:v1', opensLast30Days: 3 }] });
    const report = await buildResourceUsageSummary({ persistence: persistence as unknown as typeof persistenceCall, now: new Date('2026-07-13T12:00:00.000Z') });
    expect(report.policy).toEqual({ staleReviewDays: 90, warningOnly: true, changesPublishingState: false });
    expect(report.totals).toEqual({ activeResources: 1, totalOpens: 4, opensLast30Days: 3, neverOpened: 0, staleReviewWarnings: 1 });
    expect(report.resources[0]).toMatchObject({ openCount: 4, uniqueMemberCount: 2, staleReviewWarning: true });
  });
});
