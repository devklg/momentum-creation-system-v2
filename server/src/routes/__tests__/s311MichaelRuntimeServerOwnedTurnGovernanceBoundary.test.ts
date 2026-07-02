import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// ---------------------------------------------------------------------------
// Sprint 3 S3.11 — static source-scanning governance boundary test for the
// SERVER-OWNED Michael runtime turn contract as wired into the route
// (server/src/routes/michael-runtime.ts) and the `.team` support card
// (apps/team/src/components/cockpit/MichaelRuntimeSupportCard.tsx).
//
// What S3.11 changed: the route NO LONGER reads a client-supplied `body.turn`.
// The request body is server-owned — the ONLY accepted field is optional
// `language` ('en'|'es'); any other key (incl. tmagId/sponsorTmagId/targetTmagId,
// turn, runtimeTurn, contextPacket, token, sessionId, …) is rejected with 400
// `CLIENT_RUNTIME_INPUT_NOT_ALLOWED`. The route builds the turn entirely
// server-side from `req.session.tmagId` via the S3.10 turn source
// (`createMichaelRuntimeTurnForAuthenticatedBa`), then resolves it through the
// inert S2.20 facade (`resolveMichaelRuntimeTurnResponse`). The card calls the
// route LIVE on mount via the renamed helper `resolveMichaelRuntimeTrainingStep`
// (body `{}` or `{ language }`), staying read-only/inert behind the kill switch.
//
// This file mirrors the proven static-scan style of the s34/s36/s39 boundary
// tests: production source is read from disk, comments (and, for code-token
// scans, string literals) are stripped, and forbidden WIRING patterns must
// produce empty match arrays. It does NOT import or modify production code. The
// scan helpers are copied locally (never imported across test files).
// ---------------------------------------------------------------------------

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');

const routeFilePath = 'server/src/routes/michael-runtime.ts';
const cardFilePath = 'apps/team/src/components/cockpit/MichaelRuntimeSupportCard.tsx';

type SourceFile = {
  readonly relativePath: string;
  readonly text: string;
};

function readSourceFile(relativePath: string): SourceFile {
  const absolute = resolve(repoRoot, relativePath);
  // Fail loudly if a target source moved — a silent "file not found" would let
  // the whole boundary suite pass vacuously.
  if (!existsSync(absolute)) {
    throw new Error(`S3.11 server-owned turn boundary test: required source not found at ${relativePath}`);
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

function routeFiles(): SourceFile[] {
  return [readSourceFile(routeFilePath)];
}

function cardFiles(): SourceFile[] {
  return [readSourceFile(cardFilePath)];
}

// ---------------------------------------------------------------------------
// GROUP 0 — both target sources resolve off disk.
// ---------------------------------------------------------------------------
describe('S3.11 server-owned turn target sources exist', () => {
  it('#0 route and card sources are found on disk', () => {
    for (const rel of [routeFilePath, cardFilePath]) {
      expect(existsSync(resolve(repoRoot, rel)), `${rel} not found`).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// GROUP A — the ROUTE owns the turn (michael-runtime.ts).
// ---------------------------------------------------------------------------
describe('S3.11 michael-runtime route server-owned turn boundary', () => {
  it('#1 imports the server-owned turn source from ../runtime/orchestration/index.js', () => {
    const route = readSourceFile(routeFilePath).text;
    const turnSourceImport =
      /import\s*\{[\s\S]*?\bcreateMichaelRuntimeTurnForAuthenticatedBa\b[\s\S]*?\}\s*from\s+['"]\.\.\/runtime\/orchestration\/index\.js['"]/;
    expect(turnSourceImport.test(route), 'turn source imported from orchestration index').toBe(true);
  });

  it('#2 invokes createMichaelRuntimeTurnForAuthenticatedBa', () => {
    const matches = matchingCodeTokenLines(
      routeFiles(),
      /\bcreateMichaelRuntimeTurnForAuthenticatedBa\s*\(/,
    );
    expect(matches.length, matches.join('\n')).toBeGreaterThan(0);
  });

  it('#3 resolves through the inert S2.20 facade resolveMichaelRuntimeTurnResponse', () => {
    const route = readSourceFile(routeFilePath).text;
    const facadeImport =
      /import\s*\{[\s\S]*?\bresolveMichaelRuntimeTurnResponse\b[\s\S]*?\}\s*from\s+['"]\.\.\/runtime\/orchestration\/index\.js['"]/;
    expect(facadeImport.test(route), 'S2.20 facade imported').toBe(true);
    const calls = matchingCodeTokenLines(routeFiles(), /\bresolveMichaelRuntimeTurnResponse\s*\(/);
    expect(calls.length, calls.join('\n')).toBeGreaterThan(0);
  });

  it('#4 derives BA scope from req.session.tmagId (never from the body)', () => {
    const route = readSourceFile(routeFilePath).text;
    expect(route).toContain('req.session?.tmagId');
    // No body BA-authority read (comments + strings stripped).
    const stripped = sourceWithoutCommentsOrStrings(route);
    expect(
      /\b(?:req\.body|body)\.(?:tmagId|sponsorTmagId|targetTmagId|downlineTmagId|prospectId)\b/.test(stripped),
      'no body BA-authority read',
    ).toBe(false);
  });

  it('#5 does NOT read body.turn / runtimeTurn / contextPacket as client input', () => {
    const stripped = sourceWithoutCommentsOrStrings(readSourceFile(routeFilePath).text);
    const forbidden =
      /\b(?:req\.body|body)\.(?:turn|runtimeTurn|contextPacket|contextPacketId|retrieval)\b/;
    expect(forbidden.test(stripped), 'no client turn / packet / retrieval read off the body').toBe(
      false,
    );
  });

  it('#6 rejects forbidden client input via CLIENT_RUNTIME_INPUT_NOT_ALLOWED and retires the old reason codes', () => {
    const route = readSourceFile(routeFilePath).text;
    expect(route).toContain('CLIENT_RUNTIME_INPUT_NOT_ALLOWED');
    // The retired S3.4 reason codes are gone (the rule got broader, not weaker).
    expect(route).not.toContain('BODY_BA_SCOPE_NOT_ALLOWED');
    expect(route).not.toContain('MISSING_RUNTIME_TURN');
  });

  it('#7 does NOT import the S2.13 harness / fixtures', () => {
    const importMatches = matchingImportLines(
      routeFiles(),
      /\bfrom\s+['"][^'"]*(?:\/fixtures|harness)[^'"]*['"]/i,
    );
    const tokenMatches = matchingCodeTokenLines(
      routeFiles(),
      /\b(?:michaelRuntimeResponseHarness|michaelRuntimeResponseScenarios|createMichaelRuntimeResponseFixtureHarness|createRuntimeTurnFixtureHarness|runRuntimeTurnFixtureScenario)\b/,
    );
    const matches = [...importMatches, ...tokenMatches];
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('#8 imports no store / PERSISTENCE / GraphRAG / retrieval client', () => {
    const pattern =
      /\bfrom\s+['"][^'"]*(?:mongoose|mongodb|neo4j|chromadb|chroma-client|graph-?rag|\/services\/PERSISTENCE|PERSISTENCEFallback|\/tripleStack|rawRetrieval|retrievalHelper|directRetrieval|\/retrieval\b)[^'"]*['"]/i;
    const matches = matchingImportLines(routeFiles(), pattern);
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('#9 introduces no persistence write call shapes', () => {
    const pattern =
      /\.(?:insert|update|save|create)\s*\(|\b(?:tripleStackWrite|persistenceCall|directStoreCall)\s*\(/i;
    const matches = matchingCodeTokenLines(routeFiles(), pattern);
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('#10 wires no LLM / Telnyx / voice client', () => {
    const importPattern =
      /\bfrom\s+['"][^'"]*(?:openai|anthropic|@anthropic-ai|telnyx|pstn|call-control|\/services\/anthropic|\/services\/openai|\/services\/claude)[^'"]*['"]/i;
    const tokenPattern =
      /\b(?:chatCompletion|messages\.create|responses\.create|createChatCompletion|createCallControl|startCall|placeCall|dialProspect)\s*\(/i;
    const matches = [
      ...matchingImportLines(routeFiles(), importPattern),
      ...matchingCodeTokenLines(routeFiles(), tokenPattern),
    ];
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('#11 introduces no automatic send / call / schedule / prospect call shapes', () => {
    const pattern =
      /\b(?:sendEmail|sendSms|sendMessage|dispatchEmail|dispatchSms|placeCall|startCall|dialProspect|autoSchedule|automaticSchedule|autoProspect|automatedProspecting|automaticSend|automaticCall)\s*\(/i;
    const matches = matchingCodeTokenLines(routeFiles(), pattern);
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('#12 contains no income / placement / cycle / comp copy', () => {
    const forbidden = /\b(?:income|commission|compensation|placement|cycle|earnings|payout)\b/i;
    const matches = matchingCopyLines(routeFiles(), forbidden);
    expect(matches, matches.join('\n')).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// GROUP B — the `.team` card consumes the server-owned turn (read-only, inert).
// ---------------------------------------------------------------------------
describe('S3.11 .team card server-owned turn boundary', () => {
  it('#13 the renamed helper sends only {} or { language } — no forbidden fields', () => {
    const stripped = sourceWithoutCommentsOrStrings(readSourceFile(cardFilePath).text);
    // The body is exactly `opts?.language ? { language } : {}` — never a turn,
    // Context Packet, or BA-authority / id field.
    const forbidden =
      /\b(?:tmagId|sponsorTmagId|targetTmagId|downlineTmagId|prospectId|runtimeTurn|contextPacket|sessionId|turnId|correlationId)\b/;
    expect(forbidden.test(stripped), 'no forbidden body fields in card code').toBe(false);
    // The body literal references `language` only.
    expect(/\blanguage\b/.test(stripped), 'language hint present').toBe(true);
  });

  it('#14 calls the server-owned route and not a bare /api/runtime, admin, or .com surface', () => {
    const card = readSourceFile(cardFilePath).text;
    const stripped = sourceWithoutComments(card);
    expect(stripped.includes('/api/michael-runtime/resolve'), 'resolve route call present').toBe(
      true,
    );
    const codeStripped = sourceWithoutCommentsOrStrings(card);
    expect(/['"`]\/api\/runtime\b/.test(codeStripped), 'no bare /api/runtime call').toBe(false);
    expect(codeStripped.includes('/api/admin'), 'no admin endpoint').toBe(false);
    const appsCom = /\bfrom\s+['"][^'"]*(?:apps\/com|@momentum\/com)[^'"]*['"]/i;
    expect(matchingImportLines(cardFiles(), appsCom), 'no apps/com import').toEqual([]);
  });

  it('#15 auto-invokes the helper on mount (useEffect) yet stays read-only/inert', () => {
    const stripped = sourceWithoutCommentsOrStrings(readSourceFile(cardFilePath).text);
    expect(/\buseEffect\s*\(/.test(stripped), 'on-mount effect present').toBe(true);
    const callSites = matchingCodeTokenLines(
      cardFiles(),
      /\bresolveMichaelRuntimeTrainingStep\s*\(/,
    ).filter((line) => !/\bfunction\b/.test(line));
    expect(callSites.length, callSites.join('\n')).toBeGreaterThan(0);
    // Read-only: no automatic outreach / mutation handlers.
    const autoHandlers =
      /\b(?:autoSend|sendMessage|scheduleCall|callProspect|dialProspect)\s*\(/;
    expect(autoHandlers.test(stripped), 'no automatic-action handlers').toBe(false);
    // Behind the default-off kill switch it still renders the calm disabled state.
    expect(
      /kind\s*:\s*['"]disabled['"]/.test(sourceWithoutComments(readSourceFile(cardFilePath).text)),
      'disabled-state branch present',
    ).toBe(true);
  });

  it('#16 reads/renders no trace / counters / IDs / Context-Packet fields', () => {
    const forbidden =
      /\.(?:trace|selectionRequest|catalogKey|correlationId|contextPacketId|turnId|sessionId)\b|\b(?:selectionRequest|catalogKey|correlationId|contextPacketId)\b/;
    const matches = matchingCodeTokenLines(cardFiles(), forbidden);
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('#17 uses no localStorage / sessionStorage / indexedDB and emits no analytics', () => {
    const pattern = /\b(?:localStorage|sessionStorage|indexedDB|IndexedDB|gtag|analytics\.track)\b/;
    const matches = matchingCodeTokenLines(cardFiles(), pattern);
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('#18 contains no income / placement / cycle / comp copy', () => {
    const forbidden = /\b(?:income|commission|compensation|placement|cycle|earnings|payout)\b/i;
    const matches = matchingCopyLines(cardFiles(), forbidden);
    expect(matches, matches.join('\n')).toEqual([]);
  });
});
