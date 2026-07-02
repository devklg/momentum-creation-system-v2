import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// P4.6 static governance. The shared server/src/qa/__tests__/staticBoundary.test.ts scans the
// agent-runtime dirs only, not server/src/runtime/context/. This gives the language-aware
// retrieval files their own CI-enforced boundary.

const contextRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const P46_PRODUCTION_FILES = ['languageAwareRetrieval.ts', 'contextManagerRetrievalAdapter.ts'] as const;

function stripComments(text: string): string {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/\s+\/\/.*$/gm, '');
}

function codeLinesMatching(fileName: string, pattern: RegExp): string[] {
  const text = stripComments(readFileSync(resolve(contextRoot, fileName), 'utf8'));
  return text
    .split(/\r?\n/)
    .map((line, index) => ({ line, lineNumber: index + 1 }))
    .filter(({ line }) => pattern.test(line))
    .map(({ line, lineNumber }) => `${fileName}:${lineNumber}: ${line.trim()}`);
}

describe('P4.6 static language-aware-retrieval governance boundary', () => {
  it('imports no store, PERSISTENCE, persistence, or LLM client', () => {
    const forbidden =
      /\bfrom\s+['"][^'"]*(?:mongoose|mongodb|neo4j-driver|chromadb|gridfs)(?:$|\/|['"])|\bfrom\s+['"][^'"]*(?:graph-?rag|\/services\/PERSISTENCE|\/services\/persistence|\/persistence\/|tripleStack|quadstack|anthropic|openai)[^'"]*['"]/i;
    const matches = P46_PRODUCTION_FILES.flatMap((file) => codeLinesMatching(file, forbidden));
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('calls no direct store, PERSISTENCE, translation-engine, or LLM helper', () => {
    const forbidden =
      /\b(?:new\s+MongoClient|mongoose\.connect|neo4j\.driver|new\s+ChromaClient|persistenceCall|tripleStackWrite|graphRag|graphrag|translateText|machineTranslate|generateText|createCompletion|chatCompletion|embedText|createEmbedding)\b/i;
    const matches = P46_PRODUCTION_FILES.flatMap((file) => codeLinesMatching(file, forbidden));
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('does not assemble a Context Packet (Context Manager remains the sole assembler)', () => {
    const forbidden = /(?:\bbuildContextPacket\s*\(|\bContextPacketBuildInput\b|\bassembledBy:\s*['"](?:agent_runtime|knowledge_core)['"])/;
    const matches = P46_PRODUCTION_FILES.flatMap((file) => codeLinesMatching(file, forbidden));
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('the resolver never mutates a reference (selects/marks only, never translates)', () => {
    const forbidden = /reference\.(?:translationStatus|language|status|sourceId|knowledgeId)\s*=[^=]/;
    const matches = codeLinesMatching('languageAwareRetrieval.ts', forbidden);
    expect(matches, matches.join('\n')).toEqual([]);
  });
});
