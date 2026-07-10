/**
 * Evolution Version Service (spec §16).
 *
 * Versioning is mandatory for material changes: no active Knowledge Object may be materially
 * changed without version history (spec §16.3). This service creates append-only version records —
 * it never overwrites or deletes a prior version — computing the next version number from the
 * latest stored version. Pure business logic over the injected version repository port.
 */

import type {
  KnowledgeEvolutionChangeType,
  KnowledgeEvolutionVersion,
} from '@momentum/shared/runtime';
import { KnowledgeEvolutionRuntimeError } from '../errors.js';
import type { EvolutionRuntimeDeps } from '../deps.js';
import type { EvolutionVersionRepository } from './ports.js';

export interface CreateVersionInput {
  knowledgeObjectId: string;
  evolutionId: string;
  changeType: KnowledgeEvolutionChangeType;
  snapshotAfter: Record<string, unknown>;
  snapshotBefore?: Record<string, unknown>;
  reason: string;
  approvedBy: string;
}

export interface EvolutionVersionService {
  createVersion(input: CreateVersionInput): Promise<KnowledgeEvolutionVersion>;
  listVersions(knowledgeObjectId: string): Promise<KnowledgeEvolutionVersion[]>;
}

export function createEvolutionVersionService(
  versionRepository: EvolutionVersionRepository,
  deps: EvolutionRuntimeDeps,
): EvolutionVersionService {
  return {
    async createVersion(input) {
      if (!input.knowledgeObjectId || input.knowledgeObjectId.trim().length === 0) {
        throw new KnowledgeEvolutionRuntimeError({
          errorType: 'version_creation_failed',
          reason: 'Cannot create a version without a knowledgeObjectId.',
          safeMessage: 'Knowledge evolution failed: version creation requires a knowledge object.',
        });
      }

      const latest = await versionRepository.findLatestForKnowledgeObject(
        input.knowledgeObjectId,
      );
      const previousVersion = latest?.version;
      const version = previousVersion === undefined ? 1 : previousVersion + 1;

      const record: KnowledgeEvolutionVersion = {
        versionRecordId: deps.ids.newId('kevver'),
        knowledgeObjectId: input.knowledgeObjectId,
        version,
        ...(previousVersion !== undefined ? { previousVersion } : {}),
        evolutionId: input.evolutionId,
        changeType: input.changeType,
        ...(input.snapshotBefore ? { snapshotBefore: input.snapshotBefore } : {}),
        snapshotAfter: input.snapshotAfter,
        reason: input.reason,
        approvedBy: input.approvedBy,
        createdAt: deps.clock.now(),
      };

      return versionRepository.insert(record);
    },

    listVersions(knowledgeObjectId) {
      return versionRepository.listForKnowledgeObject(knowledgeObjectId);
    },
  };
}
