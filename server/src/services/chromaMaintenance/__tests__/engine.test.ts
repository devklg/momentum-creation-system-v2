import { describe, expect, it, vi } from 'vitest';
import type { KnowledgeReindexRequest } from '../../../runtime/knowledge-evolution/indexing/knowledgeEvolutionReindex.service.js';
import {
  runChromaMaintenance,
  type CanonicalMaintenanceItem,
  type ChromaMaintenancePort,
  type ChromaVerificationState,
} from '../engine.js';

const request: KnowledgeReindexRequest = {
  evolutionId: 'secret-evolution-id',
  knowledgeObjectId: 'secret-knowledge-id',
  version: 1,
  tenantId: 'tenant-1',
  teamId: 'team-1',
  teamKey: 'team_magnificent',
  teamName: 'Team Magnificent',
  domain: 'success',
  language: 'en',
  lifecycle: 'active',
  approved: true,
  retrievalReady: true,
  document: 'CONTENT MUST NEVER APPEAR IN A REPORT',
};

function item(
  action: CanonicalMaintenanceItem['action'] = 'upsert',
  reason = 'canonical_active',
): CanonicalMaintenanceItem {
  return {
    cursor: 'secret-cursor',
    action,
    reason,
    expectedId: 'secret-document-id',
    request: action === 'remove'
      ? { ...request, lifecycle: 'archived', document: undefined }
      : request,
  };
}

function port(options: {
  items?: CanonicalMaintenanceItem[];
  verify?: ChromaVerificationState[];
  nextCursor?: string | null;
  liveMetadata?: Array<Record<string, unknown> | null>;
} = {}): ChromaMaintenancePort & {
  upsert: ReturnType<typeof vi.fn>;
  remove: ReturnType<typeof vi.fn>;
} {
  const states = [...(options.verify ?? ['missing'])];
  return {
    listCollections: vi.fn().mockResolvedValue([
      {
        name: 'mcs_success_knowledge_en',
        metadata: { embedding_model: 'all-MiniLM-L6-v2' },
        dimension: 384,
      },
      { name: 'mcs_memory_context_index' },
    ]),
    listProjectionPage: vi.fn().mockResolvedValue({
      count: options.liveMetadata?.length ?? 0,
      metadatas: options.liveMetadata ?? [],
    }),
    loadCanonicalBatch: vi.fn().mockResolvedValue({
      items: options.items ?? [item()],
      nextCursor: options.nextCursor ?? null,
    }),
    verify: vi.fn().mockImplementation(async () => states.shift() ?? 'match'),
    upsert: vi.fn().mockResolvedValue(undefined),
    remove: vi.fn().mockResolvedValue(undefined),
    assertApplyAuthorization: vi.fn().mockResolvedValue(undefined),
  };
}

const evidenceSha256 = 'a'.repeat(64);

describe('Chroma maintenance engine', () => {
  it('rejects unknown collections and unsupported mutation capability before I/O', async () => {
    const fake = port();
    await expect(runChromaMaintenance({ mode: 'audit', collections: ['unknown'] }, fake))
      .rejects.toThrow('not in the maintenance manifest');
    await expect(runChromaMaintenance({ mode: 'reindex', collections: ['mcs_audit_log'] }, fake))
      .rejects.toThrow('does not support reindex');
    expect(fake.listCollections).not.toHaveBeenCalled();
  });

  it('is dry-run by default, reports age buckets, and exposes unowned live names only', async () => {
    const fake = port({
      liveMetadata: [
        { indexedAt: '2026-07-10T00:00:00.000Z' },
        { indexedAt: '2026-05-15T00:00:00.000Z' },
        { indexedAt: '2025-01-01T00:00:00.000Z' },
        {},
      ],
    });
    const report = await runChromaMaintenance({
      mode: 'audit',
      collections: ['mcs_success_knowledge_en'],
      now: new Date('2026-07-14T00:00:00.000Z'),
    }, fake);

    expect(fake.upsert).not.toHaveBeenCalled();
    expect(fake.remove).not.toHaveBeenCalled();
    expect(report.collections[0]?.ageBuckets).toEqual({
      under30Days: 1,
      days30To90: 1,
      over90Days: 1,
      unknown: 1,
    });
    expect(report.unownedLiveCollections).toEqual(['mcs_memory_context_index']);
    expect(report.approvalRef).toBeNull();
  });

  it('requires both exact apply gates and refuses apply in audit mode', async () => {
    const fake = port();
    await expect(runChromaMaintenance({
      mode: 'reindex', collections: ['mcs_success_knowledge_en'], apply: true,
    }, fake)).rejects.toThrow('--confirm P2-133');
    await expect(runChromaMaintenance({
      mode: 'reindex',
      collections: ['mcs_success_knowledge_en'],
      apply: true,
      confirm: 'P2-133',
    }, fake)).rejects.toThrow('--approval-ref');
    await expect(runChromaMaintenance({
      mode: 'reindex',
      collections: ['mcs_success_knowledge_en'],
      apply: true,
      confirm: 'P2-133',
      approvalRef: 'dec_acr_0027_chroma_reindex_age_out_approval_2026_07_14',
    }, fake)).rejects.toThrow('dedicated --approval-ref');
    await expect(runChromaMaintenance({
      mode: 'audit',
      collections: ['mcs_success_knowledge_en'],
      apply: true,
      confirm: 'P2-133',
      approvalRef: 'dec_p2_133_chroma_live_apply_test',
      evidenceSha256,
    }, fake)).rejects.toThrow('audit mode never accepts --apply');
  });

  it('aborts a reindex segment before any mutation when canonical evidence is blocked', async () => {
    const fake = port({ items: [item('upsert'), item('blocked', 'missing_document')] });
    await expect(runChromaMaintenance({
      mode: 'reindex',
      collections: ['mcs_success_knowledge_en'],
      apply: true,
      confirm: 'P2-133',
      approvalRef: 'dec_p2_133_chroma_live_apply_test',
      evidenceSha256,
    }, fake)).rejects.toThrow('missing_document');
    expect(fake.upsert).not.toHaveBeenCalled();
  });

  it('mutates only drifted upserts and fails closed when readback is not a match', async () => {
    const alreadyCurrent = port({ verify: ['match'] });
    await runChromaMaintenance({
      mode: 'reindex',
      collections: ['mcs_success_knowledge_en'],
      apply: true,
      confirm: 'P2-133',
      approvalRef: 'dec_p2_133_chroma_live_apply_test',
      evidenceSha256,
    }, alreadyCurrent);
    expect(alreadyCurrent.upsert).not.toHaveBeenCalled();

    const failedReadback = port({ verify: ['missing', 'mismatch'] });
    await expect(runChromaMaintenance({
      mode: 'reindex',
      collections: ['mcs_success_knowledge_en'],
      apply: true,
      confirm: 'P2-133',
      approvalRef: 'dec_p2_133_chroma_live_apply_test',
      evidenceSha256,
    }, failedReadback)).rejects.toThrow('reindex readback failed: mismatch');
    expect(failedReadback.upsert).toHaveBeenCalledTimes(1);
  });

  it('age-out removes only canonically inactive records and requires missing readback', async () => {
    const fake = port({ items: [item('remove')], verify: ['stale_present', 'missing'] });
    const report = await runChromaMaintenance({
      mode: 'age_out',
      collections: ['mcs_success_knowledge_en'],
      apply: true,
      confirm: 'P2-133',
      approvalRef: 'dec_p2_133_chroma_live_apply_test',
      evidenceSha256,
    }, fake);
    expect(fake.remove).toHaveBeenCalledTimes(1);
    expect(fake.upsert).not.toHaveBeenCalled();
    expect(report.summary.appliedRemovals).toBe(1);
  });

  it('keeps reports content-free and returns bounded resume cursors', async () => {
    const fake = port({ nextCursor: 'next-secret-cursor' });
    const report = await runChromaMaintenance({
      mode: 'reindex',
      collections: ['mcs_success_knowledge_en'],
      maxRecords: 1,
    }, fake);
    const serialized = JSON.stringify(report);
    expect(report.collections[0]?.nextCursor).toBe('next-secret-cursor');
    expect(serialized).not.toContain(request.document as string);
    expect(serialized).not.toContain(request.evolutionId);
    expect(serialized).not.toContain(request.knowledgeObjectId);
    expect(serialized).not.toContain('secret-document-id');
  });
});
