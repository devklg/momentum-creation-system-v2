/**
 * S1.3 per-store persistence mode flags (ACR-0007 / Option C).
 *
 * A store is dispatched DIRECT only when BOTH:
 *   - PERSISTENCE_DIRECT_ENABLED is true (master safety switch), AND
 *   - that store's PERSISTENCE_<STORE>_MODE is 'direct'.
 * Otherwise the store stays on the Gateway HTTP path (the default).
 *
 * Phase 0/1 ship with PERSISTENCE_DIRECT_ENABLED=false, so resolveMode()
 * returns 'gateway' for every store and runtime behavior is unchanged. The
 * dispatcher wiring that consumes these flags is Phase 2 (out of this scope).
 */
import { env } from '../../env.js';

export type PersistenceStore = 'mongodb' | 'neo4j' | 'chromadb';
export type PersistenceMode = 'gateway' | 'direct';

const STORE_MODE_ENV: Record<PersistenceStore, PersistenceMode> = {
  mongodb: env.PERSISTENCE_MONGO_MODE,
  neo4j: env.PERSISTENCE_NEO4J_MODE,
  chromadb: env.PERSISTENCE_CHROMA_MODE,
};

const ALL_STORES: readonly PersistenceStore[] = ['mongodb', 'neo4j', 'chromadb'];

/** Resolve the effective persistence mode for a store. */
export function resolveMode(store: PersistenceStore): PersistenceMode {
  if (!env.PERSISTENCE_DIRECT_ENABLED) return 'gateway';
  return STORE_MODE_ENV[store];
}

/** True iff the store should use the direct adapter. */
export function isDirect(store: PersistenceStore): boolean {
  return resolveMode(store) === 'direct';
}

/** True iff any store is in direct mode (decides whether to open direct connections at boot). */
export function anyDirect(): boolean {
  return ALL_STORES.some(isDirect);
}

/** Whether the GPU embedder is required (no CPU fallback) for Chroma direct writes. */
export function gpuEmbedderRequired(): boolean {
  return env.GPU_EMBEDDER_REQUIRED;
}

/** Diagnostics snapshot for health/verification surfaces. */
export function persistenceModeSnapshot(): {
  directEnabled: boolean;
  gpuEmbedderRequired: boolean;
  modes: Record<PersistenceStore, PersistenceMode>;
} {
  return {
    directEnabled: env.PERSISTENCE_DIRECT_ENABLED,
    gpuEmbedderRequired: env.GPU_EMBEDDER_REQUIRED,
    modes: {
      mongodb: resolveMode('mongodb'),
      neo4j: resolveMode('neo4j'),
      chromadb: resolveMode('chromadb'),
    },
  };
}
