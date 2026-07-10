/**
 * Canonical model — `knowledge_retrieval_rollouts` (spec §21).
 *
 * A rollout record governs whether evolved knowledge is available to agents /
 * domains. Lane A persists it; it starts `retrievalReady:false` and only flips
 * once the readiness policy (Lane B) passes. `personal` domain is NOT eligible
 * for retrieval and the shared `KnowledgeRetrievalDomain` type already excludes
 * it (spec §21.2).
 */

import { KNOWLEDGE_EVOLUTION_COLLECTIONS } from '@momentum/shared/runtime';
import type { KnowledgeRetrievalRollout } from '@momentum/shared/runtime';
import {
  optionalDate,
  optionalString,
  optionalTeamMagnificentScope,
  requireBoolean,
  requireEnum,
  requireLanguage,
  requireNumber,
  requireString,
  result,
  type ValidationResult,
} from './validation.js';

export const KNOWLEDGE_RETRIEVAL_ROLLOUT_COLLECTION =
  KNOWLEDGE_EVOLUTION_COLLECTIONS.retrievalRollouts;

const AGENT_KEYS = ['steve_success', 'michael_magnificent', 'ivory'] as const;
const RETRIEVAL_DOMAINS = [
  'success',
  'training',
  'relationship',
  'performance',
  'organizational',
  'governance',
  'system',
] as const;

/** Immutable identity fields — a `$set` patch must never touch these. */
export const KNOWLEDGE_RETRIEVAL_ROLLOUT_PROTECTED_FIELDS = [
  'rolloutId',
  '_id',
  'evolutionId',
  'knowledgeObjectId',
  'tenantId',
] as const;

export function validateKnowledgeRetrievalRollout(
  doc: Partial<KnowledgeRetrievalRollout>,
): ValidationResult {
  const errors: string[] = [];

  requireString(errors, doc.rolloutId, 'rolloutId');
  requireString(errors, doc.evolutionId, 'evolutionId');
  requireString(errors, doc.knowledgeObjectId, 'knowledgeObjectId');
  requireNumber(errors, doc.version, 'version');

  requireString(errors, doc.tenantId, 'tenantId');
  optionalTeamMagnificentScope(errors, doc);

  requireLanguage(errors, doc.language);

  if (!Array.isArray(doc.availableToAgents)) {
    errors.push('availableToAgents must be an array');
  } else {
    doc.availableToAgents.forEach((agent, index) =>
      requireEnum(errors, agent, `availableToAgents[${index}]`, AGENT_KEYS),
    );
  }
  if (!Array.isArray(doc.availableToDomains)) {
    errors.push('availableToDomains must be an array');
  } else {
    doc.availableToDomains.forEach((domain, index) =>
      requireEnum(errors, domain, `availableToDomains[${index}]`, RETRIEVAL_DOMAINS),
    );
  }

  requireBoolean(errors, doc.retrievalReady, 'retrievalReady');
  optionalDate(errors, doc.readyAt, 'readyAt');
  optionalString(errors, doc.blockedReason, 'blockedReason');

  return result(errors);
}
