/**
 * Knowledge Evolution Runtime — shared command flow (Lane D · spec §13, §16, §24).
 *
 * The four command workers (candidate / translation / supersession / archive) all run the same
 * governed pipeline: idempotency check → start evolution (validate + plan) → execute plan
 * (version / supersede / archive coordination) → publish the lineage events → hand off to the
 * reindex / graph-sync coordination workers. Only the trigger event type differs between workers;
 * the applied-event is derived from the plan action, so this single runner covers all four.
 *
 * Every state change goes through the Lane B `KnowledgeEvolutionService` — this runner NEVER
 * touches a store, Chroma, or Neo4j directly (spec runtime boundary).
 */

import type {
  KnowledgeEvolutionPublishedEvent,
  KnowledgeEvolutionRecord,
} from '@momentum/shared/runtime';
import { buildEmittedEvent, type EmitContext } from '../events/envelope.js';
import { graphMapperInputFromRecord, type GraphMapperInput } from '../graph/index.js';
import type { KnowledgeReindexRequest } from '../indexing/index.js';
import type {
  CommandWorkerDeps,
  EvolutionCommandJob,
  EvolutionCommandResult,
} from './types.js';

/** Read a string field off the request metadata (e.g. the summary text to embed). */
function readMetadataString(
  metadata: Record<string, unknown> | undefined,
  key: string,
): string | undefined {
  const value = metadata?.[key];
  return typeof value === 'string' && value.trim().length > 0 ? value : undefined;
}

/** Build the Lane C reindex request from an executed evolution record. */
export function reindexRequestFromRecord(
  record: KnowledgeEvolutionRecord,
  document: string | undefined,
): KnowledgeReindexRequest {
  const knowledgeObjectId = record.targetKnowledgeObjectId ?? record.evolutionId;
  const lifecycle =
    record.evolutionAction === 'archive_existing_knowledge'
      ? 'archived'
      : record.evolutionAction === 'supersede_existing_knowledge'
        ? 'active' // the NEW knowledge object becomes active; the old one is removed separately
        : 'active';
  return {
    evolutionId: record.evolutionId,
    knowledgeObjectId,
    version: record.versionCreated ?? 1,
    tenantId: record.tenantId,
    teamId: record.teamId,
    teamKey: record.teamKey,
    teamName: record.teamName,
    domain: record.domain,
    language: record.language,
    lifecycle,
    approved: true,
    // Lane D NEVER pre-activates retrieval — the active record stays gated until a rollout is ready.
    retrievalReady: false,
    ...(document ? { document } : {}),
    sourceCandidateIds: [...record.sourceCandidateIds],
    sourceKnowledgeObjectIds: [...record.sourceKnowledgeObjectIds],
    sourceLearningSignalIds: [...record.sourceLearningSignalIds],
    sourceOutcomeIds: [...record.sourceOutcomeIds],
  };
}

/** Build the Lane C graph-mapper input from an executed record (retrieval stays gated off). */
export function graphInputFromRecord(record: KnowledgeEvolutionRecord): GraphMapperInput {
  return graphMapperInputFromRecord(record, { retrievalReady: false });
}

/**
 * Run one approved evolution command end-to-end. Idempotent: if a record already exists for this
 * approved input, the command is a replay and NO service call / event is issued a second time.
 */
export async function runEvolutionCommand(
  deps: CommandWorkerDeps,
  job: EvolutionCommandJob,
): Promise<EvolutionCommandResult> {
  const { request, triggerEventId } = job;
  const { bus, runtime, service } = deps;

  const existing = await deps.findRecordByInput(
    request.tenantId,
    request.inputType,
    request.inputId,
  );
  if (existing) {
    return { evolution: existing, replayed: true };
  }

  const { evolution, plan } = await service.startEvolution(request);

  const baseCtx: EmitContext = {
    correlationId: evolution.evolutionId,
    actor: request.approvalReference.approvedBy,
    teamScope: {
      teamId: evolution.teamId,
      teamKey: evolution.teamKey,
      teamName: evolution.teamName,
    },
    language: evolution.language,
    approvalReference: request.approvalReference,
    ...(request.sourceCandidateIds?.[0] ? { sourceCandidateId: request.sourceCandidateIds[0] } : {}),
  };

  let lastEventId: string | undefined = triggerEventId;
  const emit = async (
    type: KnowledgeEvolutionPublishedEvent,
    payload: Record<string, unknown>,
    ctxOverride: Partial<EmitContext> = {},
  ): Promise<void> => {
    const ctx: EmitContext = {
      ...baseCtx,
      ...ctxOverride,
      ...(lastEventId ? { causationId: lastEventId } : {}),
    };
    const event = buildEmittedEvent(runtime, type, ctx, payload);
    await bus.publish(event);
    lastEventId = event.eventId;
  };

  await emit('knowledge.evolution.received', {
    evolutionId: evolution.evolutionId,
    inputType: evolution.inputType,
    inputId: evolution.inputId,
  });
  await emit('knowledge.evolution.plan_created', {
    planId: plan.planId,
    action: plan.action,
    requiresReindex: plan.requiresReindex,
    requiresGraphSync: plan.requiresGraphSync,
  });

  const executed = await service.executeEvolutionPlan(plan.planId);
  const knowledgeObjectId = executed.targetKnowledgeObjectId;
  const executedCtx: Partial<EmitContext> = {
    ...(knowledgeObjectId ? { knowledgeObjectId } : {}),
    ...(executed.versionCreated !== undefined ? { version: executed.versionCreated } : {}),
  };

  if (executed.versionCreated !== undefined) {
    await emit(
      'knowledge.evolution.version_created',
      { knowledgeObjectId, version: executed.versionCreated },
      executedCtx,
    );
  }

  const appliedType: KnowledgeEvolutionPublishedEvent =
    plan.action === 'supersede'
      ? 'knowledge.evolution.supersession_applied'
      : plan.action === 'archive'
        ? 'knowledge.evolution.archive_applied'
        : 'knowledge.evolution.knowledge_written';
  await emit(appliedType, { knowledgeObjectId, evolutionAction: executed.evolutionAction }, executedCtx);

  const needsReindex = executed.indexingStatus === 'pending';
  const needsGraph = executed.graphStatus === 'pending';

  if (needsReindex) {
    const document = readMetadataString(request.metadata, 'document');
    await emit(
      'knowledge.evolution.reindex_requested',
      { reindexRequest: reindexRequestFromRecord(executed, document) },
      executedCtx,
    );
  }
  if (needsGraph) {
    await emit(
      'knowledge.evolution.graph_sync_requested',
      { graphInput: graphInputFromRecord(executed) },
      executedCtx,
    );
  }
  // Simple (no-coordination) evolutions complete here; coordinated ones complete via the
  // reindex/graph-sync workers' completion events (aggregate completion is a monitoring concern).
  if (!needsReindex && !needsGraph) {
    await emit('knowledge.evolution.completed', { knowledgeObjectId }, executedCtx);
  }

  return { evolution: executed, replayed: false };
}
