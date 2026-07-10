/**
 * Knowledge Evolution Runtime — command-worker factory (Lane D · spec §26.3).
 *
 * The four command workers are structurally identical: subscribe to one or more consumed
 * review→evolution event types, translate each envelope into an evolution command, and run the
 * shared governed pipeline (`runEvolutionCommand`). Only the display name and the consumed event
 * set differ — this factory captures that shared shape so each worker file stays a thin, named
 * wrapper (one file per worker, per the Lane D brief).
 */

import type {
  KnowledgeEvolutionConsumedEvent,
  StartKnowledgeEvolutionRequest,
} from '@momentum/shared/runtime';
import type { BusSubscription } from '../events/bus.js';
import type { KnowledgeEvolutionConsumedEnvelope } from '../events/envelope.js';
import { runEvolutionCommand } from './commandRunner.js';
import type {
  CommandWorkerDeps,
  EvolutionCommandJob,
  EvolutionCommandResult,
  EvolutionWorker,
} from './types.js';

/** The payload a consumed evolution-command trigger carries: the approved start request. */
export interface EvolutionCommandTriggerPayload {
  request: StartKnowledgeEvolutionRequest;
}

export function createCommandWorker(
  name: string,
  consumedTypes: readonly KnowledgeEvolutionConsumedEvent[],
  deps: CommandWorkerDeps,
): EvolutionWorker<EvolutionCommandJob, EvolutionCommandResult> {
  const subscriptions: BusSubscription[] = [];
  let running = false;

  const worker: EvolutionWorker<EvolutionCommandJob, EvolutionCommandResult> = {
    name,
    start() {
      if (running) return;
      for (const type of consumedTypes) {
        subscriptions.push(
          deps.bus.on(type, (event) => {
            const envelope =
              event as unknown as KnowledgeEvolutionConsumedEnvelope<EvolutionCommandTriggerPayload>;
            return worker.process({
              request: envelope.payload.request,
              triggerEventId: envelope.eventId,
            });
          }),
        );
      }
      running = true;
    },
    stop() {
      for (const subscription of subscriptions) subscription.unsubscribe();
      subscriptions.length = 0;
      running = false;
    },
    isRunning: () => running,
    process: (job) => runEvolutionCommand(deps, job),
  };

  return worker;
}
