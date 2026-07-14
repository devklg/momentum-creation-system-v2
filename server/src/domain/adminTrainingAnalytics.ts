/**
 * P2-113 — Kevin-only aggregate training analytics.
 *
 * This projection reports curriculum state, not person performance. It emits
 * no BA identity, ordering, score, rank, prediction, effectiveness claim, or
 * outcome attribution. Missing module rows are honestly treated as
 * `not_started`, matching the BA Fast Start read model.
 */

import {
  MCS_FAST_START_MODULES,
  type McsAdminDashboardFilter,
  type McsAdminTrainingAnalytics,
  type McsFastStartModuleId,
  type McsFastStartModuleState,
} from '@momentum/shared';
import { persistenceCall } from '../services/persistence/dispatch.js';
import { resolveScopedTmagIds } from './adminMetrics.js';

const MONGO_DB = 'momentum';
const COLL_BAS = 'team_magnificent_members';
const COLL_FAST_START = 'tmag_fast_start_progress';

interface TrainingAnalyticsBaDoc {
  tmagId: string;
}

export interface TrainingAnalyticsProgressDoc {
  tmagId: string;
  moduleId: number;
  state: string;
  updatedAt?: string;
}

const MODULE_IDS = new Set<number>(MCS_FAST_START_MODULES.map((module) => module.id));
const STATES = new Set<string>(['not_started', 'in_progress', 'completed']);

function isModuleId(value: number): value is McsFastStartModuleId {
  return MODULE_IDS.has(value);
}

function isModuleState(value: string): value is McsFastStartModuleState {
  return STATES.has(value);
}

function isNewer(candidate?: string, current?: string): boolean {
  if (!current) return true;
  if (!candidate) return false;
  return candidate > current;
}

/** Pure aggregate used by the runtime read and focused tests. */
export function aggregateAdminTrainingAnalytics(args: {
  scopedTmagIds: string[];
  progressDocs: TrainingAnalyticsProgressDoc[];
  computedAt: string;
}): McsAdminTrainingAnalytics {
  const scopedIds = new Set(args.scopedTmagIds);
  const latestByMemberModule = new Map<string, TrainingAnalyticsProgressDoc>();
  let duplicateProgressRecordCount = 0;
  let invalidProgressRecordCount = 0;

  for (const doc of args.progressDocs) {
    if (
      !scopedIds.has(doc.tmagId) ||
      !isModuleId(doc.moduleId) ||
      !isModuleState(doc.state)
    ) {
      invalidProgressRecordCount += 1;
      continue;
    }

    const key = `${doc.tmagId}::${doc.moduleId}`;
    const current = latestByMemberModule.get(key);
    if (current) duplicateProgressRecordCount += 1;
    if (!current || isNewer(doc.updatedAt, current.updatedAt)) {
      latestByMemberModule.set(key, doc);
    }
  }

  let notStartedCount = 0;
  let underwayCount = 0;
  let allModulesCompleteCount = 0;

  for (const tmagId of args.scopedTmagIds) {
    const states = MCS_FAST_START_MODULES.map((module) =>
      latestByMemberModule.get(`${tmagId}::${module.id}`)?.state ?? 'not_started',
    );
    const allComplete = states.every((state) => state === 'completed');
    const hasStarted = states.some((state) => state === 'in_progress' || state === 'completed');
    if (allComplete) allModulesCompleteCount += 1;
    else if (hasStarted) underwayCount += 1;
    else notStartedCount += 1;
  }

  const scopeBaCount = args.scopedTmagIds.length;
  const modules = MCS_FAST_START_MODULES.map((module) => {
    const stateCounts = {
      notStarted: 0,
      inProgress: 0,
      completed: 0,
    };
    for (const tmagId of args.scopedTmagIds) {
      const state = latestByMemberModule.get(`${tmagId}::${module.id}`)?.state ?? 'not_started';
      if (state === 'completed') stateCounts.completed += 1;
      else if (state === 'in_progress') stateCounts.inProgress += 1;
      else stateCounts.notStarted += 1;
    }
    return {
      moduleId: module.id,
      title: module.title,
      stateCounts,
      completionPct:
        scopeBaCount === 0 ? null : Math.round((stateCounts.completed / scopeBaCount) * 100),
    };
  });

  return {
    computedAt: args.computedAt,
    sourceAuthority: COLL_FAST_START,
    policy: {
      people: 'aggregate_only_no_ranking_or_scoring',
      effectiveness: 'not_measured',
    },
    scopeBaCount,
    programStateCounts: {
      notStarted: notStartedCount,
      underway: underwayCount,
      allModulesComplete: allModulesCompleteCount,
    },
    allModulesCompletionPct:
      scopeBaCount === 0
        ? null
        : Math.round((allModulesCompleteCount / scopeBaCount) * 100),
    modules,
    dataQuality: {
      duplicateProgressRecordCount,
      invalidProgressRecordCount,
    },
  };
}

export async function buildAdminTrainingAnalytics(
  filter: McsAdminDashboardFilter,
): Promise<McsAdminTrainingAnalytics> {
  const scopedTmagIds = await resolveScopedTmagIds(filter);
  const baFilter: Record<string, unknown> = { deleted: { $ne: true } };
  if (scopedTmagIds !== null) baFilter.tmagId = { $in: scopedTmagIds };

  const bas = await persistenceCall<{ documents?: TrainingAnalyticsBaDoc[] }>('mongodb', 'query', {
    database: MONGO_DB,
    collection: COLL_BAS,
    filter: baFilter,
    limit: 50_000,
  });
  const ids = (bas.documents ?? []).map((ba) => ba.tmagId);

  let progressDocs: TrainingAnalyticsProgressDoc[] = [];
  if (ids.length > 0) {
    const progress = await persistenceCall<{ documents?: TrainingAnalyticsProgressDoc[] }>(
      'mongodb',
      'query',
      {
        database: MONGO_DB,
        collection: COLL_FAST_START,
        filter: { tmagId: { $in: ids } },
        limit: 50_000,
      },
    );
    progressDocs = progress.documents ?? [];
  }

  return aggregateAdminTrainingAnalytics({
    scopedTmagIds: ids,
    progressDocs,
    computedAt: new Date().toISOString(),
  });
}
