import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// ---------------------------------------------------------------------------
// Sprint 3 S3.6 — static source-scanning governance boundary test for the
// Michael runtime route OBSERVABILITY slice. It mirrors the static-scan style
// of server/src/routes/__tests__/s34MichaelRuntimeRouteGovernanceBoundary.test.ts:
// production source is read from disk, comments (and, for code-token scans,
// string literals) are stripped, and forbidden WIRING patterns must produce
// empty match arrays. Defensive literals (e.g. doc-comment prohibitions such as
// "must never call appendAuditEntry", or blocklist field names) cannot trip a
// wiring regex because matchingCodeTokenLines strips comments AND string
// literals before matching.
//
// The slice adds:
//   - server/src/services/michaelRuntimeObservability.ts (Agent A) —
//     in-memory aggregate counters ONLY. No persistence, no fs, no LLM, no
//     store, no raw-data capture (no body/response/trace/contextPacket/PII/
//     token/sessionId/turnId/correlationId).
//   - server/src/routes/admin/michael-runtime-observability.ts (Agent B) —
//     Kevin-only (requireAdmin) JSON read of the snapshot. No persistence, no
//     audit log, not React/TSX, not `.com`.
//   - server/src/routes/michael-runtime.ts (Agent A) — wired counters; the ONLY
//     new import is the observability module. S2.20 facade, requireAuth +
//     requireSteveComplete preserved; no harness, no persistence/LLM/store.
//   - server/src/index.ts (Agent B) — mounts /api/admin/michael-runtime; does
//     NOT mount /api/runtime; /api/michael pre-gate + /api/michael-runtime BA
//     route untouched; no MICHAEL_RUNTIME_* env defaults flipped.
//
// The scan helpers below are copied locally (never imported across test files),
// matching the s34 spec's private-helper convention. This file does NOT import
// or modify production code — it reads source text only.
// ---------------------------------------------------------------------------

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');

const serviceFilePath = 'server/src/services/michaelRuntimeObservability.ts';
const adminRouteFilePath = 'server/src/routes/admin/michael-runtime-observability.ts';
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

// Code-token scan: comments AND string literals stripped first, so defensive
// doc-comment prohibitions and blocklist literals never trip a wiring regex.
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

function serviceFiles(): SourceFile[] {
  return [readSourceFile(serviceFilePath)];
}

function adminRouteFiles(): SourceFile[] {
  return [readSourceFile(adminRouteFilePath)];
}

function routeFiles(): SourceFile[] {
  return [readSourceFile(routeFilePath)];
}

// ---------------------------------------------------------------------------
// GROUP A — observability SERVICE (michaelRuntimeObservability.ts).
// In-memory aggregate counters ONLY. No store, no persistence, no fs, no LLM,
// no telephony, no raw-data capture.
// ---------------------------------------------------------------------------
describe('S3.6 observability service static governance boundary', () => {
  it('#1 server/src/services/michaelRuntimeObservability.ts exists', () => {
    expect(existsSync(resolve(repoRoot, serviceFilePath))).toBe(true);
  });

  it('#2 does not import a MongoDB client or model', () => {
    const pattern = /\bfrom\s+['"][^'"]*(?:^|\/|\\|@)(?:mongoose|mongodb)(?:$|\/|\\|['"])/i;
    const matches = matchingImportLines(serviceFiles(), pattern);
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('#3 does not import a Neo4j driver or adapter', () => {
    const pattern =
      /\bfrom\s+['"][^'"]*(?:neo4j-driver|neo4j-adapter|\/adapters?\/neo4j|\/neo4j)[^'"]*['"]/i;
    const matches = matchingImportLines(serviceFiles(), pattern);
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('#4 does not import a ChromaDB client or adapter', () => {
    const pattern =
      /\bfrom\s+['"][^'"]*(?:chromadb|chroma-client|\/adapters?\/chroma|\/chroma)[^'"]*['"]/i;
    const matches = matchingImportLines(serviceFiles(), pattern);
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('#5 does not import a GraphRAG client', () => {
    const pattern = /\bfrom\s+['"][^'"]*graph-?rag[^'"]*['"]/i;
    const matches = matchingImportLines(serviceFiles(), pattern);
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('#6 does not import a Gateway/tripleStack client (or call gatewayCall/tripleStackWrite)', () => {
    const importPattern =
      /\bfrom\s+['"][^'"]*(?:\/services\/gateway|gatewayFallback|gateway-fallback|\/tripleStack)[^'"]*['"]/i;
    const callPattern = /\b(?:gatewayCall|tripleStackWrite|directPersistenceCall)\s*\(/;
    const matches = [
      ...matchingImportLines(serviceFiles(), importPattern),
      ...matchingCodeTokenLines(serviceFiles(), callPattern),
    ];
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('#7 does not import raw retrieval helpers', () => {
    const pattern =
      /\bfrom\s+['"][^'"]*(?:rawRetrieval|retrievalHelper|directRetrieval|\/retrieval\b)[^'"]*['"]/i;
    const matches = matchingImportLines(serviceFiles(), pattern);
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('#8 does not introduce persistence write call shapes (.insert/.update/.save/.create)', () => {
    const pattern = /\.(?:insert|update|save|create)\s*\(/i;
    const matches = matchingCodeTokenLines(serviceFiles(), pattern);
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('#9 does not import fs or write to the file system', () => {
    const importPattern = /\bfrom\s+['"](?:node:)?fs(?:\/promises)?['"]/i;
    const callPattern = /\b(?:writeFile|writeFileSync|appendFile|appendFileSync|createWriteStream)\s*\(/;
    const matches = [
      ...matchingImportLines(serviceFiles(), importPattern),
      ...matchingCodeTokenLines(serviceFiles(), callPattern),
    ];
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('#10 does not import an OpenAI / Anthropic / Claude client', () => {
    const pattern =
      /\bfrom\s+['"][^'"]*(?:^|\/|\\|@)(?:openai|anthropic|@anthropic-ai)(?:$|\/|\\|['"])|\bfrom\s+['"][^'"]*(?:\/services\/anthropic|\/services\/openai|\/services\/claude)[^'"]*['"]/i;
    const matches = matchingImportLines(serviceFiles(), pattern);
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('#11 does not call an LLM provider or import the S2.13 Michael harness', () => {
    const callPattern =
      /\b(?:chatCompletion|messages\.create|responses\.create|createCompletion|createChatCompletion)\s*\(/i;
    const harnessPattern =
      /\b(?:michaelRuntimeResponseHarness|michaelRuntimeResponseScenarios|createMichaelRuntimeResponseFixtureHarness)\b/;
    const matches = [
      ...matchingCodeTokenLines(serviceFiles(), callPattern),
      ...matchingCodeTokenLines(serviceFiles(), harnessPattern),
    ];
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('#12 does not wire Telnyx / PSTN / call-control', () => {
    const importPattern = /\bfrom\s+['"][^'"]*(?:telnyx|pstn|call-control)[^'"]*['"]/i;
    const callPattern =
      /\b(?:telnyx|pstn|callControlId|createCallControl|startCall|placeCall|dialProspect)\s*[(.]/i;
    const matches = [
      ...matchingImportLines(serviceFiles(), importPattern),
      ...matchingCodeTokenLines(serviceFiles(), callPattern),
    ];
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('#13 stores aggregate counts ONLY — no body/response/trace/contextPacket/PII/token/session/turn/correlation raw-data fields', () => {
    // Comments stripped: the header doc-comment legitimately mentions "body",
    // "trace", "tokens", "PII" etc. The legitimate counter/flag identifiers
    // (responseDisabledSkips, traceEnabled, bodyBaOverrideRejections, ...) are
    // camelCase-joined, so a word-boundary scan cannot match them.
    const stripped = sourceWithoutComments(readSourceFile(serviceFilePath).text);
    const forbidden =
      /\b(?:body|requestBody|responseBody|response|trace|contextPacket|context_packet|pii|token|sessionId|turnId|correlationId)\b/i;
    const matches = stripped
      .split(/\r?\n/)
      .map((line, index) => ({ line, lineNumber: index + 1 }))
      .filter(({ line }) => forbidden.test(line))
      .map(({ line, lineNumber }) => `${serviceFilePath}:${lineNumber}: ${line.trim()}`);
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('#14 declares EXACTLY the six aggregate counters and nothing else', () => {
    const text = readSourceFile(serviceFilePath).text;
    const interfaceMatch = text.match(
      /interface\s+MichaelRuntimeObservabilityCounters\s*\{([\s\S]*?)\}/,
    );
    expect(interfaceMatch, 'counter interface present').not.toBeNull();
    const body = interfaceMatch?.[1] ?? '';
    const fieldCount = (body.match(/:\s*number\s*;/g) ?? []).length;
    expect(fieldCount, 'exactly six counter fields').toBe(6);
    for (const counter of [
      'routeDisabledSkips',
      'responseDisabledSkips',
      'successfulFacadeResolutions',
      'facadeFailures',
      'bodyBaOverrideRejections',
      'missingTurnRejections',
    ]) {
      expect(body, `counter ${counter} declared`).toContain(counter);
    }
  });
});

// ---------------------------------------------------------------------------
// GROUP B — admin observability ROUTE (admin/michael-runtime-observability.ts).
// Kevin-only (requireAdmin) JSON read of the snapshot. No persistence, no audit
// log, not React/TSX, not `.com`.
// ---------------------------------------------------------------------------
describe('S3.6 admin observability route static governance boundary', () => {
  it('#15 server/src/routes/admin/michael-runtime-observability.ts exists', () => {
    expect(existsSync(resolve(repoRoot, adminRouteFilePath))).toBe(true);
  });

  it('#16 imports requireAdmin from ../../middleware/requireAuth.js', () => {
    const matches = matchingImportLines(
      adminRouteFiles(),
      /\brequireAdmin\b[\s\S]*?from\s+['"]\.\.\/\.\.\/middleware\/requireAuth\.js['"]/,
    );
    expect(matches.length, matches.join('\n')).toBeGreaterThan(0);
  });

  it('#17 applies requireAdmin on the /observability route registration', () => {
    const route = sourceWithoutComments(readSourceFile(adminRouteFilePath).text);
    const pattern = /\.get\(\s*['"`]\/observability['"`]\s*,\s*requireAdmin\s*,/;
    expect(pattern.test(route), 'get(/observability, requireAdmin, ...) not found').toBe(true);
  });

  it('#18 reads the snapshot from the observability service (getMichaelRuntimeObservabilitySnapshot)', () => {
    const matches = matchingImportLines(
      adminRouteFiles(),
      /\bgetMichaelRuntimeObservabilitySnapshot\b[\s\S]*?from\s+['"]\.\.\/\.\.\/services\/michaelRuntimeObservability\.js['"]/,
    );
    expect(matches.length, matches.join('\n')).toBeGreaterThan(0);
  });

  it('#19 does NOT import or call appendAuditEntry / persist (the doc-comment prohibition is stripped)', () => {
    const auditPattern = /\b(?:appendAuditEntry|writeAuditEntry|recordAudit|persistAudit)\s*\(/;
    const auditImport = /\bappendAuditEntry\b/;
    const matches = [
      ...matchingCodeTokenLines(adminRouteFiles(), auditPattern),
      ...matchingCodeTokenLines(adminRouteFiles(), auditImport),
    ];
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('#20 does not introduce persistence write call shapes (.insert/.update/.save/.create/tripleStackWrite)', () => {
    const pattern = /\.(?:insert|update|save|create)\s*\(|\btripleStackWrite\s*\(/i;
    const matches = matchingCodeTokenLines(adminRouteFiles(), pattern);
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('#21 does not import a Mongo/Neo4j/Chroma/GraphRAG/Gateway store client', () => {
    const pattern =
      /\bfrom\s+['"][^'"]*(?:mongoose|mongodb|neo4j|chromadb|chroma-client|graph-?rag|\/services\/gateway|\/tripleStack)[^'"]*['"]/i;
    const matches = matchingImportLines(adminRouteFiles(), pattern);
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('#22 is a server JSON route — not a React/TSX UI (no react/jsx import)', () => {
    const pattern = /\bfrom\s+['"](?:react|react-dom|react\/jsx-runtime|@momentum\/[^'"]*\.tsx)['"]/i;
    const matches = matchingImportLines(adminRouteFiles(), pattern);
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('#23 keeps `.com` untouched — no apps/com import', () => {
    const pattern = /\bfrom\s+['"][^'"]*apps\/com[^'"]*['"]/i;
    const matches = matchingImportLines(adminRouteFiles(), pattern);
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('#24 does not import an OpenAI / Anthropic / Claude client', () => {
    const pattern =
      /\bfrom\s+['"][^'"]*(?:^|\/|\\|@)(?:openai|anthropic|@anthropic-ai)(?:$|\/|\\|['"])|\bfrom\s+['"][^'"]*(?:\/services\/anthropic|\/services\/openai|\/services\/claude)[^'"]*['"]/i;
    const matches = matchingImportLines(adminRouteFiles(), pattern);
    expect(matches, matches.join('\n')).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// GROUP C — wired BA ROUTE (michael-runtime.ts). The ONLY new dependency vs
// S3.4 is the observability module; the S2.20 facade, the auth+Steve gate, the
// fixtures-only / non-persistent / LLM-free invariants are unchanged.
// ---------------------------------------------------------------------------
describe('S3.6 wired runtime route static governance boundary', () => {
  it('#25 still imports the S2.20 facade resolveMichaelRuntimeTurnResponse from ../runtime/orchestration/index.js', () => {
    const matches = matchingImportLines(
      routeFiles(),
      /\bresolveMichaelRuntimeTurnResponse\b[\s\S]*?from\s+['"]\.\.\/runtime\/orchestration\/index\.js['"]/,
    );
    expect(matches.length, matches.join('\n')).toBeGreaterThan(0);
  });

  it('#26 still imports BOTH requireAuth and requireSteveComplete', () => {
    const authMatches = matchingImportLines(
      routeFiles(),
      /\brequireAuth\b[\s\S]*?from\s+['"]\.\.\/middleware\/requireAuth\.js['"]/,
    );
    const steveMatches = matchingImportLines(
      routeFiles(),
      /\brequireSteveComplete\b[\s\S]*?from\s+['"]\.\.\/middleware\/requireSteveComplete\.js['"]/,
    );
    expect(authMatches.length, authMatches.join('\n')).toBeGreaterThan(0);
    expect(steveMatches.length, steveMatches.join('\n')).toBeGreaterThan(0);
  });

  it('#27 does NOT import or reference requireMichaelComplete', () => {
    const matches = matchingCodeTokenLines(routeFiles(), /\brequireMichaelComplete\b/);
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('#28 does NOT import the S2.13 harness', () => {
    const matches = matchingCodeTokenLines(
      routeFiles(),
      /\b(?:michaelRuntimeResponseHarness|michaelRuntimeResponseScenarios|createMichaelRuntimeResponseFixtureHarness)\b/,
    );
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('#29 the only new dependency is the observability module — no new store/persistence/LLM imports', () => {
    // Positive: it imports the observability module. The import is multi-line
    // (named bindings then a separate `from` line), so scan the full source.
    const routeText = sourceWithoutComments(readSourceFile(routeFilePath).text);
    expect(
      /import\s*\{[\s\S]*?\}\s*from\s+['"]\.\.\/services\/michaelRuntimeObservability\.js['"]/.test(
        routeText,
      ),
      'observability module import present',
    ).toBe(true);
    // Negative: no store / persistence / LLM / telephony imports were added.
    const forbidden =
      /\bfrom\s+['"][^'"]*(?:mongoose|mongodb|neo4j|chromadb|chroma-client|graph-?rag|\/services\/gateway|\/tripleStack|openai|anthropic|@anthropic-ai|telnyx)[^'"]*['"]/i;
    const matches = matchingImportLines(routeFiles(), forbidden);
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('#30 did not add persistence write call shapes', () => {
    const pattern = /\.(?:insert|update|save|create)\s*\(|\btripleStackWrite\s*\(/i;
    const matches = matchingCodeTokenLines(routeFiles(), pattern);
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('#31 keeps agentResponseGenerated unaltered and never dynamically constructs response text', () => {
    const route = sourceWithoutComments(readSourceFile(routeFilePath).text);
    expect(route).not.toMatch(/agentResponseGenerated\s*:\s*true/);
    const routeStripped = sourceWithoutCommentsOrStrings(readSourceFile(routeFilePath).text);
    const textAssignments = routeStripped
      .split(/\r?\n/)
      .map((line, index) => ({ line, lineNumber: index + 1 }))
      .filter(({ line }) => /\btext\s*:/.test(line))
      .map(({ line, lineNumber }) => `${routeFilePath}:${lineNumber}: ${line.trim()}`);
    expect(textAssignments, textAssignments.join('\n')).toEqual([]);
    expect(route).not.toMatch(/\btext\s*:\s*`/);
  });
});

// ---------------------------------------------------------------------------
// GROUP D — server boot (index.ts). Mounts the new admin observability route;
// leaves the bare runtime namespace unmounted; preserves the pre-gate
// /api/michael route and the existing /api/michael-runtime BA route; flips no
// MICHAEL_RUNTIME_* env defaults.
// ---------------------------------------------------------------------------
describe('S3.6 server boot static governance boundary', () => {
  it('#32 mounts /api/admin/michael-runtime (the new admin observability route)', () => {
    const index = readSourceFile(indexFilePath).text;
    expect(/app\.use\(\s*['"`]\/api\/admin\/michael-runtime/.test(index)).toBe(true);
  });

  it('#33 does NOT mount a bare /api/runtime family', () => {
    const index = readSourceFile(indexFilePath).text;
    expect(/app\.use\(\s*['"`]\/api\/runtime\b/.test(index)).toBe(false);
  });

  it('#34 still mounts /api/michael (pre-gate) and /api/michael-runtime (existing BA route)', () => {
    const index = readSourceFile(indexFilePath).text;
    const michaelPreGate = /app\.use\(\s*['"`]\/api\/michael['"`]\s*,\s*michaelRoutes/.test(index);
    const michaelRuntime = /app\.use\(\s*['"`]\/api\/michael-runtime['"`]\s*,\s*michaelRuntimeRoutes/.test(
      index,
    );
    expect(michaelPreGate, '/api/michael pre-gate mount present').toBe(true);
    expect(michaelRuntime, '/api/michael-runtime BA route mount present').toBe(true);
  });

  it('#35 flips no flags — no MICHAEL_RUNTIME_* env default is assigned in index.ts', () => {
    const index = sourceWithoutComments(readSourceFile(indexFilePath).text);
    const matches = index
      .split(/\r?\n/)
      .map((line, lineNumber) => ({ line, lineNumber: lineNumber + 1 }))
      .filter(({ line }) => /process\.env\.MICHAEL_RUNTIME_\w+\s*=(?!=)/.test(line))
      .map(({ line, lineNumber }) => `${indexFilePath}:${lineNumber}: ${line.trim()}`);
    expect(matches, matches.join('\n')).toEqual([]);
  });
});
