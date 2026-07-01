import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// ---------------------------------------------------------------------------
// Sprint 3 S3.9 — static source-scanning governance boundary test for the
// Michael runtime SUPPORT CARD UI (.team) and its server-side invariants.
//
// apps/team has NO test runner, so enforcement of the UI boundary lives here in
// the SERVER vitest suite by scanning the apps/team SOURCE TEXT off disk. This
// file mirrors the proven static-scan style of
// server/src/routes/__tests__/s36MichaelRuntimeObservabilityGovernanceBoundary.test.ts:
// production source is read from disk, comments (and, for code-token scans,
// string literals) are stripped, and forbidden WIRING patterns must produce
// empty match arrays.
//
// Why stripping matters here: the card's documentation comments LEGITIMATELY
// mention banned words to explain why they are absent — e.g. "never includes
// tmagId / sponsorTmagId / targetTmagId / downlineTmagId / prospectId", "never writes
// localStorage / sessionStorage / IndexedDB", "no income / placement / cycle
// language", "the redacted trace is NEVER shown". Those defensive doc-comment
// prohibitions (and string literals) must not trip a wiring regex, so the
// code-token scans strip comments AND strings before matching. Copy/copy-tone
// scans (income/placement/etc.) strip ONLY comments — string literals are the
// user-facing copy we WANT to inspect.
//
// This file does NOT import or modify production code — it reads source text
// only. The scan helpers are copied locally (never imported across test files),
// matching the s34/s36 private-helper convention.
// ---------------------------------------------------------------------------

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');

const cardFilePath = 'apps/team/src/components/cockpit/MichaelRuntimeSupportCard.tsx';
const cockpitFilePath = 'apps/team/src/routes/cockpit.tsx';
const routeFilePath = 'server/src/routes/michael-runtime.ts';
const indexFilePath = 'server/src/index.ts';

type SourceFile = {
  readonly relativePath: string;
  readonly text: string;
};

function readSourceFile(relativePath: string): SourceFile {
  const absolute = resolve(repoRoot, relativePath);
  // Fail loudly if a target source moved — a silent "file not found" would let
  // the whole boundary suite pass vacuously.
  if (!existsSync(absolute)) {
    throw new Error(`S3.9 boundary test: required source not found at ${relativePath}`);
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

function cardFiles(): SourceFile[] {
  return [readSourceFile(cardFilePath)];
}

function cockpitFiles(): SourceFile[] {
  return [readSourceFile(cockpitFilePath)];
}

function routeFiles(): SourceFile[] {
  return [readSourceFile(routeFilePath)];
}

// ---------------------------------------------------------------------------
// GROUP 0 — all four target sources resolve off disk.
// ---------------------------------------------------------------------------
describe('S3.9 target sources exist', () => {
  it('#0 all four target sources are found on disk', () => {
    for (const rel of [cardFilePath, cockpitFilePath, routeFilePath, indexFilePath]) {
      expect(existsSync(resolve(repoRoot, rel)), `${rel} not found`).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// GROUP A — the SUPPORT CARD (MichaelRuntimeSupportCard.tsx): card + helper.
// Read-only, .team-only, BA-session-scoped, fixtures-only, leak-free.
// ---------------------------------------------------------------------------
describe('S3.9 Michael runtime support card static governance boundary', () => {
  it('#1 calls POST /api/michael-runtime/resolve', () => {
    const stripped = sourceWithoutComments(readSourceFile(cardFilePath).text);
    expect(stripped.includes('/api/michael-runtime/resolve'), 'resolve route call present').toBe(
      true,
    );
  });

  it('#2 request never sends body-authority id fields (tmagId/sponsorTmagId/targetTmagId/downlineTmagId/prospectId)', () => {
    // Comments/strings stripped first: the header doc-comment legitimately lists
    // these identifiers to explain they are NOT sent. Only an actual code token
    // (e.g. a request-body field) can trip this scan. The word `turn` is allowed
    // and is intentionally NOT in this list.
    const forbidden = /\b(?:tmagId|sponsorTmagId|targetTmagId|downlineTmagId|prospectId)\b/;
    const matches = matchingCodeTokenLines(cardFiles(), forbidden);
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('#3 sends credentials: \'include\'', () => {
    const stripped = sourceWithoutComments(readSourceFile(cardFilePath).text);
    expect(/credentials\s*:\s*['"]include['"]/.test(stripped), 'credentials include present').toBe(
      true,
    );
  });

  it('#4 does NOT import from @momentum/shared (TS6059 convention)', () => {
    const pattern = /\bfrom\s+['"]@momentum\/shared(?:\/[^'"]*)?['"]/;
    const matches = matchingImportLines(cardFiles(), pattern);
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('#5 does NOT call a bare /api/runtime endpoint', () => {
    // Precise: /api/michael-runtime/resolve must NOT satisfy this — a word
    // boundary after `runtime` distinguishes the bare namespace.
    const matches = matchingCodeTokenLines(cardFiles(), /['"`]\/api\/runtime\b/);
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('#6 does NOT call the sponsor-only /api/michael/training-support route', () => {
    const stripped = sourceWithoutComments(readSourceFile(cardFilePath).text);
    expect(stripped.includes('/api/michael/training-support')).toBe(false);
  });

  it('#7 does NOT call the admin observability endpoint (no /api/admin, no admin+observability)', () => {
    const stripped = sourceWithoutCommentsOrStrings(readSourceFile(cardFilePath).text);
    expect(stripped.includes('/api/admin'), 'no /api/admin substring').toBe(false);
    const adminObs = /\badmin\b[\s\S]*\bobservability\b/i.test(stripped);
    expect(adminObs, 'no admin + observability pairing').toBe(false);
  });

  it('#8 does NOT use localStorage / sessionStorage / indexedDB', () => {
    const pattern = /\b(?:localStorage|sessionStorage|indexedDB|IndexedDB)\b/;
    const matches = matchingCodeTokenLines(cardFiles(), pattern);
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('#9 does NOT import or reference an LLM / telephony / voice client (openai/anthropic/claude/Telnyx)', () => {
    const importPattern =
      /\bfrom\s+['"][^'"]*(?:openai|anthropic|@anthropic-ai|telnyx)[^'"]*['"]/i;
    const tokenPattern =
      /\b(?:openai|anthropic|claude|telnyx|pstn|callControlId|createCallControl|startCall|placeCall)\b/i;
    const matches = [
      ...matchingImportLines(cardFiles(), importPattern),
      ...matchingCodeTokenLines(cardFiles(), tokenPattern),
    ];
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('#10 does NOT read/render leak-prone fields (.trace/selectionRequest/catalogKey/correlationId/contextPacketId)', () => {
    // Approach: the only legitimate mentions of these identifiers in the card
    // are in doc-comments explaining that the redacted trace and the server's
    // ID/wrapper fields are deliberately ignored. After stripping comments AND
    // strings, no code token may reference them — i.e. nothing is read off the
    // response or rendered into JSX. We scan for both a property access (`.foo`)
    // and a bare identifier to catch any destructuring/render path.
    const forbidden =
      /\.(?:trace|selectionRequest|catalogKey|correlationId|contextPacketId)\b|\b(?:selectionRequest|catalogKey|correlationId|contextPacketId)\b/;
    const matches = matchingCodeTokenLines(cardFiles(), forbidden);
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('#11 contains no income/compensation/placement/cycle copy (user-facing strings + code)', () => {
    // Copy-tone scan: strip comments only (the header comment legitimately says
    // "no income / placement / cycle language"), but KEEP string literals so any
    // banned vocabulary that leaked into user-facing copy is caught.
    const forbidden = /\b(?:income|commission|compensation|placement|cycle|earnings|payout)\b/i;
    const matches = matchingCopyLines(cardFiles(), forbidden);
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('#12 wires no automatic-action handlers (sendMessage/autoSend/scheduleCall/callProspect)', () => {
    const pattern =
      /\b(?:sendMessage|autoSend|autoSubmit|scheduleCall|callProspect|dialProspect|autoResolve|autoInvoke)\s*\(/;
    const matches = matchingCodeTokenLines(cardFiles(), pattern);
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('#13 turn-source blocker RESOLVED — card auto-invokes the server-owned resolve on mount yet stays read-only/inert behind the kill switch', () => {
    const raw = readSourceFile(cardFilePath).text;
    // S3.11: the S3.9 client-safe turn-source blocker is RESOLVED — the server
    // now owns the runtime turn. The doc-comment records that resolution.
    expect(/turn[-\s]?source/i.test(raw), 'turn-source phrasing present').toBe(true);
    expect(/\bresolved\b/i.test(raw), 'resolution recorded').toBe(true);
    const strippedCode = sourceWithoutCommentsOrStrings(raw);
    // It auto-invokes the renamed server-owned helper on mount via useEffect …
    expect(/\buseEffect\s*\(/.test(strippedCode), 'on-mount effect present').toBe(true);
    const callSites = matchingCodeTokenLines(
      cardFiles(),
      /\bresolveMichaelRuntimeTrainingStep\s*\(/,
    ).filter((line) => !/\bfunction\b/.test(line));
    expect(callSites.length, callSites.join('\n')).toBeGreaterThan(0);
    // … the retired helper name is gone (renamed resolveMichaelRuntimeTurn →
    // resolveMichaelRuntimeTrainingStep) …
    expect(/\bresolveMichaelRuntimeTurn\b/.test(strippedCode), 'old helper name retired').toBe(
      false,
    );
    // … and it stays read-only/inert: behind the default-off kill switch the live
    // route answers 503 and the card still renders the calm disabled state.
    expect(
      /kind\s*:\s*['"]disabled['"]/.test(sourceWithoutComments(raw)),
      "disabled-state branch present",
    ).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// GROUP B — cockpit placement (cockpit.tsx). The card is imported and rendered,
// and the existing AgentSupportPanel was not removed.
// ---------------------------------------------------------------------------
describe('S3.9 cockpit placement static governance boundary', () => {
  it('#14 imports MichaelRuntimeSupportCard', () => {
    const matches = matchingImportLines(cockpitFiles(), /\bMichaelRuntimeSupportCard\b/);
    expect(matches.length, matches.join('\n')).toBeGreaterThan(0);
  });

  it('#15 renders <MichaelRuntimeSupportCard', () => {
    const stripped = sourceWithoutComments(readSourceFile(cockpitFilePath).text);
    expect(/<MichaelRuntimeSupportCard\b/.test(stripped), 'card JSX rendered').toBe(true);
  });

  it('#16 still renders AgentSupportPanel (not removed)', () => {
    const stripped = sourceWithoutComments(readSourceFile(cockpitFilePath).text);
    expect(/<AgentSupportPanel\b/.test(stripped), 'AgentSupportPanel still present').toBe(true);
  });
});

// ---------------------------------------------------------------------------
// GROUP C — server invariants (regression). The UI slice must not have touched
// the server boundary established in S2.20 / S3.4 / S3.6.
// ---------------------------------------------------------------------------
describe('S3.9 server invariants static regression boundary', () => {
  it('#17 index.ts does NOT mount a bare /api/runtime family', () => {
    const index = readSourceFile(indexFilePath).text;
    expect(/app\.use\(\s*['"`]\/api\/runtime\b/.test(index)).toBe(false);
  });

  it('#18 index.ts still mounts /api/michael-runtime AND /api/michael', () => {
    const index = readSourceFile(indexFilePath).text;
    const runtime = /app\.use\(\s*['"`]\/api\/michael-runtime['"`]\s*,\s*michaelRuntimeRoutes/.test(
      index,
    );
    const michael = /app\.use\(\s*['"`]\/api\/michael['"`]\s*,\s*michaelRoutes/.test(index);
    expect(runtime, '/api/michael-runtime mount present').toBe(true);
    expect(michael, '/api/michael pre-gate mount present').toBe(true);
  });

  it('#19 michael-runtime.ts keeps the S2.20 facade + auth gates and excludes the harness/requireMichaelComplete', () => {
    const route = readSourceFile(routeFilePath).text;
    // S3.11: the facade now shares a multiline import with the server-owned turn
    // source — match across the whole (possibly multiline) import statement.
    const facadeImport =
      /import\s*\{[\s\S]*?\bresolveMichaelRuntimeTurnResponse\b[\s\S]*?\}\s*from\s+['"]\.\.\/runtime\/orchestration\/index\.js['"]/;
    const auth = matchingImportLines(
      routeFiles(),
      /\brequireAuth\b[\s\S]*?from\s+['"]\.\.\/middleware\/requireAuth\.js['"]/,
    );
    const steve = matchingImportLines(
      routeFiles(),
      /\brequireSteveComplete\b[\s\S]*?from\s+['"]\.\.\/middleware\/requireSteveComplete\.js['"]/,
    );
    expect(facadeImport.test(route), 'S2.20 facade import present').toBe(true);
    expect(auth.length, 'requireAuth import present').toBeGreaterThan(0);
    expect(steve.length, 'requireSteveComplete import present').toBeGreaterThan(0);

    const forbidden = matchingCodeTokenLines(
      routeFiles(),
      /\brequireMichaelComplete\b|\b(?:michaelRuntimeResponseHarness|michaelRuntimeResponseScenarios|createMichaelRuntimeResponseFixtureHarness)\b/,
    );
    expect(forbidden, forbidden.join('\n')).toEqual([]);
  });

  it('#20 neither the card nor cockpit imports an apps/com (.com) surface', () => {
    const pattern = /\bfrom\s+['"][^'"]*(?:apps\/com|@momentum\/com)[^'"]*['"]/i;
    const matches = [
      ...matchingImportLines(cardFiles(), pattern),
      ...matchingImportLines(cockpitFiles(), pattern),
    ];
    expect(matches, matches.join('\n')).toEqual([]);
  });
});
