import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// P4.11 static canary tripwire over the whole Context Manager retrieval layer. Complements the
// behavioral scenarios in retrievalCanary.test.ts with standing structural guards.

const contextRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
// context → runtime → src → server → repo root
const repoRoot = resolve(contextRoot, '../../../..');

type SourceFile = { readonly relativePath: string; readonly text: string };

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
      if (statSync(absolutePath).isDirectory()) { walk(absolutePath); continue; }
      if (!extensions.some((extension) => entry.endsWith(extension))) continue;
      files.push({ relativePath: normalizePath(relative(repoRoot, absolutePath)), text: readFileSync(absolutePath, 'utf8') });
    }
  }
  walk(root);
  return files;
}

function stripComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\s+\/\/.*$/gm, '');
}

function matches(files: SourceFile[], pattern: RegExp): string[] {
  return files.flatMap((file) =>
    stripComments(file.text)
      .split(/\r?\n/)
      .map((line, index) => ({ line, lineNumber: index + 1 }))
      .filter(({ line }) => pattern.test(line))
      .map(({ line, lineNumber }) => `${file.relativePath}:${lineNumber}: ${line.trim()}`),
  );
}

const contextFiles = () => collectFiles('server/src/runtime/context', ['.ts']);

// The P4.4–P4.10 retrieval modules — none of these may assemble a Context Packet.
const RETRIEVAL_MODULES = [
  'contextManagerRetrievalAdapter.ts',
  'languageAwareRetrieval.ts',
  'freshnessGuard.ts',
  'retrievalObservability.ts',
  'safeFallback.ts',
  'nextTrainingStep.ts',
  'approvedKnowledgeQueryContract.ts',
];

describe('P4.11 static retrieval-canary governance boundary', () => {
  it('the scans target non-empty directories (guards against a vacuous pass)', () => {
    expect(contextFiles().length).toBeGreaterThan(0);
    expect(collectFiles('apps/com/src', ['.ts', '.tsx', '.js', '.jsx']).length).toBeGreaterThan(0);
  });

  it('the context retrieval layer imports no store, PERSISTENCE, or LLM client', () => {
    const forbidden =
      /\bfrom\s+['"][^'"]*(?:mongoose|mongodb|neo4j-driver|chromadb|gridfs)(?:$|\/|['"])|\bfrom\s+['"][^'"]*(?:graph-?rag|\/services\/PERSISTENCE|\/services\/persistence|\/persistence\/|tripleStack|quadstack|anthropic|openai)[^'"]*['"]/i;
    const found = matches(contextFiles(), forbidden);
    expect(found, found.join('\n')).toEqual([]);
  });

  it('makes no direct store / PERSISTENCE / triple-stack write call', () => {
    // Call/instantiation syntax only — not prose. The runtime-rule guardrail STRINGS in
    // contextManager.ts legitimately name MongoDB/Neo4j/ChromaDB/GraphRAG/PERSISTENCE as
    // prohibitions; those must not trip this check.
    const forbidden =
      /\bnew\s+MongoClient\b|\bmongoose\.connect\b|\bneo4j\.driver\b|\bnew\s+ChromaClient\b|\bpersistenceCall\s*\(|\btripleStackWrite\s*\(|\bquadstack\.\w+\s*\(|\bnew\s+GridFSBucket\b/i;
    const found = matches(contextFiles(), forbidden);
    expect(found, found.join('\n')).toEqual([]);
  });

  it('adds no LLM / dynamic generation', () => {
    const forbidden = /\b(?:anthropic|openai|generateText|createCompletion|chatCompletion|embedText|createEmbedding|\bllm\b)\b/i;
    const found = matches(contextFiles(), forbidden);
    expect(found, found.join('\n')).toEqual([]);
  });

  it('the retrieval modules neither call nor import the packet assembler (Context Manager sole assembler)', () => {
    const files = contextFiles().filter((file) => RETRIEVAL_MODULES.some((name) => file.relativePath.endsWith(name)));
    expect(files.length).toBe(RETRIEVAL_MODULES.length);
    // No direct call...
    const calls = matches(files, /\bbuildContextPacket\s*\(/);
    expect(calls, calls.join('\n')).toEqual([]);
    // ...and no import of buildContextPacket, so a retrieval module cannot even reference it.
    const imports = files.flatMap((file) =>
      stripComments(file.text)
        .split(/\r?\n/)
        .filter((line) => /^\s*import\b/.test(line) && /\bbuildContextPacket\b/.test(line))
        .map((line) => `${file.relativePath}: ${line.trim()}`),
    );
    expect(imports, imports.join('\n')).toEqual([]);
  });

  it('mounts no route and introduces no /api/runtime surface in the context layer', () => {
    const found = matches(contextFiles(), /(?:app\.use\s*\(|express\s*\(|Router\s*\(|['"`]\/api\/runtime\b|['"`]\/api\/)/);
    expect(found, found.join('\n')).toEqual([]);
  });

  it('keeps /api/runtime out of the server entrypoint', () => {
    const indexPath = resolve(repoRoot, 'server/src/index.ts');
    // ACR-0012 / Knowledge Evolution Lane D: the approved /api/runtime/knowledge-evolution mount (spec §25) is permitted; every other /api/runtime family stays forbidden.
    const found = matches([{ relativePath: 'server/src/index.ts', text: readFileSync(indexPath, 'utf8') }], /['"`]\/api\/runtime(?!\/knowledge-evolution)\b/);
    expect(found, found.join('\n')).toEqual([]);
  });

  it('keeps the .com surface free of Context Manager retrieval wiring', () => {
    const comMatches = matches(
      collectFiles('apps/com/src', ['.ts', '.tsx', '.js', '.jsx']),
      /(?:runtime\/context|contextManagerRetrievalAdapter|retrieveApprovedKnowledge|resolveNextTrainingStep|buildContextPacket)/i,
    );
    expect(comMatches, comMatches.join('\n')).toEqual([]);
  });
});
