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

function adapterProductionFiles(): SourceFile[] {
  return collectFiles('server/src/runtime/orchestration/adapters', ['.ts']);
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

describe('S2.5 inert adapter static governance boundary', () => {
  it('keeps adapter imports away from stores, GraphRAG, Gateway fallback, direct adapters, and retrieval helpers', () => {
    const forbiddenImports =
      /\bfrom\s+['"][^'"]*(?:^|\/|\\|@)(?:mongoose|mongodb|neo4j-driver|chromadb)(?:$|\/|\\|['"])|\bfrom\s+['"][^'"]*(?:graph-?rag|\/services\/gateway|\/services\/persistence|\/persistence\/|\/adapters?\/|\/adapter(?:\.js)?|gatewayFallback|gateway-fallback|rawRetrieval|retrievalHelper|directRetrieval|retrieval)[^'"]*['"]/i;
    const matches = matchingImportLines(adapterProductionFiles(), forbiddenImports);
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('keeps adapter executable code away from direct stores, GraphRAG, Gateway fallback, and raw retrieval calls', () => {
    const forbiddenCalls =
      /\b(?:new\s+MongoClient|mongoose\.connect|neo4j\.driver|new\s+ChromaClient|gatewayCall|directPersistenceCall|tripleStackWrite|mongoAdapter|neo4jAdapter|chromaAdapter|graphRag|graphrag|gatewayFallback|rawRetrieval|retrievalHelper|directRetrieval|fetchKnowledge|queryKnowledge|retrieveContext)\s*(?:\(|\.)?/i;
    const matches = matchingLines(adapterProductionFiles(), forbiddenCalls);
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('keeps Context Packet assembly outside adapters and preserves Context Manager as the only assembler', () => {
    const forbiddenAssembly =
      /(?:\bbuildContextPacket\s*\(|\bprepareContextPacketFoundation\s*\(|\bContextPacketBuildInput\b|\bassembledBy:\s*['"]agent_runtime['"]|\bassembledBy:\s*['"]adapter['"])/;
    const matches = matchingLines(adapterProductionFiles(), forbiddenAssembly);
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('keeps /api/runtime unmounted in adapters and the server entrypoint', () => {
    const adapterMatches = matchingLines(
      adapterProductionFiles(),
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

    const matches = [...adapterMatches, ...serverIndexMatches];
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('keeps the .com surface untouched by S2.5 adapter runtime wiring', () => {
    const comMatches = matchingLines(
      collectFiles('apps/com/src', ['.ts', '.tsx', '.js', '.jsx']),
      /(?:runtime\/orchestration|agent_runtime_orchestrator|composeOrchestrationTurn|steveSuccessAdapter|michaelMagnificentAdapter|ivoryAdapter|\/api\/runtime\b|context\.packet\.|agentResponseGenerated)/i,
    );
    expect(comMatches, comMatches.join('\n')).toEqual([]);
  });

  it('preserves the Gateway fallback client outside adapter source', () => {
    const gatewayClient = readFileSync(resolve(repoRoot, 'server/src/services/gateway.ts'), 'utf8');
    expect(gatewayClient).toContain('export async function gatewayCall');
    expect(gatewayClient).toContain('directPersistenceCall');
    expect(gatewayClient).toContain('/execute');
    expect(gatewayClient).toContain('GATEWAY_URL');
  });

  it('does not introduce Telnyx, PSTN, or call-control behavior in adapter source', () => {
    const forbiddenTelephony =
      /\bfrom\s+['"][^'"]*(?:telnyx|pstn|call-control|callControl)[^'"]*['"]|\b(?:telnyx|pstn|callControl|callControlId|createCallControl|startCall|placeCall|dialProspect)\b/i;
    const matches = matchingLines(adapterProductionFiles(), forbiddenTelephony);
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('does not introduce event persistence, outbox, replay, subscribers, or event API activation in orchestration source', () => {
    const forbiddenEventActivation =
      /\b(?:persistRuntimeEvent|persistEventEnvelope|saveRuntimeEvent|writeRuntimeEvent|eventOutbox|outboxRepository|replayRuntimeEvent|eventReplay|subscriberRegistry|publishToSubscriber|subscribeToRuntimeEvents|eventApi|activateEventApi)\b/i;
    const matches = matchingLines(orchestrationProductionFiles(), forbiddenEventActivation);
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('does not introduce Outcome or Guided Action persistence in orchestration source', () => {
    const forbiddenPersistence =
      /\b(?:persistOutcome|saveOutcome|writeOutcome|outcomeRepository|outcomeStore|persistGuidedAction|saveGuidedAction|writeGuidedAction|guidedActionRepository|guidedActionStore)\b/i;
    const matches = matchingLines(orchestrationProductionFiles(), forbiddenPersistence);
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('does not introduce automatic sending, calling, prospecting, or prospect scoring in adapters', () => {
    const forbiddenAutomation =
      /\b(?:sendEmail|sendSms|sendMessage|dispatchEmail|dispatchSms|automaticSend|automaticCall|placeCall|startCall|dialProspect|autoProspect|automatedProspecting|prospectingAutomation|scoreProspect|rankProspect|qualifyProspect|predictPlacement|predictIncome|calculateCommission)\s*\(/i;
    const matches = matchingLines(adapterProductionFiles(), forbiddenAutomation);
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('does not introduce agent response generation in adapters', () => {
    const forbiddenResponseGeneration =
      /\b(?:generateAgentResponse|createAgentResponse|draftAgentResponse|agentResponseText|responseGenerated:\s*true|agentResponseGenerated:\s*true)\b/i;
    const matches = matchingLines(adapterProductionFiles(), forbiddenResponseGeneration);
    expect(matches, matches.join('\n')).toEqual([]);
  });
});
