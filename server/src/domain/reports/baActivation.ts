/**
 * ADMIN I.1 · Report 1 — BA activation (Chat #143).
 *
 * Per-BA activation milestones + signup-month cohort rollup (ADMIN Design
 * I.1 line 1): signups, welcome completion, Steve discovery completion,
 * first invite, first prospect to video_complete, first enrollment.
 *
 * Data sources (all confirmed live, Chat #143):
 *   team_magnificent_members  — tmagId, firstName/lastName, createdAt (signup),
 *                         welcomedAt (welcome-accept commitment)
 *   steve_discoveries  — SD-<tmagId>, completedAt (discovery completion)
 *   invitation_activity— kind 'invitation_sent' / 'video_completed', at,
 *                         sponsorTmagId (first-invite / first-video-complete)
 *   pool_placements    — flushReason 'enrolled', flushedAt, sponsorTmagId
 *                         (first enrollment a BA drove)
 *
 * Scope: reuses the dashboard filter (tmagId + leaderGroup) via the shared
 * resolveScopedTmagIds. Time range: signup cohort window (BA createdAt). For
 * flat presets the window narrows the BA set by signup date; for by_month
 * it spans lifetime and buckets. Soft-deleted BAs are excluded.
 *
 * Compliance (ADMIN I.5): activation is operational — no scoring, no ranking.
 */

import { persistenceCall } from '../../services/persistence/dispatch.js';
import { resolveScopedTmagIds } from '../adminMetrics.js';
import { monthKey, rangeClause } from './timeRange.js';
import { hashSourceData } from '../../services/pdfReport.js';
import type {
  McsAdminActivationCohort,
  McsAdminActivationReport,
  McsAdminActivationRow,
  McsAdminDashboardFilter,
  McsAdminReportMeta,
  McsAdminReportTimeRange,
} from '@momentum/shared';

const MONGO_DB = 'momentum';
const COLL_BAS = 'team_magnificent_members';
const COLL_STEVE = 'tmag_steve_success_interview';
const COLL_ACTIVITY = 'tmag_prospect_invitation_activity';
const COLL_PLACEMENTS = 'tmag_prospect_htank_placements';

interface BaDoc {
  tmagId: string;
  firstName: string;
  lastName: string;
  createdAt: string;
  welcomedAt?: string | null;
  deleted?: boolean;
}
interface SteveDiscoveryDoc {
  tmagId: string;
  completedAt: string | null;
}
interface ActivityDoc {
  sponsorTmagId: string;
  kind: string;
  at: string;
}
interface PlacementDoc {
  sponsorTmagId: string;
  flushedAt: string | null;
  flushReason: 'enrolled' | 'expired' | 'archived' | null;
}

function daysBetween(aIso: string, bIso: string): number {
  const ms = new Date(bIso).getTime() - new Date(aIso).getTime();
  return Math.max(0, Math.round((ms / (24 * 60 * 60 * 1000)) * 10) / 10);
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? Math.round(((sorted[mid - 1]! + sorted[mid]!) / 2) * 10) / 10
    : sorted[mid]!;
}

/** Build a map tmagId -> earliest `at` for activity docs of a given kind. */
function firstByBa(docs: ActivityDoc[], kind: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const d of docs) {
    if (d.kind !== kind) continue;
    const cur = out.get(d.sponsorTmagId);
    if (!cur || d.at < cur) out.set(d.sponsorTmagId, d.at);
  }
  return out;
}

export async function buildBaActivationReport(
  filter: McsAdminDashboardFilter,
  range: McsAdminReportTimeRange,
): Promise<{ result: McsAdminActivationReport; meta: Omit<McsAdminReportMeta, 'title'> }> {
  const scopedTmagIds = await resolveScopedTmagIds(filter);

  // BA set: scope + soft-delete exclusion + (for flat windows) signup-date
  // narrowing. by_month / lifetime leave the window open.
  const baFilter: Record<string, unknown> = { deleted: { $ne: true } };
  if (scopedTmagIds !== null) baFilter.tmagId = { $in: scopedTmagIds };
  Object.assign(baFilter, rangeClause('createdAt', range));

  const basRes = await persistenceCall<{ documents: BaDoc[] }>('mongodb', 'query', {
    database: MONGO_DB,
    collection: COLL_BAS,
    filter: baFilter,
    sort: { createdAt: 1 },
    limit: 50_000,
  });
  const bas = basRes.documents ?? [];
  const baIds = bas.map((b) => b.tmagId);

  if (baIds.length === 0) {
    const meta = await emptyMeta(filter, range);
    return {
      result: {
        totals: {
          signups: 0,
          reachedFirstInvite: 0,
          reachedFirstEnrollment: 0,
          medianDaysSignupToFirstInvite: null,
        },
        cohorts: [],
        rows: [],
      },
      meta,
    };
  }

  // Pull the three milestone sources scoped to exactly this BA set.
  const [steveRes, activityRes, enrollRes] = await Promise.all([
    persistenceCall<{ documents: SteveDiscoveryDoc[] }>('mongodb', 'query', {
      database: MONGO_DB,
      collection: COLL_STEVE,
      filter: { tmagId: { $in: baIds }, completedAt: { $ne: null } },
      limit: baIds.length,
    }),
    persistenceCall<{ documents: ActivityDoc[] }>('mongodb', 'query', {
      database: MONGO_DB,
      collection: COLL_ACTIVITY,
      filter: { sponsorTmagId: { $in: baIds }, kind: { $in: ['invitation_sent', 'video_completed'] } },
      limit: 200_000,
    }),
    persistenceCall<{ documents: PlacementDoc[] }>('mongodb', 'query', {
      database: MONGO_DB,
      collection: COLL_PLACEMENTS,
      filter: { sponsorTmagId: { $in: baIds }, flushReason: 'enrolled' },
      limit: 200_000,
    }),
  ]);

  const steveByBa = new Map(
    (steveRes.documents ?? []).map((m) => [m.tmagId, m.completedAt]),
  );
  const activity = activityRes.documents ?? [];
  const firstInvite = firstByBa(activity, 'invitation_sent');
  const firstVideo = firstByBa(activity, 'video_completed');

  const firstEnroll = new Map<string, string>();
  for (const p of enrollRes.documents ?? []) {
    if (!p.flushedAt) continue;
    const cur = firstEnroll.get(p.sponsorTmagId);
    if (!cur || p.flushedAt < cur) firstEnroll.set(p.sponsorTmagId, p.flushedAt);
  }

  const rows: McsAdminActivationRow[] = bas.map((b) => {
    const firstInviteAt = firstInvite.get(b.tmagId) ?? null;
    return {
      tmagId: b.tmagId,
      fullName: `${b.firstName} ${b.lastName}`.trim(),
      signupAt: b.createdAt,
      welcomeAcceptedAt: b.welcomedAt ?? null,
      steveDiscoveryCompletedAt: steveByBa.get(b.tmagId) ?? null,
      firstInviteAt,
      firstVideoCompleteAt: firstVideo.get(b.tmagId) ?? null,
      firstEnrollmentAt: firstEnroll.get(b.tmagId) ?? null,
      daysSignupToFirstInvite: firstInviteAt ? daysBetween(b.createdAt, firstInviteAt) : null,
    };
  });

  // Cohort rollup by signup month.
  const cohortMap = new Map<string, McsAdminActivationCohort>();
  for (const r of rows) {
    const key = monthKey(r.signupAt);
    const c =
      cohortMap.get(key) ??
      {
        cohort: key,
        signups: 0,
        reachedWelcome: 0,
        reachedSteveDiscovery: 0,
        reachedFirstInvite: 0,
        reachedFirstVideoComplete: 0,
        reachedFirstEnrollment: 0,
      };
    c.signups += 1;
    if (r.welcomeAcceptedAt) c.reachedWelcome += 1;
    if (r.steveDiscoveryCompletedAt) c.reachedSteveDiscovery += 1;
    if (r.firstInviteAt) c.reachedFirstInvite += 1;
    if (r.firstVideoCompleteAt) c.reachedFirstVideoComplete += 1;
    if (r.firstEnrollmentAt) c.reachedFirstEnrollment += 1;
    cohortMap.set(key, c);
  }
  const cohorts = [...cohortMap.values()].sort((a, b) => (a.cohort < b.cohort ? -1 : 1));

  const inviteDays = rows
    .map((r) => r.daysSignupToFirstInvite)
    .filter((d): d is number => d !== null);

  const result: McsAdminActivationReport = {
    totals: {
      signups: rows.length,
      reachedFirstInvite: rows.filter((r) => r.firstInviteAt).length,
      reachedFirstEnrollment: rows.filter((r) => r.firstEnrollmentAt).length,
      medianDaysSignupToFirstInvite: median(inviteDays),
    },
    cohorts,
    rows,
  };

  return {
    result,
    meta: {
      reportKey: 'ba_activation',
      generatedAt: new Date().toISOString(),
      appliedFilter: filter,
      range,
      sourceHash: hashSourceData(result),
    },
  };
}

async function emptyMeta(
  filter: McsAdminDashboardFilter,
  range: McsAdminReportTimeRange,
): Promise<Omit<McsAdminReportMeta, 'title'>> {
  return {
    reportKey: 'ba_activation',
    generatedAt: new Date().toISOString(),
    appliedFilter: filter,
    range,
    sourceHash: hashSourceData({ empty: true }),
  };
}
