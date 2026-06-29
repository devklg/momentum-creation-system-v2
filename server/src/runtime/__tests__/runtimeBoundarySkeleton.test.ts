import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { backendRuntimeBoundaries } from '../index.js';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
const runtimeRoot = resolve(repoRoot, 'server/src/runtime');

function normalizePath(path: string): string {
  return path.split(sep).join('/');
}

function collectRuntimeFiles(): Array<{ relativePath: string; text: string }> {
  const files: Array<{ relativePath: string; text: string }> = [];

  function walk(current: string): void {
    for (const entry of readdirSync(current)) {
      if (entry === '__tests__') continue;

      const absolutePath = resolve(current, entry);
      const stats = statSync(absolutePath);

      if (stats.isDirectory()) {
        walk(absolutePath);
        continue;
      }

      if (!entry.endsWith('.ts')) continue;

      files.push({
        relativePath: normalizePath(relative(repoRoot, absolutePath)),
        text: readFileSync(absolutePath, 'utf8'),
      });
    }
  }

  walk(runtimeRoot);
  return files;
}

describe('backend runtime boundary skeleton', () => {
  it('exports the five required inert runtime boundaries', () => {
    expect(backendRuntimeBoundaries.map((boundary) => boundary.key)).toEqual([
      'knowledge_core',
      'context_manager',
      'agent_runtime',
      'event_runtime',
      'browser_voice_text_runtime',
    ]);

    for (const boundary of backendRuntimeBoundaries) {
      expect(boundary.status).toBe('skeleton_only');
      expect(boundary.activated).toBe(false);
      expect(boundary.apiMounted).toBe(false);
      expect(boundary.behaviorEnabled).toBe(false);
      expect(boundary.persistenceAccess).toBe('service_boundary_only');
      expect(boundary.sharedContractImport).toBe('@momentum/shared/runtime');
    }
  });

  it('keeps runtime skeleton files away from direct stores, direct adapters, and Gateway clients', () => {
    const forbidden =
      /\bfrom\s+['"](?:mongoose|mongodb|neo4j-driver|chromadb|.*\/services\/gateway\.js|.*\/services\/persistence\/.*)['"]|new\s+MongoClient\b|mongoose\.connect\b|neo4j\.driver\b|ChromaClient\b|gatewayCall\b|tripleStackWrite\b/;
    const matches = collectRuntimeFiles().flatMap((file) =>
      file.text
        .split(/\r?\n/)
        .map((line, index) => ({ line, lineNumber: index + 1 }))
        .filter(({ line }) => forbidden.test(line))
        .map(({ line, lineNumber }) => `${file.relativePath}:${lineNumber}: ${line.trim()}`),
    );

    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('does not mount or import an /api/runtime route family', () => {
    const indexText = readFileSync(resolve(repoRoot, 'server/src/index.ts'), 'utf8');

    expect(indexText).not.toMatch(/app\.use\(\s*['"`]\/api\/runtime\b/);
    // S3.4: target the forbidden bare `/api/runtime` route family precisely —
    // an import from a `runtime` route module or a bare `runtimeRoutes` binding.
    // The approved gated `/api/michael-runtime` route (michaelRuntimeRoutes from
    // ./routes/michael-runtime.js) is intentionally NOT matched.
    expect(indexText).not.toMatch(/from\s+['"][^'"]*\/runtime\.js['"]|\bruntimeRoutes\b/i);
  });
});
