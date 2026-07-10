import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const orchestrationRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = resolve(orchestrationRoot, '../../../..');

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

function sourceWithoutComments(text: string): string {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/\s+\/\/.*$/gm, '');
}

function sourceWithoutCommentsOrStrings(text: string): string {
  return sourceWithoutComments(text).replace(/(['"`])(?:\\.|(?!\1)[\s\S])*?\1/g, '""');
}

function executableLines(files: SourceFile[]): Array<{
  readonly relativePath: string;
  readonly line: string;
  readonly lineNumber: number;
}> {
  return files.flatMap((file) =>
    sourceWithoutComments(file.text)
      .split(/\r?\n/)
      .map((line, index) => ({
        relativePath: file.relativePath,
        line,
        lineNumber: index + 1,
      }))
      .filter(({ line }) => line.trim().length > 0),
  );
}

function importLines(files: SourceFile[]): Array<{
  readonly relativePath: string;
  readonly line: string;
  readonly lineNumber: number;
}> {
  return executableLines(files).filter(({ line }) => /^\s*import\b/.test(line));
}

function matchingLines(files: SourceFile[], pattern: RegExp): string[] {
  return executableLines(files)
    .filter(({ line }) => pattern.test(line))
    .map(({ relativePath, line, lineNumber }) => `${relativePath}:${lineNumber}: ${line.trim()}`);
}

function matchingCodeTokenLines(files: SourceFile[], pattern: RegExp): string[] {
  return files.flatMap((file) =>
    sourceWithoutCommentsOrStrings(file.text)
      .split(/\r?\n/)
      .map((line, index) => ({
        relativePath: file.relativePath,
        line,
        lineNumber: index + 1,
      }))
      .filter(({ line }) => line.trim().length > 0)
      .filter(({ line }) => pattern.test(line))
      .map(({ relativePath, line, lineNumber }) => `${relativePath}:${lineNumber}: ${line.trim()}`),
  );
}

function matchingImportLines(files: SourceFile[], pattern: RegExp): string[] {
  return importLines(files)
    .filter(({ line }) => pattern.test(line))
    .map(({ relativePath, line, lineNumber }) => `${relativePath}:${lineNumber}: ${line.trim()}`);
}

function michaelResponseProductionFiles(): SourceFile[] {
  return [
    {
      relativePath: 'server/src/runtime/orchestration/michaelResponseContract.ts',
      text: readFileSync(
        resolve(repoRoot, 'server/src/runtime/orchestration/michaelResponseContract.ts'),
        'utf8',
      ),
    },
    ...collectFiles('server/src/runtime/orchestration/fixtures', ['.ts']).filter((file) =>
      file.relativePath.endsWith('/michaelResponseFixtures.ts'),
    ),
  ];
}

describe('S2.12 Michael response contract static governance boundary', () => {
  it('keeps Michael response contract imports away from stores, GraphRAG, adapters, legacy fallback, persistence, and retrieval helpers', () => {
    const forbiddenImports =
      /\bfrom\s+['"][^'"]*(?:^|\/|\\|@)(?:mongoose|mongodb|neo4j-driver|chromadb|openai|anthropic|@anthropic-ai)(?:$|\/|\\|['"])|\bfrom\s+['"][^'"]*(?:graph-?rag|\/services\/PERSISTENCE|\/services\/persistence|\/persistence\/|PERSISTENCEFallback|PERSISTENCE-fallback|rawRetrieval|retrievalHelper|directRetrieval|retrieval|\/services\/anthropic|\/services\/openai)[^'"]*['"]/i;
    const matches = matchingImportLines(michaelResponseProductionFiles(), forbiddenImports);
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('does not call Context Packet assembly, LLM providers, direct stores, or retrieval systems', () => {
    const forbiddenCalls =
      /\b(?:buildContextPacket|prepareContextPacketFoundation|new\s+MongoClient|mongoose\.connect|neo4j\.driver|new\s+ChromaClient|persistenceCall|directStoreCall|tripleStackWrite|mongoAdapter|neo4jAdapter|chromaAdapter|graphRag|graphrag|PERSISTENCEFallback|rawRetrieval|retrievalHelper|directRetrieval|fetchKnowledge|queryKnowledge|retrieveContext|openai|anthropic|claude)\s*(?:\(|\.)?/i;
    const matches = matchingCodeTokenLines(michaelResponseProductionFiles(), forbiddenCalls);
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('keeps /api/runtime unmounted in Michael response harness and server entrypoint', () => {
    const sourceMatches = matchingLines(
      michaelResponseProductionFiles(),
      /(?:app\.use\s*\(|express\s*\(|router\.\w+\s*\(|['"`]\/api\/runtime\b)/,
    );
    const serverIndexMatches = matchingLines(
      [
        {
          relativePath: 'server/src/index.ts',
          text: readFileSync(resolve(repoRoot, 'server/src/index.ts'), 'utf8'),
        },
      ],
      // ACR-0012 / Knowledge Evolution Lane D: the approved /api/runtime/knowledge-evolution mount (spec §25) is permitted; every other /api/runtime family stays forbidden.
      /(?:app\.use\s*\(\s*['"`]\/api\/runtime(?!\/knowledge-evolution)\b|['"`]\/api\/runtime(?!\/knowledge-evolution)\b)/,
    );

    const matches = [...sourceMatches, ...serverIndexMatches];
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('keeps the .com surface untouched by S2.12 Michael response contract work', () => {
    const comMatches = matchingLines(
      collectFiles('apps/com/src', ['.ts', '.tsx', '.js', '.jsx']),
      /(?:michaelResponseContract|michael_response_contract|michael_magnificent|\/api\/runtime\b|runtime\/orchestration)/i,
    );
    expect(comMatches, comMatches.join('\n')).toEqual([]);
  });

  it('preserves legacy fallback client outside Michael response contract source', () => {
    const persistenceClient = readFileSync(resolve(repoRoot, 'server/src/services/persistence/dispatch.ts'), 'utf8');
    expect(persistenceClient).toContain('export async function persistenceCall');
    expect(persistenceClient).toContain('directStoreCall');
    expect(persistenceClient).not.toContain('/execute');
    expect(persistenceClient).not.toContain('PERSISTENCE_URL');
  });

  it('does not introduce telephony, persistence activation, automation, prospect scoring, route handlers, or knowledge approval', () => {
    const forbiddenRuntimeActivation =
      /\b(?:telnyx|pstn|callControl|callControlId|createCallControl|startCall|placeCall|dialProspect|persistRuntimeEvent|persistEventEnvelope|saveRuntimeEvent|writeRuntimeEvent|eventOutbox|outboxRepository|replayRuntimeEvent|eventReplay|subscriberRegistry|publishToSubscriber|subscribeToRuntimeEvents|eventApi|activateEventApi|persistOutcome|saveOutcome|writeOutcome|outcomeRepository|outcomeStore|persistGuidedAction|saveGuidedAction|writeGuidedAction|guidedActionRepository|guidedActionStore|sendEmail|sendSms|sendMessage|dispatchEmail|dispatchSms|automaticSend|automaticCall|autoProspect|automatedProspecting|prospectingAutomation|scoreProspect|rankProspect|qualifyProspect|predictPlacement|predictIncome|calculateCommission|knowledgeApproval|approveKnowledge|Router\s*\(|express\s*\(|fastify\s*\(|app\.(?:use|get|post|put|patch|delete)\s*\(|router\.(?:use|get|post|put|patch|delete)\s*\(|requestHandler|routeHandler|middleware)\b/i;
    const matches = matchingCodeTokenLines(michaelResponseProductionFiles(), forbiddenRuntimeActivation);
    expect(matches, matches.join('\n')).toEqual([]);
  });
});
