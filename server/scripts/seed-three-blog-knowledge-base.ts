import { readFile, writeFile, stat } from 'node:fs/promises';
import path from 'node:path';
import {
  createKevinApprovedKnowledgeSource,
} from '../src/services/knowledge/approvedKnowledgeStore.js';
import { ensureChromaCollections } from '../src/services/chromaCollections.js';
import { persistenceCall } from '../src/services/persistence/dispatch.js';
import {
  closeDirectPersistence,
  connectDirectPersistence,
} from '../src/services/persistence/index.js';
import { extractKnowledgeFile } from '../src/runtime/knowledge/knowledgeFileExtraction.js';
import type { McsAgentKey } from '@momentum/shared/runtime';

interface MongoQueryResult {
  count?: number;
  documents?: Array<Record<string, unknown>>;
}

// THREE International public blog corpus (blog.threeinternational.com/en).
// Captured 2026-07-08; THREE-corporate authored, compliant, Kevin-approved, all agents.
// Provenance: authorityRef + sourceRef point at the LIVE blog URL; local markdown snapshot
// is the durable copy; SHA-256 in PROVENANCE_MANIFEST.md detects drift.
const BLOG_ROOT = 'D:/momentum-creation-system-v2/knowledge/three-blog/extracted';
const SLUGS_FILE = 'D:/momentum-creation-system-v2/knowledge/three-blog/all-slugs-complete.json';
const SOURCEID_MAP = 'D:/momentum-creation-system-v2/knowledge/three-blog/slug-to-sourceid.json';
const BASE_URL = 'https://blog.threeinternational.com/en/';
const CREATED_BY = 'TMAG-01';
const AUTHORITY_BY = 'Kevin L. Gardner';
const INGESTED_AT = new Date().toISOString();

// All agents ground on THREE-corporate content.
const ALL_AGENTS: McsAgentKey[] = ['steve_success', 'michael_magnificent', 'ivory'];

// Junk sitemap entries to never ingest (test page + back-office stub).
const EXCLUDE = new Set(['test', 'three-wall']);

function titleFromMarkdown(md: string, slug: string): string {
  const h1 = (md.match(/^#\s+(.+)$/m) || [])[1];
  if (h1 && h1.trim()) return h1.trim();
  return slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

async function alreadyIngested(sourceRef: string): Promise<boolean> {
  const result = await persistenceCall<MongoQueryResult>('mongodb', 'query', {
    database: 'momentum',
    collection: 'mcs_knowledge_sources',
    filter: { sourceRef },
    limit: 1,
  });
  return (result.count ?? result.documents?.length ?? 0) > 0;
}

async function main(): Promise<void> {
  await connectDirectPersistence();
  await ensureChromaCollections();

  const slugs: string[] = JSON.parse(await readFile(SLUGS_FILE, 'utf8'));
  const report = { created: 0, skipped: 0, failed: 0, excluded: 0, chunks: 0 };
  const sourceIdMap: Record<string, { url: string; sourceId: string; chunks: number }> = {};

  try {
    for (const slug of slugs) {
      if (EXCLUDE.has(slug)) {
        report.excluded += 1;
        continue;
      }
      const url = BASE_URL + slug;
      const snapPath = path.join(BLOG_ROOT, slug + '.md');
      const sourceRef = url; // live URL is the canonical source reference for web content

      if (await alreadyIngested(sourceRef)) {
        report.skipped += 1;
        console.log(`[three-blog] skip existing ${slug}`);
        continue;
      }

      try {
        const bytes = await readFile(snapPath);
        const info = await stat(snapPath);
        const md = bytes.toString('utf8');
        const title = titleFromMarkdown(md, slug);
        const extracted = await extractKnowledgeFile({ filename: snapPath, bytes });

        const result = await createKevinApprovedKnowledgeSource({
          title,
          content: extracted.content,
          createdBy: CREATED_BY,
          authorityKind: 'kevin_approved',
          authorityBy: AUTHORITY_BY,
          authorityRef: `three-blog:${slug}`,
          sourceType: 'owned_text',
          sourceRef,
          domain: 'product' as never,
          language: 'en',
          format: extracted.kind,
          topicTags: ['three-corporate', 'blog', 'wellness', 'product-education', slug],
          agentScopes: ALL_AGENTS,
          upload: {
            filename: slug + '.md',
            originalBytes: info.size,
            extractedCharacters: extracted.content.length,
            sourceRef,
          },
          createdAt: INGESTED_AT,
        });

        report.created += 1;
        report.chunks += result.chunkCount;
        sourceIdMap[slug] = { url, sourceId: result.sourceId, chunks: result.chunkCount };
        console.log(`[three-blog] created ${slug} (${result.chunkCount} chunks) sourceId=${result.sourceId}`);
      } catch (err) {
        report.failed += 1;
        console.error(`[three-blog] failed ${slug}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    // merge with any prior map so re-runs accumulate
    let prior: Record<string, unknown> = {};
    try { prior = JSON.parse(await readFile(SOURCEID_MAP, 'utf8')); } catch { /* first run */ }
    await writeFile(SOURCEID_MAP, JSON.stringify({ ...prior, ...sourceIdMap }, null, 2), 'utf8');

    console.log(
      `[three-blog] complete created=${report.created} skipped=${report.skipped} ` +
        `excluded=${report.excluded} failed=${report.failed} chunks=${report.chunks}`,
    );
    if (report.failed > 0) process.exitCode = 1;
  } finally {
    await closeDirectPersistence();
  }
}

main().catch(async (err) => {
  console.error(`[three-blog] fatal: ${err instanceof Error ? err.stack ?? err.message : String(err)}`);
  await closeDirectPersistence();
  process.exitCode = 1;
});
