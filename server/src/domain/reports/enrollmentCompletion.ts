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
 *   - per BA (counted by sponsorBaId)
 *   - per day (UTC, by flushedAt)
 *   - per BA signup cohort (BA's createdAt month -> sum of their enrollments)
 *
 * Time range narrows enrollment events by flushedAt.
 */

import { gatewayCall } from '../../services/gateway.js';
import { resolveScopedBaIds } from '../adminMetrics.js';
import { monthKey, rangeClause } from './timeRange.js';
import { hashSourceData } from '../../services/pdfReport.js';
import type {
  AdminDashboardFilter,
  AdminEnrollmentPerBa,
  AdminEnrollmentPerCohort,
  AdminEnrollmentPerDay,
  AdminEnrollmentReport,
  AdminReportMeta,
  AdminReportTimeRange,
} from '@momentum/shared';

const MONGO_DB = 'momentum';
const COLL_PLACEMENTS = 'pool_placements';
const COLL_BAS = 'brand_ambassadors';

interface PlacementDoc {
  sponsorBaId: string;
  flushedAt: string | null;
  flushReason: 'enrolled' | 'expired' | 'archived' | null;
}
interface BaDoc {
  baId: string;
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
  filter: AdminDashboardFilter,
  range: AdminReportTimeRange,
): Promise<{
  result: AdminEnrollmentReport;
  meta: Omit<AdminReportMeta, 'title'>;
}> {
  const scopedBaIds = await resolveScopedBaIds(filter);

  const flushBounds = (rangeClause('flushedAt', range).flushedAt ?? {}) as Record<string, string>;
  const placementsFilter: Record<string, unknown> = {
    flushReason: 'enrolled',
    flushedAt: { ...flushBounds, $ne: null },
  };
  if (scopedBaIds !== null) placementsFilter.sponsorBaId = { $in: scopedBaIds };

  const placementsRes = await gatewayCall<{ documents: PlacementDoc[] }>('mongodb', 'query', {
    database: MONGO_DB,
    collection: COLL_PLACEMENTS,
    filter: placementsFilter,
    limit: 200_000,
  });
  const enrollments = (placementsRes.documents ?? []).filter((p) => p.flushedAt);

  // Resolve BA names + cohort for the BAs that appear (plus the scoped set,
  // so cohorts with zero enrollments still surface if you want them — here
  // we keep it lean: cohorts only for BAs who have enrollments).
  const baIds = [...new Set(enrollments.map((e) => e.sponsorBaId))];
  const baLookup = new Map<string, BaDoc>();
  if (baIds.length > 0) {
    const basRes = await gatewayCall<{ documents: BaDoc[] }>('mongodb', 'query', {
      database: MONGO_DB,
      collection: COLL_BAS,
      filter: { baId: { $in: baIds }, deleted: { $ne: true } },
      limit: baIds.length,
    });
    for (const b of basRes.documents ?? []) baLookup.set(b.baId, b);
  }

  // Per-BA counts.
  const perBaMap = new Map<string, number>();
  for (const e of enrollments) perBaMap.set(e.sponsorBaId, (perBaMap.get(e.sponsorBaId) ?? 0) + 1);
  const perBa: AdminEnrollmentPerBa[] = [...perBaMap.entries()]
    .map(([baId, count]) => {
      const b = baLookup.get(baId);
      const fullName = b ? `${b.firstName} ${b.lastName}`.trim() : baId;
      return { baId, fullName, enrollments: count };
    })
    .sort((a, b) => b.enrollments - a.enrollments);

  // Per-day counts.
  const perDayMap = new Map<string, number>();
  for (const e of enrollments) {
    const d = utcDay(e.flushedAt!);
    perDayMap.set(d, (perDayMap.get(d) ?? 0) + 1);
  }
  const perDay: AdminEnrollmentPerDay[] = [...perDayMap.entries()]
    .map(([date, enrollments]) => ({ date, enrollments }))
    .sort((a, b) => (a.date < b.date ? -1 : 1));

  // Per BA signup cohort.
  const cohortBas = new Map<string, Set<string>>();
  const cohortEnrollments = new Map<string, number>();
  for (const e of enrollments) {
    const b = baLookup.get(e.sponsorBaId);
    if (!b) continue;
    const c = monthKey(b.createdAt);
    if (!cohortBas.has(c)) cohortBas.set(c, new Set());
    cohortBas.get(c)!.add(e.sponsorBaId);
    cohortEnrollments.set(c, (cohortEnrollments.get(c) ?? 0) + 1);
  }
  const perCohort: AdminEnrollmentPerCohort[] = [...cohortEnrollments.keys()]
    .sort()
    .map((cohort) => ({
      cohort,
      bas: cohortBas.get(cohort)?.size ?? 0,
      enrollments: cohortEnrollments.get(cohort) ?? 0,
    }));

  // Rolling averages over present days only (same honesty as #4).
  const last7 = perDay.slice(-7).map((d) => d.enrollments);
  const last30 = perDay.slice(-30).map((d) => d.enrollments);

  const result: AdminEnrollmentReport = {
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
