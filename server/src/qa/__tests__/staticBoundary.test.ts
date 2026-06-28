import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');

interface SourceFile {
  relativePath: string;
  text: string;
}

function normalizePath(path: string): string {
  return path.split(sep).join('/');
}

function collectSourceFiles(root: string): SourceFile[] {
  const files: SourceFile[] = [];

  function walk(current: string): void {
    for (const entry of readdirSync(current)) {
      if (
        entry === 'node_modules' ||
        entry === 'dist' ||
        entry === '.git' ||
        entry === '__tests__'
      ) {
        continue;
      }

      const absolutePath = resolve(current, entry);
      const stats = statSync(absolutePath);
      if (stats.isDirectory()) {
        walk(absolutePath);
        continue;
      }

      if (!/\.(ts|tsx|mts|cts|js|jsx)$/.test(entry)) continue;

      files.push({
        relativePath: normalizePath(relative(repoRoot, absolutePath)),
        text: readFileSync(absolutePath, 'utf8'),
      });
    }
  }

  walk(root);
  return files;
}

function matchingLines(file: SourceFile, pattern: RegExp): string[] {
  return file.text
    .split(/\r?\n/)
    .map((line, index) => ({ line, lineNumber: index + 1 }))
    .filter(({ line }) => pattern.test(line))
    .map(({ line, lineNumber }) => `${file.relativePath}:${lineNumber}: ${line.trim()}`);
}

function expectNoMatches(files: SourceFile[], pattern: RegExp): void {
  const matches = files.flatMap((file) => matchingLines(file, pattern));
  expect(matches, matches.join('\n')).toEqual([]);
}

describe('Sprint 1 static boundary checks', () => {
  const serverFiles = collectSourceFiles(resolve(repoRoot, 'server/src'));
  const comFiles = collectSourceFiles(resolve(repoRoot, 'apps/com/src'));
  const sharedRuntimeFiles = collectSourceFiles(resolve(repoRoot, 'packages/shared/src/runtime'));

  it('prevents direct agent access to MongoDB, Neo4j, or ChromaDB clients/adapters', () => {
    const agentRuntimeFiles = [
      ...serverFiles.filter((file) => file.relativePath.includes('/domain/agents/')),
      ...serverFiles.filter((file) => file.relativePath.includes('/runtime/agents/')),
      ...serverFiles.filter((file) => file.relativePath.endsWith('/routes/agents.ts')),
      ...sharedRuntimeFiles.filter((file) => file.relativePath.includes('/runtime/agents')),
    ];

    expect(agentRuntimeFiles.length).toBeGreaterThan(0);
    expectNoMatches(
      agentRuntimeFiles,
      /\bfrom\s+['"](?:mongoose|mongodb|neo4j-driver|chromadb|.*\/persistence\/(?:mongo|neo4j|chroma)\/.*|.*\/services\/persistence\/.*)['"]|new\s+MongoClient\b|mongoose\.connect\b|neo4j\.driver\b|ChromaClient\b/,
    );
  });

  it('preserves the Gateway HTTP fallback path while direct persistence is enabled', () => {
    const gateway = serverFiles.find((file) => file.relativePath === 'server/src/services/gateway.ts');

    expect(gateway).toBeDefined();
    expect(gateway?.text).toContain('fetch(`${env.GATEWAY_URL}/execute`');
    expect(gateway?.text).toContain('body: JSON.stringify({ tool, action, params })');
    expect(gateway?.text).toContain('export class GatewayError');
    expect(gateway?.text).toContain('if (directStore && isDirect(directStore))');
  });

  it('keeps Browser Voice/Text imports and mounts out of the .com prospect surface', () => {
    expectNoMatches(
      comFiles,
      /\b(browser-runtime|BrowserVoice|BrowserText|browser_voice|browser_text|voice\/text|browser-voice|browser-text)\b/i,
    );
  });

  it('keeps Telnyx and PSTN dependencies out of internal browser voice/text runtime files', () => {
    const browserRuntimeFiles = [
      ...sharedRuntimeFiles.filter((file) => file.relativePath.endsWith('/runtime/browser-runtime.ts')),
      ...serverFiles.filter((file) =>
        /browser[-/]?(voice|text|runtime)|voice[-/]text/i.test(file.relativePath) ||
        /BrowserVoice|BrowserText|browser_voice|browser_text/.test(file.text),
      ),
    ];

    expect(browserRuntimeFiles.length).toBeGreaterThan(0);
    expectNoMatches(
      browserRuntimeFiles,
      /\bfrom\s+['"][^'"]*(?:telnyx|verifyTelnyxWebhook)[^'"]*['"]|\bTELNYX_|\bverifyTelnyxWebhook\b|\b(?:sendSms|makeCall|callControl|CallControl|pstnCall|PstnCall)\b/,
    );
  });
});
