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
}

export function createEvolutionApprovalService(): EvolutionApprovalService {
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
  };
}
