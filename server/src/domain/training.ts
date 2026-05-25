/**
 * Fast Start Training — per-BA module progress domain
 * (feat/fast-start-training · wireframe 3.5).
 *
 * One record per (baId, moduleId). Forward-only state transitions:
 *   not_started → in_progress → completed
 * Backward writes are rejected idempotently (the route returns the
 * current state without erroring) so a double-click on "mark complete"
 * after the user navigates back is safe.
 *
 * Sponsor immutability (locked-spec 3.5): every write stamps baId from
 * the authed session (passed in by the route layer). Nothing in a body
 * can target another BA's progress.
 *
 * Triple-stack discipline (CLAUDE.md / locked-spec):
 *   - First write: tripleStackWrite — Mongo insert + Neo4j MERGE + Chroma add.
 *   - Update: mongo.update + neo4j MATCH-SET (no Chroma re-add — the
 *     embedding text doesn't change between in_progress and completed
 *     for the same module).
 *   - Chroma collection `mcs_training_progress` self-bootstraps lazily
 *     on first use so this branch needs no boot-order changes to
 *     server/src/index.ts (worktree hard rule #2).
 *
 * Completion definition (TASK.md, this branch):
 *   complete = (every module status === 'completed') AND
 *              (invitationsSent >= 1)
 * invitationsSent is read from the Chat #119 spine — we cross-check
 * the prospects collection for sponsorBaId=baId AND sentAt IS NOT NULL.
 * Fast Start does not duplicate the count.
 */

import { gatewayCall } from '../services/gateway.js';
import { tripleStackWrite } from '../services/tripleStack.js';
import type {
  FastStartMarkStateResponse,
  FastStartModuleId,
  FastStartModuleState,
  FastStartModuleStatus,
  FastStartProgressRecord,
  FastStartProgressResponse,
} from '@momentum/shared';
import { FAST_START_MODULES } from '@momentum/shared';

const MONGO_DB = 'momentum';
const PROGRESS_COLLECTION = 'fast_start_progress';
const PROSPECTS_COLLECTION = 'prospects';
const CHROMA_COLLECTION = 'mcs_training_progress';

const VALID_MODULE_IDS: readonly FastStartModuleId[] = [1, 2, 3, 4, 5];

export function isValidModuleId(n: unknown): n is FastStartModuleId {
  return typeof n === 'number' && VALID_MODULE_IDS.includes(n as FastStartModuleId);
}

function compositeId(baId: string, moduleId: FastStartModuleId): string {
  return `${baId}__module-${moduleId}`;
}

/* ──────────────────────────────────────────────────────────────────
 * Lazy Chroma bootstrap — fires once per process, idempotent.
 * Avoids touching server/src/index.ts boot (worktree hard rule #2).
 * ────────────────────────────────────────────────────────────────── */
let collectionBootstrap: Promise<void> | null = null;

function isAlreadyExistsError(err: unknown): boolean {
  const s = String(err instanceof Error ? err.message : err).toLowerCase();
  return (
    s.includes('already exists') ||
    s.includes('uniqueconstraint') ||
    s.includes('exists') ||
    s.includes('duplicate')
  );
}

async function ensureProgressCollection(): Promise<void> {
  if (collectionBootstrap) return collectionBootstrap;
  collectionBootstrap = (async () => {
    try {
      await gatewayCall('chromadb', 'create_collection', {
        name: CHROMA_COLLECTION,
        metadata: {
          branch: 'feat/fast-start-training',
          wireframe_leaf: '3.5',
          purpose: 'Fast Start module progress events',
        },
      });
    } catch (err) {
      if (!isAlreadyExistsError(err)) throw err;
    }
  })();
  return collectionBootstrap;
}

/* ──────────────────────────────────────────────────────────────────
 * Reads
 * ────────────────────────────────────────────────────────────────── */

async function findProgress(
  baId: string,
  moduleId: FastStartModuleId,
): Promise<FastStartProgressRecord | null> {
  const data = await gatewayCall<{ documents?: FastStartProgressRecord[] }>(
    'mongodb',
    'query',
    {
      database: MONGO_DB,
      collection: PROGRESS_COLLECTION,
      filter: { baId, moduleId },
      limit: 1,
    },
  );
  return data.documents?.[0] ?? null;
}

async function findAllProgress(baId: string): Promise<FastStartProgressRecord[]> {
  const data = await gatewayCall<{ documents?: FastStartProgressRecord[] }>(
    'mongodb',
    'query',
    {
      database: MONGO_DB,
      collection: PROGRESS_COLLECTION,
      filter: { baId },
      limit: 10,
    },
  );
  return data.documents ?? [];
}

async function countSentInvitations(baId: string): Promise<number> {
  const data = await gatewayCall<{ count?: number; documents?: unknown[] }>(
    'mongodb',
    'query',
    {
      database: MONGO_DB,
      collection: PROSPECTS_COLLECTION,
      filter: { sponsorBaId: baId, sentAt: { $ne: null } },
      limit: 1,
    },
  );
  if (typeof data.count === 'number') return data.count;
  return data.documents?.length ?? 0;
}

/**
 * Return the BA's full Fast Start state — one status per module (synthesizing
 * `not_started` for modules with no row yet) + the invitation cross-check.
 */
export async function getFastStartProgress(
  baId: string,
): Promise<FastStartProgressResponse> {
  const [rows, invitationsSent] = await Promise.all([
    findAllProgress(baId),
    countSentInvitations(baId),
  ]);

  const byModule = new Map<FastStartModuleId, FastStartProgressRecord>();
  for (const r of rows) byModule.set(r.moduleId, r);

  const modules: FastStartModuleStatus[] = FAST_START_MODULES.map((m) => {
    const row = byModule.get(m.id);
    if (!row) {
      return {
        moduleId: m.id,
        state: 'not_started',
        startedAt: null,
        completedAt: null,
      };
    }
    return {
      moduleId: m.id,
      state: row.state,
      startedAt: row.startedAt,
      completedAt: row.completedAt,
    };
  });

  const allComplete = modules.every((m) => m.state === 'completed');
  const complete = allComplete && invitationsSent >= 1;

  return { ok: true, modules, invitationsSent, complete };
}

/* ──────────────────────────────────────────────────────────────────
 * Writes — state transitions
 * ────────────────────────────────────────────────────────────────── */

function isBackwardTransition(
  from: FastStartModuleState,
  to: FastStartModuleState,
): boolean {
  if (from === 'completed' && to !== 'completed') return true;
  if (from === 'in_progress' && to === 'not_started') return true;
  return false;
}

/**
 * Idempotent forward state transition. Creates the row on first touch
 * (triple-stack) or updates it (mongo+neo4j). Backward writes return
 * the existing state without erroring — the UI's "mark complete" button
 * after a back-button revisit is harmless.
 */
export async function markFastStartModuleState(args: {
  baId: string;
  moduleId: FastStartModuleId;
  to: Exclude<FastStartModuleState, 'not_started'>;
  occurredAt: string;
}): Promise<FastStartMarkStateResponse> {
  const { baId, moduleId, to, occurredAt } = args;
  const existing = await findProgress(baId, moduleId);

  // ── First touch: insert via triple-stack ────────────────────────────
  if (!existing) {
    await ensureProgressCollection();
    const _id = compositeId(baId, moduleId);
    const startedAt = occurredAt;
    const completedAt = to === 'completed' ? occurredAt : null;

    const doc: FastStartProgressRecord = {
      _id,
      baId,
      moduleId,
      state: to,
      startedAt,
      completedAt,
      updatedAt: occurredAt,
      createdAt: occurredAt,
    };

    const chromaDoc = `BA ${baId} ${to} Fast Start module ${moduleId}`;

    await tripleStackWrite({
      id: _id,
      mongoCollection: PROGRESS_COLLECTION,
      mongoDoc: doc as unknown as Record<string, unknown>,
      neo4j: {
        cypher:
          'MERGE (b:BrandAmbassador {baId: $baId}) ' +
          'MERGE (p:FastStartProgress {progressId: $id}) ' +
          'SET p.baId = $baId, p.moduleId = $moduleId, p.state = $state, ' +
          '    p.startedAt = $startedAt, p.completedAt = $completedAt, ' +
          '    p.updatedAt = $updatedAt, p.createdAt = $createdAt ' +
          'MERGE (b)-[:HAS_PROGRESS]->(p)',
        params: {
          baId,
          moduleId,
          state: to,
          startedAt,
          completedAt,
          updatedAt: occurredAt,
          createdAt: occurredAt,
        },
      },
      chroma: {
        collection: CHROMA_COLLECTION,
        document: chromaDoc,
        metadata: {
          baId,
          moduleId,
          state: to,
          updatedAt: occurredAt,
        },
      },
    });

    return {
      ok: true,
      moduleId,
      state: to,
      startedAt,
      completedAt,
    };
  }

  // ── Backward / no-op: return existing state ─────────────────────────
  if (existing.state === to || isBackwardTransition(existing.state, to)) {
    return {
      ok: true,
      moduleId,
      state: existing.state,
      startedAt: existing.startedAt,
      completedAt: existing.completedAt,
    };
  }

  // ── Forward update: mongo + neo4j (skip Chroma; embedding text doesn't change) ──
  const startedAt = existing.startedAt ?? occurredAt;
  const completedAt = to === 'completed' ? occurredAt : existing.completedAt;

  await gatewayCall('mongodb', 'update', {
    database: MONGO_DB,
    collection: PROGRESS_COLLECTION,
    filter: { _id: existing._id },
    update: {
      $set: {
        state: to,
        startedAt,
        completedAt,
        updatedAt: occurredAt,
      },
    },
  });

  await gatewayCall('neo4j', 'cypher', {
    query:
      'MATCH (p:FastStartProgress {progressId: $id}) ' +
      'SET p.state = $state, p.startedAt = $startedAt, ' +
      '    p.completedAt = $completedAt, p.updatedAt = $updatedAt',
    params: {
      id: existing._id,
      state: to,
      startedAt,
      completedAt,
      updatedAt: occurredAt,
    },
  });

  return {
    ok: true,
    moduleId,
    state: to,
    startedAt,
    completedAt,
  };
}
