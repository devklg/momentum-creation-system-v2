/**
 * Persistence dispatch client — DIRECT-ONLY (ACR-0007 / ACR-0009).
 *
 * Every persistence call lands on the app's own direct adapters
 * (services/persistence/{mongo,neo4j,chroma}) against the dedicated governed
 * stack (Mongo :30000 · Neo4j :7710 · Chroma :8200). There is NO runtime path
 * to the Universal Gateway: Gateway V2 (localhost:2526) is MCP developer
 * tooling for AI agents only and is never a production runtime dependency.
 * The former Gateway HTTP fallback was retired by ACR-0009 (2026-07-01);
 * a store whose persistence mode is not 'direct' now fails LOUD at dispatch
 * instead of silently routing through developer tooling.
 *
 * The exported names (`gatewayCall`, `GatewayError`) are preserved solely so
 * the ~405 historical call sites keep compiling and their error guards keep
 * matching (ACR-0007 Part B incremental pattern). A repo-wide rename to
 * `persistenceCall` / `PersistenceError` is tracked as a Phase 11 follow-up.
 */

import { isDirect, type PersistenceStore } from './persistence/flags.js';

export class GatewayError extends Error {
  constructor(
    public readonly tool: string,
    public readonly action: string,
    message: string,
  ) {
    super(`[gateway:${tool}.${action}] ${message}`);
    this.name = 'GatewayError';
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

async function directPersistenceCall<T>(
  store: PersistenceStore,
  action: string,
  params: Record<string, unknown>,
): Promise<T> {
  try {
    switch (store) {
      case 'mongodb': {
        const { mongoAdapter } = await import('./persistence/mongo/adapter.js');
        return (await mongoAdapter(action, params)) as T;
      }
      case 'neo4j': {
        const { neo4jAdapter } = await import('./persistence/neo4j/adapter.js');
        return (await neo4jAdapter(action, params)) as T;
      }
      case 'chromadb': {
        const { chromaAdapter } = await import('./persistence/chroma/adapter.js');
        return (await chromaAdapter(action, params)) as T;
      }
    }
  } catch (err) {
    if (err instanceof GatewayError) throw err;
    throw new GatewayError(store, action, err instanceof Error ? err.message : String(err));
  }
}

export async function gatewayCall<T = unknown>(
  tool: string,
  action: string,
  params: Record<string, unknown>,
): Promise<T> {
  const directStore = persistenceStoreForTool(tool);
  if (!directStore) {
    throw new GatewayError(
      tool,
      action,
      'runtime Gateway calls are retired (ACR-0007/ACR-0009) — the Universal ' +
        'Gateway is developer tooling only, and no runtime tool maps to it',
    );
  }
  if (!isDirect(directStore)) {
    throw new GatewayError(
      directStore,
      action,
      `persistence mode for '${directStore}' is not 'direct' — the Gateway HTTP ` +
        `fallback is retired (ACR-0009). Set PERSISTENCE_DIRECT_ENABLED=true and ` +
        `${STORE_MODE_ENV_NAME[directStore]}=direct.`,
    );
  }
  return directPersistenceCall<T>(directStore, action, params);
}
