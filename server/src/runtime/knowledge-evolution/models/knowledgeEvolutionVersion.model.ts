/**
 * Canonical model — `knowledge_evolution_versions` (spec §16).
 *
 * Version records are the immutable audit spine: one row per material change to
 * a Knowledge Object. They are APPEND-ONLY — the repository exposes no patch or
 * delete, and a duplicate `(knowledgeObjectId, version)` is rejected so a prior
 * version can never be overwritten.
 */

import { KNOWLEDGE_EVOLUTION_COLLECTIONS } from '@momentum/shared/runtime';
import type { KnowledgeEvolutionVersion } from '@momentum/shared/runtime';
import {
  isRecord,
  optionalNumber,
  requireDate,
  requireEnum,
  requireNumber,
  requireString,
  result,
  type ValidationResult,
} from './validation.js';

export const KNOWLEDGE_EVOLUTION_VERSION_COLLECTION = KNOWLEDGE_EVOLUTION_COLLECTIONS.versions;

const CHANGE_TYPES = [
  'created',
  'updated',
  'translated',
  'refined',
  'superseded',
  'archived',
  'restored',
] as const;

export function validateKnowledgeEvolutionVersion(
  doc: Partial<KnowledgeEvolutionVersion>,
): ValidationResult {
  const errors: string[] = [];

  requireString(errors, doc.versionRecordId, 'versionRecordId');
  requireString(errors, doc.knowledgeObjectId, 'knowledgeObjectId');
  requireNumber(errors, doc.version, 'version');
  if (typeof doc.version === 'number' && doc.version < 1) {
    errors.push('version must be >= 1');
  }
  optionalNumber(errors, doc.previousVersion, 'previousVersion');
  requireString(errors, doc.evolutionId, 'evolutionId');
  requireEnum(errors, doc.changeType, 'changeType', CHANGE_TYPES);

  if (doc.snapshotBefore !== undefined && !isRecord(doc.snapshotBefore)) {
    errors.push('snapshotBefore, when present, must be an object');
  }
  if (!isRecord(doc.snapshotAfter)) {
    errors.push('snapshotAfter must be an object');
  }

  requireString(errors, doc.reason, 'reason');
  requireString(errors, doc.approvedBy, 'approvedBy');
  requireDate(errors, doc.createdAt, 'createdAt');

  return result(errors);
}
