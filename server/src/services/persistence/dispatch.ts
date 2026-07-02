/**
 * Persistence dispatch client — DIRECT-ONLY (ACR-0007 / ACR-0009).
 *
 * Every persistence call lands on the app's own direct adapters
 * (services/persistence/{mongo,neo4j,chroma}) against the dedicated governed
 * stack (Mongo :30000 · Neo4j :7710 · Chroma :8200). There is no runtime
 * adapter, fallback, or tool-server path outside those app stores.
 */

import { isDirect, type PersistenceStore } from './flags.js';

export class PersistenceError extends Error {
  constructor(
    public readonly tool: string,
    public readonly action: string,
    message: string,
  ) {
    super(`[persistence:${tool}.${action}] ${message}`);
    this.name = 'PersistenceError';
  }
}

function persistenceStoreForTool(tool: string): PersistenceStore | undefined {
  switch (tool) {
    case 'mongodb':
    case 'neo4j':
    case 'chromadb':
      return tool;
    default:
      return undefined;
  }
}

const STORE_MODE_ENV_NAME: Record<PersistenceStore, string> = {
  mongodb: 'PERSISTENCE_MONGO_MODE',
  neo4j: 'PERSISTENCE_NEO4J_MODE',
  chromadb: 'PERSISTENCE_CHROMA_MODE',
};

async function directStoreCall<T>(
  store: PersistenceStore,
  action: string,
  params: Record<string, unknown>,
): Promise<T> {
  try {
    switch (store) {
      case 'mongodb': {
        const { mongoAdapter } = await import('./mongo/adapter.js');
        return (await mongoAdapter(action, params)) as T;
      }
      case 'neo4j': {
        const { neo4jAdapter } = await import('./neo4j/adapter.js');
        return (await neo4jAdapter(action, params)) as T;
      }
      case 'chromadb': {
        const { chromaAdapter } = await import('./chroma/adapter.js');
        return (await chromaAdapter(action, params)) as T;
      }
    }
  } catch (err) {
    if (err instanceof PersistenceError) throw err;
    throw new PersistenceError(store, action, err instanceof Error ? err.message : String(err));
  }
}

export async function persistenceCall<T = unknown>(
  tool: string,
  action: string,
  params: Record<string, unknown>,
): Promise<T> {
  const directStore = persistenceStoreForTool(tool);
  if (!directStore) {
    throw new PersistenceError(
      tool,
      action,
      'runtime persistence dispatch only supports the app MongoDB, Neo4j, and ChromaDB stores',
    );
  }
  if (!isDirect(directStore)) {
    throw new PersistenceError(
      directStore,
      action,
      `persistence mode for '${directStore}' is not 'direct'. Set PERSISTENCE_DIRECT_ENABLED=true and ` +
        `${STORE_MODE_ENV_NAME[directStore]}=direct.`,
    );
  }
  return directStoreCall<T>(directStore, action, params);
}
