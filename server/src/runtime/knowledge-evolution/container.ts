/**
 * Knowledge Evolution Runtime — Lane D composition root (container).
 *
 * Wires the merged lanes into a single runnable runtime:
 *   - Lane A repositories → Lane B repository PORTS (thin adapters; the sanctioned write path)
 *   - Lane B `composeKnowledgeEvolutionServices` (business logic the routes call)
 *   - a Mongo-backed metrics data source (window aggregation via Lane A list repositories)
 *   - Lane C reindex / graph-sync coordinators, bound with a record-status marker
 *   - the in-process event bus + the six workers
 *
 * Routes call SERVICES only; workers call services + the bound Lane C coordinators. Nothing here
 * reaches a store through the low-level dispatch client directly — persistence flows through the
 * Lane A repositories/primitives, which are the governed direct-dispatch surface (spec §27).
 *
 * A lazily-built singleton is the production runtime (workers auto-start on first access so
 * `index.ts` stays a 2-line additive mount). Tests inject fakes via `setKnowledgeEvolutionRuntimeForTest`.
 */

import type {
  KnowledgeEvolutionMetricsQuery,
  KnowledgeRetrievalRollout,
} from '@momentum/shared/runtime';
import { defaultEvolutionRuntimeDeps, type EvolutionRuntimeDeps } from './deps.js';
import {
  composeKnowledgeEvolutionServices,
  type KnowledgeEvolutionRepositories,
} from './services/index.js';
import type {
  EvolutionMetricsDataSource,
  EvolutionRecordRepository,
  EvolutionPlanRepository,
  EvolutionVersionRepository,
  SupersessionRepository,
  RetrievalRolloutRepository,
  RollbackPlanRepository,
  LanguageEvolutionRepository,
  EvolutionErrorRepository,
  EvolutionMetricsRepository,
} from './services/ports.js';
import {
  createEvolutionRecord,
  getEvolutionRecordById,
  patchEvolutionRecord,
  findEvolutionRecordByInput,
  listEvolutionRecords,
  createEvolutionPlan,
  getEvolutionPlanById,
  getEvolutionPlanByEvolutionId,
  appendVersion,
  getLatestVersion,
  listVersionsForKnowledgeObject,
  appendSupersessionRecord,
  createRetrievalRollout,
  getRetrievalRolloutById,
  getRetrievalRolloutByEvolutionId,
  listRetrievalRollouts,
  createRollbackPlan,
  getRollbackPlanByEvolutionId,
  createLanguageEvolutionRecord,
  recordEvolutionError,
  recordMetricsSnapshot,
} from './repositories/index.js';
import {
  assertNoProtectedFields,
  KNOWLEDGE_RETRIEVAL_ROLLOUT_COLLECTION,
  KNOWLEDGE_RETRIEVAL_ROLLOUT_PROTECTED_FIELDS,
} from './models/index.js';
import { repoPatch } from './persistence/mongoRepository.js';
import {
  reindexKnowledgeEvolution,
  type KnowledgeReindexRequest,
  type KnowledgeReindexResult,
} from './indexing/index.js';
import {
  syncKnowledgeEvolutionGraph,
  type GraphMapperInput,
  type KnowledgeGraphSyncResult,
} from './graph/index.js';
import { createKnowledgeEvolutionEventBus, type KnowledgeEvolutionEventBus } from './events/bus.js';
import {
  createKnowledgeEvolutionWorkers,
  type KnowledgeEvolutionWorkers,
} from './workers/index.js';
import type { FindRecordByInput } from './workers/types.js';
import {
  computeOperationalHealth,
  computeRawCountsFromRecords,
  type KnowledgeEvolutionOperationalHealth,
} from './metricsHealth.js';

// ---------------------------------------------------------------------------
// Lane A repository → Lane B port adapters
// ---------------------------------------------------------------------------

function buildRecordRepositoryAdapter(): EvolutionRecordRepository {
  return {
    insert: (record) => createEvolutionRecord(record),
    findByEvolutionId: (evolutionId) => getEvolutionRecordById(evolutionId),
    async patch(evolutionId, patch) {
      const set: Record<string, unknown> = { ...patch };
      const updatedAt = set.updatedAt instanceof Date ? set.updatedAt : undefined;
      delete set.updatedAt;
      await patchEvolutionRecord(evolutionId, set, updatedAt);
      const updated = await getEvolutionRecordById(evolutionId);
      if (!updated) {
        throw new Error(`[knowledge-evolution] record ${evolutionId} not found after patch`);
      }
      return updated;
    },
  };
}

function buildPlanRepositoryAdapter(): EvolutionPlanRepository {
  return {
    insert: (plan) => createEvolutionPlan(plan),
    findByPlanId: (planId) => getEvolutionPlanById(planId),
    findByEvolutionId: (evolutionId) => getEvolutionPlanByEvolutionId(evolutionId),
  };
}

function buildVersionRepositoryAdapter(): EvolutionVersionRepository {
  return {
    insert: (version) => appendVersion(version),
    findLatestForKnowledgeObject: (knowledgeObjectId) => getLatestVersion(knowledgeObjectId),
    listForKnowledgeObject: (knowledgeObjectId) =>
      listVersionsForKnowledgeObject(knowledgeObjectId),
  };
}

function buildSupersessionRepositoryAdapter(): SupersessionRepository {
  return { insert: (record) => appendSupersessionRecord(record) };
}

/**
 * Rollout upsert: idempotent by evolutionId. First readiness attempt creates the rollout; a later
 * attempt reconciles the mutable fields (retrieval-ready flag, available agents/domains, reason) on
 * the existing row so a blocked→ready transition correctly updates agent/domain availability. The
 * `$set` is guarded against the rollout's immutable identity fields (same discipline as Lane A).
 */
function buildRolloutRepositoryAdapter(): RetrievalRolloutRepository {
  return {
    async upsertByEvolutionId(rollout) {
      const existing = await getRetrievalRolloutByEvolutionId(rollout.evolutionId);
      if (!existing) return createRetrievalRollout(rollout);

      const set: Record<string, unknown> = {
        availableToAgents: rollout.availableToAgents,
        availableToDomains: rollout.availableToDomains,
        retrievalReady: rollout.retrievalReady,
        language: rollout.language,
        version: rollout.version,
        ...(rollout.readyAt ? { readyAt: rollout.readyAt } : {}),
        ...(rollout.blockedReason ? { blockedReason: rollout.blockedReason } : {}),
        ...(rollout.teamId ? { teamId: rollout.teamId } : {}),
        ...(rollout.teamKey ? { teamKey: rollout.teamKey } : {}),
        ...(rollout.teamName ? { teamName: rollout.teamName } : {}),
      };
      assertNoProtectedFields('retrievalRollout', set, KNOWLEDGE_RETRIEVAL_ROLLOUT_PROTECTED_FIELDS);
      await repoPatch(KNOWLEDGE_RETRIEVAL_ROLLOUT_COLLECTION, { _id: existing.rolloutId }, set);
      const updated = await getRetrievalRolloutById(existing.rolloutId);
      return updated ?? ({ ...existing, ...set } as KnowledgeRetrievalRollout);
    },
    findByEvolutionId: (evolutionId) => getRetrievalRolloutByEvolutionId(evolutionId),
  };
}

function buildRollbackPlanRepositoryAdapter(): RollbackPlanRepository {
  return {
    insert: (plan) => createRollbackPlan(plan),
    findByEvolutionId: (evolutionId) => getRollbackPlanByEvolutionId(evolutionId),
  };
}

function buildLanguageEvolutionRepositoryAdapter(): LanguageEvolutionRepository {
  return { insert: (record) => createLanguageEvolutionRecord(record) };
}

function buildErrorRepositoryAdapter(): EvolutionErrorRepository {
  return { insert: (error) => recordEvolutionError(error) };
}

function buildMetricsRepositoryAdapter(): EvolutionMetricsRepository {
  return { insert: (snapshot) => recordMetricsSnapshot(snapshot) };
}

/** Mongo-backed metrics data source: window aggregation via the Lane A record repository. */
function buildMetricsDataSource(): EvolutionMetricsDataSource {
  return {
    async collect({ tenantId, teamId, periodStart, periodEnd }) {
      const records = await listEvolutionRecords({
        tenantId,
        teamId,
        createdAt: { $gte: periodStart, $lte: periodEnd },
      });
      return computeRawCountsFromRecords(records);
    },
  };
}

/** Build the full production repository bundle from the Lane A adapters. */
export function buildDefaultRepositories(): KnowledgeEvolutionRepositories {
  return {
    recordRepository: buildRecordRepositoryAdapter(),
    planRepository: buildPlanRepositoryAdapter(),
    versionRepository: buildVersionRepositoryAdapter(),
    supersessionRepository: buildSupersessionRepositoryAdapter(),
    rolloutRepository: buildRolloutRepositoryAdapter(),
    rollbackPlanRepository: buildRollbackPlanRepositoryAdapter(),
    languageEvolutionRepository: buildLanguageEvolutionRepositoryAdapter(),
    errorRepository: buildErrorRepositoryAdapter(),
    metricsRepository: buildMetricsRepositoryAdapter(),
    metricsDataSource: buildMetricsDataSource(),
  };
}

// ---------------------------------------------------------------------------
// Runtime object
// ---------------------------------------------------------------------------

export type KnowledgeEvolutionServices = ReturnType<typeof composeKnowledgeEvolutionServices>;

export interface KnowledgeEvolutionRuntime {
  services: KnowledgeEvolutionServices;
  repositories: KnowledgeEvolutionRepositories;
  runtimeDeps: EvolutionRuntimeDeps;
  bus: KnowledgeEvolutionEventBus;
  workers: KnowledgeEvolutionWorkers;
  operationalHealth(
    query: KnowledgeEvolutionMetricsQuery,
  ): Promise<KnowledgeEvolutionOperationalHealth>;
}

export interface BuildRuntimeOptions {
  repositories?: KnowledgeEvolutionRepositories;
  runtimeDeps?: EvolutionRuntimeDeps;
  bus?: KnowledgeEvolutionEventBus;
  findRecordByInput?: FindRecordByInput;
  reindex?: (request: KnowledgeReindexRequest) => Promise<KnowledgeReindexResult>;
  graphSync?: (input: GraphMapperInput) => Promise<KnowledgeGraphSyncResult>;
  operationalHealth?: (
    query: KnowledgeEvolutionMetricsQuery,
    repositories: KnowledgeEvolutionRepositories,
    runtimeDeps: EvolutionRuntimeDeps,
  ) => Promise<KnowledgeEvolutionOperationalHealth>;
  /** Auto-start the workers on build (default true; tests set false to control lifecycle). */
  autoStartWorkers?: boolean;
}

/** Default operational-health provider — reads records + rollouts for the window from Lane A. */
async function defaultOperationalHealth(
  query: KnowledgeEvolutionMetricsQuery,
  _repositories: KnowledgeEvolutionRepositories,
  runtimeDeps: EvolutionRuntimeDeps,
): Promise<KnowledgeEvolutionOperationalHealth> {
  const records = await listEvolutionRecords({
    tenantId: query.tenantId,
    teamId: query.teamId,
    createdAt: { $gte: query.periodStart, $lte: query.periodEnd },
  });
  const rollouts = await listRetrievalRollouts({ tenantId: query.tenantId });
  return computeOperationalHealth(
    {
      tenantId: query.tenantId,
      teamId: query.teamId,
      periodStart: query.periodStart,
      periodEnd: query.periodEnd,
      generatedAt: runtimeDeps.clock.now(),
    },
    records,
    rollouts,
  );
}

/** Compose a runtime from the given options, defaulting every piece to the production wiring. */
export function buildKnowledgeEvolutionRuntime(
  options: BuildRuntimeOptions = {},
): KnowledgeEvolutionRuntime {
  const runtimeDeps = options.runtimeDeps ?? defaultEvolutionRuntimeDeps();
  const repositories = options.repositories ?? buildDefaultRepositories();
  const bus = options.bus ?? createKnowledgeEvolutionEventBus();
  const services = composeKnowledgeEvolutionServices(repositories, runtimeDeps);

  const reindex =
    options.reindex ??
    ((request: KnowledgeReindexRequest) =>
      reindexKnowledgeEvolution(request, {
        markStatus: async (evolutionId, status) => {
          await patchEvolutionRecord(evolutionId, { indexingStatus: status });
        },
      }));

  const graphSync =
    options.graphSync ??
    ((input: GraphMapperInput) =>
      syncKnowledgeEvolutionGraph(input, {
        markStatus: async (evolutionId, status) => {
          await patchEvolutionRecord(evolutionId, { graphStatus: status });
        },
      }));

  const findRecordByInput: FindRecordByInput =
    options.findRecordByInput ??
    ((tenantId, inputType, inputId) =>
      findEvolutionRecordByInput(tenantId, inputType, inputId));

  const workers = createKnowledgeEvolutionWorkers({
    service: services.knowledgeEvolutionService,
    bus,
    runtime: runtimeDeps,
    findRecordByInput,
    reindex,
    graphSync,
  });

  const operationalHealthProvider = options.operationalHealth ?? defaultOperationalHealth;

  if (options.autoStartWorkers !== false) {
    workers.startAll();
  }

  return {
    services,
    repositories,
    runtimeDeps,
    bus,
    workers,
    operationalHealth: (query) => operationalHealthProvider(query, repositories, runtimeDeps),
  };
}

// ---------------------------------------------------------------------------
// Lazily-built production singleton (+ test overrides)
// ---------------------------------------------------------------------------

let singleton: KnowledgeEvolutionRuntime | null = null;

/** The production runtime. Built lazily on first access; workers auto-start on build. */
export function getKnowledgeEvolutionRuntime(): KnowledgeEvolutionRuntime {
  if (!singleton) {
    singleton = buildKnowledgeEvolutionRuntime();
  }
  return singleton;
}

/** Replace the runtime (tests). */
export function setKnowledgeEvolutionRuntimeForTest(runtime: KnowledgeEvolutionRuntime): void {
  singleton = runtime;
}

/** Clear the runtime so the next access rebuilds (tests). */
export function resetKnowledgeEvolutionRuntimeForTest(): void {
  if (singleton) singleton.workers.stopAll();
  singleton = null;
}
