/**
 * Reindex evolution worker (Lane D · spec §19, §26.3).
 *
 * Reacts to `knowledge.evolution.reindex_requested` (emitted by a command worker) and runs the
 * Lane C Chroma reindex coordination. It emits `reindex_completed` on success or `failed` on a
 * non-recoverable failure. Idempotent: the bus suppresses a replayed request by eventId, and the
 * Lane C reindex itself is idempotent (deterministic document id + upsert), so re-running produces
 * no duplicate embeddings. This worker NEVER flips retrieval-ready — the reindex request is written
 * with `retrievalReady:false`, so active retrieval stays gated until a rollout is marked ready.
 */

import { buildEmittedEvent, type EmitContext } from '../events/envelope.js';
import type { KnowledgeEvolutionEmittedEvent } from '../events/envelope.js';
import type { BusSubscription } from '../events/bus.js';
import type { KnowledgeReindexRequest, KnowledgeReindexResult } from '../indexing/index.js';
import type { CoordinationWorkerDeps, EvolutionWorker } from './types.js';

const REINDEX_REQUESTED = 'knowledge.evolution.reindex_requested' as const;

export type ReindexTrigger = KnowledgeEvolutionEmittedEvent<{
  reindexRequest: KnowledgeReindexRequest;
}>;

function contextFromTrigger(trigger: ReindexTrigger, req: KnowledgeReindexRequest): EmitContext {
  return {
    correlationId: trigger.correlationId,
    causationId: trigger.eventId,
    actor: trigger.actor,
    teamScope: trigger.teamScope,
    language: trigger.language,
    ...(trigger.approvalReference ? { approvalReference: trigger.approvalReference } : {}),
    ...(trigger.sourceCandidateId ? { sourceCandidateId: trigger.sourceCandidateId } : {}),
    knowledgeObjectId: req.knowledgeObjectId,
    version: req.version,
  };
}

export function createReindexEvolutionWorker(
  deps: CoordinationWorkerDeps,
): EvolutionWorker<ReindexTrigger, KnowledgeReindexResult> {
  let subscription: BusSubscription | null = null;

  const worker: EvolutionWorker<ReindexTrigger, KnowledgeReindexResult> = {
    name: 'reindexEvolution',
    start() {
      if (subscription) return;
      subscription = deps.bus.on(REINDEX_REQUESTED, (event) =>
        worker.process(event as unknown as ReindexTrigger),
      );
    },
    stop() {
      subscription?.unsubscribe();
      subscription = null;
    },
    isRunning: () => subscription !== null,
    async process(trigger) {
      const req = trigger.payload.reindexRequest;
      const result = await deps.reindex(req);
      const ctx = contextFromTrigger(trigger, req);

      if (result.status === 'failed') {
        await deps.bus.publish(
          buildEmittedEvent(deps.runtime, 'knowledge.evolution.failed', ctx, {
            stage: 'reindex',
            collection: result.collection,
            action: result.action,
            reason: result.error ?? result.reason,
          }),
        );
      } else {
        await deps.bus.publish(
          buildEmittedEvent(deps.runtime, 'knowledge.evolution.reindex_completed', ctx, {
            collection: result.collection,
            action: result.action,
            status: result.status,
            documentId: result.documentId,
          }),
        );
      }
      return result;
    },
  };

  return worker;
}
