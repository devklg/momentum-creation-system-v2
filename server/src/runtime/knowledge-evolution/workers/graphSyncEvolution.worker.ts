/**
 * Graph-sync evolution worker (Lane D · spec §20, §26.3).
 *
 * Reacts to `knowledge.evolution.graph_sync_requested` (emitted by a command worker) and runs the
 * Lane C Neo4j graph-sync coordination. It emits `graph_sync_completed` on success or `failed` on a
 * non-recoverable failure. Idempotent: the bus suppresses a replayed request by eventId, and the
 * Lane C graph sync is idempotent (MERGE), so re-running creates no duplicate nodes/relationships.
 * Neo4j is graph/lineage only — it never overrides Mongo canonical state.
 */

import { buildEmittedEvent, type EmitContext } from '../events/envelope.js';
import type { KnowledgeEvolutionEmittedEvent } from '../events/envelope.js';
import type { BusSubscription } from '../events/bus.js';
import type { GraphMapperInput, KnowledgeGraphSyncResult } from '../graph/index.js';
import type { CoordinationWorkerDeps, EvolutionWorker } from './types.js';

const GRAPH_SYNC_REQUESTED = 'knowledge.evolution.graph_sync_requested' as const;

export type GraphSyncTrigger = KnowledgeEvolutionEmittedEvent<{
  graphInput: GraphMapperInput;
}>;

function contextFromTrigger(trigger: GraphSyncTrigger, input: GraphMapperInput): EmitContext {
  return {
    correlationId: trigger.correlationId,
    causationId: trigger.eventId,
    actor: trigger.actor,
    teamScope: trigger.teamScope,
    language: trigger.language,
    ...(trigger.approvalReference ? { approvalReference: trigger.approvalReference } : {}),
    ...(trigger.sourceCandidateId ? { sourceCandidateId: trigger.sourceCandidateId } : {}),
    knowledgeObjectId: input.knowledgeObjectId,
    ...(input.version !== undefined ? { version: input.version } : {}),
  };
}

export function createGraphSyncEvolutionWorker(
  deps: CoordinationWorkerDeps,
): EvolutionWorker<GraphSyncTrigger, KnowledgeGraphSyncResult> {
  let subscription: BusSubscription | null = null;

  const worker: EvolutionWorker<GraphSyncTrigger, KnowledgeGraphSyncResult> = {
    name: 'graphSyncEvolution',
    start() {
      if (subscription) return;
      subscription = deps.bus.on(GRAPH_SYNC_REQUESTED, (event) =>
        worker.process(event as unknown as GraphSyncTrigger),
      );
    },
    stop() {
      subscription?.unsubscribe();
      subscription = null;
    },
    isRunning: () => subscription !== null,
    async process(trigger) {
      const input = trigger.payload.graphInput;
      const result = await deps.graphSync(input);
      const ctx = contextFromTrigger(trigger, input);

      if (result.graphStatus === 'failed') {
        await deps.bus.publish(
          buildEmittedEvent(deps.runtime, 'knowledge.evolution.failed', ctx, {
            stage: 'graph_sync',
            reason: result.error,
            statementsPlanned: result.statementsPlanned,
          }),
        );
      } else {
        await deps.bus.publish(
          buildEmittedEvent(deps.runtime, 'knowledge.evolution.graph_sync_completed', ctx, {
            graphStatus: result.graphStatus,
            relationshipsCreated: result.relationshipsCreated,
            statementsRun: result.statementsRun,
          }),
        );
      }
      return result;
    },
  };

  return worker;
}
