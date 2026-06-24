/**
 * LEGACY Michael interview classification helpers.
 *
 * Reconciled 2026-06-24: Steve owns Discovery + Success Profile without
 * scoring. Michael is the Training Agent and Daily Success Coach and must not classify, rank, or predict.
 * This file remains only so historical imports/tests compile until a later
 * migration deletes the old scored-Michael path.
 *
 * COMPLIANCE: tier labels and profile copy are effort/intent reads of the BA's
 * OWN stated goals. No earnings, commissions, cycle math, or placement.
 */

import {
  MICHAEL_RUBRIC_MAX,
  MICHAEL_CLASSIFICATION_BANDS,
  type MichaelCategoryScores,
  type MichaelClassification,
  type MichaelClassificationTier,
  type MichaelRubricCategory,
  type MichaelSuccessProfile,
} from '@momentum/shared';
import { MICHAEL_SIGNED_BY } from './michael-interview-script.js';

function clamp(value: number, max: number): number {
  if (!Number.isFinite(value) || value < 0) return 0;
  if (value > max) return max;
  // Round to 1 decimal so a worker's fractional reads don't produce noisy totals.
  return Math.round(value * 10) / 10;
}

/** Clamp raw category scores to their rubric maxes (0..max each). */
export function clampCategoryScores(raw: MichaelCategoryScores): MichaelCategoryScores {
  return {
    vision: clamp(raw.vision, MICHAEL_RUBRIC_MAX.vision),
    commitment: clamp(raw.commitment, MICHAEL_RUBRIC_MAX.commitment),
    coachability: clamp(raw.coachability, MICHAEL_RUBRIC_MAX.coachability),
    availableTime: clamp(raw.availableTime, MICHAEL_RUBRIC_MAX.available_time),
    network: clamp(raw.network, MICHAEL_RUBRIC_MAX.network),
    experience: clamp(raw.experience, MICHAEL_RUBRIC_MAX.experience),
  };
}

/** Sum the clamped per-category points into the 0..100 weighted total. */
export function weightedTotal(scores: MichaelCategoryScores): number {
  const sum =
    scores.vision +
    scores.commitment +
    scores.coachability +
    scores.availableTime +
    scores.network +
    scores.experience;
  return Math.round(sum * 10) / 10;
}

/** Resolve the tier by band. Defaults to the lightest band if no edge matches
 *  (impossible after clamping, but keeps the function total). */
export function tierForTotal(total: number): {
  tier: MichaelClassificationTier;
  label: string;
  band: string;
} {
  const row =
    MICHAEL_CLASSIFICATION_BANDS.find((b) => total >= b.min && total <= b.max) ??
    MICHAEL_CLASSIFICATION_BANDS[MICHAEL_CLASSIFICATION_BANDS.length - 1]!;
  return { tier: row.tier, label: row.label, band: `${row.min}–${row.max}` };
}

/** Compute the full classification from raw category scores. */
export function classifyInterview(raw: MichaelCategoryScores): MichaelClassification {
  const categoryScores = clampCategoryScores(raw);
  const total = weightedTotal(categoryScores);
  const { tier, label, band } = tierForTotal(total);
  return {
    categoryScores,
    weightedTotal: total,
    tier,
    tierLabel: label,
    band,
    signedBy: MICHAEL_SIGNED_BY,
  };
}

// ──────────────────────────────────────────────────────────────────────────
// Success profile synthesis
// ──────────────────────────────────────────────────────────────────────────

/** How "full" each category is, 0..1, for ranking strengths vs. focus areas. */
function categoryRatios(
  scores: MichaelCategoryScores,
): Array<{ category: MichaelRubricCategory; ratio: number }> {
  return [
    { category: 'vision', ratio: scores.vision / MICHAEL_RUBRIC_MAX.vision },
    { category: 'commitment', ratio: scores.commitment / MICHAEL_RUBRIC_MAX.commitment },
    { category: 'coachability', ratio: scores.coachability / MICHAEL_RUBRIC_MAX.coachability },
    { category: 'available_time', ratio: scores.availableTime / MICHAEL_RUBRIC_MAX.available_time },
    { category: 'network', ratio: scores.network / MICHAEL_RUBRIC_MAX.network },
    { category: 'experience', ratio: scores.experience / MICHAEL_RUBRIC_MAX.experience },
  ];
}

/** Plain effort/intent reads — never income or placement language. */
const STRENGTH_READS: Record<MichaelRubricCategory, string> = {
  vision: 'A clear, specific picture of what they want',
  commitment: 'Serious, steady intent to show up',
  coachability: 'Open to being taught and corrected',
  available_time: 'Real, protected time to give',
  network: 'A warm circle they feel good sharing with',
  experience: 'Transferable experience to lean on',
};

const FOCUS_READS: Record<MichaelRubricCategory, string> = {
  vision: 'Help them sharpen what they actually want and why',
  commitment: 'Help them set a realistic, repeatable weekly rhythm',
  coachability: 'Build trust before correcting; keep guidance gentle and concrete',
  available_time: 'Help them carve out and protect a small, consistent window',
  network: 'Help them feel natural sharing — start with the people they trust most',
  experience: 'This is new to them; walk each step slowly and celebrate early wins',
};

const TIER_HEADLINE: Record<MichaelClassificationTier, string> = {
  builder: 'Ready to build — vision, commitment, and capacity are aligned.',
  emerging_leader: 'Strong start with leadership upside — coach toward consistency.',
  part_time_producer: 'Engaged and capable part-time — meet them where their time is.',
  casual_participant: 'Early and light — lead with belief, keep the first steps tiny.',
};

/**
 * Build the sponsor/founder-readable success profile from a classification.
 * Strengths = the top categories by ratio; sponsorFocus = the lowest. The
 * headline leads with the tier read so the sponsor knows how to show up.
 */
export function buildSuccessProfile(args: {
  baId: string;
  classification: MichaelClassification;
  generatedAt: string;
}): MichaelSuccessProfile {
  const ratios = categoryRatios(args.classification.categoryScores);
  const sorted = [...ratios].sort((a, b) => b.ratio - a.ratio);

  // Strengths: categories at or above 60% of their max (cap 3); fall back to the
  // single best if none clear the bar so the profile is never empty.
  const strong = sorted.filter((r) => r.ratio >= 0.6).slice(0, 3);
  const strengthsSrc = strong.length > 0 ? strong : sorted.slice(0, 1);
  const strengths = strengthsSrc.map((r) => STRENGTH_READS[r.category]);

  // Focus: weakest categories below 60% (cap 3), lowest first.
  const weak = [...sorted].reverse().filter((r) => r.ratio < 0.6).slice(0, 3);
  const sponsorFocus =
    weak.length > 0
      ? weak.map((r) => FOCUS_READS[r.category])
      : ['They came in strong across the board — keep the momentum and stay close early.'];

  return {
    baId: args.baId,
    classification: args.classification,
    headline: TIER_HEADLINE[args.classification.tier],
    strengths,
    sponsorFocus,
    generatedAt: args.generatedAt,
    signedBy: MICHAEL_SIGNED_BY,
  };
}
