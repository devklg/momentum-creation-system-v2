/**
 * Map an eligible `KnowledgeChunk` to the `KnowledgeReference` shape (Phase 4 — P4.5A).
 *
 * This is the join that makes Kevin-added knowledge reachable by the EXISTING retrieval path:
 * a mapped reference is exactly what `ApprovedKnowledgeProvider.listApprovedKnowledge` (P4.4)
 * returns, so it flows through the P4.4 adapter and P4.5 packet assembly unchanged.
 *
 * Kevin-added knowledge is official: an active chunk maps to `status: 'active'` (author
 * fast-lane, ACR-0008). No review queue is introduced here. Non-active / ineligible chunks
 * map to nothing — fail-closed.
 */

import type { KnowledgeChunk, KnowledgeId, KnowledgeReference } from '@momentum/shared/runtime';
import { deriveKnowledgeId } from './ids.js';

export function chunkToKnowledgeReference(chunk: KnowledgeChunk): KnowledgeReference | null {
  if (chunk.status !== 'active' || !chunk.retrievalEligible) return null;
  return {
    knowledgeId: deriveKnowledgeId(chunk.chunkId) as KnowledgeId,
    domain: chunk.domain,
    status: 'active',
    language: chunk.language,
    translationStatus: 'same_language',
    sourceId: chunk.sourceId,
  };
}

export function chunksToKnowledgeReferences(
  chunks: readonly KnowledgeChunk[],
): KnowledgeReference[] {
  return chunks
    .map(chunkToKnowledgeReference)
    .filter((reference): reference is KnowledgeReference => reference !== null);
}
