/**
 * Knowledge Evolution Runtime — event envelopes (Lane D · spec §24).
 *
 * The runtime CONSUMES review→evolution events and PUBLISHES `knowledge.evolution.*` events.
 * Every published envelope carries the correlation/causation lineage plus the domain context the
 * ratified spec requires (spec §24.1): actor, approval reference, source candidate, knowledge
 * object, version, Team Magnificent scope, language, and timestamp.
 *
 * Pure data + builders. No persistence, no I/O, no Chroma/Neo4j — event transport is the in-process
 * bus (`./bus.ts`); persistence of derived state stays behind the Lane A/B service layers.
 */

import type {
  KnowledgeApprovalReference,
  KnowledgeEvolutionConsumedEvent,
  KnowledgeEvolutionLanguage,
  KnowledgeEvolutionPublishedEvent,
  KnowledgeEvolutionTeamKey,
  KnowledgeEvolutionTeamName,
} from '@momentum/shared/runtime';
import { KNOWLEDGE_EVOLUTION_EVENT_SOURCE } from '@momentum/shared/runtime';
import type { EvolutionRuntimeDeps } from '../deps.js';

/** Team Magnificent scope stamped onto every emitted event (spec §5, §24.1). */
export interface KnowledgeEvolutionTeamScope {
  teamId: string;
  teamKey: KnowledgeEvolutionTeamKey;
  teamName: KnowledgeEvolutionTeamName;
}

/**
 * A published `knowledge.evolution.*` event. `correlationId` is stable across a whole evolution
 * chain (it is the evolution id); `causationId` points at the event/command that directly caused
 * this one, so a consumer can reconstruct the exact ordering (spec §24.1).
 */
export interface KnowledgeEvolutionEmittedEvent<P = Record<string, unknown>> {
  eventId: string;
  type: KnowledgeEvolutionPublishedEvent;
  source: typeof KNOWLEDGE_EVOLUTION_EVENT_SOURCE;

  correlationId: string;
  causationId?: string;

  /** Who/what the evolution acts on behalf of — approver, requester, or `system`. */
  actor: string;
  approvalReference?: KnowledgeApprovalReference;

  sourceCandidateId?: string;
  knowledgeObjectId?: string;
  version?: number;

  teamScope: KnowledgeEvolutionTeamScope;
  language: KnowledgeEvolutionLanguage;

  occurredAt: string;

  payload: P;
  metadata?: Record<string, unknown>;
}

/**
 * A review→evolution event the runtime consumes (spec §24.2). The runtime never approves knowledge
 * or creates candidates — it only reacts to an approval already granted upstream, so a consumed
 * event is the sole legitimate trigger for an evolution.
 */
export interface KnowledgeEvolutionConsumedEnvelope<P = Record<string, unknown>> {
  eventId: string;
  type: KnowledgeEvolutionConsumedEvent;
  correlationId?: string;
  causationId?: string;
  occurredAt?: string;
  payload: P;
  metadata?: Record<string, unknown>;
}

/** Anything the in-process bus carries — a consumed trigger or a published evolution event. */
export type KnowledgeEvolutionBusEvent =
  | KnowledgeEvolutionEmittedEvent
  | KnowledgeEvolutionConsumedEnvelope;

/** The stable context threaded through an evolution chain so every emit shares lineage/scope. */
export interface EmitContext {
  correlationId: string;
  causationId?: string;
  actor: string;
  teamScope: KnowledgeEvolutionTeamScope;
  language: KnowledgeEvolutionLanguage;
  approvalReference?: KnowledgeApprovalReference;
  sourceCandidateId?: string;
  knowledgeObjectId?: string;
  version?: number;
}

/**
 * Build a published event envelope. `eventId`/`occurredAt` come from the injected runtime deps so
 * tests are deterministic. Optional context fields are only included when present — the envelope
 * never carries `undefined` keys (keeps replay/serialization stable).
 */
export function buildEmittedEvent<P extends Record<string, unknown>>(
  runtime: EvolutionRuntimeDeps,
  type: KnowledgeEvolutionPublishedEvent,
  ctx: EmitContext,
  payload: P,
  metadata?: Record<string, unknown>,
): KnowledgeEvolutionEmittedEvent<P> {
  return {
    eventId: runtime.ids.newId('kevevt'),
    type,
    source: KNOWLEDGE_EVOLUTION_EVENT_SOURCE,
    correlationId: ctx.correlationId,
    ...(ctx.causationId ? { causationId: ctx.causationId } : {}),
    actor: ctx.actor,
    ...(ctx.approvalReference ? { approvalReference: ctx.approvalReference } : {}),
    ...(ctx.sourceCandidateId ? { sourceCandidateId: ctx.sourceCandidateId } : {}),
    ...(ctx.knowledgeObjectId ? { knowledgeObjectId: ctx.knowledgeObjectId } : {}),
    ...(ctx.version !== undefined ? { version: ctx.version } : {}),
    teamScope: ctx.teamScope,
    language: ctx.language,
    occurredAt: runtime.clock.now().toISOString(),
    payload,
    ...(metadata ? { metadata } : {}),
  };
}
