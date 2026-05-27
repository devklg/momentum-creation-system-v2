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

import type { AdminDashboardFilter } from './types.js';

/* ─── Time range (Kevin decision A, Chat #143: preset enum AND explicit dates) ── */

/**
 * Preset windows from ADMIN Design I.1 ("cohort by signup month, last 30
 * days, last 90 days, lifetime"). `by_month` is the cohort-grouped view;
 * the other three are flat windows ending now.
 */
export type AdminReportRangePreset = 'lifetime' | 'last_30d' | 'last_90d' | 'by_month';

/**
 * The resolved time range a report runs against. Exactly one of `preset` or
 * an explicit `from`/`to` pair is the source; the resolver always fills
 * `fromIso`/`toIso` (the concrete bounds actually queried) so the report and
 * its PDF footer can state the precise window. `fromIso` is null for
 * lifetime / open-start ranges.
 */
export interface AdminReportTimeRange {
  preset: AdminReportRangePreset | null;
  /** Inclusive lower bound actually queried (ISO-8601), or null = open start. */
  fromIso: string | null;
  /** Exclusive upper bound actually queried (ISO-8601). Defaults to now. */
  toIso: string;
  /** Human label for headers/PDF, e.g. "Last 30 days" or "2026-01-01 → now". */
  label: string;
}

/** Query input accepted by every report route, parsed from the query string. */
export interface AdminReportQuery {
  filter: AdminDashboardFilter;
  range: AdminReportTimeRange;
}

/* ─── Shared envelope ──────────────────────────────────────────── */

/**
 * Common metadata on every report result. `sourceHash` mirrors the I.3
 * verifiability contract — SHA-256 over the exact rows returned — so a JSON
 * snapshot and its PDF render can be cross-checked.
 */
export interface AdminReportMeta {
  reportKey: AdminReportKey;
  title: string;
  generatedAt: string;
  appliedFilter: AdminDashboardFilter;
  range: AdminReportTimeRange;
  sourceHash: string;
}

export type AdminReportKey =
  | 'ba_activation'
  | 'training_completion'
  | 'invite_to_presentation'
  | 'queue_velocity'
  | 'enrollment_completion'
  | 'follow_up_aging'
  | 'leader_scorecards';

/** Generic JSON response wrapper for a report route. */
export interface AdminReportResponse<Result> {
  ok: true;
  meta: AdminReportMeta;
  result: Result;
}

/* ─── 1 · BA activation ───────────────────────────────────────── */

/**
 * Per-BA activation milestones (ADMIN I.1 line 1). Each timestamp is the
 * FIRST occurrence; null = not yet reached. Days-to-first-invite measures
 * signup → first invitation_sent.
 */
export interface AdminActivationRow {
  baId: string;
  fullName: string;
  signupAt: string;
  welcomeAcceptedAt: string | null;
  michaelCompletedAt: string | null;
  firstInviteAt: string | null;
  firstVideoCompleteAt: string | null;
  firstEnrollmentAt: string | null;
  daysSignupToFirstInvite: number | null;
}

/** Cohort bucket (signup month, "YYYY-MM") with activation counts. */
export interface AdminActivationCohort {
  cohort: string;
  signups: number;
  reachedWelcome: number;
  reachedMichael: number;
  reachedFirstInvite: number;
  reachedFirstVideoComplete: number;
  reachedFirstEnrollment: number;
}

export interface AdminActivationReport {
  totals: {
    signups: number;
    reachedFirstInvite: number;
    reachedFirstEnrollment: number;
    medianDaysSignupToFirstInvite: number | null;
  };
  cohorts: AdminActivationCohort[];
  rows: AdminActivationRow[];
}
