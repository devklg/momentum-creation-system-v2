/**
 * Approved-Knowledge Safe Fallback Upgrade (Phase 4 — P4.9).
 *
 * Maps a fail-closed retrieval degrade (`ApprovedKnowledgeQueryDegradeReason`) into a specific,
 * safe, compliant packet `DegradedContextState`. It replaces the one-size generic instruction
 * with reason-aware guidance so the agent is told WHY retrieval degraded and WHAT is safe to do
 * — proceed on identity/rules, ask a clarifying question, or offer the other language (never
 * present a machine translation as approved).
 *
 * Pure and deterministic: no clock, no I/O, no persistence, no Gateway, no LLM. Every string is
 * a fixed safe directive with only the language name interpolated — content-free, and never
 * re-introduces knowledge into a degraded (empty-approved-knowledge) packet.
 */

import type {
  ApprovedKnowledgeQueryDegradeReason,
  ApprovedKnowledgeQueryResult,
  DegradedContextReason,
  DegradedContextState,
  RuntimeLanguage,
} from '@momentum/shared/runtime';
import { otherLanguage } from './languageAwareRetrieval.js';

export interface SafeFallbackInput {
  degradeReasons: readonly ApprovedKnowledgeQueryDegradeReason[];
  requestedLanguage: RuntimeLanguage;
  fallbackLanguage?: RuntimeLanguage;
}

export const SAFE_FALLBACK_BASE_DIRECTIVE =
  'Proceed only with packet identity, runtime rules, guardrails, and clarifying questions; do not infer or fabricate missing knowledge.';

/**
 * Priority/order of retrieval reasons. A `Record` keyed by the union makes this exhaustive at
 * compile time — adding a new `ApprovedKnowledgeQueryDegradeReason` is a type error here until it
 * is given an order, so the mapping can never silently drop a reason.
 */
const REASON_PRIORITY: Record<ApprovedKnowledgeQueryDegradeReason, number> = {
  knowledge_unavailable: 0,
  no_approved_match: 1,
  language_unavailable: 2,
  scope_empty: 3,
  retrieval_timeout: 4,
};

/** The distinct reasons in stable priority order (keys are unique — no dedup needed). */
const ORDERED_REASONS: readonly ApprovedKnowledgeQueryDegradeReason[] = (
  Object.keys(REASON_PRIORITY) as ApprovedKnowledgeQueryDegradeReason[]
).sort((a, b) => REASON_PRIORITY[a] - REASON_PRIORITY[b]);

function languageName(language: RuntimeLanguage): string {
  return language === 'es' ? 'Spanish' : 'English';
}

interface FallbackFragment {
  packetReason: DegradedContextReason;
  guidance: string;
}

function fragmentFor(
  reason: ApprovedKnowledgeQueryDegradeReason,
  input: SafeFallbackInput,
): FallbackFragment {
  switch (reason) {
    case 'knowledge_unavailable':
      return {
        packetReason: 'knowledge_unavailable',
        guidance: 'The approved knowledge base could not be reached; proceed on identity, rules, and guardrails only.',
      };
    case 'no_approved_match':
      return {
        packetReason: 'knowledge_unavailable',
        guidance: 'No approved knowledge matched this objective; ask a clarifying question to narrow the need — do not fabricate an answer.',
      };
    case 'language_unavailable': {
      const requested = languageName(input.requestedLanguage);
      const offer = input.fallbackLanguage
        ? `ask the Brand Ambassador whether to continue in ${languageName(input.fallbackLanguage)} or rephrase`
        : 'ask the Brand Ambassador to rephrase or try another language';
      return {
        packetReason: 'translation_unavailable',
        guidance: `Approved knowledge is not available in ${requested}; ${offer} — never present a machine translation as approved.`,
      };
    }
    case 'scope_empty':
      return {
        packetReason: 'knowledge_unavailable',
        guidance: 'No approved knowledge is scoped to this team or Brand Ambassador yet; proceed on identity and rules, and invite the BA to add knowledge.',
      };
    case 'retrieval_timeout':
      return {
        packetReason: 'retrieval_timeout',
        guidance: 'Retrieval timed out; proceed safely on identity and rules — the Brand Ambassador may retry shortly.',
      };
  }
}

/**
 * Resolve a reason-specific, safe, compliant degraded state. Never empty: unknown/empty input
 * degrades safely to `knowledge_unavailable` + the base directive.
 */
export function resolveSafeFallbackState(input: SafeFallbackInput): DegradedContextState {
  const orderedReasons = ORDERED_REASONS.filter((reason) => input.degradeReasons.includes(reason));

  if (orderedReasons.length === 0) {
    return {
      reasons: ['knowledge_unavailable'],
      safeFallbackInstruction: SAFE_FALLBACK_BASE_DIRECTIVE,
      missingSections: ['approvedKnowledge'],
    };
  }

  const fragments = orderedReasons.map((reason) => fragmentFor(reason, input));
  const packetReasons: DegradedContextReason[] = [];
  for (const fragment of fragments) {
    if (!packetReasons.includes(fragment.packetReason)) packetReasons.push(fragment.packetReason);
  }

  return {
    reasons: packetReasons,
    safeFallbackInstruction: [SAFE_FALLBACK_BASE_DIRECTIVE, ...fragments.map((fragment) => fragment.guidance)].join(' '),
    missingSections: ['approvedKnowledge'],
  };
}

export interface SafeFallbackPacketInput {
  packetStatus: 'degraded';
  degraded: DegradedContextState;
}

/**
 * Bridge: derive the `{ packetStatus, degraded }` to spread into `buildContextPacket` input from
 * a degraded `approved_knowledge_query.v1` result. Returns `null` for an `ok` result.
 */
export function safeFallbackFromResult(
  result: ApprovedKnowledgeQueryResult,
): SafeFallbackPacketInput | null {
  if (result.status === 'ok') return null;
  const languageMetadata = result.metadata.language;
  const degradeReasons = result.metadata.degradeReasons ?? [];
  // A `language_unavailable` degrade means approved content existed in the OTHER supported
  // language (that is what distinguishes it from `no_approved_match`), so we can concretely offer
  // it — otherwise carry any fallback language the result already recorded.
  const fallbackLanguage =
    languageMetadata.fallbackLanguage ??
    (degradeReasons.includes('language_unavailable') ? otherLanguage(languageMetadata.language) : undefined);
  const input: SafeFallbackInput = {
    degradeReasons,
    requestedLanguage: languageMetadata.language,
    ...(fallbackLanguage !== undefined ? { fallbackLanguage } : {}),
  };
  return { packetStatus: 'degraded', degraded: resolveSafeFallbackState(input) };
}
