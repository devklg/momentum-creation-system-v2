/**
 * Runtime eligibility predicate for knowledge chunks (Phase 4 — P4.5A).
 *
 * Fail-closed: a chunk is retrieval-eligible ONLY when every condition holds. Any miss
 * (inactive, deprecated, archived, rejected, parse-failed, wrong scope, wrong language)
 * excludes it. Language fallback is deferred to P4.6 and is inert here (same-language only),
 * mirroring the P4.4 retrieval adapter.
 */

import type {
  KnowledgeChunk,
  KnowledgeChunkEligibilityRequest,
  RuntimeScope,
} from '@momentum/shared/runtime';

function isTeamMagnificentTeamScope(
  scope: RuntimeScope,
): scope is Extract<RuntimeScope, { teamKey: 'team_magnificent' }> {
  return (scope as { teamKey?: string }).teamKey === 'team_magnificent';
}

/** A chunk scope serves a request scope when same tenant/team and BA-compatible. */
function scopeServesRequest(chunkScope: RuntimeScope, requestScope: RuntimeScope): boolean {
  if (!isTeamMagnificentTeamScope(chunkScope)) return false;
  if (!isTeamMagnificentTeamScope(requestScope)) return false;
  if (chunkScope.tenantId !== requestScope.tenantId) return false;
  if (chunkScope.teamId !== requestScope.teamId) return false;

  const chunkBaId = (chunkScope as { baId?: string }).baId;
  if (chunkBaId === undefined) return true; // team-level chunk serves any BA in the team
  const requestBaId = (requestScope as { baId?: string }).baId;
  return chunkBaId === requestBaId; // BA-level chunk serves only that BA
}

export function isChunkRetrievalEligible(
  chunk: KnowledgeChunk,
  request: KnowledgeChunkEligibilityRequest,
): boolean {
  if (chunk.status !== 'active') return false;
  if (!chunk.retrievalEligible) return false;
  if (!scopeServesRequest(chunk.scope, request.scope)) return false;
  // Same-language only in P4.5A; allowLanguageFallback is carried for P4.6 but inert here.
  if (chunk.language !== request.language) return false;
  return true;
}

export function filterRetrievalEligible(
  chunks: readonly KnowledgeChunk[],
  request: KnowledgeChunkEligibilityRequest,
): KnowledgeChunk[] {
  return chunks.filter((chunk) => isChunkRetrievalEligible(chunk, request));
}
