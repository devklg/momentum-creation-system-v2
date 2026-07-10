/**
 * Supersession evolution worker (Lane D · spec §17, §26.3).
 *
 * Reacts to `knowledge.supersession.approved`. The superseding knowledge becomes active while the
 * superseded knowledge remains stored and auditable but excluded from active retrieval (the removal
 * from active collections is coordinated by the reindex worker). Emits `supersession_applied` via
 * the shared command runner. Idempotent per approved input.
 */

import type { KnowledgeEvolutionConsumedEvent } from '@momentum/shared/runtime';
import { createCommandWorker } from './commandWorkerFactory.js';
import type { CommandWorkerDeps } from './types.js';

const SUPERSESSION_TRIGGERS: readonly KnowledgeEvolutionConsumedEvent[] = [
  'knowledge.supersession.approved',
];

export function createSupersessionEvolutionWorker(deps: CommandWorkerDeps) {
  return createCommandWorker('supersessionEvolution', SUPERSESSION_TRIGGERS, deps);
}
