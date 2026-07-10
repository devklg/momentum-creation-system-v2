import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// ---------------------------------------------------------------------------
// Sprint 3 S3.13 — static source-scanning governance boundary test that
// STRENGTHENS UI-leak prevention for the controlled Michael-runtime canary:
// the `.team` support card (apps/team/src/components/cockpit/
// MichaelRuntimeSupportCard.tsx) and its server-owned route
// (server/src/routes/michael-runtime.ts).
//
// apps/team has NO test runner, so enforcement of the UI boundary lives here in
// the SERVER vitest suite by scanning the apps/team SOURCE TEXT off disk. This
// file mirrors the proven static-scan style of
// server/src/routes/__tests__/s39MichaelRuntimeUiServerBoundary.test.ts and
// server/src/routes/__tests__/s311MichaelRuntimeServerOwnedTurnGovernanceBoundary.test.ts:
// production source is read from disk, comments (and, for code-token scans,
// string literals) are stripped, forbidden WIRING patterns must produce empty
// match arrays, and required wiring is positively asserted.
//
// Why stripping matters here: both source files carry documentation comments
// that LEGITIMATELY enumerate the banned identifiers/words to explain why they
// are absent (e.g. "never sends turn / runtimeTurn / contextPacket / tmagId …",
// "no LLM is called, no voice path exists", "the redacted trace is NEVER
// shown"). Those defensive doc-comment prohibitions — and string literals —
// must not trip a wiring regex, so the code-token scans strip comments AND
// strings before matching. The CLIENT_RUNTIME_INPUT_NOT_ALLOWED presence check
// and the allowlist literal check scan the RAW text (strings kept), because the
// thing being asserted IS a string literal. Copy-tone scans strip ONLY comments
// so user-facing string copy stays inspectable.
//
// This file does NOT import or modify production code — it reads source text
// only. The scan helpers are copied locally (never imported across test files),
// matching the s39/s311 private-helper convention. It does NOT modify or weaken
// any existing test.
// ---------------------------------------------------------------------------

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');

const cardFilePath = 'apps/team/src/components/cockpit/MichaelRuntimeSupportCard.tsx';
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
    throw new Error(
      `S3.13 controlled UI canary boundary test: required source not found at ${relativePath}`,
    );
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

function routeFiles(): SourceFile[] {
  return [readSourceFile(routeFilePath)];
}

function cardCode(): string {
  return sourceWithoutCommentsOrStrings(readSourceFile(cardFilePath).text);
}

// ---------------------------------------------------------------------------
// GROUP 0 — both controlled-canary sources resolve off disk.
// ---------------------------------------------------------------------------
describe('S3.13 controlled UI canary target sources exist', () => {
  it('#0 card and route sources are found on disk', () => {
    for (const rel of [cardFilePath, routeFilePath, indexFilePath]) {
      expect(existsSync(resolve(repoRoot, rel)), `${rel} not found`).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// GROUP A — the SUPPORT CARD (MichaelRuntimeSupportCard.tsx): card + helper.
// Read-only, server-owned-turn, leak-free, calm in every state.
// ---------------------------------------------------------------------------
describe('S3.13 Michael runtime support card UI-leak boundary', () => {
  it('#1 calls POST /api/michael-runtime/resolve', () => {
    const stripped = sourceWithoutComments(readSourceFile(cardFilePath).text);
    expect(stripped.includes('/api/michael-runtime/resolve'), 'resolve route call present').toBe(
      true,
    );
  });

  it('#2 helper body carries only language and ask', () => {
    // The body literal is composed from optional `language` and optional `ask`;
    // no authority-bearing field can be added here.
    const code = cardCode();
    expect(
      /\.\.\.\(\s*opts\?\.language\s*\?\s*\{\s*language\s*:\s*opts\.language\s*\}\s*:\s*\{\s*\}\s*\)/.test(code),
      'language spread present',
    ).toBe(true);
    expect(/\.\.\.\(\s*ask\s*\?\s*\{\s*ask\s*\}\s*:\s*\{\s*\}\s*\)/.test(code), 'ask spread present').toBe(true);
    expect(/\blanguage\b/.test(code), 'language hint referenced').toBe(true);
    expect(/\bask\b/.test(code), 'ask cue referenced').toBe(true);
  });

  // #3–#14 — the helper NEVER sends turn / Context-Packet / BA-authority / id
  // fields. After stripping comments AND strings, no actual code token may name
  // any of these (the doc-comments that list them are stripped first).
  const forbiddenSentFields: ReadonlyArray<{ readonly n: number; readonly field: string }> = [
    { n: 3, field: 'turn' },
    { n: 4, field: 'runtimeTurn' },
    { n: 5, field: 'contextPacket' },
    { n: 6, field: 'tmagId' },
    { n: 7, field: 'sponsorTmagId' },
    { n: 8, field: 'targetTmagId' },
    { n: 9, field: 'downlineTmagId' },
    { n: 10, field: 'prospectId' },
    { n: 11, field: 'prospectToken' },
    { n: 12, field: 'sessionId' },
    { n: 13, field: 'turnId' },
    { n: 14, field: 'correlationId' },
  ];
  for (const { n, field } of forbiddenSentFields) {
    it(`#${n} helper code never references the sent field \`${field}\``, () => {
      // Word-boundary, case-sensitive: `\bturn\b` does NOT match `return`, and
      // `\bcontextPacket\b` does NOT match `contextPacketId`.
      const matches = matchingCodeTokenLines(cardFiles(), new RegExp(`\\b${field}\\b`));
      expect(matches, matches.join('\n')).toEqual([]);
    });
  }

  it('#15 does not read/render the redacted trace', () => {
    const matches = matchingCodeTokenLines(cardFiles(), /\.trace\b|\btrace\b/);
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('#16 does not read/render selectionRequest', () => {
    const matches = matchingCodeTokenLines(cardFiles(), /\.selectionRequest\b|\bselectionRequest\b/);
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('#17 does not render raw Context Packet fields', () => {
    const pattern =
      /\b(?:contextPacket|context_packet|contextPacketId|contextPacketStatus)\b/;
    const matches = matchingCodeTokenLines(cardFiles(), pattern);
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('#18 renders no safety internals', () => {
    const matches = matchingCodeTokenLines(cardFiles(), /\bsafety\b/i);
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('#19 renders no persistence internals', () => {
    const matches = matchingCodeTokenLines(cardFiles(), /\bpersistence\b|\bpersisted\b/i);
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('#20 does not render agentResponseGenerated', () => {
    const matches = matchingCodeTokenLines(cardFiles(), /\bagentResponseGenerated\b/);
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('#21 does not render nextStep boolean flags', () => {
    const pattern =
      /\b(?:baOwned|automaticSending|automaticCalling|externalSideEffect)\b/;
    const matches = matchingCodeTokenLines(cardFiles(), pattern);
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('#22 uses no localStorage / sessionStorage / indexedDB', () => {
    const matches = matchingCodeTokenLines(
      cardFiles(),
      /\b(?:localStorage|sessionStorage|indexedDB|IndexedDB)\b/,
    );
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('#23 imports no apps/com / @momentum/com surface', () => {
    const pattern = /\bfrom\s+['"][^'"]*(?:apps\/com|@momentum\/com)[^'"]*['"]/i;
    const matches = matchingImportLines(cardFiles(), pattern);
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('#24 imports/references no voice / Telnyx / call-control client', () => {
    const importPattern = /\bfrom\s+['"][^'"]*(?:telnyx|call-control|pstn|\/voice)[^'"]*['"]/i;
    const tokenPattern =
      /\b(?:telnyx|pstn|callControl|callControlId|createCallControl|placeCall|startCall|dialProspect)\b/;
    const matches = [
      ...matchingImportLines(cardFiles(), importPattern),
      ...matchingCodeTokenLines(cardFiles(), tokenPattern),
    ];
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('#25 imports/references no LLM client (openai / anthropic / claude)', () => {
    const importPattern =
      /\bfrom\s+['"][^'"]*(?:openai|anthropic|@anthropic-ai|claude)[^'"]*['"]/i;
    const tokenPattern = /\b(?:openai|anthropic|claude)\b/i;
    const matches = [
      ...matchingImportLines(cardFiles(), importPattern),
      ...matchingCodeTokenLines(cardFiles(), tokenPattern),
    ];
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('#26 wires no send / call / schedule / prospect / dial action identifiers', () => {
    const actionCalls =
      /\b(?:sendMessage|sendEmail|sendSms|autoSend|scheduleCall|autoSchedule|callProspect|dialProspect|prospectCall|placeCall|startCall|dial)\s*\(/i;
    const bareTokens = /\b(?:prospect|prospecting|dialer)\b/i;
    const matches = [
      ...matchingCodeTokenLines(cardFiles(), actionCalls),
      ...matchingCodeTokenLines(cardFiles(), bareTokens),
    ];
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('#27 has no retry LOOP (single manual try-again button only — no unbounded re-fetch)', () => {
    const code = cardCode();
    // A while/for re-fetch loop or a timer-driven poll would be an unbounded
    // retry. The manual "try again" affordance is an onClick that bumps state —
    // not a loop — so these must all be absent.
    expect(/\bwhile\s*\(/.test(code), 'no while loop').toBe(false);
    expect(/\bfor\s*\(/.test(code), 'no for loop').toBe(false);
    expect(/\bsetInterval\s*\(/.test(code), 'no polling interval').toBe(false);
    expect(/\bsetTimeout\s*\(/.test(code), 'no timer re-fetch').toBe(false);
  });

  it('#28 useEffect has cancellation protection (cancelled / ignore flag or AbortController)', () => {
    const code = cardCode();
    expect(/\buseEffect\s*\(/.test(code), 'on-mount effect present').toBe(true);
    const guarded =
      /\bcancelled\b/.test(code) || /\bignore\b/.test(code) || /\bAbortController\b/.test(code);
    expect(guarded, 'cancellation guard present in effect').toBe(true);
  });

  it('#29 error state is generic — no server internals interpolated', () => {
    const raw = readSourceFile(cardFilePath).text;
    expect(sourceWithoutComments(raw).includes("kind: 'error'"), 'error branch present').toBe(true);
    const code = cardCode();
    // No leak-prone server-internal field is read/interpolated into the render.
    expect(/\.(?:statusText|stack|issues)\b/.test(code), 'no statusText/stack/issues read').toBe(
      false,
    );
    // No raw error/response object is stringified into the UI.
    expect(
      /JSON\.stringify\s*\(\s*(?:err|error|res|reason|payload|response)\b/.test(code),
      'no error/response stringified into UI',
    ).toBe(false);
  });

  it('#30 disabled state is calm / non-leaky', () => {
    const raw = readSourceFile(cardFilePath).text;
    expect(
      /kind\s*:\s*['"]disabled['"]/.test(sourceWithoutComments(raw)),
      'disabled-state branch present',
    ).toBe(true);
    // No income / placement / cycle / comp vocabulary anywhere in the card copy.
    const forbidden = /\b(?:income|commission|compensation|placement|cycle|earnings|payout)\b/i;
    const matches = matchingCopyLines(cardFiles(), forbidden);
    expect(matches, matches.join('\n')).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// GROUP B — the ROUTE (michael-runtime.ts) holds the server-owned contract.
// ---------------------------------------------------------------------------
describe('S3.13 michael-runtime route UI-leak regression boundary', () => {
  it('#31 allowlists ONLY `language` and `ask` for the request body', () => {
    // Scan WITH strings: the allowlist literal IS a string.
    const route = readSourceFile(routeFilePath).text;
    expect(
      /ALLOWED_BODY_FIELDS\s*=\s*new Set\(\s*\[\s*['"]language['"]\s*,\s*['"]ask['"]\s*\]\s*\)/.test(route),
      'language/ask allowlist Set present',
    ).toBe(true);
  });

  it('#32 rejects unknown keys via CLIENT_RUNTIME_INPUT_NOT_ALLOWED', () => {
    // Scan WITH strings: the reason code IS a string literal.
    const route = readSourceFile(routeFilePath).text;
    expect(route.includes('CLIENT_RUNTIME_INPUT_NOT_ALLOWED'), 'reason code present').toBe(true);
  });

  it('#33 builds the turn via createMichaelRuntimeTurnForAuthenticatedBa', () => {
    const importMatch =
      /import\s*\{[\s\S]*?\bcreateMichaelRuntimeTurnForAuthenticatedBa\b[\s\S]*?\}\s*from\s+['"]\.\.\/runtime\/orchestration\/index\.js['"]/;
    expect(importMatch.test(readSourceFile(routeFilePath).text), 'turn source imported').toBe(true);
    const calls = matchingCodeTokenLines(
      routeFiles(),
      /\bcreateMichaelRuntimeTurnForAuthenticatedBa\s*\(/,
    );
    expect(calls.length, calls.join('\n')).toBeGreaterThan(0);
  });

  it('#34 resolves via the inert S2.20 facade resolveMichaelRuntimeTurnResponse', () => {
    const facadeImport =
      /import\s*\{[\s\S]*?\bresolveMichaelRuntimeTurnResponse\b[\s\S]*?\}\s*from\s+['"]\.\.\/runtime\/orchestration\/index\.js['"]/;
    expect(facadeImport.test(readSourceFile(routeFilePath).text), 'facade imported').toBe(true);
    const calls = matchingCodeTokenLines(routeFiles(), /\bresolveMichaelRuntimeTurnResponse\s*\(/);
    expect(calls.length, calls.join('\n')).toBeGreaterThan(0);
  });

  it('#35 uses requireAuth', () => {
    const imports = matchingImportLines(
      routeFiles(),
      /\brequireAuth\b[\s\S]*?from\s+['"]\.\.\/middleware\/requireAuth\.js['"]/,
    );
    expect(imports.length, 'requireAuth import present').toBeGreaterThan(0);
    const used = matchingCodeTokenLines(routeFiles(), /\brequireAuth\b/);
    expect(used.length, 'requireAuth referenced').toBeGreaterThan(0);
  });

  it('#36 uses requireSteveComplete', () => {
    const imports = matchingImportLines(
      routeFiles(),
      /\brequireSteveComplete\b[\s\S]*?from\s+['"]\.\.\/middleware\/requireSteveComplete\.js['"]/,
    );
    expect(imports.length, 'requireSteveComplete import present').toBeGreaterThan(0);
    const used = matchingCodeTokenLines(routeFiles(), /\brequireSteveComplete\b/);
    expect(used.length, 'requireSteveComplete referenced').toBeGreaterThan(0);
  });

  it('#37 imports no store / PERSISTENCE / GraphRAG / retrieval helper', () => {
    const pattern =
      /\bfrom\s+['"][^'"]*(?:mongoose|mongodb|neo4j|chromadb|chroma-client|graph-?rag|\/services\/PERSISTENCE|PERSISTENCEFallback|\/tripleStack|rawRetrieval|retrievalHelper|directRetrieval|\/retrieval\b)[^'"]*['"]/i;
    const matches = matchingImportLines(routeFiles(), pattern);
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('#38 wires no OpenAI / Anthropic / Claude client', () => {
    const importPattern =
      /\bfrom\s+['"][^'"]*(?:openai|anthropic|@anthropic-ai|claude)[^'"]*['"]/i;
    const tokenPattern =
      /\b(?:openai|anthropic|claude|chatCompletion|messages\.create|createChatCompletion)\b/i;
    const matches = [
      ...matchingImportLines(routeFiles(), importPattern),
      ...matchingCodeTokenLines(routeFiles(), tokenPattern),
    ];
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('#39 wires no Telnyx / voice / call-control client', () => {
    const importPattern =
      /\bfrom\s+['"][^'"]*(?:telnyx|call-control|pstn|\/voice|\/services\/telnyx)[^'"]*['"]/i;
    const tokenPattern =
      /\b(?:telnyx|pstn|callControl|callControlId|createCallControl|placeCall|startCall|dialProspect)\b/;
    const matches = [
      ...matchingImportLines(routeFiles(), importPattern),
      ...matchingCodeTokenLines(routeFiles(), tokenPattern),
    ];
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('#40 introduces no persistence write shapes (.insert/.update/.save/.create / tripleStack)', () => {
    const pattern =
      /\.(?:insert|update|save|create)\s*\(|\b(?:tripleStackWrite|tripleStack|persistenceCall|directStoreCall)\b/i;
    const matches = matchingCodeTokenLines(routeFiles(), pattern);
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('#41 uses no bare /api/runtime namespace (route + index.ts mount)', () => {
    // Route: no bare /api/runtime string token (word-boundary distinguishes it
    // from /api/michael-runtime).
    const routeMatches = matchingCodeTokenLines(routeFiles(), /['"`]\/api\/runtime\b/);
    expect(routeMatches, routeMatches.join('\n')).toEqual([]);
    // index.ts: confirm a bare /api/runtime family is NOT mounted.
    const index = readSourceFile(indexFilePath).text;
    // ACR-0012 / Knowledge Evolution Lane D: the approved /api/runtime/knowledge-evolution mount (spec §25) is permitted; every other /api/runtime family stays forbidden.
    expect(
      /app\.use\(\s*['"`]\/api\/runtime(?!\/knowledge-evolution)\b/.test(index),
      'no bare /api/runtime mount',
    ).toBe(false);
  });
});
