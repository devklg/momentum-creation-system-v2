import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// ---------------------------------------------------------------------------
// Sprint 3 S3.10 — static REGRESSION/BOUNDARY test guarding that the new
// server-owned Michael runtime TURN SOURCE
// (server/src/runtime/orchestration/michaelRuntimeTurnSource.ts) was added
// WITHOUT wiring it into the route, the server boot, or the `.team` UI.
//
// It mirrors the proven static-scan style of
//   server/src/routes/__tests__/s36MichaelRuntimeObservabilityGovernanceBoundary.test.ts
// and
//   server/src/routes/__tests__/s39MichaelRuntimeUiServerBoundary.test.ts:
// production source is read off disk, comments (and, for code-token scans,
// string literals) are stripped, and forbidden WIRING patterns must produce
// empty match arrays. apps/team has no test runner, so the UI boundary is
// enforced here by scanning the apps/team source text off disk.
//
// This file does NOT import or modify production code — it reads source text
// only. The scan helpers are copied locally (never imported across test files).
//
// repoRoot is 4 levels up from this file:
//   __tests__ -> routes -> src -> server -> <repo root>
// ---------------------------------------------------------------------------

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');

const routeFilePath = 'server/src/routes/michael-runtime.ts';
const indexFilePath = 'server/src/index.ts';
const turnSourceFilePath = 'server/src/runtime/orchestration/michaelRuntimeTurnSource.ts';
const cardFilePath = 'apps/team/src/components/cockpit/MichaelRuntimeSupportCard.tsx';
const routesDirPath = 'server/src/routes';

type SourceFile = {
  readonly relativePath: string;
  readonly text: string;
};

function readSourceFile(relativePath: string): SourceFile {
  const absolute = resolve(repoRoot, relativePath);
  // Fail loudly if a target source moved — a silent "file not found" would let
  // the whole boundary suite pass vacuously.
  if (!existsSync(absolute)) {
    throw new Error(`S3.10 route boundary test: required source not found at ${relativePath}`);
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

function cardFiles(): SourceFile[] {
  return [readSourceFile(cardFilePath)];
}

// ---------------------------------------------------------------------------
// GROUP 0 — all target sources resolve off disk.
// ---------------------------------------------------------------------------
describe('S3.10 target sources exist', () => {
  it('#0 route, index, turn source, and card sources are all found on disk', () => {
    for (const rel of [routeFilePath, indexFilePath, turnSourceFilePath, cardFilePath]) {
      expect(existsSync(resolve(repoRoot, rel)), `${rel} not found`).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// GROUP A — server boot (index.ts). No bare /api/runtime; the /api/michael
// pre-gate route and the existing /api/michael-runtime BA route are untouched;
// no MICHAEL_RUNTIME_* env default is assigned.
// ---------------------------------------------------------------------------
describe('S3.10 server boot static regression boundary', () => {
  it('#1 index.ts does NOT mount a bare /api/runtime family', () => {
    const index = readSourceFile(indexFilePath).text;
    expect(/app\.use\(\s*['"`]\/api\/runtime\b/.test(index)).toBe(false);
  });

  it('#2 index.ts still mounts /api/michael-runtime (existing BA route)', () => {
    const index = readSourceFile(indexFilePath).text;
    const runtime = /app\.use\(\s*['"`]\/api\/michael-runtime['"`]\s*,\s*michaelRuntimeRoutes/.test(
      index,
    );
    expect(runtime, '/api/michael-runtime mount present').toBe(true);
  });

  it('#3 index.ts still mounts /api/michael (pre-gate route)', () => {
    const index = readSourceFile(indexFilePath).text;
    const michael = /app\.use\(\s*['"`]\/api\/michael['"`]\s*,\s*michaelRoutes/.test(index);
    expect(michael, '/api/michael pre-gate mount present').toBe(true);
  });

  it('#4 index.ts does NOT import or mount the turn source (not wired into boot in S3.10)', () => {
    const index = readSourceFile(indexFilePath).text;
    const stripped = sourceWithoutCommentsOrStrings(index);
    expect(
      /createMichaelRuntimeTurnForAuthenticatedBa/.test(stripped),
      'turn source factory not referenced in index.ts',
    ).toBe(false);
    expect(
      /michaelRuntimeTurnSource/.test(stripped),
      'turn source module not referenced in index.ts',
    ).toBe(false);
  });

  it('#5 index.ts assigns no MICHAEL_RUNTIME_* env default', () => {
    const index = sourceWithoutComments(readSourceFile(indexFilePath).text);
    const matches = index
      .split(/\r?\n/)
      .map((line, lineNumber) => ({ line, lineNumber: lineNumber + 1 }))
      .filter(({ line }) => /process\.env\.MICHAEL_RUNTIME_\w+\s*=(?!=)/.test(line))
      .map(({ line, lineNumber }) => `${indexFilePath}:${lineNumber}: ${line.trim()}`);
    expect(matches, matches.join('\n')).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// GROUP B — BA route (michael-runtime.ts). Unchanged in spirit: still the S2.20
// facade consumer behind requireAuth + requireSteveComplete; no harness, no
// requireMichaelComplete, and the turn source is NOT yet imported or used.
// ---------------------------------------------------------------------------
describe('S3.10 michael-runtime route static regression boundary', () => {
  it('#6 still imports the S2.20 facade resolveMichaelRuntimeTurnResponse from ../runtime/orchestration/index.js', () => {
    const matches = matchingImportLines(
      routeFiles(),
      /\bresolveMichaelRuntimeTurnResponse\b[\s\S]*?from\s+['"]\.\.\/runtime\/orchestration\/index\.js['"]/,
    );
    expect(matches.length, matches.join('\n')).toBeGreaterThan(0);
  });

  it('#7 still imports BOTH requireAuth and requireSteveComplete', () => {
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

  it('#8 applies requireAuth + requireSteveComplete on the /resolve registration', () => {
    const route = sourceWithoutComments(readSourceFile(routeFilePath).text);
    const pattern =
      /\.post\(\s*['"`]\/resolve['"`]\s*,\s*requireAuth\s*,\s*requireSteveComplete\s*,/;
    expect(pattern.test(route), 'post(/resolve, requireAuth, requireSteveComplete, ...) present').toBe(
      true,
    );
  });

  it('#9 does NOT import or reference requireMichaelComplete', () => {
    const matches = matchingCodeTokenLines(routeFiles(), /\brequireMichaelComplete\b/);
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('#10 does NOT import the S2.13 harness', () => {
    const matches = matchingCodeTokenLines(
      routeFiles(),
      /\b(?:michaelRuntimeResponseHarness|michaelRuntimeResponseScenarios|createMichaelRuntimeResponseFixtureHarness|createRuntimeTurnFixtureHarness)\b/,
    );
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('#11 does NOT import or invoke createMichaelRuntimeTurnForAuthenticatedBa (turn source NOT wired in S3.10)', () => {
    const matches = matchingCodeTokenLines(
      routeFiles(),
      /\bcreateMichaelRuntimeTurnForAuthenticatedBa\b|\bmichaelRuntimeTurnSource\b/,
    );
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('#12 did not add store / persistence / LLM imports', () => {
    const forbidden =
      /\bfrom\s+['"][^'"]*(?:mongoose|mongodb|neo4j|chromadb|chroma-client|graph-?rag|\/services\/gateway|\/tripleStack|openai|anthropic|@anthropic-ai|telnyx)[^'"]*['"]/i;
    const matches = matchingImportLines(routeFiles(), forbidden);
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('#13 did not add persistence write call shapes', () => {
    const pattern = /\.(?:insert|update|save|create)\s*\(|\btripleStackWrite\s*\(/i;
    const matches = matchingCodeTokenLines(routeFiles(), pattern);
    expect(matches, matches.join('\n')).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// GROUP C — `.team` card (MichaelRuntimeSupportCard.tsx). Still defaults to the
// disabled state and still does NOT auto-invoke the live resolve. No apps/com
// import.
// ---------------------------------------------------------------------------
describe('S3.10 .team card static regression boundary', () => {
  it("#14 still defaults to the disabled state (kind: 'disabled')", () => {
    const stripped = sourceWithoutComments(readSourceFile(cardFilePath).text);
    expect(/kind\s*:\s*['"]disabled['"]/.test(stripped), "default kind: 'disabled' present").toBe(
      true,
    );
  });

  it('#15 does NOT auto-invoke resolveMichaelRuntimeTurn (live call still not wired)', () => {
    // After stripping comments AND strings, the only line referencing
    // `resolveMichaelRuntimeTurn(` must be the function DECLARATION itself —
    // never a call site (which would be the live invocation).
    const callSites = matchingCodeTokenLines(cardFiles(), /\bresolveMichaelRuntimeTurn\s*\(/).filter(
      (line) => !/\bfunction\b/.test(line),
    );
    expect(callSites, callSites.join('\n')).toEqual([]);
  });

  it('#16 has no fetch-on-mount hook (no useEffect / no auto-resolve wiring)', () => {
    const stripped = sourceWithoutCommentsOrStrings(readSourceFile(cardFilePath).text);
    expect(/\buseEffect\s*\(/.test(stripped), 'no useEffect on mount').toBe(false);
    const autoHandlers =
      /\b(?:autoResolve|autoInvoke|autoSend|sendMessage|scheduleCall|callProspect|dialProspect)\s*\(/;
    expect(autoHandlers.test(stripped), 'no automatic-action handlers').toBe(false);
  });

  it('#17 imports no apps/com (.com) surface', () => {
    const pattern = /\bfrom\s+['"][^'"]*(?:apps\/com|@momentum\/com)[^'"]*['"]/i;
    const matches = matchingImportLines(cardFiles(), pattern);
    expect(matches, matches.join('\n')).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// GROUP D — placement. The turn source lives in runtime/orchestration, NOT as a
// public route. No new route file under server/src/routes carries it.
// ---------------------------------------------------------------------------
describe('S3.10 turn source placement boundary', () => {
  it('#18 the turn source module lives under runtime/orchestration', () => {
    expect(existsSync(resolve(repoRoot, turnSourceFilePath)), `${turnSourceFilePath} present`).toBe(
      true,
    );
  });

  it('#19 no new public route file for the turn source was added under server/src/routes', () => {
    const routesDir = resolve(repoRoot, routesDirPath);
    // Public route MODULES only — exclude test files and anything under a
    // __tests__ directory (a sibling agent's behavioral test for the route may
    // legitimately carry a `turn-source` name; it is not a public route).
    const offenders = readdirSync(routesDir, { recursive: true, withFileTypes: true })
      .filter((entry) => entry.isFile())
      .filter((entry) => !/\.(?:test|spec)\.tsx?$/.test(entry.name))
      .filter((entry) => !/(?:^|[\\/])__tests__([\\/]|$)/.test(String(entry.parentPath ?? '')))
      .map((entry) => entry.name)
      .filter((name) => /turn[-_]?source/i.test(name));
    expect(offenders, offenders.join('\n')).toEqual([]);
  });
});
