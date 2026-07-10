import { writeFile } from 'node:fs/promises';
import { persistenceCall } from '../src/services/persistence/dispatch.js';
import { connectDirectPersistence, closeDirectPersistence } from '../src/services/persistence/index.js';
import { classifyKnowledgeTaxonomy } from '../src/services/knowledge/taxonomy.js';

interface MongoAggregateResult {
  documents?: SourceRow[];
  results?: SourceRow[];
}

interface SourceRow {
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
    complianceSensitivity?: string;
  };
}

const OUT = 'D:/momentum-creation-system-v2/knowledge/KB_SOURCE_REGISTER.csv';

function csv(value: unknown): string {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

function corpus(ref: string | undefined): string {
  if (ref?.includes('blog.threeinternational')) return 'three-blog';
  if (ref?.includes('github.com/devklg/team-magnificent-training')) return 'team-mag-training';
  if (ref?.includes('upline-legacy-makers')) return 'upline-legacy-makers';
  if (ref?.includes('D:/THREE')) return 'three-corpus';
  if (ref?.includes('TEAM-MAG')) return 'mcs-vision';
  return 'other';
}

function tags(values: string[] | undefined): string {
  return (values ?? []).join('|');
}

await connectDirectPersistence();
try {
  const res = await persistenceCall<MongoAggregateResult>('mongodb', 'aggregate', {
    database: 'momentum',
    collection: 'mcs_knowledge_sources',
    pipeline: [
      {
        $project: {
          _id: 0,
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
  const rows = res.results ?? res.documents ?? [];
  const header = [
    'number',
    'sourceId',
    'title',
    'domain',
    'corpus',
    'createdAt',
    'chunkCount',
    'primaryCategory',
    'categoryTags',
    'productTags',
    'topicTags',
    'complianceSensitivity',
    'sourceRef',
  ].join(',');
  const lines = rows.map((row, index) => {
    const taxonomy = row.taxonomy ?? classifyKnowledgeTaxonomy({
      title: row.title,
      sourceRef: row.sourceRef,
      domain: row.domain,
      topicTags: row.topicTags,
    });
    return [
      index + 1,
      row.sourceId,
      row.title,
      row.domain,
      corpus(row.sourceRef),
      row.createdAt,
      row.chunkCount,
      taxonomy.primaryCategory,
      tags(taxonomy.categoryTags),
      tags(taxonomy.productTags),
      tags(taxonomy.topicTags),
      taxonomy.complianceSensitivity,
      row.sourceRef,
    ].map(csv).join(',');
  });
  await writeFile(OUT, header + '\n' + lines.join('\n') + '\n', 'utf8');
  console.log(`wrote ${rows.length} rows -> ${OUT}`);
} finally {
  await closeDirectPersistence();
}
