/**
 * Knowledge Evolution Runtime — worker primitives (Lane D · spec §26.3).
 *
 * Workers are the event-driven side of the runtime: they translate an approved review→evolution
 * trigger into governed service calls, then publish `knowledge.evolution.*` events. Every worker
 * has explicit start/stop (subscribe/unsubscribe on the in-process bus) and is idempotent — a
 * replayed trigger produces no duplicate side effects.
 */

import type {
  KnowledgeEvolutionInputType,
  KnowledgeEvolutionRecord,
  KnowledgeEvolutionService,
  StartKnowledgeEvolutionRequest,
} from '@momentum/shared/runtime';
import type { EvolutionRuntimeDeps } from '../deps.js';
import type { KnowledgeEvolutionEventBus } from '../events/bus.js';
import type { KnowledgeReindexRequest, KnowledgeReindexResult } from '../indexing/index.js';
import type { GraphMapperInput, KnowledgeGraphSyncResult } from '../graph/index.js';

/** A runtime worker with explicit lifecycle. `process` is the idempotent unit of work. */
export interface EvolutionWorker<TJob, TResult> {
  readonly name: string;
  start(): void;
  stop(): void;
  isRunning(): boolean;
  process(job: TJob): Promise<TResult>;
}

/** Reader that lets a command worker dedupe on the approved input (idempotent replay). */
export type FindRecordByInput = (
  tenantId: string,
  inputType: KnowledgeEvolutionInputType,
  inputId: string,
) => Promise<KnowledgeEvolutionRecord | null>;

/** Deps for the four command workers (candidate / translation / supersession / archive). */
export interface CommandWorkerDeps {
  service: KnowledgeEvolutionService;
  bus: KnowledgeEvolutionEventBus;
  runtime: EvolutionRuntimeDeps;
  findRecordByInput: FindRecordByInput;
}

/** Deps for the two coordination workers (reindex / graph sync). */
export interface CoordinationWorkerDeps {
  bus: KnowledgeEvolutionEventBus;
  runtime: EvolutionRuntimeDeps;
  /** Bound Lane C reindex coordinator (markStatus already wired in production). */
  reindex(request: KnowledgeReindexRequest): Promise<KnowledgeReindexResult>;
  /** Bound Lane C graph-sync coordinator (markStatus already wired in production). */
  graphSync(input: GraphMapperInput): Promise<KnowledgeGraphSyncResult>;
}

/** A trigger carrying an approved evolution command payload. */
export interface EvolutionCommandJob {
  request: StartKnowledgeEvolutionRequest;
  /** Id of the consumed event that triggered this command (becomes the first causationId). */
  triggerEventId?: string;
}

/** Result of running an evolution command. `replayed` is true when the trigger was a duplicate. */
export interface EvolutionCommandResult {
  evolution: KnowledgeEvolutionRecord;
  replayed: boolean;
}
