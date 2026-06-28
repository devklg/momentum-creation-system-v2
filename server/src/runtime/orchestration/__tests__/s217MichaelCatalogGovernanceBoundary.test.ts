import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { validateMichaelResponseContract } from '../michaelResponseContract.js';
import { MICHAEL_RESPONSE_CATALOG } from '../michaelResponseCatalog.js';

// ---------------------------------------------------------------------------
// Static source-scanning governance boundary test for the S2.17 Michael
// response catalog / EN↔ES symmetry slice. This mirrors the static-scan style
// of s216MichaelEsSafePathGovernanceBoundary.test.ts and
// s215MichaelRuntimeAdapterContractGovernanceBoundary.test.ts: source is read
// from disk, comments (and optionally string literals) are stripped, and
// forbidden WIRING patterns must produce empty match arrays.
//
// S2.4-trap avoidance: the Michael response contract carries defensive
// blocklist string literals (e.g. 'callControl', 'placementGuarantee',
// 'earningsProjection', 'cvCalculation') and the invalid fixtures carry
// forbidden-field NAMES. Code-token scans strip string literals first, so those
// literals never trip a wiring regex. Checks target real wiring — import paths,
// client constructions, call shapes — not bare identifiers/tokens.
// ---------------------------------------------------------------------------

const orchestrationRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = resolve(orchestrationRoot, '../../../..');

const catalogFilePath = 'server/src/runtime/orchestration/michaelResponseCatalog.ts';
const orchestrationIndexPath = 'server/src/runtime/orchestration/index.ts';
const runtimeIndexPath = 'server/src/runtime/index.ts';

// The three new catalog/export test files by the S2.17 batch. Some may not have
// landed yet (parallel agents); only existing ones are scanned.
const catalogTestPaths = [
  'server/src/runtime/orchestration/__tests__/michaelResponseFixtureExports.test.ts',
  'server/src/runtime/orchestration/__tests__/michaelResponseCatalog.test.ts',
  'server/src/runtime/orchestration/__tests__/michaelResponseCatalogValidation.test.ts',
];

type SourceFile = {
  readonly relativePath: string;
  readonly text: string;
};

function normalizePath(path: string): string {
  return path.split(sep).join('/');
}

function readSourceFile(relativePath: string): SourceFile {
  return {
    relativePath,
    text: readFileSync(resolve(repoRoot, relativePath), 'utf8'),
  };
}

// The S2.17 surface: the catalog wrapper, the two barrels that re-export it, and
// the new catalog/export specs. collectFiles() skips __tests__, so the specs are
// listed explicitly. Non-existent files (not-yet-landed parallel work) are
// filtered out so the scan is robust to merge order.
function s217SurfaceFiles(): SourceFile[] {
  return [catalogFilePath, orchestrationIndexPath, runtimeIndexPath, ...catalogTestPaths]
    .filter((relativePath) => existsSync(resolve(repoRoot, relativePath)))
    .map(readSourceFile);
}

function collectFiles(relativeRoot: string, extensions: readonly string[]): SourceFile[] {
  const root = resolve(repoRoot, relativeRoot);
  const files: SourceFile[] = [];
  if (!existsSync(root)) return files;

  function walk(current: string): void {
    for (const entry of readdirSync(current)) {
      if (entry === '__tests__') continue;
      const absolutePath = resolve(current, entry);
      const stats = statSync(absolutePath);
      if (stats.isDirectory()) {
        walk(absolutePath);
        continue;
      }
      if (!extensions.some((extension) => entry.endsWith(extension))) continue;
      files.push({
        relativePath: normalizePath(relative(repoRoot, absolutePath)),
        text: readFileSync(absolutePath, 'utf8'),
      });
    }
  }

  walk(root);
  return files;
}

function orchestrationProductionFiles(): SourceFile[] {
  return collectFiles('server/src/runtime/orchestration', ['.ts']);
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

// Code-token scan: string literals are stripped first, so defensive blocklist
// literals (e.g. 'callControl', 'earningsProjection') never trip a wiring regex.
function matchingCodeTokenLines(files: readonly SourceFile[], pattern: RegExp): string[] {
  return linesFromSource(files, true)
    .filter(({ line }) => pattern.test(line))
    .map(({ relativePath, line, lineNumber }) => `${relativePath}:${lineNumber}: ${line.trim()}`);
}

// Source scan that keeps string literals (comments stripped). Use only for
// structural markers that live inside literals (route path strings,
// assembledBy:'agent_runtime', etc.).
function matchingSourceLines(files: readonly SourceFile[], pattern: RegExp): string[] {
  return linesFromSource(files, false)
    .filter(({ line }) => pattern.test(line))
    .map(({ relativePath, line, lineNumber }) => `${relativePath}:${lineNumber}: ${line.trim()}`);
}

function matchingImportLines(files: readonly SourceFile[], pattern: RegExp): string[] {
  return importLines(files)
    .filter(({ line }) => pattern.test(line))
    .map(({ relativePath, line, lineNumber }) => `${relativePath}:${lineNumber}: ${line.trim()}`);
}

describe('S2.17 Michael response catalog static governance boundary', () => {
  it('#1 does not import a MongoDB client or model', () => {
    const pattern = /\bfrom\s+['"][^'"]*(?:^|\/|\\|@)(?:mongoose|mongodb)(?:$|\/|\\|['"])/i;
    const matches = matchingImportLines(s217SurfaceFiles(), pattern);
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('#2 does not import a Neo4j driver or adapter', () => {
    const pattern =
      /\bfrom\s+['"][^'"]*(?:neo4j-driver|neo4j-adapter|\/adapters?\/neo4j)[^'"]*['"]/i;
    const matches = matchingImportLines(s217SurfaceFiles(), pattern);
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('#3 does not import a ChromaDB client or adapter', () => {
    const pattern =
      /\bfrom\s+['"][^'"]*(?:chromadb|chroma-client|\/adapters?\/chroma)[^'"]*['"]/i;
    const matches = matchingImportLines(s217SurfaceFiles(), pattern);
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('#4 does not import a GraphRAG client', () => {
    const pattern = /\bfrom\s+['"][^'"]*graph-?rag[^'"]*['"]/i;
    const matches = matchingImportLines(s217SurfaceFiles(), pattern);
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('#5 does not import a direct persistence adapter', () => {
    const pattern =
      /\bfrom\s+['"][^'"]*(?:\/services\/persistence|\/persistence\/|\/services\/[^'"]*adapter|\/adapters?\/persistence|tripleStack)[^'"]*['"]/i;
    const matches = matchingImportLines(s217SurfaceFiles(), pattern);
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('#6 does not import a Gateway fallback client (or call gatewayCall)', () => {
    const importPattern =
      /\bfrom\s+['"][^'"]*(?:\/services\/gateway|gatewayFallback|gateway-fallback)[^'"]*['"]/i;
    const callPattern = /\bgatewayCall\s*\(|\bdirectPersistenceCall\s*\(/;
    const matches = [
      ...matchingImportLines(s217SurfaceFiles(), importPattern),
      ...matchingCodeTokenLines(s217SurfaceFiles(), callPattern),
    ];
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('#7 does not import raw retrieval helpers', () => {
    const pattern =
      /\bfrom\s+['"][^'"]*(?:rawRetrieval|retrievalHelper|directRetrieval|\/retrieval\b)[^'"]*['"]/i;
    const matches = matchingImportLines(s217SurfaceFiles(), pattern);
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('#8 does not call buildContextPacket', () => {
    const pattern = /\bbuildContextPacket\s*\(/;
    const matches = matchingCodeTokenLines(s217SurfaceFiles(), pattern);
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('#9 does not assemble Context Packets', () => {
    const tokenPattern = /\b(?:prepareContextPacketFoundation\s*\(|ContextPacketBuildInput)\b/;
    const markerPattern = /assembledBy:\s*['"]agent_runtime['"]/;
    const matches = [
      ...matchingCodeTokenLines(s217SurfaceFiles(), tokenPattern),
      ...matchingSourceLines(s217SurfaceFiles(), markerPattern),
    ];
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('#10 does not call an LLM provider', () => {
    const pattern =
      /\b(?:chatCompletion|messages\.create|responses\.create|createCompletion|createChatCompletion)\s*\(/i;
    const matches = matchingCodeTokenLines(s217SurfaceFiles(), pattern);
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('#11 does not import an OpenAI / Anthropic / Claude client', () => {
    const pattern =
      /\bfrom\s+['"][^'"]*(?:^|\/|\\|@)(?:openai|anthropic|@anthropic-ai)(?:$|\/|\\|['"])|\bfrom\s+['"][^'"]*(?:\/services\/anthropic|\/services\/openai|\/services\/claude)[^'"]*['"]/i;
    const matches = matchingImportLines(s217SurfaceFiles(), pattern);
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('#12 does not import Steve runtime behavior', () => {
    const importPattern =
      /\bfrom\s+['"][^'"]*(?:steveSuccess|steve-success|\/steve)[^'"]*['"]/i;
    const callPattern = /\b(?:runSteve|createSteve|steveSuccessAdapter|steveRuntime)\b/;
    const matches = [
      ...matchingImportLines(s217SurfaceFiles(), importPattern),
      ...matchingCodeTokenLines(s217SurfaceFiles(), callPattern),
    ];
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('#13 does not import Ivory runtime behavior', () => {
    const importPattern = /\bfrom\s+['"][^'"]*(?:ivory|\/ivory)[^'"]*['"]/i;
    const callPattern = /\b(?:runIvory|createIvory|ivoryAdapter|ivoryRuntime)\b/;
    const matches = [
      ...matchingImportLines(s217SurfaceFiles(), importPattern),
      ...matchingCodeTokenLines(s217SurfaceFiles(), callPattern),
    ];
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('#14 does not wire Telnyx / PSTN / call-control', () => {
    const importPattern = /\bfrom\s+['"][^'"]*(?:telnyx|pstn|call-control)[^'"]*['"]/i;
    // Real call-control WIRING only — never the bare 'callControl' blocklist literal.
    const callPattern =
      /\b(?:telnyx|pstn|callControlId|createCallControl|startCall|placeCall|dialProspect)\s*[(.]/i;
    const matches = [
      ...matchingImportLines(s217SurfaceFiles(), importPattern),
      ...matchingCodeTokenLines(s217SurfaceFiles(), callPattern),
    ];
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('#15 does not create route-like handlers', () => {
    const importPattern = /\bfrom\s+['"](?:express|fastify)['"]/i;
    const callPattern =
      /\b(?:express\s*\(|Router\s*\(|fastify\s*\(|app\.(?:use|get|post|put|patch|delete)\s*\(|router\.(?:use|get|post|put|patch|delete)\s*\()/i;
    const matches = [
      ...matchingImportLines(s217SurfaceFiles(), importPattern),
      ...matchingCodeTokenLines(s217SurfaceFiles(), callPattern),
    ];
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('#16 keeps /api/runtime unmounted in orchestration and the server entrypoint', () => {
    const routePattern =
      /(?:app\.use\s*\(\s*['"`]\/api\/runtime\b|app\.(?:get|post|put|patch|delete)\s*\(\s*['"`]\/api\/runtime\b|router\.(?:use|get|post|put|patch|delete)\s*\(\s*['"`]\/api\/runtime\b)/;
    const matches = [
      ...matchingSourceLines(orchestrationProductionFiles(), routePattern),
      ...matchingSourceLines([readSourceFile('server/src/index.ts')], routePattern),
    ];
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('#17 keeps .com untouched by the S2.17 catalog / ES fixture symbols', () => {
    const comFiles = collectFiles('apps/com/src', ['.ts', '.tsx', '.js', '.jsx']);
    const importPattern =
      /\bfrom\s+['"][^'"]*(?:runtime\/orchestration|michaelResponseCatalog|michaelResponseFixtures)[^'"]*['"]/i;
    const tokenPattern =
      /\b(?:MICHAEL_RESPONSE_CATALOG|listMichaelResponseCatalogEntries|listMichaelResponseCatalogKeys|getMichaelResponseCatalogEntry|hasMichaelResponseCatalogEntry|validateMichaelResponseCatalog|michaelResponseFixtureSafeFallbackDegradedContextPacketEs|michaelResponseFixtureSafeFallbackMissingContextPacketEs|michaelResponseFixtureSafeCloseFailedContextPacketEs|michaelResponseFixtureSafeCloseCandidateReviewOnlyRejectionEs)\b/i;
    const matches = [
      ...matchingImportLines(comFiles, importPattern),
      ...matchingCodeTokenLines(comFiles, tokenPattern),
    ];
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('#18 preserves the Gateway fallback client outside the S2.17 surface', () => {
    const gatewayClient = readFileSync(resolve(repoRoot, 'server/src/services/gateway.ts'), 'utf8');
    expect(gatewayClient).toContain('export async function gatewayCall');
    expect(gatewayClient).toContain('GATEWAY_URL');
  });

  it('#19 does not introduce event persistence / outbox / replay / subscriber / event API code', () => {
    const pattern =
      /\b(?:persistRuntimeEvent|persistEventEnvelope|saveRuntimeEvent|writeRuntimeEvent|eventOutbox|outboxRepository|replayRuntimeEvent|eventReplay|subscriberRegistry|publishToSubscriber|subscribeToRuntimeEvents|eventApi|activateEventApi)\s*[(.]?/i;
    const matches = matchingCodeTokenLines(s217SurfaceFiles(), pattern);
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('#20 does not introduce outcome persistence', () => {
    const pattern =
      /\b(?:persistOutcome|saveOutcome|writeOutcome|outcomeRepository|outcomeStore)\s*[(.]?/i;
    const matches = matchingCodeTokenLines(s217SurfaceFiles(), pattern);
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('#21 does not introduce Guided Action persistence', () => {
    const pattern =
      /\b(?:persistGuidedAction|saveGuidedAction|writeGuidedAction|guidedActionRepository|guidedActionStore)\s*[(.]?/i;
    const matches = matchingCodeTokenLines(s217SurfaceFiles(), pattern);
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('#22 does not introduce response / session / transcript persistence call shapes', () => {
    const pattern =
      /\b(?:persistResponse|saveResponse|writeResponse|responseRepository|responseStore|persistSession|saveSession|writeSession|persistTranscript|saveTranscript|writeTranscript|transcriptRepository|sessionRepository)\s*\(/i;
    const matches = matchingCodeTokenLines(s217SurfaceFiles(), pattern);
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('#23 does not introduce automatic sending / calling / scheduling / prospecting call shapes', () => {
    const pattern =
      /\b(?:sendEmail|sendSms|sendMessage|dispatchEmail|dispatchSms|placeCall|startCall|dialProspect|autoSchedule|automaticSchedule|autoProspect|automatedProspecting|prospectingAutomation|automaticSend|automaticCall)\s*\(/i;
    const matches = matchingCodeTokenLines(s217SurfaceFiles(), pattern);
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('#24 does not introduce scoring / ranking / classification / qualification logic', () => {
    // Call shapes only — the forbidden-field blocklist NAMES (string literals)
    // are stripped, so they cannot trip this scan.
    const pattern =
      /\b(?:computeScore|assignRank|scoreProspect|scoreBa|rankProspect|rankBa|classifyProspect|classifyBa|qualifyProspect|qualifyBa)\s*\(/i;
    const matches = matchingCodeTokenLines(s217SurfaceFiles(), pattern);
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('#25 does not introduce income / compensation / cycle / placement calculation call shapes', () => {
    const pattern =
      /\b(?:predictPlacement|predictIncome|calculateCommission|calculateCompensation|calculateCycle|calculatePlacement|computeCommission|computeCycle)\s*\(/i;
    const matches = matchingCodeTokenLines(s217SurfaceFiles(), pattern);
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('#26 does not introduce knowledge approval call shapes', () => {
    const pattern = /\b(?:knowledgeApproval|approveKnowledge|persistKnowledgeApproval)\s*[(.]?/i;
    const matches = matchingCodeTokenLines(s217SurfaceFiles(), pattern);
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('#27 keeps agentResponseGenerated false in the catalog source and at runtime', () => {
    const catalog = sourceWithoutComments(readSourceFile(catalogFilePath).text);
    expect(catalog).not.toMatch(/agentResponseGenerated:\s*true/);
    for (const catalogEntry of MICHAEL_RESPONSE_CATALOG) {
      expect(
        catalogEntry.response.agentResponseGenerated,
        `${catalogEntry.catalogKey} agentResponseGenerated`,
      ).toBe(false);
    }
  });

  it('#28 keeps every persistence marker disabled in the catalog source and at runtime', () => {
    const catalog = sourceWithoutComments(readSourceFile(catalogFilePath).text);
    expect(catalog).not.toMatch(/persistence:\s*['"]enabled['"]/);
    for (const catalogEntry of MICHAEL_RESPONSE_CATALOG) {
      expect(
        catalogEntry.response.persistence,
        `${catalogEntry.catalogKey} persistence`,
      ).toBe('disabled');
    }
  });

  it('#29 validates every catalog entry against the Michael response contract (no forbidden fields / text)', () => {
    expect(MICHAEL_RESPONSE_CATALOG.length).toBeGreaterThan(0);
    for (const catalogEntry of MICHAEL_RESPONSE_CATALOG) {
      const validation = validateMichaelResponseContract(catalogEntry.response);
      expect(validation.ok, `${catalogEntry.catalogKey} must validate`).toBe(true);
    }
  });

  it('#30 does not dynamically construct response text in the catalog', () => {
    // The catalog references pre-authored fixtures by import and never sets a
    // `text:` field, nor builds text via template literals / concatenation.
    const catalogStripped = sourceWithoutCommentsOrStrings(readSourceFile(catalogFilePath).text);
    const textAssignments = catalogStripped
      .split(/\r?\n/)
      .map((line, index) => ({ line, lineNumber: index + 1 }))
      .filter(({ line }) => /\btext\s*:/.test(line))
      .map(({ line, lineNumber }) => `${catalogFilePath}:${lineNumber}: ${line.trim()}`);
    expect(textAssignments, textAssignments.join('\n')).toEqual([]);

    // No template literals at all in the catalog → no backtick-built text.
    const catalogNoComments = sourceWithoutComments(readSourceFile(catalogFilePath).text);
    expect(catalogNoComments).not.toContain('`');
  });
});
