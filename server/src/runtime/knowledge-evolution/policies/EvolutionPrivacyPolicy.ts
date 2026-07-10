/**
 * Privacy Policy (spec §5.4 personal domain, §29.2).
 *
 * The `personal` domain sources the private Momentum Journal and is never organizational knowledge
 * by default. It may become active organizational guidance only through explicit selected-and-
 * approved promotion. This policy fails-closed on `personal`-domain activation unless the record
 * carries an explicit private-promotion approval signal. Pure function, no I/O.
 */

import type {
  KnowledgeApprovalReference,
  KnowledgeEvolutionAction,
  KnowledgeEvolutionDomain,
} from '@momentum/shared/runtime';
import { policyFail, policyOk, type PolicyResult } from '../errors.js';

/** Actions that put knowledge into (or keep it in) active organizational retrieval. */
const ACTIVATING_ACTIONS: readonly KnowledgeEvolutionAction[] = [
  'create_new_knowledge',
  'update_existing_knowledge',
  'create_language_variant',
  'supersede_existing_knowledge',
  'restore_prior_version',
];

export interface PrivacyPolicyInput {
  domain: KnowledgeEvolutionDomain;
  evolutionAction: KnowledgeEvolutionAction;
  approvalReference: KnowledgeApprovalReference;
  /**
   * Explicit promotion signal set by upstream review when a private journal entry was selected and
   * approved for organizational use. Sourced from `metadata.privatePromotionApproved`.
   */
  privatePromotionApproved?: boolean;
}

/**
 * Rejects activation of `personal`-domain knowledge unless it was explicitly promoted through
 * review. Non-personal domains always pass. Archival of personal knowledge is allowed (it removes
 * from retrieval and cannot leak new active guidance).
 */
export function evaluatePrivacy(input: PrivacyPolicyInput): PolicyResult {
  if (input.domain !== 'personal') {
    return policyOk;
  }

  if (!ACTIVATING_ACTIONS.includes(input.evolutionAction)) {
    return policyOk;
  }

  const promoted =
    input.privatePromotionApproved === true &&
    typeof input.approvalReference.sourceReviewRecordId === 'string' &&
    input.approvalReference.sourceReviewRecordId.trim().length > 0;

  if (promoted) {
    return policyOk;
  }

  return policyFail({
    errorType: 'permission_denied',
    reason:
      'Personal-domain (private journal) knowledge cannot be activated as organizational guidance without explicit selected-and-approved promotion (metadata.privatePromotionApproved + sourceReviewRecordId).',
    safeMessage: 'Knowledge evolution rejected: private knowledge requires approved promotion before activation.',
  });
}
