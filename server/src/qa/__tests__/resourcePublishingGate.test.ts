import { describe, expect, it, vi } from 'vitest';
import type { McsResourceCatalogEntry } from '@momentum/shared';
import { verifyResourcePublishingGate } from '../../domain/resourcePublishingGate.js';

const UPDATED = '2026-07-12T12:00:00.000Z';

function approved(): McsResourceCatalogEntry {
  return {
    schemaVersion: 'resource_catalog.v1', resourceId: 'resource_1', resourceVersionId: 'resource_1_v1', tenantId: 'team-magnificent', teamId: 'team-magnificent', kind: 'knowledge_source', title: 'Training', summary: 'Approved training', version: 1, lifecycle: 'approved',
    audience: { surfaces: ['team'], roles: ['brand_ambassador'], agentScopes: ['michael'] },
    language: { mode: 'localized', code: 'en', translationOfResourceVersionId: null, translationStatus: 'approved' },
    authority: { kind: 'kevin_approved', status: 'active_authority', decidedByTmagId: 'TMBA-KEVIN', decidedAt: UPDATED, evidenceId: 'approval_1' },
    readiness: { retrievalMode: 'required', state: 'pending', checks: { content: 'passed', compliance: 'passed', authority: 'passed', translation: 'passed', mongo: 'passed', neo4j: 'pending', chroma: 'pending' }, evidenceIds: [], blockedReasons: [], evaluatedAt: null, evaluatedByTmagId: null },
    lineage: { originKind: 'admin_upload', sourceSystem: 'momentum', sourceCollection: 'mcs_knowledge_sources', sourceRecordId: 'source_1', parentResourceVersionId: null, supersedesResourceVersionId: null, replacementResourceVersionId: null },
    contentLocator: { type: 'mongo_document', locator: 'mcs_knowledge_sources/source_1', field: 'originalContent' }, contentDigestSha256: 'a'.repeat(64), tags: [], categories: ['training'], migration: { source: 'native', ambiguities: [] }, authorTmagId: 'TMBA-KEVIN', createdAt: UPDATED, updatedAt: UPDATED,
  };
}

function neo(entry: McsResourceCatalogEntry, patch: Record<string, unknown> = {}) {
  return { records: [{ resourceId: entry.resourceId, resourceVersionId: entry.resourceVersionId, version: entry.version, contentDigestSha256: entry.contentDigestSha256, lifecycle: entry.lifecycle, approvedByTmagId: entry.authority.decidedByTmagId, projectedAt: UPDATED, ...patch }] };
}

function chroma(entry: McsResourceCatalogEntry, patch: Record<string, unknown> = {}) {
  return { ids: [entry.resourceVersionId], metadatas: [{ resourceVersionId: entry.resourceVersionId, resourceId: entry.resourceId, tenantId: entry.tenantId, teamId: entry.teamId, contentDigestSha256: entry.contentDigestSha256, lifecycle: entry.lifecycle, updatedAt: UPDATED, ...patch }] };
}

function persistenceFor(entry: McsResourceCatalogEntry, neoResult: unknown = neo(entry), chromaResult: unknown = chroma(entry)) {
  return vi.fn(async (tool: string) => tool === 'mongodb' ? { documents: [entry] } : tool === 'neo4j' ? neoResult : chromaResult);
}

describe('P1 resource publishing gate', () => {
  it('allows publishing only after exact Neo4j and Chroma readback', async () => {
    const entry = approved();
    const decision = await verifyResourcePublishingGate(entry.resourceVersionId, 'publish', persistenceFor(entry) as never, new Date('2026-07-12T12:01:00.000Z'));
    expect(decision).toMatchObject({ allowed: true, reasons: [], evidence: { resourceVersionId: entry.resourceVersionId, contentDigestSha256: entry.contentDigestSha256 } });
    expect(decision.evidence?.evidenceId).toMatch(/^resource_ready_[a-f0-9]{64}$/);
  });

  it.each([
    ['neo missing', { records: [] }, undefined, 'neo4j_exact_version_missing_or_duplicate'],
    ['neo stale', undefined, undefined, 'neo4j_projection_stale'],
    ['chroma missing', undefined, { ids: [], metadatas: [] }, 'chroma_exact_version_missing'],
    ['chroma digest mismatch', undefined, undefined, 'chroma_identity_or_digest_mismatch'],
  ])('blocks %s without mutating the catalog', async (name, neoOverride, chromaOverride, reason) => {
    const entry = approved();
    const snapshot = structuredClone(entry);
    const neoResult = name === 'neo stale' ? neo(entry, { projectedAt: '2026-07-12T11:59:00.000Z' }) : neoOverride ?? neo(entry);
    const chromaResult = name === 'chroma digest mismatch' ? chroma(entry, { contentDigestSha256: 'b'.repeat(64) }) : chromaOverride ?? chroma(entry);
    const decision = await verifyResourcePublishingGate(entry.resourceVersionId, 'publish', persistenceFor(entry, neoResult, chromaResult) as never);
    expect(decision.allowed).toBe(false);
    expect(decision.reasons).toContain(reason);
    expect(entry).toEqual(snapshot);
  });

  it('blocks wrong lifecycle, candidate authority, and unavailable stores', async () => {
    const draft = approved(); draft.lifecycle = 'draft';
    expect((await verifyResourcePublishingGate(draft.resourceVersionId, 'publish', persistenceFor(draft) as never)).reasons).toContain('lifecycle_approved_required');
    const candidate = approved(); candidate.authority.status = 'candidate_only';
    expect((await verifyResourcePublishingGate(candidate.resourceVersionId, 'publish', persistenceFor(candidate) as never)).reasons).toContain('active_human_authority_required');
    const unavailable = vi.fn(async (tool: string) => { if (tool === 'mongodb') return { documents: [approved()] }; throw new Error('down'); });
    expect((await verifyResourcePublishingGate('resource_1_v1', 'publish', unavailable as never)).reasons).toContain('neo4j_unavailable');
  });

  it('rechecks active resources before retrieval instead of trusting cached readiness flags', async () => {
    const entry = approved();
    entry.lifecycle = 'active';
    entry.readiness = { ...entry.readiness, state: 'ready', checks: { ...entry.readiness.checks, neo4j: 'passed', chroma: 'passed' }, evidenceIds: ['ready_1'], evaluatedAt: UPDATED, evaluatedByTmagId: 'TMBA-KEVIN' };
    expect((await verifyResourcePublishingGate(entry.resourceVersionId, 'retrieve', persistenceFor(entry) as never)).allowed).toBe(true);
    expect((await verifyResourcePublishingGate(entry.resourceVersionId, 'retrieve', persistenceFor(entry, neo(entry), { ids: [], metadatas: [] }) as never)).allowed).toBe(false);
  });
});
