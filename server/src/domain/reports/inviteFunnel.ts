/**
 * ADMIN I.1 · Report 3 — Invite-to-presentation movement (Chat #143).
 *
 * Funnel through the invite_tokens state machine: mint → click →
 * video_started → video_complete. Stage counts + stage-to-stage conversion
 * % + average days for the transitions that ARE cleanly timestamped:
 *   - mint → click: invite_tokens.createdAt → clickedAt
 *   - click → video_complete: clickedAt → invitation_activity{kind:video_completed}.at
 * Per-state timestamps for video_started are not stored, so
 * video_started→video_complete duration is not computed (provenanceNote).
 *
 * Scope: AdminDashboardFilter (baId + leaderGroup) via resolveScopedBaIds.
 * Time range narrows tokens by createdAt (mint time).
 *
 * Compliance (ADMIN I.5): operational — prospect-cohort counts, no per-
 * prospect scoring, no ranking.
 */

import { gatewayCall } from '../../services/gateway.js';
import { resolveScopedBaIds } from '../adminMetrics.js';
import { rangeClause } from './timeRange.js';
import { hashSourceData } from '../../services/pdfReport.js';
import type {
  AdminDashboardFilter,
  AdminInviteFunnelPerBaRow,
  AdminInviteFunnelPerBaSort,
  AdminInviteFunnelReport,
  AdminInviteFunnelStageCount,
  AdminReportMeta,
  AdminReportTimeRange,
} from '@momentum/shared';

const MONGO_DB = 'momentum';
const COLL_TOKENS = 'invite_tokens';
const COLL_ACTIVITY = 'invitation_activity';
const COLL_BAS = 'brand_ambassadors';

const PROVENANCE =
  'Invite-funnel data note (Chat #143): mint → click → video_started → ' +
  'video_complete reads from invite_tokens.state. Average days are computed ' +
  'only where a clean per-state timestamp exists: mint→click (createdAt→' +
  'clickedAt) and click→video_complete (clickedAt→invitation_activity ' +
  'video_completed.at). video_started has no per-state timestamp stored, so ' +
  'video_started→video_complete duration is not reported.';

type TokenState = 'minted' | 'clicked' | 'video_started' | 'video_complete';
const STATE_ORDER: TokenState[] = ['minted', 'clicked', 'video_started', 'video_complete'];

interface TokenDoc {
  token: string;
  prospectId: string;
  sponsorBaId: string;
  state: TokenState;
  createdAt: string;
  clickedAt: string | null;
  updatedAt: string;
}
interface VideoActivityDoc {
  prospectId: string;
  at: string;
}
interface BaDoc {
  baId: string;
  firstName: string;
  lastName: string;
  deleted?: boolean;
}

function daysBetween(aIso: string, bIso: string): number {
  const ms = new Date(bIso).getTime() - new Date(aIso).getTime();
  return Math.max(0, Math.round((ms / (24 * 60 * 60 * 1000)) * 10) / 10);
}
function avg(values: number[]): number | null {
  if (values.length === 0) return null;
  return Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10;
}
function pct(num: number, den: number): number | null {
  if (den === 0) return null;
  return Math.round((num / den) * 100);
}

export async function buildInviteFunnelReport(
  filter: AdminDashboardFilter,
  range: AdminReportTimeRange,
  perBaSort: AdminInviteFunnelPerBaSort = 'completes',
): Promise<{
  result: AdminInviteFunnelReport;
  meta: Omit<AdminReportMeta, 'title'>;
}> {
  const scopedBaIds = await resolveScopedBaIds(filter);

  const tokenFilter: Record<string, unknown> = {};
  if (scopedBaIds !== null) tokenFilter.sponsorBaId = { $in: scopedBaIds };
  Object.assign(tokenFilter, rangeClause('createdAt', range));

  const tokensRes = await gatewayCall<{ documents: TokenDoc[] }>('mongodb', 'query', {
    database: MONGO_DB,
    collection: COLL_TOKENS,
    filter: tokenFilter,
    limit: 200_000,
  });
  const tokens = tokensRes.documents ?? [];

  // Cumulative counts: any token in state >= S counts as having reached S.
  const reachedIndex = (s: TokenState) => STATE_ORDER.indexOf(s);
  const reached = (t: TokenDoc, s: TokenState) => reachedIndex(t.state) >= reachedIndex(s);

  const minted = tokens.length;
  const clicked = tokens.filter((t) => reached(t, 'clicked')).length;
  const videoStarted = tokens.filter((t) => reached(t, 'video_started')).length;
  const videoComplete = tokens.filter((t) => reached(t, 'video_complete')).length;

  const stages: AdminInviteFunnelStageCount[] = [
    { stage: 'minted', tokens: minted, conversionFromMint: minted === 0 ? null : 1 },
    { stage: 'clicked', tokens: clicked, conversionFromMint: pct(clicked, minted) === null ? null : clicked / minted },
    { stage: 'video_started', tokens: videoStarted, conversionFromMint: pct(videoStarted, minted) === null ? null : videoStarted / minted },
    { stage: 'video_complete', tokens: videoComplete, conversionFromMint: pct(videoComplete, minted) === null ? null : videoComplete / minted },
  ];

  // mint → click durations.
  const mintToClick = tokens
    .filter((t) => t.clickedAt)
    .map((t) => daysBetween(t.createdAt, t.clickedAt!));

  // click → video_complete durations — needs the video_completed event timestamp per prospect.
  let clickToComplete: number[] = [];
  // Tokens that reached video_complete AND have a clickedAt are the only ones we can clock.
  const completedClicked = tokens.filter((t) => reached(t, 'video_complete') && t.clickedAt);
  if (completedClicked.length > 0) {
    const prospectList = completedClicked.map((t) => t.prospectId);
    const actRes = await gatewayCall<{ documents: VideoActivityDoc[] }>(
      'mongodb',
      'query',
      {
        database: MONGO_DB,
        collection: COLL_ACTIVITY,
        filter: { kind: 'video_completed', prospectId: { $in: prospectList } },
        limit: prospectList.length,
      },
    );
    const completedAtByProspect = new Map<string, string>();
    for (const a of actRes.documents ?? []) {
      if (!completedAtByProspect.has(a.prospectId)) completedAtByProspect.set(a.prospectId, a.at);
    }
    clickToComplete = completedClicked
      .map((t) => {
        const at = completedAtByProspect.get(t.prospectId);
        return at ? daysBetween(t.clickedAt!, at) : null;
      })
      .filter((d): d is number => d !== null);
  }

  // ─── Per-BA breakdown (Chat #143 extension) ────────────────────────────────
  // Hides BAs with zero mints (same convention as #5 enrollment.perBa).
  // Identify which video_completed prospects we observed (for per-BA count),
  // since a token can reach 'video_complete' state without us having to check
  // the activity collection again — the token's state already tells us.
  const baStats = new Map<
    string,
    { minted: number; clicked: number; videoStarted: number; videoComplete: number }
  >();
  for (const t of tokens) {
    const s =
      baStats.get(t.sponsorBaId) ?? { minted: 0, clicked: 0, videoStarted: 0, videoComplete: 0 };
    s.minted += 1;
    if (reached(t, 'clicked')) s.clicked += 1;
    if (reached(t, 'video_started')) s.videoStarted += 1;
    if (reached(t, 'video_complete')) s.videoComplete += 1;
    baStats.set(t.sponsorBaId, s);
  }

  // Resolve names for the BAs that have any minted token (zero-mints already hidden).
  const perBaIds = [...baStats.keys()];
  const baNameLookup = new Map<string, string>();
  if (perBaIds.length > 0) {
    const basRes = await gatewayCall<{ documents: BaDoc[] }>('mongodb', 'query', {
      database: MONGO_DB,
      collection: COLL_BAS,
      filter: { baId: { $in: perBaIds }, deleted: { $ne: true } },
      limit: perBaIds.length,
    });
    for (const b of basRes.documents ?? []) {
      baNameLookup.set(b.baId, `${b.firstName} ${b.lastName}`.trim());
    }
  }

  let perBa: AdminInviteFunnelPerBaRow[] = perBaIds.map((id) => {
    const s = baStats.get(id)!;
    return {
      baId: id,
      fullName: baNameLookup.get(id) ?? id,
      minted: s.minted,
      clicked: s.clicked,
      videoStarted: s.videoStarted,
      videoComplete: s.videoComplete,
      mintToCompletePct: pct(s.videoComplete, s.minted),
    };
  });

  // Sort by requested field (defaults to videoComplete desc).
  perBa = perBa.sort((a, b) => {
    switch (perBaSort) {
      case 'mints':
        return b.minted - a.minted;
      case 'completion_pct': {
        // Null pct sorts last; ties broken by completes desc for stability.
        const ap = a.mintToCompletePct ?? -1;
        const bp = b.mintToCompletePct ?? -1;
        if (bp !== ap) return bp - ap;
        return b.videoComplete - a.videoComplete;
      }
      case 'completes':
      default:
        return b.videoComplete - a.videoComplete;
    }
  });

  const result: AdminInviteFunnelReport = {
    totals: {
      minted,
      clicked,
      videoStarted,
      videoComplete,
      mintToClickPct: pct(clicked, minted),
      clickToVideoStartPct: pct(videoStarted, clicked),
      videoStartToCompletePct: pct(videoComplete, videoStarted),
      avgDaysMintToClick: avg(mintToClick),
      avgDaysClickToVideoComplete: avg(clickToComplete),
    },
    stages,
    perBa,
    perBaSort,
    provenanceNote: PROVENANCE,
  };

  return {
    result,
    meta: {
      reportKey: 'invite_to_presentation',
      generatedAt: new Date().toISOString(),
      appliedFilter: filter,
      range,
      sourceHash: hashSourceData(result),
    },
  };
}
