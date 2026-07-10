import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  activeKnowledgeDocumentId,
  reindexKnowledgeEvolution,
  type ChromaIndexPort,
  type KnowledgeReindexRequest,
} from '../knowledgeEvolutionReindex.service.js';
import type { KnowledgeEvolutionCoordinationStatus } from '@momentum/shared/runtime';

function mockChroma(overrides: {
  ensureCollection?: ChromaIndexPort['ensureCollection'];
  upsert?: ChromaIndexPort['upsert'];
  deleteByFilter?: ChromaIndexPort['deleteByFilter'];
} = {}) {
  return {
    ensureCollection: vi.fn(overrides.ensureCollection ?? (async () => {})),
    upsert: vi.fn(overrides.upsert ?? (async () => {})),
    deleteByFilter: vi.fn(overrides.deleteByFilter ?? (async () => {})),
  };
}

const baseRequest: KnowledgeReindexRequest = {
  evolutionId: 'evo_1',
  knowledgeObjectId: 'ko_1',
  version: 3,
  tenantId: 'momentum',
  teamId: 'team_1',
  teamKey: 'team_magnificent',
  teamName: 'Team Magnificent',
  domain: 'success',
  language: 'en',
  lifecycle: 'active',
  approved: true,
  document: 'Approved success principle summary.',
  retrievalReady: true,
  sourceCandidateIds: ['cand_1'],
  sourceLearningSignalIds: ['sig_1'],
};

describe('reindexKnowledgeEvolution — active indexing', () => {
  let statuses: KnowledgeEvolutionCoordinationStatus[];
  beforeEach(() => {
    statuses = [];
  });

  it('upserts an active-knowledge record with preserved scope + source metadata', async () => {
    const chroma = mockChroma();
    const result = await reindexKnowledgeEvolution(baseRequest, {
      chroma,
      markStatus: (_id, status) => {
        statuses.push(status);
      },
    });

    expect(result.status).toBe('completed');
    expect(result.indexingStatus).toBe('completed');
    expect(result.action).toBe('index_active');
    expect(result.collection).toBe('mcs_success_knowledge_en');
    expect(result.documentId).toBe(activeKnowledgeDocumentId('ko_1', 3, 'en'));
    expect(result.attempts).toBe(1);
    expect(result.retryable).toBe(false);

    expect(chroma.ensureCollection).toHaveBeenCalledWith('mcs_success_knowledge_en');
    expect(chroma.upsert).toHaveBeenCalledTimes(1);
    const upsert = chroma.upsert.mock.calls[0]![0];
    expect(upsert.collection).toBe('mcs_success_knowledge_en');
    expect(upsert.document).toBe('Approved success principle summary.');
    expect(upsert.metadata).toMatchObject({
      knowledgeObjectId: 'ko_1',
      version: 3,
      domain: 'success',
      language: 'en',
      lifecycleStatus: 'active',
      governanceStatus: 'approved',
      retrievalReady: true,
      tenantId: 'momentum',
      teamId: 'team_1',
      teamKey: 'team_magnificent',
      teamName: 'Team Magnificent',
      sourceCandidateIds: 'cand_1',
      sourceLearningSignalIds: 'sig_1',
      sourceTraceable: true,
    });
    // status transitions: pending → completed
    expect(statuses).toEqual(['pending', 'completed']);
  });

  it('marks failed + retryable when Chroma upsert keeps throwing, honoring maxAttempts', async () => {
    const chroma = mockChroma({
      upsert: vi.fn(async () => {
        throw new Error('chroma 503');
      }),
    });
    const result = await reindexKnowledgeEvolution(baseRequest, {
      chroma,
      maxAttempts: 2,
      markStatus: (_id, status) => void statuses.push(status),
    });

    expect(result.status).toBe('failed');
    expect(result.indexingStatus).toBe('failed');
    expect(result.retryable).toBe(true);
    expect(result.attempts).toBe(2);
    expect(result.error).toContain('chroma 503');
    expect(chroma.upsert).toHaveBeenCalledTimes(2);
    expect(statuses).toEqual(['pending', 'failed']);
  });

  it('recovers on a later attempt (retryable job) and reports the winning attempt count', async () => {
    let calls = 0;
    const chroma = mockChroma({
      upsert: vi.fn(async () => {
        calls += 1;
        if (calls < 2) throw new Error('transient');
      }),
    });
    const result = await reindexKnowledgeEvolution(baseRequest, { chroma, maxAttempts: 3 });
    expect(result.status).toBe('completed');
    expect(result.attempts).toBe(2);
  });

  it('fails NON-retryably when index_active has no document to embed', async () => {
    const chroma = mockChroma();
    const result = await reindexKnowledgeEvolution(
      { ...baseRequest, document: '   ' },
      { chroma },
    );
    expect(result.status).toBe('failed');
    expect(result.retryable).toBe(false);
    expect(chroma.upsert).not.toHaveBeenCalled();
  });
});

describe('reindexKnowledgeEvolution — candidate / review-only separation', () => {
  it.each(['candidate', 'review_only'] as const)(
    'NEVER writes %s knowledge to an active collection (no Chroma add call)',
    async (lifecycle) => {
      const chroma = mockChroma();
      const statuses: KnowledgeEvolutionCoordinationStatus[] = [];
      const result = await reindexKnowledgeEvolution(
        { ...baseRequest, lifecycle },
        { chroma, markStatus: (_id, s) => void statuses.push(s) },
      );
      expect(result.action).toBe('keep_out_of_active');
      expect(result.status).toBe('not_required');
      expect(result.indexingStatus).toBe('not_required');
      expect(chroma.ensureCollection).not.toHaveBeenCalled();
      expect(chroma.upsert).not.toHaveBeenCalled();
      expect(chroma.deleteByFilter).not.toHaveBeenCalled();
      expect(statuses).toEqual(['not_required']);
    },
  );

  it('keeps personal-domain knowledge out of active collections', async () => {
    const chroma = mockChroma();
    const result = await reindexKnowledgeEvolution(
      { ...baseRequest, domain: 'personal' },
      { chroma },
    );
    expect(result.action).toBe('keep_out_of_active');
    expect(chroma.upsert).not.toHaveBeenCalled();
  });
});

describe('reindexKnowledgeEvolution — supersession / archival exclusion', () => {
  it.each(['superseded', 'archived'] as const)(
    'removes %s knowledge from its active collection by knowledgeObjectId filter',
    async (lifecycle) => {
      const chroma = mockChroma();
      const result = await reindexKnowledgeEvolution(
        { ...baseRequest, lifecycle },
        { chroma },
      );
      expect(result.action).toBe('remove_from_active');
      expect(result.status).toBe('completed');
      expect(chroma.upsert).not.toHaveBeenCalled();
      expect(chroma.deleteByFilter).toHaveBeenCalledWith({
        collection: 'mcs_success_knowledge_en',
        where: { knowledgeObjectId: 'ko_1' },
      });
    },
  );

  it('marks removal failed + retryable when the delete keeps throwing', async () => {
    const chroma = mockChroma({
      deleteByFilter: vi.fn(async () => {
        throw new Error('delete boom');
      }),
    });
    const result = await reindexKnowledgeEvolution(
      { ...baseRequest, lifecycle: 'archived' },
      { chroma, maxAttempts: 2 },
    );
    expect(result.status).toBe('failed');
    expect(result.retryable).toBe(true);
    expect(result.attempts).toBe(2);
  });
});
