/**
 * Knowledge Evolution Runtime — workers barrel + composition (Lane D · spec §26.3).
 *
 * Composes the six workers over one shared dep set and exposes explicit start/stop for the whole
 * fleet. The four command workers and two coordination workers share the same bus + runtime deps;
 * command workers additionally need the service + input-dedup reader, coordination workers need the
 * bound Lane C reindex/graph-sync coordinators.
 */

import { createApprovedCandidateEvolutionWorker } from './approvedCandidateEvolution.worker.js';
import { createApprovedTranslationEvolutionWorker } from './approvedTranslationEvolution.worker.js';
import { createSupersessionEvolutionWorker } from './supersessionEvolution.worker.js';
import { createArchiveEvolutionWorker } from './archiveEvolution.worker.js';
import { createReindexEvolutionWorker } from './reindexEvolution.worker.js';
import { createGraphSyncEvolutionWorker } from './graphSyncEvolution.worker.js';
import type { CommandWorkerDeps, CoordinationWorkerDeps, EvolutionWorker } from './types.js';

export * from './types.js';
export * from './commandRunner.js';
export * from './commandWorkerFactory.js';
export * from './approvedCandidateEvolution.worker.js';
export * from './approvedTranslationEvolution.worker.js';
export * from './supersessionEvolution.worker.js';
export * from './archiveEvolution.worker.js';
export * from './reindexEvolution.worker.js';
export * from './graphSyncEvolution.worker.js';

/** Every dep the six workers need. Command + coordination deps share bus + runtime. */
export interface KnowledgeEvolutionWorkersDeps extends CommandWorkerDeps, CoordinationWorkerDeps {}

export interface KnowledgeEvolutionWorkers {
  readonly all: ReadonlyArray<EvolutionWorker<unknown, unknown>>;
  readonly approvedCandidate: ReturnType<typeof createApprovedCandidateEvolutionWorker>;
  readonly approvedTranslation: ReturnType<typeof createApprovedTranslationEvolutionWorker>;
  readonly supersession: ReturnType<typeof createSupersessionEvolutionWorker>;
  readonly archive: ReturnType<typeof createArchiveEvolutionWorker>;
  readonly reindex: ReturnType<typeof createReindexEvolutionWorker>;
  readonly graphSync: ReturnType<typeof createGraphSyncEvolutionWorker>;
  startAll(): void;
  stopAll(): void;
  isRunning(): boolean;
}

export function createKnowledgeEvolutionWorkers(
  deps: KnowledgeEvolutionWorkersDeps,
): KnowledgeEvolutionWorkers {
  const approvedCandidate = createApprovedCandidateEvolutionWorker(deps);
  const approvedTranslation = createApprovedTranslationEvolutionWorker(deps);
  const supersession = createSupersessionEvolutionWorker(deps);
  const archive = createArchiveEvolutionWorker(deps);
  const reindex = createReindexEvolutionWorker(deps);
  const graphSync = createGraphSyncEvolutionWorker(deps);

  const all: Array<EvolutionWorker<unknown, unknown>> = [
    approvedCandidate as EvolutionWorker<unknown, unknown>,
    approvedTranslation as EvolutionWorker<unknown, unknown>,
    supersession as EvolutionWorker<unknown, unknown>,
    archive as EvolutionWorker<unknown, unknown>,
    reindex as EvolutionWorker<unknown, unknown>,
    graphSync as EvolutionWorker<unknown, unknown>,
  ];

  return {
    all,
    approvedCandidate,
    approvedTranslation,
    supersession,
    archive,
    reindex,
    graphSync,
    startAll() {
      for (const worker of all) worker.start();
    },
    stopAll() {
      for (const worker of all) worker.stop();
    },
    isRunning() {
      return all.some((worker) => worker.isRunning());
    },
  };
}
