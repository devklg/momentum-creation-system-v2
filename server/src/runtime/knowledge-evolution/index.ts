/**
 * Knowledge Evolution Runtime — server module skeleton (Lane 0 foundation).
 *
 * This is a STABLE no-op import surface so later lanes (A persistence, B core services,
 * C indexing/graph, D routes/workers/events) can build against fixed paths under
 * `server/src/runtime/knowledge-evolution/` without churning imports.
 *
 * Lane 0 ships NO production behavior:
 *   - no route is mounted (spec §25 endpoints arrive in Lane D)
 *   - no MongoDB / Chroma / Neo4j access (persistence arrives in Lanes A/C via service layers)
 *   - no GraphRAG activation, no Context Manager live-flag changes
 *
 * The canonical contracts live in `@momentum/shared/runtime`. This module re-exports them for
 * ergonomic server-side import and pins an inert boundary descriptor mirroring the S1.2 backend
 * runtime skeleton pattern. It is intentionally NOT added to `backendRuntimeBoundaries` in
 * `server/src/runtime/index.ts` — that set is pinned by `runtimeBoundarySkeleton.test`.
 */

import {
  KNOWLEDGE_EVOLUTION_EVENT_SOURCE,
  KNOWLEDGE_EVOLUTION_RUNTIME_VERSION,
} from '@momentum/shared/runtime';

// Re-export the shared contract surface at a stable server path.
export type {
  KnowledgeApprovalReference,
  KnowledgeApprovalType,
  KnowledgeEvolutionAction,
  KnowledgeEvolutionAgentKey,
  KnowledgeEvolutionChangeType,
  KnowledgeEvolutionConsumedEvent,
  KnowledgeEvolutionCoordinationStatus,
  KnowledgeEvolutionDomain,
  KnowledgeEvolutionError,
  KnowledgeEvolutionErrorType,
  KnowledgeEvolutionEventType,
  KnowledgeEvolutionInputType,
  KnowledgeEvolutionLanguage,
  KnowledgeEvolutionMetricsQuery,
  KnowledgeEvolutionMetricsResponse,
  KnowledgeEvolutionMetricsSnapshot,
  KnowledgeEvolutionPlan,
  KnowledgeEvolutionPlanAction,
  KnowledgeEvolutionPublishedEvent,
  KnowledgeEvolutionRecord,
  KnowledgeEvolutionRetrievalStatus,
  KnowledgeEvolutionService,
  KnowledgeEvolutionStartResult,
  KnowledgeEvolutionStatus,
  KnowledgeEvolutionStep,
  KnowledgeEvolutionStepKey,
  KnowledgeEvolutionStepStatus,
  KnowledgeEvolutionVersion,
  KnowledgeEvolutionWorker,
  KnowledgeLanguageEvolutionRecord,
  KnowledgeLanguageTranslationStatus,
  KnowledgeMonitoringStatus,
  KnowledgeReindexStatus,
  KnowledgeRetrievalDomain,
  KnowledgeRetrievalRollout,
  KnowledgeRollbackPlan,
  KnowledgeRollbackType,
  KnowledgeSupersessionRecord,
  KnowledgeEvolutionTeamKey,
  KnowledgeEvolutionTeamName,
  GetKnowledgeEvolutionResponse,
  MarkRetrievalReadyInput,
  MarkRetrievalReadyResponse,
  RollbackKnowledgeEvolutionRequest,
  RollbackKnowledgeEvolutionResponse,
  StartKnowledgeEvolutionRequest,
  StartKnowledgeEvolutionResponse,
} from '@momentum/shared/runtime';

export {
  KNOWLEDGE_EVOLUTION_ACTIONS,
  KNOWLEDGE_EVOLUTION_ACTIVE_COLLECTIONS,
  KNOWLEDGE_EVOLUTION_COLLECTION_NAMES,
  KNOWLEDGE_EVOLUTION_COLLECTIONS,
  KNOWLEDGE_EVOLUTION_CONSUMED_EVENTS,
  KNOWLEDGE_EVOLUTION_DOMAINS,
  KNOWLEDGE_EVOLUTION_EVENT_SOURCE,
  KNOWLEDGE_EVOLUTION_EVENTS,
  KNOWLEDGE_EVOLUTION_INPUT_TYPES,
  KNOWLEDGE_EVOLUTION_PLAN_ACTIONS,
  KNOWLEDGE_EVOLUTION_PUBLISHED_EVENTS,
  KNOWLEDGE_EVOLUTION_RUNTIME_VERSION,
  KNOWLEDGE_EVOLUTION_STATUSES,
  KNOWLEDGE_EVOLUTION_SUPPORTED_LANGUAGES,
  KNOWLEDGE_EVOLUTION_TEAM_KEY,
  KNOWLEDGE_EVOLUTION_TEAM_MAGNIFICENT_SCOPE,
  KNOWLEDGE_EVOLUTION_TEAM_NAME,
} from '@momentum/shared/runtime';

/**
 * Inert descriptor for the Knowledge Evolution Runtime module. Mirrors the shape of the S1.2
 * backend runtime boundaries but is self-contained so it need not touch the pinned
 * `BackendRuntimeBoundaryKey` union. All activation flags are `false` in Lane 0.
 */
export interface KnowledgeEvolutionRuntimeBoundary {
  key: 'knowledge_evolution';
  label: 'Knowledge Evolution';
  status: 'skeleton_only';
  activated: false;
  apiMounted: false;
  behaviorEnabled: false;
  persistenceAccess: 'service_boundary_only';
  sharedContractImport: '@momentum/shared/runtime';
  runtimeVersion: typeof KNOWLEDGE_EVOLUTION_RUNTIME_VERSION;
  eventSource: typeof KNOWLEDGE_EVOLUTION_EVENT_SOURCE;
  notes: readonly string[];
}

export const knowledgeEvolutionRuntimeBoundary: KnowledgeEvolutionRuntimeBoundary = {
  key: 'knowledge_evolution',
  label: 'Knowledge Evolution',
  status: 'skeleton_only',
  activated: false,
  apiMounted: false,
  behaviorEnabled: false,
  persistenceAccess: 'service_boundary_only',
  sharedContractImport: '@momentum/shared/runtime',
  runtimeVersion: KNOWLEDGE_EVOLUTION_RUNTIME_VERSION,
  eventSource: KNOWLEDGE_EVOLUTION_EVENT_SOURCE,
  notes: [
    'Lane 0 pins shared contracts, constants, enums, event names, and this stable module path.',
    'No route is mounted here; spec §25 endpoints and workers are added in Lane D.',
    'No MongoDB / Chroma / Neo4j access; canonical persistence arrives via service layers in Lanes A/C.',
    'Knowledge Evolution never approves knowledge, mines private journals, uses Telnyx, or lets agents self-modify.',
  ],
} as const;

// ---------------------------------------------------------------------------
// Lane A — canonical Mongo persistence (models, repositories, indexes).
//
// MongoDB is canonical truth (spec §27). Models validate the domain contract;
// repositories are the ONLY sanctioned write path (idempotent where needed,
// audit-preserving). `ensureKnowledgeEvolutionIndexes` applies the index catalog
// on the dedicated app stack. No route handler, no Universal Gateway, no
// retrieval activation lives here.
// ---------------------------------------------------------------------------
export * from './models/index.js';
export * from './repositories/index.js';
export * from './persistence/index.js';
