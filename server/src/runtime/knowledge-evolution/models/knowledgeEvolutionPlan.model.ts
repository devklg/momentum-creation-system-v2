/**
 * Canonical model — `knowledge_evolution_plans` (spec §13).
 *
 * A plan is created BEFORE any Knowledge Core state changes and enumerates the
 * required steps. Lane A validates structure only; step execution is Lane B/D.
 */

import {
  KNOWLEDGE_EVOLUTION_COLLECTIONS,
  KNOWLEDGE_EVOLUTION_PLAN_ACTIONS,
} from '@momentum/shared/runtime';
import type {
  KnowledgeEvolutionPlan,
  KnowledgeEvolutionStep,
} from '@momentum/shared/runtime';
import {
  isRecord,
  optionalString,
  requireBoolean,
  requireDate,
  requireEnum,
  requireLanguage,
  requireString,
  requireStringArray,
  requireTeamMagnificentScope,
  result,
  type ValidationResult,
} from './validation.js';

export const KNOWLEDGE_EVOLUTION_PLAN_COLLECTION = KNOWLEDGE_EVOLUTION_COLLECTIONS.plans;

const STEP_KEYS = [
  'validate_approval',
  'validate_sources',
  'validate_permissions',
  'create_version',
  'write_knowledge_object',
  'mark_superseded',
  'archive_knowledge',
  'create_language_variant',
  'reindex_chroma',
  'sync_neo4j',
  'mark_retrieval_ready',
  'emit_events',
  'monitor_outcomes',
] as const;

const STEP_STATUSES = ['pending', 'running', 'completed', 'failed', 'skipped'] as const;

/** Immutable identity fields — a `$set` patch must never touch these. */
export const KNOWLEDGE_EVOLUTION_PLAN_PROTECTED_FIELDS = [
  'planId',
  '_id',
  'evolutionId',
  'tenantId',
  'teamId',
  'teamKey',
  'teamName',
  'createdAt',
] as const;

function validateStep(errors: string[], step: unknown, index: number): void {
  if (!isRecord(step)) {
    errors.push(`requiredSteps[${index}] must be a step object`);
    return;
  }
  const s = step as Partial<KnowledgeEvolutionStep>;
  requireEnum(errors, s.stepKey, `requiredSteps[${index}].stepKey`, STEP_KEYS);
  requireBoolean(errors, s.required, `requiredSteps[${index}].required`);
  requireEnum(errors, s.status, `requiredSteps[${index}].status`, STEP_STATUSES);
}

export function validateKnowledgeEvolutionPlan(
  doc: Partial<KnowledgeEvolutionPlan>,
): ValidationResult {
  const errors: string[] = [];

  requireString(errors, doc.planId, 'planId');
  requireString(errors, doc.evolutionId, 'evolutionId');
  requireString(errors, doc.tenantId, 'tenantId');
  requireTeamMagnificentScope(errors, doc);

  requireEnum(errors, doc.action, 'action', KNOWLEDGE_EVOLUTION_PLAN_ACTIONS);
  optionalString(errors, doc.targetKnowledgeObjectId, 'targetKnowledgeObjectId');

  requireStringArray(errors, doc.sourceKnowledgeObjectIds, 'sourceKnowledgeObjectIds');
  requireStringArray(errors, doc.sourceCandidateIds, 'sourceCandidateIds');

  if (!Array.isArray(doc.requiredSteps)) {
    errors.push('requiredSteps must be an array of steps');
  } else {
    doc.requiredSteps.forEach((step, index) => validateStep(errors, step, index));
  }

  requireStringArray(errors, doc.riskFlags, 'riskFlags');
  requireLanguage(errors, doc.language);

  requireBoolean(errors, doc.requiresReindex, 'requiresReindex');
  requireBoolean(errors, doc.requiresGraphSync, 'requiresGraphSync');
  requireBoolean(errors, doc.affectsRetrieval, 'affectsRetrieval');

  requireDate(errors, doc.createdAt, 'createdAt');

  return result(errors);
}
