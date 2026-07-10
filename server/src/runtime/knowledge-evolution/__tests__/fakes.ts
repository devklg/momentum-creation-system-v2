/**
 * In-memory fakes for Lane B unit tests.
 *
 * These satisfy the repository/data-source ports with simple maps, and provide deterministic
 * clock + id deps so assertions are stable. Lane A owns the real Mongo repositories; Lane B tests
 * against these mocks (as the brief requires) rather than reimplementing persistence.
 */

import type {
  KnowledgeApprovalReference,
  KnowledgeEvolutionError,
  KnowledgeEvolutionMetricsSnapshot,
  KnowledgeEvolutionPlan,
  KnowledgeEvolutionRecord,
  KnowledgeEvolutionVersion,
  KnowledgeLanguageEvolutionRecord,
  KnowledgeRetrievalRollout,
  KnowledgeRollbackPlan,
  KnowledgeSupersessionRecord,
  StartKnowledgeEvolutionRequest,
} from '@momentum/shared/runtime';
import type { EvolutionRuntimeDeps } from '../deps.js';
import type {
  EvolutionErrorRepository,
  EvolutionMetricsDataSource,
  EvolutionMetricsRawCounts,
  EvolutionMetricsRepository,
  EvolutionPlanRepository,
  EvolutionRecordRepository,
  EvolutionVersionRepository,
  LanguageEvolutionRepository,
  RetrievalRolloutRepository,
  RollbackPlanRepository,
  SupersessionRepository,
} from '../services/ports.js';
import type { KnowledgeEvolutionRepositories } from '../services/index.js';

/** Deterministic deps: fixed clock, monotonically-numbered ids per prefix. */
export function makeDeps(fixedIso = '2026-07-10T12:00:00.000Z'): EvolutionRuntimeDeps {
  const counters = new Map<string, number>();
  return {
    clock: { now: () => new Date(fixedIso) },
    ids: {
      newId: (prefix) => {
        const next = (counters.get(prefix) ?? 0) + 1;
        counters.set(prefix, next);
        return `${prefix}_${String(next).padStart(4, '0')}`;
      },
    },
  };
}

export function makeApprovalReference(
  overrides: Partial<KnowledgeApprovalReference> = {},
): KnowledgeApprovalReference {
  return {
    approvalId: 'appr_1',
    approvedBy: 'TMBA-20260101-000001',
    approvalType: 'review_workflow',
    approvedAt: new Date('2026-07-09T00:00:00.000Z'),
    ...overrides,
  };
}

export function makeStartRequest(
  overrides: Partial<StartKnowledgeEvolutionRequest> = {},
): StartKnowledgeEvolutionRequest {
  return {
    tenantId: 'tenant_team_magnificent',
    teamId: 'team_magnificent',
    teamKey: 'team_magnificent',
    teamName: 'Team Magnificent',
    inputType: 'approved_candidate',
    inputId: 'cand_input_1',
    domain: 'success',
    language: 'en',
    evolutionAction: 'create_new_knowledge',
    sourceCandidateIds: ['cand_1'],
    approvalReference: makeApprovalReference(),
    ...overrides,
  };
}

export class FakeEvolutionRecordRepository implements EvolutionRecordRepository {
  readonly store = new Map<string, KnowledgeEvolutionRecord>();

  async insert(record: KnowledgeEvolutionRecord) {
    this.store.set(record.evolutionId, { ...record });
    return { ...record };
  }

  async findByEvolutionId(evolutionId: string) {
    const found = this.store.get(evolutionId);
    return found ? { ...found } : null;
  }

  async patch(evolutionId: string, patch: Partial<KnowledgeEvolutionRecord>) {
    const existing = this.store.get(evolutionId);
    if (!existing) throw new Error(`record ${evolutionId} not found`);
    const updated = { ...existing, ...patch };
    this.store.set(evolutionId, updated);
    return { ...updated };
  }
}

export class FakeEvolutionPlanRepository implements EvolutionPlanRepository {
  readonly store = new Map<string, KnowledgeEvolutionPlan>();

  async insert(plan: KnowledgeEvolutionPlan) {
    this.store.set(plan.planId, { ...plan });
    return { ...plan };
  }

  async findByPlanId(planId: string) {
    const found = this.store.get(planId);
    return found ? { ...found } : null;
  }

  async findByEvolutionId(evolutionId: string) {
    for (const plan of this.store.values()) {
      if (plan.evolutionId === evolutionId) return { ...plan };
    }
    return null;
  }
}

export class FakeEvolutionVersionRepository implements EvolutionVersionRepository {
  readonly store: KnowledgeEvolutionVersion[] = [];

  async insert(version: KnowledgeEvolutionVersion) {
    this.store.push({ ...version });
    return { ...version };
  }

  async findLatestForKnowledgeObject(knowledgeObjectId: string) {
    const matches = this.store
      .filter((v) => v.knowledgeObjectId === knowledgeObjectId)
      .sort((a, b) => b.version - a.version);
    const latest = matches[0];
    return latest ? { ...latest } : null;
  }

  async listForKnowledgeObject(knowledgeObjectId: string) {
    return this.store
      .filter((v) => v.knowledgeObjectId === knowledgeObjectId)
      .map((v) => ({ ...v }));
  }
}

export class FakeSupersessionRepository implements SupersessionRepository {
  readonly store: KnowledgeSupersessionRecord[] = [];
  async insert(record: KnowledgeSupersessionRecord) {
    this.store.push({ ...record });
    return { ...record };
  }
}

export class FakeRetrievalRolloutRepository implements RetrievalRolloutRepository {
  readonly store = new Map<string, KnowledgeRetrievalRollout>();

  async upsertByEvolutionId(rollout: KnowledgeRetrievalRollout) {
    this.store.set(rollout.evolutionId, { ...rollout });
    return { ...rollout };
  }

  async findByEvolutionId(evolutionId: string) {
    const found = this.store.get(evolutionId);
    return found ? { ...found } : null;
  }
}

export class FakeRollbackPlanRepository implements RollbackPlanRepository {
  readonly store: KnowledgeRollbackPlan[] = [];

  async insert(plan: KnowledgeRollbackPlan) {
    this.store.push({ ...plan });
    return { ...plan };
  }

  async findByEvolutionId(evolutionId: string) {
    const match = this.store.find((p) => p.evolutionId === evolutionId);
    return match ? { ...match } : null;
  }
}

export class FakeLanguageEvolutionRepository implements LanguageEvolutionRepository {
  readonly store: KnowledgeLanguageEvolutionRecord[] = [];
  async insert(record: KnowledgeLanguageEvolutionRecord) {
    this.store.push({ ...record });
    return { ...record };
  }
}

export class FakeErrorRepository implements EvolutionErrorRepository {
  readonly store: KnowledgeEvolutionError[] = [];
  async insert(error: KnowledgeEvolutionError) {
    this.store.push({ ...error });
    return { ...error };
  }
}

export class FakeMetricsRepository implements EvolutionMetricsRepository {
  readonly store: KnowledgeEvolutionMetricsSnapshot[] = [];
  async insert(snapshot: KnowledgeEvolutionMetricsSnapshot) {
    this.store.push({ ...snapshot });
    return { ...snapshot };
  }
}

export class FakeMetricsDataSource implements EvolutionMetricsDataSource {
  constructor(private readonly counts: EvolutionMetricsRawCounts) {}
  async collect() {
    return this.counts;
  }
}

export function emptyRawCounts(
  overrides: Partial<EvolutionMetricsRawCounts> = {},
): EvolutionMetricsRawCounts {
  return {
    totalEvolutions: 0,
    completedEvolutions: 0,
    failedEvolutions: 0,
    timeToRetrievalReadyMsSamples: [],
    reindexAttempts: 0,
    reindexSuccesses: 0,
    graphSyncAttempts: 0,
    graphSyncSuccesses: 0,
    supersessionCount: 0,
    archiveCount: 0,
    rollbackCount: 0,
    englishActivations: 0,
    spanishActivations: 0,
    approvedCandidates: 0,
    activatedCandidates: 0,
    ...overrides,
  };
}

export function makeRepositories(): KnowledgeEvolutionRepositories & {
  recordRepository: FakeEvolutionRecordRepository;
  planRepository: FakeEvolutionPlanRepository;
  versionRepository: FakeEvolutionVersionRepository;
  supersessionRepository: FakeSupersessionRepository;
  rolloutRepository: FakeRetrievalRolloutRepository;
  rollbackPlanRepository: FakeRollbackPlanRepository;
  errorRepository: FakeErrorRepository;
} {
  return {
    recordRepository: new FakeEvolutionRecordRepository(),
    planRepository: new FakeEvolutionPlanRepository(),
    versionRepository: new FakeEvolutionVersionRepository(),
    supersessionRepository: new FakeSupersessionRepository(),
    rolloutRepository: new FakeRetrievalRolloutRepository(),
    rollbackPlanRepository: new FakeRollbackPlanRepository(),
    languageEvolutionRepository: new FakeLanguageEvolutionRepository(),
    errorRepository: new FakeErrorRepository(),
    metricsRepository: new FakeMetricsRepository(),
    metricsDataSource: new FakeMetricsDataSource(emptyRawCounts()),
  };
}
