/**
 * ADMIN I.1 · Report 5 — Enrollment completion (Chat #143).
 *
 * Renamed from the spec's "Registration handoff completion" because
 * locked-spec 3.6 / Chat #84 dropped the programmatic registration handoff
 * — enrollment is BA-to-BA off-app, and what the system actually records is
 * the BA marking the prospect enrolled (pool_placements.flushReason =
 * 'enrolled'; ledger entry dec_reporting_i1_scope).
 *
 * Slices:
 *   - per BA (counted by sponsorTmagId)
 *   - per day (UTC, by flushedAt)
 *   - per BA signup cohort (BA's createdAt month -> sum of their enrollments)
 *
 * Time range narrows enrollment events by flushedAt.
 */

import { persistenceCall } from '../../services/persistence/dispatch.js';
import { resolveScopedTmagIds } from '../adminMetrics.js';
import { monthKey, rangeClause } from './timeRange.js';
import { hashSourceData } from '../../services/pdfReport.js';
import type {
  McsAdminDashboardFilter,
  McsAdminEnrollmentPerBa,
  McsAdminEnrollmentPerCohort,
  McsAdminEnrollmentPerDay,
  McsAdminEnrollmentReport,
  McsAdminReportMeta,
  McsAdminReportTimeRange,
} from '@momentum/shared';

const MONGO_DB = 'momentum';
const COLL_PLACEMENTS = 'tmag_prospect_htank_placements';
const COLL_BAS = 'team_magnificent_members';

interface PlacementDoc {
  sponsorTmagId: string;
  flushedAt: string | null;
  flushReason: 'enrolled' | 'expired' | 'archived' | null;
}
interface BaDoc {
  tmagId: string;
  firstName: string;
  lastName: string;
  createdAt: string;
  deleted?: boolean;
}

function utcDay(iso: string): string {
  return iso.slice(0, 10);
}
function avg(values: number[]): number | null {
  if (values.length === 0) return null;
  return Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10;
}

export async function buildEnrollmentReport(
  filter: McsAdminDashboardFilter,
  range: McsAdminReportTimeRange,
): Promise<{
  result: McsAdminEnrollmentReport;
  meta: Omit<McsAdminReportMeta, 'title'>;
}> {
  const scopedTmagIds = await resolveScopedTmagIds(filter);

  const flushBounds = (rangeClause('flushedAt', range).flushedAt ?? {}) as Record<string, string>;
  const placementsFilter: Record<string, unknown> = {
    flushReason: 'enrolled',
    flushedAt: { ...flushBounds, $ne: null },
  };
  if (scopedTmagIds !== null) placementsFilter.sponsorTmagId = { $in: scopedTmagIds };

  const placementsRes = await persistenceCall<{ documents: PlacementDoc[] }>('mongodb', 'query', {
    database: MONGO_DB,
    collection: COLL_PLACEMENTS,
    filter: placementsFilter,
    limit: 200_000,
  });
  const enrollments = (placementsRes.documents ?? []).filter((p) => p.flushedAt);

  // Resolve BA names + cohort for the BAs that appear (plus the scoped set,
  // so cohorts with zero enrollments still surface if you want them — here
  // we keep it lean: cohorts only for BAs who have enrollments).
  const baIds = [...new Set(enrollments.map((e) => e.sponsorTmagId))];
  const baLookup = new Map<string, BaDoc>();
  if (baIds.length > 0) {
    const basRes = await persistenceCall<{ documents: BaDoc[] }>('mongodb', 'query', {
      database: MONGO_DB,
      collection: COLL_BAS,
      filter: { tmagId: { $in: baIds }, deleted: { $ne: true } },
      limit: baIds.length,
    });
    for (const b of basRes.documents ?? []) baLookup.set(b.tmagId, b);
  }

  // Per-BA counts.
  const perBaMap = new Map<string, number>();
  for (const e of enrollments) perBaMap.set(e.sponsorTmagId, (perBaMap.get(e.sponsorTmagId) ?? 0) + 1);
  const perBa: McsAdminEnrollmentPerBa[] = [...perBaMap.entries()]
    .map(([tmagId, count]) => {
      const b = baLookup.get(tmagId);
      const fullName = b ? `${b.firstName} ${b.lastName}`.trim() : tmagId;
      return { tmagId, fullName, enrollments: count };
    })
    .sort((a, b) => b.enrollments - a.enrollments);

  // Per-day counts.
  const perDayMap = new Map<string, number>();
  for (const e of enrollments) {
    const d = utcDay(e.flushedAt!);
    perDayMap.set(d, (perDayMap.get(d) ?? 0) + 1);
  }
  const perDay: McsAdminEnrollmentPerDay[] = [...perDayMap.entries()]
    .map(([date, enrollments]) => ({ date, enrollments }))
    .sort((a, b) => (a.date < b.date ? -1 : 1));

  // Per BA signup cohort.
  const cohortBas = new Map<string, Set<string>>();
  const cohortEnrollments = new Map<string, number>();
  for (const e of enrollments) {
    const b = baLookup.get(e.sponsorTmagId);
    if (!b) continue;
    const c = monthKey(b.createdAt);
    if (!cohortBas.has(c)) cohortBas.set(c, new Set());
    cohortBas.get(c)!.add(e.sponsorTmagId);
    cohortEnrollments.set(c, (cohortEnrollments.get(c) ?? 0) + 1);
  }
  const perCohort: McsAdminEnrollmentPerCohort[] = [...cohortEnrollments.keys()]
    .sort()
    .map((cohort) => ({
      cohort,
      bas: cohortBas.get(cohort)?.size ?? 0,
      enrollments: cohortEnrollments.get(cohort) ?? 0,
    }));

  // Rolling averages over present days only (same honesty as #4).
  const last7 = perDay.slice(-7).map((d) => d.enrollments);
  const last30 = perDay.slice(-30).map((d) => d.enrollments);

  const result: McsAdminEnrollmentReport = {
    totals: {
      enrollments: enrollments.length,
      enrollingBas: perBa.length,
      perDayAvg7d: avg(last7),
      perDayAvg30d: avg(last30),
    },
    perBa,
    perDay,
    perCohort,
  };

  return {
    result,
    meta: {
      reportKey: 'enrollment_completion',
      generatedAt: new Date().toISOString(),
      appliedFilter: filter,
      range,
      sourceHash: hashSourceData(result),
    },
  };
}
