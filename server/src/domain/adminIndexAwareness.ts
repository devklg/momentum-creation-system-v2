import { persistenceCall } from '../services/persistence/dispatch.js';
import { ADMIN_REQUIRED_INDEXES } from './adminIndexManifest.js';

type ObservedIndex = { name: string; keys: Record<string, 1 | -1>; unique: boolean };
type CollectionObservation = { collectionExists: boolean; indexes: ObservedIndex[]; unavailable: boolean };
export type AdminIndexState = 'observed' | 'missing' | 'definition_mismatch' | 'not_checked';

function sameKeys(left: Record<string, 1 | -1>, right: Record<string, 1 | -1>): boolean {
  return JSON.stringify(Object.entries(left)) === JSON.stringify(Object.entries(right));
}

export async function buildAdminIndexAwareness() {
  const collections = [...new Set(ADMIN_REQUIRED_INDEXES.map((row) => row.collection))];
  const observedByCollection = new Map<string, CollectionObservation>();
  await Promise.all(collections.map(async (collection) => {
    try {
      const result = await persistenceCall<{ collectionExists?: boolean; indexes: ObservedIndex[] }>(
        'mongodb',
        'list_indexes',
        { database: 'momentum', collection },
      );
      observedByCollection.set(collection, {
        collectionExists: result.collectionExists !== false,
        indexes: result.indexes ?? [],
        unavailable: false,
      });
    } catch {
      observedByCollection.set(collection, {
        collectionExists: false,
        indexes: [],
        unavailable: true,
      });
    }
  }));

  const indexes = ADMIN_REQUIRED_INDEXES.map((required) => {
    const observation = observedByCollection.get(required.collection);
    const named = observation?.indexes.find((candidate) => candidate.name === required.name);
    const state: AdminIndexState = observation?.unavailable
      ? 'not_checked'
      : !named
        ? 'missing'
      : sameKeys(required.keys, named.keys) && !named.unique
        ? 'observed'
        : 'definition_mismatch';
    return {
      ...required,
      required: true as const,
      state,
      observed: named ?? null,
    };
  });
  return {
    ok: true as const,
    schemaVersion: 'admin_index_awareness.v1' as const,
    mutationAuthorized: false as const,
    observedAt: new Date().toISOString(),
    summary: {
      required: indexes.length,
      observed: indexes.filter((row) => row.state === 'observed').length,
      missing: indexes.filter((row) => row.state === 'missing').length,
      definitionMismatch: indexes.filter((row) => row.state === 'definition_mismatch').length,
      notChecked: indexes.filter((row) => row.state === 'not_checked').length,
    },
    indexes,
  };
}
