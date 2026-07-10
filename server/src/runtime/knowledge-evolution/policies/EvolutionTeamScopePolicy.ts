/**
 * Team Scope Policy (spec §5).
 *
 * Every evolution record must be Team Magnificent scoped, and all BA-derived knowledge
 * (records that carry a `baId`) must also be Team Magnificent scoped. Pure function, no I/O.
 */

import {
  KNOWLEDGE_EVOLUTION_TEAM_KEY,
  KNOWLEDGE_EVOLUTION_TEAM_NAME,
} from '@momentum/shared/runtime';
import { policyFail, policyOk, type PolicyResult } from '../errors.js';

export interface TeamScopeInput {
  teamId: string;
  teamKey: string;
  teamName: string;
  baId?: string;
}

/**
 * Rejects any record whose team scope is not Team Magnificent. BA-derived records (a `baId` is
 * present) fail with `invalid_ba_scope`; missing/foreign team scope fails with `invalid_team_scope`.
 */
export function evaluateTeamScope(input: TeamScopeInput): PolicyResult {
  const teamScopeValid =
    typeof input.teamId === 'string' &&
    input.teamId.trim().length > 0 &&
    input.teamKey === KNOWLEDGE_EVOLUTION_TEAM_KEY &&
    input.teamName === KNOWLEDGE_EVOLUTION_TEAM_NAME;

  if (teamScopeValid) {
    return policyOk;
  }

  const baDerived = typeof input.baId === 'string' && input.baId.trim().length > 0;
  if (baDerived) {
    return policyFail({
      errorType: 'invalid_ba_scope',
      reason: `BA-derived knowledge (baId=${input.baId ?? ''}) is not scoped to Team Magnificent (teamKey=${input.teamKey}, teamName=${input.teamName}).`,
      safeMessage: 'Knowledge evolution rejected: BA-derived knowledge must be Team Magnificent scoped.',
    });
  }

  return policyFail({
    errorType: 'invalid_team_scope',
    reason: `Evolution scope is not Team Magnificent (teamId=${String(input.teamId)}, teamKey=${input.teamKey}, teamName=${input.teamName}).`,
    safeMessage: 'Knowledge evolution rejected: Team Magnificent scope is required.',
  });
}

export function isTeamMagnificentScope(input: TeamScopeInput): boolean {
  return evaluateTeamScope(input).ok;
}
