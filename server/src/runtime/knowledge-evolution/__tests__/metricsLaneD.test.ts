/**
 * Lane D metrics + operational-health tests — pure computation from records/rollouts.
 */

import { describe, expect, it } from 'vitest';
import type {
  KnowledgeEvolutionRecord,
  KnowledgeRetrievalRollout,
} from '@momentum/shared/runtime';
import {
  computeOperationalHealth,
  computeRawCountsFromRecords,
} from '../metricsHealth.js';

function record(overrides: Partial<KnowledgeEvolutionRecord>): KnowledgeEvolutionRecord {
  return {
    evolutionId: 'kev_x',
    tenantId: 'tenant_team_magnificent',
    teamId: 'team_magnificent',
    teamKey: 'team_magnificent',
    teamName: 'Team Magnificent',
    inputType: 'approved_candidate',
    inputId: 'in_1',
    status: 'planning',
    domain: 'success',
    language: 'en',
    sourceKnowledgeObjectIds: [],
    sourceCandidateIds: ['cand_1'],
    sourceOutcomeIds: [],
    sourceLearningSignalIds: [],
    sourceEventIds: [],
    evolutionAction: 'create_new_knowledge',
    approvalReference: {
      approvalId: 'appr_1',
      approvedBy: 'TMBA-1',
      approvalType: 'review_workflow',
      approvedAt: new Date('2026-07-09T00:00:00.000Z'),
    },
    indexingStatus: 'not_required',
    graphStatus: 'not_required',
    retrievalStatus: 'not_ready',
    createdAt: new Date('2026-07-10T12:00:00.000Z'),
    updatedAt: new Date('2026-07-10T12:00:05.000Z'),
    ...overrides,
  };
}

function rollout(overrides: Partial<KnowledgeRetrievalRollout>): KnowledgeRetrievalRollout {
  return {
    rolloutId: 'kevrol_1',
    evolutionId: 'kev_x',
    knowledgeObjectId: 'ko_1',
    version: 1,
    tenantId: 'tenant_team_magnificent',
    language: 'en',
    availableToAgents: [],
    availableToDomains: [],
    retrievalReady: false,
    ...overrides,
  };
}

describe('computeRawCountsFromRecords', () => {
  it('derives rates/counts from a window of records', () => {
    const counts = computeRawCountsFromRecords([
      record({ status: 'completed', indexingStatus: 'completed', graphStatus: 'completed' }),
      record({ status: 'failed', indexingStatus: 'failed' }),
      record({
        status: 'completed',
        retrievalStatus: 'ready',
        language: 'es',
        indexingStatus: 'completed',
        graphStatus: 'completed',
      }),
      record({ evolutionAction: 'supersede_existing_knowledge' }),
      record({ evolutionAction: 'archive_existing_knowledge' }),
      record({ status: 'rolled_back' }),
    ]);

    expect(counts.totalEvolutions).toBe(6);
    expect(counts.completedEvolutions).toBe(2);
    expect(counts.failedEvolutions).toBe(1);
    expect(counts.rollbackCount).toBe(1);
    expect(counts.reindexAttempts).toBe(3);
    expect(counts.reindexSuccesses).toBe(2);
    expect(counts.graphSyncAttempts).toBe(2);
    expect(counts.graphSyncSuccesses).toBe(2);
    expect(counts.supersessionCount).toBe(1);
    expect(counts.archiveCount).toBe(1);
    expect(counts.spanishActivations).toBe(1);
    expect(counts.englishActivations).toBe(0);
    expect(counts.approvedCandidates).toBe(6);
    expect(counts.activatedCandidates).toBe(1);
    expect(counts.timeToRetrievalReadyMsSamples).toEqual([5000]);
  });

  it('returns zeroed rates for an empty window', () => {
    const counts = computeRawCountsFromRecords([]);
    expect(counts.totalEvolutions).toBe(0);
    expect(counts.timeToRetrievalReadyMsSamples).toEqual([]);
  });
});

describe('computeOperationalHealth', () => {
  it('reports backlog, failures, retrieval-ready and blocked rollout reasons', () => {
    const window = {
      tenantId: 'tenant_team_magnificent',
      teamId: 'team_magnificent',
      periodStart: new Date('2026-07-01T00:00:00.000Z'),
      periodEnd: new Date('2026-07-31T00:00:00.000Z'),
      generatedAt: new Date('2026-07-10T12:00:00.000Z'),
    };
    const health = computeOperationalHealth(
      window,
      [
        record({ status: 'planning' }),
        record({ status: 'indexing' }),
        record({ status: 'failed' }),
        record({ status: 'writing_to_knowledge_core', indexingStatus: 'failed', graphStatus: 'failed' }),
        record({ status: 'completed', retrievalStatus: 'ready' }),
      ],
      [
        rollout({ retrievalReady: false, blockedReason: 'indexing_incomplete' }),
        rollout({ evolutionId: 'kev_y', retrievalReady: false, blockedReason: 'indexing_incomplete' }),
        rollout({ evolutionId: 'kev_z', retrievalReady: false, blockedReason: 'graph_incomplete' }),
        rollout({ evolutionId: 'kev_ready', retrievalReady: true }),
      ],
    );

    expect(health.backlog).toBe(3); // planning + indexing + writing_to_knowledge_core
    expect(health.failedEvolutionJobs).toBe(1);
    expect(health.failedReindexJobs).toBe(1);
    expect(health.failedGraphSyncJobs).toBe(1);
    expect(health.retrievalReadyCount).toBe(1);
    expect(health.blockedRolloutReasons).toEqual([
      { reason: 'indexing_incomplete', count: 2 },
      { reason: 'graph_incomplete', count: 1 },
    ]);
    expect(health.periodStart).toBe('2026-07-01T00:00:00.000Z');
  });
});
