import { isDirect, persistenceModeSnapshot } from './flags.js';
import { closeMongo, connectMongo, mongoHealth } from './mongo/connection.js';
import { closeNeo4j, connectNeo4j, neo4jHealth } from './neo4j/connection.js';
import { chromaHealth } from './chroma/connection.js';
import { embedderHealth } from './chroma/embedder.js';

export async function connectDirectPersistence(): Promise<void> {
  if (isDirect('mongodb')) await connectMongo();
  if (isDirect('neo4j')) await connectNeo4j();
  if (isDirect('chromadb')) {
    const [chromaOk, embedderOk] = await Promise.all([chromaHealth(), embedderHealth()]);
    if (!chromaOk) throw new Error('[persistence] Chroma direct mode requested but Chroma is unavailable');
    if (!embedderOk) {
      throw new Error(
        '[persistence] Chroma direct mode requested but GPU embedder is unavailable — no CPU fallback',
      );
    }
  }
}

export async function directPersistenceHealth(): Promise<{
  snapshot: ReturnType<typeof persistenceModeSnapshot>;
  stores: { mongodb?: boolean; neo4j?: boolean; chromadb?: boolean; gpuEmbedder?: boolean };
}> {
  const stores: { mongodb?: boolean; neo4j?: boolean; chromadb?: boolean; gpuEmbedder?: boolean } = {};
  if (isDirect('mongodb')) stores.mongodb = await mongoHealth();
  if (isDirect('neo4j')) stores.neo4j = await neo4jHealth();
  if (isDirect('chromadb')) {
    stores.chromadb = await chromaHealth();
    stores.gpuEmbedder = await embedderHealth();
  }
  return { snapshot: persistenceModeSnapshot(), stores };
}

export async function closeDirectPersistence(): Promise<void> {
  await Promise.all([closeMongo(), closeNeo4j()]);
}

export function installDirectPersistenceShutdownHooks(): void {
  const shutdown = (): void => {
    void closeDirectPersistence();
  };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
}
