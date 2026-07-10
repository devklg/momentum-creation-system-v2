/**
 * Approved-candidate evolution worker (Lane D · spec §26.3).
 *
 * Reacts to approved-candidate / refinement / admin-import / knowledge-session triggers — the
 * events that turn an already-approved candidate into new or updated organizational knowledge.
 * The approval always happens upstream; this worker only activates what governance already blessed
 * (spec runtime boundary — Knowledge Evolution never approves knowledge). Idempotent per approved
 * input via the shared command runner.
 */

import type { KnowledgeEvolutionConsumedEvent } from '@momentum/shared/runtime';
import { createCommandWorker } from './commandWorkerFactory.js';
import type { CommandWorkerDeps } from './types.js';

/**
 * Candidate-family triggers. `refinement.approved` produces an updated knowledge object;
 * admin-import and knowledge-session inputs arrive as candidate approvals whose `inputType`
 * distinguishes them on the request (spec §11 input types).
 */
const CANDIDATE_TRIGGERS: readonly KnowledgeEvolutionConsumedEvent[] = [
  'knowledge.candidate.approved',
  'knowledge.refinement.approved',
];

export function createApprovedCandidateEvolutionWorker(deps: CommandWorkerDeps) {
  return createCommandWorker('approvedCandidateEvolution', CANDIDATE_TRIGGERS, deps);
}
