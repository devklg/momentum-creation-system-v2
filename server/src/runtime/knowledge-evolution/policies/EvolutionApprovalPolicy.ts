/**
 * Approval Policy (spec §12.1, §15.2/§15.3, §29.1).
 *
 * Knowledge Evolution may begin only after a well-formed approval reference exists, and it must
 * never activate an unapproved candidate. This policy validates the approval reference shape and
 * the candidate→approval linkage for candidate-derived inputs. It does NOT approve knowledge — it
 * only verifies that approval already happened upstream. Pure function, no I/O.
 */

import type {
  KnowledgeApprovalReference,
  KnowledgeApprovalType,
  KnowledgeEvolutionInputType,
} from '@momentum/shared/runtime';
import { policyFail, policyOk, type PolicyResult } from '../errors.js';

const VALID_APPROVAL_TYPES: readonly KnowledgeApprovalType[] = [
  'review_workflow',
  'knowledge_session',
  'governance_decision',
  'admin_decision',
];

/**
 * Input types whose activation is the promotion of a reviewed knowledge candidate. For these the
 * record must carry at least one source candidate id — otherwise there is no approved candidate to
 * activate (spec §15.3 "candidate source is missing").
 */
const CANDIDATE_DERIVED_INPUT_TYPES: readonly KnowledgeEvolutionInputType[] = [
  'approved_candidate',
  'approved_translation',
  'approved_refinement',
];

export interface ApprovalPolicyInput {
  approvalReference: KnowledgeApprovalReference | undefined | null;
  inputType: KnowledgeEvolutionInputType;
  sourceCandidateIds: readonly string[];
}

function isValidReference(ref: KnowledgeApprovalReference): boolean {
  return (
    typeof ref.approvalId === 'string' &&
    ref.approvalId.trim().length > 0 &&
    typeof ref.approvedBy === 'string' &&
    ref.approvedBy.trim().length > 0 &&
    VALID_APPROVAL_TYPES.includes(ref.approvalType) &&
    ref.approvedAt instanceof Date &&
    !Number.isNaN(ref.approvedAt.getTime())
  );
}

export function evaluateApproval(input: ApprovalPolicyInput): PolicyResult {
  const ref = input.approvalReference;
  if (!ref || !isValidReference(ref)) {
    return policyFail({
      errorType: 'approval_missing',
      reason: `Evolution input ${input.inputType} has no valid approval reference.`,
      safeMessage: 'Knowledge evolution rejected: a valid approval reference is required.',
    });
  }

  if (
    CANDIDATE_DERIVED_INPUT_TYPES.includes(input.inputType) &&
    input.sourceCandidateIds.length === 0
  ) {
    return policyFail({
      errorType: 'candidate_not_approved',
      reason: `Candidate-derived input ${input.inputType} carries no source candidate id; the approved candidate cannot be traced.`,
      safeMessage: 'Knowledge evolution rejected: no approved candidate to activate.',
    });
  }

  return policyOk;
}

export function hasApprovalReference(
  ref: KnowledgeApprovalReference | undefined | null,
): boolean {
  return !!ref && isValidReference(ref);
}
