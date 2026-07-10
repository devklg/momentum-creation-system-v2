/**
 * Supersession Service (spec §17).
 *
 * Supersession safely replaces old knowledge with newer approved knowledge. The old object is
 * marked superseded but MUST remain stored, auditable, excluded from normal retrieval, and linked
 * to its replacement with original source lineage preserved (spec §17.3). This service records the
 * supersession relationship; it never deletes the old object. Pure business logic over the
 * injected supersession repository port.
 */

import type {
  KnowledgeApprovalReference,
  KnowledgeSupersessionRecord,
} from '@momentum/shared/runtime';
import {
  KNOWLEDGE_EVOLUTION_TEAM_KEY,
  KNOWLEDGE_EVOLUTION_TEAM_NAME,
} from '@momentum/shared/runtime';
import { KnowledgeEvolutionRuntimeError } from '../errors.js';
import type { EvolutionRuntimeDeps } from '../deps.js';
import type { SupersessionRepository } from './ports.js';

export interface RecordSupersessionInput {
  tenantId: string;
  teamId: string;
  oldKnowledgeObjectId: string;
  newKnowledgeObjectId: string;
  reason: string;
  approvalReference: KnowledgeApprovalReference;
  supersededBy: string;
}

export interface SupersessionService {
  recordSupersession(input: RecordSupersessionInput): Promise<KnowledgeSupersessionRecord>;
}

export function createSupersessionService(
  supersessionRepository: SupersessionRepository,
  deps: EvolutionRuntimeDeps,
): SupersessionService {
  return {
    async recordSupersession(input) {
      if (
        !input.oldKnowledgeObjectId ||
        !input.newKnowledgeObjectId ||
        input.oldKnowledgeObjectId === input.newKnowledgeObjectId
      ) {
        throw new KnowledgeEvolutionRuntimeError({
          errorType: 'supersession_failed',
          reason: `Supersession requires distinct old/new knowledge objects (old=${input.oldKnowledgeObjectId}, new=${input.newKnowledgeObjectId}).`,
          safeMessage: 'Knowledge evolution failed: supersession requires distinct old and new knowledge.',
        });
      }

      const record: KnowledgeSupersessionRecord = {
        supersessionId: deps.ids.newId('kevsup'),
        tenantId: input.tenantId,
        teamId: input.teamId,
        teamKey: KNOWLEDGE_EVOLUTION_TEAM_KEY,
        teamName: KNOWLEDGE_EVOLUTION_TEAM_NAME,
        oldKnowledgeObjectId: input.oldKnowledgeObjectId,
        newKnowledgeObjectId: input.newKnowledgeObjectId,
        reason: input.reason,
        approvalReference: input.approvalReference,
        supersededAt: deps.clock.now(),
        supersededBy: input.supersededBy,
      };

      return supersessionRepository.insert(record);
    },
  };
}
