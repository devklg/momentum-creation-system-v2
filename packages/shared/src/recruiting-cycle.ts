/**
 * ACR-0011 — 5 Point Recruiting Cycle shared foundation.
 *
 * This module is the single source of truth for the recruiting-cycle domain:
 *   1. LOCKED constants (names target, tranche size, milestone/stall windows).
 *   2. camelCase TS domain types for the `tmag_recruiting_cycles` collection.
 *   3. API request/response contracts pinned so the server lane (evaluator,
 *      stall sweep, attestation route) and the team lane (launch dashboard)
 *      build against ONE shape.
 *
 * Authority: `organization/ACR-0011-five-point-recruiting-cycle.md` (APPROVED,
 * ratified Kevin Gardner 2026-07-07) §2.4–2.8, plus `ACR0011_MASTER_BRIEF.md`.
 *
 * Store-naming reconciliation (verified 2026-07-07): ACR §2.4 lists the
 * subdocument fields in snake_case (`five_point_target_at`, …). The MCS v2
 * Mongo store is camelCase at rest across EVERY sibling collection
 * (`tmag_prospects.sponsorTmagId`, `tmag_steve_success_interview.successProfile`,
 * `mcs_outcomes.confirmedByTmagId`, …) and the rev3 registry lists camelCase
 * `required` fields. To follow existing sibling patterns exactly (and keep the
 * server persistence adapters uniform) the stored fields are camelCase; each
 * maps 1:1 to the ACR's snake_case name (documented per-field below).
 */
import type { McsIsoTimestamp } from './types.js';

// ─────────────────────────────────────────────────────────────────────────────
// 1. LOCKED constants — the ONE place these numbers live (ACR §2.2, §2.3, §2.5).
//    Kevin ratified these exact values 2026-07-07; never scatter literals.
// ─────────────────────────────────────────────────────────────────────────────

/** Names-list target per launching BA (ACR §2.2). LOCKED. */
export const RECRUITING_CYCLE_NAMES_TARGET = 100 as const;

/** Names are built in tranches of this size (ACR §2.2). LOCKED. */
export const RECRUITING_CYCLE_TRANCHE_SIZE = 20 as const;

/** Number of tranches to reach the names target (100 / 20 = 5). Derived. */
export const RECRUITING_CYCLE_TRANCHE_COUNT =
  RECRUITING_CYCLE_NAMES_TARGET / RECRUITING_CYCLE_TRANCHE_SIZE;

/** Five-point-cycle target: enrolledAt + 48h (ACR §2.3). LOCKED. */
export const RECRUITING_CYCLE_FIVE_POINT_TARGET_HOURS = 48 as const;

/** QBA target: enrolledAt + 72h (ACR §2.3). LOCKED. */
export const RECRUITING_CYCLE_QBA_TARGET_HOURS = 72 as const;

/**
 * Stall threshold WHILE inside the 72h QBA window: no qualifying activity for
 * 24h flags a stall (ACR §2.5). LOCKED.
 */
export const RECRUITING_CYCLE_STALL_INSIDE_WINDOW_HOURS = 24 as const;

/**
 * Stall threshold AFTER the QBA window (until launch completion): no qualifying
 * activity for 72h flags a stall (ACR §2.5). LOCKED.
 */
export const RECRUITING_CYCLE_STALL_AFTER_WINDOW_HOURS = 72 as const;

/** Milliseconds per hour — for target/stall arithmetic off the locked hours. */
export const RECRUITING_CYCLE_HOUR_MS = 60 * 60 * 1000;

// ─────────────────────────────────────────────────────────────────────────────
// 2. Enums / small unions.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The five recruiting-cycle steps (ACR §2.1). `currentStep` is the earliest
 * incomplete step, 1–5:
 *   1 Make Your List · 2 Connecting & Inviting · 3 Presenting ·
 *   4 Follow Up · 5 Onboarding New BA.
 */
export type McsRecruitingStep = 1 | 2 | 3 | 4 | 5;

export const MCS_RECRUITING_STEPS: readonly McsRecruitingStep[] = [1, 2, 3, 4, 5] as const;

/** Human labels for the five steps (BA-facing; supportive framing). */
export const MCS_RECRUITING_STEP_LABELS: Record<McsRecruitingStep, string> = {
  1: 'Make Your List',
  2: 'Connecting & Inviting',
  3: 'Presenting',
  4: 'Follow Up',
  5: 'Onboarding New BA',
};

/**
 * Coarse cycle status.
 *   active    — cycle in progress, no stall flag standing.
 *   stalled   — flagged by the stall sweep (`stallFlaggedAt` set); Michael owns
 *               the re-engagement voice. Returns to `active` on qualifying
 *               activity.
 *   completed — launch cycle finished (five-point + QBA reached / launch done).
 */
export type McsRecruitingCycleStatus = 'active' | 'stalled' | 'completed';

export const MCS_RECRUITING_CYCLE_STATUSES: readonly McsRecruitingCycleStatus[] = [
  'active',
  'stalled',
  'completed',
] as const;

/**
 * Attestation leg (ACR §2.6). A QBA needs one `left` + one `right` enrollment;
 * `core3` attests the third enrollment (CORE 3). Sponsor-attested ONLY — no
 * THREE back-office API.
 */
export type McsRecruitingAttestationLeg = 'left' | 'right' | 'core3';

export const MCS_RECRUITING_ATTESTATION_LEGS: readonly McsRecruitingAttestationLeg[] = [
  'left',
  'right',
  'core3',
] as const;

// ─────────────────────────────────────────────────────────────────────────────
// 3. Domain record — the stored `tmag_recruiting_cycles` shape (camelCase).
//    One record per launching BA, created on Steve Discovery completion.
//    Each field notes its ACR §2.4 snake_case counterpart.
// ─────────────────────────────────────────────────────────────────────────────

export interface McsRecruitingCycleRecord {
  _id?: string;
  /** ACR `tmag_id` — the launching BA this cycle belongs to. One per BA. */
  tmagId: string;
  /** ACR `enrolled_at` — the BA's enrollment moment; anchors both targets. */
  enrolledAt: McsIsoTimestamp;

  // Five-point milestone (ACR §2.3 five_point_cycle_completed).
  /** ACR `five_point_target_at` — enrolledAt + 48h. Coaching target, not a deadline. */
  fivePointTargetAt: McsIsoTimestamp;
  /** ACR `five_point_completed_at` — set when all five steps are complete. */
  fivePointCompletedAt: McsIsoTimestamp | null;

  // QBA milestone (ACR §2.3 qba_achieved; written ONLY via sponsor attestation).
  /** ACR `qba_target_at` — enrolledAt + 72h. */
  qbaTargetAt: McsIsoTimestamp;
  /** ACR `qba_achieved_at` — set on the second (left+right) attestation. */
  qbaAchievedAt: McsIsoTimestamp | null;
  /** ACR `qba_left_leg_tmag_id` — attested left-leg enrollee. */
  qbaLeftLegTmagId: string | null;
  /** ACR `qba_right_leg_tmag_id` — attested right-leg enrollee. */
  qbaRightLegTmagId: string | null;
  /** ACR `qba_attested_by` — sponsor who attested (of record, or Kevin/admin). */
  qbaAttestedBy: string | null;

  // CORE 3 milestone (ACR §2.3 core3_achieved; third enrollment).
  /** ACR `core3_achieved_at` — set on the CORE-3 attestation. */
  core3AchievedAt: McsIsoTimestamp | null;
  /** ACR `core3_tmag_id` — the attested third enrollee. */
  core3TmagId: string | null;

  // Names-list config (LOCKED constants stamped at creation for auditability).
  /** ACR `names_target` — 100. */
  namesTarget: number;
  /** ACR `tranche_size` — 20. */
  trancheSize: number;

  /** ACR `current_step` — earliest incomplete 5 Point step (1–5, derived/cached). */
  currentStep: McsRecruitingStep;

  // Stall detection (ACR §2.5). Sweep FLAGS ONLY; Michael owns the response.
  /** ACR `last_activity_at` — most recent qualifying activity; drives stall detection. */
  lastActivityAt: McsIsoTimestamp;
  /** ACR `stall_flagged_at` — set by the stall sweep; cleared on re-engagement. */
  stallFlaggedAt: McsIsoTimestamp | null;

  /** Coarse lifecycle status. */
  status: McsRecruitingCycleStatus;

  createdAt: McsIsoTimestamp;
  updatedAt: McsIsoTimestamp;
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. Derived / view types for the team dashboard (ACR §2.8).
//    Counts are DERIVED at read time from existing surfaces — never a parallel
//    store: names ← tmag_ivory_prospect_names, invites ← tmag_prospects minted,
//    presentations ← PMV video engagement, follow-ups ← tmag_prospect_crm_followups,
//    enrollments ← prospect `enrolled` (ACR §2.7, master brief task 3).
// ─────────────────────────────────────────────────────────────────────────────

/** Per-step completion snapshot for the launch checklist rail. */
export interface McsRecruitingStepProgress {
  step: McsRecruitingStep;
  label: string;
  complete: boolean;
}

/** Derived, read-time counts + progress for the team launch dashboard. */
export interface McsRecruitingCycleDerived {
  /** Names entered so far (tmag_ivory_prospect_names for this BA). */
  namesCount: number;
  /** LOCKED 100. */
  namesTarget: number;
  /** LOCKED 20. */
  trancheSize: number;
  /** LOCKED 5. */
  trancheCount: number;
  /** Completed tranches = min(floor(namesCount / trancheSize), trancheCount). */
  tranchesCompleted: number;
  /** Invites minted (tmag_prospects records for this BA). */
  invitesCount: number;
  /** Prospects that reached a presentation-engagement PMV state. */
  presentationsCount: number;
  /** Completed follow-ups (tmag_prospect_crm_followups). */
  followUpsCount: number;
  /** Prospects that reached `enrolled`. */
  enrollmentsCount: number;
  /** Earliest incomplete step (1–5). */
  currentStep: McsRecruitingStep;
  /** Per-step completion for the rail. */
  steps: McsRecruitingStepProgress[];
  /** True when all five steps are complete. */
  fivePointComplete: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. API contracts (types only — no server code in this lane).
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/recruiting-cycle/me — the launching BA's own cycle for the team
 * dashboard. `cycle` is null before Steve initializes it. `why` is the BA's
 * pinned why_statement (from Steve's Success Profile), rendered supportively.
 */
export interface McsRecruitingCycleMeResponse {
  ok: true;
  cycle: McsRecruitingCycleRecord | null;
  derived: McsRecruitingCycleDerived | null;
  /** Pinned why_statement; null until Steve completion. */
  why: string | null;
}

/**
 * POST /api/recruiting-cycle/:tmagId/attest — sponsor attestation (ACR §2.6).
 * `:tmagId` is the launching BA (cycle owner); `enrolleeTmagId` is the enrollee
 * being attested onto `leg`. Manual, sponsor-of-record (or Kevin/admin) only.
 */
export interface McsRecruitingCycleAttestPayload {
  leg: McsRecruitingAttestationLeg;
  /** The enrolled BA being attested onto the leg. */
  enrolleeTmagId: string;
  /** Optional sponsor note captured on the audit entry. */
  note?: string;
}

/**
 * Response from a successful attestation. `milestone` names the milestone the
 * attestation completed, when one was reached this call.
 */
export interface McsRecruitingCycleAttestResponse {
  ok: true;
  cycle: McsRecruitingCycleRecord;
  milestone: 'qba_achieved' | 'core3_achieved' | null;
}
