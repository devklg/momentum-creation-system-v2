/**
 * Language-Aware Retrieval resolver (Phase 4 — P4.6).
 *
 * Activates the `allowLanguageFallback` flag carried by `approved_knowledge_query.v1` since
 * P4.2. Operates on references the adapter has ALREADY status/domain-filtered — it makes no
 * store call, imports no client, and NEVER translates text. It only SELECTS among pre-existing
 * approved references and MARKS an honest `RuntimeLanguageMetadata`, following the locked
 * priority ladder (runtime/CONTEXT_PACKET_SCHEMA.md §14.2/§14.3):
 *
 *   native → human-reviewed translation → MARKED machine translation → language-neutral
 *   template → (fail-closed / ask-clarify).
 *
 * The ladder is applied WITHIN each language, preferring the primary language over the fallback
 * language. Each returned batch is a single homogeneous quality tier, so the batch marking and
 * every reference's own `translationStatus` agree.
 *
 * Non-negotiable invariants:
 *  - A machine translation is ALWAYS marked (`machine_translation_marked` +
 *    `machineTranslationUsed: true`) and is NEVER re-stamped native — even when it is already in
 *    the primary language (an MT *into* en is still an MT, not `same_language`).
 *  - `clarification_required` items are never deliverable — they fail closed (the ask-clarify
 *    tier), in the primary language as well as the fallback language.
 *  - A degraded selection carries ZERO references (never substituted).
 */

import type {
  ApprovedKnowledgeQueryRequest,
  KnowledgeReference,
  RuntimeLanguage,
  RuntimeLanguageFallbackReason,
  RuntimeLanguageMetadata,
  RuntimeTranslationStatus,
} from '@momentum/shared/runtime';

export type LanguageSelectionDegradeReason = 'language_unavailable';

export interface LanguageSelection {
  status: 'ok' | 'degraded';
  /** Selected references — a single homogeneous quality tier. Empty when degraded (fail-closed). */
  references: KnowledgeReference[];
  /** Honest language metadata describing the delivered batch. */
  language: RuntimeLanguageMetadata;
  /** Present only when degraded. */
  degradeReason?: LanguageSelectionDegradeReason;
  /** Whether a fallback language tier was used (false for primary-language and degraded). */
  fallbackUsed: boolean;
}

/** The other supported runtime language (en↔es). */
export function otherLanguage(language: RuntimeLanguage): RuntimeLanguage {
  return language === 'en' ? 'es' : 'en';
}

/** `clarification_required` is never deliverable — it is the ask-clarify / fail-closed tier. */
function isDeliverable(reference: KnowledgeReference): boolean {
  return reference.translationStatus !== 'clarification_required';
}

interface QualityTier {
  references: KnowledgeReference[];
  translationStatus: RuntimeTranslationStatus;
  machineTranslationUsed: boolean;
  humanReviewed: boolean;
}

/**
 * Pick the single highest-quality homogeneous tier among references that are ALL in one
 * language: native (`same_language`/`not_required`) → human-reviewed translation → MARKED
 * machine translation → language-neutral template. Returns null when nothing is deliverable.
 */
function pickQualityTier(sameLanguageReferences: readonly KnowledgeReference[]): QualityTier | null {
  const native = sameLanguageReferences.filter(
    (reference) => reference.translationStatus === 'same_language' || reference.translationStatus === 'not_required',
  );
  if (native.length > 0) {
    return { references: native, translationStatus: 'same_language', machineTranslationUsed: false, humanReviewed: true };
  }

  const human = sameLanguageReferences.filter(
    (reference) => reference.translationStatus === 'human_reviewed_translation',
  );
  if (human.length > 0) {
    return { references: human, translationStatus: 'human_reviewed_translation', machineTranslationUsed: false, humanReviewed: true };
  }

  // MARKED machine translation — always machineTranslationUsed:true, never re-stamped native.
  const machine = sameLanguageReferences.filter(
    (reference) => reference.translationStatus === 'machine_translation_marked',
  );
  if (machine.length > 0) {
    return { references: machine, translationStatus: 'machine_translation_marked', machineTranslationUsed: true, humanReviewed: false };
  }

  const neutral = sameLanguageReferences.filter(
    (reference) => reference.translationStatus === 'language_neutral_template',
  );
  if (neutral.length > 0) {
    return { references: neutral, translationStatus: 'language_neutral_template', machineTranslationUsed: false, humanReviewed: false };
  }

  return null;
}

function primaryMetadata(primary: RuntimeLanguage, tier: QualityTier): RuntimeLanguageMetadata {
  return {
    language: primary,
    translationStatus: tier.translationStatus,
    machineTranslationUsed: tier.machineTranslationUsed,
    humanReviewed: tier.humanReviewed,
  };
}

function fallbackReasonFor(translationStatus: RuntimeTranslationStatus): RuntimeLanguageFallbackReason {
  if (translationStatus === 'machine_translation_marked') return 'machine_translation_marked';
  if (translationStatus === 'language_neutral_template') return 'language_neutral_template';
  return 'same_language_unavailable';
}

function fallbackMetadata(
  primary: RuntimeLanguage,
  fallbackLanguage: RuntimeLanguage,
  tier: QualityTier,
): RuntimeLanguageMetadata {
  return {
    language: primary,
    fallbackLanguage,
    fallbackReason: fallbackReasonFor(tier.translationStatus),
    translationStatus: tier.translationStatus,
    machineTranslationUsed: tier.machineTranslationUsed,
    humanReviewed: tier.humanReviewed,
  };
}

function degraded(primary: RuntimeLanguage): LanguageSelection {
  return {
    status: 'degraded',
    references: [],
    language: {
      language: primary,
      translationStatus: 'same_language',
      machineTranslationUsed: false,
      humanReviewed: true,
    },
    degradeReason: 'language_unavailable',
    fallbackUsed: false,
  };
}

/**
 * Resolve the language selection over already status/domain-filtered approved references.
 * `kept` MUST already exclude non-approved and out-of-domain items — this resolver only
 * decides language/quality tiers.
 */
export function resolveLanguageSelection(
  kept: readonly KnowledgeReference[],
  request: ApprovedKnowledgeQueryRequest,
): LanguageSelection {
  const primary = request.language;
  const deliverable = kept.filter(isDeliverable);

  // Primary language, best available quality tier — wins over any fallback.
  const primaryTier = pickQualityTier(deliverable.filter((reference) => reference.language === primary));
  if (primaryTier) {
    return { status: 'ok', references: primaryTier.references, language: primaryMetadata(primary, primaryTier), fallbackUsed: false };
  }

  if (request.allowLanguageFallback !== true) {
    return degraded(primary);
  }

  const fallback = otherLanguage(primary);
  const fallbackTier = pickQualityTier(deliverable.filter((reference) => reference.language === fallback));
  if (!fallbackTier) {
    return degraded(primary);
  }

  return {
    status: 'ok',
    references: fallbackTier.references,
    language: fallbackMetadata(primary, fallback, fallbackTier),
    fallbackUsed: true,
  };
}
