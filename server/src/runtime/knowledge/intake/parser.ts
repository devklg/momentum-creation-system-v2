/**
 * Deterministic knowledge parser (Phase 4 — P4.5A).
 *
 * Transforms a `RawKnowledgeSource` into a `ParsedKnowledgeDocument` using ONLY deterministic
 * operations: strip unsafe markup, normalize whitespace, detect headings, split into sections.
 * It NEVER rewrites Kevin's meaning, summarizes, invents text, or uses any LLM. The raw
 * source's `originalContent` is read but never mutated — raw source is authority.
 */

import type {
  DetectedSection,
  ParsedKnowledgeDocument,
  ParseStatus,
  RawKnowledgeSource,
} from '@momentum/shared/runtime';
import { deriveDocumentId } from './ids.js';

interface LineToken {
  readonly text: string;
  readonly start: number;
  readonly end: number;
  readonly isHeading: boolean;
  readonly level: number;
  readonly headingText: string;
}

/** Collapse intra-line whitespace, trim line ends, collapse blank runs, trim document ends. */
function normalizeWhitespace(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map((line) => line.replace(/[ \t]+/g, ' ').replace(/[ \t]+$/g, ''))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function decodeEntities(text: string): string {
  return text
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&');
}

function stripTags(text: string): string {
  return text.replace(/<[^>]*>/g, '');
}

/**
 * Strip HTML to text, converting `<h1..h6>` to markdown-style heading markers so the shared
 * section splitter can detect them. `<script>`/`<style>` blocks are removed entirely (unsafe
 * markup). Entity decoding happens after tag stripping so decoded `<`/`>` can never re-form
 * tags.
 */
function htmlToText(html: string): string {
  let text = html;
  text = text.replace(/<script[\s\S]*?<\/script>/gi, '');
  text = text.replace(/<style[\s\S]*?<\/style>/gi, '');
  text = text.replace(/<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi, (_match, level: string, inner: string) => {
    const hashes = '#'.repeat(Number(level));
    return `\n${hashes} ${stripTags(inner).trim()}\n`;
  });
  text = text.replace(/<(?:br|\/p|\/div|\/li|\/h[1-6]|\/tr|\/table|\/ul|\/ol)\s*\/?>/gi, '\n');
  text = stripTags(text);
  return decodeEntities(text);
}

function tokenizeLines(normalized: string): LineToken[] {
  const tokens: LineToken[] = [];
  let cursor = 0;
  for (const line of normalized.split('\n')) {
    const start = cursor;
    const end = cursor + line.length;
    const match = /^(#{1,6})\s+(.*)$/.exec(line);
    tokens.push({
      text: line,
      start,
      end,
      isHeading: match !== null,
      level: match ? (match[1]?.length ?? 0) : 0,
      headingText: match ? (match[2]?.trim() ?? '') : '',
    });
    cursor = end + 1; // account for the '\n' the split removed
  }
  return tokens;
}

interface OpenSection {
  heading: string | null;
  level: number;
  bodyStart: number;
  bodyEnd: number;
  hasBody: boolean;
}

function detectSections(normalized: string): DetectedSection[] {
  if (normalized.length === 0) return [];

  const tokens = tokenizeLines(normalized);
  const sections: DetectedSection[] = [];
  let current: OpenSection | null = { heading: null, level: 0, bodyStart: 0, bodyEnd: 0, hasBody: false };

  const close = (): void => {
    if (!current) return;
    sections.push({
      heading: current.heading,
      level: current.level,
      text: normalized.slice(current.bodyStart, current.bodyEnd).trim(),
      startOffset: current.bodyStart,
      endOffset: current.bodyEnd,
    });
    current = null;
  };

  for (const token of tokens) {
    if (token.isHeading) {
      if (current && (current.heading !== null || current.hasBody)) {
        close();
      } else {
        current = null; // discard an empty leading preamble
      }
      current = {
        heading: token.headingText,
        level: token.level,
        bodyStart: Math.min(token.end + 1, normalized.length),
        bodyEnd: Math.min(token.end + 1, normalized.length),
        hasBody: false,
      };
    } else if (current) {
      current.bodyEnd = token.end;
      if (token.text.trim().length > 0) current.hasBody = true;
    }
  }
  close();

  return sections.filter((section) => section.heading !== null || section.text.length > 0);
}

export function parseRawKnowledgeSource(source: RawKnowledgeSource): ParsedKnowledgeDocument {
  const warnings: string[] = [];

  let pre = source.originalContent ?? '';
  if (source.format === 'html') {
    if (/<script|<style/i.test(pre)) {
      warnings.push('Unsafe markup (script/style) stripped during parse.');
    }
    pre = htmlToText(pre);
  }

  const normalizedText = normalizeWhitespace(pre);
  const detectedSections = detectSections(normalizedText);

  let parseStatus: ParseStatus;
  if (normalizedText.trim().length === 0) {
    warnings.push('Source produced no parseable text after normalization.');
    parseStatus = 'parse_failed';
  } else if (detectedSections.length === 0) {
    warnings.push('No sections could be detected.');
    parseStatus = 'parse_failed';
  } else {
    parseStatus = warnings.length > 0 ? 'parsed_with_warnings' : 'parsed';
  }

  return {
    documentId: deriveDocumentId(source.sourceId, source.version),
    sourceId: source.sourceId,
    sourceVersion: source.version,
    normalizedText,
    detectedSections,
    metadata: {
      language: source.language,
      domain: source.domain,
      sourceType: source.sourceType,
      format: source.format,
      title: source.title,
      sectionCount: detectedSections.length,
      characterCount: normalizedText.length,
    },
    parseStatus,
    parseWarnings: warnings,
  };
}
