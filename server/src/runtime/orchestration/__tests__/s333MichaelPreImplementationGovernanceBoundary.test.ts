import { readFileSync } from 'node:fs';
import { dirname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { MICHAEL_RESPONSE_CATALOG } from '../michaelResponseCatalog.js';

// ───────────────────────────────────────────────────────────────────────────
// S3.3 — Static governance boundary for the Michael response-contract hardening
// slice (Spanish lexical guardrails). The Spanish guardrails added to
// michaelResponseContract.ts are PURE, in-process text validation: they must
// introduce no persistence, no gateway/retrieval, no LLM, and no route wiring.
//
// This mirrors the static-scan style of
// s220MichaelRuntimeResolutionFacadeGovernanceBoundary.test.ts: source is read
// from disk, comments and (for code-token scans) string literals are stripped,
// and forbidden WIRING patterns must produce empty match arrays. The scan
// helpers are copied locally — never imported across test files. A closing
// runtime check confirms every catalog entry stays inert.
//
// Note: michaelResponseContract.ts carries defensive blocklist string literals
// (forbidden field names, ES/EN prohibited-term patterns) and the literal
// `'disabled'` / `'enabled'` enum values inside expectLiteral() calls. Code-token
// scans strip string literals first, so those literals never trip a wiring
// regex; the persistence/agent-flag checks target object-property assignment
// shapes (`persistence: 'enabled'`), which the source never contains.
// ───────────────────────────────────────────────────────────────────────────

const orchestrationRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = resolve(orchestrationRoot, '../../../..');

const contractFilePath = 'server/src/runtime/orchestration/michaelResponseContract.ts';

type SourceFile = {
  readonly relativePath: string;
  readonly text: string;
};

function normalizePath(path: string): string {
  return path.split(sep).join('/');
}

function readSourceFile(relativePath: string): SourceFile {
  return {
    relativePath: normalizePath(relativePath),
    text: readFileSync(resolve(repoRoot, relativePath), 'utf8'),
  };
}

function sourceWithoutComments(text: string): string {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/\s+\/\/.*$/gm, '');
}

function sourceWithoutCommentsOrStrings(text: string): string {
  return sourceWithoutComments(text)
    .replace(/`(?:\\.|[^`\\])*`/g, '""')
    .replace(/'(?:\\.|[^'\\])*'/g, '""')
    .replace(/"(?:\\.|[^"\\])*"/g, '""');
}

function linesFromSource(
  files: readonly SourceFile[],
  stripStrings: boolean,
): Array<{ readonly relativePath: string; readonly line: string; readonly lineNumber: number }> {
  return files.flatMap((file) =>
    (stripStrings ? sourceWithoutCommentsOrStrings(file.text) : sourceWithoutComments(file.text))
      .split(/\r?\n/)
      .map((line, index) => ({
        relativePath: file.relativePath,
        line,
        lineNumber: index + 1,
      }))
      .filter(({ line }) => line.trim().length > 0),
  );
}

function importLines(files: readonly SourceFile[]) {
  return linesFromSource(files, false).filter(({ line }) => /^\s*import\b/.test(line));
}

function matchingCodeTokenLines(files: readonly SourceFile[], pattern: RegExp): string[] {
  return linesFromSource(files, true)
    .filter(({ line }) => pattern.test(line))
    .map(({ relativePath, line, lineNumber }) => `${relativePath}:${lineNumber}: ${line.trim()}`);
}

function matchingImportLines(files: readonly SourceFile[], pattern: RegExp): string[] {
  return importLines(files)
    .filter(({ line }) => pattern.test(line))
    .map(({ relativePath, line, lineNumber }) => `${relativePath}:${lineNumber}: ${line.trim()}`);
}

function contractFiles(): SourceFile[] {
  return [readSourceFile(contractFilePath)];
}

describe('S3.3 Michael response-contract hardening static governance boundary', () => {
  it('#1 does not import a MongoDB client or model', () => {
    const pattern = /\bfrom\s+['"][^'"]*(?:^|\/|\\|@)(?:mongoose|mongodb)(?:$|\/|\\|['"])/i;
    const matches = matchingImportLines(contractFiles(), pattern);
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('#2 does not import a Neo4j driver or adapter', () => {
    const pattern = /\bfrom\s+['"][^'"]*(?:neo4j-driver|neo4j-adapter|\/adapters?\/neo4j)[^'"]*['"]/i;
    const matches = matchingImportLines(contractFiles(), pattern);
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('#3 does not import a ChromaDB client or adapter', () => {
    const pattern = /\bfrom\s+['"][^'"]*(?:chromadb|chroma-client|\/adapters?\/chroma)[^'"]*['"]/i;
    const matches = matchingImportLines(contractFiles(), pattern);
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('#4 does not import a GraphRAG client', () => {
    const pattern = /\bfrom\s+['"][^'"]*graph-?rag[^'"]*['"]/i;
    const matches = matchingImportLines(contractFiles(), pattern);
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('#5 does not import a Gateway client / retrieval helper, or call gatewayCall', () => {
    const importPattern =
      /\bfrom\s+['"][^'"]*(?:\/services\/gateway|gatewayFallback|gateway-fallback|tripleStack|rawRetrieval|retrievalHelper|directRetrieval|\/retrieval\b)[^'"]*['"]/i;
    const callPattern = /\b(?:gatewayCall|directPersistenceCall|buildContextPacket)\s*\(/;
    const matches = [
      ...matchingImportLines(contractFiles(), importPattern),
      ...matchingCodeTokenLines(contractFiles(), callPattern),
    ];
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('#6 does not import an OpenAI / Anthropic / Claude client', () => {
    const pattern =
      /\bfrom\s+['"][^'"]*(?:^|\/|\\|@)(?:openai|anthropic|@anthropic-ai)(?:$|\/|\\|['"])|\bfrom\s+['"][^'"]*(?:\/services\/anthropic|\/services\/openai|\/services\/claude)[^'"]*['"]/i;
    const matches = matchingImportLines(contractFiles(), pattern);
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('#7 does not call an LLM provider', () => {
    const pattern =
      /\b(?:chatCompletion|messages\.create|responses\.create|createCompletion|createChatCompletion)\s*\(/i;
    const matches = matchingCodeTokenLines(contractFiles(), pattern);
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('#8 does not create route-like handlers', () => {
    const importPattern = /\bfrom\s+['"](?:express|fastify)['"]/i;
    const callPattern =
      /\b(?:express\s*\(|Router\s*\(|fastify\s*\(|app\.(?:use|get|post|put|patch|delete)\s*\(|router\.(?:use|get|post|put|patch|delete)\s*\()/i;
    const matches = [
      ...matchingImportLines(contractFiles(), importPattern),
      ...matchingCodeTokenLines(contractFiles(), callPattern),
    ];
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('#9 does not introduce persistence call shapes', () => {
    const pattern =
      /\b(?:persistResponse|saveResponse|writeResponse|persistOutcome|saveOutcome|writeOutcome|persistTranscript|saveTranscript|writeTranscript|persistRuntimeEvent|saveRuntimeEvent|writeRuntimeEvent|responseRepository|responseStore|outcomeStore)\s*\(/i;
    const matches = matchingCodeTokenLines(contractFiles(), pattern);
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('#10 does not assign persistence: "enabled" anywhere in the contract source', () => {
    const source = sourceWithoutComments(readSourceFile(contractFilePath).text);
    expect(source).not.toMatch(/persistence:\s*['"]enabled['"]/);
  });

  it('#11 does not assign agentResponseGenerated: true anywhere in the contract source', () => {
    const source = sourceWithoutComments(readSourceFile(contractFilePath).text);
    expect(source).not.toMatch(/agentResponseGenerated:\s*true/);
  });

  it('#12 keeps every MICHAEL_RESPONSE_CATALOG entry inert (agentResponseGenerated false, persistence disabled)', () => {
    expect(MICHAEL_RESPONSE_CATALOG.length).toBeGreaterThan(0);
    for (const entry of MICHAEL_RESPONSE_CATALOG) {
      expect(entry.response.agentResponseGenerated, entry.catalogKey).toBe(false);
      expect(entry.response.persistence, entry.catalogKey).toBe('disabled');
    }
  });
});
