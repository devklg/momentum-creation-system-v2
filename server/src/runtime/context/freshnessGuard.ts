/**
 * Freshness / deprecation guard (Phase 4 — P4.7).
 *
 * Pure, deterministic predicate that keeps stale/deprecated/superseded/expired/not-yet-effective
 * approved knowledge out of the retrieval path. It never reads an ambient clock, mutates a
 * reference, translates, or fetches.
 *
 * Evaluation instant: a valid `policy.asOf` overrides the injected `now` fallback — so the
 * guard is the single source of truth for time selection (a direct caller of
 * `evaluateFreshness`/`filterFresh` honors `asOf` identically to the adapter). An absent or
 * unparseable `asOf` falls back to `now`.
 *
 * Absence of a `freshness` descriptor on a reference means CURRENT (fresh) — so the guard can
 * never empty a pre-P4.7 corpus. Only present-and-bad metadata is guarded, fail-closed:
 *  - an unparseable timestamp on an enabled check counts as NOT fresh for that check;
 *  - a present-but-unrecognized `lifecycle` is treated as deprecated (dropped) when deprecation
 *    exclusion is enabled;
 *  - a non-positive / non-finite `maxAgeDays` is inert (staleness off) so a policy typo can
 *    never drop fresh content.
 */

import type {
  KnowledgeFreshnessPolicy,
  KnowledgeFreshnessVerdict,
  KnowledgeReference,
} from '@momentum/shared/runtime';

/** Effective policy with the P4.7 defaults applied. */
interface EffectiveFreshnessPolicy {
  excludeDeprecated: boolean;
  excludeSuperseded: boolean;
  excludeExpired: boolean;
  excludeNotYetEffective: boolean;
  /** Present only when a positive, finite value was supplied. */
  maxAgeDays?: number;
}

const MILLIS_PER_DAY = 24 * 60 * 60 * 1000;
const KNOWN_LIFECYCLES: readonly string[] = ['current', 'deprecated', 'superseded'];

function effectivePolicy(policy: KnowledgeFreshnessPolicy | undefined): EffectiveFreshnessPolicy {
  const maxAgeDays = policy?.maxAgeDays;
  return {
    excludeDeprecated: policy?.excludeDeprecated ?? true,
    excludeSuperseded: policy?.excludeSuperseded ?? true,
    excludeExpired: policy?.excludeExpired ?? true,
    excludeNotYetEffective: policy?.excludeNotYetEffective ?? true,
    // A non-positive / non-finite maxAgeDays is inert (off) — never corpus-emptying.
    maxAgeDays:
      typeof maxAgeDays === 'number' && Number.isFinite(maxAgeDays) && maxAgeDays > 0
        ? maxAgeDays
        : undefined,
  };
}

/** Parse an ISO timestamp, or null if absent/blank/invalid. */
function parseIso(value: string | undefined): number | null {
  if (typeof value !== 'string' || value.trim().length === 0) return null;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? null : time;
}

/**
 * Classify a reference against a freshness policy. The evaluation instant is `policy.asOf` when
 * valid, else `now`. First matching exclusion wins; a reference with no freshness metadata is
 * always `fresh`.
 */
export function evaluateFreshness(
  reference: KnowledgeReference,
  policy: KnowledgeFreshnessPolicy | undefined,
  now: Date,
): KnowledgeFreshnessVerdict {
  const freshness = reference.freshness;
  if (!freshness) return 'fresh';

  const effective = effectivePolicy(policy);
  const asOfMs = parseIso(policy?.asOf);
  const nowMs = asOfMs !== null ? asOfMs : now.getTime();

  if (effective.excludeDeprecated && freshness.lifecycle === 'deprecated') return 'deprecated';
  if (effective.excludeSuperseded && freshness.lifecycle === 'superseded') return 'superseded';
  // Present-but-unrecognized lifecycle → fail closed (treat as deprecated) when deprecation
  // exclusion is enabled. Cannot arise from typed callers; guards corrupt/untyped runtime data.
  if (
    effective.excludeDeprecated &&
    freshness.lifecycle !== undefined &&
    !KNOWN_LIFECYCLES.includes(freshness.lifecycle as string)
  ) {
    return 'deprecated';
  }

  if (effective.excludeExpired && freshness.expiresAt !== undefined) {
    const expiresMs = parseIso(freshness.expiresAt);
    // Unparseable expiry on an enabled check is treated conservatively as expired.
    if (expiresMs === null || nowMs > expiresMs) return 'expired';
  }

  if (effective.excludeNotYetEffective && freshness.effectiveAt !== undefined) {
    const effectiveMs = parseIso(freshness.effectiveAt);
    if (effectiveMs === null || nowMs < effectiveMs) return 'not_yet_effective';
  }

  if (effective.maxAgeDays !== undefined && freshness.updatedAt !== undefined) {
    const updatedMs = parseIso(freshness.updatedAt);
    if (updatedMs === null || nowMs - updatedMs > effective.maxAgeDays * MILLIS_PER_DAY) return 'stale';
  }

  return 'fresh';
}

export function isFresh(
  reference: KnowledgeReference,
  policy: KnowledgeFreshnessPolicy | undefined,
  now: Date,
): boolean {
  return evaluateFreshness(reference, policy, now) === 'fresh';
}

/** Keep only references that pass the freshness guard. */
export function filterFresh(
  references: readonly KnowledgeReference[],
  policy: KnowledgeFreshnessPolicy | undefined,
  now: Date,
): KnowledgeReference[] {
  return references.filter((reference) => isFresh(reference, policy, now));
}
