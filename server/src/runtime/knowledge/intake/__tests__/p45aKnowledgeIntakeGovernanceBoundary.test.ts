import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const intakeRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = resolve(intakeRoot, '../../../../..');

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
      if (statSync(absolutePath).isDirectory()) {
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

function intakeProductionFiles(): SourceFile[] {
  return collectFiles('server/src/runtime/knowledge/intake', ['.ts']);
}

function sourceWithoutComments(text: string): string {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/\s+\/\/.*$/gm, '');
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

describe('P4.5A static knowledge-intake governance boundary', () => {
  it('finds intake production source to scan', () => {
    expect(intakeProductionFiles().length).toBeGreaterThan(0);
  });

  it('does not import MongoDB, Neo4j, ChromaDB, GraphRAG, GridFS, PERSISTENCE, or persistence clients', () => {
    const forbidden =
      /\bfrom\s+['"][^'"]*(?:mongoose|mongodb|neo4j-driver|chromadb|gridfs)(?:$|\/|['"])|\bfrom\s+['"][^'"]*(?:graph-?rag|\/services\/PERSISTENCE|\/services\/persistence|\/persistence\/|tripleStack|quadstack)[^'"]*['"]/i;
    const matches = matchingCodeLines(intakeProductionFiles(), forbidden);
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('does not call direct store, PERSISTENCE, or triple/quad-stack write helpers', () => {
    const forbidden =
      /\b(?:new\s+MongoClient|mongoose\.connect|neo4j\.driver|new\s+ChromaClient|persistenceCall|tripleStackWrite|quadstack|graphRag|graphrag|GridFSBucket)\b/i;
    const matches = matchingCodeLines(intakeProductionFiles(), forbidden);
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('does not assemble Context Packets (Context Manager remains the sole assembler)', () => {
    const forbidden =
      /(?:\bbuildContextPacket\s*\(|\bprepareContextPacketFoundation\s*\(|\bContextPacketBuildInput\b|\bassembledBy:\s*['"](?:agent_runtime|knowledge_core)['"])/;
    const matches = matchingCodeLines(intakeProductionFiles(), forbidden);
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('mounts no routes and introduces no /api/runtime surface', () => {
    const forbidden = /(?:app\.use\s*\(|express\s*\(|Router\s*\(|['"`]\/api\/runtime\b|['"`]\/api\/)/;
    const matches = matchingCodeLines(intakeProductionFiles(), forbidden);
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('adds no LLM / dynamic generation / summarization', () => {
    const forbidden =
      /\b(?:anthropic|openai|claude|scriptmaker|generateText|summarize|summarise|completion|chatCompletion|embedText|createEmbedding|llm)\b/i;
    const matches = matchingCodeLines(intakeProductionFiles(), forbidden);
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('adds no voice / telephony wiring', () => {
    const forbidden = /\b(?:telnyx|whisper|speechToText|textToSpeech|transcribeAudio|voiceRuntime|browserVoice)\b/i;
    const matches = matchingCodeLines(intakeProductionFiles(), forbidden);
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('does not mutate raw source content (originalContent is authority)', () => {
    const forbidden = /\.originalContent\s*=/;
    const matches = matchingCodeLines(intakeProductionFiles(), forbidden);
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('keeps the .com surface free of knowledge-intake wiring', () => {
    const comMatches = matchingCodeLines(
      collectFiles('apps/com/src', ['.ts', '.tsx', '.js', '.jsx']),
      /(?:runtime\/knowledge\/intake|ingestRawKnowledgeSource|chunkParsedDocument|parseRawKnowledgeSource)/i,
    );
    expect(comMatches, comMatches.join('\n')).toEqual([]);
  });

  it('is not imported by any route or the server entrypoint (inert utility)', () => {
    const routeAndEntry = [
      ...collectFiles('server/src/routes', ['.ts']),
      {
        relativePath: 'server/src/index.ts',
        text: readFileSync(resolve(repoRoot, 'server/src/index.ts'), 'utf8'),
      },
    ];
    const matches = matchingCodeLines(routeAndEntry, /runtime\/knowledge\/intake/);
    expect(matches, matches.join('\n')).toEqual([]);
  });
});
