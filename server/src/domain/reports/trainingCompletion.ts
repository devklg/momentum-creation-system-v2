/**
 * ADMIN I.1 · Report 2 — Training completion (Chat #143).
 *
 * Per-BA training progress (ADMIN Design I.1 line 2): Fast Start Module 1–5
 * completion %, 10-step orientation completion, average days from signup to
 * each milestone.
 *
 * DATA HONESTY (Chat #143, option 1):
 *   - fast_start_progress is the real source but currently EMPTY (no BA has
 *     progressed). The report returns correct zeros today and fills in the
 *     moment data flows — no rework.
 *   - 10-step orientation has NO source yet (live Zoom; the completion-
 *     tracking surface, wireframe .team 3.6, is unbuilt). orientationCompletedAt
 *     is null for everyone until that lands. Stated in provenanceNote.
 *
 * Scope: reuses the dashboard filter via resolveScopedTmagIds. Soft-deleted
 * BAs excluded. Time range narrows the BA set by signup date (createdAt)
 * for flat presets; by_month/lifetime span all.
 *
 * Compliance (ADMIN I.5): operational — no scoring, no ranking.
 */

import { gatewayCall } from '../../services/gateway.js';
import { resolveScopedTmagIds } from '../adminMetrics.js';
import { rangeClause } from './timeRange.js';
import { hashSourceData } from '../../services/pdfReport.js';
import type {
  AdminDashboardFilter,
  AdminReportMeta,
  AdminReportTimeRange,
  AdminTrainingReport,
  AdminTrainingReportRow,
} from '@momentum/shared';

const MONGO_DB = 'momentum';
const COLL_BAS = 'team_magnificent_members';
const COLL_FAST_START = 'fast_start_progress';

const ORIENTATION_PROVENANCE =
  'Training data note (Chat #143): Fast Start completion reads from ' +
  'fast_start_progress (currently empty — no BA has progressed yet; counts ' +
  'are real zeros and populate as data flows). 10-step orientation has no ' +
  'tracking source yet (live Zoom; the completion surface is unbuilt), so ' +
  'orientation completion is null for everyone until that surface lands.';

interface BaDoc {
  tmagId: string;
  firstName: string;
  lastName: string;
  createdAt: string;
  deleted?: boolean;
}
interface FastStartDoc {
  tmagId: string;
  moduleId: 1 | 2 | 3 | 4 | 5;
  state: 'not_started' | 'in_progress' | 'completed';
  completedAt: string | null;
}

function daysBetween(aIso: string, bIso: string): number {
  const ms = new Date(bIso).getTime() - new Date(aIso).getTime();
  return Math.max(0, Math.round((ms / (24 * 60 * 60 * 1000)) * 10) / 10);
}

function avg(values: number[]): number | null {
  if (values.length === 0) return null;
  return Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10;
}

export async function buildTrainingReport(
  filter: AdminDashboardFilter,
  range: AdminReportTimeRange,
): Promise<{ result: AdminTrainingReport; meta: Omit<AdminReportMeta, 'title'> }> {
  const scopedTmagIds = await resolveScopedTmagIds(filter);

  const baFilter: Record<string, unknown> = { deleted: { $ne: true } };
  if (scopedTmagIds !== null) baFilter.tmagId = { $in: scopedTmagIds };
  Object.assign(baFilter, rangeClause('createdAt', range));

  const basRes = await gatewayCall<{ documents: BaDoc[] }>('mongodb', 'query', {
    database: MONGO_DB,
    collection: COLL_BAS,
    filter: baFilter,
    sort: { createdAt: 1 },
    limit: 50_000,
  });
  const bas = basRes.documents ?? [];
  const baIds = bas.map((b) => b.tmagId);

  // Module completion stats per BA (collection may be empty — handled).
  const progressByBa = new Map<string, Map<number, string | null>>();
  const moduleCompletedCount = new Map<number, number>([[1, 0], [2, 0], [3, 0], [4, 0], [5, 0]]);

  if (baIds.length > 0) {
    const progRes = await gatewayCall<{ documents: FastStartDoc[] }>('mongodb', 'query', {
      database: MONGO_DB,
      collection: COLL_FAST_START,
      filter: { tmagId: { $in: baIds }, state: 'completed' },
      limit: baIds.length * 5,
    });
    for (const p of progRes.documents ?? []) {
      const m = progressByBa.get(p.tmagId) ?? new Map<number, string | null>();
      m.set(p.moduleId, p.completedAt);
      progressByBa.set(p.tmagId, m);
      moduleCompletedCount.set(p.moduleId, (moduleCompletedCount.get(p.moduleId) ?? 0) + 1);
    }
  }

  const rows: AdminTrainingReportRow[] = bas.map((b) => {
    const mods = progressByBa.get(b.tmagId) ?? new Map<number, string | null>();
    const modulesCompleted = mods.size;
    const fastStartComplete = modulesCompleted === 5;
    // Fast Start completion time = the latest module completedAt, when all 5 done.
    let fastStartCompletedAt: string | null = null;
    if (fastStartComplete) {
      const times = [...mods.values()].filter((t): t is string => !!t);
      fastStartCompletedAt = times.length ? times.sort().at(-1)! : null;
    }
    return {
      tmagId: b.tmagId,
      fullName: `${b.firstName} ${b.lastName}`.trim(),
      signupAt: b.createdAt,
      modulesCompleted,
      fastStartComplete,
      fastStartCompletedAt,
      orientationCompletedAt: null, // no source yet (see provenanceNote)
      daysSignupToFastStartComplete: fastStartCompletedAt
        ? daysBetween(b.createdAt, fastStartCompletedAt)
        : null,
    };
  });

  const fastStartCompleteRows = rows.filter((r) => r.fastStartComplete);
  const result: AdminTrainingReport = {
    totals: {
      bas: rows.length,
      fastStartComplete: fastStartCompleteRows.length,
      fastStartCompletePct:
        rows.length === 0 ? null : Math.round((fastStartCompleteRows.length / rows.length) * 100),
      orientationComplete: 0, // null source today
      avgDaysSignupToFastStartComplete: avg(
        fastStartCompleteRows
          .map((r) => r.daysSignupToFastStartComplete)
          .filter((d): d is number => d !== null),
      ),
    },
    moduleCompletion: ([1, 2, 3, 4, 5] as const).map((moduleId) => ({
      moduleId,
      completed: moduleCompletedCount.get(moduleId) ?? 0,
    })),
    rows,
    provenanceNote: ORIENTATION_PROVENANCE,
  };

  return {
    result,
    meta: {
      reportKey: 'training_completion',
      generatedAt: new Date().toISOString(),
      appliedFilter: filter,
      range,
      sourceHash: hashSourceData(result),
    },
  };
}
