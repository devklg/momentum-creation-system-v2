import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { runMichaelRuntimeResponseFixtureScenario } from '../index.js';

const orchestrationRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = resolve(orchestrationRoot, '../../../..');

type SourceFile = {
  readonly relativePath: string;
  readonly text: string;
};

const integrationFiles = [
  'server/src/runtime/orchestration/fixtures/michaelRuntimeResponseHarness.ts',
  'server/src/runtime/orchestration/fixtures/michaelRuntimeResponseScenarios.ts',
].map((relativePath) => ({
  relativePath,
  text: readFileSync(resolve(repoRoot, relativePath), 'utf8'),
}));

function normalizePath(path: string): string {
  return path.split(sep).join('/');
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

function sourceWithoutCommentsOrStrings(text: string): string {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/`(?:\\.|[^`\\])*`/g, '""')
    .replace(/'(?:\\.|[^'\\])*'/g, '""')
    .replace(/"(?:\\.|[^"\\])*"/g, '""');
}

function sourceWithoutComments(text: string): string {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/\s+\/\/.*$/gm, '');
}

function executableLines(files: readonly SourceFile[]): Array<{
  readonly relativePath: string;
  readonly line: string;
  readonly lineNumber: number;
}> {
  return files.flatMap((file) =>
    sourceWithoutCommentsOrStrings(file.text)
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
  return files.flatMap((file) =>
    sourceWithoutComments(file.text)
      .split(/\r?\n/)
      .map((line, index) => ({
        relativePath: file.relativePath,
        line,
        lineNumber: index + 1,
      }))
      .filter(({ line }) => /^\s*import\b/.test(line)),
  );
}

function matchingLines(files: readonly SourceFile[], pattern: RegExp): string[] {
  return executableLines(files)
    .filter(({ line }) => pattern.test(line))
    .map(({ relativePath, line, lineNumber }) => `${relativePath}:${lineNumber}: ${line.trim()}`);
}

function matchingImportLines(files: readonly SourceFile[], pattern: RegExp): string[] {
  return importLines(files)
    .filter(({ line }) => pattern.test(line))
    .map(({ relativePath, line, lineNumber }) => `${relativePath}:${lineNumber}: ${line.trim()}`);
}

describe('S2.13 Michael runtime response fixture integration static governance boundary', () => {
  it('does not import stores, GraphRAG, direct adapters, Gateway fallback clients, or retrieval helpers', () => {
    const forbiddenImports =
      /\bfrom\s+['"][^'"]*(?:mongoose|mongodb|neo4j-driver|chromadb|graph-?rag|\/services\/gateway|\/services\/persistence|\/persistence\/|gatewayFallback|gateway-fallback|rawRetrieval|retrievalHelper|directRetrieval|retrieval)[^'"]*['"]/i;
    const matches = matchingImportLines(integrationFiles, forbiddenImports);
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('does not call store, GraphRAG, Context Packet builder, retrieval, persistence, or Gateway fallback APIs', () => {
    const forbiddenCalls =
      /\b(?:new\s+MongoClient|mongoose\.connect|neo4j\.driver|new\s+ChromaClient|gatewayCall|directPersistenceCall|tripleStackWrite|mongoAdapter|neo4jAdapter|chromaAdapter|graphRag|graphrag|gatewayFallback|rawRetrieval|retrievalHelper|directRetrieval|fetchKnowledge|queryKnowledge|retrieveContext|buildContextPacket|prepareContextPacketFoundation|persist\w*|save\w*|\w+Repository|\w+Store)\s*(?:\(|\.)/i;
    const matches = matchingLines(integrationFiles, forbiddenCalls);
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('does not call LLM providers or create a response generation engine', () => {
    const forbiddenGeneration =
      /\b(?:openai|anthropic|claude|chatCompletion|responses\.create|messages\.create|complete\(|generateAgentResponse|createAgentResponse|draftAgentResponse|responseGenerated:\s*true|agentResponseGenerated:\s*true)\b/i;
    const matches = matchingLines(integrationFiles, forbiddenGeneration);
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('does not introduce route handlers, middleware, or /api/runtime mounts', () => {
    const serverIndex = {
      relativePath: 'server/src/index.ts',
      text: readFileSync(resolve(repoRoot, 'server/src/index.ts'), 'utf8'),
    };
    const forbiddenRoutes =
      /\b(?:Router\s*\(|express\s*\(|fastify\s*\(|app\.(?:use|get|post|put|patch|delete)\s*\(|router\.(?:use|get|post|put|patch|delete)\s*\(|requestHandler|routeHandler|middleware)|\/api\/runtime\b/i;
    const integrationMatches = matchingLines(integrationFiles, forbiddenRoutes);
    const serverIndexMatches = matchingLines([serverIndex], /\/api\/runtime\b/i);
    const matches = [...integrationMatches, ...serverIndexMatches];
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('keeps .com out of the S2.13 fixture integration path', () => {
    const comMatches = matchingLines(
      collectFiles('apps/com/src', ['.ts', '.tsx', '.js', '.jsx']),
      /(?:michaelRuntimeResponse|runMichaelRuntimeResponseFixtureScenario|\/api\/runtime\b|runtime\/orchestration)/i,
    );
    expect(comMatches, comMatches.join('\n')).toEqual([]);
  });

  it('preserves Gateway fallback client source outside S2.13 changes', () => {
    const gatewayClient = readFileSync(resolve(repoRoot, 'server/src/services/gateway.ts'), 'utf8');
    expect(gatewayClient).toContain('export async function gatewayCall');
    expect(gatewayClient).toContain('directPersistenceCall');
    expect(gatewayClient).toContain('/execute');
    expect(gatewayClient).toContain('GATEWAY_URL');
  });

  it('does not introduce telephony, event activation, outcome/action persistence, automation, scoring, or knowledge approval', () => {
    const forbiddenRuntimeActivation =
      /\b(?:telnyx|pstn|callControl|callControlId|createCallControl|startCall|placeCall|dialProspect|persistRuntimeEvent|persistEventEnvelope|saveRuntimeEvent|writeRuntimeEvent|eventOutbox|outboxRepository|replayRuntimeEvent|eventReplay|subscriberRegistry|publishToSubscriber|subscribeToRuntimeEvents|eventApi|activateEventApi|persistOutcome|saveOutcome|writeOutcome|outcomeRepository|outcomeStore|persistGuidedAction|saveGuidedAction|writeGuidedAction|guidedActionRepository|guidedActionStore|sendEmail|sendSms|sendMessage|dispatchEmail|dispatchSms|automaticSend|automaticCall|autoProspect|automatedProspecting|prospectingAutomation|scoreProspect|rankProspect|qualifyProspect|predictPlacement|predictIncome|calculateCommission|knowledgeApproval|approveKnowledge)\b/i;
    const matches = matchingLines(integrationFiles, forbiddenRuntimeActivation);
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('keeps Context Manager as the only assembler by composing with runtime turn fixture harness only', () => {
    const harnessSource = readFileSync(
      resolve(repoRoot, 'server/src/runtime/orchestration/fixtures/michaelRuntimeResponseHarness.ts'),
      'utf8',
    );
    expect(harnessSource).toContain('runRuntimeTurnFixtureScenario');
    expect(sourceWithoutCommentsOrStrings(harnessSource)).not.toMatch(
      /\b(?:buildContextPacket|prepareContextPacketFoundation)\s*\(/,
    );
  });

  it('keeps agentResponseGenerated false for every integrated fixture result', async () => {
    const scenarioNames = [
      'complete_training_support',
      'complete_ambiguous_training_support',
      'degraded_context_packet',
      'missing_context_manager_boundary',
      'failed_context_packet',
      'rejected_context_packet',
      'invalid_objective',
      'unknown_agent',
      'candidate_review_only_rejected',
      'unsupported_language',
      'wrong_task_type',
      'non_michael_agent',
    ] as const;

    for (const scenarioName of scenarioNames) {
      const result = await runMichaelRuntimeResponseFixtureScenario({ scenarioName });
      expect(result.agentResponseGenerated).toBe(false);
      expect(result.runtimeTurn.agentResponseGenerated).toBe(false);
      expect(result.runtimeTurn.result.agentResponseGenerated).toBe(false);
      expect(result.michaelResponse.agentResponseGenerated).toBe(false);
    }
  });
});
