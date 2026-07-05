/**
 * Seed Product Gallery content from github.com/devklg/team-magnificent-training.
 *
 * Input files:
 *   - video-library.html (primary catalog)
 *   - product-warm-market.html (Product Knowledge resource)
 *
 * Usage:
 *   pnpm --filter @momentum/server seed:content-videos
 *
 * The script expects the source repo at .build/team-magnificent-training by
 * default. Override with TRAINING_REPO_DIR if needed.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { persistenceCall } from '../src/services/persistence/dispatch.js';
import { connectMongo } from '../src/services/persistence/mongo/connection.js';
import {
  createContentVideo,
  normalizeYoutubeId,
  type ContentVideoInput,
} from '../src/domain/contentVideos.js';

const MONGO_DB = 'momentum';
const COLLECTION = 'tmag_content_videos';
const CHROMA_COLLECTION = 'mcs_content_videos';
const TIMEOUT_MS = 90_000;

interface SeedEntry extends ContentVideoInput {
  source: string;
}

function repoRoot(): string {
  const here = fileURLToPath(new URL('.', import.meta.url));
  return join(here, '..', '..');
}

function sourceDir(): string {
  return process.env.TRAINING_REPO_DIR || join(repoRoot(), '.build', 'team-magnificent-training');
}

function stripTags(value: string): string {
  return value
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&mdash;/g, '-')
    .replace(/&middot;/g, '·')
    .replace(/&#8209;/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeSection(value: string): string {
  return stripTags(value).replace(/\s+/g, ' ').trim();
}

function markerPositions(html: string): Array<{ index: number; section: string }> {
  const markers: Array<{ index: number; section: string }> = [];

  const main = /<h2 class="section-title">([\s\S]*?)<\/h2>/g;
  let match: RegExpExecArray | null;
  while ((match = main.exec(html))) {
    markers.push({ index: match.index, section: normalizeSection(match[1] ?? '') });
  }

  const sub = /<span class="section-number"[^>]*>([A-Z0-9 ?'&;·.-]+)<\/span>/g;
  while ((match = sub.exec(html))) {
    const text = normalizeSection(match[1] ?? '');
    if (text && !/^\d+$/.test(text)) markers.push({ index: match.index, section: text });
  }

  return markers.sort((a, b) => a.index - b.index);
}

function sectionAt(markers: Array<{ index: number; section: string }>, index: number): string {
  let current = 'Product Knowledge';
  for (const marker of markers) {
    if (marker.index > index) break;
    current = marker.section;
  }
  return current;
}

function extractVideoLibrary(html: string): SeedEntry[] {
  const markers = markerPositions(html);
  const entries: SeedEntry[] = [];

  const card =
    /<(a) class="(?:video-card|short-card)[^"]*" href="([^"]+)"[\s\S]*?<div class="(?:video-title|short-title)">([\s\S]*?)<\/div>(?:[\s\S]*?<div class="video-meta">([\s\S]*?)<\/div>)?[\s\S]*?<\/a>/g;
  let match: RegExpExecArray | null;
  while ((match = card.exec(html))) {
    const url = match[2] ?? '';
    const youtubeId = normalizeYoutubeId(url);
    entries.push({
      section: sectionAt(markers, match.index),
      title: stripTags(match[3] ?? ''),
      youtubeId,
      url,
      description: stripTags(match[4] ?? '') || 'Team Magnificent training video.',
      sortOrder: (entries.length + 1) * 10,
      audience: isMemberTraining(sectionAt(markers, match.index)) ? 'member' : 'both',
      active: true,
      source: 'seed:team-magnificent-training/video-library.html',
    });
  }

  const iframe =
    /<iframe[\s\S]*?src="([^"]+)"[\s\S]*?title="([^"]+)"[\s\S]*?<\/iframe>/g;
  while ((match = iframe.exec(html))) {
    const section = sectionAt(markers, match.index);
    entries.push({
      section,
      title: stripTags(match[2] ?? 'Embedded training video'),
      youtubeId: null,
      url: match[1] ?? null,
      description: 'Embedded Team Magnificent training video.',
      sortOrder: (entries.length + 1) * 10,
      audience: isMemberTraining(section) ? 'member' : 'both',
      active: true,
      source: 'seed:team-magnificent-training/video-library.html',
    });
  }

  return dedupe(entries);
}

function extractWarmMarket(html: string): SeedEntry[] {
  const title = stripTags(html.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? 'Who Do You Know?');
  const description = stripTags(
    html.match(/<div class="hero-sub">([\s\S]*?)<\/div>/)?.[1] ??
      'Warm-market Product Knowledge resource.',
  );
  return [
    {
      section: 'Product Knowledge',
      title,
      youtubeId: null,
      url: 'https://devklg.github.io/team-magnificent-training/product-warm-market.html',
      description,
      sortOrder: 10_000,
      audience: 'member',
      active: true,
      source: 'seed:team-magnificent-training/product-warm-market.html',
    },
  ];
}

function isMemberTraining(section: string): boolean {
  return /compensation|warm market|product knowledge|business|plan/i.test(section);
}

function dedupe(entries: SeedEntry[]): SeedEntry[] {
  const seen = new Set<string>();
  const out: SeedEntry[] = [];
  for (const entry of entries) {
    const key = `${entry.section}|${entry.title}|${entry.youtubeId ?? entry.url ?? ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(entry);
  }
  return out;
}

async function ensureChromaCollection(): Promise<void> {
  await persistenceCall('chromadb', 'create_collection', {
    name: CHROMA_COLLECTION,
    metadata: {
      project: 'momentum_creation_system_v2',
      purpose: 'Product Gallery content videos',
    },
  });
}

async function exists(entry: SeedEntry): Promise<boolean> {
  const filter: Record<string, unknown> = {
    section: entry.section,
    title: entry.title,
  };
  if (entry.youtubeId) filter.youtubeId = entry.youtubeId;
  else filter.url = entry.url;

  const result = await persistenceCall<{ documents?: unknown[] }>('mongodb', 'query', {
    database: MONGO_DB,
    collection: COLLECTION,
    filter,
    limit: 1,
  });
  return (result.documents ?? []).length > 0;
}

function catalogOtherPages(dir: string): string[] {
  return readdirSync(dir)
    .filter((name) => name.endsWith('.html'))
    .filter((name) => !['video-library.html', 'product-warm-market.html'].includes(name))
    .sort();
}

async function seed(): Promise<void> {
  const dir = sourceDir();
  const videoHtml = readFileSync(join(dir, 'video-library.html'), 'utf8');
  const warmHtml = readFileSync(join(dir, 'product-warm-market.html'), 'utf8');
  const entries = [...extractVideoLibrary(videoHtml), ...extractWarmMarket(warmHtml)];

  await connectMongo();
  await ensureChromaCollection();

  let created = 0;
  let skipped = 0;
  for (const entry of entries) {
    if (await exists(entry)) {
      skipped++;
      continue;
    }
    const result = await createContentVideo({
      input: entry,
      actor: { tmagId: 'seed:content-videos' },
    });
    if (!result.ok) {
      throw new Error(`seed failed for ${entry.section} / ${entry.title}: ${JSON.stringify(result.error)}`);
    }
    created++;
    // eslint-disable-next-line no-console
    console.log(`[seed:content-videos] write ${entry.section} | ${entry.title} | ${entry.youtubeId ?? entry.url}`);
  }

  // eslint-disable-next-line no-console
  console.log(`[seed:content-videos] done created=${created} skipped=${skipped} total=${entries.length}`);
  // eslint-disable-next-line no-console
  console.log(`[seed:content-videos] available other pages: ${catalogOtherPages(dir).join(', ')}`);
}

Promise.race([
  seed(),
  new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error(`seed timed out after ${TIMEOUT_MS}ms`)), TIMEOUT_MS),
  ),
])
  .then(() => process.exit(0))
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error('[seed:content-videos] FAILED', err);
    process.exit(1);
  });
