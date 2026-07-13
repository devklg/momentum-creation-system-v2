import { describe, expect, it } from 'vitest';
import {
  resourceCatalogRetrievalEligible,
  validateResourceCatalogEntry,
  type McsResourceCatalogEntry,
} from '@momentum/shared';
import {
  RESOURCE_CATALOG_CHROMA_COLLECTION,
  RESOURCE_CATALOG_GRAPH_LABELS,
  RESOURCE_CATALOG_INDEXES,
  RESOURCE_CATALOG_MONGO_COLLECTION,
  RESOURCE_CATALOG_REQUIRED_FIELDS,
} from '../../domain/resourceCatalogSchema.js';

function entry(patch: Partial<McsResourceCatalogEntry> = {}): McsResourceCatalogEntry {
  return {
    schemaVersion: 'resource_catalog.v1', resourceId: 'video:welcome', resourceVersionId: 'video:welcome:v1',
    tenantId: 'team-magnificent', teamId: 'team-magnificent', kind: 'content_video', title: 'Welcome', summary: 'Welcome video', version: 1, lifecycle: 'active',
    audience: { surfaces: ['team'], roles: ['brand_ambassador'], agentScopes: [] },
    language: { mode: 'localized', code: 'en', translationOfResourceVersionId: null, translationStatus: 'not_required' },
    authority: { kind: 'kevin_approved', status: 'active_authority', decidedByTmagId: 'TMBA-KEVIN', decidedAt: '2026-07-12T00:00:00.000Z', evidenceId: 'approval_1' },
    readiness: { retrievalMode: 'required', state: 'ready', checks: { content: 'passed', compliance: 'passed', authority: 'passed', translation: 'passed', mongo: 'passed', neo4j: 'passed', chroma: 'passed' }, evidenceIds: ['ready_1'], blockedReasons: [], evaluatedAt: '2026-07-12T00:00:00.000Z', evaluatedByTmagId: 'TMBA-KEVIN' },
    lineage: { originKind: 'admin_upload', sourceSystem: 'momentum', sourceCollection: 'tmag_content_videos', sourceRecordId: 'content_video_1', parentResourceVersionId: null, supersedesResourceVersionId: null, replacementResourceVersionId: null },
    contentLocator: { type: 'video', locator: 'https://example.com/video', field: null }, contentDigestSha256: 'a'.repeat(64),
    tags: [], categories: ['training'], migration: { source: 'native', ambiguities: [] }, authorTmagId: 'TMBA-KEVIN', createdAt: '2026-07-12T00:00:00.000Z', updatedAt: '2026-07-12T00:00:00.000Z',
    ...patch,
  };
}

describe('P1 unified resource catalog schema', () => {
  it('declares canonical stores, graph identities, required fields, and uniqueness indexes', () => {
    expect(RESOURCE_CATALOG_MONGO_COLLECTION).toBe('tmag_resource_catalog');
    expect(RESOURCE_CATALOG_CHROMA_COLLECTION).toBe('mcs_resource_catalog');
    expect(RESOURCE_CATALOG_GRAPH_LABELS).toEqual(['TmagResource', 'TmagResourceVersion']);
    expect(RESOURCE_CATALOG_REQUIRED_FIELDS).toContain('readiness');
    expect(RESOURCE_CATALOG_INDEXES.filter((row) => row.unique).map((row) => row.name)).toEqual(['unique_resourceVersionId', 'unique_resource_version', 'unique_active_resource_language']);
  });

  it('accepts a fully governed active resource and derives retrieval eligibility', () => {
    const record = entry();
    expect(validateResourceCatalogEntry(record)).toEqual([]);
    expect(resourceCatalogRetrievalEligible(record)).toBe(true);
  });

  it('fails closed when active authority or graph/search readiness is absent', () => {
    const record = entry({ authority: { ...entry().authority, status: 'candidate_only' }, readiness: { ...entry().readiness, state: 'blocked', checks: { ...entry().readiness.checks, chroma: 'failed' } } });
    expect(resourceCatalogRetrievalEligible(record)).toBe(false);
    expect(validateResourceCatalogEntry(record)).toEqual(expect.arrayContaining(['active_authority_required', 'active_retrieval_readiness_required']));
  });

  it('requires explicit audience, language, immutable digest, chunk parent, and supersession lineage', () => {
    expect(validateResourceCatalogEntry(entry({ audience: { surfaces: [], roles: [], agentScopes: [] }, contentDigestSha256: 'bad' }))).toEqual(expect.arrayContaining(['explicit_audience_required', 'sha256_digest_required']));
    expect(validateResourceCatalogEntry(entry({ kind: 'knowledge_chunk', lineage: { ...entry().lineage, parentResourceVersionId: null } }))).toContain('knowledge_chunk_parent_required');
    expect(validateResourceCatalogEntry(entry({ lifecycle: 'superseded', lineage: { ...entry().lineage, replacementResourceVersionId: null } }))).toContain('superseded_replacement_required');
  });

  it('preserves legacy ambiguity rather than silently treating a projection as native', () => {
    expect(validateResourceCatalogEntry(entry({ migration: { source: 'legacy_projection', ambiguities: [] } }))).toContain('legacy_ambiguity_or_native_source_required');
    expect(validateResourceCatalogEntry(entry({ migration: { source: 'legacy_projection', ambiguities: ['legacy_inactive_meaning_unknown'] } }))).toEqual([]);
  });
});
