/**
 * ADMIN I.1 · Report 6 — Follow-up aging (Chat #143).
 *
 * Buckets prospects 0–3 / 4–7 / 8–14 / 15+ days. The spec asks for OPEN
 * follow-up reminders by age; there is no live reminders collection yet, so
 * the report ages by crm_dispositions.updatedAt as the closest proxy and
 * states this in the provenanceNote.
 *
 * Closed-state dispositions (BAs who already enrolled, etc.) are excluded
 * via a configurable closed-set. The current vocabulary only includes
 * 'new-ba' (terminal: prospect became BA), so that's the only one excluded
 * today; broader vocabulary filtering will refine once disposition values
 * are finalized in code.
 */

import { gatewayCall } from '../../services/gateway.js';
import { resolveScopedBaIds } from '../adminMetrics.js';
import { rangeClause } from './timeRange.js';
import { hashSourceData } from '../../services/pdfReport.js';
import type {
  AdminDashboardFilter,
  AdminFollowUpBucket,
  AdminFollowUpBucketCount,
  AdminFollowUpReport,
  AdminFollowUpRow,
  AdminReportMeta,
  AdminReportTimeRange,
} from '@momentum/shared';

const MONGO_DB = 'momentum';
const COLL_DISPO = 'crm_dispositions';

/** Disposition values that close a prospect; excluded from open follow-up aging. */
const CLOSED_DISPOSITIONS = new Set(['new-ba']);

const PROVENANCE =
  'Follow-up data note (Chat #143): The spec asks for OPEN follow-up ' +
  'reminders by age. The active-reminder collection is unbuilt today, so ' +
  'this report ages by crm_dispositions.updatedAt as the closest proxy and ' +
  'excludes terminal dispositions (currently: \'new-ba\'). When the ' +
  'reminder surface lands, the source flips to reminder due-dates with no ' +
  'shape change to consumers.';

interface DispoDoc {
  prospectId: string;
  sponsorBaId: string;
  disposition: string;
  updatedAt: string;
}

function bucketFor(age: number): AdminFollowUpBucket {
  if (age <= 3) return '0-3';
  if (age <= 7) return '4-7';
  if (age <= 14) return '8-14';
  return '15+';
}

function ageDays(iso: string, nowMs: number): number {
  const ms = nowMs - new Date(iso).getTime();
  return Math.max(0, Math.round((ms / (24 * 60 * 60 * 1000)) * 10) / 10);
}

export async function buildFollowUpReport(
  filter: AdminDashboardFilter,
  range: AdminReportTimeRange,
): Promise<{
  result: AdminFollowUpReport;
  meta: Omit<AdminReportMeta, 'title'>;
}> {
  const scopedBaIds = await resolveScopedBaIds(filter);

  const dispoFilter: Record<string, unknown> = {};
  if (scopedBaIds !== null) dispoFilter.sponsorBaId = { $in: scopedBaIds };
  Object.assign(dispoFilter, rangeClause('updatedAt', range));

  const res = await gatewayCall<{ documents: DispoDoc[] }>('mongodb', 'query', {
    database: MONGO_DB,
    collection: COLL_DISPO,
    filter: dispoFilter,
    sort: { updatedAt: 1 }, // oldest first
    limit: 200_000,
  });
  const dispos = (res.documents ?? []).filter((d) => !CLOSED_DISPOSITIONS.has(d.disposition));

  const nowMs = Date.now();
  const rows: AdminFollowUpRow[] = dispos
    .map((d) => {
      const age = ageDays(d.updatedAt, nowMs);
      return {
        prospectId: d.prospectId,
        sponsorBaId: d.sponsorBaId,
        disposition: d.disposition,
        lastUpdatedAt: d.updatedAt,
        ageDays: age,
        bucket: bucketFor(age),
      };
    })
    .sort((a, b) => b.ageDays - a.ageDays);

  const bucketCounts = new Map<AdminFollowUpBucket, number>([
    ['0-3', 0],
    ['4-7', 0],
    ['8-14', 0],
    ['15+', 0],
  ]);
  for (const r of rows) bucketCounts.set(r.bucket, (bucketCounts.get(r.bucket) ?? 0) + 1);
  const buckets: AdminFollowUpBucketCount[] = (['0-3', '4-7', '8-14', '15+'] as const).map(
    (b) => ({ bucket: b, prospects: bucketCounts.get(b) ?? 0 }),
  );

  const ages = rows.map((r) => r.ageDays);
  const avgAge =
    ages.length === 0 ? null : Math.round((ages.reduce((a, b) => a + b, 0) / ages.length) * 10) / 10;
  const maxAge = ages.length === 0 ? null : ages[0]!; // sorted desc

  const result: AdminFollowUpReport = {
    totals: { prospects: rows.length, avgAgeDays: avgAge, maxAgeDays: maxAge },
    buckets,
    rows,
    provenanceNote: PROVENANCE,
  };

  return {
    result,
    meta: {
      reportKey: 'follow_up_aging',
      generatedAt: new Date().toISOString(),
      appliedFilter: filter,
      range,
      sourceHash: hashSourceData(result),
    },
  };
}
