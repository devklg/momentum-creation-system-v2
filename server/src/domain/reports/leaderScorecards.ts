/**
 * ADMIN I.1 · Report 9 — Leader scorecards (Chat #143).
 *
 * Per leader, the metrics justifying leader status + their team's downstream
 * activity (last 30 days). For Kevin's coaching only — ADMIN I.5 explicitly
 * forbids ever showing a leader their own scorecard.
 *
 * Leader detection: reuses listLeaderTmagIds() from adminMetrics.ts, which is
 * empty by design today and MUST stay empty until THREE binary-qualified +
 * personally-enrolled ≥5 data mirrors in (Chat #100; LEADER_DETECTION_NOTE).
 * No algorithmic heuristic is permitted. An empty list is the correct,
 * honest output; the report says so.
 *
 * "Team" for downstream activity = prospects whose sponsorTmagId is the leader
 * (the people the leader directly enrolled). This honors the structural
 * threshold: a leader's directly-enrolled people are the population whose
 * activity the leader is coaching.
 */

import { gatewayCall } from '../../services/gateway.js';
import { listLeaderTmagIds, resolveScopedTmagIds, LEADER_DETECTION_NOTE } from '../adminMetrics.js';
import { hashSourceData } from '../../services/pdfReport.js';
import type {
  AdminDashboardFilter,
  AdminLeaderScorecardReport,
  AdminLeaderScorecardRow,
  AdminReportMeta,
  AdminReportTimeRange,
} from '@momentum/shared';

const MONGO_DB = 'momentum';
const COLL_BAS = 'team_magnificent_members';
const COLL_PLACEMENTS = 'pool_placements';
const COLL_ACTIVITY = 'invitation_activity';

const PROVENANCE =
  'Leader scorecards (Chat #143): per ADMIN I.5, Kevin-only — never shown to ' +
  'the leader themselves. Leader set comes from listLeaderTmagIds() (Chat #100 ' +
  'definition: THREE binary-qualified AND ≥5 personal enrollments). The set ' +
  'is empty today by design until THREE qualification data mirrors in; no ' +
  'algorithmic heuristic is permitted. An empty list is the correct output.';

interface BaDoc {
  tmagId: string;
  firstName: string;
  lastName: string;
  createdAt: string;
  deleted?: boolean;
}
interface PlacementDoc {
  sponsorTmagId: string;
  flushedAt: string | null;
  flushReason: 'enrolled' | 'expired' | 'archived' | null;
}
interface ActivityDoc {
  sponsorTmagId: string;
  kind: string;
  at: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export async function buildLeaderScorecardReport(
  filter: AdminDashboardFilter,
  range: AdminReportTimeRange,
): Promise<{
  result: AdminLeaderScorecardReport;
  meta: Omit<AdminReportMeta, 'title'>;
}> {
  // Leaders, then intersect with the dashboard filter scope so the same
  // tmagId / leaderGroup narrowing applies. If the scope excludes all leaders
  // (e.g. leaderGroup='non_leaders'), the result is honestly empty.
  const leaders = await listLeaderTmagIds();
  const scoped = await resolveScopedTmagIds(filter);
  const leaderIds = scoped === null ? leaders : leaders.filter((id) => scoped.includes(id));

  if (leaderIds.length === 0) {
    const meta: Omit<AdminReportMeta, 'title'> = {
      reportKey: 'leader_scorecards',
      generatedAt: new Date().toISOString(),
      appliedFilter: filter,
      range,
      sourceHash: hashSourceData({ empty: true }),
    };
    return {
      result: {
        leaderCount: 0,
        rows: [],
        provenanceNote: `${PROVENANCE} ${LEADER_DETECTION_NOTE}`,
      },
      meta,
    };
  }

  // Resolve leader names.
  const basRes = await gatewayCall<{ documents: BaDoc[] }>('mongodb', 'query', {
    database: MONGO_DB,
    collection: COLL_BAS,
    filter: { tmagId: { $in: leaderIds }, deleted: { $ne: true } },
    limit: leaderIds.length,
  });
  const baLookup = new Map<string, BaDoc>();
  for (const b of basRes.documents ?? []) baLookup.set(b.tmagId, b);

  const cutoff30 = new Date(Date.now() - 30 * DAY_MS).toISOString();

  // Lifetime personal enrollments + last-30d placements/enrollments per leader.
  const [enrollLifetime, placements30, videoComplete30] = await Promise.all([
    gatewayCall<{ documents: PlacementDoc[] }>('mongodb', 'query', {
      database: MONGO_DB,
      collection: COLL_PLACEMENTS,
      filter: { sponsorTmagId: { $in: leaderIds }, flushReason: 'enrolled' },
      limit: 200_000,
    }),
    gatewayCall<{ documents: PlacementDoc[] }>('mongodb', 'query', {
      database: MONGO_DB,
      collection: COLL_PLACEMENTS,
      filter: { sponsorTmagId: { $in: leaderIds }, placedAt: { $gte: cutoff30 } },
      limit: 200_000,
    }),
    gatewayCall<{ documents: ActivityDoc[] }>('mongodb', 'query', {
      database: MONGO_DB,
      collection: COLL_ACTIVITY,
      filter: { sponsorTmagId: { $in: leaderIds }, kind: 'video_completed', at: { $gte: cutoff30 } },
      limit: 200_000,
    }),
  ]);

  const enrollMap = new Map<string, number>();
  for (const p of enrollLifetime.documents ?? []) {
    enrollMap.set(p.sponsorTmagId, (enrollMap.get(p.sponsorTmagId) ?? 0) + 1);
  }
  const recentEnrollMap = new Map<string, number>();
  const placedMap = new Map<string, number>();
  for (const p of placements30.documents ?? []) {
    placedMap.set(p.sponsorTmagId, (placedMap.get(p.sponsorTmagId) ?? 0) + 1);
    if (p.flushReason === 'enrolled' && p.flushedAt && p.flushedAt >= cutoff30) {
      recentEnrollMap.set(p.sponsorTmagId, (recentEnrollMap.get(p.sponsorTmagId) ?? 0) + 1);
    }
  }
  const videoMap = new Map<string, number>();
  for (const a of videoComplete30.documents ?? []) {
    videoMap.set(a.sponsorTmagId, (videoMap.get(a.sponsorTmagId) ?? 0) + 1);
  }

  const rows: AdminLeaderScorecardRow[] = leaderIds.map((id) => {
    const b = baLookup.get(id);
    return {
      tmagId: id,
      fullName: b ? `${b.firstName} ${b.lastName}`.trim() : id,
      signupAt: b?.createdAt ?? '',
      personalEnrollments: enrollMap.get(id) ?? 0,
      teamRecentEnrollments: recentEnrollMap.get(id) ?? 0,
      teamPlacementsLast30d: placedMap.get(id) ?? 0,
      teamVideoCompletesLast30d: videoMap.get(id) ?? 0,
    };
  });

  const result: AdminLeaderScorecardReport = {
    leaderCount: rows.length,
    rows,
    provenanceNote: PROVENANCE,
  };

  return {
    result,
    meta: {
      reportKey: 'leader_scorecards',
      generatedAt: new Date().toISOString(),
      appliedFilter: filter,
      range,
      sourceHash: hashSourceData(result),
    },
  };
}
