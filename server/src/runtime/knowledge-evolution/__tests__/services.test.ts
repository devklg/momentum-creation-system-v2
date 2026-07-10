/**
 * Unit tests for Lane B services: plan creation, version creation, supersession, archival,
 * retrieval rollout, rollback, metrics, and the orchestrator's failure behavior (spec §§13–30).
 */

import { describe, expect, it } from 'vitest';
import {
  createArchiveService,
  createEvolutionMetricsService,
  createEvolutionPlanService,
  createEvolutionRollbackService,
  createEvolutionVersionService,
  createRetrievalRolloutService,
  createSupersessionService,
  designPlanForAction,
  computeMetricsSnapshotFields,
} from '../services/index.js';
import { composeKnowledgeEvolutionServices } from '../services/index.js';
import { KnowledgeEvolutionRuntimeError } from '../errors.js';
import type { RetrievalReadinessInput } from '../policies/EvolutionRetrievalReadinessPolicy.js';
import {
  FakeEvolutionPlanRepository,
  FakeEvolutionVersionRepository,
  FakeMetricsDataSource,
  FakeMetricsRepository,
  FakeRetrievalRolloutRepository,
  FakeSupersessionRepository,
  emptyRawCounts,
  makeApprovalReference,
  makeDeps,
  makeRepositories,
  makeStartRequest,
} from './fakes.js';

const READY: RetrievalReadinessInput = {
  knowledgeObjectExists: true,
  lifecycleActive: true,
  governancePermitsUse: true,
  approvalReferencePresent: true,
  versionRecordExists: true,
  sourceTraceabilityExists: true,
  indexingStatus: 'completed',
  graphStatus: 'completed',
  languageMetadataPresent: true,
  permissionScopePresent: true,
  teamScopeValid: true,
};

describe('EvolutionPlanService (§13)', () => {
  it('designs create as a retrieval-affecting plan with a rollback plan', async () => {
    const repo = new FakeEvolutionPlanRepository();
    const service = createEvolutionPlanService(repo, makeDeps());
    const plan = await service.createPlan({
      evolutionId: 'kev_1',
      tenantId: 't',
      teamId: 'team_magnificent',
      teamKey: 'team_magnificent',
      teamName: 'Team Magnificent',
      evolutionAction: 'create_new_knowledge',
      language: 'en',
      sourceKnowledgeObjectIds: [],
      sourceCandidateIds: ['cand_1'],
    });
    expect(plan.action).toBe('create');
    expect(plan.affectsRetrieval).toBe(true);
    expect(plan.requiresReindex).toBe(true);
    expect(plan.requiresGraphSync).toBe(true);
    expect(plan.rollbackPlan).toBeDefined();
    expect(plan.requiredSteps[0]?.stepKey).toBe('validate_approval');
    expect(await repo.findByPlanId(plan.planId)).not.toBeNull();
  });

  it('designs graph_sync_only without a rollback plan (no retrieval effect)', () => {
    const design = designPlanForAction('graph_sync_only');
    expect(design.action).toBe('graph_sync');
    expect(design.affectsRetrieval).toBe(false);
    expect(design.requiresReindex).toBe(false);
    expect(design.requiresGraphSync).toBe(true);
  });

  it('archive affects retrieval (removes embeddings)', () => {
    const design = designPlanForAction('archive_existing_knowledge');
    expect(design.affectsRetrieval).toBe(true);
  });
});

describe('EvolutionVersionService (§16)', () => {
  it('creates version 1 then increments, preserving prior versions', async () => {
    const repo = new FakeEvolutionVersionRepository();
    const service = createEvolutionVersionService(repo, makeDeps());

    const v1 = await service.createVersion({
      knowledgeObjectId: 'kobj_1',
      evolutionId: 'kev_1',
      changeType: 'created',
      snapshotAfter: { a: 1 },
      reason: 'first',
      approvedBy: 'TMBA-1',
    });
    const v2 = await service.createVersion({
      knowledgeObjectId: 'kobj_1',
      evolutionId: 'kev_2',
      changeType: 'updated',
      snapshotAfter: { a: 2 },
      reason: 'second',
      approvedBy: 'TMBA-1',
    });

    expect(v1.version).toBe(1);
    expect(v1.previousVersion).toBeUndefined();
    expect(v2.version).toBe(2);
    expect(v2.previousVersion).toBe(1);
    expect(await service.listVersions('kobj_1')).toHaveLength(2);
  });

  it('rejects version creation without a knowledge object', async () => {
    const service = createEvolutionVersionService(new FakeEvolutionVersionRepository(), makeDeps());
    await expect(
      service.createVersion({
        knowledgeObjectId: '',
        evolutionId: 'kev_1',
        changeType: 'created',
        snapshotAfter: {},
        reason: 'x',
        approvedBy: 'y',
      }),
    ).rejects.toMatchObject({ errorType: 'version_creation_failed' });
  });
});

describe('SupersessionService (§17)', () => {
  it('records a supersession relationship with Team Magnificent scope', async () => {
    const repo = new FakeSupersessionRepository();
    const service = createSupersessionService(repo, makeDeps());
    const record = await service.recordSupersession({
      tenantId: 't',
      teamId: 'team_magnificent',
      oldKnowledgeObjectId: 'old_1',
      newKnowledgeObjectId: 'new_1',
      reason: 'newer approved knowledge',
      approvalReference: makeApprovalReference(),
      supersededBy: 'TMBA-1',
    });
    expect(record.teamKey).toBe('team_magnificent');
    expect(repo.store).toHaveLength(1);
  });

  it('rejects supersession when old and new are the same object', async () => {
    const service = createSupersessionService(new FakeSupersessionRepository(), makeDeps());
    await expect(
      service.recordSupersession({
        tenantId: 't',
        teamId: 'team_magnificent',
        oldKnowledgeObjectId: 'same',
        newKnowledgeObjectId: 'same',
        reason: 'x',
        approvalReference: makeApprovalReference(),
        supersededBy: 'TMBA-1',
      }),
    ).rejects.toMatchObject({ errorType: 'supersession_failed' });
  });
});

describe('ArchiveService (§18)', () => {
  it('archives by appending an archived version, retaining audit and excluding from retrieval', async () => {
    const versionRepo = new FakeEvolutionVersionRepository();
    const versionService = createEvolutionVersionService(versionRepo, makeDeps());
    const archiveService = createArchiveService(versionService);

    const outcome = await archiveService.archive({
      knowledgeObjectId: 'kobj_1',
      evolutionId: 'kev_1',
      reason: 'retired',
      approvedBy: 'TMBA-1',
    });

    expect(outcome.excludedFromRetrieval).toBe(true);
    expect(outcome.retainedForAudit).toBe(true);
    expect(outcome.archivedVersion.changeType).toBe('archived');
    expect(versionRepo.store).toHaveLength(1);
  });
});

describe('RetrievalRolloutService (§21)', () => {
  it('marks retrieval ready and exposes the domain to its agent when all checks pass', async () => {
    const repo = new FakeRetrievalRolloutRepository();
    const service = createRetrievalRolloutService(repo, makeDeps());
    const rollout = await service.markRetrievalReady(
      {
        tenantId: 't',
        teamId: 'team_magnificent',
        evolutionId: 'kev_1',
        knowledgeObjectId: 'kobj_1',
        version: 1,
      },
      { domain: 'success', language: 'en', readiness: READY },
    );
    expect(rollout.retrievalReady).toBe(true);
    expect(rollout.availableToAgents).toContain('steve_success');
    expect(rollout.availableToDomains).toEqual(['success']);
    expect(rollout.readyAt).toBeDefined();
  });

  it('keeps retrieval blocked with a reason when a check fails', async () => {
    const service = createRetrievalRolloutService(new FakeRetrievalRolloutRepository(), makeDeps());
    const rollout = await service.markRetrievalReady(
      {
        tenantId: 't',
        teamId: 'team_magnificent',
        evolutionId: 'kev_1',
        knowledgeObjectId: 'kobj_1',
        version: 1,
      },
      { domain: 'success', language: 'en', readiness: { ...READY, graphStatus: 'pending' } },
    );
    expect(rollout.retrievalReady).toBe(false);
    expect(rollout.availableToAgents).toEqual([]);
    expect(rollout.blockedReason).toContain('neo4j_graph_sync_pending');
  });

  it('never makes personal-domain knowledge retrievable', async () => {
    const service = createRetrievalRolloutService(new FakeRetrievalRolloutRepository(), makeDeps());
    const rollout = await service.markRetrievalReady(
      {
        tenantId: 't',
        teamId: 'team_magnificent',
        evolutionId: 'kev_1',
        knowledgeObjectId: 'kobj_1',
        version: 1,
      },
      { domain: 'personal', language: 'en', readiness: READY },
    );
    expect(rollout.retrievalReady).toBe(false);
    expect(rollout.blockedReason).toContain('personal_domain_not_retrievable');
  });

  it('is idempotent by evolutionId (reuses the same rolloutId)', async () => {
    const repo = new FakeRetrievalRolloutRepository();
    const service = createRetrievalRolloutService(repo, makeDeps());
    const input = {
      tenantId: 't',
      teamId: 'team_magnificent',
      evolutionId: 'kev_1',
      knowledgeObjectId: 'kobj_1',
      version: 1,
    };
    const first = await service.markRetrievalReady(input, {
      domain: 'success',
      language: 'en',
      readiness: { ...READY, indexingStatus: 'pending' },
    });
    const second = await service.markRetrievalReady(input, {
      domain: 'success',
      language: 'en',
      readiness: READY,
    });
    expect(second.rolloutId).toBe(first.rolloutId);
    expect(second.retrievalReady).toBe(true);
  });
});

describe('EvolutionMetricsService (§28)', () => {
  it('computes rates, parity, and candidate-to-active safely', () => {
    const fields = computeMetricsSnapshotFields(
      emptyRawCounts({
        totalEvolutions: 10,
        completedEvolutions: 8,
        failedEvolutions: 2,
        timeToRetrievalReadyMsSamples: [1000, 3000],
        reindexAttempts: 4,
        reindexSuccesses: 3,
        graphSyncAttempts: 0,
        graphSyncSuccesses: 0,
        englishActivations: 3,
        spanishActivations: 3,
        approvedCandidates: 5,
        activatedCandidates: 4,
      }),
    );
    expect(fields.evolutionCompletionRate).toBeCloseTo(0.8);
    expect(fields.evolutionFailureRate).toBeCloseTo(0.2);
    expect(fields.averageTimeToRetrievalReadyMs).toBe(2000);
    expect(fields.reindexSuccessRate).toBeCloseTo(0.75);
    expect(fields.graphSyncSuccessRate).toBe(0); // no attempts ⇒ 0, not NaN
    expect(fields.bilingualActivationParity).toBe(1);
    expect(fields.candidateToActiveRate).toBeCloseTo(0.8);
  });

  it('builds and persists a snapshot with Team Magnificent identity', async () => {
    const service = createEvolutionMetricsService(
      new FakeMetricsDataSource(emptyRawCounts({ totalEvolutions: 2, completedEvolutions: 2 })),
      new FakeMetricsRepository(),
      makeDeps(),
    );
    const snapshot = await service.buildSnapshot({
      tenantId: 't',
      teamId: 'team_magnificent',
      periodStart: new Date('2026-07-01T00:00:00.000Z'),
      periodEnd: new Date('2026-07-10T00:00:00.000Z'),
    });
    expect(snapshot.teamKey).toBe('team_magnificent');
    expect(snapshot.evolutionCompletionRate).toBe(1);
  });
});

describe('EvolutionRollbackService (§14, §30.3)', () => {
  it('rolls back preserving history: appends a restored version and marks rolled_back', async () => {
    const repos = makeRepositories();
    const deps = makeDeps();
    const versionService = createEvolutionVersionService(repos.versionRepository, deps);
    const rollbackService = createEvolutionRollbackService(
      repos.recordRepository,
      repos.planRepository,
      repos.rollbackPlanRepository,
      versionService,
      deps,
    );

    // Seed a completed, retrieval-affecting evolution with a plan + rollback plan.
    await repos.recordRepository.insert({
      evolutionId: 'kev_1',
      tenantId: 't',
      teamId: 'team_magnificent',
      teamKey: 'team_magnificent',
      teamName: 'Team Magnificent',
      inputType: 'approved_candidate',
      inputId: 'in_1',
      status: 'retrieval_ready',
      domain: 'success',
      language: 'en',
      targetKnowledgeObjectId: 'kobj_1',
      sourceKnowledgeObjectIds: [],
      sourceCandidateIds: ['cand_1'],
      sourceOutcomeIds: [],
      sourceLearningSignalIds: [],
      sourceEventIds: [],
      evolutionAction: 'create_new_knowledge',
      versionCreated: 1,
      approvalReference: makeApprovalReference(),
      indexingStatus: 'completed',
      graphStatus: 'completed',
      retrievalStatus: 'ready',
      createdAt: new Date('2026-07-10T12:00:00.000Z'),
      updatedAt: new Date('2026-07-10T12:00:00.000Z'),
    });
    await repos.planRepository.insert({
      planId: 'plan_1',
      evolutionId: 'kev_1',
      tenantId: 't',
      teamId: 'team_magnificent',
      teamKey: 'team_magnificent',
      teamName: 'Team Magnificent',
      action: 'create',
      sourceKnowledgeObjectIds: [],
      sourceCandidateIds: ['cand_1'],
      requiredSteps: [],
      riskFlags: [],
      language: 'en',
      requiresReindex: true,
      requiresGraphSync: true,
      affectsRetrieval: true,
      rollbackPlan: {
        rollbackPlanId: 'rbk_1',
        evolutionId: 'kev_1',
        rollbackType: 'mark_not_retrieval_ready',
        previousKnowledgeObjectIds: ['kobj_1'],
        previousVersionNumbers: [],
        createdAt: new Date('2026-07-10T12:00:00.000Z'),
      },
      createdAt: new Date('2026-07-10T12:00:00.000Z'),
    });

    const updated = await rollbackService.rollback({
      tenantId: 't',
      teamId: 'team_magnificent',
      evolutionId: 'kev_1',
      rollbackReason: 'bad evolution',
      requestedBy: 'TMBA-1',
    });

    expect(updated.status).toBe('rolled_back');
    expect(updated.retrievalStatus).toBe('rolled_back');
    // Prior version preserved; a restored version was appended.
    const versions = await versionService.listVersions('kobj_1');
    expect(versions.some((v) => v.changeType === 'restored')).toBe(true);
    expect(repos.rollbackPlanRepository.store).toHaveLength(1);
  });

  it('fails rollback when the evolution does not exist', async () => {
    const repos = makeRepositories();
    const deps = makeDeps();
    const versionService = createEvolutionVersionService(repos.versionRepository, deps);
    const rollbackService = createEvolutionRollbackService(
      repos.recordRepository,
      repos.planRepository,
      repos.rollbackPlanRepository,
      versionService,
      deps,
    );
    await expect(
      rollbackService.rollback({
        tenantId: 't',
        teamId: 'team_magnificent',
        evolutionId: 'missing',
        rollbackReason: 'x',
        requestedBy: 'TMBA-1',
      }),
    ).rejects.toBeInstanceOf(KnowledgeEvolutionRuntimeError);
  });
});

describe('KnowledgeEvolutionService orchestrator (§26, §30)', () => {
  function compose() {
    const repos = makeRepositories();
    const { knowledgeEvolutionService } = composeKnowledgeEvolutionServices(repos, makeDeps());
    return { repos, service: knowledgeEvolutionService };
  }

  it('starts an evolution: creates a record then a plan, and blocks retrieval', async () => {
    const { repos, service } = compose();
    const { evolution, plan } = await service.startEvolution(makeStartRequest());

    expect(evolution.status).toBe('planning');
    expect(evolution.retrievalStatus).toBe('blocked'); // create affects retrieval
    expect(evolution.indexingStatus).toBe('pending');
    expect(plan.evolutionId).toBe(evolution.evolutionId);
    expect(await repos.planRepository.findByPlanId(plan.planId)).not.toBeNull();
  });

  it('rejects evolution without an approval reference (approval_missing) and records the error', async () => {
    const { repos, service } = compose();
    await expect(
      service.startEvolution(
        makeStartRequest({
          approvalReference: undefined as unknown as ReturnType<typeof makeApprovalReference>,
        }),
      ),
    ).rejects.toMatchObject({ errorType: 'approval_missing' });
    expect(repos.errorRepository.store.at(0)?.errorType).toBe('approval_missing');
  });

  it('rejects non-Team-Magnificent BA-derived knowledge (invalid_ba_scope)', async () => {
    const { service } = compose();
    await expect(
      service.startEvolution(
        makeStartRequest({
          teamKey: 'team_other' as never,
          teamName: 'Other' as never,
          baId: 'TMBA-1',
        }),
      ),
    ).rejects.toMatchObject({ errorType: 'invalid_ba_scope' });
  });

  it('rejects missing language metadata (invalid_language)', async () => {
    const { service } = compose();
    await expect(
      service.startEvolution(makeStartRequest({ language: 'fr' as never })),
    ).rejects.toMatchObject({ errorType: 'invalid_language' });
  });

  it('rejects an update action with no source knowledge (source_missing)', async () => {
    const { service } = compose();
    await expect(
      service.startEvolution(
        makeStartRequest({
          inputType: 'approved_refinement',
          evolutionAction: 'update_existing_knowledge',
          sourceCandidateIds: ['cand_1'],
          sourceKnowledgeObjectIds: [],
          targetKnowledgeObjectId: undefined,
        }),
      ),
    ).rejects.toMatchObject({ errorType: 'source_missing' });
  });

  it('executes a plan: creates a version and requests coordination, retrieval stays blocked', async () => {
    const { repos, service } = compose();
    const { plan } = await service.startEvolution(makeStartRequest());
    const executed = await service.executeEvolutionPlan(plan.planId);

    expect(executed.versionCreated).toBe(1);
    expect(executed.targetKnowledgeObjectId).toBeDefined();
    expect(executed.status).toBe('writing_to_knowledge_core');
    expect(executed.indexingStatus).toBe('pending');
    expect(executed.retrievalStatus).toBe('blocked');
    const koId = executed.targetKnowledgeObjectId as string;
    expect(repos.versionRepository.store.some((v) => v.knowledgeObjectId === koId)).toBe(true);
  });

  it('end-to-end: approved candidate becomes retrieval-ready only after coordination completes', async () => {
    const { repos, service } = compose();
    const { evolution, plan } = await service.startEvolution(makeStartRequest());
    await service.executeEvolutionPlan(plan.planId);

    // Simulate Lane C/D completing Chroma + Neo4j coordination.
    await repos.recordRepository.patch(evolution.evolutionId, {
      indexingStatus: 'completed',
      graphStatus: 'completed',
    });
    const record = await service.getEvolutionById(evolution.evolutionId);
    const rollout = await service.markRetrievalReady({
      tenantId: record!.tenantId,
      teamId: record!.teamId,
      evolutionId: evolution.evolutionId,
      knowledgeObjectId: record!.targetKnowledgeObjectId as string,
      version: record!.versionCreated as number,
    });

    expect(rollout.retrievalReady).toBe(true);
    const final = await service.getEvolutionById(evolution.evolutionId);
    expect(final?.status).toBe('retrieval_ready');
    expect(final?.retrievalStatus).toBe('ready');
  });

  it('markRetrievalReady stays blocked while coordination is pending', async () => {
    const { service } = compose();
    const { evolution, plan } = await service.startEvolution(makeStartRequest());
    await service.executeEvolutionPlan(plan.planId); // leaves indexing/graph pending
    const record = await service.getEvolutionById(evolution.evolutionId);
    const rollout = await service.markRetrievalReady({
      tenantId: record!.tenantId,
      teamId: record!.teamId,
      evolutionId: evolution.evolutionId,
      knowledgeObjectId: record!.targetKnowledgeObjectId as string,
      version: record!.versionCreated as number,
    });
    expect(rollout.retrievalReady).toBe(false);
    const final = await service.getEvolutionById(evolution.evolutionId);
    expect(final?.retrievalStatus).toBe('blocked');
  });
});
