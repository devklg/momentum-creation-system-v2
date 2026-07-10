/**
 * Retrieval Readiness Policy (spec §21.1, §21.3).
 *
 * Retrieval stays BLOCKED until every required check passes: knowledge object exists, lifecycle is
 * active, governance permits use, an approval reference exists, a version record exists, source
 * traceability exists, Chroma indexing + Neo4j graph sync completed where required, language
 * metadata exists, permission scope exists, and Team Magnificent scope exists where applicable.
 * Pure function, no I/O. Returns the full set of blocking reasons (fail-closed, evaluate-all).
 */

import type { KnowledgeEvolutionCoordinationStatus } from '@momentum/shared/runtime';
import { policyFail, policyOk, type PolicyResult } from '../errors.js';

export interface RetrievalReadinessInput {
  knowledgeObjectExists: boolean;
  lifecycleActive: boolean;
  governancePermitsUse: boolean;
  approvalReferencePresent: boolean;
  versionRecordExists: boolean;
  sourceTraceabilityExists: boolean;
  /** `completed` or `not_required` unblock; `pending`/`failed` block. */
  indexingStatus: KnowledgeEvolutionCoordinationStatus;
  graphStatus: KnowledgeEvolutionCoordinationStatus;
  languageMetadataPresent: boolean;
  permissionScopePresent: boolean;
  teamScopeValid: boolean;
}

export interface RetrievalReadinessDecision {
  ready: boolean;
  blockedReasons: string[];
}

function coordinationSatisfied(status: KnowledgeEvolutionCoordinationStatus): boolean {
  return status === 'completed' || status === 'not_required';
}

/** Detailed decision — returns every reason retrieval is blocked (empty when ready). */
export function evaluateRetrievalReadiness(
  input: RetrievalReadinessInput,
): RetrievalReadinessDecision {
  const blockedReasons: string[] = [];

  if (!input.knowledgeObjectExists) blockedReasons.push('knowledge_object_missing');
  if (!input.lifecycleActive) blockedReasons.push('lifecycle_not_active');
  if (!input.governancePermitsUse) blockedReasons.push('governance_blocks_use');
  if (!input.approvalReferencePresent) blockedReasons.push('approval_reference_missing');
  if (!input.versionRecordExists) blockedReasons.push('version_record_missing');
  if (!input.sourceTraceabilityExists) blockedReasons.push('source_traceability_missing');
  if (!coordinationSatisfied(input.indexingStatus)) {
    blockedReasons.push(`chroma_indexing_${input.indexingStatus}`);
  }
  if (!coordinationSatisfied(input.graphStatus)) {
    blockedReasons.push(`neo4j_graph_sync_${input.graphStatus}`);
  }
  if (!input.languageMetadataPresent) blockedReasons.push('language_metadata_missing');
  if (!input.permissionScopePresent) blockedReasons.push('permission_scope_missing');
  if (!input.teamScopeValid) blockedReasons.push('team_scope_invalid');

  return { ready: blockedReasons.length === 0, blockedReasons };
}

/** Policy-result form for services that throw on a not-ready gate. */
export function assertRetrievalReadiness(input: RetrievalReadinessInput): PolicyResult {
  const decision = evaluateRetrievalReadiness(input);
  if (decision.ready) {
    return policyOk;
  }
  return policyFail({
    errorType: 'retrieval_rollout_failed',
    reason: `Retrieval not ready: ${decision.blockedReasons.join(', ')}.`,
    safeMessage: 'Knowledge evolution retrieval remains blocked until all readiness checks pass.',
    retryable: true,
  });
}
