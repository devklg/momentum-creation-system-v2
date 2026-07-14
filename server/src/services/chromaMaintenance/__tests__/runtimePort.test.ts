import type { KnowledgeEvolutionRecord } from '@momentum/shared/runtime';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getChromaMaintenanceManifestEntry } from '../manifest.js';

const mocks = vi.hoisted(() => ({
  persistenceCall: vi.fn(),
  reindexKnowledgeEvolution: vi.fn(),
}));

vi.mock('../../persistence/dispatch.js', () => ({
  persistenceCall: mocks.persistenceCall,
}));

vi.mock('../../../runtime/knowledge-evolution/indexing/knowledgeEvolutionReindex.service.js', async () => {
  const actual = await vi.importActual<typeof import('../../../runtime/knowledge-evolution/indexing/knowledgeEvolutionReindex.service.js')>(
    '../../../runtime/knowledge-evolution/indexing/knowledgeEvolutionReindex.service.js',
  );
  return { ...actual, reindexKnowledgeEvolution: mocks.reindexKnowledgeEvolution };
});

const baseRecord: KnowledgeEvolutionRecord & { _id: string } = {
  _id: 'kev_1',
  evolutionId: 'kev_1',
  tenantId: 'tenant-1',
  teamId: 'team-1',
  teamKey: 'team_magnificent',
  teamName: 'Team Magnificent',
  inputType: 'approved_candidate',
  inputId: 'input-1',
  status: 'completed',
  domain: 'success',
  language: 'en',
  targetKnowledgeObjectId: 'kobj-1',
  sourceKnowledgeObjectIds: [],
  sourceCandidateIds: ['candidate-1'],
  sourceOutcomeIds: [],
  sourceLearningSignalIds: [],
  sourceEventIds: [],
  evolutionAction: 'create_new_knowledge',
  versionCreated: 2,
  approvalReference: {
    approvalId: 'approval-1',
    approvedBy: 'kevin',
    approvalType: 'admin_decision',
    approvedAt: new Date('2026-07-14T00:00:00.000Z'),
  },
  indexingStatus: 'completed',
  graphStatus: 'completed',
  retrievalStatus: 'ready',
  createdAt: new Date('2026-07-14T00:00:00.000Z'),
  updatedAt: new Date('2026-07-14T00:00:00.000Z'),
  metadata: { document: 'Canonical approved summary' },
};

function entry() {
  const resolved = getChromaMaintenanceManifestEntry('mcs_success_knowledge_en');
  if (!resolved) throw new Error('test manifest entry missing');
  return resolved;
}

describe('Chroma maintenance runtime port', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('projects active canonical records with exact rollout readiness and a bounded cursor', async () => {
    mocks.persistenceCall.mockImplementation(async (_tool, _action, params) => {
      if (params.collection === 'knowledge_evolution_records') return { documents: [baseRecord] };
      if (params.collection === 'knowledge_evolution_versions') return { documents: [] };
      if (params.collection === 'knowledge_supersession_records') return { documents: [] };
      if (params.collection === 'knowledge_retrieval_rollouts') {
        return { documents: [{ knowledgeObjectId: 'kobj-1', version: 2, retrievalReady: true }] };
      }
      throw new Error(`unexpected collection ${params.collection}`);
    });
    const { createChromaMaintenanceRuntimePort } = await import('../runtimePort.js');
    const batch = await createChromaMaintenanceRuntimePort().loadCanonicalBatch({
      entry: entry(),
      cursor: null,
      limit: 1,
    });

    expect(batch.nextCursor).toBe('kev_1');
    expect(batch.items).toHaveLength(1);
    expect(batch.items[0]).toMatchObject({
      action: 'upsert',
      reason: 'canonical_active',
      expectedId: 'keknow_kobj-1_v2_en',
      request: {
        document: 'Canonical approved summary',
        retrievalReady: true,
        lifecycle: 'active',
      },
    });
    expect(mocks.persistenceCall).toHaveBeenCalledWith('mongodb', 'query', expect.objectContaining({
      filter: expect.objectContaining({ domain: 'success', language: 'en' }),
      limit: 1,
    }));
  });

  it('blocks incomplete canonical evidence and classifies lifecycle removals', async () => {
    const incomplete = { ...baseRecord, _id: 'kev_2', evolutionId: 'kev_2', metadata: {} };
    const archived = { ...baseRecord, _id: 'kev_3', evolutionId: 'kev_3', targetKnowledgeObjectId: 'kobj-3' };
    mocks.persistenceCall.mockImplementation(async (_tool, _action, params) => {
      if (params.collection === 'knowledge_evolution_records') {
        return { documents: [incomplete, archived] };
      }
      if (params.collection === 'knowledge_evolution_versions') {
        return { documents: [{ knowledgeObjectId: 'kobj-3', changeType: 'archived' }] };
      }
      return { documents: [] };
    });
    const { createChromaMaintenanceRuntimePort } = await import('../runtimePort.js');
    const batch = await createChromaMaintenanceRuntimePort().loadCanonicalBatch({
      entry: entry(),
      cursor: null,
      limit: 10,
    });

    expect(batch.items.map((row) => [row.action, row.reason])).toEqual([
      ['blocked', 'missing_document'],
      ['remove', 'canonical_archived'],
    ]);
  });

  it('uses exact document-and-metadata readback for projection identity', async () => {
    mocks.persistenceCall.mockResolvedValue({
      ids: ['keknow_kobj-1_v2_en'],
      documents: ['not returned by verification'],
      metadatas: [{
        evolutionId: 'kev_1',
        knowledgeObjectId: 'kobj-1',
        version: 2,
        domain: 'success',
        language: 'en',
        lifecycleStatus: 'active',
        governanceStatus: 'approved',
        retrievalReady: true,
        tenantId: 'tenant-1',
        sourceCandidateIds: 'candidate-1',
        sourceTraceable: true,
      }],
    });
    const { createChromaMaintenanceRuntimePort } = await import('../runtimePort.js');
    const port = createChromaMaintenanceRuntimePort();
    const batchItem = {
      cursor: 'kev_1',
      action: 'upsert' as const,
      reason: 'canonical_active',
      expectedId: 'keknow_kobj-1_v2_en',
      request: {
        evolutionId: 'kev_1', knowledgeObjectId: 'kobj-1', version: 2,
        tenantId: 'tenant-1', domain: 'success' as const, language: 'en' as const,
        lifecycle: 'active' as const, approved: true, retrievalReady: true,
        sourceCandidateIds: ['candidate-1'], document: 'not returned by verification',
      },
    };
    await expect(port.verify(batchItem)).resolves.toBe('match');
    expect(mocks.persistenceCall).toHaveBeenCalledWith('chromadb', 'get', {
      collection: 'mcs_success_knowledge_en',
      ids: ['keknow_kobj-1_v2_en'],
      include_documents: true,
    });
  });

  it('delegates mutation to the existing Knowledge Evolution reindex service and fails closed', async () => {
    const { createChromaMaintenanceRuntimePort } = await import('../runtimePort.js');
    const maintenanceItem = {
      cursor: 'kev_1',
      action: 'remove' as const,
      reason: 'canonical_archived',
      expectedId: '',
      request: {
        evolutionId: 'kev_1', knowledgeObjectId: 'kobj-1', version: 2,
        tenantId: 'tenant-1', domain: 'success' as const, language: 'en' as const,
        lifecycle: 'archived' as const, approved: true,
      },
    };
    mocks.reindexKnowledgeEvolution.mockResolvedValue({ status: 'completed' });
    await expect(createChromaMaintenanceRuntimePort().remove(maintenanceItem)).resolves.toBeUndefined();
    expect(mocks.reindexKnowledgeEvolution).toHaveBeenCalledWith(maintenanceItem.request);

    mocks.reindexKnowledgeEvolution.mockResolvedValue({ status: 'failed', reason: 'adapter error' });
    await expect(createChromaMaintenanceRuntimePort().remove(maintenanceItem))
      .rejects.toThrow('knowledge reindex did not complete');
  });

  it('requires exact canonical decision readback for a live apply', async () => {
    const { createChromaMaintenanceRuntimePort } = await import('../runtimePort.js');
    const authorization = {
      decisionId: 'dec_p2_133_chroma_live_apply_test',
      mode: 'reindex' as const,
      collections: ['mcs_success_knowledge_en'],
      evidenceSha256: 'a'.repeat(64),
    };
    mocks.persistenceCall.mockResolvedValue({ documents: [{
      status: 'active',
      decided_by: 'kevin_gardner',
      related_acr: 'ACR-0027',
      authorization_scope: 'live_chroma_apply',
      authorized_mode: 'reindex',
      authorized_collections: ['mcs_success_knowledge_en'],
      dry_run_report_sha256: 'a'.repeat(64),
    }] });
    await expect(createChromaMaintenanceRuntimePort().assertApplyAuthorization(authorization))
      .resolves.toBeUndefined();
    expect(mocks.persistenceCall).toHaveBeenCalledWith('mongodb', 'query', expect.objectContaining({
      database: 'momentum',
      collection: 'decisions',
      filter: { _id: authorization.decisionId },
      limit: 2,
    }));

    mocks.persistenceCall.mockResolvedValue({ documents: [{
      status: 'active',
      decided_by: 'kevin_gardner',
      related_acr: 'ACR-0027',
      authorization_scope: 'live_chroma_apply',
      authorized_mode: 'age_out',
      authorized_collections: ['mcs_success_knowledge_en'],
      dry_run_report_sha256: 'a'.repeat(64),
    }] });
    await expect(createChromaMaintenanceRuntimePort().assertApplyAuthorization(authorization))
      .rejects.toThrow('does not match mode, collections, or dry-run evidence');
  });
});
