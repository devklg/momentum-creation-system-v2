/**
 * Lane A test fixtures + an in-memory persistence fake.
 *
 * The fake mirrors the app Mongo dispatch contract just enough for repository
 * behavior tests: insert (dup `_id` throws), query (equality filter + sort +
 * limit), update ($set only). No live DB required.
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
} from '@momentum/shared/runtime';

export const TENANT = 'tenant_team_magnificent';

export function approvalRef(
  overrides: Partial<KnowledgeApprovalReference> = {},
): KnowledgeApprovalReference {
  return {
    approvalId: 'appr_1',
    approvedBy: 'TMBA-KEVIN',
    approvalType: 'review_workflow',
    approvedAt: new Date('2026-07-01T00:00:00.000Z'),
    ...overrides,
  };
}

export function evolutionRecord(
  overrides: Partial<KnowledgeEvolutionRecord> = {},
): KnowledgeEvolutionRecord {
  return {
    evolutionId: 'evo_1',
    tenantId: TENANT,
    teamId: 'team_magnificent',
    teamKey: 'team_magnificent',
    teamName: 'Team Magnificent',
    inputType: 'approved_candidate',
    inputId: 'cand_1',
    status: 'received',
    domain: 'training',
    language: 'en',
    sourceKnowledgeObjectIds: [],
    sourceCandidateIds: ['cand_1'],
    sourceOutcomeIds: [],
    sourceLearningSignalIds: [],
    sourceEventIds: [],
    evolutionAction: 'create_new_knowledge',
    approvalReference: approvalRef(),
    indexingStatus: 'not_required',
    graphStatus: 'not_required',
    retrievalStatus: 'not_ready',
    createdAt: new Date('2026-07-02T00:00:00.000Z'),
    updatedAt: new Date('2026-07-02T00:00:00.000Z'),
    ...overrides,
  };
}

export function evolutionPlan(
  overrides: Partial<KnowledgeEvolutionPlan> = {},
): KnowledgeEvolutionPlan {
  return {
    planId: 'plan_1',
    evolutionId: 'evo_1',
    tenantId: TENANT,
    teamId: 'team_magnificent',
    teamKey: 'team_magnificent',
    teamName: 'Team Magnificent',
    action: 'create',
    sourceKnowledgeObjectIds: [],
    sourceCandidateIds: ['cand_1'],
    requiredSteps: [
      { stepKey: 'validate_approval', required: true, status: 'pending' },
      { stepKey: 'create_version', required: true, status: 'pending' },
    ],
    riskFlags: [],
    language: 'en',
    requiresReindex: true,
    requiresGraphSync: true,
    affectsRetrieval: true,
    createdAt: new Date('2026-07-02T00:00:00.000Z'),
    ...overrides,
  };
}

export function evolutionVersion(
  overrides: Partial<KnowledgeEvolutionVersion> = {},
): KnowledgeEvolutionVersion {
  return {
    versionRecordId: 'ver_1',
    knowledgeObjectId: 'ko_1',
    version: 1,
    evolutionId: 'evo_1',
    changeType: 'created',
    snapshotAfter: { title: 'How to invite' },
    reason: 'initial creation from approved candidate',
    approvedBy: 'TMBA-KEVIN',
    createdAt: new Date('2026-07-02T00:00:00.000Z'),
    ...overrides,
  };
}

export function supersessionRecord(
  overrides: Partial<KnowledgeSupersessionRecord> = {},
): KnowledgeSupersessionRecord {
  return {
    supersessionId: 'sup_1',
    tenantId: TENANT,
    teamId: 'team_magnificent',
    teamKey: 'team_magnificent',
    teamName: 'Team Magnificent',
    oldKnowledgeObjectId: 'ko_old',
    newKnowledgeObjectId: 'ko_new',
    reason: 'refined guidance replaces prior version',
    approvalReference: approvalRef(),
    supersededAt: new Date('2026-07-03T00:00:00.000Z'),
    supersededBy: 'TMBA-KEVIN',
    ...overrides,
  };
}

export function retrievalRollout(
  overrides: Partial<KnowledgeRetrievalRollout> = {},
): KnowledgeRetrievalRollout {
  return {
    rolloutId: 'roll_1',
    evolutionId: 'evo_1',
    knowledgeObjectId: 'ko_1',
    version: 1,
    tenantId: TENANT,
    teamId: 'team_magnificent',
    teamKey: 'team_magnificent',
    teamName: 'Team Magnificent',
    language: 'en',
    availableToAgents: ['steve_success'],
    availableToDomains: ['training'],
    retrievalReady: false,
    ...overrides,
  };
}

export function languageEvolutionRecord(
  overrides: Partial<KnowledgeLanguageEvolutionRecord> = {},
): KnowledgeLanguageEvolutionRecord {
  return {
    languageEvolutionId: 'lang_1',
    tenantId: TENANT,
    teamId: 'team_magnificent',
    teamKey: 'team_magnificent',
    teamName: 'Team Magnificent',
    sourceKnowledgeObjectId: 'ko_en',
    variantKnowledgeObjectId: 'ko_es',
    sourceLanguage: 'en',
    targetLanguage: 'es',
    translationStatus: 'human_reviewed',
    approvalReference: approvalRef(),
    createdAt: new Date('2026-07-02T00:00:00.000Z'),
    ...overrides,
  };
}

export function rollbackPlan(
  overrides: Partial<KnowledgeRollbackPlan> = {},
): KnowledgeRollbackPlan {
  return {
    rollbackPlanId: 'rbk_1',
    evolutionId: 'evo_1',
    rollbackType: 'restore_previous_version',
    previousKnowledgeObjectIds: ['ko_1'],
    previousVersionNumbers: [1],
    createdAt: new Date('2026-07-02T00:00:00.000Z'),
    ...overrides,
  };
}

export function evolutionError(
  overrides: Partial<KnowledgeEvolutionError> = {},
): KnowledgeEvolutionError {
  return {
    errorId: 'err_1',
    errorType: 'approval_missing',
    tenantId: TENANT,
    evolutionId: 'evo_1',
    message: 'raw internal detail',
    safeMessage: 'evolution could not start',
    retryable: false,
    occurredAt: new Date('2026-07-02T00:00:00.000Z'),
    ...overrides,
  };
}

export function metricsSnapshot(
  overrides: Partial<KnowledgeEvolutionMetricsSnapshot> = {},
): KnowledgeEvolutionMetricsSnapshot {
  return {
    metricsSnapshotId: 'met_1',
    tenantId: TENANT,
    teamId: 'team_magnificent',
    teamKey: 'team_magnificent',
    teamName: 'Team Magnificent',
    periodStart: new Date('2026-07-01T00:00:00.000Z'),
    periodEnd: new Date('2026-07-08T00:00:00.000Z'),
    evolutionCompletionRate: 0.95,
    evolutionFailureRate: 0.05,
    averageTimeToRetrievalReadyMs: 1200,
    reindexSuccessRate: 1,
    graphSyncSuccessRate: 1,
    supersessionCount: 2,
    archiveCount: 1,
    rollbackCount: 0,
    bilingualActivationParity: 1,
    candidateToActiveRate: 0.9,
    createdAt: new Date('2026-07-08T00:00:00.000Z'),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// In-memory persistence fake
// ---------------------------------------------------------------------------

type Doc = Record<string, unknown>;

function getPath(doc: Doc, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, key) => {
    if (acc && typeof acc === 'object') return (acc as Record<string, unknown>)[key];
    return undefined;
  }, doc);
}

function matches(doc: Doc, filter: Doc): boolean {
  return Object.entries(filter).every(([key, value]) => getPath(doc, key) === value);
}

export interface MemoryPersistence {
  call: (tool: string, action: string, params: Doc) => Promise<unknown>;
  collection: (name: string) => Doc[];
  reset: () => void;
}

export function makeMemoryPersistence(): MemoryPersistence {
  const store = new Map<string, Map<string, Doc>>();

  function col(name: string): Map<string, Doc> {
    let c = store.get(name);
    if (!c) {
      c = new Map();
      store.set(name, c);
    }
    return c;
  }

  const call = async (tool: string, action: string, params: Doc): Promise<unknown> => {
    if (tool !== 'mongodb') throw new Error(`unexpected tool ${tool}`);
    const c = col(params.collection as string);

    switch (action) {
      case 'insert': {
        const docs = (params.documents as Doc[]) ?? [];
        for (const d of docs) {
          const id = d._id as string;
          if (c.has(id)) throw new Error(`E11000 duplicate key: ${id}`);
          c.set(id, { ...d });
        }
        return { insertedCount: docs.length };
      }
      case 'query': {
        const filter = (params.filter as Doc) ?? {};
        let docs = [...c.values()].filter((d) => matches(d, filter));
        const sort = params.sort as Record<string, 1 | -1> | undefined;
        if (sort) {
          const [[key, dir] = ['_id', 1]] = Object.entries(sort);
          docs = [...docs].sort((a, b) => {
            const av = getPath(a, key) as number;
            const bv = getPath(b, key) as number;
            return av === bv ? 0 : (av < bv ? -1 : 1) * (dir as number);
          });
        }
        if (typeof params.limit === 'number') docs = docs.slice(0, params.limit);
        return { documents: docs.map((d) => ({ ...d })), count: docs.length };
      }
      case 'update': {
        const filter = (params.filter as Doc) ?? {};
        const set = ((params.update as Doc)?.$set as Doc) ?? {};
        let n = 0;
        for (const d of c.values()) {
          if (matches(d, filter)) {
            for (const [k, v] of Object.entries(set)) {
              if (v !== undefined) d[k] = v;
            }
            n += 1;
          }
        }
        return { matchedCount: n, modifiedCount: n };
      }
      default:
        throw new Error(`unsupported action ${action}`);
    }
  };

  return {
    call,
    collection: (name: string) => [...col(name).values()],
    reset: () => store.clear(),
  };
}
