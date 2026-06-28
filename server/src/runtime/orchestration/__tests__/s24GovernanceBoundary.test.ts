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

function orchestrationProductionFiles(): SourceFile[] {
  return collectFiles('server/src/runtime/orchestration', ['.ts']);
}

function sourceWithoutComments(text: string): string {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/\s+\/\/.*$/gm, '');
}

function importLines(file: SourceFile): Array<{ line: string; lineNumber: number }> {
  return sourceWithoutComments(file.text)
    .split(/\r?\n/)
    .map((line, index) => ({ line, lineNumber: index + 1 }))
    .filter(({ line }) => /^\s*import\b/.test(line));
}

function matchingCodeLines(files: SourceFile[], pattern: RegExp): string[] {
  return files.flatMap((file) =>
    sourceWithoutComments(file.text)
      .split(/\r?\n/)
      .map((line, index) => ({ line, lineNumber: index + 1 }))
      .filter(({ line }) => pattern.test(line))
      .map(({ line, lineNumber }) => `${file.relativePath}:${lineNumber}: ${line.trim()}`),
  );
}

function matchingImportLines(pattern: RegExp): string[] {
  return orchestrationProductionFiles().flatMap((file) =>
    importLines(file)
      .filter(({ line }) => pattern.test(line))
      .map(({ line, lineNumber }) => `${file.relativePath}:${lineNumber}: ${line.trim()}`),
  );
}

describe('S2.4 static orchestration governance boundary', () => {
  it('does not import MongoDB, Neo4j, ChromaDB, GraphRAG, persistence, Gateway, or retrieval clients', () => {
    const forbiddenImports =
      /\bfrom\s+['"][^'"]*(?:^|\/|\\|@)(?:mongoose|mongodb|neo4j-driver|chromadb)(?:$|\/|\\|['"])|\bfrom\s+['"][^'"]*(?:graph-?rag|\/services\/gateway|\/services\/persistence|\/persistence\/|\/services\/[^'"]*adapter|retrieval|gatewayFallback|gateway-fallback)[^'"]*['"]/i;
    const matches = matchingImportLines(forbiddenImports);
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('does not call direct store, GraphRAG, Gateway fallback, adapter, or raw retrieval helpers', () => {
    const forbiddenCalls =
      /\b(?:new\s+MongoClient|mongoose\.connect|neo4j\.driver|new\s+ChromaClient|gatewayCall|tripleStackWrite|mongoAdapter|neo4jAdapter|chromaAdapter|graphRag|graphrag|gatewayFallback|rawRetrieval|retrievalHelper|directRetrieval)\b/i;
    const matches = matchingCodeLines(orchestrationProductionFiles(), forbiddenCalls);
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('does not assemble Context Packets inside orchestration production source', () => {
    const forbiddenAssembly =
      /(?:\bbuildContextPacket\s*\(|\bprepareContextPacketFoundation\s*\(|\bContextPacketBuildInput\b|\bassembledBy:\s*['"]agent_runtime['"])/;
    const matches = matchingCodeLines(orchestrationProductionFiles(), forbiddenAssembly);
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('keeps /api/runtime unmounted in orchestration and the server entrypoint', () => {
    const orchestrationMatches = matchingCodeLines(
      orchestrationProductionFiles(),
      /(?:app\.use\s*\(|express\s*\(|['"`]\/api\/runtime\b)/,
    );
    const serverIndexMatches = matchingCodeLines(
      [
        {
          relativePath: 'server/src/index.ts',
          text: readFileSync(resolve(repoRoot, 'server/src/index.ts'), 'utf8'),
        },
      ],
      /(?:app\.use\s*\(\s*['"`]\/api\/runtime\b|['"`]\/api\/runtime\b)/,
    );

    const matches = [...orchestrationMatches, ...serverIndexMatches];
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('keeps the .com surface free of S2 orchestration runtime wiring', () => {
    const comMatches = matchingCodeLines(
      collectFiles('apps/com/src', ['.ts', '.tsx', '.js', '.jsx']),
      /(?:runtime\/orchestration|agent_runtime_orchestrator|requestContextPacketForTurn|composeOrchestrationTurn|\/api\/runtime\b|context\.packet\.)/i,
    );
    expect(comMatches, comMatches.join('\n')).toEqual([]);
  });

  it('preserves the Gateway fallback client outside orchestration', () => {
    const gatewayClient = readFileSync(resolve(repoRoot, 'server/src/services/gateway.ts'), 'utf8');
    expect(gatewayClient).toContain('export async function gatewayCall');
    expect(gatewayClient).toContain('directPersistenceCall');
    expect(gatewayClient).toContain('/execute');
    expect(gatewayClient).toContain('GATEWAY_URL');
  });

  it('does not introduce Telnyx, PSTN, or call-control wiring in orchestration', () => {
    // S2.15 closeout correction: the bare `callControl` identifier was removed
    // from this wiring scanner. S2.15 added `'callControl'` to the response
    // contract's FORBIDDEN_FIELD_ALIASES blocklist — a defensive string literal
    // whose purpose is to *reject* a call-control field, not wire telephony.
    // Real call-control wiring is still blocked here via telephony import paths
    // and the specific wiring symbols (callControlId/createCallControl/startCall/
    // placeCall/dialProspect). See S2.15 Verification Closeout report.
    const forbiddenTelephony =
      /\bfrom\s+['"][^'"]*(?:telnyx|pstn|call-control|callControl)[^'"]*['"]|\b(?:telnyx|pstn|callControlId|createCallControl|startCall|placeCall|dialProspect)\b/i;
    const matches = matchingCodeLines(orchestrationProductionFiles(), forbiddenTelephony);
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('does not introduce event persistence, outbox, replay, subscribers, or event API activation code', () => {
    const forbiddenEventActivation =
      /\b(?:persistRuntimeEvent|persistEventEnvelope|saveRuntimeEvent|writeRuntimeEvent|eventOutbox|outboxRepository|replayRuntimeEvent|eventReplay|subscriberRegistry|publishToSubscriber|subscribeToRuntimeEvents|eventApi|activateEventApi)\b/i;
    const matches = matchingCodeLines(orchestrationProductionFiles(), forbiddenEventActivation);
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('does not introduce Outcome or Guided Action persistence code', () => {
    const forbiddenPersistence =
      /\b(?:persistOutcome|saveOutcome|writeOutcome|outcomeRepository|outcomeStore|persistGuidedAction|saveGuidedAction|writeGuidedAction|guidedActionRepository|guidedActionStore)\b/i;
    const matches = matchingCodeLines(orchestrationProductionFiles(), forbiddenPersistence);
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('does not introduce automatic sending, calling, or prospecting execution code', () => {
    const forbiddenAutomation =
      /\b(?:sendEmail|sendSms|sendMessage|dispatchEmail|dispatchSms|automaticSend|automaticCall|placeCall|startCall|dialProspect|autoProspect|automatedProspecting|prospectingAutomation)\s*\(/i;
    const matches = matchingCodeLines(orchestrationProductionFiles(), forbiddenAutomation);
    expect(matches, matches.join('\n')).toEqual([]);
  });
});
