import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  MICHAEL_RESPONSE_CATALOG,
} from '../michaelResponseCatalog.js';
import {
  MICHAEL_RESPONSE_CATALOG_SELECTABLE_KEYS,
  selectMichaelResponseCatalogEntry,
  selectionRequestForCatalogKey,
} from '../michaelResponseCatalogSelector.js';
import {
  deriveMichaelResponseCatalogSelectionRequest,
  deriveMichaelResponseCatalogSelectionRequestFromRuntimeTurn,
} from '../michaelResponseSelectionRequest.js';
import { runRuntimeTurnFixtureScenario } from '../fixtures/runtimeTurnHarness.js';

// ---------------------------------------------------------------------------
// Static source-scanning governance boundary test for the S2.19 Michael
// response catalog SELECTION-REQUEST DERIVATION slice. This mirrors the
// static-scan style of s218MichaelCatalogSelectorGovernanceBoundary.test.ts
// and s217MichaelCatalogGovernanceBoundary.test.ts: source is read from disk,
// comments (and optionally string literals) are stripped, and forbidden WIRING
// patterns must produce empty match arrays.
//
// S2.4-trap avoidance #1: the derivation legitimately imports
// `runMichaelRuntimeAdapterContract` from './michaelRuntimeAdapterContract.js'.
// That is an internal, already-inert ORCHESTRATION module — NOT a forbidden
// direct data adapter. The direct-persistence-adapter scan below targets only
// mongo/neo4j/chroma adapters, `/services/*adapter`, PERSISTENCE-fallback, and
// retrieval helpers — never a bare /adapter/ token — so this import is allowed.
//
// S2.4-trap avoidance #2: the derivation and the selector carry defensive
// blocklist string literals and message text. Code-token scans strip string
// literals first (matchingCodeTokenLines), so those literals never trip a
// wiring regex. Checks target real wiring — import paths, call shapes — not
// bare identifiers/tokens.
//
// The scan helpers below are copied locally (never imported across test files):
// the s217/s218 specs deliberately keep their helpers private.
// ---------------------------------------------------------------------------

const orchestrationRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = resolve(orchestrationRoot, '../../../..');

const selectionRequestFilePath =
  'server/src/runtime/orchestration/michaelResponseSelectionRequest.ts';
const selectorFilePath = 'server/src/runtime/orchestration/michaelResponseCatalogSelector.ts';
const orchestrationIndexPath = 'server/src/runtime/orchestration/index.ts';
const runtimeIndexPath = 'server/src/runtime/index.ts';

// The four new S2.19 derivation specs. Some may not have landed yet (parallel
// agents); only existing ones are scanned.
const selectionRequestTestPaths = [
  'server/src/runtime/orchestration/__tests__/michaelResponseSelectionRequest.test.ts',
  'server/src/runtime/orchestration/__tests__/michaelResponseSelectionRequestRuntimeTurn.test.ts',
  'server/src/runtime/orchestration/__tests__/michaelResponseCatalogSelectorExhaustiveness.test.ts',
  'server/src/runtime/orchestration/__tests__/michaelResponseSelectionRequestNegativeSpace.test.ts',
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

// The S2.19 surface: the derivation module, the two barrels that re-export it,
// and the new derivation specs. collectFiles() skips __tests__, so the specs are
// listed explicitly. Non-existent files (not-yet-landed parallel work) are
// filtered out so the scan is robust to merge order.
function s219SurfaceFiles(): SourceFile[] {
  return [
    selectionRequestFilePath,
    orchestrationIndexPath,
    runtimeIndexPath,
    ...selectionRequestTestPaths,
  ]
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

describe('S2.19 Michael response selection-request derivation static governance boundary', () => {
  it('#1 does not import a MongoDB client or model', () => {
    const pattern = /\bfrom\s+['"][^'"]*(?:^|\/|\\|@)(?:mongoose|mongodb)(?:$|\/|\\|['"])/i;
    const matches = matchingImportLines(s219SurfaceFiles(), pattern);
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('#2 does not import a Neo4j driver or adapter', () => {
    const pattern =
      /\bfrom\s+['"][^'"]*(?:neo4j-driver|neo4j-adapter|\/adapters?\/neo4j)[^'"]*['"]/i;
    const matches = matchingImportLines(s219SurfaceFiles(), pattern);
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('#3 does not import a ChromaDB client or adapter', () => {
    const pattern =
      /\bfrom\s+['"][^'"]*(?:chromadb|chroma-client|\/adapters?\/chroma)[^'"]*['"]/i;
    const matches = matchingImportLines(s219SurfaceFiles(), pattern);
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('#4 does not import a GraphRAG client', () => {
    const pattern = /\bfrom\s+['"][^'"]*graph-?rag[^'"]*['"]/i;
    const matches = matchingImportLines(s219SurfaceFiles(), pattern);
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('#5 does not import a direct persistence adapter (michaelRuntimeAdapterContract is allowed)', () => {
    // Targets mongo/neo4j/chroma adapters, /services/*adapter, /adapters/persistence,
    // /persistence/, and tripleStack — never a bare /adapter/ token. The legitimate
    // `./michaelRuntimeAdapterContract.js` orchestration import is NOT matched.
    const pattern =
      /\bfrom\s+['"][^'"]*(?:\/services\/persistence|\/persistence\/|\/services\/[^'"]*adapter|\/adapters?\/persistence|\/adapters?\/(?:mongo|neo4j|chroma)|tripleStack)[^'"]*['"]/i;
    const matches = matchingImportLines(s219SurfaceFiles(), pattern);
    expect(matches, matches.join('\n')).toEqual([]);

    // Positive guard: the allowed orchestration adapter import is present and NOT
    // flagged — proving the regex does not over-match the contract module.
    const derivation = readSourceFile(selectionRequestFilePath).text;
    expect(derivation).toContain("from './michaelRuntimeAdapterContract.js'");
    expect(pattern.test("import { runMichaelRuntimeAdapterContract } from './michaelRuntimeAdapterContract.js';")).toBe(
      false,
    );
  });

  it('#6 does not import a legacy fallback client (or call persistenceCall)', () => {
    const importPattern =
      /\bfrom\s+['"][^'"]*(?:\/services\/PERSISTENCE|PERSISTENCEFallback|PERSISTENCE-fallback)[^'"]*['"]/i;
    const callPattern = /\bpersistenceCall\s*\(|\bdirectStoreCall\s*\(/;
    const matches = [
      ...matchingImportLines(s219SurfaceFiles(), importPattern),
      ...matchingCodeTokenLines(s219SurfaceFiles(), callPattern),
    ];
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('#7 does not import raw retrieval helpers', () => {
    const pattern =
      /\bfrom\s+['"][^'"]*(?:rawRetrieval|retrievalHelper|directRetrieval|\/retrieval\b)[^'"]*['"]/i;
    const matches = matchingImportLines(s219SurfaceFiles(), pattern);
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('#8 does not call buildContextPacket', () => {
    const pattern = /\bbuildContextPacket\s*\(/;
    const matches = matchingCodeTokenLines(s219SurfaceFiles(), pattern);
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('#9 does not assemble Context Packets', () => {
    const tokenPattern = /\b(?:prepareContextPacketFoundation\s*\(|ContextPacketBuildInput)\b/;
    const markerPattern = /assembledBy:\s*['"]agent_runtime['"]/;
    const matches = [
      ...matchingCodeTokenLines(s219SurfaceFiles(), tokenPattern),
      ...matchingSourceLines(s219SurfaceFiles(), markerPattern),
    ];
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('#10 does not call an LLM provider', () => {
    const pattern =
      /\b(?:chatCompletion|messages\.create|responses\.create|createCompletion|createChatCompletion)\s*\(/i;
    const matches = matchingCodeTokenLines(s219SurfaceFiles(), pattern);
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('#11 does not import an OpenAI / Anthropic / Claude client', () => {
    const pattern =
      /\bfrom\s+['"][^'"]*(?:^|\/|\\|@)(?:openai|anthropic|@anthropic-ai)(?:$|\/|\\|['"])|\bfrom\s+['"][^'"]*(?:\/services\/anthropic|\/services\/openai|\/services\/claude)[^'"]*['"]/i;
    const matches = matchingImportLines(s219SurfaceFiles(), pattern);
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('#12 does not import Steve runtime behavior', () => {
    const importPattern =
      /\bfrom\s+['"][^'"]*(?:steveSuccess|steve-success|\/steve)[^'"]*['"]/i;
    const callPattern = /\b(?:runSteve|createSteve|steveSuccessAdapter|steveRuntime)\b/;
    const matches = [
      ...matchingImportLines(s219SurfaceFiles(), importPattern),
      ...matchingCodeTokenLines(s219SurfaceFiles(), callPattern),
    ];
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('#13 does not import Ivory runtime behavior', () => {
    const importPattern = /\bfrom\s+['"][^'"]*(?:ivory|\/ivory)[^'"]*['"]/i;
    const callPattern = /\b(?:runIvory|createIvory|ivoryAdapter|ivoryRuntime)\b/;
    const matches = [
      ...matchingImportLines(s219SurfaceFiles(), importPattern),
      ...matchingCodeTokenLines(s219SurfaceFiles(), callPattern),
    ];
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('#14 does not wire Telnyx / PSTN / call-control', () => {
    const importPattern = /\bfrom\s+['"][^'"]*(?:telnyx|pstn|call-control)[^'"]*['"]/i;
    // Real call-control WIRING only — never the bare 'callControl' blocklist literal.
    const callPattern =
      /\b(?:telnyx|pstn|callControlId|createCallControl|startCall|placeCall|dialProspect)\s*[(.]/i;
    const matches = [
      ...matchingImportLines(s219SurfaceFiles(), importPattern),
      ...matchingCodeTokenLines(s219SurfaceFiles(), callPattern),
    ];
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('#15 does not create route-like handlers', () => {
    const importPattern = /\bfrom\s+['"](?:express|fastify)['"]/i;
    const callPattern =
      /\b(?:express\s*\(|Router\s*\(|fastify\s*\(|app\.(?:use|get|post|put|patch|delete)\s*\(|router\.(?:use|get|post|put|patch|delete)\s*\()/i;
    const matches = [
      ...matchingImportLines(s219SurfaceFiles(), importPattern),
      ...matchingCodeTokenLines(s219SurfaceFiles(), callPattern),
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

  it('#17 keeps .com untouched by the S2.19 selection-request symbols', () => {
    const comFiles = collectFiles('apps/com/src', ['.ts', '.tsx', '.js', '.jsx']);
    const importPattern =
      /\bfrom\s+['"][^'"]*(?:runtime\/orchestration|michaelResponseSelectionRequest|michaelResponseCatalogSelector)[^'"]*['"]/i;
    const tokenPattern =
      /\b(?:deriveMichaelResponseCatalogSelectionRequest|deriveMichaelResponseCatalogSelectionRequestFromAdapterContractInput|deriveMichaelResponseCatalogSelectionRequestFromRuntimeTurn|MichaelResponseCatalogSelectionRequest|MichaelResponseSelectionRequestDerivationResult)\b/i;
    const matches = [
      ...matchingImportLines(comFiles, importPattern),
      ...matchingCodeTokenLines(comFiles, tokenPattern),
    ];
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('#18 verifies the legacy HTTP fallback stays retired (ACR-0009) outside the S2.19 surface', () => {
    const persistenceClient = readFileSync(resolve(repoRoot, 'server/src/services/persistence/dispatch.ts'), 'utf8');
    expect(persistenceClient).toContain('export async function persistenceCall');
    expect(persistenceClient).not.toContain('PERSISTENCE_URL');
  });

  it('#19 does not introduce event persistence / outbox / replay / subscriber / event API code', () => {
    const pattern =
      /\b(?:persistRuntimeEvent|persistEventEnvelope|saveRuntimeEvent|writeRuntimeEvent|eventOutbox|outboxRepository|replayRuntimeEvent|eventReplay|subscriberRegistry|publishToSubscriber|subscribeToRuntimeEvents|eventApi|activateEventApi)\s*[(.]?/i;
    const matches = matchingCodeTokenLines(s219SurfaceFiles(), pattern);
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('#20 does not introduce outcome persistence', () => {
    const pattern =
      /\b(?:persistOutcome|saveOutcome|writeOutcome|outcomeRepository|outcomeStore)\s*[(.]?/i;
    const matches = matchingCodeTokenLines(s219SurfaceFiles(), pattern);
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('#21 does not introduce Guided Action persistence', () => {
    const pattern =
      /\b(?:persistGuidedAction|saveGuidedAction|writeGuidedAction|guidedActionRepository|guidedActionStore)\s*[(.]?/i;
    const matches = matchingCodeTokenLines(s219SurfaceFiles(), pattern);
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('#22 does not introduce response / session / transcript persistence call shapes', () => {
    // Literal 'disabled' markers are fine; forbid persist*/save*/write* call shapes.
    const pattern =
      /\b(?:persistResponse|saveResponse|writeResponse|responseRepository|responseStore|persistSession|saveSession|writeSession|persistTranscript|saveTranscript|writeTranscript|transcriptRepository|sessionRepository)\s*\(/i;
    const matches = matchingCodeTokenLines(s219SurfaceFiles(), pattern);
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('#23 does not introduce automatic sending / calling / scheduling / prospecting call shapes', () => {
    const pattern =
      /\b(?:sendEmail|sendSms|sendMessage|dispatchEmail|dispatchSms|placeCall|startCall|dialProspect|autoSchedule|automaticSchedule|autoProspect|automatedProspecting|prospectingAutomation|automaticSend|automaticCall)\s*\(/i;
    const matches = matchingCodeTokenLines(s219SurfaceFiles(), pattern);
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('#24 does not introduce scoring / ranking / classification / qualification logic', () => {
    // Call shapes only — the forbidden-field blocklist NAMES (string literals) are
    // stripped, so they cannot trip this scan.
    const pattern =
      /\b(?:computeScore|assignRank|scoreProspect|scoreBa|rankProspect|rankBa|classifyProspect|classifyBa|qualifyProspect|qualifyBa)\s*\(/i;
    const matches = matchingCodeTokenLines(s219SurfaceFiles(), pattern);
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('#25 does not introduce income / compensation / cycle / placement calculation call shapes', () => {
    const pattern =
      /\b(?:predictPlacement|predictIncome|calculateCommission|calculateCompensation|calculateCycle|calculatePlacement|computeCommission|computeCycle)\s*\(/i;
    const matches = matchingCodeTokenLines(s219SurfaceFiles(), pattern);
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('#26 does not introduce knowledge approval call shapes', () => {
    const pattern = /\b(?:knowledgeApproval|approveKnowledge|persistKnowledgeApproval)\s*[(.]?/i;
    const matches = matchingCodeTokenLines(s219SurfaceFiles(), pattern);
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('#27 keeps agentResponseGenerated false in the derivation source and across every derived selection', async () => {
    const derivation = sourceWithoutComments(readSourceFile(selectionRequestFilePath).text);
    expect(derivation).not.toMatch(/agentResponseGenerated:\s*true/);

    // Every selectable catalog key resolves to a controlled, non-generated entry.
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

    // The derivation path itself: a real runtime turn derives a request whose
    // downstream selected entry never carries an agent-generated response.
    const runtimeTurn = await runRuntimeTurnFixtureScenario({ scenario: 'accepted_complete' });
    const derived = deriveMichaelResponseCatalogSelectionRequestFromRuntimeTurn({ runtimeTurn });
    expect(derived.ok, 'derivation from accepted_complete runtime turn').toBe(true);
    if (derived.ok) {
      const selected = selectMichaelResponseCatalogEntry(derived.selectionRequest);
      expect(selected.ok, 'downstream selection').toBe(true);
      if (selected.ok) {
        expect(selected.response.agentResponseGenerated, 'derived agentResponseGenerated').toBe(
          false,
        );
      }
    }
  });

  it('#28 keeps every persistence marker disabled in the derivation / selector source and across every selection', () => {
    const derivation = sourceWithoutComments(readSourceFile(selectionRequestFilePath).text);
    const selector = sourceWithoutComments(readSourceFile(selectorFilePath).text);
    expect(derivation).not.toMatch(/persistence:\s*['"]enabled['"]/);
    expect(selector).not.toMatch(/persistence:\s*['"]enabled['"]/);

    for (const catalogKey of MICHAEL_RESPONSE_CATALOG_SELECTABLE_KEYS) {
      const request = selectionRequestForCatalogKey(catalogKey);
      if (!request) throw new Error(`no selection request for catalog key ${catalogKey}`);
      const result = selectMichaelResponseCatalogEntry(request);
      if (!result.ok) throw new Error(`selection failed for catalog key ${catalogKey}`);
      expect(result.response.persistence, `${catalogKey} persistence`).toBe('disabled');
    }
  });

  it('#29 does not dynamically construct response text in the derivation', () => {
    // The derivation only builds lookup metadata (agentKey/taskType/language/
    // responseType/scenarioFamily) and never sets a `text:` field. Message
    // template literals it does use build issue messages, never response text.
    const derivationStripped = sourceWithoutCommentsOrStrings(
      readSourceFile(selectionRequestFilePath).text,
    );
    const textAssignments = derivationStripped
      .split(/\r?\n/)
      .map((line, index) => ({ line, lineNumber: index + 1 }))
      .filter(({ line }) => /\btext\s*:/.test(line))
      .map(({ line, lineNumber }) => `${selectionRequestFilePath}:${lineNumber}: ${line.trim()}`);
    expect(textAssignments, textAssignments.join('\n')).toEqual([]);

    // No `text:` field is ever assigned a template literal (string-built text).
    const textTemplateAssignments = matchingSourceLines(
      [readSourceFile(selectionRequestFilePath)],
      /\btext\s*:\s*`/,
    );
    expect(textTemplateAssignments, textTemplateAssignments.join('\n')).toEqual([]);
  });

  it('#30 never mutates the runtime turn or the catalog while deriving', async () => {
    const runtimeTurn = await runRuntimeTurnFixtureScenario({ scenario: 'accepted_complete' });

    const turnBefore = JSON.stringify(runtimeTurn);
    const catalogBefore = JSON.stringify(MICHAEL_RESPONSE_CATALOG);

    const derived = deriveMichaelResponseCatalogSelectionRequestFromRuntimeTurn({ runtimeTurn });
    expect(derived.ok, 'derivation completes').toBe(true);

    // Also exercise the adapter-contract-input alias to be thorough — it must not
    // mutate the shared catalog either.
    if (derived.ok) {
      expect(typeof deriveMichaelResponseCatalogSelectionRequest).toBe('function');
    }

    expect(JSON.stringify(runtimeTurn), 'runtime turn unchanged').toBe(turnBefore);
    expect(JSON.stringify(MICHAEL_RESPONSE_CATALOG), 'catalog unchanged').toBe(catalogBefore);
  });
});
