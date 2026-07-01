import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import {
  michaelRuntimeResponseEnabled,
  michaelRuntimeRouteEnabled,
  michaelRuntimeTraceEnabled,
} from '../../config/michaelRuntimeFlags.js';
import {
  resolveMichaelRuntimeTurnResponseFromFixture,
  runRuntimeTurnFixtureScenario,
} from '../../runtime/orchestration/index.js';

// ---------------------------------------------------------------------------
// Sprint 3 S3.4 — static source-scanning governance boundary test for the FIRST
// runtime-facing Michael route (POST /api/michael-runtime/resolve). It mirrors
// the static-scan style of
// server/src/runtime/orchestration/__tests__/s220MichaelRuntimeResolutionFacadeGovernanceBoundary.test.ts:
// production source is read from disk, comments (and, for code-token scans,
// string literals) are stripped, and forbidden WIRING patterns must produce
// empty match arrays. Defensive literals (e.g. blocklist field names, message
// strings) cannot trip a wiring regex because matchingCodeTokenLines strips
// string literals before matching.
//
// The route is `.team`-only, authenticated, BA-scoped, fixtures-only via the
// inert S2.20 facade, non-persistent, LLM-free, voice-free, and fail-closed
// behind a default-off three-axis kill switch. This file proves those
// boundaries hold at the source level plus a single facade-direct inert
// invariant. The scan helpers below are copied locally (never imported across
// test files), matching the s220 spec's private-helper convention.
// ---------------------------------------------------------------------------

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');

const routeFilePath = 'server/src/routes/michael-runtime.ts';
const indexFilePath = 'server/src/index.ts';

type SourceFile = {
  readonly relativePath: string;
  readonly text: string;
};

function readSourceFile(relativePath: string): SourceFile {
  return {
    relativePath,
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

// Code-token scan: string literals stripped first, so defensive blocklist
// literals never trip a wiring regex.
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

function routeFiles(): SourceFile[] {
  return [readSourceFile(routeFilePath)];
}

describe('S3.4 Michael runtime route static governance boundary', () => {
  it('#1 server/src/routes/michael-runtime.ts exists', () => {
    expect(existsSync(resolve(repoRoot, routeFilePath))).toBe(true);
  });

  it('#2 imports requireAuth from ../middleware/requireAuth.js', () => {
    const matches = matchingImportLines(
      routeFiles(),
      /\brequireAuth\b[\s\S]*?from\s+['"]\.\.\/middleware\/requireAuth\.js['"]/,
    );
    expect(matches.length, matches.join('\n')).toBeGreaterThan(0);
  });

  it('#3 imports requireSteveComplete from ../middleware/requireSteveComplete.js', () => {
    const matches = matchingImportLines(
      routeFiles(),
      /\brequireSteveComplete\b[\s\S]*?from\s+['"]\.\.\/middleware\/requireSteveComplete\.js['"]/,
    );
    expect(matches.length, matches.join('\n')).toBeGreaterThan(0);
  });

  it('#4 does NOT import or reference requireMichaelComplete', () => {
    const matches = matchingCodeTokenLines(routeFiles(), /\brequireMichaelComplete\b/);
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('#5 imports the S2.20 facade resolveMichaelRuntimeTurnResponse as the resolution entry point', () => {
    const route = readSourceFile(routeFilePath).text;
    expect(route).toContain('resolveMichaelRuntimeTurnResponse');
    // S3.11: the facade now shares a multiline `import { … } from
    // '../runtime/orchestration/index.js'` with the server-owned turn source, so
    // the import is matched across the whole (possibly multiline) statement.
    const facadeImport =
      /import\s*\{[\s\S]*?\bresolveMichaelRuntimeTurnResponse\b[\s\S]*?\}\s*from\s+['"]\.\.\/runtime\/orchestration\/index\.js['"]/;
    expect(facadeImport.test(route), 'S2.20 facade imported from orchestration index').toBe(true);
  });

  it('#6 does NOT import the S2.13 harness (michaelRuntimeResponseHarness / michaelRuntimeResponseScenarios)', () => {
    const matches = matchingCodeTokenLines(
      routeFiles(),
      /\b(?:michaelRuntimeResponseHarness|michaelRuntimeResponseScenarios|createMichaelRuntimeResponseFixtureHarness)\b/,
    );
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('#7 does not import a MongoDB client or model', () => {
    const pattern = /\bfrom\s+['"][^'"]*(?:^|\/|\\|@)(?:mongoose|mongodb)(?:$|\/|\\|['"])/i;
    const matches = matchingImportLines(routeFiles(), pattern);
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('#8 does not import a Neo4j driver or adapter', () => {
    const pattern =
      /\bfrom\s+['"][^'"]*(?:neo4j-driver|neo4j-adapter|\/adapters?\/neo4j|\/neo4j)[^'"]*['"]/i;
    const matches = matchingImportLines(routeFiles(), pattern);
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('#9 does not import a ChromaDB client or adapter', () => {
    const pattern =
      /\bfrom\s+['"][^'"]*(?:chromadb|chroma-client|\/adapters?\/chroma|\/chroma)[^'"]*['"]/i;
    const matches = matchingImportLines(routeFiles(), pattern);
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('#10 does not import a GraphRAG client', () => {
    const pattern = /\bfrom\s+['"][^'"]*graph-?rag[^'"]*['"]/i;
    const matches = matchingImportLines(routeFiles(), pattern);
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('#11 does not import a Gateway fallback client (or call gatewayCall)', () => {
    const importPattern =
      /\bfrom\s+['"][^'"]*(?:\/services\/gateway|gatewayFallback|gateway-fallback|\/tripleStack)[^'"]*['"]/i;
    const callPattern = /\b(?:gatewayCall|tripleStackWrite|directPersistenceCall)\s*\(/;
    const matches = [
      ...matchingImportLines(routeFiles(), importPattern),
      ...matchingCodeTokenLines(routeFiles(), callPattern),
    ];
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('#12 does not import raw retrieval helpers', () => {
    const pattern =
      /\bfrom\s+['"][^'"]*(?:rawRetrieval|retrievalHelper|directRetrieval|\/retrieval\b)[^'"]*['"]/i;
    const matches = matchingImportLines(routeFiles(), pattern);
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('#13 does not call an LLM provider', () => {
    const pattern =
      /\b(?:chatCompletion|messages\.create|responses\.create|createCompletion|createChatCompletion)\s*\(/i;
    const matches = matchingCodeTokenLines(routeFiles(), pattern);
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('#14 does not import an OpenAI / Anthropic / Claude client', () => {
    const pattern =
      /\bfrom\s+['"][^'"]*(?:^|\/|\\|@)(?:openai|anthropic|@anthropic-ai)(?:$|\/|\\|['"])|\bfrom\s+['"][^'"]*(?:\/services\/anthropic|\/services\/openai|\/services\/claude)[^'"]*['"]/i;
    const matches = matchingImportLines(routeFiles(), pattern);
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('#15 does not wire Telnyx / PSTN / call-control', () => {
    const importPattern = /\bfrom\s+['"][^'"]*(?:telnyx|pstn|call-control)[^'"]*['"]/i;
    // Real call-control WIRING only — never a bare blocklist literal.
    const callPattern =
      /\b(?:telnyx|pstn|callControlId|createCallControl|startCall|placeCall|dialProspect)\s*[(.]/i;
    const matches = [
      ...matchingImportLines(routeFiles(), importPattern),
      ...matchingCodeTokenLines(routeFiles(), callPattern),
    ];
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('#16 does not introduce persistence write call shapes', () => {
    const pattern =
      /\.(?:insert|update|save|create)\s*\(|\btripleStackWrite\s*\(|\b(?:persist|save|write)\w*\s*\(/i;
    const matches = matchingCodeTokenLines(routeFiles(), pattern);
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('#17 does not introduce automatic sending / calling / scheduling / prospecting call shapes', () => {
    const pattern =
      /\b(?:sendEmail|sendSms|sendMessage|dispatchEmail|dispatchSms|placeCall|startCall|dialProspect|autoSchedule|automaticSchedule|autoProspect|automatedProspecting|prospectingAutomation|automaticSend|automaticCall)\s*\(/i;
    const matches = matchingCodeTokenLines(routeFiles(), pattern);
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('#18 does not introduce scoring / ranking / qualification / classification call shapes', () => {
    const pattern =
      /\b(?:computeScore|assignRank|scoreProspect|scoreBa|rankProspect|rankBa|classifyProspect|classifyBa|qualifyProspect|qualifyBa)\s*\(/i;
    const matches = matchingCodeTokenLines(routeFiles(), pattern);
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('#19 does not introduce knowledge approval call shapes', () => {
    const pattern = /\b(?:knowledgeApproval|approveKnowledge|persistKnowledgeApproval)\s*[(.]?/i;
    const matches = matchingCodeTokenLines(routeFiles(), pattern);
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('#20 applies BOTH requireAuth and requireSteveComplete on the /resolve registration', () => {
    const route = sourceWithoutComments(readSourceFile(routeFilePath).text);
    const pattern =
      /\.post\(\s*['"`]\/resolve['"`]\s*,\s*requireAuth\s*,\s*requireSteveComplete\s*,/;
    expect(pattern.test(route), 'post(/resolve, requireAuth, requireSteveComplete, ...) not found').toBe(true);
  });

  it('#21 derives BA scope from the session and rejects body-supplied runtime input (incl. BA authority) via CLIENT_RUNTIME_INPUT_NOT_ALLOWED', () => {
    const route = readSourceFile(routeFilePath).text;
    // BA scope is session-derived, never body-derived (sponsor immutability).
    expect(route).toContain('req.session?.tmagId');
    // S3.11 server-owned body rule SUBSUMES the old body-BA-scope rejection: any
    // non-`language` field — including tmagId/sponsorTmagId/targetTmagId — is rejected
    // with the single broader code.
    expect(route).toContain('CLIENT_RUNTIME_INPUT_NOT_ALLOWED');
    // The retired reason codes are gone (no weakening — the rule got broader).
    expect(route).not.toContain('BODY_BA_SCOPE_NOT_ALLOWED');
    expect(route).not.toContain('MISSING_RUNTIME_TURN');
    // Body BA authority is never read as scope. Comments AND strings stripped so
    // the self-documenting forbidden-key comment cannot trip this.
    const stripped = sourceWithoutCommentsOrStrings(route);
    expect(
      /\b(?:req\.body|body)\.(?:tmagId|sponsorTmagId|targetTmagId|downlineTmagId|prospectId)\b/.test(stripped),
      'no body BA-authority read in code',
    ).toBe(false);
  });

  it('#22 includes the trace only conditionally on the trace flag', () => {
    const route = readSourceFile(routeFilePath).text;
    expect(route).toContain('michaelRuntimeTraceEnabled');
    expect(route).toContain('trace');
    // The trace assignment is guarded by the flag (flag reference precedes the
    // payload.trace assignment in source).
    const flagIndex = route.indexOf('michaelRuntimeTraceEnabled()');
    const traceAssignIndex = route.indexOf('payload.trace');
    expect(flagIndex, 'michaelRuntimeTraceEnabled() called').toBeGreaterThanOrEqual(0);
    expect(traceAssignIndex, 'payload.trace assigned').toBeGreaterThan(flagIndex);
  });

  it('#23 does not spread the response into the trace; the only trace assignment is payload.trace = result.trace', () => {
    const route = sourceWithoutComments(readSourceFile(routeFilePath).text);
    expect(route).not.toMatch(/trace\s*:\s*result\.response/);
    expect(route).not.toMatch(/\.\.\.\s*result\.response/);
    expect(route).toContain('payload.trace = result.trace');
  });

  it('#24 index.ts mounts /api/michael-runtime', () => {
    const index = readSourceFile(indexFilePath).text;
    expect(/app\.use\(\s*['"`]\/api\/michael-runtime/.test(index)).toBe(true);
  });

  it('#25 mounts /api/michael-runtime BELOW the gated mounts (after /api/cockpit or /api/orientation)', () => {
    const index = readSourceFile(indexFilePath).text;
    const runtimeIndex = index.search(/app\.use\(\s*['"`]\/api\/michael-runtime/);
    const cockpitIndex = index.search(/app\.use\(\s*['"`]\/api\/cockpit['"`]/);
    const orientationIndex = index.search(/app\.use\(\s*['"`]\/api\/orientation['"`]/);
    const gatedAnchor = Math.max(cockpitIndex, orientationIndex);
    expect(runtimeIndex, 'michael-runtime mount present').toBeGreaterThan(0);
    expect(gatedAnchor, 'a gated mount (cockpit/orientation) present').toBeGreaterThan(0);
    expect(runtimeIndex).toBeGreaterThan(gatedAnchor);
  });

  it('#26 does NOT mount a bare /api/runtime family', () => {
    const index = readSourceFile(indexFilePath).text;
    expect(/app\.use\(\s*['"`]\/api\/runtime\b/.test(index)).toBe(false);
  });

  it('#27 keeps /api/michael in the PRE-GATE block (before the gated banner and gated mounts)', () => {
    const index = readSourceFile(indexFilePath).text;
    const michaelIndex = index.search(/app\.use\(\s*['"`]\/api\/michael['"`]\s*,\s*michaelRoutes/);
    const gatedBannerIndex = index.indexOf('BA-FACING GATED ROUTES');
    const runtimeIndex = index.search(/app\.use\(\s*['"`]\/api\/michael-runtime/);
    expect(michaelIndex, 'pre-gate /api/michael mount present').toBeGreaterThan(0);
    expect(gatedBannerIndex, 'gated banner present').toBeGreaterThan(0);
    expect(michaelIndex).toBeLessThan(gatedBannerIndex);
    expect(michaelIndex).toBeLessThan(runtimeIndex);
  });

  // --- #28 flag hygiene: snapshot + restore env around the assertions. -----
  const FLAG_ENV_KEYS = [
    'MICHAEL_RUNTIME_ROUTE_ENABLED',
    'MICHAEL_RUNTIME_RESPONSE_ENABLED',
    'MICHAEL_RUNTIME_TRACE_ENABLED',
  ] as const;
  const envSnapshot: Record<string, string | undefined> = {};
  for (const key of FLAG_ENV_KEYS) envSnapshot[key] = process.env[key];

  afterEach(() => {
    for (const key of FLAG_ENV_KEYS) {
      const value = envSnapshot[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it('#28 the three kill-switch flags are default-off and only "true" enables them', () => {
    for (const key of FLAG_ENV_KEYS) delete process.env[key];
    expect(michaelRuntimeRouteEnabled()).toBe(false);
    expect(michaelRuntimeResponseEnabled()).toBe(false);
    expect(michaelRuntimeTraceEnabled()).toBe(false);

    process.env.MICHAEL_RUNTIME_ROUTE_ENABLED = 'true';
    expect(michaelRuntimeRouteEnabled()).toBe(true);
    // The other two stay off — the axes are independent.
    expect(michaelRuntimeResponseEnabled()).toBe(false);
    expect(michaelRuntimeTraceEnabled()).toBe(false);

    // A non-exact value never enables an axis.
    process.env.MICHAEL_RUNTIME_RESPONSE_ENABLED = 'TRUE';
    expect(michaelRuntimeResponseEnabled()).toBe(false);
  });

  it('#29 a resolved runtime turn through the inert S2.20 facade stays non-persistent and generates no agent response', async () => {
    const runtimeTurn = await runRuntimeTurnFixtureScenario({ scenario: 'accepted_complete' });
    const result = resolveMichaelRuntimeTurnResponseFromFixture({ runtimeTurn });
    expect(result.ok, 'accepted_complete resolves').toBe(true);
    if (!result.ok) return;
    expect(result.response.persistence, 'response persistence').toBe('disabled');
    expect(result.response.agentResponseGenerated, 'response agentResponseGenerated').toBe(false);
    expect(result.trace.agentResponseGenerated, 'trace agentResponseGenerated').toBe(false);
  });

  it('#30 keeps agentResponseGenerated false and never dynamically constructs response text in the route', () => {
    const route = sourceWithoutComments(readSourceFile(routeFilePath).text);
    expect(route).not.toMatch(/agentResponseGenerated:\s*true/);
    // No `text:` field assignment (string-stripped, so message literals can't trip it).
    const routeStripped = sourceWithoutCommentsOrStrings(readSourceFile(routeFilePath).text);
    const textAssignments = routeStripped
      .split(/\r?\n/)
      .map((line, index) => ({ line, lineNumber: index + 1 }))
      .filter(({ line }) => /\btext\s*:/.test(line))
      .map(({ line, lineNumber }) => `${routeFilePath}:${lineNumber}: ${line.trim()}`);
    expect(textAssignments, textAssignments.join('\n')).toEqual([]);
    expect(route).not.toMatch(/\btext\s*:\s*`/);
  });

  it('#31 keeps .com untouched — no apps/com import in the route', () => {
    const pattern = /\bfrom\s+['"][^'"]*apps\/com[^'"]*['"]/i;
    const matches = matchingImportLines(routeFiles(), pattern);
    expect(matches, matches.join('\n')).toEqual([]);
  });
});
