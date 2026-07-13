import { describe, expect, it, vi } from 'vitest';
import type {
  McsKnowledgeBaseChunkRecord,
  McsKnowledgeBaseSourceRecord,
} from '@momentum/shared/runtime';
import {
  buildKnowledgeResourceCatalogEntry,
  projectKevinApprovedKnowledgeSourceToCatalog,
} from '../knowledgeResourceProjection.js';

const NOW = '2026-07-13T12:00:00.000Z';

function source(patch: Partial<McsKnowledgeBaseSourceRecord> = {}): McsKnowledgeBaseSourceRecord {
  return {
    schemaVersion: 'knowledge_base.schema.v1',
    sourceId: 'knowledge_source_1' as never,
    title: 'Approved Training',
    sourceType: 'owned_text',
    format: 'markdown',
    originalContent: '# Approved Training\n\nUse this material with the team.',
    createdBy: 'TMAG-01',
    authority: { authorityKind: 'kevin_approved', authorityStatus: 'active_authority', authorityBy: 'Kevin L. Gardner', authorityAt: NOW, authorityRef: 'approval_1' },
    createdAt: NOW,
    language: 'en',
    domain: 'training',
    scope: { tenantId: 'tenant_team_magnificent' as never, teamId: 'team_magnificent' as never, teamKey: 'team_magnificent', teamName: 'Team Magnificent' },
    version: 1,
    status: 'active',
    authorityDecision: 'active_authority',
    chunkCount: 1,
    indexRecordCount: 1,
    ...patch,
  };
}

function chunk(): McsKnowledgeBaseChunkRecord {
  return {
    schemaVersion: 'knowledge_base.schema.v1',
    chunkId: 'chunk_1',
    sourceId: 'knowledge_source_1' as never,
    documentId: 'document_1',
    sourceVersion: 1,
    heading: 'Approved Training',
    text: 'Use this material with the team.',
    chunkIndex: 0,
    language: 'en',
    domain: 'training',
    scope: source().scope,
    topicTags: ['training'],
    agentScopes: ['michael_magnificent'],
    surfaceScopes: ['team'],
    sourceOffsets: { startOffset: 0, endOffset: 32 },
    status: 'active',
    retrievalEligible: true,
    title: 'Approved Training',
    summary: 'Use this material with the team.',
    knowledgeId: 'knowledge_1' as never,
    authorityKind: 'kevin_approved',
    authorityStatus: 'active_authority',
    sourceTitle: 'Approved Training',
    citation: { label: 'Approved Training', sourceRef: null, documentId: 'document_1', chunkId: 'chunk_1', sourceVersion: 1, chunkIndex: 0, startOffset: 0, endOffset: 32 },
  };
}

describe('Kevin-approved knowledge Resource Catalog projection', () => {
  it('maps one source version to one team-visible catalog version', () => {
    const entry = buildKnowledgeResourceCatalogEntry({ source: source(), chunks: [chunk()], lifecycle: 'approved', updatedAt: NOW });
    expect(entry).toMatchObject({
      resourceId: 'knowledge:knowledge_source_1',
      resourceVersionId: 'knowledge:knowledge_source_1:v1',
      kind: 'knowledge_source',
      lifecycle: 'approved',
      audience: { surfaces: ['team'], roles: ['brand_ambassador', 'leader'] },
      authority: { kind: 'kevin_approved', status: 'active_authority', decidedByTmagId: 'TMAG-01' },
      lineage: { sourceCollection: 'mcs_knowledge_sources', sourceRecordId: 'knowledge_source_1' },
      contentLocator: { type: 'route', locator: '/resources/knowledge%3Aknowledge_source_1%3Av1' },
    });
    expect(entry.contentDigestSha256).toMatch(/^[a-f0-9]{64}$/);
  });

  it('writes approved, verifies, activates, and verifies retrieval', async () => {
    let exists = false;
    const writes: Array<{ tool: string; action: string; params: Record<string, unknown> }> = [];
    const persistence = vi.fn(async (tool: string, action: string, params: Record<string, unknown>) => {
      writes.push({ tool, action, params });
      if (tool === 'mongodb' && action === 'query') return { documents: exists ? [{}] : [] };
      if (tool === 'mongodb' && action === 'insert') { exists = true; return { insertedCount: 1 }; }
      return {};
    });
    const verify = vi.fn(async (_id: string, mode: string) => ({
      allowed: true,
      reasons: [],
      evidence: mode === 'publish' ? { evidenceId: 'ready_1' } : { evidenceId: 'ready_2' },
    }));

    const result = await projectKevinApprovedKnowledgeSourceToCatalog(source(), [chunk()], persistence as never, verify as never, () => new Date(NOW));

    expect(result.active).toBe(true);
    expect(verify).toHaveBeenNthCalledWith(1, 'knowledge:knowledge_source_1:v1', 'publish', persistence);
    expect(verify).toHaveBeenNthCalledWith(2, 'knowledge:knowledge_source_1:v1', 'retrieve', persistence);
    expect(writes.filter((write) => write.tool === 'neo4j')).toHaveLength(2);
    expect(writes.filter((write) => write.tool === 'chromadb')).toHaveLength(2);
  });

  it('fails closed when Kevin authority is absent', async () => {
    const candidate = source({
      authorityDecision: 'candidate_only',
      authority: { authorityKind: 'agent_captured', authorityStatus: 'candidate_only', authorityBy: 'codex', authorityAt: NOW },
    });
    const persistence = vi.fn();
    const result = await projectKevinApprovedKnowledgeSourceToCatalog(candidate, [chunk()], persistence as never);
    expect(result).toMatchObject({ active: false, reasons: ['active_knowledge_source_required'] });
    expect(persistence).not.toHaveBeenCalled();
  });

  it('does not rewrite an already-active exact version that passes retrieval', async () => {
    const active = buildKnowledgeResourceCatalogEntry({ source: source(), chunks: [chunk()], lifecycle: 'active', updatedAt: NOW, readinessEvidenceId: 'ready_1' });
    const persistence = vi.fn(async () => ({ documents: [active] }));
    const verify = vi.fn(async () => ({ allowed: true, reasons: [], evidence: { evidenceId: 'ready_1' } }));
    const result = await projectKevinApprovedKnowledgeSourceToCatalog(source(), [chunk()], persistence as never, verify as never);
    expect(result.active).toBe(true);
    expect(verify).toHaveBeenCalledOnce();
    expect(verify).toHaveBeenCalledWith(active.resourceVersionId, 'retrieve', persistence);
    expect(persistence).toHaveBeenCalledOnce();
  });

  it('blocks immutable-version digest conflicts without writing', async () => {
    const conflict = buildKnowledgeResourceCatalogEntry({ source: source(), chunks: [chunk()], lifecycle: 'active', updatedAt: NOW, readinessEvidenceId: 'ready_1' });
    conflict.contentDigestSha256 = 'f'.repeat(64);
    const persistence = vi.fn(async () => ({ documents: [conflict] }));
    const verify = vi.fn();
    const result = await projectKevinApprovedKnowledgeSourceToCatalog(source(), [chunk()], persistence as never, verify as never);
    expect(result).toMatchObject({ active: false, reasons: ['immutable_version_digest_conflict'] });
    expect(persistence).toHaveBeenCalledOnce();
    expect(verify).not.toHaveBeenCalled();
  });
});
