/**
 * ADMIN I.1 · Report 4 — Queue velocity (Chat #143).
 *
 * Daily flow through the holding tank: placements/day, flushes/day (any
 * reason), enrollments/day (flushReason='enrolled'), net change/day. Plus
 * rolling 7-day and 30-day averages for placements and enrollments.
 *
 * Source: pool_placements (placedAt, flushedAt, flushReason). Time range
 * narrows BOTH placedAt and flushedAt independently for the day series — a
 * placement counts the day it landed; a flush counts the day it left. Days
 * are emitted in UTC YYYY-MM-DD; missing days (no activity) are skipped
 * rather than zero-filled (cleaner for the table; consumers fill if needed).
 *
 * Scope: AdminDashboardFilter via resolveScopedBaIds.
 */

import { gatewayCall } from '../../services/gateway.js';
import { resolveScopedBaIds } from '../adminMetrics.js';
import { rangeClause } from './timeRange.js';
import { hashSourceData } from '../../services/pdfReport.js';
import type {
  AdminDashboardFilter,
  AdminQueueVelocityDay,
  AdminQueueVelocityReport,
  AdminReportMeta,
  AdminReportTimeRange,
} from '@momentum/shared';

const MONGO_DB = 'momentum';
const COLL_PLACEMENTS = 'pool_placements';

interface PlacementDoc {
  sponsorBaId: string;
  placedAt: string;
  flushedAt: string | null;
  flushReason: 'enrolled' | 'expired' | 'archived' | null;
}

function utcDay(iso: string): string {
  return iso.slice(0, 10);
}
function avg(values: number[]): number | null {
  if (values.length === 0) return null;
  return Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10;
}

export async function buildQueueVelocityReport(
  filter: AdminDashboardFilter,
  range: AdminReportTimeRange,
): Promise<{
  result: AdminQueueVelocityReport;
  meta: Omit<AdminReportMeta, 'title'>;
}> {
  const scopedBaIds = await resolveScopedBaIds(filter);

  const scopeClause: Record<string, unknown> = {};
  if (scopedBaIds !== null) scopeClause.sponsorBaId = { $in: scopedBaIds };

  // Two independent pulls: placedAt-narrowed and flushedAt-narrowed.
  // Same scope clause; different date field. Lifetime = pull all, no narrow.
  const placementsFilter = { ...scopeClause, ...rangeClause('placedAt', range) };
  const flushDateBounds = (rangeClause('flushedAt', range).flushedAt ?? {}) as Record<string, string>;
  const flushesFilter: Record<string, unknown> = {
    ...scopeClause,
    flushedAt: { ...flushDateBounds, $ne: null },
  };

  const [placedRes, flushedRes] = await Promise.all([
    gatewayCall<{ documents: PlacementDoc[] }>('mongodb', 'query', {
      database: MONGO_DB,
      collection: COLL_PLACEMENTS,
      filter: placementsFilter,
      limit: 200_000,
    }),
    gatewayCall<{ documents: PlacementDoc[] }>('mongodb', 'query', {
      database: MONGO_DB,
      collection: COLL_PLACEMENTS,
      filter: flushesFilter,
      limit: 200_000,
    }),
  ]);

  const placedByDay = new Map<string, number>();
  for (const p of placedRes.documents ?? []) {
    const d = utcDay(p.placedAt);
    placedByDay.set(d, (placedByDay.get(d) ?? 0) + 1);
  }
  const flushedByDay = new Map<string, { total: number; enrolled: number }>();
  for (const p of flushedRes.documents ?? []) {
    if (!p.flushedAt) continue;
    const d = utcDay(p.flushedAt);
    const cur = flushedByDay.get(d) ?? { total: 0, enrolled: 0 };
    cur.total += 1;
    if (p.flushReason === 'enrolled') cur.enrolled += 1;
    flushedByDay.set(d, cur);
  }

  const allDays = new Set<string>([...placedByDay.keys(), ...flushedByDay.keys()]);
  const days: AdminQueueVelocityDay[] = [...allDays].sort().map((date) => {
    const placements = placedByDay.get(date) ?? 0;
    const flushBucket = flushedByDay.get(date) ?? { total: 0, enrolled: 0 };
    return {
      date,
      placements,
      flushes: flushBucket.total,
      enrollments: flushBucket.enrolled,
      net: placements - flushBucket.total,
    };
  });

  const totalPlacements = (placedRes.documents ?? []).length;
  const totalFlushes = (flushedRes.documents ?? []).filter((p) => p.flushedAt).length;
  const totalEnrollments = (flushedRes.documents ?? []).filter((p) => p.flushReason === 'enrolled').length;

  // Rolling averages: take the last N days that actually appear in `days`.
  // (We average over present days only; absent days are implicit zeros and
  // would skew low — honesty: this measures observed activity per active day.)
  const last7 = days.slice(-7).map((d) => d.placements);
  const last30 = days.slice(-30).map((d) => d.placements);
  const last7Enr = days.slice(-7).map((d) => d.enrollments);
  const last30Enr = days.slice(-30).map((d) => d.enrollments);

  const result: AdminQueueVelocityReport = {
    totals: {
      placements: totalPlacements,
      flushes: totalFlushes,
      enrollments: totalEnrollments,
      net: totalPlacements - totalFlushes,
      placementsPerDay7d: avg(last7),
      placementsPerDay30d: avg(last30),
      enrollmentsPerDay7d: avg(last7Enr),
      enrollmentsPerDay30d: avg(last30Enr),
    },
    days,
  };

  return {
    result,
    meta: {
      reportKey: 'queue_velocity',
      generatedAt: new Date().toISOString(),
      appliedFilter: filter,
      range,
      sourceHash: hashSourceData(result),
    },
  };
}
