/**
 * Archive Service (spec §18).
 *
 * Archival removes knowledge from active retrieval while preserving history. Archived knowledge
 * must not be retrieved as active guidance, must remain available for audit, and must not be
 * deleted by normal archival (spec §18.2). This service records an append-only `archived` version
 * and reports an archive outcome; it never deletes the knowledge object. Pure business logic.
 */

import type { KnowledgeEvolutionVersion } from '@momentum/shared/runtime';
import { KnowledgeEvolutionRuntimeError } from '../errors.js';
import type { EvolutionVersionService } from './EvolutionVersion.service.js';

export interface ArchiveInput {
  knowledgeObjectId: string;
  evolutionId: string;
  reason: string;
  approvedBy: string;
  snapshotBefore?: Record<string, unknown>;
}

export interface ArchiveOutcome {
  knowledgeObjectId: string;
  archivedVersion: KnowledgeEvolutionVersion;
  excludedFromRetrieval: true;
  retainedForAudit: true;
}

export interface ArchiveService {
  archive(input: ArchiveInput): Promise<ArchiveOutcome>;
}

export function createArchiveService(
  versionService: EvolutionVersionService,
): ArchiveService {
  return {
    async archive(input) {
      if (!input.knowledgeObjectId || input.knowledgeObjectId.trim().length === 0) {
        throw new KnowledgeEvolutionRuntimeError({
          errorType: 'archive_failed',
          reason: 'Cannot archive without a knowledgeObjectId.',
          safeMessage: 'Knowledge evolution failed: archival requires a knowledge object.',
        });
      }

      const archivedVersion = await versionService.createVersion({
        knowledgeObjectId: input.knowledgeObjectId,
        evolutionId: input.evolutionId,
        changeType: 'archived',
        ...(input.snapshotBefore ? { snapshotBefore: input.snapshotBefore } : {}),
        snapshotAfter: { lifecycleStatus: 'archived', excludedFromActiveRetrieval: true },
        reason: input.reason,
        approvedBy: input.approvedBy,
      });

      return {
        knowledgeObjectId: input.knowledgeObjectId,
        archivedVersion,
        excludedFromRetrieval: true,
        retainedForAudit: true,
      };
    },
  };
}
