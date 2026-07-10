import { fetch } from 'undici';
import { connectDirectPersistence, closeDirectPersistence } from '../src/services/persistence/index.js';
import { persistenceCall } from '../src/services/persistence/dispatch.js';
import { getMongoConnection } from '../src/services/persistence/mongo/connection.js';
import { chromaCollectionsUrl, chromaHeaders } from '../src/services/persistence/chroma/connection.js';
import {
  classifyKnowledgeTaxonomy,
  categoryLabel,
  safeKey,
  taxonomyFlags,
  type KnowledgeTaxonomy,
} from '../src/services/knowledge/taxonomy.js';

interface SourceDoc {
  _id: string;
  title?: string;
  sourceRef?: string;
  domain?: string;
  topicTags?: string[];
}

interface ChunkDoc {
  _id: string;
  chunkId?: string;
  sourceId: string;
  title?: string;
  text?: string;
  summary?: string;
  domain?: string;
  language?: string;
  topicTags?: string[];
  status?: string;
  retrievalEligible?: boolean;
  sourceTitle?: string;
  chunkIndex?: number;
  documentId?: string;
  sourceVersion?: number;
  authorityKind?: string;
  authorityStatus?: string;
  agentScopes?: string[];
  surfaceScopes?: string[];
  scope?: Record<string, unknown>;
  sourceOffsets?: { startOffset?: number; endOffset?: number };
}

const DB = 'momentum';
const SOURCE_COLLECTION = 'mcs_knowledge_sources';
const CHUNK_COLLECTION = 'mcs_knowledge_chunks';
const CHROMA_CHUNK_COLLECTION = 'mcs_knowledge_chunks';
const BATCH_SIZE = 100;

function pipe(values: readonly string[] | undefined): string {
  return (values ?? []).join('|');
}

function unique(values: Array<string | undefined>): string[] {
  return [...new Set(values.filter((value): value is string => typeof value === 'string' && value.length > 0))].sort();
}

function mergeTaxonomy(base: KnowledgeTaxonomy, extra: KnowledgeTaxonomy): KnowledgeTaxonomy {
  const categoryTags = unique([...base.categoryTags, ...extra.categoryTags]);
  const productTags = unique([...base.productTags, ...extra.productTags]);
  const topicTags = unique([...base.topicTags, ...extra.topicTags]);
  return {
    taxonomyVersion: base.taxonomyVersion,
    primaryCategory: base.primaryCategory,
    categoryTags,
    productTags,
    topicTags,
    complianceSensitivity:
      base.complianceSensitivity === 'high' || extra.complianceSensitivity === 'high' ? 'high' : 'standard',
  };
}

function chromaMetadata(chunk: ChunkDoc, source: SourceDoc, taxonomy: KnowledgeTaxonomy): Record<string, unknown> {
  const scope = chunk.scope ?? {};
  const offsets = chunk.sourceOffsets ?? {};
  return {
    kind: 'knowledge_chunk',
    sourceId: chunk.sourceId,
    chunkId: chunk.chunkId ?? chunk._id,
    documentId: chunk.documentId,
    sourceVersion: chunk.sourceVersion ?? 1,
    chunkIndex: chunk.chunkIndex ?? 0,
    title: chunk.title ?? source.title,
    domain: chunk.domain ?? source.domain,
    language: chunk.language ?? 'en',
    status: chunk.status ?? 'active',
    retrievalEligible: chunk.retrievalEligible !== false,
    authority: chunk.authorityKind ?? 'kevin_approved',
    authorityStatus: chunk.authorityStatus ?? 'active_authority',
    sourceTitle: chunk.sourceTitle ?? source.title,
    topicTags: pipe(chunk.topicTags),
    categoryTags: pipe(taxonomy.categoryTags),
    productTags: pipe(taxonomy.productTags),
    agentScopes: pipe(chunk.agentScopes),
    surfaceScopes: pipe(chunk.surfaceScopes),
    'scope.tenantId': String(scope.tenantId ?? 'tenant_team_magnificent'),
    'scope.teamId': String(scope.teamId ?? 'team_magnificent'),
    'scope.teamKey': String(scope.teamKey ?? 'team_magnificent'),
    'scope.teamName': String(scope.teamName ?? 'Team Magnificent'),
    startOffset: offsets.startOffset ?? 0,
    endOffset: offsets.endOffset ?? (chunk.text ?? chunk.summary ?? '').length,
    ...taxonomyFlags(taxonomy),
  };
}

async function chromaCollectionId(name: string): Promise<string> {
  const res = await fetch(chromaCollectionsUrl(), { headers: chromaHeaders() });
  if (!res.ok) throw new Error(`Chroma list failed ${res.status}: ${await res.text()}`);
  const collections = await res.json() as Array<{ id?: string; name?: string }>;
  const found = collections.find((collection) => collection.name === name);
  if (!found?.id) throw new Error(`Chroma collection not found: ${name}`);
  return found.id;
}

async function chromaUpdate(collectionId: string, chunks: ChunkDoc[], sourceById: Map<string, SourceDoc>, taxonomyByChunkId: Map<string, KnowledgeTaxonomy>): Promise<number> {
  let updated = 0;
  for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
    const batch = chunks.slice(i, i + BATCH_SIZE);
    const ids = batch.map((chunk) => chunk.chunkId ?? chunk._id);
    const metadatas = batch.map((chunk) => {
      const source = sourceById.get(chunk.sourceId);
      const taxonomy = taxonomyByChunkId.get(chunk._id);
      if (!source || !taxonomy) throw new Error(`missing source/taxonomy for ${chunk._id}`);
      return chromaMetadata(chunk, source, taxonomy);
    });
    const res = await fetch(`${chromaCollectionsUrl()}/${collectionId}/update`, {
      method: 'POST',
      headers: chromaHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ ids, metadatas }),
    });
    if (!res.ok) throw new Error(`Chroma update failed ${res.status}: ${await res.text()}`);
    updated += batch.length;
  }
  return updated;
}

async function writeNeo4jTaxonomy(sourceTaxonomies: Array<{ source: SourceDoc; taxonomy: KnowledgeTaxonomy }>, chunkTaxonomies: Array<{ chunk: ChunkDoc; taxonomy: KnowledgeTaxonomy }>): Promise<void> {
  await persistenceCall('neo4j', 'cypher', {
    query: `
      UNWIND $sources AS row
      MATCH (s:KnowledgeSource {id: row.sourceId})
      SET s.taxonomyVersion = row.taxonomyVersion,
          s.primaryCategory = row.primaryCategory,
          s.categoryTags = row.categoryTags,
          s.productTags = row.productTags,
          s.topicTags = row.topicTags,
          s.complianceSensitivity = row.complianceSensitivity
    `,
    params: {
      sources: sourceTaxonomies.map(({ source, taxonomy }) => ({
        sourceId: String(source._id),
        ...taxonomy,
      })),
    },
  });

  await persistenceCall('neo4j', 'cypher', {
    query: `
      UNWIND $sources AS row
      MATCH (s:KnowledgeSource {id: row.sourceId})
      UNWIND row.categoryTags AS category
      MERGE (cat:KnowledgeCategory {id: category})
      SET cat.label = row.categoryLabels[category]
      MERGE (s)-[:IN_CATEGORY]->(cat)
    `,
    params: {
      sources: sourceTaxonomies.map(({ source, taxonomy }) => ({
        sourceId: String(source._id),
        categoryTags: taxonomy.categoryTags,
        categoryLabels: Object.fromEntries(taxonomy.categoryTags.map((tag) => [tag, categoryLabel(tag)])),
      })),
    },
  });

  await persistenceCall('neo4j', 'cypher', {
    query: `
      UNWIND $sources AS row
      MATCH (s:KnowledgeSource {id: row.sourceId})
      UNWIND row.productTags AS product
      MERGE (p:KnowledgeProduct {id: product})
      MERGE (s)-[:ABOUT_PRODUCT]->(p)
    `,
    params: {
      sources: sourceTaxonomies.map(({ source, taxonomy }) => ({
        sourceId: String(source._id),
        productTags: taxonomy.productTags,
      })),
    },
  });

  await persistenceCall('neo4j', 'cypher', {
    query: `
      UNWIND $sources AS row
      MATCH (s:KnowledgeSource {id: row.sourceId})
      UNWIND row.topicTags AS topic
      MERGE (t:KnowledgeTopic {id: topic})
      MERGE (s)-[:ABOUT_TOPIC]->(t)
    `,
    params: {
      sources: sourceTaxonomies.map(({ source, taxonomy }) => ({
        sourceId: String(source._id),
        topicTags: taxonomy.topicTags,
      })),
    },
  });

  for (let i = 0; i < chunkTaxonomies.length; i += BATCH_SIZE) {
    const batch = chunkTaxonomies.slice(i, i + BATCH_SIZE);
    await persistenceCall('neo4j', 'cypher', {
      query: `
        UNWIND $chunks AS row
        MATCH (c:KnowledgeChunk {id: row.chunkId})
        SET c.taxonomyVersion = row.taxonomyVersion,
            c.primaryCategory = row.primaryCategory,
            c.categoryTags = row.categoryTags,
            c.productTags = row.productTags,
            c.topicTags = row.topicTags,
            c.complianceSensitivity = row.complianceSensitivity
      `,
      params: {
        chunks: batch.map(({ chunk, taxonomy }) => ({
          chunkId: chunk.chunkId ?? chunk._id,
          ...taxonomy,
        })),
      },
    });

    await persistenceCall('neo4j', 'cypher', {
      query: `
        UNWIND $chunks AS row
        MATCH (c:KnowledgeChunk {id: row.chunkId})
        UNWIND row.categoryTags AS category
        MERGE (cat:KnowledgeCategory {id: category})
        SET cat.label = row.categoryLabels[category]
        MERGE (c)-[:IN_CATEGORY]->(cat)
      `,
      params: {
        chunks: batch.map(({ chunk, taxonomy }) => ({
          chunkId: chunk.chunkId ?? chunk._id,
          categoryTags: taxonomy.categoryTags,
          categoryLabels: Object.fromEntries(taxonomy.categoryTags.map((tag) => [tag, categoryLabel(tag)])),
        })),
      },
    });

    await persistenceCall('neo4j', 'cypher', {
      query: `
        UNWIND $chunks AS row
        MATCH (c:KnowledgeChunk {id: row.chunkId})
        UNWIND row.productTags AS product
        MERGE (p:KnowledgeProduct {id: product})
        MERGE (c)-[:ABOUT_PRODUCT]->(p)
      `,
      params: {
        chunks: batch.map(({ chunk, taxonomy }) => ({
          chunkId: chunk.chunkId ?? chunk._id,
          productTags: taxonomy.productTags,
        })),
      },
    });

    await persistenceCall('neo4j', 'cypher', {
      query: `
        UNWIND $chunks AS row
        MATCH (c:KnowledgeChunk {id: row.chunkId})
        UNWIND row.topicTags AS topic
        MERGE (t:KnowledgeTopic {id: topic})
        MERGE (c)-[:ABOUT_TOPIC]->(t)
      `,
      params: {
        chunks: batch.map(({ chunk, taxonomy }) => ({
          chunkId: chunk.chunkId ?? chunk._id,
          topicTags: taxonomy.topicTags,
        })),
      },
    });
  }
}

async function main(): Promise<void> {
  await connectDirectPersistence();

  try {
    const db = getMongoConnection(DB).db;
    if (!db) throw new Error('Mongo database is not connected');
    const sources = await db.collection<SourceDoc>(SOURCE_COLLECTION).find({}).toArray();
    const chunks = await db.collection<ChunkDoc>(CHUNK_COLLECTION).find({}).toArray();
    const chunksBySource = new Map<string, ChunkDoc[]>();
    for (const chunk of chunks) {
      const list = chunksBySource.get(chunk.sourceId) ?? [];
      list.push(chunk);
      chunksBySource.set(chunk.sourceId, list);
    }
    const sourceById = new Map(sources.map((source) => [String(source._id), source]));
    const sourceTaxonomies: Array<{ source: SourceDoc; taxonomy: KnowledgeTaxonomy }> = [];
    const chunkTaxonomies: Array<{ chunk: ChunkDoc; taxonomy: KnowledgeTaxonomy }> = [];
    const taxonomyByChunkId = new Map<string, KnowledgeTaxonomy>();

    for (const source of sources) {
      const sourceChunks = chunksBySource.get(String(source._id)) ?? [];
      let taxonomy = classifyKnowledgeTaxonomy({
        title: source.title,
        sourceRef: source.sourceRef,
        domain: source.domain,
        topicTags: source.topicTags,
      });
      for (const chunk of sourceChunks) {
        const chunkTaxonomy = classifyKnowledgeTaxonomy({
          title: `${source.title ?? ''} ${chunk.title ?? ''} ${(chunk.text ?? chunk.summary ?? '').slice(0, 1500)}`,
          sourceRef: source.sourceRef,
          domain: chunk.domain ?? source.domain,
          topicTags: chunk.topicTags,
        });
        taxonomy = mergeTaxonomy(taxonomy, chunkTaxonomy);
        chunkTaxonomies.push({ chunk, taxonomy: chunkTaxonomy });
        taxonomyByChunkId.set(chunk._id, chunkTaxonomy);
      }
      sourceTaxonomies.push({ source, taxonomy });
    }

    if (sourceTaxonomies.length > 0) {
      await db.collection(SOURCE_COLLECTION).bulkWrite(
        sourceTaxonomies.map(({ source, taxonomy }) => ({
          updateOne: {
            filter: { _id: source._id },
            update: {
              $set: {
                taxonomy,
                categoryTags: taxonomy.categoryTags,
                productTags: taxonomy.productTags,
                canonicalTopicTags: taxonomy.topicTags,
                taxonomyUpdatedAt: new Date().toISOString(),
              },
            },
          },
        })),
      );
    }

    if (chunkTaxonomies.length > 0) {
      await db.collection(CHUNK_COLLECTION).bulkWrite(
        chunkTaxonomies.map(({ chunk, taxonomy }) => ({
          updateOne: {
            filter: { _id: chunk._id },
            update: {
              $set: {
                taxonomy,
                categoryTags: taxonomy.categoryTags,
                productTags: taxonomy.productTags,
                canonicalTopicTags: taxonomy.topicTags,
                taxonomyUpdatedAt: new Date().toISOString(),
              },
            },
          },
        })),
      );
    }

    const collectionId = await chromaCollectionId(CHROMA_CHUNK_COLLECTION);
    const chromaUpdated = await chromaUpdate(collectionId, chunks, sourceById, taxonomyByChunkId);
    await writeNeo4jTaxonomy(sourceTaxonomies, chunkTaxonomies);

    console.log(JSON.stringify({
      sources: sourceTaxonomies.length,
      chunks: chunkTaxonomies.length,
      chromaUpdated,
      categories: [...new Set(sourceTaxonomies.flatMap(({ taxonomy }) => taxonomy.categoryTags))].sort(),
      products: [...new Set(sourceTaxonomies.flatMap(({ taxonomy }) => taxonomy.productTags))].sort(),
    }, null, 2));
  } finally {
    await closeDirectPersistence();
  }
}

main().catch(async (err) => {
  console.error(`[kb-taxonomy] fatal: ${err instanceof Error ? err.stack ?? err.message : String(err)}`);
  await closeDirectPersistence();
  process.exitCode = 1;
});
