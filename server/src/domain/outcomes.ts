/**
 * Outcome capture domain (Phase 7 · R1 — P7.4 Outcome Capture Contract).
 *
 * Persists a BA-CONFIRMED, BA-scoped, team-scoped real-world outcome through the
 * single app-direct tripleStackWrite seam into the app's own dedicated stores
 * (Mongo `momentum` / Neo4j / Chroma `mcs_outcomes`). NO Universal Gateway, NO
 * `quadstack.write` (ACR-0007). An outcome is memory-class, so it carries the
 * app-memory envelope (McsMemoryEnvelope) and is guarded — when direct mode is
 * cut over — by the collection's Mongoose + $jsonSchema governed door.
 *
 * Hard rules (P7.4 §5):
 *   - BA-confirmed ONLY. No agent, timer, or heuristic creates an outcome.
 *     No scoring / ranking / qualification.
 *   - THREE is authority. `enrolled_three` is a MIRROR of a BA report — never a
 *     programmatic enrollment or handoff.
 *   - Metadata only: opaque ids, an optional capped note. No `.com` data, no
 *     income/compensation/cycle/placement, no transcript/LLM bodies.
 *   - Append-only with a correction chain (`supersedesOutcomeId`); outcomes are
 *     never edited in place.
 *   - Canary-gated by OUTCOME_CAPTURE_PERSISTENCE_ENABLED (default OFF → no-op).
 *
 * This is a WIRED-DORMANT writer. It is not mounted on any route in this slice
 * (no `/api/runtime/*`); live wiring into the BA-facing team surface is a later,
 * separately-approved activation step, and stays gated behind R0 being proven.
 */

import { createHash } from 'node:crypto';
import { env } from '../env.js';
import { gatewayCall } from '../services/gateway.js';
import { tripleStackWrite } from '../services/tripleStack.js';
import type {
  AppendOutcomeInput,
  McsOutcomeKind,
  McsOutcomeRecord,
} from '@momentum/shared';

const MONGO_DB = 'momentum';
const COLLECTION = 'mcs_outcomes';
const CHROMA_COLLECTION = 'mcs_outcomes';
const SERVICE_NAME = 'mcs_outcome_capture';
const TENANT_NAMESPACE = 'momentum';
const SCHEMA_VERSION = 1;
const MAX_NOTE_CHARS = 2000;

/**
 * Kinds where more than one outcome per (prospect, BA) is legitimate — the
 * deterministic id folds in `outcomeAt` for these so two distinct callbacks do
 * not collide. Every other kind is once-per-(scope, BA): a retried confirmation
 * is a no-op, not a duplicate (P7.4 §4.3).
 */
const MULTI_OCCURRENCE_KINDS: ReadonlySet<McsOutcomeKind> = new Set(['callback_completed']);

export class OutcomeValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OutcomeValidationError';
  }
}

/** True iff the R1 outcome-capture canary is enabled (P7.1 §6 kill-switch). */
export function outcomeCapturePersistenceEnabled(): boolean {
  return env.OUTCOME_CAPTURE_PERSISTENCE_ENABLED;
}

/** Short scope hash for multi-occurrence ids — keeps the id bounded + deterministic. */
function shortHash(input: string): string {
  return createHash('sha256').update(input).digest('hex').slice(0, 12);
}

/**
 * Deterministic id from (scope, kind, confirmedByTmagId) — idempotent retries.
 * For multi-occurrence kinds `outcomeAt` is folded in so distinct events differ.
 */
export function deterministicOutcomeId(input: {
  kind: McsOutcomeKind;
  confirmedByTmagId: string;
  prospectId?: string;
  token?: string;
  outcomeAt: string;
}): string {
  const scope = input.prospectId ?? input.token ?? 'noscope';
  const base = `${input.confirmedByTmagId}:${input.kind}:${scope}`;
  const keyed = MULTI_OCCURRENCE_KINDS.has(input.kind) ? `${base}:${input.outcomeAt}` : base;
  return `mcsoutcome_${shortHash(keyed)}`;
}

function outcomeTitle(record: McsOutcomeRecord): string {
  const scope = record.prospectId ?? record.token ?? 'unscoped';
  return `outcome ${record.kind} · tmag=${record.confirmedByTmagId} · ${scope}`;
}

/** Semantic blob for Chroma — scope + kind only, never PII or a body. */
function outcomeSemanticDocument(record: McsOutcomeRecord): string {
  const parts = [
    `outcome kind=${record.kind}`,
    `tmag=${record.confirmedByTmagId}`,
    `tenant=${record.tenantId}`,
    `at=${record.outcomeAt}`,
  ];
  if (record.prospectId) parts.push(`prospect=${record.prospectId}`);
  if (record.token) parts.push(`token=${record.token}`);
  return parts.join(' | ');
}

/** Idempotency / correction lookup by deterministic id. */
export async function findOutcome(id: string): Promise<McsOutcomeRecord | null> {
  const result = await gatewayCall<{ documents: McsOutcomeRecord[] }>('mongodb', 'query', {
    database: MONGO_DB,
    collection: COLLECTION,
    filter: { id },
    limit: 1,
  });
  return result.documents?.[0] ?? null;
}

/**
 * Append a BA-confirmed outcome. Returns the persisted record, the existing
 * record on a dedup hit, or `null` when the canary is disabled (no write).
 *
 * The caller (a BA-facing route, later) is responsible for authenticating the
 * confirming BA. This function refuses a body that lacks BA/tenant scope or a
 * usable prospect/token scope — an outcome with no subject is meaningless.
 */
export async function appendOutcome(
  input: AppendOutcomeInput,
): Promise<McsOutcomeRecord | null> {
  if (!outcomeCapturePersistenceEnabled()) return null;

  if (!input.confirmedByTmagId) {
    throw new OutcomeValidationError('An outcome requires the confirming BA id.');
  }
  if (!input.tenantId) {
    throw new OutcomeValidationError('An outcome requires a tenant scope.');
  }
  if (!input.prospectId && !input.token) {
    throw new OutcomeValidationError('An outcome requires a prospect or token scope.');
  }

  const now = new Date().toISOString();
  const outcomeAt = input.outcomeAt ?? now;
  const id = deterministicOutcomeId({
    kind: input.kind,
    confirmedByTmagId: input.confirmedByTmagId,
    prospectId: input.prospectId,
    token: input.token,
    outcomeAt,
  });

  // Idempotent: a retried confirmation of the same fact is a no-op. A genuine
  // correction is a NEW record carrying `supersedesOutcomeId` (append-only).
  if (!input.supersedesOutcomeId) {
    const existing = await findOutcome(id);
    if (existing) return existing;
  }

  const note = input.note ? input.note.slice(0, MAX_NOTE_CHARS) : null;

  const record: McsOutcomeRecord = {
    // app-memory envelope
    id,
    type: 'outcome',
    schemaVersion: SCHEMA_VERSION,
    namespace: TENANT_NAMESPACE,
    source: SERVICE_NAME,
    createdAt: now,
    title: '', // filled below (needs the record shape)
    originKind: 'system',
    serviceName: SERVICE_NAME,
    tenantId: input.tenantId,
    teamKey: 'team_magnificent',
    tmagId: input.confirmedByTmagId,
    derivedFrom: [],
    // outcome fields
    kind: input.kind,
    confirmedByTmagId: input.confirmedByTmagId,
    prospectId: input.prospectId,
    token: input.token,
    outcomeAt,
    note,
    supersedesOutcomeId: input.supersedesOutcomeId ?? null,
  };
  record.title = outcomeTitle(record);

  await tripleStackWrite({
    id,
    mongoCollection: COLLECTION,
    mongoDoc: { ...record, _id: undefined } as Record<string, unknown>,
    neo4j: buildOutcomeCypher(record),
    chroma: {
      collection: CHROMA_COLLECTION,
      document: outcomeSemanticDocument(record),
      metadata: {
        kind: record.kind,
        type: record.type,
        tenantId: record.tenantId,
        tmagId: record.confirmedByTmagId,
        prospectId: record.prospectId ?? null,
        token: record.token ?? null,
        outcomeAt: record.outcomeAt,
        createdAt: record.createdAt,
      },
    },
  });

  return record;
}

/**
 * Neo4j leg: MERGE the Outcome node, link to the confirming BA and (when known)
 * the prospect / invite token, and chain a correction with :SUPERSEDES. Specific
 * verbs only; MERGE on {id}; OPTIONAL MATCH so a missing peer node never blocks
 * the outcome write.
 */
function buildOutcomeCypher(
  record: McsOutcomeRecord,
): { cypher: string; params?: Record<string, unknown> } {
  return {
    cypher: `
      MERGE (o:Outcome {id: $id})
      SET o += {
        id: $id, kind: $kind, tenantId: $tenantId, tmagId: $tmagId,
        teamKey: 'team_magnificent',
        outcomeAt: datetime($outcomeAt), createdAt: datetime($createdAt)
      }
      MERGE (t:TeamMagnificent {teamKey: 'team_magnificent'})
      MERGE (o)-[:SCOPED_TO]->(t)
      WITH o
      OPTIONAL MATCH (ba:BrandAmbassador {baId: $tmagId})
      FOREACH (_ IN CASE WHEN ba IS NULL THEN [] ELSE [1] END |
        MERGE (o)-[:CONFIRMED_BY]->(ba)
      )
      WITH o
      OPTIONAL MATCH (p:Prospect {prospectId: $prospectId})
      FOREACH (_ IN CASE WHEN p IS NULL THEN [] ELSE [1] END |
        MERGE (o)-[:ABOUT_PROSPECT]->(p)
      )
      WITH o
      OPTIONAL MATCH (prev:Outcome {id: $supersedesOutcomeId})
      FOREACH (_ IN CASE WHEN prev IS NULL THEN [] ELSE [1] END |
        MERGE (o)-[:SUPERSEDES]->(prev)
      )
      RETURN o.id AS id
    `,
    params: {
      id: record.id,
      kind: record.kind,
      tenantId: record.tenantId,
      tmagId: record.confirmedByTmagId,
      outcomeAt: record.outcomeAt,
      createdAt: record.createdAt,
      prospectId: record.prospectId ?? null,
      supersedesOutcomeId: record.supersedesOutcomeId ?? null,
    },
  };
}
