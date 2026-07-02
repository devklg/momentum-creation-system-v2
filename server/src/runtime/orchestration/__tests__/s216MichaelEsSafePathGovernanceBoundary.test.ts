import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { validateMichaelResponseContract } from '../michaelResponseContract.js';
import {
  michaelResponseFixtureSafeCloseCandidateReviewOnlyRejectionEs,
  michaelResponseFixtureSafeCloseFailedContextPacketEs,
  michaelResponseFixtureSafeFallbackDegradedContextPacketEs,
  michaelResponseFixtureSafeFallbackMissingContextPacketEs,
} from '../fixtures/index.js';
import type { MichaelResponseContractV1 } from '../types.js';

// ---------------------------------------------------------------------------
// Static source-scanning governance boundary test for the S2.16 Michael
// Spanish (`es`) safe-path closeout. This mirrors the static-scan style of
// s215MichaelRuntimeAdapterContractGovernanceBoundary.test.ts and
// s24GovernanceBoundary.test.ts: source is read from disk, comments (and
// optionally string literals) are stripped, and forbidden WIRING patterns must
// produce empty match arrays. The S2.4 trap is avoided by targeting real
// wiring (import paths + call shapes) rather than bare identifiers that would
// false-positive on the response contract's defensive blocklist string literals
// (e.g. 'callControl', 'placementGuarantee') or guardrail text.
// ---------------------------------------------------------------------------

const orchestrationRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = resolve(orchestrationRoot, '../../../..');

const fixturesFilePath = 'server/src/runtime/orchestration/fixtures/michaelResponseFixtures.ts';
const fixturesIndexPath = 'server/src/runtime/orchestration/fixtures/index.ts';
const adapterPath = 'server/src/runtime/orchestration/michaelRuntimeAdapterContract.ts';
const esTestPath =
  'server/src/runtime/orchestration/__tests__/michaelRuntimeAdapterContractEsSafePaths.test.ts';

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

// The S2.16 ES surface: ES fixtures, fixtures barrel, the language-aware adapter,
// and the new ES safe-path spec. collectFiles() skips __tests__, so the spec is
// listed explicitly here.
function s216SurfaceFiles(): SourceFile[] {
  return [fixturesFilePath, fixturesIndexPath, adapterPath, esTestPath].map(readSourceFile);
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
// literals (e.g. 'callControl', 'steve_success', 'placementGuarantee') never
// trip a wiring regex. Use this for call-shape / identifier wiring checks.
function matchingCodeTokenLines(files: readonly SourceFile[], pattern: RegExp): string[] {
  return linesFromSource(files, true)
    .filter(({ line }) => pattern.test(line))
    .map(({ relativePath, line, lineNumber }) => `${relativePath}:${lineNumber}: ${line.trim()}`);
}

// Source scan that keeps string literals (comments stripped). Use only for
// structural markers that live inside literals (e.g. assembledBy:'agent_runtime'
// or route path strings).
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

const esSafePathFixtures: ReadonlyArray<{
  readonly name: string;
  readonly fixture: MichaelResponseContractV1;
}> = [
  {
    name: 'safeFallbackDegradedContextPacketEs',
    fixture: michaelResponseFixtureSafeFallbackDegradedContextPacketEs,
  },
  {
    name: 'safeFallbackMissingContextPacketEs',
    fixture: michaelResponseFixtureSafeFallbackMissingContextPacketEs,
  },
  {
    name: 'safeCloseFailedContextPacketEs',
    fixture: michaelResponseFixtureSafeCloseFailedContextPacketEs,
  },
  {
    name: 'safeCloseCandidateReviewOnlyRejectionEs',
    fixture: michaelResponseFixtureSafeCloseCandidateReviewOnlyRejectionEs,
  },
];

describe('S2.16 Michael ES safe-path static governance boundary', () => {
  it('#1 does not import a MongoDB client or model', () => {
    const pattern = /\bfrom\s+['"][^'"]*(?:^|\/|\\|@)(?:mongoose|mongodb)(?:$|\/|\\|['"])/i;
    const matches = matchingImportLines(s216SurfaceFiles(), pattern);
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('#2 does not import a Neo4j driver or adapter', () => {
    const pattern =
      /\bfrom\s+['"][^'"]*(?:neo4j-driver|neo4j-adapter|\/adapters?\/neo4j)[^'"]*['"]/i;
    const matches = matchingImportLines(s216SurfaceFiles(), pattern);
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('#3 does not import a ChromaDB client or adapter', () => {
    const pattern =
      /\bfrom\s+['"][^'"]*(?:chromadb|chroma-client|\/adapters?\/chroma)[^'"]*['"]/i;
    const matches = matchingImportLines(s216SurfaceFiles(), pattern);
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('#4 does not import a GraphRAG client', () => {
    const pattern = /\bfrom\s+['"][^'"]*graph-?rag[^'"]*['"]/i;
    const matches = matchingImportLines(s216SurfaceFiles(), pattern);
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('#5 does not import a direct persistence adapter', () => {
    const pattern =
      /\bfrom\s+['"][^'"]*(?:\/services\/persistence|\/persistence\/|\/services\/[^'"]*adapter|\/adapters?\/persistence|tripleStack)[^'"]*['"]/i;
    const matches = matchingImportLines(s216SurfaceFiles(), pattern);
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('#6 does not import a Gateway fallback client (or call gatewayCall)', () => {
    const importPattern =
      /\bfrom\s+['"][^'"]*(?:\/services\/gateway|gatewayFallback|gateway-fallback)[^'"]*['"]/i;
    const callPattern = /\bgatewayCall\s*\(|\bdirectPersistenceCall\s*\(/;
    const matches = [
      ...matchingImportLines(s216SurfaceFiles(), importPattern),
      ...matchingCodeTokenLines(s216SurfaceFiles(), callPattern),
    ];
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('#7 does not import raw retrieval helpers', () => {
    const pattern =
      /\bfrom\s+['"][^'"]*(?:rawRetrieval|retrievalHelper|directRetrieval|\/retrieval\b)[^'"]*['"]/i;
    const matches = matchingImportLines(s216SurfaceFiles(), pattern);
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('#8 does not call buildContextPacket', () => {
    const pattern = /\bbuildContextPacket\s*\(/;
    const matches = matchingCodeTokenLines(s216SurfaceFiles(), pattern);
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('#9 does not assemble Context Packets', () => {
    const tokenPattern = /\b(?:prepareContextPacketFoundation\s*\(|ContextPacketBuildInput)\b/;
    const markerPattern = /assembledBy:\s*['"]agent_runtime['"]/;
    const matches = [
      ...matchingCodeTokenLines(s216SurfaceFiles(), tokenPattern),
      ...matchingSourceLines(s216SurfaceFiles(), markerPattern),
    ];
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('#10 does not call an LLM provider', () => {
    const pattern =
      /\b(?:chatCompletion|messages\.create|responses\.create|createCompletion|createChatCompletion)\s*\(/i;
    const matches = matchingCodeTokenLines(s216SurfaceFiles(), pattern);
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('#11 does not import an OpenAI / Anthropic / Claude client', () => {
    const pattern =
      /\bfrom\s+['"][^'"]*(?:^|\/|\\|@)(?:openai|anthropic|@anthropic-ai)(?:$|\/|\\|['"])|\bfrom\s+['"][^'"]*(?:\/services\/anthropic|\/services\/openai|\/services\/claude)[^'"]*['"]/i;
    const matches = matchingImportLines(s216SurfaceFiles(), pattern);
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('#12 does not import Steve runtime behavior', () => {
    const importPattern =
      /\bfrom\s+['"][^'"]*(?:steveSuccess|steve-success|\/steve)[^'"]*['"]/i;
    const callPattern = /\b(?:runSteve|createSteve|steveSuccessAdapter|steveRuntime)\b/;
    const matches = [
      ...matchingImportLines(s216SurfaceFiles(), importPattern),
      ...matchingCodeTokenLines(s216SurfaceFiles(), callPattern),
    ];
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('#13 does not import Ivory runtime behavior', () => {
    const importPattern = /\bfrom\s+['"][^'"]*(?:ivory|\/ivory)[^'"]*['"]/i;
    const callPattern = /\b(?:runIvory|createIvory|ivoryAdapter|ivoryRuntime)\b/;
    const matches = [
      ...matchingImportLines(s216SurfaceFiles(), importPattern),
      ...matchingCodeTokenLines(s216SurfaceFiles(), callPattern),
    ];
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('#14 does not wire Telnyx / PSTN / call-control', () => {
    const importPattern =
      /\bfrom\s+['"][^'"]*(?:telnyx|pstn|call-control)[^'"]*['"]/i;
    // Real call-control WIRING only — never the bare 'callControl' blocklist literal.
    const callPattern =
      /\b(?:telnyx|pstn|callControlId|createCallControl|startCall|placeCall|dialProspect)\s*[(.]/i;
    const matches = [
      ...matchingImportLines(s216SurfaceFiles(), importPattern),
      ...matchingCodeTokenLines(s216SurfaceFiles(), callPattern),
    ];
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('#15 does not create route-like handlers', () => {
    const importPattern = /\bfrom\s+['"](?:express|fastify)['"]/i;
    const callPattern =
      /\b(?:express\s*\(|Router\s*\(|fastify\s*\(|app\.(?:use|get|post|put|patch|delete)\s*\(|router\.(?:use|get|post|put|patch|delete)\s*\()/i;
    const matches = [
      ...matchingImportLines(s216SurfaceFiles(), importPattern),
      ...matchingCodeTokenLines(s216SurfaceFiles(), callPattern),
    ];
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('#16 keeps /api/runtime unmounted in orchestration and the server entrypoint', () => {
    const orchestrationMatches = matchingSourceLines(
      orchestrationProductionFiles(),
      /(?:app\.use\s*\(\s*['"`]\/api\/runtime\b|app\.(?:get|post|put|patch|delete)\s*\(\s*['"`]\/api\/runtime\b|router\.(?:use|get|post|put|patch|delete)\s*\(\s*['"`]\/api\/runtime\b)/,
    );
    const serverIndexMatches = matchingSourceLines(
      [readSourceFile('server/src/index.ts')],
      /(?:app\.use\s*\(\s*['"`]\/api\/runtime\b|app\.(?:get|post|put|patch|delete)\s*\(\s*['"`]\/api\/runtime\b|router\.(?:use|get|post|put|patch|delete)\s*\(\s*['"`]\/api\/runtime\b)/,
    );
    const matches = [...orchestrationMatches, ...serverIndexMatches];
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('#17 keeps .com untouched by the S2.16 ES fixtures / adapter symbols', () => {
    const comFiles = collectFiles('apps/com/src', ['.ts', '.tsx', '.js', '.jsx']);
    const importPattern =
      /\bfrom\s+['"][^'"]*(?:runtime\/orchestration|michaelResponseFixtures|michaelRuntimeAdapterContract)[^'"]*['"]/i;
    const tokenPattern =
      /\b(?:michaelResponseFixtureSafeFallbackDegradedContextPacketEs|michaelResponseFixtureSafeFallbackMissingContextPacketEs|michaelResponseFixtureSafeCloseFailedContextPacketEs|michaelResponseFixtureSafeCloseCandidateReviewOnlyRejectionEs|michaelResponseFixtureNextTrainingStepEs|michaelResponseFixtureClarificationQuestionEs|runMichaelRuntimeAdapterContract|michaelRuntimeAdapterContract)\b/i;
    const matches = [
      ...matchingImportLines(comFiles, importPattern),
      ...matchingCodeTokenLines(comFiles, tokenPattern),
    ];
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('#18 verifies the Gateway HTTP fallback stays retired (ACR-0009) outside the S2.16 surface', () => {
    const gatewayClient = readFileSync(resolve(repoRoot, 'server/src/services/gateway.ts'), 'utf8');
    expect(gatewayClient).toContain('export async function gatewayCall');
    expect(gatewayClient).not.toContain('GATEWAY_URL');
  });

  it('#19 does not introduce event persistence / outbox / replay / subscriber / event API code', () => {
    const pattern =
      /\b(?:persistRuntimeEvent|persistEventEnvelope|saveRuntimeEvent|writeRuntimeEvent|eventOutbox|outboxRepository|replayRuntimeEvent|eventReplay|subscriberRegistry|publishToSubscriber|subscribeToRuntimeEvents|eventApi|activateEventApi)\s*[(.]?/i;
    const matches = matchingCodeTokenLines(s216SurfaceFiles(), pattern);
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('#20 does not introduce outcome persistence', () => {
    const pattern =
      /\b(?:persistOutcome|saveOutcome|writeOutcome|outcomeRepository|outcomeStore)\s*[(.]?/i;
    const matches = matchingCodeTokenLines(s216SurfaceFiles(), pattern);
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('#21 does not introduce Guided Action persistence', () => {
    const pattern =
      /\b(?:persistGuidedAction|saveGuidedAction|writeGuidedAction|guidedActionRepository|guidedActionStore)\s*[(.]?/i;
    const matches = matchingCodeTokenLines(s216SurfaceFiles(), pattern);
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('#22 does not introduce response / session / transcript persistence call shapes', () => {
    const pattern =
      /\b(?:persistResponse|saveResponse|writeResponse|responseRepository|responseStore|persistSession|saveSession|writeSession|persistTranscript|saveTranscript|writeTranscript|transcriptRepository|sessionRepository)\s*\(/i;
    const matches = matchingCodeTokenLines(s216SurfaceFiles(), pattern);
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('#23 does not introduce automatic sending / calling / scheduling / prospecting call shapes', () => {
    const pattern =
      /\b(?:sendEmail|sendSms|sendMessage|dispatchEmail|dispatchSms|placeCall|startCall|dialProspect|autoSchedule|automaticSchedule|autoProspect|automatedProspecting|prospectingAutomation|automaticSend|automaticCall)\s*\(/i;
    const matches = matchingCodeTokenLines(s216SurfaceFiles(), pattern);
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('#24 does not introduce scoring / ranking / classification / qualification logic', () => {
    const pattern =
      /\b(?:computeScore|assignRank|scoreProspect|scoreBa|rankProspect|rankBa|classifyProspect|classifyBa|qualifyProspect|qualifyBa)\s*\(/i;
    const matches = matchingCodeTokenLines(s216SurfaceFiles(), pattern);
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('#25 does not introduce income / compensation / cycle / placement calculation call shapes', () => {
    const pattern =
      /\b(?:predictPlacement|predictIncome|calculateCommission|calculateCompensation|calculateCycle|calculatePlacement|computeCommission|computeCycle)\s*\(/i;
    const matches = matchingCodeTokenLines(s216SurfaceFiles(), pattern);
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('#26 does not introduce knowledge approval call shapes', () => {
    const pattern = /\b(?:knowledgeApproval|approveKnowledge|persistKnowledgeApproval)\s*[(.]?/i;
    const matches = matchingCodeTokenLines(s216SurfaceFiles(), pattern);
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('#27 keeps agentResponseGenerated false across ES fixtures and the adapter', () => {
    const fixtures = sourceWithoutComments(readSourceFile(fixturesFilePath).text);
    const adapter = sourceWithoutComments(readSourceFile(adapterPath).text);

    expect(fixtures).not.toMatch(/agentResponseGenerated:\s*true/);
    expect(fixtures).toMatch(/\bagentResponseGenerated:\s*false\b/);
    expect(adapter).not.toMatch(/agentResponseGenerated:\s*true/);
    expect(adapter).toMatch(/\bagentResponseGenerated:\s*false\b/);
  });

  it('#28 keeps every persistence marker disabled across ES fixtures and the adapter', () => {
    const fixtures = sourceWithoutComments(readSourceFile(fixturesFilePath).text);
    const adapter = sourceWithoutComments(readSourceFile(adapterPath).text);
    const requiredDisabledMarkers = [
      'eventPersistence',
      'outcomePersistence',
      'guidedActionPersistence',
      'envelopePersistence',
      'responsePersistence',
      'sessionPersistence',
      'transcriptPersistence',
    ];

    // No `*Persistence: enabled` (or any non-disabled string / true) in the adapter.
    expect(sourceWithoutCommentsOrStrings(adapter)).not.toMatch(
      /\b[a-z][A-Za-z]*Persistence:\s*(?:true|['"](?!disabled['"])[^'"]+['"])/,
    );
    for (const marker of requiredDisabledMarkers) {
      expect(adapter).toMatch(new RegExp(`\\b${marker}:\\s*['"]disabled['"]`));
    }

    // The ES fixtures rely on baseFixture forcing persistence: 'disabled'.
    expect(fixtures).toMatch(/\bpersistence:\s*['"]disabled['"]/);
    for (const { name, fixture } of esSafePathFixtures) {
      expect(fixture.persistence, `${name} persistence`).toBe('disabled');
    }
  });

  it('#29 validates each Spanish safe-path fixture (no forbidden fields / prohibited text)', () => {
    for (const { name, fixture } of esSafePathFixtures) {
      const validation = validateMichaelResponseContract(fixture);
      expect(validation.ok, `${name} must validate`).toBe(true);
      expect(fixture.language, `${name} language`).toBe('es');
      if (fixture.responseType === 'safe_close') {
        expect(fixture.nextStep, `${name} safe_close nextStep`).toBeUndefined();
      }
    }
  });
});
