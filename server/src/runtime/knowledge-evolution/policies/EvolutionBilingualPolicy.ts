/**
 * Bilingual Policy (spec §22, §22.4, §29.4).
 *
 * English and Spanish are first-class runtime languages. Every evolution record must carry valid
 * language metadata, and unreviewed machine translation must never become active organizational
 * guidance. Pure function, no I/O.
 */

import {
  KNOWLEDGE_EVOLUTION_SUPPORTED_LANGUAGES,
  type KnowledgeEvolutionAction,
  type KnowledgeEvolutionInputType,
  type KnowledgeEvolutionLanguage,
  type KnowledgeLanguageTranslationStatus,
} from '@momentum/shared/runtime';
import { policyFail, policyOk, type PolicyResult } from '../errors.js';

/** Translation statuses that represent human-reviewed (safe-to-activate) variants. */
const REVIEWED_TRANSLATION_STATUSES: readonly KnowledgeLanguageTranslationStatus[] = [
  'human_reviewed',
  'approved',
  'active',
];

export interface BilingualPolicyInput {
  language: KnowledgeEvolutionLanguage | string | undefined | null;
  evolutionAction: KnowledgeEvolutionAction;
  inputType: KnowledgeEvolutionInputType;
  /** Present when the evolution creates/activates a translated variant. */
  translation?: {
    status?: KnowledgeLanguageTranslationStatus;
    machineTranslated?: boolean;
  };
}

function isSupportedLanguage(value: unknown): value is KnowledgeEvolutionLanguage {
  return (
    typeof value === 'string' &&
    (KNOWLEDGE_EVOLUTION_SUPPORTED_LANGUAGES as readonly string[]).includes(value)
  );
}

function isTranslationEvolution(input: BilingualPolicyInput): boolean {
  return (
    input.evolutionAction === 'create_language_variant' ||
    input.inputType === 'approved_translation'
  );
}

export function evaluateBilingual(input: BilingualPolicyInput): PolicyResult {
  if (!isSupportedLanguage(input.language)) {
    return policyFail({
      errorType: 'invalid_language',
      reason: `Missing or unsupported language metadata (language=${String(input.language)}). Supported: ${KNOWLEDGE_EVOLUTION_SUPPORTED_LANGUAGES.join(', ')}.`,
      safeMessage: 'Knowledge evolution rejected: valid language metadata (en/es) is required.',
    });
  }

  if (isTranslationEvolution(input)) {
    const translation = input.translation;
    if (!translation || translation.status === undefined) {
      return policyFail({
        errorType: 'invalid_language',
        reason: `Translation evolution (${input.evolutionAction}/${input.inputType}) is missing translation review metadata.`,
        safeMessage: 'Knowledge evolution rejected: translation review metadata is required for a language variant.',
      });
    }

    const reviewed = REVIEWED_TRANSLATION_STATUSES.includes(translation.status);
    if (translation.machineTranslated === true && !reviewed) {
      return policyFail({
        errorType: 'invalid_language',
        reason: `Unreviewed machine translation (status=${translation.status}) cannot become active organizational guidance.`,
        safeMessage: 'Knowledge evolution rejected: unreviewed machine translation cannot be activated.',
      });
    }

    if (!reviewed) {
      return policyFail({
        errorType: 'invalid_language',
        reason: `Translation status ${translation.status} is not human-reviewed/approved/active.`,
        safeMessage: 'Knowledge evolution rejected: a translation must be human-reviewed before activation.',
      });
    }
  }

  return policyOk;
}
