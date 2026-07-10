/**
 * Knowledge Evolution Runtime — Lane B persistence ports (repository INTERFACES).
 *
 * Lane B is pure business logic and must not reimplement Lane A's Mongo repositories. It depends
 * on these narrow interfaces instead. When Lane A merges its concrete repositories, they satisfy
 * these ports (or Lane D adapts them). Tests inject in-memory fakes.
 *
 * Every port is append/read/patch shaped — none exposes a destructive "delete version" or
 * "erase approval" helper, because the ratified runtime forbids erasing audit history
 * (spec §14, §16.3, §17.3, §18.2).
 */

import type {
  KnowledgeEvolutionError,
  KnowledgeEvolutionMetricsSnapshot,
  KnowledgeEvolutionPlan,
  KnowledgeEvolutionRecord,
  KnowledgeEvolutionVersion,
  KnowledgeLanguageEvolutionRecord,
  KnowledgeRetrievalRollout,
  KnowledgeRollbackPlan,
  KnowledgeSupersessionRecord,
} from '@momentum/shared/runtime';

export interface EvolutionRecordRepository {
  insert(record: KnowledgeEvolutionRecord): Promise<KnowledgeEvolutionRecord>;
  findByEvolutionId(evolutionId: string): Promise<KnowledgeEvolutionRecord | null>;
  /** Patch mutable fields; must never drop or overwrite immutable lineage arrays. */
  patch(
    evolutionId: string,
    patch: Partial<KnowledgeEvolutionRecord>,
  ): Promise<KnowledgeEvolutionRecord>;
}

export interface EvolutionPlanRepository {
  insert(plan: KnowledgeEvolutionPlan): Promise<KnowledgeEvolutionPlan>;
  findByPlanId(planId: string): Promise<KnowledgeEvolutionPlan | null>;
  findByEvolutionId(evolutionId: string): Promise<KnowledgeEvolutionPlan | null>;
}

export interface EvolutionVersionRepository {
  insert(version: KnowledgeEvolutionVersion): Promise<KnowledgeEvolutionVersion>;
  /** Latest (highest-numbered) version for a knowledge object, or null if none exists. */
  findLatestForKnowledgeObject(
    knowledgeObjectId: string,
  ): Promise<KnowledgeEvolutionVersion | null>;
  listForKnowledgeObject(knowledgeObjectId: string): Promise<KnowledgeEvolutionVersion[]>;
}

export interface SupersessionRepository {
  insert(record: KnowledgeSupersessionRecord): Promise<KnowledgeSupersessionRecord>;
}

export interface RetrievalRolloutRepository {
  /** Idempotent by evolutionId — repeated readiness attempts update the same rollout. */
  upsertByEvolutionId(rollout: KnowledgeRetrievalRollout): Promise<KnowledgeRetrievalRollout>;
  findByEvolutionId(evolutionId: string): Promise<KnowledgeRetrievalRollout | null>;
}

export interface RollbackPlanRepository {
  insert(plan: KnowledgeRollbackPlan): Promise<KnowledgeRollbackPlan>;
  findByEvolutionId(evolutionId: string): Promise<KnowledgeRollbackPlan | null>;
}

export interface LanguageEvolutionRepository {
  insert(record: KnowledgeLanguageEvolutionRecord): Promise<KnowledgeLanguageEvolutionRecord>;
}

export interface EvolutionErrorRepository {
  insert(error: KnowledgeEvolutionError): Promise<KnowledgeEvolutionError>;
}

export interface EvolutionMetricsRepository {
  insert(snapshot: KnowledgeEvolutionMetricsSnapshot): Promise<KnowledgeEvolutionMetricsSnapshot>;
}

/**
 * Raw counts a data source supplies for a metrics window. The metrics service turns these into the
 * derived rates/parity of a `KnowledgeEvolutionMetricsSnapshot` — the arithmetic is pure and lives
 * in Lane B; the aggregation query itself belongs to Lane A/D.
 */
export interface EvolutionMetricsRawCounts {
  totalEvolutions: number;
  completedEvolutions: number;
  failedEvolutions: number;
  timeToRetrievalReadyMsSamples: number[];
  reindexAttempts: number;
  reindexSuccesses: number;
  graphSyncAttempts: number;
  graphSyncSuccesses: number;
  supersessionCount: number;
  archiveCount: number;
  rollbackCount: number;
  englishActivations: number;
  spanishActivations: number;
  approvedCandidates: number;
  activatedCandidates: number;
}

export interface EvolutionMetricsDataSource {
  collect(query: {
    tenantId: string;
    teamId: string;
    periodStart: Date;
    periodEnd: Date;
  }): Promise<EvolutionMetricsRawCounts>;
}
