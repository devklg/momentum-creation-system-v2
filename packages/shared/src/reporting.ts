/**
 * ADMIN Section I.1 — Standard-report library types (Chat #143).
 *
 * The seven reports built this tranche (decision dec_reporting_i1_scope):
 *   1. BA activation
 *   2. Training completion
 *   3. Invite-to-presentation movement
 *   4. Queue velocity
 *   5. Enrollment completion  (renamed from spec's "Registration handoff
 *      completion" — enrollment is the BA-to-BA off-app handoff per
 *      locked-spec 3.6; the report counts prospects a BA marked enrolled)
 *   6. Follow-up aging
 *   9. Leader scorecards
 *
 * Reports 7 (compliance enforcement count) and 8 (exception dashboard) are
 * intentionally NOT built this tranche — see the decision ledger. They keep
 * their place in the spec's library definition.
 *
 * Each report is a JSON domain fn consumed by BOTH a JSON route
 * (GET /api/admin/reporting/<name>) AND a PDF section in the I.3 master
 * report. Every report reuses AdminDashboardFilter (narrowing-only) for BA /
 * leader-group scoping, exactly like the dashboard and prospect surfaces.
 *
 * Compliance: /admin-only (ADMIN Design I.5) — operational analytics, never
 * prospect/BA scoring or income ranking.
 */

import type { McsAdminDashboardFilter } from './types.js';

/* ─── Time range (Kevin decision A, Chat #143: preset enum AND explicit dates) ── */

/**
 * Preset windows from ADMIN Design I.1 ("cohort by signup month, last 30
 * days, last 90 days, lifetime"). `by_month` is the cohort-grouped view;
 * the other three are flat windows ending now.
 */
export type McsAdminReportRangePreset = 'lifetime' | 'last_30d' | 'last_90d' | 'by_month';

/**
 * The resolved time range a report runs against. Exactly one of `preset` or
 * an explicit `from`/`to` pair is the source; the resolver always fills
 * `fromIso`/`toIso` (the concrete bounds actually queried) so the report and
 * its PDF footer can state the precise window. `fromIso` is null for
 * lifetime / open-start ranges.
 */
export interface McsAdminReportTimeRange {
  preset: McsAdminReportRangePreset | null;
  /** Inclusive lower bound actually queried (ISO-8601), or null = open start. */
  fromIso: string | null;
  /** Exclusive upper bound actually queried (ISO-8601). Defaults to now. */
  toIso: string;
  /** Human label for headers/PDF, e.g. "Last 30 days" or "2026-01-01 → now". */
  label: string;
}

/** Query input accepted by every report route, parsed from the query string. */
export interface McsAdminReportQuery {
  filter: McsAdminDashboardFilter;
  range: McsAdminReportTimeRange;
}

/* ─── Shared envelope ──────────────────────────────────────────── */

/**
 * Common metadata on every report result. `sourceHash` mirrors the I.3
 * verifiability contract — SHA-256 over the exact rows returned — so a JSON
 * snapshot and its PDF render can be cross-checked.
 */
export interface McsAdminReportMeta {
  reportKey: McsAdminReportKey;
  title: string;
  generatedAt: string;
  appliedFilter: McsAdminDashboardFilter;
  range: McsAdminReportTimeRange;
  sourceHash: string;
}

export type McsAdminReportKey =
  | 'ba_activation'
  | 'training_completion'
  | 'invite_to_presentation'
  | 'queue_velocity'
  | 'enrollment_completion'
  | 'follow_up_aging'
  | 'leader_scorecards';

/** Generic JSON response wrapper for a report route. */
export interface McsAdminReportResponse<Result> {
  ok: true;
  meta: McsAdminReportMeta;
  result: Result;
}

/* ─── 1 · BA activation ───────────────────────────────────────── */

/**
 * Per-BA activation milestones (ADMIN I.1 line 1). Each timestamp is the
 * FIRST occurrence; null = not yet reached. Days-to-first-invite measures
 * signup → first invitation_sent.
 */
export interface McsAdminActivationRow {
  tmagId: string;
  fullName: string;
  signupAt: string;
  welcomeAcceptedAt: string | null;
  steveDiscoveryCompletedAt: string | null;
  firstInviteAt: string | null;
  firstVideoCompleteAt: string | null;
  firstEnrollmentAt: string | null;
  daysSignupToFirstInvite: number | null;
}

/** Cohort bucket (signup month, "YYYY-MM") with activation counts. */
export interface McsAdminActivationCohort {
  cohort: string;
  signups: number;
  reachedWelcome: number;
  reachedSteveDiscovery: number;
  reachedFirstInvite: number;
  reachedFirstVideoComplete: number;
  reachedFirstEnrollment: number;
}

export interface McsAdminActivationReport {
  totals: {
    signups: number;
    reachedFirstInvite: number;
    reachedFirstEnrollment: number;
    medianDaysSignupToFirstInvite: number | null;
  };
  cohorts: McsAdminActivationCohort[];
  rows: McsAdminActivationRow[];
}

/* ─── 2 · Training completion ───────────────────────────────────── */

/**
 * Per-BA training progress (ADMIN I.1 line 2): Fast Start Module 1–5
 * completion + 10-step orientation completion + days from signup to each
 * milestone.
 *
 * DATA NOTE (Chat #143): `fast_start_progress` exists as the source but is
 * currently empty (no BA has progressed). `orientationCompletedAt` has NO
 * source yet — orientation is a live Zoom call and its completion-tracking
 * surface (wireframe 4.team 3.6 scheduling card) is unbuilt, so this field
 * is null for everyone until that lands. The report is structurally
 * complete and correct the moment data flows; no rework needed. See the
 * report's provenanceNote.
 */
export interface McsAdminTrainingReportRow {
  tmagId: string;
  fullName: string;
  signupAt: string;
  modulesCompleted: number; // 0–5
  fastStartComplete: boolean; // all 5
  fastStartCompletedAt: string | null; // max module completedAt when all 5 done
  orientationCompletedAt: string | null; // forward-declared; null until surface exists
  daysSignupToFastStartComplete: number | null;
}

export interface McsAdminTrainingReport {
  totals: {
    bas: number;
    fastStartComplete: number;
    fastStartCompletePct: number | null;
    orientationComplete: number;
    avgDaysSignupToFastStartComplete: number | null;
  };
  /** Module-by-module completion counts across the scoped BA set. */
  moduleCompletion: Array<{ moduleId: 1 | 2 | 3 | 4 | 5; completed: number }>;
  rows: McsAdminTrainingReportRow[];
  /** Surfaced so the JSON consumer can show the same honesty as the PDF. */
  provenanceNote: string;
}

/* ─── 3 · Invite-to-presentation movement ─────────────────────── */

/**
 * Funnel through the invite_tokens state machine (ADMIN I.1 line 3):
 * mint → click → video_started → video_complete. Stage counts +
 * stage-to-stage conversion %.
 *
 * Per-stage average days are reported only where a clean transition
 * timestamp exists (mint→click via tokens.createdAt→clickedAt;
 * click→video_complete via clickedAt→invitation_activity.video_completed.at).
 * Other transitions are not currently timestamped per-state; the report
 * carries a provenanceNote.
 */
export interface McsAdminInviteFunnelStageCount {
  stage: 'minted' | 'clicked' | 'video_started' | 'video_complete';
  tokens: number;
  /** Cumulative conversion from mint (0–1). null when minted=0. */
  conversionFromMint: number | null;
}

/**
 * Per-BA breakdown of the invite funnel (Chat #143 extension). BAs with
 * zero mints are HIDDEN — same convention as Report #5's perBa.
 */
export type McsAdminInviteFunnelPerBaSort = 'completes' | 'mints' | 'completion_pct';

export interface McsAdminInviteFunnelPerBaRow {
  tmagId: string;
  fullName: string;
  minted: number;
  clicked: number;
  videoStarted: number;
  videoComplete: number;
  mintToCompletePct: number | null;
}

export interface McsAdminInviteFunnelReport {
  totals: {
    minted: number;
    clicked: number;
    videoStarted: number;
    videoComplete: number;
    mintToClickPct: number | null;
    clickToVideoStartPct: number | null;
    videoStartToCompletePct: number | null;
    avgDaysMintToClick: number | null;
    avgDaysClickToVideoComplete: number | null;
  };
  stages: McsAdminInviteFunnelStageCount[];
  /** Per-BA breakdown; default sort is by videoComplete desc. */
  perBa: McsAdminInviteFunnelPerBaRow[];
  /** Sort field actually used to order perBa[] in this response. */
  perBaSort: McsAdminInviteFunnelPerBaSort;
  provenanceNote: string;
}

/* ─── 4 · Queue velocity ────────────────────────────────────────── */

/**
 * Daily queue flow (ADMIN I.1 line 4): placements/day, flushes/day,
 * enrollments/day, net change/day. Sources from pool_placements (placedAt,
 * flushedAt, flushReason). Net = placements − flushes (any reason).
 * Enrollments are flushes with flushReason='enrolled'.
 */
export interface McsAdminQueueVelocityDay {
  date: string; // YYYY-MM-DD UTC
  placements: number;
  flushes: number;
  enrollments: number;
  net: number;
}

export interface McsAdminQueueVelocityReport {
  totals: {
    placements: number;
    flushes: number;
    enrollments: number;
    net: number;
    placementsPerDay7d: number | null;
    placementsPerDay30d: number | null;
    enrollmentsPerDay7d: number | null;
    enrollmentsPerDay30d: number | null;
  };
  days: McsAdminQueueVelocityDay[];
}

/* ─── 5 · Enrollment completion (renamed from spec's "Registration handoff") ── */

/**
 * Prospects marked enrolled, sliced by BA, by day, by BA signup cohort.
 * Renamed from the spec's "Registration handoff completion" because per
 * locked-spec 3.6 and Chat #84 the system has no programmatic registration
 * handoff — enrollment is BA-to-BA, off-app. What the system records is
 * the moment the BA marks the prospect enrolled (pool_placements with
 * flushReason='enrolled' and flushedAt).
 */
export interface McsAdminEnrollmentPerBa {
  tmagId: string;
  fullName: string;
  enrollments: number;
}
export interface McsAdminEnrollmentPerDay {
  date: string; // YYYY-MM-DD UTC
  enrollments: number;
}
export interface McsAdminEnrollmentPerCohort {
  cohort: string; // BA signup-month YYYY-MM
  bas: number;
  enrollments: number;
}

export interface McsAdminEnrollmentReport {
  totals: {
    enrollments: number;
    enrollingBas: number;
    perDayAvg7d: number | null;
    perDayAvg30d: number | null;
  };
  perBa: McsAdminEnrollmentPerBa[];
  perDay: McsAdminEnrollmentPerDay[];
  perCohort: McsAdminEnrollmentPerCohort[];
}

/* ─── 6 · Follow-up aging ──────────────────────────────────────── */

/**
 * Open follow-up aging (ADMIN I.1 line 6). The spec calls for bucketing
 * open reminders by age 0–3 / 4–7 / 8–14 / 15+ days. There is no live
 * "active follow-up reminder" collection yet (the surface is referenced in
 * the wireframe but unbuilt). Today this report ages prospects by their
 * crm_dispositions.updatedAt as the closest available proxy; the
 * provenanceNote states the proxy explicitly so consumers know.
 */
export type McsAdminFollowUpBucket = '0-3' | '4-7' | '8-14' | '15+';

export interface McsAdminFollowUpBucketCount {
  bucket: McsAdminFollowUpBucket;
  prospects: number;
}

export interface McsAdminFollowUpRow {
  prospectId: string;
  sponsorTmagId: string;
  disposition: string;
  lastUpdatedAt: string;
  ageDays: number;
  bucket: McsAdminFollowUpBucket;
}

export interface McsAdminFollowUpReport {
  totals: {
    prospects: number;
    avgAgeDays: number | null;
    maxAgeDays: number | null;
  };
  buckets: McsAdminFollowUpBucketCount[];
  rows: McsAdminFollowUpRow[]; // sorted oldest first
  provenanceNote: string;
}

/* ─── 9 · Leader scorecards (Kevin-only; coaching, never shown to leader) ── */

/**
 * Per leader (currently THREE-binary-qualified AND ≥5 personal enrollments,
 * per Chat #100 — set is empty today until THREE qualifications mirror in;
 * no algorithmic heuristic permitted). ADMIN I.5: Kevin-only, never shown
 * to the leader.
 */
export interface McsAdminLeaderScorecardRow {
  tmagId: string;
  fullName: string;
  signupAt: string;
  personalEnrollments: number;
  teamRecentEnrollments: number; // last 30d
  teamPlacementsLast30d: number;
  teamVideoCompletesLast30d: number;
}

export interface McsAdminLeaderScorecardReport {
  leaderCount: number;
  rows: McsAdminLeaderScorecardRow[];
  /** Why the list may be empty (Chat #100 / LEADER_DETECTION_NOTE). */
  provenanceNote: string;
}
