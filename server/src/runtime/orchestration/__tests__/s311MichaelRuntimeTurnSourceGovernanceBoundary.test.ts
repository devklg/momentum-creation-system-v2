import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// ---------------------------------------------------------------------------
// Sprint 3 S3.11 — static source-scanning governance boundary test for the
// server-owned Michael runtime TURN SOURCE
// (server/src/runtime/orchestration/michaelRuntimeTurnSource.ts) and its
// sanctioned CONTEXT-LAYER foundation
// (server/src/runtime/context/michaelRuntimeContextFoundation.ts).
//
// The load-bearing invariant: Context Packet ASSEMBLY lives in the CONTEXT layer
// (the Context Manager is the only assembler), NEVER in orchestration. The
// foundation calls `buildContextPacket(...)` and stamps `assembledBy:
// 'context_manager'`; the orchestration turn source assembles NOTHING — it
// injects the context-layer port and references neither `buildContextPacket` nor
// `ContextPacketBuildInput` (consistent with S2.1 / S2.4). Both modules are
// boundary-clean (no store / Gateway / GraphRAG / retrieval / harness import)
// and preserve the degraded, fail-closed, non-persistent, response-free posture.
//
// Mirrors the proven static-scan style of the sibling orchestration boundary
// tests: source is read off disk, comments (and, for code-token scans, string
// literals) are stripped, and forbidden patterns must produce empty match
// arrays. Positive INVARIANT-literal assertions keep string literals (strip
// comments only). It does NOT import or modify production code; scan helpers are
// copied locally.
// ---------------------------------------------------------------------------

const orchestrationRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = resolve(orchestrationRoot, '../../../..');

const turnSourceFilePath = 'server/src/runtime/orchestration/michaelRuntimeTurnSource.ts';
const foundationFilePath = 'server/src/runtime/context/michaelRuntimeContextFoundation.ts';

type SourceFile = {
  readonly relativePath: string;
  readonly text: string;
};

function readSourceFile(relativePath: string): SourceFile {
  const absolute = resolve(repoRoot, relativePath);
  if (!existsSync(absolute)) {
    throw new Error(`S3.11 turn-source boundary test: required source not found at ${relativePath}`);
  }
  return { relativePath, text: readFileSync(absolute, 'utf8') };
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
      .map((line, index) => ({ relativePath: file.relativePath, line, lineNumber: index + 1 }))
      .filter(({ line }) => line.trim().length > 0),
  );
}

function importLines(files: readonly SourceFile[]) {
  return linesFromSource(files, false).filter(({ line }) => /^\s*import\b/.test(line));
}

// Code-token scan: comments AND string literals stripped (identifiers only).
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

function turnSourceFiles(): SourceFile[] {
  return [readSourceFile(turnSourceFilePath)];
}

function foundationFiles(): SourceFile[] {
  return [readSourceFile(foundationFilePath)];
}

function bothFiles(): SourceFile[] {
  return [readSourceFile(turnSourceFilePath), readSourceFile(foundationFilePath)];
}

// Invariant-literal presence: strip comments only (keep string literals such as
// 'michael_magnificent' / 'degraded') and require a match somewhere in the file.
function containsInvariant(file: SourceFile, pattern: RegExp): boolean {
  return pattern.test(sourceWithoutComments(file.text));
}

// ---------------------------------------------------------------------------
// GROUP 0 — both target sources resolve off disk.
// ---------------------------------------------------------------------------
describe('S3.11 turn-source target sources exist', () => {
  it('#0 orchestration turn source and context foundation are found on disk', () => {
    for (const rel of [turnSourceFilePath, foundationFilePath]) {
      expect(existsSync(resolve(repoRoot, rel)), `${rel} not found`).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// GROUP A — assembly lives in the CONTEXT layer, not orchestration.
// ---------------------------------------------------------------------------
describe('S3.11 Context Packet assembly stays in the context layer', () => {
  it('#1 the foundation assembles via buildContextPacket', () => {
    const foundation = readSourceFile(foundationFilePath);
    // Imported from the context manager and actually called.
    const importMatch = matchingImportLines(
      foundationFiles(),
      /\bbuildContextPacket\b[\s\S]*?from\s+['"]\.\/contextManager\.js['"]/,
    );
    expect(importMatch.length, importMatch.join('\n')).toBeGreaterThan(0);
    expect(/\bbuildContextPacket\s*\(/.test(sourceWithoutComments(foundation.text)), 'buildContextPacket called').toBe(
      true,
    );
  });

  it("#2 the foundation stamps assembledBy: 'context_manager'", () => {
    const foundation = readSourceFile(foundationFilePath);
    expect(
      /assembledBy\s*:\s*['"]context_manager['"]/.test(sourceWithoutComments(foundation.text)),
      "assembledBy: 'context_manager' present",
    ).toBe(true);
  });

  it('#3 the orchestration turn source references NO buildContextPacket / ContextPacketBuildInput (S2.1/S2.4)', () => {
    const matches = matchingCodeTokenLines(
      turnSourceFiles(),
      /\b(?:buildContextPacket|ContextPacketBuildInput)\b/,
    );
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('#4 the orchestration turn source DELEGATES assembly by injecting the context-layer port', () => {
    const importMatch = matchingImportLines(
      turnSourceFiles(),
      /\bcreateMichaelRuntimeContextManagerPort\b[\s\S]*?from\s+['"]\.\.\/context\/index\.js['"]/,
    );
    expect(importMatch.length, importMatch.join('\n')).toBeGreaterThan(0);
    const calls = matchingCodeTokenLines(
      turnSourceFiles(),
      /\bcreateMichaelRuntimeContextManagerPort\s*\(/,
    );
    expect(calls.length, calls.join('\n')).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// GROUP B — boundary-clean: no store / Gateway / GraphRAG / retrieval / harness.
// ---------------------------------------------------------------------------
describe('S3.11 turn-source / foundation boundary cleanliness', () => {
  it('#5 neither module imports a store / Gateway / GraphRAG / retrieval client', () => {
    const pattern =
      /\bfrom\s+['"][^'"]*(?:mongoose|mongodb|neo4j|chromadb|chroma-client|graph-?rag|\/services\/gateway|gatewayFallback|gateway-fallback|\/tripleStack|rawRetrieval|retrievalHelper|directRetrieval|\/retrieval\b)[^'"]*['"]/i;
    const matches = matchingImportLines(bothFiles(), pattern);
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('#6 neither module imports the S2.13 fixtures / harness', () => {
    const importMatches = matchingImportLines(
      bothFiles(),
      /\bfrom\s+['"][^'"]*(?:\/fixtures|harness)[^'"]*['"]/i,
    );
    const tokenMatches = matchingCodeTokenLines(
      bothFiles(),
      /\b(?:michaelRuntimeResponseHarness|michaelRuntimeResponseScenarios|createMichaelRuntimeResponseFixtureHarness|createRuntimeTurnFixtureHarness|runRuntimeTurnFixtureScenario)\s*\(/,
    );
    const matches = [...importMatches, ...tokenMatches];
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('#7 neither module introduces persistence write or LLM call shapes', () => {
    const pattern =
      /\.(?:insert|update|save)\s*\(|\b(?:tripleStackWrite|gatewayCall|chatCompletion|createChatCompletion)\s*\(|messages\.create\s*\(/i;
    const matches = matchingCodeTokenLines(bothFiles(), pattern);
    expect(matches, matches.join('\n')).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// GROUP C — degraded / fail-closed / non-persistent / response-free invariants.
// ---------------------------------------------------------------------------
describe('S3.11 turn-source degraded fail-closed invariants', () => {
  it("#8 the turn source is scoped to Michael (michael_magnificent / training_support)", () => {
    const turnSource = readSourceFile(turnSourceFilePath);
    expect(containsInvariant(turnSource, /['"]michael_magnificent['"]/), 'agent key present').toBe(
      true,
    );
    expect(containsInvariant(turnSource, /['"]training_support['"]/), 'task type present').toBe(true);
  });

  it("#9 the turn source preserves the degraded fail-closed decision", () => {
    const turnSource = readSourceFile(turnSourceFilePath);
    // Fail-closed gate: anything other than a degraded decision returns issues.
    expect(
      /decision\s*!==\s*['"]degraded['"]/.test(sourceWithoutComments(turnSource.text)),
      'degraded fail-closed gate present',
    ).toBe(true);
    expect(containsInvariant(turnSource, /['"]degraded['"]/), "degraded literal present").toBe(true);
  });

  it("#10 the turn source stays non-persistent (persistence: 'disabled')", () => {
    const turnSource = readSourceFile(turnSourceFilePath);
    expect(
      containsInvariant(turnSource, /persistence\s*:\s*['"]disabled['"]/),
      "persistence: 'disabled' present",
    ).toBe(true);
  });

  it('#11 the turn source generates no agent response (agentResponseGenerated: false)', () => {
    const turnSource = readSourceFile(turnSourceFilePath);
    expect(
      containsInvariant(turnSource, /agentResponseGenerated\s*:\s*false/),
      'agentResponseGenerated: false present',
    ).toBe(true);
    expect(
      /agentResponseGenerated\s*:\s*true/.test(sourceWithoutComments(turnSource.text)),
      'never agentResponseGenerated: true',
    ).toBe(false);
  });

  it("#12 the foundation stamps the degraded packet status (packetStatus: 'degraded')", () => {
    const foundation = readSourceFile(foundationFilePath);
    expect(
      containsInvariant(foundation, /packetStatus\s*:\s*['"]degraded['"]/),
      "packetStatus: 'degraded' present",
    ).toBe(true);
  });
});
