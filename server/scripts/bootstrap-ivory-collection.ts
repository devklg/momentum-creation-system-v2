/**
 * Bootstrap the ChromaDB collection backing Ivory (Chat #131, wireframe §3.4).
 *
 * ChromaDB add() does not auto-create collections. The Ivory domain triple-stacks to
 * `mcs_ivory` for both roster events and Generator-run lifecycle events, so
 * the collection must exist before the first write lands.
 *
 * Idempotent — create_collection throws on duplicate, which we swallow.
 *
 * Usage:  pnpm --filter @momentum/server bootstrap:ivory
 */

import { persistenceCall } from '../src/services/persistence/dispatch.js';

const CHROMA_COLLECTION = 'mcs_ivory';

async function main(): Promise<void> {
  try {
    await persistenceCall('chromadb', 'create_collection', {
      name: CHROMA_COLLECTION,
      metadata: {
        chat_number: 131,
        project: 'momentum_creation_system_v1',
        description:
          'Ivory warm-market roster events + Generator run lifecycle (per-BA, BA-private).',
      },
    });
    // eslint-disable-next-line no-console
    console.log(
      `[bootstrap] chroma collection '${CHROMA_COLLECTION}' ready (created)`,
    );
  } catch (err) {
    // create throws on duplicate — safe to continue.
    // eslint-disable-next-line no-console
    console.log(
      `[bootstrap] chroma collection '${CHROMA_COLLECTION}' ready (exists)`,
      err instanceof Error ? `[${err.message}]` : '',
    );
  }
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('[bootstrap-ivory-collection] fatal:', err);
  process.exit(1);
});
