/**
 * Knowledge Evolution Runtime — consumed-event helpers (Lane D · spec §24.2).
 *
 * The runtime consumes approved review→evolution triggers and reacts by running governed evolution
 * commands (workers subscribe on the bus in their `start()`). This module builds/publishes those
 * consumed envelopes and documents which worker owns each consumed event type, for observability.
 * It never approves knowledge or creates candidates — it only transports an approval already made.
 */

import type { KnowledgeEvolutionConsumedEvent } from '@momentum/shared/runtime';
import type { EvolutionRuntimeDeps } from '../deps.js';
import type { KnowledgeEvolutionEventBus } from './bus.js';
import type { KnowledgeEvolutionConsumedEnvelope } from './envelope.js';

/** Which worker owns each consumed trigger (documentation + health surface). */
export const KNOWLEDGE_EVOLUTION_CONSUMER_MAP: Record<KnowledgeEvolutionConsumedEvent, string> = {
  'knowledge.candidate.approved': 'approvedCandidateEvolution',
  'knowledge.refinement.approved': 'approvedCandidateEvolution',
  'knowledge.translation.approved': 'approvedTranslationEvolution',
  'knowledge.supersession.approved': 'supersessionEvolution',
  'knowledge.archive.approved': 'archiveEvolution',
  // Coordination / monitoring signals — observed for lineage; no direct command dispatch here.
  'knowledge.object.activated': 'observed',
  'knowledge.embedding.completed': 'observed',
  'knowledge.graph_sync.completed': 'observed',
  'learning.knowledge.validated': 'observed',
  'learning.knowledge.weakened': 'observed',
  'learning.knowledge.refined': 'observed',
  'learning.knowledge.superseded': 'observed',
};

export interface ConsumedEnvelopeOptions {
  correlationId?: string;
  causationId?: string;
}

/** Build a consumed trigger envelope with deterministic id/timestamp from the runtime deps. */
export function buildConsumedEnvelope<P extends Record<string, unknown>>(
  runtime: EvolutionRuntimeDeps,
  type: KnowledgeEvolutionConsumedEvent,
  payload: P,
  options: ConsumedEnvelopeOptions = {},
): KnowledgeEvolutionConsumedEnvelope<P> {
  return {
    eventId: runtime.ids.newId('kevcon'),
    type,
    ...(options.correlationId ? { correlationId: options.correlationId } : {}),
    ...(options.causationId ? { causationId: options.causationId } : {}),
    occurredAt: runtime.clock.now().toISOString(),
    payload,
  };
}

/** Build and publish a consumed trigger on the bus. Returns the envelope (with its eventId). */
export async function publishConsumedEvent<P extends Record<string, unknown>>(
  bus: KnowledgeEvolutionEventBus,
  runtime: EvolutionRuntimeDeps,
  type: KnowledgeEvolutionConsumedEvent,
  payload: P,
  options: ConsumedEnvelopeOptions = {},
): Promise<KnowledgeEvolutionConsumedEnvelope<P>> {
  const envelope = buildConsumedEnvelope(runtime, type, payload, options);
  await bus.publish(envelope);
  return envelope;
}
