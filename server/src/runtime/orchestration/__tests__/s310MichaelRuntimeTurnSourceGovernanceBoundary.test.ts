import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// ---------------------------------------------------------------------------
// Sprint 3 S3.10 — static source-scanning governance boundary test for the
// SERVER-OWNED Michael runtime TURN SOURCE
// (server/src/runtime/orchestration/michaelRuntimeTurnSource.ts, Agent B).
//
// This file mirrors the proven static-scan style of
//   server/src/routes/__tests__/s36MichaelRuntimeObservabilityGovernanceBoundary.test.ts
// and
//   server/src/routes/__tests__/s39MichaelRuntimeUiServerBoundary.test.ts:
// production source is read off disk, comments (and, for code-token scans,
// string literals) are stripped, and forbidden WIRING patterns must produce
// empty match arrays. Positive asserts confirm required wiring/invariants.
//
// Why stripping matters here: the turn source's documentation comments
// LEGITIMATELY mention banned identifiers to explain why they are absent —
// e.g. "no body tmagId/sponsorTmagId/targetTmagId", "imports NO store/Gateway/
// GraphRAG/retrieval client", "NEVER imports the S2.13 test harness". Those
// defensive doc-comment prohibitions (and string literals) must not trip a
// wiring regex, so the code-token scans strip comments AND strings first.
// Copy/copy-tone scans (income/placement/etc.) strip ONLY comments — string
// literals are exactly the copy we WANT to inspect.
//
// This file does NOT import or modify production code — it reads source text
// only. The scan helpers are copied locally (never imported across test
// files), matching the s34/s36/s39 private-helper convention.
//
// repoRoot is 5 levels up from this file:
//   __tests__ -> orchestration -> runtime -> src -> server -> <repo root>
// ---------------------------------------------------------------------------

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../../../..');

const turnSourceFilePath = 'server/src/runtime/orchestration/michaelRuntimeTurnSource.ts';
// S3.10 remediation — packet ASSEMBLY lives in the context layer (Context
// Manager), never in orchestration. The sanctioned factory is here:
const contextFoundationFilePath =
  'server/src/runtime/context/michaelRuntimeContextFoundation.ts';

type SourceFile = {
  readonly relativePath: string;
  readonly text: string;
};

function readSourceFile(relativePath: string): SourceFile {
  const absolute = resolve(repoRoot, relativePath);
  // Fail loudly if a target source moved — a silent "file not found" would let
  // the whole boundary suite pass vacuously.
  if (!existsSync(absolute)) {
    throw new Error(`S3.10 boundary test: required source not found at ${relativePath}`);
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

// Code-token scan: comments AND string literals stripped first, so defensive
// doc-comment prohibitions and string copy never trip a wiring regex.
function matchingCodeTokenLines(files: readonly SourceFile[], pattern: RegExp): string[] {
  return linesFromSource(files, true)
    .filter(({ line }) => pattern.test(line))
    .map(({ relativePath, line, lineNumber }) => `${relativePath}:${lineNumber}: ${line.trim()}`);
}

// Copy-tone scan: ONLY comments stripped, so user-facing string copy is still
// inspectable for banned vocabulary.
function matchingCopyLines(files: readonly SourceFile[], pattern: RegExp): string[] {
  return linesFromSource(files, false)
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

function contextFoundationFiles(): SourceFile[] {
  return [readSourceFile(contextFoundationFilePath)];
}

// ---------------------------------------------------------------------------
// GROUP 0 — the target source resolves off disk.
// ---------------------------------------------------------------------------
describe('S3.10 turn source exists', () => {
  it('#0 michaelRuntimeTurnSource.ts is found on disk', () => {
    expect(existsSync(resolve(repoRoot, turnSourceFilePath)), `${turnSourceFilePath} not found`).toBe(
      true,
    );
  });
});

// ---------------------------------------------------------------------------
// GROUP A — NO store / persistence client imports. The turn source is pure
// with respect to I/O: it imports NO Mongo/Neo4j/Chroma/GraphRAG/Gateway/
// tripleStack/retrieval client.
// ---------------------------------------------------------------------------
describe('S3.10 turn source store-free import boundary', () => {
  it('#1 does not import a MongoDB / Mongoose client', () => {
    const pattern = /\bfrom\s+['"][^'"]*(?:^|\/|\\|@)(?:mongoose|mongodb|mongo)(?:$|\/|\\|['"])/i;
    const matches = matchingImportLines(turnSourceFiles(), pattern);
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('#2 does not import a Neo4j driver or adapter', () => {
    const pattern =
      /\bfrom\s+['"][^'"]*(?:neo4j-driver|neo4j-adapter|\/adapters?\/neo4j|\/neo4j)[^'"]*['"]/i;
    const matches = matchingImportLines(turnSourceFiles(), pattern);
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('#3 does not import a ChromaDB client or adapter', () => {
    const pattern =
      /\bfrom\s+['"][^'"]*(?:chromadb|chroma-client|\/adapters?\/chroma|\/chroma)[^'"]*['"]/i;
    const matches = matchingImportLines(turnSourceFiles(), pattern);
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('#4 does not import a GraphRAG client', () => {
    const pattern = /\bfrom\s+['"][^'"]*graph-?rag[^'"]*['"]/i;
    const matches = matchingImportLines(turnSourceFiles(), pattern);
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('#5 does not import a Gateway/tripleStack client (or call gatewayCall/tripleStackWrite)', () => {
    const importPattern =
      /\bfrom\s+['"][^'"]*(?:\/services\/gateway|gatewayFallback|gateway-fallback|\/tripleStack)[^'"]*['"]/i;
    const callPattern = /\b(?:gatewayCall|tripleStackWrite|directPersistenceCall)\s*\(/;
    const matches = [
      ...matchingImportLines(turnSourceFiles(), importPattern),
      ...matchingCodeTokenLines(turnSourceFiles(), callPattern),
    ];
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('#6 does not import raw retrieval helpers or a store client', () => {
    const pattern =
      /\bfrom\s+['"][^'"]*(?:rawRetrieval|retrievalHelper|directRetrieval|\/retrieval\b|storeClient|\/store\/|\/persistence\b)[^'"]*['"]/i;
    const matches = matchingImportLines(turnSourceFiles(), pattern);
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('#7 does NOT import the S2.13 fixture harness (no fixtures/ path, no runtimeTurnHarness)', () => {
    const importPattern = /\bfrom\s+['"][^'"]*\/fixtures\/[^'"]*['"]/i;
    const harnessTokenPattern =
      /\b(?:runtimeTurnHarness|createRuntimeTurnFixtureHarness|runRuntimeTurnFixtureScenario|michaelRuntimeResponseHarness|createMichaelRuntimeResponseFixtureHarness)\b/;
    const matches = [
      ...matchingImportLines(turnSourceFiles(), importPattern),
      ...matchingCodeTokenLines(turnSourceFiles(), harnessTokenPattern),
    ];
    expect(matches, matches.join('\n')).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// GROUP B — NO persistence / fs write call shapes. The module never persists.
// ---------------------------------------------------------------------------
describe('S3.10 turn source persistence-free boundary', () => {
  it('#8 does not introduce persistence write call shapes (.insert/.update/.save/.create)', () => {
    const pattern = /\.(?:insert|update|save|create)\s*\(/i;
    const matches = matchingCodeTokenLines(turnSourceFiles(), pattern);
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('#9 does not import fs or write to the file system', () => {
    const importPattern = /\bfrom\s+['"](?:node:)?fs(?:\/promises)?['"]/i;
    const callPattern =
      /\b(?:writeFile|writeFileSync|appendFile|appendFileSync|createWriteStream)\s*\(/;
    const matches = [
      ...matchingImportLines(turnSourceFiles(), importPattern),
      ...matchingCodeTokenLines(turnSourceFiles(), callPattern),
    ];
    expect(matches, matches.join('\n')).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// GROUP C — NO LLM / telephony / voice wiring. Calls no LLM, generates no text.
// ---------------------------------------------------------------------------
describe('S3.10 turn source LLM/telephony-free boundary', () => {
  it('#10 does not import an OpenAI / Anthropic / Claude client', () => {
    const pattern =
      /\bfrom\s+['"][^'"]*(?:^|\/|\\|@)(?:openai|anthropic|@anthropic-ai)(?:$|\/|\\|['"])|\bfrom\s+['"][^'"]*(?:\/services\/anthropic|\/services\/openai|\/services\/claude)[^'"]*['"]/i;
    const matches = matchingImportLines(turnSourceFiles(), pattern);
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('#11 does not call an LLM provider', () => {
    const callPattern =
      /\b(?:chatCompletion|messages\.create|responses\.create|createCompletion|createChatCompletion)\s*\(/i;
    const tokenPattern = /\b(?:openai|anthropic|claude)\b/i;
    const matches = [
      ...matchingCodeTokenLines(turnSourceFiles(), callPattern),
      ...matchingCodeTokenLines(turnSourceFiles(), tokenPattern),
    ];
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('#12 does not wire Telnyx / PSTN / voice / call-control', () => {
    const importPattern = /\bfrom\s+['"][^'"]*(?:telnyx|pstn|call-control)[^'"]*['"]/i;
    const callPattern =
      /\b(?:telnyx|pstn|callControlId|createCallControl|startCall|placeCall|dialProspect)\s*[(.]/i;
    const matches = [
      ...matchingImportLines(turnSourceFiles(), importPattern),
      ...matchingCodeTokenLines(turnSourceFiles(), callPattern),
    ];
    expect(matches, matches.join('\n')).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// GROUP D — server-owned identity ONLY. The single accepted identity is the
// session tmagId; no body-authority field (sponsorTmagId/targetTmagId/downlineTmagId/
// prospectId/prospectToken) may appear as a code token. `tmagId` alone is the
// allowed session field and is intentionally NOT in this list.
// ---------------------------------------------------------------------------
describe('S3.10 turn source body-authority boundary', () => {
  it('#13 accepts no body-authority id fields (sponsorTmagId/targetTmagId/downlineTmagId/prospectId/prospectToken)', () => {
    // Comments/strings stripped first: the header doc-comment legitimately lists
    // these identifiers to explain they are NOT accepted. Only a real code token
    // (a field name / property access) can trip this scan. `tmagId` is allowed.
    const forbidden = /\b(?:sponsorTmagId|targetTmagId|downlineTmagId|prospectId|prospectToken)\b/;
    const matches = matchingCodeTokenLines(turnSourceFiles(), forbidden);
    expect(matches, matches.join('\n')).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// GROUP E — POSITIVE wiring. Context Manager is the sole packet assembler.
// Per S2.1/S2.4 the ORCHESTRATION turn source must NOT assemble a packet: it
// imports the sanctioned CONTEXT-LAYER factory
// (`createMichaelRuntimeContextManagerPort`), injects the returned
// context_manager port, and coordinates via the turn coordinator. The actual
// `buildContextPacket` assembly + `assembledBy: 'context_manager'` request port
// live in the context layer
// (server/src/runtime/context/michaelRuntimeContextFoundation.ts).
// ---------------------------------------------------------------------------
describe('S3.10 turn source required wiring', () => {
  it('#14 imports the context-layer packet factory from ../context/ (assembly lives in context)', () => {
    const matches = matchingImportLines(
      turnSourceFiles(),
      /\bcreateMichaelRuntimeContextManagerPort\b[\s\S]*?from\s+['"]\.\.\/context\/[^'"]*['"]|\bfrom\s+['"]\.\.\/context\/[^'"]*['"][\s\S]*?\bcreateMichaelRuntimeContextManagerPort\b/,
    );
    const named = matchingImportLines(turnSourceFiles(), /\bcreateMichaelRuntimeContextManagerPort\b/);
    expect(named.length, named.join('\n')).toBeGreaterThan(0);
    expect(matches.length, matches.join('\n')).toBeGreaterThan(0);
  });

  it('#14b never references buildContextPacket / ContextPacketBuildInput / prepareContextPacketFoundation (S2.1 + S2.4)', () => {
    // Raw text scan (comments INCLUDED) — mirrors the S2.1 orchestration-boundary
    // scan: the orchestration turn source must be free of every Context Packet
    // ASSEMBLY token, even inside doc comments or string literals. Assembly is a
    // context-layer responsibility ONLY.
    const raw = readSourceFile(turnSourceFilePath).text;
    expect(/\bbuildContextPacket\b/.test(raw), 'buildContextPacket present in orchestration').toBe(false);
    expect(/\bContextPacketBuildInput\b/.test(raw), 'ContextPacketBuildInput present in orchestration').toBe(
      false,
    );
    expect(
      /\bprepareContextPacketFoundation\b/.test(raw),
      'prepareContextPacketFoundation present in orchestration',
    ).toBe(false);
  });

  it('#15 imports coordinateRuntimeTurn from the turn coordinator', () => {
    const matches = matchingImportLines(
      turnSourceFiles(),
      /\bcoordinateRuntimeTurn\b[\s\S]*?from\s+['"]\.\/turnCoordinator\.js['"]/,
    );
    expect(matches.length, matches.join('\n')).toBeGreaterThan(0);
  });

  it('#16 actually invokes the context-layer factory and coordinateRuntimeTurn (not just imports)', () => {
    const factoryCall = matchingCodeTokenLines(
      turnSourceFiles(),
      /\bcreateMichaelRuntimeContextManagerPort\s*\(/,
    );
    const coordCall = matchingCodeTokenLines(turnSourceFiles(), /\bcoordinateRuntimeTurn\s*\(/);
    expect(factoryCall.length, factoryCall.join('\n')).toBeGreaterThan(0);
    expect(coordCall.length, coordCall.join('\n')).toBeGreaterThan(0);
  });

  it('#17 the CONTEXT-LAYER factory is the sole assembler (buildContextPacket + context_manager port live in context)', () => {
    // Assembly lives in the context layer: the factory calls buildContextPacket
    // and returns a context_manager-assembled request port. This is the moved
    // positive assertion — orchestration only INJECTS this port.
    const contextStripped = sourceWithoutComments(readSourceFile(contextFoundationFilePath).text);
    expect(
      /\bbuildContextPacket\s*\(/.test(contextStripped),
      'context factory calls buildContextPacket',
    ).toBe(true);
    expect(
      /assembledBy\s*:\s*['"]context_manager['"]/.test(contextStripped),
      "context factory stamps assembledBy: 'context_manager'",
    ).toBe(true);
    expect(
      /requestContextPacket\s*\(/.test(contextStripped),
      'context factory implements requestContextPacket',
    ).toBe(true);
  });

  it('#17b the context factory boundary-clean: no store / Gateway / retrieval import', () => {
    const forbidden =
      /\bfrom\s+['"][^'"]*(?:^|\/|\\|@)(?:mongoose|mongodb|neo4j-driver|chromadb)(?:$|\/|\\|['"])|\bfrom\s+['"][^'"]*(?:graph-?rag|\/services\/gateway|\/services\/persistence|retrieval|gatewayFallback|gateway-fallback)[^'"]*['"]/i;
    const matches = matchingImportLines(contextFoundationFiles(), forbidden);
    expect(matches, matches.join('\n')).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// GROUP F — POSITIVE invariants. The module preserves the Michael invariants:
// agentKey, taskType, no generated response, persistence disabled, degraded
// fail-closed posture.
// ---------------------------------------------------------------------------
describe('S3.10 turn source preserved invariants', () => {
  it("#18 pins agentKey 'michael_magnificent'", () => {
    const stripped = sourceWithoutComments(readSourceFile(turnSourceFilePath).text);
    expect(stripped.includes("'michael_magnificent'"), "agentKey 'michael_magnificent' present").toBe(
      true,
    );
  });

  it("#19 pins taskType 'training_support'", () => {
    const stripped = sourceWithoutComments(readSourceFile(turnSourceFilePath).text);
    expect(stripped.includes("'training_support'"), "taskType 'training_support' present").toBe(true);
  });

  it('#20 keeps agentResponseGenerated: false (never true)', () => {
    const stripped = sourceWithoutComments(readSourceFile(turnSourceFilePath).text);
    expect(/agentResponseGenerated\s*:\s*false/.test(stripped), 'agentResponseGenerated: false').toBe(
      true,
    );
    expect(/agentResponseGenerated\s*:\s*true/.test(stripped), 'agentResponseGenerated: true absent').toBe(
      false,
    );
  });

  it("#21 stamps persistence: 'disabled' and never an enabled persistence value", () => {
    const stripped = sourceWithoutComments(readSourceFile(turnSourceFilePath).text);
    expect(/persistence\s*:\s*['"]disabled['"]/.test(stripped), "persistence: 'disabled'").toBe(true);
    expect(/persistence\s*:\s*['"]enabled['"]/.test(stripped), "no persistence: 'enabled'").toBe(false);
  });

  it("#22 preserves the degraded / candidate-excluded fail-closed posture", () => {
    const stripped = sourceWithoutComments(readSourceFile(turnSourceFilePath).text);
    expect(stripped.includes("'degraded'"), "degraded posture present").toBe(true);
    // The only sanctioned coordination outcome is the degraded decision.
    expect(/decision\s*!==\s*['"]degraded['"]/.test(stripped), 'fail-closed degraded guard present').toBe(
      true,
    );
  });
});

// ---------------------------------------------------------------------------
// GROUP G — compliance copy. No income / compensation / cycle / placement
// vocabulary anywhere (strings included), and no send/call/schedule/prospect
// automation identifiers.
// ---------------------------------------------------------------------------
describe('S3.10 turn source compliance copy boundary', () => {
  it('#23 contains no income/compensation/placement/cycle copy (strings + code)', () => {
    const forbidden = /\b(?:income|commission|compensation|placement|cycle|earnings|payout)\b/i;
    const matches = matchingCopyLines(turnSourceFiles(), forbidden);
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('#24 wires no send/call/schedule/prospect automation identifiers', () => {
    const pattern =
      /\b(?:sendMessage|autoSend|autoSubmit|scheduleCall|callProspect|dialProspect|placeCall|startCall|autoResolve|autoInvoke|enrollProspect|sendInvitation)\s*\(/;
    const matches = matchingCodeTokenLines(turnSourceFiles(), pattern);
    expect(matches, matches.join('\n')).toEqual([]);
  });
});
