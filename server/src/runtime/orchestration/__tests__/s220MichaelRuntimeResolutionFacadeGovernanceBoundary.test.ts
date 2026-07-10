import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { MICHAEL_RESPONSE_CATALOG } from '../michaelResponseCatalog.js';
import { resolveMichaelRuntimeTurnResponseFromFixture } from '../michaelRuntimeResolutionFacade.js';
import { runRuntimeTurnFixtureScenario } from '../fixtures/runtimeTurnHarness.js';

// ---------------------------------------------------------------------------
// Static source-scanning governance boundary test for the S2.20 Michael
// end-to-end inert RESOLUTION FACADE slice. This mirrors the static-scan style
// of s219MichaelSelectionRequestGovernanceBoundary.test.ts and
// s218MichaelCatalogSelectorGovernanceBoundary.test.ts: source is read from
// disk, comments (and optionally string literals) are stripped, and forbidden
// WIRING patterns must produce empty match arrays. A handful of runtime checks
// resolve real fixture runtime turns through the facade and assert the inert
// invariants (no generated response, persistence disabled, no mutation, fully
// redacted trace).
//
// S2.4-trap avoidance #1: the facade legitimately imports the internal,
// already-inert ORCHESTRATION modules `./michaelResponseContract.js`,
// `./michaelResponseCatalogSelector.js`, `./michaelResponseSelectionRequest.js`
// and `./types.js`. None is a forbidden direct data adapter / persistence dispatch client /
// retrieval helper, so the direct-persistence-adapter scan below targets only
// mongo/neo4j/chroma adapters, `/services/*adapter`, PERSISTENCE-fallback, and
// retrieval helpers — never a bare /adapter/ token. (The selection-request
// module the facade pulls in transitively imports michaelRuntimeAdapterContract,
// but that import lives on a different source surface; the facade source scanned
// here carries only the four allowed relative imports.)
//
// S2.4-trap avoidance #2: the contract, selector and derivation modules carry
// defensive blocklist string literals and message text. Code-token scans strip
// string literals first (matchingCodeTokenLines), so those literals never trip a
// wiring regex. Checks target real wiring — import paths, call shapes — not bare
// identifiers/tokens.
//
// The scan helpers below are copied locally (never imported across test files):
// the s218/s219 specs deliberately keep their helpers private.
// ---------------------------------------------------------------------------

const orchestrationRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = resolve(orchestrationRoot, '../../../..');

const facadeFilePath = 'server/src/runtime/orchestration/michaelRuntimeResolutionFacade.ts';
const orchestrationIndexPath = 'server/src/runtime/orchestration/index.ts';
const runtimeIndexPath = 'server/src/runtime/index.ts';

// The four new S2.20 facade specs. Some may not have landed yet (parallel
// agents); only existing ones are scanned.
const facadeTestPaths = [
  'server/src/runtime/orchestration/__tests__/michaelRuntimeResolutionFacade.test.ts',
  'server/src/runtime/orchestration/__tests__/michaelRuntimeResolutionFacadeRuntimeTurn.test.ts',
  'server/src/runtime/orchestration/__tests__/michaelRuntimeResolutionFacadeParity.test.ts',
  'server/src/runtime/orchestration/__tests__/michaelRuntimeResolutionFacadeTrace.test.ts',
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

// The S2.20 surface: the facade module, the two barrels that re-export it, and
// the new facade specs. collectFiles() skips __tests__, so the specs are listed
// explicitly. Non-existent files (not-yet-landed parallel work) are filtered out
// so the scan is robust to merge order.
function s220SurfaceFiles(): SourceFile[] {
  return [facadeFilePath, orchestrationIndexPath, runtimeIndexPath, ...facadeTestPaths]
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

// Recursively gather every object key name reachable from a value.
function collectKeyNames(value: unknown, keys: Set<string>): void {
  if (Array.isArray(value)) {
    for (const item of value) collectKeyNames(item, keys);
    return;
  }
  if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      keys.add(key);
      collectKeyNames(child, keys);
    }
  }
}

describe('S2.20 Michael runtime resolution facade static governance boundary', () => {
  it('#1 does not import a MongoDB client or model', () => {
    const pattern = /\bfrom\s+['"][^'"]*(?:^|\/|\\|@)(?:mongoose|mongodb)(?:$|\/|\\|['"])/i;
    const matches = matchingImportLines(s220SurfaceFiles(), pattern);
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('#2 does not import a Neo4j driver or adapter', () => {
    const pattern =
      /\bfrom\s+['"][^'"]*(?:neo4j-driver|neo4j-adapter|\/adapters?\/neo4j)[^'"]*['"]/i;
    const matches = matchingImportLines(s220SurfaceFiles(), pattern);
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('#3 does not import a ChromaDB client or adapter', () => {
    const pattern =
      /\bfrom\s+['"][^'"]*(?:chromadb|chroma-client|\/adapters?\/chroma)[^'"]*['"]/i;
    const matches = matchingImportLines(s220SurfaceFiles(), pattern);
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('#4 does not import a GraphRAG client', () => {
    const pattern = /\bfrom\s+['"][^'"]*graph-?rag[^'"]*['"]/i;
    const matches = matchingImportLines(s220SurfaceFiles(), pattern);
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('#5 does not import a direct persistence adapter (the four orchestration imports are allowed)', () => {
    // Targets mongo/neo4j/chroma adapters, /services/*adapter, /adapters/persistence,
    // /persistence/, and tripleStack — never a bare /adapter/ token. The facade's
    // four legitimate orchestration imports are NOT matched.
    const pattern =
      /\bfrom\s+['"][^'"]*(?:\/services\/persistence|\/persistence\/|\/services\/[^'"]*adapter|\/adapters?\/persistence|\/adapters?\/(?:mongo|neo4j|chroma)|tripleStack)[^'"]*['"]/i;
    const matches = matchingImportLines(s220SurfaceFiles(), pattern);
    expect(matches, matches.join('\n')).toEqual([]);

    // Positive guard: the allowed orchestration imports are present and NOT
    // flagged — proving the regex does not over-match the composed modules.
    const facade = readSourceFile(facadeFilePath).text;
    expect(facade).toContain("from './michaelResponseContract.js'");
    expect(facade).toContain("from './michaelResponseCatalogSelector.js'");
    expect(facade).toContain("from './michaelResponseSelectionRequest.js'");
    expect(facade).toContain("from './types.js'");
    expect(
      pattern.test(
        "import { selectMichaelResponseCatalogEntry } from './michaelResponseCatalogSelector.js';",
      ),
    ).toBe(false);
  });

  it('#6 does not import a legacy fallback client (or call persistenceCall)', () => {
    const importPattern =
      /\bfrom\s+['"][^'"]*(?:\/services\/PERSISTENCE|PERSISTENCEFallback|PERSISTENCE-fallback)[^'"]*['"]/i;
    const callPattern = /\bpersistenceCall\s*\(|\bdirectStoreCall\s*\(/;
    const matches = [
      ...matchingImportLines(s220SurfaceFiles(), importPattern),
      ...matchingCodeTokenLines(s220SurfaceFiles(), callPattern),
    ];
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('#7 does not import raw retrieval helpers', () => {
    const pattern =
      /\bfrom\s+['"][^'"]*(?:rawRetrieval|retrievalHelper|directRetrieval|\/retrieval\b)[^'"]*['"]/i;
    const matches = matchingImportLines(s220SurfaceFiles(), pattern);
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('#8 does not call buildContextPacket', () => {
    const pattern = /\bbuildContextPacket\s*\(/;
    const matches = matchingCodeTokenLines(s220SurfaceFiles(), pattern);
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('#9 does not assemble Context Packets', () => {
    const tokenPattern = /\b(?:prepareContextPacketFoundation\s*\(|ContextPacketBuildInput)\b/;
    const markerPattern = /assembledBy:\s*['"]agent_runtime['"]/;
    const matches = [
      ...matchingCodeTokenLines(s220SurfaceFiles(), tokenPattern),
      ...matchingSourceLines(s220SurfaceFiles(), markerPattern),
    ];
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('#10 does not call an LLM provider', () => {
    const pattern =
      /\b(?:chatCompletion|messages\.create|responses\.create|createCompletion|createChatCompletion)\s*\(/i;
    const matches = matchingCodeTokenLines(s220SurfaceFiles(), pattern);
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('#11 does not import an OpenAI / Anthropic / Claude client', () => {
    const pattern =
      /\bfrom\s+['"][^'"]*(?:^|\/|\\|@)(?:openai|anthropic|@anthropic-ai)(?:$|\/|\\|['"])|\bfrom\s+['"][^'"]*(?:\/services\/anthropic|\/services\/openai|\/services\/claude)[^'"]*['"]/i;
    const matches = matchingImportLines(s220SurfaceFiles(), pattern);
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('#12 does not import Steve runtime behavior', () => {
    const importPattern =
      /\bfrom\s+['"][^'"]*(?:steveSuccess|steve-success|\/steve)[^'"]*['"]/i;
    const callPattern = /\b(?:runSteve|createSteve|steveSuccessAdapter|steveRuntime)\b/;
    const matches = [
      ...matchingImportLines(s220SurfaceFiles(), importPattern),
      ...matchingCodeTokenLines(s220SurfaceFiles(), callPattern),
    ];
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('#13 does not import Ivory runtime behavior', () => {
    const importPattern = /\bfrom\s+['"][^'"]*(?:ivory|\/ivory)[^'"]*['"]/i;
    const callPattern = /\b(?:runIvory|createIvory|ivoryAdapter|ivoryRuntime)\b/;
    const matches = [
      ...matchingImportLines(s220SurfaceFiles(), importPattern),
      ...matchingCodeTokenLines(s220SurfaceFiles(), callPattern),
    ];
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('#14 does not wire Telnyx / PSTN / call-control', () => {
    const importPattern = /\bfrom\s+['"][^'"]*(?:telnyx|pstn|call-control)[^'"]*['"]/i;
    // Real call-control WIRING only — never the bare 'callControl' blocklist literal.
    const callPattern =
      /\b(?:telnyx|pstn|callControlId|createCallControl|startCall|placeCall|dialProspect)\s*[(.]/i;
    const matches = [
      ...matchingImportLines(s220SurfaceFiles(), importPattern),
      ...matchingCodeTokenLines(s220SurfaceFiles(), callPattern),
    ];
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('#15 does not create route-like handlers', () => {
    const importPattern = /\bfrom\s+['"](?:express|fastify)['"]/i;
    const callPattern =
      /\b(?:express\s*\(|Router\s*\(|fastify\s*\(|app\.(?:use|get|post|put|patch|delete)\s*\(|router\.(?:use|get|post|put|patch|delete)\s*\()/i;
    const matches = [
      ...matchingImportLines(s220SurfaceFiles(), importPattern),
      ...matchingCodeTokenLines(s220SurfaceFiles(), callPattern),
    ];
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('#16 keeps /api/runtime unmounted in orchestration and the server entrypoint', () => {
    // ACR-0012 / Knowledge Evolution Lane D: the approved /api/runtime/knowledge-evolution mount (spec §25) is permitted; every other /api/runtime family stays forbidden.
    const routePattern =
      /(?:app\.use\s*\(\s*['"`]\/api\/runtime(?!\/knowledge-evolution)\b|app\.(?:get|post|put|patch|delete)\s*\(\s*['"`]\/api\/runtime(?!\/knowledge-evolution)\b|router\.(?:use|get|post|put|patch|delete)\s*\(\s*['"`]\/api\/runtime(?!\/knowledge-evolution)\b)/;
    const matches = [
      ...matchingSourceLines(orchestrationProductionFiles(), routePattern),
      ...matchingSourceLines([readSourceFile('server/src/index.ts')], routePattern),
    ];
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('#17 keeps .com untouched by the S2.20 facade symbols', () => {
    const comFiles = collectFiles('apps/com/src', ['.ts', '.tsx', '.js', '.jsx']);
    const importPattern =
      /\bfrom\s+['"][^'"]*(?:runtime\/orchestration|michaelRuntimeResolutionFacade)[^'"]*['"]/i;
    const tokenPattern =
      /\b(?:resolveMichaelRuntimeTurnResponse|resolveMichaelRuntimeTurnResponseFromAdapterInput|resolveMichaelRuntimeTurnResponseFromFixture|MichaelRuntimeResolutionResult|MichaelRuntimeResolutionTrace|MichaelRuntimeResolutionClassification)\b/i;
    const matches = [
      ...matchingImportLines(comFiles, importPattern),
      ...matchingCodeTokenLines(comFiles, tokenPattern),
    ];
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('#18 verifies the legacy HTTP fallback stays retired (ACR-0009) outside the S2.20 surface', () => {
    const persistenceClient = readFileSync(resolve(repoRoot, 'server/src/services/persistence/dispatch.ts'), 'utf8');
    expect(persistenceClient).toContain('export async function persistenceCall');
    expect(persistenceClient).not.toContain('PERSISTENCE_URL');
  });

  it('#19 does not introduce event persistence / outbox / replay / subscriber / event API code', () => {
    const pattern =
      /\b(?:persistRuntimeEvent|persistEventEnvelope|saveRuntimeEvent|writeRuntimeEvent|eventOutbox|outboxRepository|replayRuntimeEvent|eventReplay|subscriberRegistry|publishToSubscriber|subscribeToRuntimeEvents|eventApi|activateEventApi)\s*[(.]?/i;
    const matches = matchingCodeTokenLines(s220SurfaceFiles(), pattern);
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('#20 does not introduce outcome persistence', () => {
    const pattern =
      /\b(?:persistOutcome|saveOutcome|writeOutcome|outcomeRepository|outcomeStore)\s*[(.]?/i;
    const matches = matchingCodeTokenLines(s220SurfaceFiles(), pattern);
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('#21 does not introduce Guided Action persistence', () => {
    const pattern =
      /\b(?:persistGuidedAction|saveGuidedAction|writeGuidedAction|guidedActionRepository|guidedActionStore)\s*[(.]?/i;
    const matches = matchingCodeTokenLines(s220SurfaceFiles(), pattern);
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('#22 does not introduce response / session / transcript persistence call shapes', () => {
    // Literal 'disabled' markers are fine; forbid persist*/save*/write* call shapes.
    const pattern =
      /\b(?:persistResponse|saveResponse|writeResponse|responseRepository|responseStore|persistSession|saveSession|writeSession|persistTranscript|saveTranscript|writeTranscript|transcriptRepository|sessionRepository)\s*\(/i;
    const matches = matchingCodeTokenLines(s220SurfaceFiles(), pattern);
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('#23 does not introduce automatic sending / calling / scheduling / prospecting call shapes', () => {
    const pattern =
      /\b(?:sendEmail|sendSms|sendMessage|dispatchEmail|dispatchSms|placeCall|startCall|dialProspect|autoSchedule|automaticSchedule|autoProspect|automatedProspecting|prospectingAutomation|automaticSend|automaticCall)\s*\(/i;
    const matches = matchingCodeTokenLines(s220SurfaceFiles(), pattern);
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('#24 does not introduce scoring / ranking / classification / qualification logic', () => {
    // Call shapes only — the forbidden-field blocklist NAMES (string literals) are
    // stripped, so they cannot trip this scan.
    const pattern =
      /\b(?:computeScore|assignRank|scoreProspect|scoreBa|rankProspect|rankBa|classifyProspect|classifyBa|qualifyProspect|qualifyBa)\s*\(/i;
    const matches = matchingCodeTokenLines(s220SurfaceFiles(), pattern);
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('#25 does not introduce income / compensation / cycle / placement calculation call shapes', () => {
    const pattern =
      /\b(?:predictPlacement|predictIncome|calculateCommission|calculateCompensation|calculateCycle|calculatePlacement|computeCommission|computeCycle)\s*\(/i;
    const matches = matchingCodeTokenLines(s220SurfaceFiles(), pattern);
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('#26 does not introduce knowledge approval call shapes', () => {
    const pattern = /\b(?:knowledgeApproval|approveKnowledge|persistKnowledgeApproval)\s*[(.]?/i;
    const matches = matchingCodeTokenLines(s220SurfaceFiles(), pattern);
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('#27 keeps agentResponseGenerated false in the facade source and across resolved runtime turns', async () => {
    const facade = sourceWithoutComments(readSourceFile(facadeFilePath).text);
    expect(facade).not.toMatch(/agentResponseGenerated:\s*true/);

    const scenarios = ['accepted_complete', 'accepted_degraded', 'failed_context'] as const;
    let resolvedCount = 0;
    for (const scenario of scenarios) {
      const runtimeTurn = await runRuntimeTurnFixtureScenario({ scenario });
      // The fixture harness itself never generates an agent response.
      expect(runtimeTurn.agentResponseGenerated, `${scenario} harness`).toBe(false);

      const result = resolveMichaelRuntimeTurnResponseFromFixture({ runtimeTurn });
      if (!result.ok) continue;
      resolvedCount += 1;
      expect(result.response.agentResponseGenerated, `${scenario} response`).toBe(false);
      expect(result.trace.agentResponseGenerated, `${scenario} trace`).toBe(false);
    }
    expect(resolvedCount, 'at least one scenario resolved').toBeGreaterThan(0);
  });

  it('#28 keeps every persistence marker disabled in the facade source and across resolved runtime turns', async () => {
    const facade = sourceWithoutComments(readSourceFile(facadeFilePath).text);
    expect(facade).not.toMatch(/persistence:\s*['"]enabled['"]/);

    const runtimeTurn = await runRuntimeTurnFixtureScenario({ scenario: 'accepted_complete' });
    const result = resolveMichaelRuntimeTurnResponseFromFixture({ runtimeTurn });
    expect(result.ok, 'accepted_complete resolves').toBe(true);
    if (result.ok) {
      expect(result.response.persistence, 'response persistence').toBe('disabled');
      expect(result.trace.persistence, 'trace persistence').toBe('disabled');
    }
  });

  it('#29 does not dynamically construct response text in the facade', () => {
    // The facade returns the pre-authored catalog response by reference and only
    // builds controlled trace metadata. It never sets a `text:` field.
    const facadeStripped = sourceWithoutCommentsOrStrings(readSourceFile(facadeFilePath).text);
    const textAssignments = facadeStripped
      .split(/\r?\n/)
      .map((line, index) => ({ line, lineNumber: index + 1 }))
      .filter(({ line }) => /\btext\s*:/.test(line))
      .map(({ line, lineNumber }) => `${facadeFilePath}:${lineNumber}: ${line.trim()}`);
    expect(textAssignments, textAssignments.join('\n')).toEqual([]);

    // No `text:` field is ever assigned a template literal (string-built text).
    const textTemplateAssignments = matchingSourceLines(
      [readSourceFile(facadeFilePath)],
      /\btext\s*:\s*`/,
    );
    expect(textTemplateAssignments, textTemplateAssignments.join('\n')).toEqual([]);
  });

  it('#30 never mutates the runtime turn or the catalog while resolving', async () => {
    const runtimeTurn = await runRuntimeTurnFixtureScenario({ scenario: 'accepted_complete' });

    const turnBefore = JSON.stringify(runtimeTurn);
    const catalogBefore = JSON.stringify(MICHAEL_RESPONSE_CATALOG);

    const result = resolveMichaelRuntimeTurnResponseFromFixture({ runtimeTurn });
    expect(result.ok, 'resolution completes').toBe(true);

    expect(JSON.stringify(runtimeTurn), 'runtime turn unchanged').toBe(turnBefore);
    expect(JSON.stringify(MICHAEL_RESPONSE_CATALOG), 'catalog unchanged').toBe(catalogBefore);
  });

  it('#31 returns a fully redacted trace with no raw packet / retrieval / store / IDs / PII keys', async () => {
    const runtimeTurn = await runRuntimeTurnFixtureScenario({ scenario: 'accepted_complete' });
    const result = resolveMichaelRuntimeTurnResponseFromFixture({ runtimeTurn });
    expect(result.ok, 'accepted_complete resolves').toBe(true);
    if (!result.ok) return;

    const traceKeys = new Set<string>();
    collectKeyNames(result.trace, traceKeys);
    const traceKeysLower = new Set([...traceKeys].map((key) => key.toLowerCase()));

    // Exact (case-insensitive) key-name matches only, so structural keys such as
    // `contextPacketStatus` never collide with the forbidden `contextPacket` name.
    const forbiddenKeys = [
      'packet',
      'contextPacket',
      'retrievalAudit',
      'retrieval',
      'rawRetrieval',
      'candidateKnowledge',
      'mongo',
      'neo4j',
      'chroma',
      'graphRag',
      'graphrag',
      'toolServer',
      'rawStoreResults',
      'rawGraphRagResults',
      'rawToolServerResponse',
      'token',
      'requestId',
      'sessionId',
      'correlationId',
      'turnId',
      'email',
      'phone',
      'prospect',
      'text',
    ];
    const leaked = forbiddenKeys.filter((key) => traceKeysLower.has(key.toLowerCase()));
    expect(leaked, `trace leaked redacted keys: ${leaked.join(', ')}`).toEqual([]);
  });
});
