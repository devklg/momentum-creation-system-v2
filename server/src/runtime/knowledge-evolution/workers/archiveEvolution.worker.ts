/**
 * Archive evolution worker (Lane D · spec §18, §26.3).
 *
 * Reacts to `knowledge.archive.approved`. Archived knowledge remains stored and auditable but is
 * removed from active retrieval (coordinated by the reindex worker). Emits `archive_applied` via the
 * shared command runner. Idempotent per approved input.
 */

import type { KnowledgeEvolutionConsumedEvent } from '@momentum/shared/runtime';
import { createCommandWorker } from './commandWorkerFactory.js';
import type { CommandWorkerDeps } from './types.js';

const ARCHIVE_TRIGGERS: readonly KnowledgeEvolutionConsumedEvent[] = [
  'knowledge.archive.approved',
];

export function createArchiveEvolutionWorker(deps: CommandWorkerDeps) {
  return createCommandWorker('archiveEvolution', ARCHIVE_TRIGGERS, deps);
}
