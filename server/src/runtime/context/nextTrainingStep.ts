/**
 * Next Training Step Resolution (Phase 4 — P4.10, final slice).
 *
 * The capstone of Phase 4: resolve the agent's next training step over the approved-knowledge
 * retrieval path. It SELECTS among approved references — it never generates. A step is a
 * content-free pointer (identifiers + position); a degraded/empty retrieval yields `unavailable`
 * plus the P4.9 safe fallback, never a guessed step.
 *
 * Pure and deterministic: no clock, no I/O, no persistence, no LLM, no Gateway. It assembles no
 * packet (the Context Manager remains the sole assembler).
 *
 * PRECONDITION: `result` must be the COMPLETE approved sequence for the objective. Do NOT set
 * `maxResults` on the retrieval request used for training-step resolution — the resolver treats
 * `result.references` as the entire sequence, so a truncated window would masquerade as a
 * completed sequence (false `all_completed`, wrong `totalSteps`). Progress requires the whole
 * sequence. Duplicate `knowledgeId`s in the result are de-duplicated (first occurrence wins) so
 * counts and position are per distinct approved item.
 */

import type {
  McsApprovedKnowledgeQueryResult,
  McsDegradedContextState,
  McsKnowledgeDomain,
  McsKnowledgeId,
  McsKnowledgeReference,
  McsRuntimeLanguage,
  McsSourceId,
} from '@momentum/shared/runtime';
import { resolveSafeFallbackState, safeFallbackFromResult } from './safeFallback.js';

export type NextTrainingStepStatus = 'resolved' | 'all_completed' | 'unavailable';

export type NextTrainingStepReasonCode = 'next_uncompleted' | 'all_completed' | 'no_approved_knowledge';

/** A content-free pointer to the next approved step — identifiers and position only. */
export interface NextTrainingStep {
  knowledgeId: McsKnowledgeId;
  sourceId: McsSourceId;
  domain: McsKnowledgeDomain;
  language: McsRuntimeLanguage;
  /** 0-based position in the approved sequence. */
  stepIndex: number;
  totalSteps: number;
}

export interface NextTrainingStepResolution {
  status: NextTrainingStepStatus;
  reasonCode: NextTrainingStepReasonCode;
  step?: NextTrainingStep;
  /** Completed items that are present in the approved sequence. */
  completedCount: number;
  /** Approved items in the sequence. */
  totalCount: number;
  /** Present iff `status === 'unavailable'`. */
  safeFallback?: McsDegradedContextState;
}

export interface NextTrainingStepInput {
  result: McsApprovedKnowledgeQueryResult;
  completedKnowledgeIds?: readonly McsKnowledgeId[];
}

/** The P4.9 safe fallback for a degraded (or defensively empty-ok) retrieval. */
function unavailableFallback(result: McsApprovedKnowledgeQueryResult): McsDegradedContextState {
  const bridged = safeFallbackFromResult(result);
  if (bridged) return bridged.degraded;
  // Defensive: an `ok` result with zero references cannot arise from the adapter, but a pure
  // resolver must still fail closed — treat it as no approved match.
  const languageMetadata = result.metadata.language;
  return resolveSafeFallbackState({
    degradeReasons: ['no_approved_match'],
    requestedLanguage: languageMetadata.language,
    ...(languageMetadata.fallbackLanguage !== undefined
      ? { fallbackLanguage: languageMetadata.fallbackLanguage }
      : {}),
  });
}

/** De-duplicate references by `knowledgeId` (first occurrence wins) → the distinct sequence. */
function distinctSequence(references: readonly McsKnowledgeReference[]): McsKnowledgeReference[] {
  const seen = new Set<McsKnowledgeId>();
  const sequence: McsKnowledgeReference[] = [];
  for (const reference of references) {
    if (seen.has(reference.knowledgeId)) continue;
    seen.add(reference.knowledgeId);
    sequence.push(reference);
  }
  return sequence;
}

/**
 * Resolve the next training step over the approved knowledge in `result`, given what the BA has
 * already completed. Deterministic: first uncompleted reference in retrieval (curator) order, over
 * the distinct approved sequence. See the PRECONDITION in the module header — `result` must be the
 * complete (un-truncated) approved sequence.
 */
export function resolveNextTrainingStep(input: NextTrainingStepInput): NextTrainingStepResolution {
  const { result } = input;

  if (result.status === 'degraded' || result.references.length === 0) {
    return {
      status: 'unavailable',
      reasonCode: 'no_approved_knowledge',
      completedCount: 0,
      totalCount: 0,
      safeFallback: unavailableFallback(result),
    };
  }

  const sequence = distinctSequence(result.references);
  const completed = new Set(input.completedKnowledgeIds ?? []);
  const totalCount = sequence.length;
  const completedCount = sequence.reduce(
    (count, reference) => (completed.has(reference.knowledgeId) ? count + 1 : count),
    0,
  );

  const nextIndex = sequence.findIndex((reference) => !completed.has(reference.knowledgeId));
  if (nextIndex === -1) {
    return { status: 'all_completed', reasonCode: 'all_completed', completedCount, totalCount };
  }

  const reference = sequence[nextIndex]!;
  return {
    status: 'resolved',
    reasonCode: 'next_uncompleted',
    step: {
      knowledgeId: reference.knowledgeId,
      sourceId: reference.sourceId,
      domain: reference.domain,
      language: reference.language,
      stepIndex: nextIndex,
      totalSteps: totalCount,
    },
    completedCount,
    totalCount,
  };
}
