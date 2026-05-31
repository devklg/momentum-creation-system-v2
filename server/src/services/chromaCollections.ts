/**
 * ChromaDB collection registry + boot/write-time guards (Chat #147, wireframe §5).
 *
 * Why this exists — the #145 incident (same failure class as the #140
 * audit_log fix): ChromaDB add() does NOT auto-create collections (CK-04
 * lesson, also in tripleStack.ts header). `mcs_ivory` was never bootstrapped,
 * so every Ivory "ADD A NAME" 500'd on the Chroma leg AFTER Mongo had already
 * committed — leaving orphan rows in Mongo with no searchable Chroma twin and
 * no loud signal that the triple-stack had half-written.
 *
 * Two layers close that gap for good:
 *
 *   1. ensureChromaCollections() — run at BOOT (server/src/index.ts, before
 *      listen). Lists what exists, idempotently CREATES every registered
 *      collection that's missing, and logs loudly which it had to create. A
 *      fresh environment self-heals; an operator sees exactly what was absent.
 *
 *   2. assertChromaCollectionExists() — run on the WRITE path
 *      (tripleStackWrite, BEFORE the Mongo insert). If a write targets a
 *      collection that genuinely does not exist (e.g. a new domain forgot to
 *      register it here), it throws BEFORE Mongo lands — failing loud on the
 *      Chroma leg instead of orphaning a Mongo row. Backed by an in-process
 *      cache seeded by the boot ensure, so the steady-state hot path makes no
 *      extra gateway calls.
 *
 * SINGLE SOURCE OF TRUTH: when a new domain writes to a new Chroma collection,
 * add its name here. Anything written but not registered will be caught loud
 * by layer 2 on first use rather than silently half-writing.
 */

import { gatewayCall } from './gateway.js';

/**
 * Every ChromaDB collection the server writes to. Grep anchor: each entry
 * mirrors a `chroma: { collection: ... }` / `chromadb.add` site in server/src.
 */
export const CHROMA_COLLECTIONS: readonly string[] = [
  'mcs_invitations', // domain/invitations.ts, domain/crm.ts
  'mcs_callback_requests', // domain/callbackRequest.ts
  'mcs_pool_events', // domain/holdingTank.ts
  'mcs_ivory', // domain/ivory.ts, domain/generator.ts
  'mcs_audit_log', // domain/auditLog.ts
  'audit_log', // domain/adminBaOversight.ts (sponsor-override audit line)
  'admin_prospect_notes', // domain/adminProspectOversight.ts
  'mcs_michael_interviews', // domain/michaelScoring.ts
  'mcs_michael_schedules', // domain/michael-schedule.ts
  'mcs_access_codes', // domain/codeGen.ts
  'mcs_commitments', // domain/commitments.ts
  'mcs_ba_questionnaires', // domain/questionnaire.ts
  'mcs_ba_workbooks', // domain/workbook.ts
  'mcs_broadcasts', // domain/broadcast.ts
  'mcs_tenant_settings', // domain/adminTenantArchitecture.ts (settings)
  'mcs_master_content', // domain/adminTenantArchitecture.ts (templates)
  'mcs_prospect_accounts', // domain/prospectAccount.ts
  'mcs_prospect_magic_links', // domain/prospectMagicLink.ts
  'mcs_webinar_reservations', // domain/webinarReservation.ts
  'mcs_training_progress', // domain/training.ts (also lazy-bootstrapped there)
] as const;

/** Thrown by the write-time guard when a Chroma collection is absent. */
export class ChromaCollectionMissingError extends Error {
  constructor(public readonly collection: string) {
    super(
      `[chroma] collection '${collection}' does not exist — refusing to ` +
        `triple-stack write (would orphan a Mongo row). Register it in ` +
        `services/chromaCollections.ts and/or create it at boot.`,
    );
    this.name = 'ChromaCollectionMissingError';
  }
}

/** In-process cache of collection names confirmed to exist this run. */
const known = new Set<string>();

async function fetchExistingCollections(): Promise<string[]> {
  const data = await gatewayCall<{
    count?: number;
    collections?: Array<{ name?: string }>;
  }>('chromadb', 'list_collections', {});
  return (data.collections ?? [])
    .map((c) => c.name)
    .filter((n): n is string => typeof n === 'string');
}

/**
 * Refresh the in-process cache from the gateway. Returns the set of names that
 * currently exist. Cheap-ish (one list call); used at boot and on cache miss.
 */
async function refreshKnown(): Promise<Set<string>> {
  const existing = await fetchExistingCollections();
  for (const name of existing) known.add(name);
  return new Set(existing);
}

/**
 * BOOT GUARD. Verify every registered Chroma collection exists; create the
 * missing ones (idempotent) so the triple-stack never half-writes for lack of
 * a collection. Logs loudly which collections were created vs already present.
 *
 * Non-fatal if the gateway itself is unreachable at boot — that is a distinct
 * failure class (gateway down ≠ collection missing) and should not brick the
 * API server's startup; the write-time guard still protects every write once
 * the gateway is back.
 */
export async function ensureChromaCollections(): Promise<void> {
  let existing: Set<string>;
  try {
    existing = await refreshKnown();
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(
      `[chroma-boot] could not list collections (gateway unreachable?) — ` +
        `skipping ensure; write-time guard remains active. ${
          err instanceof Error ? err.message : String(err)
        }`,
    );
    return;
  }

  const missing = CHROMA_COLLECTIONS.filter((name) => !existing.has(name));
  if (missing.length === 0) {
    // eslint-disable-next-line no-console
    console.log(
      `[chroma-boot] all ${CHROMA_COLLECTIONS.length} registered collections present.`,
    );
    return;
  }

  // eslint-disable-next-line no-console
  console.warn(
    `[chroma-boot] ${missing.length} registered collection(s) MISSING, creating: ${missing.join(', ')}`,
  );

  for (const name of missing) {
    try {
      await gatewayCall('chromadb', 'create_collection', {
        name,
        metadata: {
          chat_number: 147,
          project: 'momentum_creation_system_v1',
          purpose: 'auto-created by boot-time triple-stack collection assertion',
        },
      });
      known.add(name);
      // eslint-disable-next-line no-console
      console.log(`[chroma-boot] CREATED missing collection '${name}'.`);
    } catch (err) {
      // create_collection throws on a concurrent duplicate — treat as present.
      const msg = String(err instanceof Error ? err.message : err).toLowerCase();
      if (msg.includes('exist') || msg.includes('duplicate')) {
        known.add(name);
        continue;
      }
      // eslint-disable-next-line no-console
      console.error(
        `[chroma-boot] FAILED to create collection '${name}': ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }
}

/**
 * WRITE GUARD. Assert a Chroma collection exists before a triple-stack write
 * commits its Mongo leg. Throws {@link ChromaCollectionMissingError} when the
 * collection is absent — failing loud instead of letting Mongo land alone.
 *
 * Cache-first: a hit (the steady state after the boot ensure) is free. On a
 * miss it refreshes once from the gateway — covering collections created at
 * runtime (e.g. training's lazy bootstrap) — and only throws if still absent.
 */
export async function assertChromaCollectionExists(collection: string): Promise<void> {
  if (known.has(collection)) return;
  const existing = await refreshKnown();
  if (existing.has(collection)) return;
  throw new ChromaCollectionMissingError(collection);
}
