import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  getMichaelResponseCatalogEntry,
  MICHAEL_RESPONSE_CATALOG,
} from '../michaelResponseCatalog.js';
import {
  MICHAEL_RESPONSE_CATALOG_SELECTABLE_KEYS,
  selectMichaelResponseCatalogEntry,
  selectionRequestForCatalogKey,
} from '../michaelResponseCatalogSelector.js';

// ---------------------------------------------------------------------------
// Static source-scanning governance boundary test for the S2.18 Michael
// response catalog SELECTOR slice. This mirrors the static-scan style of
// s217MichaelCatalogGovernanceBoundary.test.ts and
// s216MichaelEsSafePathGovernanceBoundary.test.ts: source is read from disk,
// comments (and optionally string literals) are stripped, and forbidden WIRING
// patterns must produce empty match arrays.
//
// S2.4-trap avoidance: the Michael response contract and the selector carry
// defensive blocklist string literals (e.g. 'callControl', 'placementGuarantee',
// 'persistence', forbidden-field NAMES) and message text. Code-token scans strip
// string literals first, so those literals never trip a wiring regex. Checks
// target real wiring — import paths, client constructions, call shapes — not bare
// identifiers/tokens.
//
// The scan helpers below are copied locally (never imported across test files):
// the s216/s217 specs deliberately keep their helpers private.
// ---------------------------------------------------------------------------

const orchestrationRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = resolve(orchestrationRoot, '../../../..');

const selectorFilePath = 'server/src/runtime/orchestration/michaelResponseCatalogSelector.ts';
const orchestrationIndexPath = 'server/src/runtime/orchestration/index.ts';
const runtimeIndexPath = 'server/src/runtime/index.ts';

// The three new selector specs by the S2.18 batch. Some may not have landed yet
// (parallel agents); only existing ones are scanned.
const selectorTestPaths = [
  'server/src/runtime/orchestration/__tests__/michaelResponseCatalogSelector.test.ts',
  'server/src/runtime/orchestration/__tests__/michaelResponseCatalogSelectorParity.test.ts',
  'server/src/runtime/orchestration/__tests__/michaelRuntimeAdapterContractCatalogParity.test.ts',
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

// The S2.18 surface: the selector module, the two barrels that re-export it, and
// the new selector specs. collectFiles() skips __tests__, so the specs are listed
// explicitly. Non-existent files (not-yet-landed parallel work) are filtered out
// so the scan is robust to merge order.
function s218SurfaceFiles(): SourceFile[] {
  return [selectorFilePath, orchestrationIndexPath, runtimeIndexPath, ...selectorTestPaths]
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

describe('S2.18 Michael response catalog selector static governance boundary', () => {
  it('#1 does not import a MongoDB client or model', () => {
    const pattern = /\bfrom\s+['"][^'"]*(?:^|\/|\\|@)(?:mongoose|mongodb)(?:$|\/|\\|['"])/i;
    const matches = matchingImportLines(s218SurfaceFiles(), pattern);
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('#2 does not import a Neo4j driver or adapter', () => {
    const pattern =
      /\bfrom\s+['"][^'"]*(?:neo4j-driver|neo4j-adapter|\/adapters?\/neo4j)[^'"]*['"]/i;
    const matches = matchingImportLines(s218SurfaceFiles(), pattern);
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('#3 does not import a ChromaDB client or adapter', () => {
    const pattern =
      /\bfrom\s+['"][^'"]*(?:chromadb|chroma-client|\/adapters?\/chroma)[^'"]*['"]/i;
    const matches = matchingImportLines(s218SurfaceFiles(), pattern);
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('#4 does not import a GraphRAG client', () => {
    const pattern = /\bfrom\s+['"][^'"]*graph-?rag[^'"]*['"]/i;
    const matches = matchingImportLines(s218SurfaceFiles(), pattern);
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('#5 does not import a direct persistence adapter', () => {
    const pattern =
      /\bfrom\s+['"][^'"]*(?:\/services\/persistence|\/persistence\/|\/services\/[^'"]*adapter|\/adapters?\/persistence|tripleStack)[^'"]*['"]/i;
    const matches = matchingImportLines(s218SurfaceFiles(), pattern);
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('#6 does not import a Gateway fallback client (or call gatewayCall)', () => {
    const importPattern =
      /\bfrom\s+['"][^'"]*(?:\/services\/gateway|gatewayFallback|gateway-fallback)[^'"]*['"]/i;
    const callPattern = /\bgatewayCall\s*\(|\bdirectPersistenceCall\s*\(/;
    const matches = [
      ...matchingImportLines(s218SurfaceFiles(), importPattern),
      ...matchingCodeTokenLines(s218SurfaceFiles(), callPattern),
    ];
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('#7 does not import raw retrieval helpers', () => {
    const pattern =
      /\bfrom\s+['"][^'"]*(?:rawRetrieval|retrievalHelper|directRetrieval|\/retrieval\b)[^'"]*['"]/i;
    const matches = matchingImportLines(s218SurfaceFiles(), pattern);
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('#8 does not call buildContextPacket', () => {
    const pattern = /\bbuildContextPacket\s*\(/;
    const matches = matchingCodeTokenLines(s218SurfaceFiles(), pattern);
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('#9 does not assemble Context Packets', () => {
    const tokenPattern = /\b(?:prepareContextPacketFoundation\s*\(|ContextPacketBuildInput)\b/;
    const markerPattern = /assembledBy:\s*['"]agent_runtime['"]/;
    const matches = [
      ...matchingCodeTokenLines(s218SurfaceFiles(), tokenPattern),
      ...matchingSourceLines(s218SurfaceFiles(), markerPattern),
    ];
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('#10 does not call an LLM provider', () => {
    const pattern =
      /\b(?:chatCompletion|messages\.create|responses\.create|createCompletion|createChatCompletion)\s*\(/i;
    const matches = matchingCodeTokenLines(s218SurfaceFiles(), pattern);
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('#11 does not import an OpenAI / Anthropic / Claude client', () => {
    const pattern =
      /\bfrom\s+['"][^'"]*(?:^|\/|\\|@)(?:openai|anthropic|@anthropic-ai)(?:$|\/|\\|['"])|\bfrom\s+['"][^'"]*(?:\/services\/anthropic|\/services\/openai|\/services\/claude)[^'"]*['"]/i;
    const matches = matchingImportLines(s218SurfaceFiles(), pattern);
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('#12 does not import Steve runtime behavior', () => {
    const importPattern =
      /\bfrom\s+['"][^'"]*(?:steveSuccess|steve-success|\/steve)[^'"]*['"]/i;
    const callPattern = /\b(?:runSteve|createSteve|steveSuccessAdapter|steveRuntime)\b/;
    const matches = [
      ...matchingImportLines(s218SurfaceFiles(), importPattern),
      ...matchingCodeTokenLines(s218SurfaceFiles(), callPattern),
    ];
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('#13 does not import Ivory runtime behavior', () => {
    const importPattern = /\bfrom\s+['"][^'"]*(?:ivory|\/ivory)[^'"]*['"]/i;
    const callPattern = /\b(?:runIvory|createIvory|ivoryAdapter|ivoryRuntime)\b/;
    const matches = [
      ...matchingImportLines(s218SurfaceFiles(), importPattern),
      ...matchingCodeTokenLines(s218SurfaceFiles(), callPattern),
    ];
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('#14 does not wire Telnyx / PSTN / call-control', () => {
    const importPattern = /\bfrom\s+['"][^'"]*(?:telnyx|pstn|call-control)[^'"]*['"]/i;
    // Real call-control WIRING only — never the bare 'callControl' blocklist literal.
    const callPattern =
      /\b(?:telnyx|pstn|callControlId|createCallControl|startCall|placeCall|dialProspect)\s*[(.]/i;
    const matches = [
      ...matchingImportLines(s218SurfaceFiles(), importPattern),
      ...matchingCodeTokenLines(s218SurfaceFiles(), callPattern),
    ];
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('#15 does not create route-like handlers', () => {
    const importPattern = /\bfrom\s+['"](?:express|fastify)['"]/i;
    const callPattern =
      /\b(?:express\s*\(|Router\s*\(|fastify\s*\(|app\.(?:use|get|post|put|patch|delete)\s*\(|router\.(?:use|get|post|put|patch|delete)\s*\()/i;
    const matches = [
      ...matchingImportLines(s218SurfaceFiles(), importPattern),
      ...matchingCodeTokenLines(s218SurfaceFiles(), callPattern),
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

  it('#17 keeps .com untouched by the S2.18 selector symbols', () => {
    const comFiles = collectFiles('apps/com/src', ['.ts', '.tsx', '.js', '.jsx']);
    const importPattern =
      /\bfrom\s+['"][^'"]*(?:runtime\/orchestration|michaelResponseCatalogSelector|michaelResponseCatalog)[^'"]*['"]/i;
    const tokenPattern =
      /\b(?:selectMichaelResponseCatalogEntry|selectMichaelResponseCatalogKey|validateMichaelResponseCatalogSelection|selectionRequestForCatalogKey|MICHAEL_RESPONSE_CATALOG_SELECTABLE_KEYS)\b/i;
    const matches = [
      ...matchingImportLines(comFiles, importPattern),
      ...matchingCodeTokenLines(comFiles, tokenPattern),
    ];
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('#18 verifies the Gateway HTTP fallback stays retired (ACR-0009) outside the S2.18 surface', () => {
    const gatewayClient = readFileSync(resolve(repoRoot, 'server/src/services/gateway.ts'), 'utf8');
    expect(gatewayClient).toContain('export async function gatewayCall');
    expect(gatewayClient).not.toContain('GATEWAY_URL');
  });

  it('#19 does not introduce event persistence / outbox / replay / subscriber / event API code', () => {
    const pattern =
      /\b(?:persistRuntimeEvent|persistEventEnvelope|saveRuntimeEvent|writeRuntimeEvent|eventOutbox|outboxRepository|replayRuntimeEvent|eventReplay|subscriberRegistry|publishToSubscriber|subscribeToRuntimeEvents|eventApi|activateEventApi)\s*[(.]?/i;
    const matches = matchingCodeTokenLines(s218SurfaceFiles(), pattern);
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('#20 does not introduce outcome persistence', () => {
    const pattern =
      /\b(?:persistOutcome|saveOutcome|writeOutcome|outcomeRepository|outcomeStore)\s*[(.]?/i;
    const matches = matchingCodeTokenLines(s218SurfaceFiles(), pattern);
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('#21 does not introduce Guided Action persistence', () => {
    const pattern =
      /\b(?:persistGuidedAction|saveGuidedAction|writeGuidedAction|guidedActionRepository|guidedActionStore)\s*[(.]?/i;
    const matches = matchingCodeTokenLines(s218SurfaceFiles(), pattern);
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('#22 does not introduce response / session / transcript persistence call shapes', () => {
    // Literal 'disabled' markers are fine; forbid persist*/save*/write* call shapes.
    const pattern =
      /\b(?:persistResponse|saveResponse|writeResponse|responseRepository|responseStore|persistSession|saveSession|writeSession|persistTranscript|saveTranscript|writeTranscript|transcriptRepository|sessionRepository)\s*\(/i;
    const matches = matchingCodeTokenLines(s218SurfaceFiles(), pattern);
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('#23 does not introduce automatic sending / calling / scheduling / prospecting call shapes', () => {
    const pattern =
      /\b(?:sendEmail|sendSms|sendMessage|dispatchEmail|dispatchSms|placeCall|startCall|dialProspect|autoSchedule|automaticSchedule|autoProspect|automatedProspecting|prospectingAutomation|automaticSend|automaticCall)\s*\(/i;
    const matches = matchingCodeTokenLines(s218SurfaceFiles(), pattern);
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('#24 does not introduce scoring / ranking / classification / qualification logic', () => {
    // Call shapes only — the forbidden-field blocklist NAMES (string literals) are
    // stripped, so they cannot trip this scan.
    const pattern =
      /\b(?:computeScore|assignRank|scoreProspect|scoreBa|rankProspect|rankBa|classifyProspect|classifyBa|qualifyProspect|qualifyBa)\s*\(/i;
    const matches = matchingCodeTokenLines(s218SurfaceFiles(), pattern);
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('#25 does not introduce income / compensation / cycle / placement calculation call shapes', () => {
    const pattern =
      /\b(?:predictPlacement|predictIncome|calculateCommission|calculateCompensation|calculateCycle|calculatePlacement|computeCommission|computeCycle)\s*\(/i;
    const matches = matchingCodeTokenLines(s218SurfaceFiles(), pattern);
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('#26 does not introduce knowledge approval call shapes', () => {
    const pattern = /\b(?:knowledgeApproval|approveKnowledge|persistKnowledgeApproval)\s*[(.]?/i;
    const matches = matchingCodeTokenLines(s218SurfaceFiles(), pattern);
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('#27 keeps agentResponseGenerated false in the selector source and across every selection', () => {
    const selector = sourceWithoutComments(readSourceFile(selectorFilePath).text);
    expect(selector).not.toMatch(/agentResponseGenerated:\s*true/);

    for (const catalogKey of MICHAEL_RESPONSE_CATALOG_SELECTABLE_KEYS) {
      const request = selectionRequestForCatalogKey(catalogKey);
      if (!request) throw new Error(`no selection request for catalog key ${catalogKey}`);
      const result = selectMichaelResponseCatalogEntry(request);
      if (!result.ok) throw new Error(`selection failed for catalog key ${catalogKey}`);
      expect(
        result.response.agentResponseGenerated,
        `${catalogKey} agentResponseGenerated`,
      ).toBe(false);
    }
  });

  it('#28 keeps every persistence marker disabled in the selector source and across every selection', () => {
    const selector = sourceWithoutComments(readSourceFile(selectorFilePath).text);
    expect(selector).not.toMatch(/persistence:\s*['"]enabled['"]/);

    for (const catalogKey of MICHAEL_RESPONSE_CATALOG_SELECTABLE_KEYS) {
      const request = selectionRequestForCatalogKey(catalogKey);
      if (!request) throw new Error(`no selection request for catalog key ${catalogKey}`);
      const result = selectMichaelResponseCatalogEntry(request);
      if (!result.ok) throw new Error(`selection failed for catalog key ${catalogKey}`);
      expect(result.response.persistence, `${catalogKey} persistence`).toBe('disabled');
    }
  });

  it('#29 does not dynamically construct response text in the selector', () => {
    // The selector returns pre-authored catalog entries verbatim and never sets a
    // `text:` field. The combination-key / message template literals it does use
    // build lookup keys, never response text.
    const selectorStripped = sourceWithoutCommentsOrStrings(readSourceFile(selectorFilePath).text);
    const textAssignments = selectorStripped
      .split(/\r?\n/)
      .map((line, index) => ({ line, lineNumber: index + 1 }))
      .filter(({ line }) => /\btext\s*:/.test(line))
      .map(({ line, lineNumber }) => `${selectorFilePath}:${lineNumber}: ${line.trim()}`);
    expect(textAssignments, textAssignments.join('\n')).toEqual([]);

    // No `text:` field is ever assigned a template literal (string-built text).
    const textTemplateAssignments = matchingSourceLines(
      [readSourceFile(selectorFilePath)],
      /\btext\s*:\s*`/,
    );
    expect(textTemplateAssignments, textTemplateAssignments.join('\n')).toEqual([]);
  });

  it('#30 never mutates catalog entries and returns the response by reference', () => {
    expect(MICHAEL_RESPONSE_CATALOG_SELECTABLE_KEYS.length).toBe(MICHAEL_RESPONSE_CATALOG.length);

    const before = JSON.stringify(MICHAEL_RESPONSE_CATALOG);

    for (const catalogKey of MICHAEL_RESPONSE_CATALOG_SELECTABLE_KEYS) {
      const request = selectionRequestForCatalogKey(catalogKey);
      if (!request) throw new Error(`no selection request for catalog key ${catalogKey}`);
      const result = selectMichaelResponseCatalogEntry(request);
      if (!result.ok) throw new Error(`selection failed for catalog key ${catalogKey}`);

      const catalogEntry = getMichaelResponseCatalogEntry(catalogKey);
      if (!catalogEntry) throw new Error(`no catalog entry for key ${catalogKey}`);

      // Same reference, never a copy or a regenerated object.
      expect(result.response, `${catalogKey} response reference`).toBe(catalogEntry.response);
      expect(result.entry, `${catalogKey} entry reference`).toBe(catalogEntry);
    }

    const after = JSON.stringify(MICHAEL_RESPONSE_CATALOG);
    expect(after).toBe(before);
  });
});
