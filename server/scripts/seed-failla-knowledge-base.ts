import { readFile, stat } from 'node:fs/promises';
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

// Don Failla — foundational MLM training. One KB source for the whole book
// (chapters 1–4 of 15), clean Docling full-page OCR. Triple-stacked to the
// dedicated stack via the governed intake pipeline, same as the upline corpus.
const SRC = 'D:/foundational-library/how-2-build/how-2-build-ch1-4-docling-fullocr.md';
const TITLE = 'Don Failla — How To Build A Large Successful Multi-Level Marketing Organization (Ch 1–4)';
const CREATED_BY = 'TMAG-01';
const AUTHORITY_BY = 'Kevin L. Gardner';

interface MongoQueryResult { count?: number; documents?: Array<Record<string, unknown>>; }

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
  try {
    const sourceRef = `file:${SRC}`;
    if (await alreadyIngested(sourceRef)) {
      console.log(`[failla-kb] already ingested ${sourceRef} — skipping`);
      return;
    }
    const content = await readFile(SRC, 'utf-8');
    const info = await stat(SRC);
    const result = await createKevinApprovedKnowledgeSource({
      title: TITLE,
      content,
      createdBy: CREATED_BY,
      authorityKind: 'kevin_approved',
      authorityBy: AUTHORITY_BY,
      authorityRef: 'foundational-library:how-2-build-ch1-4-docling-fullocr',
      sourceType: 'owned_text',
      sourceRef,
      domain: 'training',
      language: 'en',
      format: 'markdown',
      topicTags: ['failla', 'napkin-presentations', 'mlm-fundamentals', 'foundational-library', '45-second-presentation', 'sponsoring', 'duplication'],
      agentScopes: ['steve_success', 'michael_magnificent'],
      upload: {
        filename: 'how-2-build-ch1-4-docling-fullocr.md',
        originalBytes: info.size,
        extractedCharacters: content.length,
        sourceRef,
      },
    });
    console.log(`[failla-kb] created source=${result.source.sourceId} chunks=${result.chunkCount} indexRecords=${result.indexRecordCount}`);
  } finally {
    await closeDirectPersistence();
  }
}

main().catch(async (err) => {
  console.error(`[failla-kb] fatal: ${err instanceof Error ? err.stack ?? err.message : String(err)}`);
  await closeDirectPersistence();
  process.exitCode = 1;
});
