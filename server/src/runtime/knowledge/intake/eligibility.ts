/**
 * Runtime eligibility predicate for knowledge chunks (Phase 4 — P4.5A).
 *
 * Fail-closed: a chunk is retrieval-eligible ONLY when every condition holds. Any miss
 * (inactive, deprecated, archived, rejected, parse-failed, wrong scope, wrong language)
 * excludes it. Language fallback is deferred to P4.6 and is inert here (same-language only),
 * mirroring the P4.4 retrieval adapter.
 */

import type {
  McsKnowledgeChunk,
  McsKnowledgeChunkEligibilityRequest,
  McsRuntimeScope,
} from '@momentum/shared/runtime';

function isTeamMagnificentTeamScope(
  scope: McsRuntimeScope,
): scope is Extract<McsRuntimeScope, { teamKey: 'team_magnificent' }> {
  return (scope as { teamKey?: string }).teamKey === 'team_magnificent';
}

/** A chunk scope serves a request scope when same tenant/team and BA-compatible. */
function scopeServesRequest(chunkScope: McsRuntimeScope, requestScope: McsRuntimeScope): boolean {
  if (!isTeamMagnificentTeamScope(chunkScope)) return false;
  if (!isTeamMagnificentTeamScope(requestScope)) return false;
  if (chunkScope.tenantId !== requestScope.tenantId) return false;
  if (chunkScope.teamId !== requestScope.teamId) return false;

  const chunkTmagId = (chunkScope as { tmagId?: string }).tmagId;
  if (chunkTmagId === undefined) return true; // team-level chunk serves any BA in the team
  const requestTmagId = (requestScope as { tmagId?: string }).tmagId;
  return chunkTmagId === requestTmagId; // BA-level chunk serves only that BA
}

export function isChunkRetrievalEligible(
  chunk: McsKnowledgeChunk,
  request: McsKnowledgeChunkEligibilityRequest,
): boolean {
  if (chunk.status !== 'active') return false;
  if (!chunk.retrievalEligible) return false;
  if (!scopeServesRequest(chunk.scope, request.scope)) return false;
  // Same-language only in P4.5A; allowLanguageFallback is carried for P4.6 but inert here.
  if (chunk.language !== request.language) return false;
  return true;
}

export function filterRetrievalEligible(
  chunks: readonly McsKnowledgeChunk[],
  request: McsKnowledgeChunkEligibilityRequest,
): McsKnowledgeChunk[] {
  return chunks.filter((chunk) => isChunkRetrievalEligible(chunk, request));
}
