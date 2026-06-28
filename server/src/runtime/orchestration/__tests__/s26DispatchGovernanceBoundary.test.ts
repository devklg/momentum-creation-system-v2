import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const orchestrationRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = resolve(orchestrationRoot, '../../../..');
const dispatchSourcePath = resolve(
  repoRoot,
  'server/src/runtime/orchestration/adapters/dispatchAdapter.ts',
);

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

function dispatchSource(): SourceFile[] {
  return [
    {
      relativePath: 'server/src/runtime/orchestration/adapters/dispatchAdapter.ts',
      text: readFileSync(dispatchSourcePath, 'utf8'),
    },
  ];
}

function sourceWithoutComments(text: string): string {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/\s+\/\/.*$/gm, '');
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

function matchingImportLines(files: SourceFile[], pattern: RegExp): string[] {
  return importLines(files)
    .filter(({ line }) => pattern.test(line))
    .map(({ relativePath, line, lineNumber }) => `${relativePath}:${lineNumber}: ${line.trim()}`);
}

describe('S2.6 adapter dispatch static governance boundary', () => {
  it('keeps dispatch imports away from stores, GraphRAG, Gateway fallback, persistence, and retrieval helpers', () => {
    const forbiddenImports =
      /\bfrom\s+['"][^'"]*(?:^|\/|\\|@)(?:mongoose|mongodb|neo4j-driver|chromadb)(?:$|\/|\\|['"])|\bfrom\s+['"][^'"]*(?:graph-?rag|\/services\/gateway|\/services\/persistence|\/persistence\/|gatewayFallback|gateway-fallback|rawRetrieval|retrievalHelper|directRetrieval|retrieval)[^'"]*['"]/i;
    const matches = matchingImportLines(dispatchSource(), forbiddenImports);
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('keeps dispatch executable code away from direct stores, GraphRAG, Gateway fallback, raw retrieval, and packet assembly', () => {
    const forbiddenCalls =
      /\b(?:new\s+MongoClient|mongoose\.connect|neo4j\.driver|new\s+ChromaClient|gatewayCall|directPersistenceCall|tripleStackWrite|mongoAdapter|neo4jAdapter|chromaAdapter|graphRag|graphrag|gatewayFallback|rawRetrieval|retrievalHelper|directRetrieval|fetchKnowledge|queryKnowledge|retrieveContext|buildContextPacket|prepareContextPacketFoundation)\s*(?:\(|\.)?/i;
    const matches = matchingLines(dispatchSource(), forbiddenCalls);
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('keeps /api/runtime unmounted in dispatch and the server entrypoint', () => {
    const dispatchMatches = matchingLines(
      dispatchSource(),
      /(?:app\.use\s*\(|express\s*\(|router\.\w+\s*\(|['"`]\/api\/runtime\b)/,
    );
    const serverIndexMatches = matchingLines(
      [
        {
          relativePath: 'server/src/index.ts',
          text: readFileSync(resolve(repoRoot, 'server/src/index.ts'), 'utf8'),
        },
      ],
      /(?:app\.use\s*\(\s*['"`]\/api\/runtime\b|['"`]\/api\/runtime\b)/,
    );

    const matches = [...dispatchMatches, ...serverIndexMatches];
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('keeps the .com surface untouched by S2.6 dispatch wiring', () => {
    const comMatches = matchingLines(
      collectFiles('apps/com/src', ['.ts', '.tsx', '.js', '.jsx']),
      /(?:dispatchAgentRuntimeAdapter|dispatchAdapter|\/api\/runtime\b|agentResponseGenerated|runtime\/orchestration)/i,
    );
    expect(comMatches, comMatches.join('\n')).toEqual([]);
  });

  it('preserves the Gateway fallback client outside dispatch source', () => {
    const gatewayClient = readFileSync(resolve(repoRoot, 'server/src/services/gateway.ts'), 'utf8');
    expect(gatewayClient).toContain('export async function gatewayCall');
    expect(gatewayClient).toContain('directPersistenceCall');
    expect(gatewayClient).toContain('/execute');
    expect(gatewayClient).toContain('GATEWAY_URL');
  });

  it('does not introduce telephony, event activation, persistence, automation, prospect scoring, or response generation in dispatch', () => {
    const forbiddenRuntimeActivation =
      /\b(?:telnyx|pstn|callControl|callControlId|createCallControl|startCall|placeCall|dialProspect|persistRuntimeEvent|persistEventEnvelope|saveRuntimeEvent|writeRuntimeEvent|eventOutbox|outboxRepository|replayRuntimeEvent|eventReplay|subscriberRegistry|publishToSubscriber|subscribeToRuntimeEvents|eventApi|activateEventApi|persistOutcome|saveOutcome|writeOutcome|outcomeRepository|outcomeStore|persistGuidedAction|saveGuidedAction|writeGuidedAction|guidedActionRepository|guidedActionStore|sendEmail|sendSms|sendMessage|dispatchEmail|dispatchSms|automaticSend|automaticCall|autoProspect|automatedProspecting|prospectingAutomation|scoreProspect|rankProspect|qualifyProspect|predictPlacement|predictIncome|calculateCommission|generateAgentResponse|createAgentResponse|draftAgentResponse|agentResponseText|responseGenerated:\s*true|agentResponseGenerated:\s*true)\b/i;
    const matches = matchingLines(dispatchSource(), forbiddenRuntimeActivation);
    expect(matches, matches.join('\n')).toEqual([]);
  });
});
