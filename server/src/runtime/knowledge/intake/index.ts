/**
 * Knowledge Intake / Parsing / Indexing (Phase 4 — P4.5A bridge slice).
 *
 * Additive, inert utilities that turn a raw source Kevin adds into retrieval units the Context
 * Manager can consume via the EXISTING P4.4 adapter / P4.5 packet assembly. Pure functions
 * only — no persistence, no PERSISTENCE, no LLM, no routes. See:
 *   engineering/reports/P4_5A_KNOWLEDGE_INTAKE_PARSING_CONTRACT.md
 */

export {
  deriveChunkId,
  deriveDocumentId,
  deriveIndexRecordId,
  deriveKnowledgeId,
} from './ids.js';

export { parseRawKnowledgeSource } from './parser.js';

export {
  DEFAULT_MAX_CHUNK_CHARS,
  chunkParsedDocument,
} from './chunker.js';
export type { ChunkOptions, KnowledgeIntakeClassification } from './chunker.js';

export { isChunkRetrievalEligible, filterRetrievalEligible } from './eligibility.js';

export { resolveKnowledgeAuthority } from './authority.js';
export type {
  KnowledgeAuthorityDecision,
  KnowledgeAuthorityResolution,
} from './authority.js';

export { chunkToKnowledgeReference, chunksToKnowledgeReferences } from './mapping.js';

export { buildIndexRecord, buildIndexRecords } from './indexRecord.js';

export { ingestRawKnowledgeSource } from './pipeline.js';
export type { KnowledgeIntakeResult } from './pipeline.js';
