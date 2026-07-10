/**
 * Evolution Plan Service (spec §13, §15.1).
 *
 * Before the Knowledge Core is modified, the runtime must create an Evolution Plan describing the
 * ordered required steps, coordination flags, and a rollback plan for retrieval-affecting work.
 * This service designs the plan from the requested action and persists it through the injected
 * plan repository port. Pure business logic — no route/worker coupling, no Chroma/Neo4j access.
 */

import type {
  KnowledgeEvolutionAction,
  KnowledgeEvolutionLanguage,
  KnowledgeEvolutionPlan,
  KnowledgeEvolutionPlanAction,
  KnowledgeEvolutionStep,
  KnowledgeEvolutionStepKey,
  KnowledgeRollbackPlan,
  KnowledgeRollbackType,
} from '@momentum/shared/runtime';
import type { EvolutionRuntimeDeps } from '../deps.js';
import type { EvolutionPlanRepository } from './ports.js';

/** Maps a record's `evolutionAction` to the plan's coarse `action` verb (spec §11 → §13). */
const ACTION_TO_PLAN_ACTION: Record<KnowledgeEvolutionAction, KnowledgeEvolutionPlanAction> = {
  create_new_knowledge: 'create',
  update_existing_knowledge: 'update',
  create_language_variant: 'translate',
  supersede_existing_knowledge: 'supersede',
  archive_existing_knowledge: 'archive',
  restore_prior_version: 'restore',
  reindex_only: 'reindex',
  graph_sync_only: 'graph_sync',
};

/** Validation steps every plan carries (spec §13 step keys). */
const VALIDATION_STEPS: readonly KnowledgeEvolutionStepKey[] = [
  'validate_approval',
  'validate_sources',
  'validate_permissions',
];

/** Action-specific step sequences after validation. */
const ACTION_STEPS: Record<KnowledgeEvolutionAction, readonly KnowledgeEvolutionStepKey[]> = {
  create_new_knowledge: [
    'create_version',
    'write_knowledge_object',
    'reindex_chroma',
    'sync_neo4j',
    'mark_retrieval_ready',
    'emit_events',
    'monitor_outcomes',
  ],
  update_existing_knowledge: [
    'create_version',
    'write_knowledge_object',
    'reindex_chroma',
    'sync_neo4j',
    'mark_retrieval_ready',
    'emit_events',
    'monitor_outcomes',
  ],
  create_language_variant: [
    'create_version',
    'create_language_variant',
    'write_knowledge_object',
    'reindex_chroma',
    'sync_neo4j',
    'mark_retrieval_ready',
    'emit_events',
    'monitor_outcomes',
  ],
  supersede_existing_knowledge: [
    'create_version',
    'write_knowledge_object',
    'mark_superseded',
    'reindex_chroma',
    'sync_neo4j',
    'mark_retrieval_ready',
    'emit_events',
    'monitor_outcomes',
  ],
  archive_existing_knowledge: [
    'create_version',
    'archive_knowledge',
    'reindex_chroma',
    'sync_neo4j',
    'emit_events',
  ],
  restore_prior_version: [
    'create_version',
    'write_knowledge_object',
    'reindex_chroma',
    'sync_neo4j',
    'mark_retrieval_ready',
    'emit_events',
  ],
  reindex_only: ['reindex_chroma', 'emit_events'],
  graph_sync_only: ['sync_neo4j', 'emit_events'],
};

export interface PlanDesign {
  action: KnowledgeEvolutionPlanAction;
  requiredSteps: KnowledgeEvolutionStep[];
  requiresReindex: boolean;
  requiresGraphSync: boolean;
  affectsRetrieval: boolean;
}

/** Pure step/flag design for an action — no ids, no clock, no persistence. */
export function designPlanForAction(action: KnowledgeEvolutionAction): PlanDesign {
  const stepKeys: KnowledgeEvolutionStepKey[] = [...VALIDATION_STEPS, ...ACTION_STEPS[action]];
  const requiredSteps: KnowledgeEvolutionStep[] = stepKeys.map((stepKey) => ({
    stepKey,
    required: true,
    status: 'pending',
  }));

  const has = (key: KnowledgeEvolutionStepKey): boolean => stepKeys.includes(key);
  const requiresReindex = has('reindex_chroma');
  const requiresGraphSync = has('sync_neo4j');
  const affectsRetrieval =
    requiresReindex ||
    has('mark_retrieval_ready') ||
    has('mark_superseded') ||
    has('archive_knowledge');

  return {
    action: ACTION_TO_PLAN_ACTION[action],
    requiredSteps,
    requiresReindex,
    requiresGraphSync,
    affectsRetrieval,
  };
}

export interface CreatePlanInput {
  evolutionId: string;
  tenantId: string;
  teamId: string;
  teamKey: KnowledgeEvolutionPlan['teamKey'];
  teamName: KnowledgeEvolutionPlan['teamName'];
  evolutionAction: KnowledgeEvolutionAction;
  language: KnowledgeEvolutionLanguage;
  targetKnowledgeObjectId?: string;
  sourceKnowledgeObjectIds: string[];
  sourceCandidateIds: string[];
  riskFlags?: string[];
  /** Optional caller-provided rollback plan; a default is synthesized when retrieval is affected. */
  rollbackPlan?: KnowledgeRollbackPlan;
}

const DEFAULT_ROLLBACK_TYPE: KnowledgeRollbackType = 'mark_not_retrieval_ready';

export interface EvolutionPlanService {
  createPlan(input: CreatePlanInput): Promise<KnowledgeEvolutionPlan>;
  getByPlanId(planId: string): Promise<KnowledgeEvolutionPlan | null>;
  getByEvolutionId(evolutionId: string): Promise<KnowledgeEvolutionPlan | null>;
}

export function createEvolutionPlanService(
  planRepository: EvolutionPlanRepository,
  deps: EvolutionRuntimeDeps,
): EvolutionPlanService {
  return {
    async createPlan(input) {
      const design = designPlanForAction(input.evolutionAction);
      const createdAt = deps.clock.now();

      const rollbackPlan =
        input.rollbackPlan ??
        (design.affectsRetrieval
          ? synthesizeDefaultRollbackPlan(input, deps, createdAt)
          : undefined);

      const plan: KnowledgeEvolutionPlan = {
        planId: deps.ids.newId('kevplan'),
        evolutionId: input.evolutionId,
        tenantId: input.tenantId,
        teamId: input.teamId,
        teamKey: input.teamKey,
        teamName: input.teamName,
        action: design.action,
        ...(input.targetKnowledgeObjectId
          ? { targetKnowledgeObjectId: input.targetKnowledgeObjectId }
          : {}),
        sourceKnowledgeObjectIds: [...input.sourceKnowledgeObjectIds],
        sourceCandidateIds: [...input.sourceCandidateIds],
        requiredSteps: design.requiredSteps,
        riskFlags: input.riskFlags ? [...input.riskFlags] : [],
        language: input.language,
        requiresReindex: design.requiresReindex,
        requiresGraphSync: design.requiresGraphSync,
        affectsRetrieval: design.affectsRetrieval,
        ...(rollbackPlan ? { rollbackPlan } : {}),
        createdAt,
      };

      return planRepository.insert(plan);
    },

    getByPlanId(planId) {
      return planRepository.findByPlanId(planId);
    },

    getByEvolutionId(evolutionId) {
      return planRepository.findByEvolutionId(evolutionId);
    },
  };
}

function synthesizeDefaultRollbackPlan(
  input: CreatePlanInput,
  deps: EvolutionRuntimeDeps,
  createdAt: Date,
): KnowledgeRollbackPlan {
  return {
    rollbackPlanId: deps.ids.newId('kevrbk'),
    evolutionId: input.evolutionId,
    rollbackType: DEFAULT_ROLLBACK_TYPE,
    previousKnowledgeObjectIds: [...input.sourceKnowledgeObjectIds],
    previousVersionNumbers: [],
    rollbackReason: 'auto-generated rollback plan for retrieval-affecting evolution',
    createdAt,
  };
}
