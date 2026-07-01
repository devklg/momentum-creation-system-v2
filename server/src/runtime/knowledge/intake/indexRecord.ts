/**
 * Index-ready record builder (Phase 4 — P4.5A).
 *
 * Projects each `KnowledgeChunk` into a `KnowledgeIndexRecord`. `searchableText` is the chunk
 * text verbatim — NO embedding, NO summarization, NO vector/graph write happens here. Real
 * triple-stack/embedding indexing is Phase 8 (DB write-freeze; ACR-0008 implementation gate).
 */

import type { KnowledgeChunk, KnowledgeId, KnowledgeIndexRecord } from '@momentum/shared/runtime';
import { deriveIndexRecordId, deriveKnowledgeId } from './ids.js';

export function buildIndexRecord(chunk: KnowledgeChunk): KnowledgeIndexRecord {
  const eligible = chunk.status === 'active' && chunk.retrievalEligible;
  return {
    indexRecordId: deriveIndexRecordId(chunk.chunkId),
    chunkId: chunk.chunkId,
    sourceId: chunk.sourceId,
    documentId: chunk.documentId,
    searchableText: chunk.text,
    metadata: {
      language: chunk.language,
      domain: chunk.domain,
      heading: chunk.heading,
      topicTags: chunk.topicTags,
      agentScopes: chunk.agentScopes,
      surfaceScopes: chunk.surfaceScopes,
      sourceVersion: chunk.sourceVersion,
    },
    retrievalKey: `${chunk.domain}:${chunk.language}:${chunk.chunkId}`,
    knowledgeId: deriveKnowledgeId(chunk.chunkId) as KnowledgeId,
    status: eligible ? 'indexed' : 'excluded',
  };
}

export function buildIndexRecords(chunks: readonly KnowledgeChunk[]): KnowledgeIndexRecord[] {
  return chunks.map(buildIndexRecord);
}
