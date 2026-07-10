import { access, appendFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { persistenceCall } from '../persistence/dispatch.js';
import { categoryLabel, classifyKnowledgeTaxonomy } from './taxonomy.js';

interface MongoAggregateResult {
  documents?: KnowledgeSourceRow[];
  results?: KnowledgeSourceRow[];
}

interface KnowledgeSourceRow {
  _id?: string;
  sourceId?: string;
  title?: string;
  domain?: string;
  createdAt?: string;
  chunkCount?: number;
  sourceRef?: string;
  topicTags?: string[];
  taxonomy?: {
    primaryCategory?: string;
    categoryTags?: string[];
    productTags?: string[];
    topicTags?: string[];
  };
}

const INDEX_PATH = 'D:/momentum-creation-system-v2/knowledge/KB_DOCUMENT_INDEX.md';

export interface KnowledgeDocumentIndexResult {
  path: string;
  mode: 'created' | 'refreshed' | 'appended' | 'unchanged';
  rowCount: number;
  totalSources: number;
}

export async function updateKnowledgeDocumentIndex(
  options: { refreshAll?: boolean } = {},
): Promise<KnowledgeDocumentIndexResult> {
  const now = new Date().toISOString();
  const result = await persistenceCall<MongoAggregateResult>('mongodb', 'aggregate', {
    database: 'momentum',
    collection: 'mcs_knowledge_sources',
    pipeline: [
      {
        $project: {
          _id: 1,
          sourceId: 1,
          title: 1,
          domain: 1,
          createdAt: 1,
          chunkCount: 1,
          sourceRef: 1,
          topicTags: 1,
          taxonomy: 1,
        },
      },
      { $sort: { createdAt: 1, sourceRef: 1, title: 1 } },
    ],
  });

  const rows = sortForIndex((result.results ?? result.documents ?? []).filter((row) => sourceId(row)));
  const existing = await readExistingIndex();
  const seen = existing ? existingIds(existing) : new Set<string>();
  const nextRows = rows.filter((row) => !seen.has(sourceId(row)));

  await mkdir(path.dirname(INDEX_PATH), { recursive: true });

  if (!existing || options.refreshAll) {
    await writeFile(INDEX_PATH, header(now) + categorySummary(rows) + section(rows, 1, now), 'utf8');
    return {
      path: INDEX_PATH,
      mode: !existing ? 'created' : 'refreshed',
      rowCount: rows.length,
      totalSources: rows.length,
    };
  }

  if (nextRows.length > 0) {
    await appendFile(INDEX_PATH, section(nextRows, maxIndex(existing) + 1, now), 'utf8');
    return {
      path: INDEX_PATH,
      mode: 'appended',
      rowCount: nextRows.length,
      totalSources: rows.length,
    };
  }

  return {
    path: INDEX_PATH,
    mode: 'unchanged',
    rowCount: 0,
    totalSources: rows.length,
  };
}

function corpusFor(ref: string): string {
  if (ref.includes('blog.threeinternational')) return 'THREE Blog';
  if (ref.includes('github.com/devklg/team-magnificent-training')) return 'Team Magnificent Training';
  if (ref.includes('upline-legacy-makers')) return 'Upline Legacy Makers';
  if (ref.includes('D:/THREE')) return 'THREE Corporate Docs';
  if (ref.includes('TEAM-MAG')) return 'MCS Vision';
  return 'Other';
}

function humanCategory(row: KnowledgeSourceRow): string {
  const primary = row.taxonomy?.primaryCategory ??
    classifyKnowledgeTaxonomy({
      title: row.title,
      sourceRef: row.sourceRef,
      domain: row.domain,
      topicTags: row.topicTags,
    }).primaryCategory;
  return categoryLabel(primary);
}

function sourceId(row: KnowledgeSourceRow): string {
  return String(row.sourceId ?? row._id ?? '');
}

function sourceName(ref: string): string {
  if (!ref) return '';
  const clean = ref.replace(/^(file:|url:|github:)/, '');
  try {
    const parsed = new URL(clean);
    return decodeURIComponent(path.posix.basename(parsed.pathname)) || parsed.hostname;
  } catch {
    return path.posix.basename(clean.replace(/\\/g, '/')) || clean;
  }
}

function escapeCell(value: unknown): string {
  return String(value ?? '').replace(/\|/g, '\\|').replace(/\r?\n/g, ' ').trim();
}

function existingIds(content: string): Set<string> {
  const ids = new Set<string>();
  const re = /\|\s*knowledge_source_[^|\s]+\s*\|/g;
  for (const match of content.matchAll(re)) {
    ids.add(match[0].replace(/\|/g, '').trim());
  }
  return ids;
}

function maxIndex(content: string): number {
  let max = 0;
  const re = /^\|\s*(\d+)\s*\|/gm;
  for (const match of content.matchAll(re)) {
    max = Math.max(max, Number(match[1]));
  }
  return max;
}

async function readExistingIndex(): Promise<string | null> {
  try {
    await access(INDEX_PATH);
    return await readFile(INDEX_PATH, 'utf8');
  } catch {
    return null;
  }
}

function header(now: string): string {
  return [
    '# Momentum Creation System V2 - Knowledge Base Document Index',
    '',
    `Updated: ${now}`,
    '',
    'Chronological index of knowledge-base source documents. This file is refreshed by the KB ingestion path and can be regenerated with `server/scripts/update-kb-document-index.ts`.',
    '',
    'Columns: Number, added-at timestamp, category, corpus, domain, document/file name, source location, chunks, sourceId.',
    '',
  ].join('\n');
}

function categorySummary(rows: KnowledgeSourceRow[]): string {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const category = humanCategory(row);
    counts.set(category, (counts.get(category) ?? 0) + 1);
  }
  const lines = [
    '## Category Guide',
    '',
    '| Category | Documents |',
    '| --- | ---: |',
  ];
  for (const [category, count] of [...counts.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    lines.push(`| ${escapeCell(category)} | ${count} |`);
  }
  return lines.join('\n') + '\n\n';
}

function sortForIndex(rows: KnowledgeSourceRow[]): KnowledgeSourceRow[] {
  return [...rows].sort((a, b) => {
    const byCreated = (a.createdAt ?? '').localeCompare(b.createdAt ?? '');
    if (byCreated !== 0) return byCreated;
    const byRef = (a.sourceRef ?? '').localeCompare(b.sourceRef ?? '');
    if (byRef !== 0) return byRef;
    return (a.title ?? '').localeCompare(b.title ?? '');
  });
}

function table(rows: KnowledgeSourceRow[], startAt = 1): string {
  const lines = [
    '| No. | Added At | Category | Corpus | Domain | Document / File | Source Location | Chunks | SourceId |',
    '| ---: | --- | --- | --- | --- | --- | --- | ---: | --- |',
  ];

  rows.forEach((row, offset) => {
    const ref = row.sourceRef ?? '';
    const no = startAt + offset;
    const title = row.title || sourceName(ref);
    lines.push(
      [
        no,
        row.createdAt ?? '',
        humanCategory(row),
        corpusFor(ref),
        row.domain ?? '',
        title,
        ref,
        row.chunkCount ?? '',
        sourceId(row),
      ].map(escapeCell).join(' | ').replace(/^/, '| ').replace(/$/, ' |'),
    );
  });

  return lines.join('\n') + '\n';
}

function section(rows: KnowledgeSourceRow[], startAt: number, now: string): string {
  return [`## Index Update - ${now}`, '', table(rows, startAt), ''].join('\n');
}
