/**
 * Knowledge intake pipeline (Phase 4 — P4.5A).
 *
 * Pure, inert orchestration of: parse → chunk → index. It returns the preserved raw source
 * alongside the derived document/chunks/index records. It performs NO persistence, NO Gateway
 * call, NO LLM. It is called only by tests (and, later, by an approved Phase 8 boundary).
 *
 *   Kevin adds knowledge → raw source preserved → parsed/normalized → sectioned → chunked
 *   → metadata attached → index records created → (mapped to references for the Context
 *   Manager retrieval path elsewhere).
 */

import type {
  McsKnowledgeChunk,
  McsKnowledgeIndexRecord,
  McsParsedKnowledgeDocument,
  McsRawKnowledgeSource,
} from '@momentum/shared/runtime';
import { parseRawKnowledgeSource } from './parser.js';
import { chunkParsedDocument, type ChunkOptions } from './chunker.js';
import { buildIndexRecords } from './indexRecord.js';

export interface KnowledgeIntakeResult {
  /** The raw source, unchanged — authority and traceability anchor. */
  source: McsRawKnowledgeSource;
  document: McsParsedKnowledgeDocument;
  chunks: McsKnowledgeChunk[];
  indexRecords: McsKnowledgeIndexRecord[];
}

export function ingestRawKnowledgeSource(
  source: McsRawKnowledgeSource,
  options: ChunkOptions = {},
): KnowledgeIntakeResult {
  const document = parseRawKnowledgeSource(source);
  const chunks = chunkParsedDocument(source, document, options);
  const indexRecords = buildIndexRecords(chunks);
  return { source, document, chunks, indexRecords };
}
