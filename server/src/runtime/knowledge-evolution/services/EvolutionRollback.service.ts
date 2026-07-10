/**
 * Evolution Rollback Service (spec §14, §30.3).
 *
 * Rollback corrects a faulty evolution while preserving history: it must not delete original
 * evidence, must not erase approval records, and must keep prior versions. This service appends a
 * `restored` version, records the executed rollback plan, and transitions the evolution record to
 * `rolled_back` with `retrievalStatus='rolled_back'` (removing it from active retrieval). Pure
 * business logic over injected repository ports and the version service.
 */

import type {
  KnowledgeEvolutionRecord,
  KnowledgeRollbackPlan,
  RollbackKnowledgeEvolutionRequest,
} from '@momentum/shared/runtime';
import { KnowledgeEvolutionRuntimeError } from '../errors.js';
import type { EvolutionRuntimeDeps } from '../deps.js';
import { validateRollbackPlanShape } from '../policies/EvolutionRollbackPolicy.js';
import type { EvolutionVersionService } from './EvolutionVersion.service.js';
import type {
  EvolutionPlanRepository,
  EvolutionRecordRepository,
  RollbackPlanRepository,
} from './ports.js';

export interface EvolutionRollbackService {
  rollback(input: RollbackKnowledgeEvolutionRequest): Promise<KnowledgeEvolutionRecord>;
}

export function createEvolutionRollbackService(
  recordRepository: EvolutionRecordRepository,
  planRepository: EvolutionPlanRepository,
  rollbackPlanRepository: RollbackPlanRepository,
  versionService: EvolutionVersionService,
  deps: EvolutionRuntimeDeps,
): EvolutionRollbackService {
  return {
    async rollback(input) {
      const record = await recordRepository.findByEvolutionId(input.evolutionId);
      if (!record) {
        throw new KnowledgeEvolutionRuntimeError({
          errorType: 'rollback_failed',
          reason: `No evolution record for evolutionId=${input.evolutionId}.`,
          safeMessage: 'Knowledge evolution rollback failed: evolution not found.',
        });
      }

      const plan = await planRepository.findByEvolutionId(input.evolutionId);
      const existingRollbackPlan =
        plan?.rollbackPlan ??
        (await rollbackPlanRepository.findByEvolutionId(input.evolutionId));

      // A retrieval-affecting evolution must have had a rollback plan (spec §14).
      if (plan?.affectsRetrieval && !existingRollbackPlan) {
        throw new KnowledgeEvolutionRuntimeError({
          errorType: 'rollback_failed',
          reason: `Evolution ${input.evolutionId} affected retrieval but has no rollback plan.`,
          safeMessage: 'Knowledge evolution rollback failed: no rollback plan on record.',
        });
      }

      const rollbackPlan: KnowledgeRollbackPlan =
        existingRollbackPlan ?? {
          rollbackPlanId: deps.ids.newId('kevrbk'),
          evolutionId: input.evolutionId,
          rollbackType: 'mark_not_retrieval_ready',
          previousKnowledgeObjectIds: record.targetKnowledgeObjectId
            ? [record.targetKnowledgeObjectId]
            : [...record.sourceKnowledgeObjectIds],
          previousVersionNumbers:
            record.versionCreated !== undefined && record.versionCreated > 1
              ? [record.versionCreated - 1]
              : [],
          rollbackReason: input.rollbackReason,
          createdAt: deps.clock.now(),
        };

      const shape = validateRollbackPlanShape(rollbackPlan);
      if (!shape.ok) {
        throw new KnowledgeEvolutionRuntimeError(shape);
      }

      // Persist the executed rollback plan (append-only; preserves audit trail).
      await rollbackPlanRepository.insert({
        ...rollbackPlan,
        rollbackReason: input.rollbackReason,
      });

      // Append a restoring version — prior versions and approval remain untouched (spec §14).
      const knowledgeObjectId =
        record.targetKnowledgeObjectId ?? record.sourceKnowledgeObjectIds[0];
      if (knowledgeObjectId) {
        await versionService.createVersion({
          knowledgeObjectId,
          evolutionId: input.evolutionId,
          changeType: 'restored',
          snapshotAfter: {
            rolledBack: true,
            rollbackType: rollbackPlan.rollbackType,
            rollbackReason: input.rollbackReason,
          },
          reason: `rollback: ${input.rollbackReason}`,
          approvedBy: input.requestedBy,
        });
      }

      const now = deps.clock.now();
      return recordRepository.patch(input.evolutionId, {
        status: 'rolled_back',
        retrievalStatus: 'rolled_back',
        updatedAt: now,
        metadata: {
          ...(record.metadata ?? {}),
          rolledBackBy: input.requestedBy,
          rollbackReason: input.rollbackReason,
          rollbackPlanId: rollbackPlan.rollbackPlanId,
        },
      });
    },
  };
}
