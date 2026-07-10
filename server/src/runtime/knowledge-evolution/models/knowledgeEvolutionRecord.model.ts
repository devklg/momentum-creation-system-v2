/**
 * Canonical model — `knowledge_evolution_records` (spec §11).
 *
 * The evolution record is the spine of the runtime: one row per approved
 * evolution request, carrying immutable identity + lineage and mutable
 * lifecycle/coordination status. Validation enforces the Team Magnificent scope,
 * a required approval reference, and the Lane-0 enum vocabulary.
 */

import {
  KNOWLEDGE_EVOLUTION_ACTIONS,
  KNOWLEDGE_EVOLUTION_COLLECTIONS,
  KNOWLEDGE_EVOLUTION_DOMAINS,
  KNOWLEDGE_EVOLUTION_INPUT_TYPES,
  KNOWLEDGE_EVOLUTION_STATUSES,
} from '@momentum/shared/runtime';
import type { KnowledgeEvolutionRecord } from '@momentum/shared/runtime';
import {
  optionalDate,
  optionalNumber,
  optionalString,
  requireApprovalReference,
  requireDate,
  requireEnum,
  requireLanguage,
  requireString,
  requireStringArray,
  requireTeamMagnificentScope,
  result,
  type ValidationResult,
} from './validation.js';

export const KNOWLEDGE_EVOLUTION_RECORD_COLLECTION = KNOWLEDGE_EVOLUTION_COLLECTIONS.records;

const COORDINATION_STATUSES = ['not_required', 'pending', 'completed', 'failed'] as const;
const RETRIEVAL_STATUSES = ['not_ready', 'ready', 'blocked', 'rolled_back'] as const;

/** Immutable identity + lineage fields — a `$set` patch must never touch these. */
export const KNOWLEDGE_EVOLUTION_RECORD_PROTECTED_FIELDS = [
  'evolutionId',
  '_id',
  'tenantId',
  'teamId',
  'teamKey',
  'teamName',
  'inputType',
  'inputId',
  'approvalReference',
  'sourceKnowledgeObjectIds',
  'sourceCandidateIds',
  'sourceOutcomeIds',
  'sourceLearningSignalIds',
  'sourceEventIds',
  'createdAt',
] as const;

export function validateKnowledgeEvolutionRecord(
  doc: Partial<KnowledgeEvolutionRecord>,
): ValidationResult {
  const errors: string[] = [];

  requireString(errors, doc.evolutionId, 'evolutionId');
  requireString(errors, doc.tenantId, 'tenantId');
  requireTeamMagnificentScope(errors, doc);
  optionalString(errors, doc.baId, 'baId');

  requireEnum(errors, doc.inputType, 'inputType', KNOWLEDGE_EVOLUTION_INPUT_TYPES);
  requireString(errors, doc.inputId, 'inputId');

  requireEnum(errors, doc.status, 'status', KNOWLEDGE_EVOLUTION_STATUSES);
  requireEnum(errors, doc.domain, 'domain', KNOWLEDGE_EVOLUTION_DOMAINS);
  requireLanguage(errors, doc.language);

  optionalString(errors, doc.targetKnowledgeObjectId, 'targetKnowledgeObjectId');

  requireStringArray(errors, doc.sourceKnowledgeObjectIds, 'sourceKnowledgeObjectIds');
  requireStringArray(errors, doc.sourceCandidateIds, 'sourceCandidateIds');
  requireStringArray(errors, doc.sourceOutcomeIds, 'sourceOutcomeIds');
  requireStringArray(errors, doc.sourceLearningSignalIds, 'sourceLearningSignalIds');
  requireStringArray(errors, doc.sourceEventIds, 'sourceEventIds');

  requireEnum(errors, doc.evolutionAction, 'evolutionAction', KNOWLEDGE_EVOLUTION_ACTIONS);
  optionalNumber(errors, doc.versionCreated, 'versionCreated');

  requireApprovalReference(errors, doc.approvalReference);

  requireEnum(errors, doc.indexingStatus, 'indexingStatus', COORDINATION_STATUSES);
  requireEnum(errors, doc.graphStatus, 'graphStatus', COORDINATION_STATUSES);
  requireEnum(errors, doc.retrievalStatus, 'retrievalStatus', RETRIEVAL_STATUSES);

  requireDate(errors, doc.createdAt, 'createdAt');
  requireDate(errors, doc.updatedAt, 'updatedAt');
  optionalDate(errors, doc.completedAt, 'completedAt');
  optionalDate(errors, doc.failedAt, 'failedAt');
  optionalString(errors, doc.failureReason, 'failureReason');

  return result(errors);
}
