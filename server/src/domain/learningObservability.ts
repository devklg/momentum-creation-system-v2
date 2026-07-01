/**
 * Learning observability domain (Phase 7 · P7.11).
 *
 * Computes AGGREGATE metrics over the persisted Phase 7 rungs — runtime audit
 * (R0), outcomes (R1), and learning candidates (R2) — for the admin surface.
 * P7.2 §5 / P7.5 §7: aggregate only, NEVER a manual review queue, never
 * `.com`-surfaced. No PII, no scoring/ranking of BAs or prospects.
 *
 * The aggregation is a PURE function of the records handed to it, so it is fully
 * deterministic and testable and carries no assumption about gateway count /
 * aggregate query semantics. Loading the records (via the existing admin read
 * surface) and mounting the read is the activation step — not done here.
 */

import type {
  AuditLogEntry,
  McsLearningObservabilitySnapshot,
  McsLearningCandidateRecord,
  McsOutcomeKind,
  McsOutcomeRecord,
} from '@momentum/shared';

const OUTCOME_KINDS: readonly McsOutcomeKind[] = [
  'pending',
  'enrolled_iii',
  'became_customer',
  'declined',
];

function emptyOutcomeCounts(): Record<McsOutcomeKind, number> {
  return OUTCOME_KINDS.reduce(
    (acc, kind) => {
      acc[kind] = 0;
      return acc;
    },
    {} as Record<McsOutcomeKind, number>,
  );
}

function rate(numerator: number, denominator: number): number {
  return denominator > 0 ? numerator / denominator : 0;
}

export interface McsLearningObservabilityInput {
  tenantId: string;
  generatedAt: string;
  runtimeAuditEntries: readonly AuditLogEntry[];
  outcomes: readonly McsOutcomeRecord[];
  candidates: readonly McsLearningCandidateRecord[];
}

/**
 * Pure aggregation. All inputs are assumed already tenant-scoped by the caller;
 * this function does not fetch, does not persist, and has no side effects.
 */
export function computeLearningObservabilitySnapshot(
  input: McsLearningObservabilityInput,
): McsLearningObservabilitySnapshot {
  // ── R0 runtime audit: gate allow/deny over the runtime.* action namespace ──
  let gateAllowed = 0;
  let gateDenied = 0;
  for (const entry of input.runtimeAuditEntries) {
    if (entry.action === 'runtime.gate.allowed') gateAllowed += 1;
    else if (entry.action === 'runtime.gate.denied') gateDenied += 1;
  }

  // ── R1 outcomes: distribution by kind ──
  const byKind = emptyOutcomeCounts();
  for (const outcome of input.outcomes) {
    if (outcome.kind in byKind) byKind[outcome.kind] += 1;
  }

  // ── R2 candidates: lifecycle distribution + approval rate ──
  let detected = 0;
  let approved = 0;
  let rejected = 0;
  for (const candidate of input.candidates) {
    if (candidate.status === 'approved') approved += 1;
    else if (candidate.status === 'rejected') rejected += 1;
    else if (candidate.status === 'detected' || candidate.status === 'in_review') detected += 1;
  }

  return {
    tenantId: input.tenantId,
    generatedAt: input.generatedAt,
    runtimeAudit: {
      total: input.runtimeAuditEntries.length,
      gateAllowed,
      gateDenied,
      gateDenyRate: rate(gateDenied, gateAllowed + gateDenied),
    },
    outcomes: {
      total: input.outcomes.length,
      byKind,
    },
    learningCandidates: {
      total: input.candidates.length,
      detected,
      approved,
      rejected,
      approvalRate: rate(approved, approved + rejected),
    },
  };
}
