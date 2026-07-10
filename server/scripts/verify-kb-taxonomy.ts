import { fetch } from 'undici';
import { closeDirectPersistence, connectDirectPersistence } from '../src/services/persistence/index.js';
import { persistenceCall } from '../src/services/persistence/dispatch.js';
import { chromaCollectionsUrl, chromaHeaders } from '../src/services/persistence/chroma/connection.js';
import { KB_TAXONOMY_VERSION } from '../src/services/knowledge/taxonomy.js';

interface MongoAggregateResult<T> {
  documents?: T[];
  results?: T[];
  records?: T[];
}

interface CountRow {
  totalSources?: number;
  sourcesWithTaxonomy?: number;
  totalChunks?: number;
  chunksWithTaxonomy?: number;
}

interface GroupRow {
  _id: string;
  n: number;
}

interface Neo4jRow {
  sources?: number | { low: number };
  chunks?: number | { low: number };
  categoryEdges?: number | { low: number };
  productEdges?: number | { low: number };
  topicEdges?: number | { low: number };
  categories?: number | { low: number };
  products?: number | { low: number };
  topics?: number | { low: number };
}

interface ChromaCollection {
  id?: string;
  name?: string;
}

const DB = 'momentum';
const SOURCE_COLLECTION = 'mcs_knowledge_sources';
const CHUNK_COLLECTION = 'mcs_knowledge_chunks';
const CHROMA_CHUNK_COLLECTION = 'mcs_knowledge_chunks';

function rows<T>(result: MongoAggregateResult<T>): T[] {
  return result.results ?? result.documents ?? result.records ?? [];
}

function numeric(value: number | { low: number } | undefined): number {
  if (typeof value === 'number') return value;
  return value?.low ?? 0;
}

async function mongoCounts(): Promise<{ counts: CountRow; categories: GroupRow[] }> {
  const countResult = await persistenceCall<MongoAggregateResult<CountRow>>('mongodb', 'aggregate', {
    database: DB,
    collection: SOURCE_COLLECTION,
    pipeline: [
      {
        $facet: {
          totalSources: [{ $count: 'n' }],
          sourcesWithTaxonomy: [{ $match: { 'taxonomy.taxonomyVersion': KB_TAXONOMY_VERSION } }, { $count: 'n' }],
          totalChunks: [
            {
              $lookup: {
                from: CHUNK_COLLECTION,
                pipeline: [{ $count: 'n' }],
                as: 'chunks',
              },
            },
            { $limit: 1 },
            { $project: { n: { $ifNull: [{ $first: '$chunks.n' }, 0] } } },
          ],
          chunksWithTaxonomy: [
            {
              $lookup: {
                from: CHUNK_COLLECTION,
                pipeline: [
                  { $match: { 'taxonomy.taxonomyVersion': KB_TAXONOMY_VERSION } },
                  { $count: 'n' },
                ],
                as: 'chunks',
              },
            },
            { $limit: 1 },
            { $project: { n: { $ifNull: [{ $first: '$chunks.n' }, 0] } } },
          ],
        },
      },
      {
        $project: {
          totalSources: { $ifNull: [{ $first: '$totalSources.n' }, 0] },
          sourcesWithTaxonomy: { $ifNull: [{ $first: '$sourcesWithTaxonomy.n' }, 0] },
          totalChunks: { $ifNull: [{ $first: '$totalChunks.n' }, 0] },
          chunksWithTaxonomy: { $ifNull: [{ $first: '$chunksWithTaxonomy.n' }, 0] },
        },
      },
    ],
  });
  const categoryResult = await persistenceCall<MongoAggregateResult<GroupRow>>('mongodb', 'aggregate', {
    database: DB,
    collection: SOURCE_COLLECTION,
    pipeline: [
      { $group: { _id: '$taxonomy.primaryCategory', n: { $sum: 1 } } },
      { $sort: { n: -1 } },
    ],
  });
  return {
    counts: rows(countResult)[0] ?? {},
    categories: rows(categoryResult),
  };
}

async function neo4jCounts(): Promise<Record<string, number>> {
  const query = `
    MATCH (src:KnowledgeSource)
    WITH count(src) AS sourceNodes
    MATCH (chunk:KnowledgeChunk)
    WITH sourceNodes, count(chunk) AS chunkNodes
    OPTIONAL MATCH (srcCat:KnowledgeSource)-[:IN_CATEGORY]->(:KnowledgeCategory)
    WITH sourceNodes, chunkNodes, count(srcCat) AS sourceCategoryEdges
    OPTIONAL MATCH (chunkCat:KnowledgeChunk)-[:IN_CATEGORY]->(:KnowledgeCategory)
    WITH sourceNodes, chunkNodes, sourceCategoryEdges, count(chunkCat) AS chunkCategoryEdges
    OPTIONAL MATCH (srcProd:KnowledgeSource)-[:ABOUT_PRODUCT]->(:KnowledgeProduct)
    WITH sourceNodes, chunkNodes, sourceCategoryEdges, chunkCategoryEdges, count(srcProd) AS sourceProductEdges
    OPTIONAL MATCH (srcTopic:KnowledgeSource)-[:ABOUT_TOPIC]->(:KnowledgeTopic)
    RETURN sourceNodes, chunkNodes, sourceCategoryEdges, chunkCategoryEdges, sourceProductEdges, count(srcTopic) AS sourceTopicEdges
  `;
  const result = await persistenceCall<MongoAggregateResult<Neo4jRow & Record<string, unknown>>>('neo4j', 'cypher', { query });
  const row = rows(result)[0] ?? {};
  return Object.fromEntries(Object.entries(row).map(([key, value]) => [key, numeric(value as number | { low: number })]));
}

async function chromaTaxonomyCount(expectedLimit: number): Promise<number> {
  const collectionsBody = await readJson(await fetch(chromaCollectionsUrl(), { headers: chromaHeaders() }));
  const collections = Array.isArray(collectionsBody)
    ? collectionsBody as ChromaCollection[]
    : (collectionsBody as { collections?: ChromaCollection[] }).collections ?? [];
  const collection = collections.find((item) => item.name === CHROMA_CHUNK_COLLECTION || item.id === CHROMA_CHUNK_COLLECTION);
  if (!collection) return 0;
  const id = collection.id ?? collection.name;
  if (!id) return 0;
  const response = await fetch(`${chromaCollectionsUrl()}/${encodeURIComponent(id)}/get`, {
    method: 'POST',
    headers: chromaHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({
      where: { taxonomyVersion: KB_TAXONOMY_VERSION },
      limit: Math.max(expectedLimit, 1),
      include: ['metadatas'],
    }),
  });
  const body = await readJson(response);
  return Array.isArray((body as { ids?: unknown }).ids) ? ((body as { ids: string[] }).ids.length) : 0;
}

async function readJson(response: Awaited<ReturnType<typeof fetch>>): Promise<unknown> {
  const text = await response.text();
  if (!response.ok) throw new Error(`HTTP ${response.status} ${response.statusText}: ${text}`);
  return text ? JSON.parse(text) as unknown : {};
}

async function main(): Promise<void> {
  await connectDirectPersistence();
  try {
    const mongo = await mongoCounts();
    const totalSources = mongo.counts.totalSources ?? 0;
    const sourcesWithTaxonomy = mongo.counts.sourcesWithTaxonomy ?? 0;
    const totalChunks = mongo.counts.totalChunks ?? 0;
    const chunksWithTaxonomy = mongo.counts.chunksWithTaxonomy ?? 0;
    const [neo4j, chromaTaggedChunks] = await Promise.all([
      neo4jCounts(),
      chromaTaxonomyCount(totalChunks),
    ]);
    const ok = sourcesWithTaxonomy === totalSources &&
      chunksWithTaxonomy === totalChunks &&
      chromaTaggedChunks >= totalChunks &&
      (neo4j.sourceCategoryEdges ?? 0) >= totalSources &&
      (neo4j.chunkCategoryEdges ?? 0) >= totalChunks;

    console.log(JSON.stringify({
      ok,
      taxonomyVersion: KB_TAXONOMY_VERSION,
      mongo: {
        totalSources,
        sourcesWithTaxonomy,
        totalChunks,
        chunksWithTaxonomy,
        categories: mongo.categories,
      },
      chroma: {
        taggedChunks: chromaTaggedChunks,
      },
      neo4j,
    }, null, 2));

    if (!ok) process.exitCode = 1;
  } finally {
    await closeDirectPersistence();
  }
}

main().catch(async (err) => {
  console.error(`[kb-verify] fatal: ${err instanceof Error ? err.stack ?? err.message : String(err)}`);
  await closeDirectPersistence();
  process.exitCode = 1;
});
