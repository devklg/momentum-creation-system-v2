import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const orchestrationRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = resolve(orchestrationRoot, '../../../..');
const contractPath = 'server/src/runtime/orchestration/michaelRuntimeAdapterContract.ts';

type SourceFile = {
  readonly relativePath: string;
  readonly text: string;
};

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

function contractSource(): SourceFile[] {
  return [
    {
      relativePath: contractPath,
      text: readFileSync(resolve(repoRoot, contractPath), 'utf8'),
    },
  ];
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

function linesFromSource(files: readonly SourceFile[], stripStrings: boolean): Array<{
  readonly relativePath: string;
  readonly line: string;
  readonly lineNumber: number;
}> {
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

function matchingCodeTokenLines(files: readonly SourceFile[], pattern: RegExp): string[] {
  return linesFromSource(files, true)
    .filter(({ line }) => pattern.test(line))
    .map(({ relativePath, line, lineNumber }) => `${relativePath}:${lineNumber}: ${line.trim()}`);
}

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

describe('S2.15 Michael runtime adapter contract static governance boundary', () => {
  it('keeps contract imports away from stores, GraphRAG, direct persistence adapters, legacy fallback clients, raw retrieval helpers, and LLM providers', () => {
    const forbiddenImports =
      /\bfrom\s+['"][^'"]*(?:^|\/|\\|@)(?:mongoose|mongodb|neo4j-driver|chromadb|openai|anthropic|@anthropic-ai)(?:$|\/|\\|['"])|\bfrom\s+['"][^'"]*(?:graph-?rag|\/services\/PERSISTENCE|\/services\/persistence|\/persistence\/|\/services\/[^'"]*adapter|\/adapters?\/(?:mongo|neo4j|chroma|persistence)|PERSISTENCEFallback|PERSISTENCE-fallback|rawRetrieval|retrievalHelper|directRetrieval|retrieval|\/services\/anthropic|\/services\/openai)[^'"]*['"]/i;
    const matches = matchingImportLines(contractSource(), forbiddenImports);
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('keeps contract executable code away from store clients, GraphRAG, legacy fallback, direct persistence, retrieval, Context Packet assembly, and LLM calls', () => {
    const forbiddenCalls =
      /\b(?:new\s+MongoClient|mongoose\.connect|neo4j\.driver|new\s+ChromaClient|persistenceCall|directStoreCall|tripleStackWrite|mongoAdapter|neo4jAdapter|chromaAdapter|graphRag|graphrag|PERSISTENCEFallback|rawRetrieval|retrievalHelper|directRetrieval|fetchKnowledge|queryKnowledge|retrieveContext|searchKnowledge|buildContextPacket|prepareContextPacketFoundation|ContextPacketBuildInput|openai|anthropic|claude|chatCompletion|responses\.create|messages\.create|complete)\s*(?:\(|\.)?/i;
    const matches = matchingCodeTokenLines(contractSource(), forbiddenCalls);
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('does not create route-like handlers and keeps /api/runtime unmounted', () => {
    const routeLikeHandlers =
      /\b(?:Router\s*\(|express\s*\(|fastify\s*\(|app\.(?:use|get|post|put|patch|delete)\s*\(|router\.(?:use|get|post|put|patch|delete)\s*\(|requestHandler|routeHandler|middleware)\b/i;
    const contractMatches = matchingCodeTokenLines(contractSource(), routeLikeHandlers);
    const serverIndexMatches = matchingSourceLines(
      [
        {
          relativePath: 'server/src/index.ts',
          text: readFileSync(resolve(repoRoot, 'server/src/index.ts'), 'utf8'),
        },
      ],
      // ACR-0012 / Knowledge Evolution Lane D: the approved /api/runtime/knowledge-evolution mount (spec §25) is permitted; every other /api/runtime family stays forbidden.
      /(?:app\.use\s*\(\s*['"`]\/api\/runtime(?!\/knowledge-evolution)\b|app\.(?:get|post|put|patch|delete)\s*\(\s*['"`]\/api\/runtime(?!\/knowledge-evolution)\b|router\.(?:use|get|post|put|patch|delete)\s*\(\s*['"`]\/api\/runtime(?!\/knowledge-evolution)\b)/,
    );

    const matches = [...contractMatches, ...serverIndexMatches];
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('keeps .com untouched by the S2.15 Michael runtime adapter contract', () => {
    const comFiles = collectFiles('apps/com/src', ['.ts', '.tsx', '.js', '.jsx']);
    const forbiddenComImports =
      /\bfrom\s+['"][^'"]*(?:runtime\/orchestration|michaelRuntimeAdapterContract|michael_runtime_adapter_contract)[^'"]*['"]/i;
    const forbiddenComRuntimeTokens =
      /\b(?:runMichaelRuntimeAdapterContract|MichaelRuntimeAdapterContract|michaelRuntimeAdapterContract|agentResponseGenerated)\b/i;
    const forbiddenComRuntimeCalls =
      /\b(?:fetch|axios\.\w+)\s*\(\s*['"`]\/api\/runtime\b/i;

    const matches = [
      ...matchingImportLines(comFiles, forbiddenComImports),
      ...matchingCodeTokenLines(comFiles, forbiddenComRuntimeTokens),
      ...matchingSourceLines(comFiles, forbiddenComRuntimeCalls),
    ];
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('verifies the legacy HTTP fallback stays retired (ACR-0009) outside the contract source', () => {
    const persistenceClient = readFileSync(resolve(repoRoot, 'server/src/services/persistence/dispatch.ts'), 'utf8');
    expect(persistenceClient).toContain('export async function persistenceCall');
    expect(persistenceClient).toContain('directStoreCall');
    expect(persistenceClient).not.toContain('/execute');
    expect(persistenceClient).not.toContain('PERSISTENCE_URL');
  });

  it('does not introduce Steve, Ivory, telephony, persistence activation, automation, scoring, qualification, compensation math, or knowledge approval', () => {
    const forbiddenRuntimeActivation =
      /\b(?:steveSuccessAdapter|runSteve|createSteve|steveRuntime|ivoryAdapter|runIvory|createIvory|ivoryRuntime|telnyx|pstn|callControl|callControlId|createCallControl|startCall|placeCall|dialProspect|persistRuntimeEvent|persistEventEnvelope|saveRuntimeEvent|writeRuntimeEvent|eventOutbox|outboxRepository|replayRuntimeEvent|eventReplay|subscriberRegistry|publishToSubscriber|subscribeToRuntimeEvents|eventApi|activateEventApi|persistOutcome|saveOutcome|writeOutcome|outcomeRepository|outcomeStore|persistGuidedAction|saveGuidedAction|writeGuidedAction|guidedActionRepository|guidedActionStore|persistResponse|saveResponse|writeResponse|responseRepository|responseStore|sendEmail|sendSms|sendMessage|dispatchEmail|dispatchSms|automaticSend|automaticCall|autoSchedule|automaticSchedule|autoProspect|automatedProspecting|prospectingAutomation|scoreProspect|scoreBa|rankProspect|rankBa|classifyProspect|classifyBa|qualifyProspect|qualifyBa|predictPlacement|predictIncome|calculateCommission|calculateCompensation|calculateCycle|calculatePlacement|knowledgeApproval|approveKnowledge|generateAgentResponse|createAgentResponse|draftAgentResponse|agentResponseText|responseGenerated:\s*true|agentResponseGenerated:\s*true)\b/i;
    const matches = matchingCodeTokenLines(contractSource(), forbiddenRuntimeActivation);
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('keeps the adapter result inert with response generation false and every persistence marker disabled', () => {
    const [source] = contractSource();
    expect(source).toBeDefined();
    const contract = sourceWithoutComments(source!.text);
    const requiredDisabledMarkers = [
      'eventPersistence',
      'outcomePersistence',
      'guidedActionPersistence',
      'envelopePersistence',
      'responsePersistence',
    ];

    expect(sourceWithoutCommentsOrStrings(contract)).not.toMatch(/agentResponseGenerated:\s*true/);
    expect(contract).toMatch(/\bagentResponseGenerated:\s*false\b/);
    expect(sourceWithoutCommentsOrStrings(contract)).not.toMatch(
      /\b[a-z][A-Za-z]*Persistence:\s*(?:true|['"](?!disabled['"])[^'"]+['"])/,
    );
    for (const marker of requiredDisabledMarkers) {
      expect(contract).toMatch(new RegExp(`\\b${marker}:\\s*['"]disabled['"]`));
    }
  });
});
