/**
 * Knowledge Evolution Runtime — shared constants (Lane 0 foundation).
 *
 * Value catalog for the runtime: Team Magnificent scope, supported languages, status/action
 * enums, event names, collection names, and the active reindex collection set. Faithful to the
 * ratified `runtime/KNOWLEDGE_EVOLUTION_RUNTIME.md` v1.0.
 *
 * Constants only. No side effects, no persistence, no I/O. Every array is `as const` so downstream
 * lanes get exhaustive literal unions from a single source.
 */

import type { McsKnowledgeEventType } from '../events.js';
import type {
  KnowledgeEvolutionAction,
  KnowledgeEvolutionConsumedEvent,
  KnowledgeEvolutionDomain,
  KnowledgeEvolutionInputType,
  KnowledgeEvolutionLanguage,
  KnowledgeEvolutionPlanAction,
  KnowledgeEvolutionPublishedEvent,
  KnowledgeEvolutionStatus,
  KnowledgeEvolutionTeamKey,
  KnowledgeEvolutionTeamName,
} from './types.js';

// ---------------------------------------------------------------------------
// Runtime identity metadata
// ---------------------------------------------------------------------------

export const KNOWLEDGE_EVOLUTION_RUNTIME_VERSION = '1.0.0' as const;

/**
 * Logical event source for knowledge-evolution runtime events. NOT yet registered as an official
 * `McsAgentEventSource` — registering it is Lane D work under ACR-0001 (Agent Event Model
 * Alignment). Lane 0 pins the literal only.
 */
export const KNOWLEDGE_EVOLUTION_EVENT_SOURCE = 'knowledge_evolution' as const;

// ---------------------------------------------------------------------------
// Team Magnificent scope (spec §5)
// ---------------------------------------------------------------------------

export const KNOWLEDGE_EVOLUTION_TEAM_KEY: KnowledgeEvolutionTeamKey = 'team_magnificent';
export const KNOWLEDGE_EVOLUTION_TEAM_NAME: KnowledgeEvolutionTeamName = 'Team Magnificent';

export const KNOWLEDGE_EVOLUTION_TEAM_MAGNIFICENT_SCOPE = {
  teamKey: KNOWLEDGE_EVOLUTION_TEAM_KEY,
  teamName: KNOWLEDGE_EVOLUTION_TEAM_NAME,
} as const;

// ---------------------------------------------------------------------------
// Supported languages (spec §22)
// ---------------------------------------------------------------------------

export const KNOWLEDGE_EVOLUTION_SUPPORTED_LANGUAGES = ['en', 'es'] as const satisfies readonly KnowledgeEvolutionLanguage[];

// ---------------------------------------------------------------------------
// Status / action / input / domain enums (spec §§10–11)
// ---------------------------------------------------------------------------

export const KNOWLEDGE_EVOLUTION_STATUSES = [
  'received',
  'planning',
  'versioning',
  'writing_to_knowledge_core',
  'indexing',
  'graph_syncing',
  'retrieval_ready',
  'monitoring',
  'completed',
  'failed',
  'rolled_back',
] as const satisfies readonly KnowledgeEvolutionStatus[];

export const KNOWLEDGE_EVOLUTION_INPUT_TYPES = [
  'approved_candidate',
  'approved_translation',
  'approved_refinement',
  'approved_supersession',
  'approved_archive',
  'approved_governance_decision',
  'approved_admin_import',
  'approved_knowledge_session',
] as const satisfies readonly KnowledgeEvolutionInputType[];

export const KNOWLEDGE_EVOLUTION_ACTIONS = [
  'create_new_knowledge',
  'update_existing_knowledge',
  'create_language_variant',
  'supersede_existing_knowledge',
  'archive_existing_knowledge',
  'restore_prior_version',
  'reindex_only',
  'graph_sync_only',
] as const satisfies readonly KnowledgeEvolutionAction[];

export const KNOWLEDGE_EVOLUTION_PLAN_ACTIONS = [
  'create',
  'update',
  'translate',
  'supersede',
  'archive',
  'restore',
  'reindex',
  'graph_sync',
] as const satisfies readonly KnowledgeEvolutionPlanAction[];

export const KNOWLEDGE_EVOLUTION_DOMAINS = [
  'success',
  'training',
  'relationship',
  'performance',
  'personal',
  'organizational',
  'system',
  'governance',
] as const satisfies readonly KnowledgeEvolutionDomain[];

// ---------------------------------------------------------------------------
// Runtime event names (spec §24)
// ---------------------------------------------------------------------------

/** Named catalog of the 14 published `knowledge.evolution.*` events (spec §24.1). */
export const KNOWLEDGE_EVOLUTION_EVENTS = {
  RECEIVED: 'knowledge.evolution.received',
  PLAN_CREATED: 'knowledge.evolution.plan_created',
  VERSION_CREATED: 'knowledge.evolution.version_created',
  KNOWLEDGE_WRITTEN: 'knowledge.evolution.knowledge_written',
  SUPERSESSION_APPLIED: 'knowledge.evolution.supersession_applied',
  ARCHIVE_APPLIED: 'knowledge.evolution.archive_applied',
  REINDEX_REQUESTED: 'knowledge.evolution.reindex_requested',
  REINDEX_COMPLETED: 'knowledge.evolution.reindex_completed',
  GRAPH_SYNC_REQUESTED: 'knowledge.evolution.graph_sync_requested',
  GRAPH_SYNC_COMPLETED: 'knowledge.evolution.graph_sync_completed',
  RETRIEVAL_READY: 'knowledge.evolution.retrieval_ready',
  ROLLBACK_APPLIED: 'knowledge.evolution.rollback_applied',
  FAILED: 'knowledge.evolution.failed',
  COMPLETED: 'knowledge.evolution.completed',
} as const satisfies Record<string, KnowledgeEvolutionPublishedEvent & McsKnowledgeEventType>;

/** Flat, ordered list of the 14 published events (spec §24.1). */
export const KNOWLEDGE_EVOLUTION_PUBLISHED_EVENTS = [
  'knowledge.evolution.received',
  'knowledge.evolution.plan_created',
  'knowledge.evolution.version_created',
  'knowledge.evolution.knowledge_written',
  'knowledge.evolution.supersession_applied',
  'knowledge.evolution.archive_applied',
  'knowledge.evolution.reindex_requested',
  'knowledge.evolution.reindex_completed',
  'knowledge.evolution.graph_sync_requested',
  'knowledge.evolution.graph_sync_completed',
  'knowledge.evolution.retrieval_ready',
  'knowledge.evolution.rollback_applied',
  'knowledge.evolution.failed',
  'knowledge.evolution.completed',
] as const satisfies readonly KnowledgeEvolutionPublishedEvent[];

/** Review→evolution events the runtime consumes (spec §24.2). */
export const KNOWLEDGE_EVOLUTION_CONSUMED_EVENTS = [
  'knowledge.candidate.approved',
  'knowledge.translation.approved',
  'knowledge.refinement.approved',
  'knowledge.supersession.approved',
  'knowledge.archive.approved',
  'knowledge.object.activated',
  'knowledge.embedding.completed',
  'knowledge.graph_sync.completed',
  'learning.knowledge.validated',
  'learning.knowledge.weakened',
  'learning.knowledge.refined',
  'learning.knowledge.superseded',
] as const satisfies readonly KnowledgeEvolutionConsumedEvent[];

// ---------------------------------------------------------------------------
// Canonical Mongo collection names (spec §27.1)
// ---------------------------------------------------------------------------

export const KNOWLEDGE_EVOLUTION_COLLECTIONS = {
  records: 'knowledge_evolution_records',
  plans: 'knowledge_evolution_plans',
  versions: 'knowledge_evolution_versions',
  supersessionRecords: 'knowledge_supersession_records',
  retrievalRollouts: 'knowledge_retrieval_rollouts',
  languageEvolutionRecords: 'knowledge_language_evolution_records',
  rollbackPlans: 'knowledge_rollback_plans',
  errors: 'knowledge_evolution_errors',
  metrics: 'knowledge_evolution_metrics',
} as const;

/** Flat list of the canonical collection names (spec §27.1). */
export const KNOWLEDGE_EVOLUTION_COLLECTION_NAMES = [
  'knowledge_evolution_records',
  'knowledge_evolution_plans',
  'knowledge_evolution_versions',
  'knowledge_supersession_records',
  'knowledge_retrieval_rollouts',
  'knowledge_language_evolution_records',
  'knowledge_rollback_plans',
  'knowledge_evolution_errors',
  'knowledge_evolution_metrics',
] as const;

// ---------------------------------------------------------------------------
// Active semantic-retrieval collection set (spec §19.2)
// ---------------------------------------------------------------------------

/**
 * Active organizational knowledge collections per domain/language. Review-only candidate
 * collections MUST remain separate from these and are never listed here.
 */
export const KNOWLEDGE_EVOLUTION_ACTIVE_COLLECTIONS = [
  'organizational_knowledge_en',
  'organizational_knowledge_es',
  'success_knowledge_en',
  'success_knowledge_es',
  'training_knowledge_en',
  'training_knowledge_es',
  'relationship_knowledge_en',
  'relationship_knowledge_es',
  'performance_knowledge_en',
  'performance_knowledge_es',
  'governance_knowledge_en',
  'governance_knowledge_es',
  'system_knowledge_en',
  'system_knowledge_es',
] as const;
