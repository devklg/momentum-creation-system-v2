/**
 * Canonical model — `knowledge_supersession_records` (spec §17).
 *
 * A supersession record links an old Knowledge Object to the new one that
 * replaces it. Superseded knowledge remains STORED and auditable (spec §17,
 * §29) — these records are append-only and the old object is never deleted.
 */

import { KNOWLEDGE_EVOLUTION_COLLECTIONS } from '@momentum/shared/runtime';
import type { KnowledgeSupersessionRecord } from '@momentum/shared/runtime';
import {
  requireApprovalReference,
  requireDate,
  requireString,
  requireTeamMagnificentScope,
  result,
  type ValidationResult,
} from './validation.js';

export const KNOWLEDGE_SUPERSESSION_COLLECTION =
  KNOWLEDGE_EVOLUTION_COLLECTIONS.supersessionRecords;

export function validateKnowledgeSupersessionRecord(
  doc: Partial<KnowledgeSupersessionRecord>,
): ValidationResult {
  const errors: string[] = [];

  requireString(errors, doc.supersessionId, 'supersessionId');
  requireString(errors, doc.tenantId, 'tenantId');
  requireTeamMagnificentScope(errors, doc);

  requireString(errors, doc.oldKnowledgeObjectId, 'oldKnowledgeObjectId');
  requireString(errors, doc.newKnowledgeObjectId, 'newKnowledgeObjectId');
  if (
    typeof doc.oldKnowledgeObjectId === 'string' &&
    doc.oldKnowledgeObjectId === doc.newKnowledgeObjectId
  ) {
    errors.push('oldKnowledgeObjectId and newKnowledgeObjectId must differ');
  }

  requireString(errors, doc.reason, 'reason');
  requireApprovalReference(errors, doc.approvalReference);
  requireDate(errors, doc.supersededAt, 'supersededAt');
  requireString(errors, doc.supersededBy, 'supersededBy');

  return result(errors);
}
