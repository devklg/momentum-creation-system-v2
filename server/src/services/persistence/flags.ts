/**
 * Per-store persistence mode flags (ACR-0007 / ACR-0009).
 *
 * DIRECT is the only supported runtime dispatch mode. The former Gateway HTTP
 * fallback was retired by ACR-0009: when a store resolves to 'gateway' (legacy
 * .env, or the master switch off), services/gateway.ts fails LOUD at dispatch
 * instead of routing through developer tooling. These flags therefore act as
 * boot/dispatch validation plus a kill switch, not a routing choice.
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

export interface PersistenceFlagConfig {
  directEnabled: boolean;
  storeModes: Record<PersistenceStore, PersistenceMode>;
}

export function resolveModeFromConfig(
  config: PersistenceFlagConfig,
  store: PersistenceStore,
): PersistenceMode {
  if (!config.directEnabled) return 'gateway';
  return config.storeModes[store];
}

function currentConfig(): PersistenceFlagConfig {
  return {
    directEnabled: env.PERSISTENCE_DIRECT_ENABLED,
    storeModes: STORE_MODE_ENV,
  };
}

/** Resolve the effective persistence mode for a store. */
export function resolveMode(store: PersistenceStore): PersistenceMode {
  return resolveModeFromConfig(currentConfig(), store);
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
