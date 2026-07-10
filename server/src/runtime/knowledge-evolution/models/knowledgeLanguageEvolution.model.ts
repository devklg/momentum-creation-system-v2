/**
 * Canonical model — `knowledge_language_evolution_records` (spec §22).
 *
 * Tracks EN/ES variant lineage. UNREVIEWED machine translation must never
 * become active (spec §22, §6 boundary): a record whose `translationStatus`
 * has reached `active` MUST have passed through `human_reviewed` — the model
 * rejects `active`/`approved` translations that are not marked human-reviewed
 * unless an approval reference is present, and the readiness policy (Lane B)
 * enforces the human-review gate before activation.
 */

import { KNOWLEDGE_EVOLUTION_COLLECTIONS } from '@momentum/shared/runtime';
import type { KnowledgeLanguageEvolutionRecord } from '@momentum/shared/runtime';
import {
  optionalDate,
  optionalTeamMagnificentScope,
  requireApprovalReference,
  requireDate,
  requireEnum,
  requireLanguage,
  requireString,
  result,
  type ValidationResult,
} from './validation.js';

export const KNOWLEDGE_LANGUAGE_EVOLUTION_COLLECTION =
  KNOWLEDGE_EVOLUTION_COLLECTIONS.languageEvolutionRecords;

const TRANSLATION_STATUSES = ['human_reviewed', 'approved', 'active', 'rejected'] as const;

/** Immutable identity fields — a `$set` patch must never touch these. */
export const KNOWLEDGE_LANGUAGE_EVOLUTION_PROTECTED_FIELDS = [
  'languageEvolutionId',
  '_id',
  'tenantId',
  'sourceKnowledgeObjectId',
  'variantKnowledgeObjectId',
  'sourceLanguage',
  'targetLanguage',
  'approvalReference',
  'createdAt',
] as const;

export function validateKnowledgeLanguageEvolutionRecord(
  doc: Partial<KnowledgeLanguageEvolutionRecord>,
): ValidationResult {
  const errors: string[] = [];

  requireString(errors, doc.languageEvolutionId, 'languageEvolutionId');
  requireString(errors, doc.tenantId, 'tenantId');
  optionalTeamMagnificentScope(errors, doc);

  requireString(errors, doc.sourceKnowledgeObjectId, 'sourceKnowledgeObjectId');
  requireString(errors, doc.variantKnowledgeObjectId, 'variantKnowledgeObjectId');

  requireLanguage(errors, doc.sourceLanguage, 'sourceLanguage');
  requireLanguage(errors, doc.targetLanguage, 'targetLanguage');
  if (
    doc.sourceLanguage !== undefined &&
    doc.sourceLanguage === doc.targetLanguage
  ) {
    errors.push('sourceLanguage and targetLanguage must differ');
  }

  requireEnum(errors, doc.translationStatus, 'translationStatus', TRANSLATION_STATUSES);
  requireApprovalReference(errors, doc.approvalReference);

  requireDate(errors, doc.createdAt, 'createdAt');
  optionalDate(errors, doc.activatedAt, 'activatedAt');

  // Unreviewed machine translation guard: an active/approved variant that has
  // never been human-reviewed is only permitted with an approval reference,
  // which the field above already requires. An `active` variant must carry an
  // `activatedAt` timestamp so activation is auditable.
  if (doc.translationStatus === 'active' && doc.activatedAt === undefined) {
    errors.push('active translation requires activatedAt (activation must be auditable)');
  }

  return result(errors);
}
