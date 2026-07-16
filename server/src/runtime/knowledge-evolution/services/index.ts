/**
 * Knowledge Evolution Runtime — Lane B service barrel + composition helper.
 *
 * Re-exports the core services and provides `composeKnowledgeEvolutionServices`, which wires the
 * sub-services against a set of repository ports. Lane D supplies the concrete repositories (from
 * Lane A) and default runtime deps; tests supply in-memory fakes. No route/worker coupling here.
 */

import { defaultEvolutionRuntimeDeps, type EvolutionRuntimeDeps } from '../deps.js';
import { createEvolutionApprovalService, type EvolutionApprovalAuthorityPort } from './EvolutionApproval.service.js';
import { createEvolutionPlanService } from './EvolutionPlan.service.js';
import { createEvolutionVersionService } from './EvolutionVersion.service.js';
import { createSupersessionService } from './Supersession.service.js';
import { createArchiveService } from './Archive.service.js';
import { createRetrievalRolloutService } from './RetrievalRollout.service.js';
import { createEvolutionRollbackService } from './EvolutionRollback.service.js';
import { createEvolutionMetricsService } from './EvolutionMetrics.service.js';
import { createKnowledgeEvolutionService } from './KnowledgeEvolution.service.js';
import type {
  EvolutionErrorRepository,
  EvolutionMetricsDataSource,
  EvolutionMetricsRepository,
  EvolutionPlanRepository,
  EvolutionRecordRepository,
  EvolutionVersionRepository,
  LanguageEvolutionRepository,
  RetrievalRolloutRepository,
  RollbackPlanRepository,
  SupersessionRepository,
} from './ports.js';

export * from './ports.js';
export * from './EvolutionApproval.service.js';
export * from './EvolutionPlan.service.js';
export * from './EvolutionVersion.service.js';
export * from './Supersession.service.js';
export * from './Archive.service.js';
export * from './RetrievalRollout.service.js';
export * from './EvolutionRollback.service.js';
export * from './EvolutionMetrics.service.js';
export * from './KnowledgeEvolution.service.js';

export interface KnowledgeEvolutionRepositories {
  recordRepository: EvolutionRecordRepository;
  planRepository: EvolutionPlanRepository;
  versionRepository: EvolutionVersionRepository;
  supersessionRepository: SupersessionRepository;
  rolloutRepository: RetrievalRolloutRepository;
  rollbackPlanRepository: RollbackPlanRepository;
  languageEvolutionRepository: LanguageEvolutionRepository;
  errorRepository: EvolutionErrorRepository;
  metricsRepository: EvolutionMetricsRepository;
  metricsDataSource: EvolutionMetricsDataSource;
}

/** Fully-wired Lane B service set. */
export function composeKnowledgeEvolutionServices(
  repositories: KnowledgeEvolutionRepositories,
  runtime: EvolutionRuntimeDeps = defaultEvolutionRuntimeDeps(),
  approvalAuthority?: EvolutionApprovalAuthorityPort,
) {
  const approvalService = createEvolutionApprovalService(approvalAuthority);
  const planService = createEvolutionPlanService(repositories.planRepository, runtime);
  const versionService = createEvolutionVersionService(
    repositories.versionRepository,
    runtime,
  );
  const supersessionService = createSupersessionService(
    repositories.supersessionRepository,
    runtime,
  );
  const archiveService = createArchiveService(versionService);
  const rolloutService = createRetrievalRolloutService(
    repositories.rolloutRepository,
    runtime,
  );
  const rollbackService = createEvolutionRollbackService(
    repositories.recordRepository,
    repositories.planRepository,
    repositories.rollbackPlanRepository,
    versionService,
    runtime,
  );
  const metricsService = createEvolutionMetricsService(
    repositories.metricsDataSource,
    repositories.metricsRepository,
    runtime,
  );
  const knowledgeEvolutionService = createKnowledgeEvolutionService({
    recordRepository: repositories.recordRepository,
    errorRepository: repositories.errorRepository,
    approvalService,
    planService,
    versionService,
    supersessionService,
    archiveService,
    rolloutService,
    rollbackService,
    runtime,
  });

  return {
    approvalService,
    planService,
    versionService,
    supersessionService,
    archiveService,
    rolloutService,
    rollbackService,
    metricsService,
    knowledgeEvolutionService,
  };
}
