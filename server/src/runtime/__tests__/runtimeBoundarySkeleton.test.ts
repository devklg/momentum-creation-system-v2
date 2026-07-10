import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { backendRuntimeBoundaries } from '../index.js';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
const runtimeRoot = resolve(repoRoot, 'server/src/runtime');

/**
 * ACR-0012 / Knowledge Evolution Lane A: the knowledge-evolution runtime's
 * `persistence/` subtree is the SANCTIONED direct-persistence access point for
 * that runtime — canonical Mongo models/repositories/indexes via the app's
 * direct dispatch (spec §27). It is intentionally exempt from the skeleton
 * "no direct stores" rule below; the five inert runtime skeletons stay fully
 * guarded. Retrieval activation, route handlers, and live Chroma/Neo4j coupling
 * remain out of scope for Lane A and are not exempted anywhere.
 *
 * ACR-0012 / Knowledge Evolution Lane C: the `indexing/` and `graph/` subtrees
 * are the SANCTIONED Chroma reindex and Neo4j graph-sync coordination layers
 * (spec Lane C). They coordinate only through the app's governed direct dispatch
 * (persistenceCall) — no raw drivers, no route handlers, no GraphRAG activation,
 * no Context Manager live flags — so they are exempt on the same basis as
 * `persistence/`. The five inert runtime skeletons stay fully guarded.
 */
const PERSISTENCE_EXEMPT_DIRS = [
  'server/src/runtime/knowledge-evolution/persistence',
  'server/src/runtime/knowledge-evolution/indexing',
  'server/src/runtime/knowledge-evolution/graph',
];

function normalizePath(path: string): string {
  return path.split(sep).join('/');
}

function isExempt(absolutePath: string): boolean {
  const rel = normalizePath(relative(repoRoot, absolutePath));
  return PERSISTENCE_EXEMPT_DIRS.some((dir) => rel === dir || rel.startsWith(`${dir}/`));
}

function collectRuntimeFiles(): Array<{ relativePath: string; text: string }> {
  const files: Array<{ relativePath: string; text: string }> = [];

  function walk(current: string): void {
    for (const entry of readdirSync(current)) {
      if (entry === '__tests__') continue;

      const absolutePath = resolve(current, entry);
      const stats = statSync(absolutePath);

      if (stats.isDirectory()) {
        if (isExempt(absolutePath)) continue;
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

  it('keeps runtime skeleton files away from direct stores, direct adapters, and persistence dispatch clients', () => {
    const forbidden =
      /\bfrom\s+['"](?:mongoose|mongodb|neo4j-driver|chromadb|.*\/services\/PERSISTENCE\.js|.*\/services\/persistence\/.*)['"]|new\s+MongoClient\b|mongoose\.connect\b|neo4j\.driver\b|ChromaClient\b|persistenceCall\b|tripleStackWrite\b/;
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
