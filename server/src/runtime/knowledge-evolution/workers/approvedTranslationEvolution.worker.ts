/**
 * Approved-translation evolution worker (Lane D · spec §22, §26.3).
 *
 * Reacts to `knowledge.translation.approved` and activates a human-reviewed EN/ES language variant.
 * Machine translation that has NOT been human-reviewed is rejected upstream by the bilingual policy
 * (Lane B) — this worker only ever sees an approved, reviewed translation. Idempotent per input.
 */

import type { KnowledgeEvolutionConsumedEvent } from '@momentum/shared/runtime';
import { createCommandWorker } from './commandWorkerFactory.js';
import type { CommandWorkerDeps } from './types.js';

const TRANSLATION_TRIGGERS: readonly KnowledgeEvolutionConsumedEvent[] = [
  'knowledge.translation.approved',
];

export function createApprovedTranslationEvolutionWorker(deps: CommandWorkerDeps) {
  return createCommandWorker('approvedTranslationEvolution', TRANSLATION_TRIGGERS, deps);
}
