import { readFile, readdir, appendFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  createKevinApprovedKnowledgeSource,
  KNOWLEDGE_SOURCE_COLLECTION,
} from '../src/services/knowledge/approvedKnowledgeStore.js';
import { ensureChromaCollections } from '../src/services/chromaCollections.js';
import { persistenceCall } from '../src/services/persistence/dispatch.js';
import { connectDirectPersistence, closeDirectPersistence } from '../src/services/persistence/index.js';
import type { McsAgentKey } from '@momentum/shared/runtime';

interface MongoQueryResult { count?: number; documents?: Array<Record<string, unknown>>; }

// Team Magnificent training repo (Kevin's own): github.com/devklg/team-magnificent-training
// Captured 2026-07-08. Kevin-approved, all agents. Content training pages only.
const SNAP_DIR = 'D:/momentum-creation-system-v2/knowledge/team-mag-training/extracted';
const MANIFEST = 'D:/momentum-creation-system-v2/knowledge/team-mag-training/PROVENANCE_MANIFEST.md';
const REPO = 'https://github.com/devklg/team-magnificent-training/blob/main/';
const CREATED_BY = 'TMAG-01';
const AUTHORITY_BY = 'Kevin L. Gardner';
const INGESTED_AT = new Date().toISOString();
const ALL: McsAgentKey[] = ['steve_success', 'michael_magnificent', 'ivory'];

// content training pages worth ingesting (skip pure form/app shells)
const META: Record<string, { title: string; tags: string[] }> = {
  '10-steps': { title: 'Team Magnificent: 10 Steps to Building Your Business', tags: ['team-magnificent', 'training', '10-steps', 'blueprint', 'why', 'onboarding'] },
  '72hour-mission': { title: 'Team Magnificent: 72-Hour Mission', tags: ['team-magnificent', 'training', 'launch', 'fast-start', 'qba'] },
  'onboarding': { title: 'Team Magnificent: Onboarding', tags: ['team-magnificent', 'training', 'onboarding'] },
  'invitation-art-masterclass': { title: 'Team Magnificent: The Art of Invitation Masterclass', tags: ['team-magnificent', 'training', 'invitation', 'scripts', 'ivory'] },
  'product-warm-market': { title: 'Team Magnificent: Product Warm Market', tags: ['team-magnificent', 'training', 'warm-market', 'product'] },
  'prospect': { title: 'Team Magnificent: Prospecting', tags: ['team-magnificent', 'training', 'prospecting'] },
  'tm-vision-statement': { title: 'Team Magnificent: Vision Statement', tags: ['team-magnificent', 'vision', 'organizational'] },
  'tm-binary-live': { title: 'Team Magnificent: Binary Compensation (Live)', tags: ['team-magnificent', 'training', 'compensation', 'binary'] },
  'video-library': { title: 'Team Magnificent: Video Library', tags: ['team-magnificent', 'training', 'video', 'resources'] },
  'index': { title: 'Team Magnificent: Training Hub Index', tags: ['team-magnificent', 'training', 'hub', 'index'] },
};
// form/app shells to skip (thin UI, not training content)
const SKIP = new Set(['ba-registration', 'register']);

async function already(sourceRef: string): Promise<boolean> {
  const r = await persistenceCall<MongoQueryResult>('mongodb', 'query', {
    database: 'momentum', collection: KNOWLEDGE_SOURCE_COLLECTION, filter: { sourceRef }, limit: 1,
  });
  return (r.count ?? r.documents?.length ?? 0) > 0;
}

async function main() {
  await connectDirectPersistence();
  await ensureChromaCollections();
  const report = { created: 0, skipped: 0, failed: 0, chunks: 0 };
  const rows: string[] = [];
  try {
    const files = (await readdir(SNAP_DIR)).filter((f) => f.endsWith('.md')).sort();
    for (const file of files) {
      const slug = file.replace(/\.md$/, '');
      if (SKIP.has(slug)) { report.skipped++; console.log(`[tm-training] skip form-page ${slug}`); continue; }
      const meta = META[slug];
      if (!meta) { report.skipped++; console.log(`[tm-training] skip unmapped ${slug}`); continue; }
      const url = REPO + slug + '.html';
      const sourceRef = `github:${url}`;
      if (await already(sourceRef)) { report.skipped++; console.log(`[tm-training] exists ${slug}`); continue; }
      try {
        const md = await readFile(path.join(SNAP_DIR, file), 'utf8');
        const body = md.split(/\n---\n/).slice(1).join('\n---\n').trim() || md;
        const domain = slug === 'tm-vision-statement' ? 'organizational' : 'training';
        const res = await createKevinApprovedKnowledgeSource({
          title: meta.title, content: body, createdBy: CREATED_BY,
          authorityKind: 'kevin_approved', authorityBy: AUTHORITY_BY, authorityRef: url,
          sourceType: 'owned_text', sourceRef, domain, language: 'en', format: 'markdown',
          topicTags: meta.tags, agentScopes: ALL,
          upload: { filename: file, originalBytes: Buffer.byteLength(md, 'utf8'), extractedCharacters: body.length, sourceRef },
          createdAt: INGESTED_AT,
        });
        report.created++; report.chunks += res.chunkCount;
        rows.push(`| ${slug} | ${url} | extracted/${slug}.md | ${res.source.sourceId} | ${res.chunkCount} |`);
        console.log(`[tm-training] created ${meta.title} (${res.chunkCount} chunks) -> ${res.source.sourceId}`);
      } catch (e) { report.failed++; console.error(`[tm-training] failed ${slug}: ${e instanceof Error ? e.message : String(e)}`); }
    }
    const header = `# Team Magnificent Training — Provenance Manifest\n\nSource repo: github.com/devklg/team-magnificent-training (Kevin's own)\nAuthority: Team Magnificent, Kevin-approved, all agents. Captured/ingested ${INGESTED_AT}.\n\n| slug | repo URL | snapshot | sourceId | chunks |\n| --- | --- | --- | --- | --- |\n`;
    await writeFile(MANIFEST, header + rows.join('\n') + '\n', 'utf8');
    console.log(`[tm-training] complete created=${report.created} skipped=${report.skipped} failed=${report.failed} chunks=${report.chunks}`);
    if (report.failed > 0) process.exitCode = 1;
  } finally { await closeDirectPersistence(); }
}
main().catch(async (e) => { console.error('fatal', e); await closeDirectPersistence(); process.exitCode = 1; });
