import { closeDirectPersistence, connectDirectPersistence } from '../src/services/persistence/index.js';
import { updateKnowledgeDocumentIndex } from '../src/services/knowledge/documentIndex.js';

async function main(): Promise<void> {
  await connectDirectPersistence();

  try {
    const result = await updateKnowledgeDocumentIndex({
      refreshAll: process.argv.includes('--refresh'),
    });
    console.log(
      `[kb-index] ${result.mode} ${result.rowCount} rows ` +
        `(total sources in DB: ${result.totalSources}) -> ${result.path}`,
    );
  } finally {
    await closeDirectPersistence();
  }
}

main().catch(async (err) => {
  console.error(`[kb-index] fatal: ${err instanceof Error ? err.stack ?? err.message : String(err)}`);
  await closeDirectPersistence();
  process.exitCode = 1;
});
