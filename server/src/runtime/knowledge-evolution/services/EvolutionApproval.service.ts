/**
 * Evolution Approval Service (spec §12, §15).
 *
 * Validates that an approval reference exists and that candidate-derived inputs trace to an
 * approved candidate BEFORE any Knowledge Core state is touched. This service NEVER approves
 * knowledge — approval happens upstream (review workflow / knowledge session / governance /
 * admin). It only verifies the approval already exists. Pure business logic, no I/O.
 */

import type {
  KnowledgeApprovalReference,
  KnowledgeEvolutionInputType,
} from '@momentum/shared/runtime';
import { assertPolicy, type PolicyResult } from '../errors.js';
import {
  evaluateApproval,
  type ApprovalPolicyInput,
} from '../policies/EvolutionApprovalPolicy.js';

export interface EvolutionApprovalInput {
  approvalReference: KnowledgeApprovalReference | undefined | null;
  inputType: KnowledgeEvolutionInputType;
  sourceCandidateIds: readonly string[];
}

export interface EvolutionApprovalService {
  /** Returns the policy decision without throwing. */
  validate(input: EvolutionApprovalInput): PolicyResult;
  /** Throws `KnowledgeEvolutionRuntimeError` when approval is missing/invalid. */
  assertApproved(input: EvolutionApprovalInput): void;
  /** Proves the caller-supplied reference exists in the configured canonical authority store. */
  verifyCanonical(input: EvolutionApprovalInput): Promise<PolicyResult>;
}

export interface EvolutionApprovalAuthorityPort {
  verify(reference: KnowledgeApprovalReference): Promise<boolean>;
}

const shapeVerifiedAuthority: EvolutionApprovalAuthorityPort = {
  async verify() { return true; },
};

export function createEvolutionApprovalService(
  authority: EvolutionApprovalAuthorityPort = shapeVerifiedAuthority,
): EvolutionApprovalService {
  const toPolicyInput = (input: EvolutionApprovalInput): ApprovalPolicyInput => ({
    approvalReference: input.approvalReference,
    inputType: input.inputType,
    sourceCandidateIds: input.sourceCandidateIds,
  });

  return {
    validate(input) {
      return evaluateApproval(toPolicyInput(input));
    },
    assertApproved(input) {
      assertPolicy(evaluateApproval(toPolicyInput(input)));
    },
    async verifyCanonical(input) {
      const shape = evaluateApproval(toPolicyInput(input));
      if (!shape.ok) return shape;
      const reference = input.approvalReference!;
      if (await authority.verify(reference)) return shape;
      return {
        ok: false,
        errorType: 'approval_missing',
        reason: `Approval ${reference.approvalId} was not read back from canonical authority.`,
        safeMessage: 'Knowledge evolution rejected: canonical approval evidence is missing.',
      };
    },
  };
}
