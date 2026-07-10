import { readFile, readdir, appendFile } from 'node:fs/promises';
import path from 'node:path';
import {
  createKevinApprovedKnowledgeSource,
  KNOWLEDGE_SOURCE_COLLECTION,
} from '../src/services/knowledge/approvedKnowledgeStore.js';
import { ensureChromaCollections } from '../src/services/chromaCollections.js';
import { persistenceCall } from '../src/services/persistence/dispatch.js';
import {
  closeDirectPersistence,
  connectDirectPersistence,
} from '../src/services/persistence/index.js';
import type { McsAgentKey } from '@momentum/shared/runtime';

interface MongoQueryResult {
  count?: number;
  documents?: Array<Record<string, unknown>>;
}

// THREE International blog corpus — public wellness/product/science articles.
// Source: https://blog.threeinternational.com/en/all (public, no auth). Captured 2026-07-08.
// Compliant THREE-authored corporate content. Kevin-approved, all agents.
const SNAP_DIR = 'D:/momentum-creation-system-v2/knowledge/three-blog/extracted';
const MANIFEST = 'D:/momentum-creation-system-v2/knowledge/three-blog/PROVENANCE_MANIFEST.md';
const BASE_URL = 'https://blog.threeinternational.com/en/';
const CREATED_BY = 'TMAG-01';
const AUTHORITY_BY = 'Kevin L. Gardner';
const INGESTED_AT = new Date().toISOString();
const ALL_AGENTS: McsAgentKey[] = ['steve_success', 'michael_magnificent', 'ivory'];

// lightweight topic tagging from slug keywords
function tagsFor(slug: string): string[] {
  const t = new Set<string>(['three-corporate', 'blog', 'wellness']);
  const s = slug.toLowerCase();
  if (s.includes('glp-three') || s.includes('glp')) t.add('glp-three');
  if (s.includes('mbc-267') || s.includes('peptide')) t.add('mbc-267');
  if (s.includes('metabol')) t.add('metabolic-health');
  if (s.includes('collagen') || s.includes('skin') || s.includes('hydrat')) t.add('skin-collagen');
  if (s.includes('kynetik') || s.includes('energy') || s.includes('hydrat')) t.add('kynetik-energy');
  if (s.includes('detox') || s.includes('cleanse')) t.add('detox-cleanse');
  if (s.includes('immune') || s.includes('gut') || s.includes('probiotic') || s.includes('digest')) t.add('gut-immune');
  if (s.includes('science') || s.includes('clinical') || s.includes('study') || s.includes('ingredient') || s.includes('absorption')) t.add('product-science');
  if (s.includes('business') || s.includes('social-media') || s.includes('grow')) t.add('business-building');
  return [...t];
}

function titleFromMarkdown(md: string, slug: string): string {
  const h = (md.match(/^#\s+(.+)$/m) || [])[1];
  return (h || slug.replace(/-/g, ' ')).trim();
}

function sourceUrlFromMarkdown(md: string, fallbackSlug: string): string {
  const source = (md.match(/^Source:\s+(https?:\/\/\S+)\s*$/m) || [])[1];
  if (source) return source.trim();
  return BASE_URL + fallbackSlug.replace(/__/g, '/');
}

async function alreadyIngested(sourceRef: string): Promise<boolean> {
  const result = await persistenceCall<MongoQueryResult>('mongodb', 'query', {
    database: 'momentum',
    collection: KNOWLEDGE_SOURCE_COLLECTION,
    filter: { sourceRef },
    limit: 1,
  });
  return (result.count ?? result.documents?.length ?? 0) > 0;
}

async function main(): Promise<void> {
  await connectDirectPersistence();
  await ensureChromaCollections();

  const report = { created: 0, skipped: 0, failed: 0, chunks: 0 };
  const manifestRows: string[] = [];

  try {
    const files = (await readdir(SNAP_DIR)).filter((f) => f.endsWith('.md')).sort();
    for (const file of files) {
      const slug = file.replace(/\.md$/, '');
      const fullPath = path.join(SNAP_DIR, file);
      const md = await readFile(fullPath, 'utf8');
      const liveUrl = sourceUrlFromMarkdown(md, slug);
      const sourceRef = `url:${liveUrl}`;

      if (await alreadyIngested(sourceRef)) {
        report.skipped += 1;
        console.log(`[three-blog] skip existing ${slug}`);
        continue;
      }

      try {
        const title = titleFromMarkdown(md, slug);
        // strip our provenance header (everything up to the first '---' rule) for clean content
        const body = md.split(/\n---\n/).slice(1).join('\n---\n').trim() || md;

        const result = await createKevinApprovedKnowledgeSource({
          title,
          content: body,
          createdBy: CREATED_BY,
          authorityKind: 'kevin_approved',
          authorityBy: AUTHORITY_BY,
          authorityRef: liveUrl,
          sourceType: 'owned_text',
          sourceRef,
          domain: 'training',
          language: 'en',
          format: 'markdown',
          topicTags: tagsFor(slug),
          agentScopes: ALL_AGENTS,
          upload: {
            filename: file,
            originalBytes: Buffer.byteLength(md, 'utf8'),
            extractedCharacters: body.length,
            sourceRef,
          },
          createdAt: INGESTED_AT,
        });

        report.created += 1;
        report.chunks += result.chunkCount;
        manifestRows.push(`INGESTED | ${slug} | ${liveUrl} | ${result.source.sourceId} | ${result.chunkCount} chunks`);
        console.log(`[three-blog] created ${title} (${result.chunkCount} chunks) -> ${result.source.sourceId}`);
      } catch (err) {
        report.failed += 1;
        console.error(`[three-blog] failed ${slug}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    if (manifestRows.length) {
      await appendFile(
        MANIFEST,
        `\n## Ingest results (${INGESTED_AT})\n\n` + manifestRows.join('\n') + '\n',
        'utf8',
      );
    }

    console.log(
      `[three-blog] complete created=${report.created} skipped=${report.skipped} ` +
        `failed=${report.failed} chunks=${report.chunks}`,
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
