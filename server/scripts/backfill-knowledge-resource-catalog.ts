/**
 * Idempotently project Kevin-approved Knowledge Core sources into the Resource
 * Catalog. Dry-run by default; pass --apply to write Mongo + Neo4j + Chroma and
 * verify both the publish and retrieval gates.
 */

import type {
  McsKnowledgeBaseChunkRecord,
  McsKnowledgeBaseSourceRecord,
} from '@momentum/shared/runtime';
import { persistenceCall } from '../src/services/persistence/dispatch.js';
import { closeMongo, connectMongo } from '../src/services/persistence/mongo/connection.js';
import {
  buildKnowledgeResourceCatalogEntry,
  projectKevinApprovedKnowledgeSourceToCatalog,
} from '../src/services/knowledge/knowledgeResourceProjection.js';

const apply = process.argv.includes('--apply');

await connectMongo();

const sourcesResult = await persistenceCall<{ documents?: McsKnowledgeBaseSourceRecord[] }>('mongodb', 'query', {
  database: 'momentum',
  collection: 'mcs_knowledge_sources',
  filter: {
    status: 'active',
    authorityDecision: 'active_authority',
    'authority.authorityStatus': 'active_authority',
    'authority.authorityKind': { $in: ['kevin_authored', 'kevin_approved'] },
  },
  sort: { createdAt: 1 },
  limit: 2_000,
});
const chunksResult = await persistenceCall<{ documents?: McsKnowledgeBaseChunkRecord[] }>('mongodb', 'query', {
  database: 'momentum',
  collection: 'mcs_knowledge_chunks',
  filter: {
    status: 'active',
    retrievalEligible: true,
    authorityStatus: 'active_authority',
    surfaceScopes: 'team',
  },
  limit: 20_000,
});

const chunksBySource = new Map<string, McsKnowledgeBaseChunkRecord[]>();
for (const chunk of chunksResult.documents ?? []) {
  const key = String(chunk.sourceId);
  const rows = chunksBySource.get(key) ?? [];
  rows.push(chunk);
  chunksBySource.set(key, rows);
}

const sources = sourcesResult.documents ?? [];
const eligible: Array<{ source: McsKnowledgeBaseSourceRecord; chunks: McsKnowledgeBaseChunkRecord[] }> = [];
const skipped: Array<{ sourceId: string; reason: string }> = [];
for (const source of sources) {
  const chunks = chunksBySource.get(String(source.sourceId)) ?? [];
  try {
    buildKnowledgeResourceCatalogEntry({
      source,
      chunks,
      lifecycle: 'approved',
      updatedAt: new Date().toISOString(),
    });
    if (chunks.length === 0) skipped.push({ sourceId: String(source.sourceId), reason: 'approved_team_chunk_required' });
    else eligible.push({ source, chunks });
  } catch (error) {
    skipped.push({ sourceId: String(source.sourceId), reason: error instanceof Error ? error.message : String(error) });
  }
}

if (!apply) {
  console.log(JSON.stringify({ mode: 'dry-run', approvedSources: sources.length, eligible: eligible.length, skipped }, null, 2));
  await closeMongo();
  process.exit(0);
}

await persistenceCall('chromadb', 'create_collection', {
  name: 'mcs_resource_catalog',
  metadata: {
    project: 'momentum_creation_system_v2',
    purpose: 'Resource Catalog verified projection',
  },
});

let activated = 0;
const blocked: Array<{ sourceId: string; reasons: string[] }> = [];
for (const row of eligible) {
  try {
    const result = await projectKevinApprovedKnowledgeSourceToCatalog(row.source, row.chunks);
    if (result.active) activated += 1;
    else blocked.push({ sourceId: String(row.source.sourceId), reasons: result.reasons });
  } catch (error) {
    blocked.push({
      sourceId: String(row.source.sourceId),
      reasons: [error instanceof Error ? error.message : String(error)],
    });
  }
}

console.log(JSON.stringify({ mode: 'apply', approvedSources: sources.length, eligible: eligible.length, activated, skipped, blocked }, null, 2));
await closeMongo();
if (blocked.length > 0) process.exitCode = 1;
