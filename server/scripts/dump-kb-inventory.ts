// Dump the full KB source inventory (dedicated stack) to JSON for the index builder.
import { writeFile } from 'node:fs/promises';
import { persistenceCall } from '../src/services/persistence/dispatch.js';
import { closeDirectPersistence, connectDirectPersistence } from '../src/services/persistence/index.js';

interface QueryResult { documents?: Array<Record<string, unknown>>; count?: number; }

async function main(): Promise<void> {
  await connectDirectPersistence();
  try {
    const res = await persistenceCall<QueryResult>('mongodb', 'aggregate', {
      database: 'momentum',
      collection: 'mcs_knowledge_sources',
      pipeline: [
        { $project: { _id: 0, sourceId: 1, title: 1, domain: 1, language: 1,
          chunkCount: 1, sourceType: 1, sourceRef: 1, createdAt: 1,
          authorityKind: '$authority.authorityKind' } },
        { $sort: { domain: 1, title: 1 } },
      ],
    });
    const anyRes = res as unknown as Record<string, unknown>;
    const docs = (res.documents
      ?? (anyRes.results as Array<Record<string, unknown>> | undefined)
      ?? (Array.isArray(anyRes) ? (anyRes as Array<Record<string, unknown>>) : undefined)
      ?? []) as Array<Record<string, unknown>>;
    await writeFile('D:/mcs-v2-acr0011/kb-inventory.json', JSON.stringify(docs, null, 2), 'utf-8');
    console.log(`[kb-dump] wrote ${docs.length} sources`);
  } finally {
    await closeDirectPersistence();
  }
}
main().catch(async (e) => { console.error(e); await closeDirectPersistence(); process.exitCode = 1; });
