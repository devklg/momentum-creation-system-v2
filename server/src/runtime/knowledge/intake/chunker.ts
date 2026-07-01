/**
 * Deterministic knowledge chunker (Phase 4 — P4.5A).
 *
 * Splits a `ParsedKnowledgeDocument` into `KnowledgeChunk[]` retrieval units. Splitting is
 * deterministic (paragraph → sentence/word greedy packing under a char bound) and never merges
 * across section boundaries. Each chunk carries forward source metadata and points back to its
 * parsed document and raw source. No summarization, no LLM, no persistence.
 */

import type {
  McsDetectedSection,
  McsKnowledgeChunk,
  McsKnowledgeChunkStatus,
  McsKnowledgeSurfaceScope,
  McsParsedKnowledgeDocument,
  McsRawKnowledgeSource,
} from '@momentum/shared/runtime';
import type { McsAgentKey, McsKnowledgeDomain } from '@momentum/shared/runtime';
import { deriveChunkId } from './ids.js';

export const DEFAULT_MAX_CHUNK_CHARS = 1200;

/** Optional classification applied to every chunk of a source. Deterministic defaults below. */
export interface KnowledgeIntakeClassification {
  topicTags?: readonly string[];
  agentScopes?: readonly McsAgentKey[];
  surfaceScopes?: readonly McsKnowledgeSurfaceScope[];
}

export interface ChunkOptions {
  maxChunkChars?: number;
  classification?: KnowledgeIntakeClassification;
}

interface Span {
  text: string;
  start: number;
  end: number;
}

/** Map a knowledge domain to the agents that own it; unowned domains are visible to all. */
function defaultAgentScopes(domain: McsKnowledgeDomain): readonly McsAgentKey[] {
  switch (domain) {
    case 'success':
      return ['steve_success'];
    case 'training':
      return ['michael_magnificent'];
    case 'relationship':
      return ['ivory'];
    default:
      return ['steve_success', 'michael_magnificent', 'ivory'];
  }
}

/** Map a raw-source status to the derived chunk status. */
function chunkStatusFromSource(status: McsRawKnowledgeSource['status']): McsKnowledgeChunkStatus {
  return status; // 'active' | 'deprecated' | 'archived' | 'rejected' are shared between the two
}

function splitParagraphs(text: string): Span[] {
  const segments: Span[] = [];
  const paragraphRegex = /\n[ \t]*\n/g;
  let last = 0;
  let match: RegExpExecArray | null;
  while ((match = paragraphRegex.exec(text)) !== null) {
    segments.push({ text: text.slice(last, match.index), start: last, end: match.index });
    last = match.index + match[0].length;
  }
  segments.push({ text: text.slice(last), start: last, end: text.length });
  return segments.filter((segment) => segment.text.trim().length > 0);
}

/** Hard-split an oversize segment on word boundaries, keeping each window within `max`. */
function hardSplit(segment: Span, max: number): Span[] {
  const words: Span[] = [];
  const wordRegex = /\S+/g;
  let match: RegExpExecArray | null;
  while ((match = wordRegex.exec(segment.text)) !== null) {
    words.push({
      text: match[0],
      start: segment.start + match.index,
      end: segment.start + match.index + match[0].length,
    });
  }
  if (words.length === 0) return [];

  const windows: Span[] = [];
  const first = words[0]!;
  let curStart = first.start;
  let curEnd = first.end;
  for (let index = 1; index < words.length; index += 1) {
    const word = words[index]!;
    if (word.end - curStart > max) {
      windows.push({ text: '', start: curStart, end: curEnd });
      curStart = word.start;
      curEnd = word.end;
    } else {
      curEnd = word.end;
    }
  }
  windows.push({ text: '', start: curStart, end: curEnd });
  return windows;
}

/** Greedy pack paragraphs into <= max windows; oversize paragraphs are hard-split. */
function splitSection(sectionText: string, max: number): Span[] {
  if (sectionText.trim().length === 0) return [];

  const pieces: Span[] = [];
  let buffer: Span | null = null;
  const flush = (): void => {
    if (buffer && buffer.text.trim().length > 0) pieces.push(buffer);
    buffer = null;
  };

  for (const paragraph of splitParagraphs(sectionText)) {
    if (paragraph.text.length > max) {
      flush();
      for (const window of hardSplit(paragraph, max)) {
        pieces.push({
          text: sectionText.slice(window.start, window.end).trim(),
          start: window.start,
          end: window.end,
        });
      }
      continue;
    }
    if (!buffer) {
      buffer = { text: paragraph.text, start: paragraph.start, end: paragraph.end };
    } else if (paragraph.end - buffer.start <= max) {
      buffer = {
        text: sectionText.slice(buffer.start, paragraph.end),
        start: buffer.start,
        end: paragraph.end,
      };
    } else {
      flush();
      buffer = { text: paragraph.text, start: paragraph.start, end: paragraph.end };
    }
  }
  flush();

  return pieces.map((piece) => ({ ...piece, text: piece.text.trim() }));
}

export function chunkParsedDocument(
  source: McsRawKnowledgeSource,
  document: McsParsedKnowledgeDocument,
  options: ChunkOptions = {},
): McsKnowledgeChunk[] {
  if (document.parseStatus === 'parse_failed') return [];

  const max = options.maxChunkChars ?? DEFAULT_MAX_CHUNK_CHARS;
  const classification = options.classification ?? {};
  const topicTags = classification.topicTags ?? [];
  const agentScopes = classification.agentScopes ?? defaultAgentScopes(source.domain);
  const surfaceScopes: readonly McsKnowledgeSurfaceScope[] = classification.surfaceScopes ?? ['team'];
  const status = chunkStatusFromSource(source.status);
  const retrievalEligible = status === 'active';

  const chunks: McsKnowledgeChunk[] = [];
  let chunkIndex = 0;

  for (const section of document.detectedSections) {
    const pieces = piecesForSection(section, max);
    for (const piece of pieces) {
      const chunkId = deriveChunkId(source.sourceId, source.version, chunkIndex);
      chunks.push({
        chunkId,
        sourceId: source.sourceId,
        documentId: document.documentId,
        sourceVersion: source.version,
        heading: section.heading,
        text: piece.text,
        chunkIndex,
        language: source.language,
        domain: source.domain,
        scope: source.scope,
        topicTags,
        agentScopes,
        surfaceScopes,
        sourceOffsets: {
          startOffset: section.startOffset + piece.start,
          endOffset: section.startOffset + piece.end,
        },
        status,
        retrievalEligible,
      });
      chunkIndex += 1;
    }
  }

  return chunks;
}

/** A heading-only section still yields one (empty-body) chunk so the heading is addressable. */
function piecesForSection(section: McsDetectedSection, max: number): Span[] {
  const pieces = splitSection(section.text, max);
  if (pieces.length > 0) return pieces;
  if (section.heading !== null) return [{ text: '', start: 0, end: 0 }];
  return [];
}
