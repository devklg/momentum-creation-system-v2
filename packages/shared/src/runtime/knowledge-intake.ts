/**
 * Knowledge Intake / Parsing / Indexing data-model (Phase 4 — P4.5A bridge slice).
 *
 * Store-agnostic TYPE contracts for transforming a raw source Kevin adds into retrieval
 * units the Context Manager can place into a `context_packet.v1`. These are types only — no
 * persistence, no PERSISTENCE, no LLM. They conform to and extend the ratified
 * `KNOWLEDGE_INGESTION_PROTOCOL` / `KNOWLEDGE_CORE_RUNTIME` and ACR-0008 (author fast-lane).
 *
 * Contract (see engineering/reports/P4_5A_KNOWLEDGE_INTAKE_PARSING_CONTRACT.md):
 *   Raw source is authority. Parsed chunks are retrieval units. Context Packets consume
 *   relevant chunks. Agents never browse the raw knowledge pool directly.
 *
 * The producer side mirrors the existing P4.2 `KnowledgeReference` consumer shape: an eligible
 * `KnowledgeChunk` maps 1:1 to a `KnowledgeReference`, so Kevin-added knowledge flows through
 * the existing P4.4 retrieval adapter and P4.5 packet assembly unchanged.
 */

import type { McsRuntimeLanguage } from './language.js';
import type { McsKnowledgeDomain } from './knowledge.js';
import type { McsRuntimeScope } from './identity.js';
import type { McsAgentKey } from './agents.js';
import type { McsKnowledgeId, McsSourceId } from './ids.js';

/** Parseable intake formats. Owned-text family only in P4.5A (media/reference are Phase 8). */
export type McsKnowledgeIntakeFormat = 'plain_text' | 'markdown' | 'html';

/**
 * Semantic origin of an owned-text source (ACR-0008 owned-text family). Owned-media and
 * third-party reference source types are deliberately NOT included in P4.5A — they require
 * GridFS / transcription / reference handling that is Phase 8.
 */
export type McsKnowledgeSourceType = 'tm_training_page' | 'note' | 'owned_text';

/** Lifecycle of a raw source. Only `active` sources yield retrieval-eligible chunks. */
export type McsRawKnowledgeStatus = 'active' | 'deprecated' | 'archived' | 'rejected';

/**
 * The original knowledge exactly as Kevin added it — the single point of authority and
 * traceability. `originalContent` is preserved verbatim and never mutated by parsing.
 */
export interface McsRawKnowledgeSource {
  sourceId: McsSourceId;
  title: string;
  sourceType: McsKnowledgeSourceType;
  format: McsKnowledgeIntakeFormat;
  /** Verbatim original content — authority; never rewritten. */
  originalContent: string;
  /** Optional pointer to an external owned location (e.g. a GitHub training-page path). */
  sourceRef?: string;
  createdBy: string;
  /** ISO-8601 timestamp. */
  createdAt: string;
  language: McsRuntimeLanguage;
  domain: McsKnowledgeDomain;
  /** Team Magnificent scope (tenant/team always TM; optional BA). */
  scope: McsRuntimeScope;
  /** Monotonic content version. New content = new version; prior versions are supersedable. */
  version: number;
  status: McsRawKnowledgeStatus;
}

/** Outcome of deterministic parsing. */
export type McsParseStatus = 'parsed' | 'parsed_with_warnings' | 'parse_failed';

/**
 * A detected section of normalized text. A `heading: null`, `level: 0` section is the preamble
 * before the first heading (or the whole document for `plain_text`).
 */
export interface McsDetectedSection {
  heading: string | null;
  level: number;
  text: string;
  /** Offsets into `ParsedKnowledgeDocument.normalizedText`. */
  startOffset: number;
  endOffset: number;
}

export interface McsParsedDocumentMetadata {
  language: McsRuntimeLanguage;
  domain: McsKnowledgeDomain;
  sourceType: McsKnowledgeSourceType;
  format: McsKnowledgeIntakeFormat;
  title: string;
  sectionCount: number;
  characterCount: number;
}

/** The normalized, section-detected projection of a raw source. Does not replace the source. */
export interface McsParsedKnowledgeDocument {
  /** Deterministic id derived from `sourceId` + `sourceVersion`. */
  documentId: string;
  sourceId: McsSourceId;
  sourceVersion: number;
  normalizedText: string;
  detectedSections: readonly McsDetectedSection[];
  metadata: McsParsedDocumentMetadata;
  parseStatus: McsParseStatus;
  parseWarnings: readonly string[];
}

/** Surfaces a chunk may serve. `com` is intentionally absent — compliance: never on `.com`. */
export type McsKnowledgeSurfaceScope = 'team' | 'admin';

/** Lifecycle of a derived chunk. Only `active` chunks are retrieval-eligible. */
export type McsKnowledgeChunkStatus =
  | 'active'
  | 'deprecated'
  | 'archived'
  | 'rejected'
  | 'parse_failed';

export interface McsChunkSourceOffsets {
  /** Offsets into the parent `ParsedKnowledgeDocument.normalizedText`. */
  startOffset: number;
  endOffset: number;
}

/** A retrieval unit. Points back to its parsed document and raw source. */
export interface McsKnowledgeChunk {
  /** Deterministic id derived from `sourceId` + `sourceVersion` + `chunkIndex`. */
  chunkId: string;
  sourceId: McsSourceId;
  documentId: string;
  sourceVersion: number;
  heading: string | null;
  text: string;
  /** Document-global index in reading order (0..n). */
  chunkIndex: number;
  language: McsRuntimeLanguage;
  domain: McsKnowledgeDomain;
  scope: McsRuntimeScope;
  topicTags: readonly string[];
  /** Which agents may use this chunk. */
  agentScopes: readonly McsAgentKey[];
  /** Surfaces this chunk may serve — never `com`. */
  surfaceScopes: readonly McsKnowledgeSurfaceScope[];
  sourceOffsets: McsChunkSourceOffsets;
  status: McsKnowledgeChunkStatus;
  retrievalEligible: boolean;
}

export type McsKnowledgeIndexRecordStatus = 'indexed' | 'excluded';

export interface McsKnowledgeIndexMetadata {
  language: McsRuntimeLanguage;
  domain: McsKnowledgeDomain;
  heading: string | null;
  topicTags: readonly string[];
  agentScopes: readonly McsAgentKey[];
  surfaceScopes: readonly McsKnowledgeSurfaceScope[];
  sourceVersion: number;
}

/**
 * Index-ready projection of a chunk. `searchableText` is the chunk text verbatim (no embedding
 * or summarization in P4.5A — vector/graph indexing is Phase 8). `knowledgeId` is the id used
 * when the chunk is mapped to a `KnowledgeReference`.
 */
export interface McsKnowledgeIndexRecord {
  indexRecordId: string;
  chunkId: string;
  sourceId: McsSourceId;
  documentId: string;
  searchableText: string;
  metadata: McsKnowledgeIndexMetadata;
  /** Stable composite retrieval key: `{domain}:{language}:{chunkId}`. */
  retrievalKey: string;
  knowledgeId: McsKnowledgeId;
  status: McsKnowledgeIndexRecordStatus;
}

/** Inputs that decide chunk retrieval-eligibility at request time. */
export interface McsKnowledgeChunkEligibilityRequest {
  scope: McsRuntimeScope;
  language: McsRuntimeLanguage;
  /** Carried for P4.6; inert in P4.5A (same-language only). */
  allowLanguageFallback?: boolean;
}
