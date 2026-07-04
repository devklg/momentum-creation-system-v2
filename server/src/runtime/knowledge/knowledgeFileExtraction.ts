/**
 * Knowledge Base file extraction.
 *
 * Converts Kevin-uploaded source files into plain text before the governed
 * knowledge intake pipeline chunks and triple-stacks them.
 */

import mammoth from 'mammoth';
import { PDFParse } from 'pdf-parse';

export type KnowledgeUploadFileKind =
  | 'plain_text'
  | 'markdown'
  | 'csv'
  | 'json'
  | 'html'
  | 'pdf'
  | 'docx';

export interface ExtractKnowledgeFileInput {
  filename: string;
  mimeType?: string;
  bytes: Buffer;
}

export interface ExtractKnowledgeFileResult {
  kind: KnowledgeUploadFileKind;
  content: string;
}

export class KnowledgeFileExtractionError extends Error {
  constructor(
    public readonly code:
      | 'unsupported_file_type'
      | 'empty_file'
      | 'extraction_failed',
    message: string,
  ) {
    super(`[knowledge-file] ${message}`);
    this.name = 'KnowledgeFileExtractionError';
  }
}

const TEXT_EXTENSIONS = new Set(['txt', 'text']);
const MARKDOWN_EXTENSIONS = new Set(['md', 'markdown']);
const CSV_EXTENSIONS = new Set(['csv', 'tsv']);
const JSON_EXTENSIONS = new Set(['json']);
const HTML_EXTENSIONS = new Set(['html', 'htm']);

export async function extractKnowledgeFile(
  input: ExtractKnowledgeFileInput,
): Promise<ExtractKnowledgeFileResult> {
  if (input.bytes.length === 0) {
    throw new KnowledgeFileExtractionError('empty_file', 'Uploaded file is empty.');
  }

  const kind = resolveFileKind(input.filename, input.mimeType);
  try {
    const content = await extractByKind(kind, input.bytes);
    const normalized = normalizeExtractedText(content);
    if (!normalized) {
      throw new KnowledgeFileExtractionError('empty_file', 'No text could be extracted.');
    }
    return { kind, content: normalized };
  } catch (err) {
    if (err instanceof KnowledgeFileExtractionError) throw err;
    throw new KnowledgeFileExtractionError(
      'extraction_failed',
      err instanceof Error ? err.message : String(err),
    );
  }
}

export function resolveFileKind(
  filename: string,
  mimeType?: string,
): KnowledgeUploadFileKind {
  const extension = filename.split('.').pop()?.trim().toLowerCase() ?? '';
  const mime = mimeType?.trim().toLowerCase() ?? '';

  if (TEXT_EXTENSIONS.has(extension) || mime.startsWith('text/plain')) return 'plain_text';
  if (MARKDOWN_EXTENSIONS.has(extension) || mime === 'text/markdown') return 'markdown';
  if (CSV_EXTENSIONS.has(extension) || mime === 'text/csv') return 'csv';
  if (JSON_EXTENSIONS.has(extension) || mime === 'application/json') return 'json';
  if (HTML_EXTENSIONS.has(extension) || mime === 'text/html') return 'html';
  if (extension === 'pdf' || mime === 'application/pdf') return 'pdf';
  if (
    extension === 'docx' ||
    mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ) {
    return 'docx';
  }

  throw new KnowledgeFileExtractionError(
    'unsupported_file_type',
    `Unsupported knowledge upload type: ${extension || mime || 'unknown'}.`,
  );
}

async function extractByKind(
  kind: KnowledgeUploadFileKind,
  bytes: Buffer,
): Promise<string> {
  switch (kind) {
    case 'plain_text':
    case 'markdown':
    case 'csv':
      return bytes.toString('utf8');
    case 'json':
      return normalizeJsonText(bytes.toString('utf8'));
    case 'html':
      return stripHtml(bytes.toString('utf8'));
    case 'pdf':
      return extractPdf(bytes);
    case 'docx':
      return extractDocx(bytes);
  }
}

function normalizeJsonText(text: string): string {
  try {
    return JSON.stringify(JSON.parse(text), null, 2);
  } catch {
    return text;
  }
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]{2,}/g, ' ');
}

async function extractPdf(bytes: Buffer): Promise<string> {
  const parser = new PDFParse({ data: new Uint8Array(bytes) });
  try {
    const result = await parser.getText();
    return result.text;
  } finally {
    await parser.destroy();
  }
}

async function extractDocx(bytes: Buffer): Promise<string> {
  const result = await mammoth.extractRawText({ buffer: bytes });
  return result.value;
}

function normalizeExtractedText(text: string): string {
  return text
    .replace(/\u0000/g, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{4,}/g, '\n\n\n')
    .trim();
}
