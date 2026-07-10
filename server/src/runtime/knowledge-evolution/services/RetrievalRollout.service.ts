/**
 * Retrieval Rollout Service (spec §21).
 *
 * Knowledge becomes available to agents only after retrieval rollout completes. This service runs
 * the Retrieval Readiness Policy and produces a `KnowledgeRetrievalRollout` whose `retrievalReady`
 * stays false (with a `blockedReason`) until every required check passes. The `personal` domain is
 * never retrievable. Idempotent by evolutionId through the injected rollout repository port.
 * Pure business logic — no Chroma/Neo4j access, no event emission (that is Lane C/D).
 */

import type {
  KnowledgeEvolutionAgentKey,
  KnowledgeEvolutionDomain,
  KnowledgeEvolutionLanguage,
  KnowledgeRetrievalDomain,
  KnowledgeRetrievalRollout,
  MarkRetrievalReadyInput,
} from '@momentum/shared/runtime';
import {
  KNOWLEDGE_EVOLUTION_TEAM_KEY,
  KNOWLEDGE_EVOLUTION_TEAM_NAME,
} from '@momentum/shared/runtime';
import type { EvolutionRuntimeDeps } from '../deps.js';
import {
  evaluateRetrievalReadiness,
  type RetrievalReadinessInput,
} from '../policies/EvolutionRetrievalReadinessPolicy.js';
import type { RetrievalRolloutRepository } from './ports.js';

const ALL_AGENTS: readonly KnowledgeEvolutionAgentKey[] = [
  'steve_success',
  'michael_magnificent',
  'ivory',
];

/** Which internal agents receive knowledge from each retrieval domain (spec §21.2). */
const DOMAIN_AGENTS: Record<KnowledgeRetrievalDomain, readonly KnowledgeEvolutionAgentKey[]> = {
  success: ['steve_success'],
  training: ['michael_magnificent'],
  relationship: ['ivory'],
  performance: ALL_AGENTS,
  organizational: ALL_AGENTS,
  governance: ALL_AGENTS,
  system: ALL_AGENTS,
};

/** Maps a knowledge domain to its retrieval domain, or null for the non-retrievable `personal`. */
function toRetrievalDomain(
  domain: KnowledgeEvolutionDomain,
): KnowledgeRetrievalDomain | null {
  return domain === 'personal' ? null : domain;
}

export interface RolloutReadinessContext {
  domain: KnowledgeEvolutionDomain;
  language: KnowledgeEvolutionLanguage;
  readiness: RetrievalReadinessInput;
}

export interface RetrievalRolloutService {
  markRetrievalReady(
    input: MarkRetrievalReadyInput,
    context: RolloutReadinessContext,
  ): Promise<KnowledgeRetrievalRollout>;
  getByEvolutionId(evolutionId: string): Promise<KnowledgeRetrievalRollout | null>;
}

export function createRetrievalRolloutService(
  rolloutRepository: RetrievalRolloutRepository,
  deps: EvolutionRuntimeDeps,
): RetrievalRolloutService {
  return {
    async markRetrievalReady(input, context) {
      const decision = evaluateRetrievalReadiness(context.readiness);
      const retrievalDomain = toRetrievalDomain(context.domain);

      const blockedReasons = [...decision.blockedReasons];
      if (retrievalDomain === null) {
        blockedReasons.push('personal_domain_not_retrievable');
      }

      const ready = blockedReasons.length === 0;
      const now = deps.clock.now();

      const availableToDomains: KnowledgeRetrievalDomain[] =
        ready && retrievalDomain !== null ? [retrievalDomain] : [];
      const availableToAgents: KnowledgeEvolutionAgentKey[] =
        ready && retrievalDomain !== null ? [...DOMAIN_AGENTS[retrievalDomain]] : [];

      const existing = await rolloutRepository.findByEvolutionId(input.evolutionId);

      const rollout: KnowledgeRetrievalRollout = {
        rolloutId: existing?.rolloutId ?? deps.ids.newId('kevrol'),
        evolutionId: input.evolutionId,
        knowledgeObjectId: input.knowledgeObjectId,
        version: input.version,
        tenantId: input.tenantId,
        teamId: input.teamId,
        teamKey: KNOWLEDGE_EVOLUTION_TEAM_KEY,
        teamName: KNOWLEDGE_EVOLUTION_TEAM_NAME,
        language: context.language,
        availableToAgents,
        availableToDomains,
        retrievalReady: ready,
        ...(ready ? { readyAt: now } : {}),
        ...(ready ? {} : { blockedReason: blockedReasons.join(', ') }),
      };

      return rolloutRepository.upsertByEvolutionId(rollout);
    },

    getByEvolutionId(evolutionId) {
      return rolloutRepository.findByEvolutionId(evolutionId);
    },
  };
}
