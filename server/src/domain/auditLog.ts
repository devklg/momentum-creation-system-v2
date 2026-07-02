/**
 * Audit log domain (locked-spec 4.J · project-wireframe 4.J).
 *
 * The substrate every other /admin surface writes against. Core
 * Dashboard, BA Oversight, Prospect Oversight, Queue Oversight, and
 * Live Ops all WRITE here.
 *
 * Append-only. No update, no delete, ever. Monotonic by
 * (timestamp, entryId). Triple-stacked per locked-spec 3.14:
 *
 *   - MongoDB  `audit_log`              — canonical store
 *   - Neo4j    (:TmagAuditEntry) -[:ACTED_BY]-> (:Actor)
 *              (:TmagAuditEntry) -[:ACTED_ON]-> (:Entity)
 *   - Chroma   `audit_log`              — semantic search across
 *                                          action + reason + entity blob
 *
 * Public surface:
 *
 *   appendAuditEntry(input)            — the ONLY writer. Triple-stacks.
 *   queryAuditEntries(filters)         — filtered reverse-chrono read.
 *   findAuditEntry(entryId)            — single entry, for transcript drill-in.
 *
 * No update / delete is exported. The append-only invariant is
 * enforced by what this module does NOT expose, not by a hook on
 * the storage layer — the gateway will happily delete if asked, so
 * the discipline lives in the caller surface (this file).
 */

import { randomBytes } from 'node:crypto';
import { env } from '../env.js';
import { gatewayCall } from '../services/gateway.js';
import { tripleStackWrite } from '../services/tripleStack.js';
import type {
  McsAppendAuditEntryInput,
  McsRuntimeAuditInput,
  McsAuditActor,
  McsAuditEntity,
  McsAuditLogEntry,
  McsAuditQueryFilters,
  McsAuditActorRole,
  McsAuditSeverity,
  McsRuntimeAuditAction,
  McsRuntimeAuditLogEntry,
} from '@momentum/shared';

const MONGO_DB = 'momentum';
const COLLECTION = 'mcs_audit_log';
const CHROMA_COLLECTION = 'mcs_audit_log';
const MAX_LIMIT = 250;
const DEFAULT_LIMIT = 100;
const MAX_SNAPSHOT_BYTES = 4096;

function mintEntryId(timestamp: string): string {
  // `audit_<ISO-with-Z-stripped-of-punctuation>_<8-hex>` — sortable,
  // ~zero collision risk, and the timestamp slice keeps the ID
  // self-describing in raw mongo / log lines.
  const tsSlice = timestamp.replace(/[-:.TZ]/g, '');
  const rand = randomBytes(4).toString('hex');
  return `audit_${tsSlice}_${rand}`;
}

function roleOfActor(actor: McsAuditActor): McsAuditActorRole {
  return actor.kind;
}

/**
 * Cap snapshot blobs so a rogue caller can't blow out gateway
 * payload limits. 4KB per snapshot is plenty for sponsor overrides
 * and rule diffs; anything bigger is almost certainly a leak.
 */
function clampSnapshot(
  snap: Record<string, unknown> | null | undefined,
): Record<string, unknown> | null {
  if (!snap) return null;
  const json = JSON.stringify(snap);
  if (json.length <= MAX_SNAPSHOT_BYTES) return snap;
  return { _truncated: true, _bytes: json.length, preview: json.slice(0, MAX_SNAPSHOT_BYTES) };
}

function entityLabel(entity: McsAuditEntity): string {
  if (entity.displayLabel) return `${entity.kind}:${entity.displayLabel}`;
  if (entity.kind === 'none') return 'none';
  return `${entity.kind}:${entity.id}`;
}

function actorLabel(actor: McsAuditActor): string {
  switch (actor.kind) {
    case 'admin':
    case 'ba':
      return `${actor.kind}:${actor.displayName} (${actor.tmagId})`;
    case 'prospect':
      return `prospect:${actor.displayName} (${actor.prospectId})`;
    case 'system':
      return `system:${actor.label}`;
    case 'anonymous':
      return `anonymous${actor.ip ? `:${actor.ip}` : ''}`;
  }
}

function semanticDocument(entry: McsAuditLogEntry): string {
  const parts = [
    `action=${entry.action}`,
    `actor=${actorLabel(entry.actor)}`,
    `entity=${entityLabel(entry.entity)}`,
    `severity=${entry.severity}`,
  ];
  if (entry.reason) parts.push(`reason=${entry.reason}`);
  return parts.join(' | ');
}

/**
 * Triple-stacked append. The ONLY writer. Returns the persisted
 * entry so callers can echo entryId in their own response if useful.
 */
export async function appendAuditEntry(input: McsAppendAuditEntryInput): Promise<McsAuditLogEntry> {
  const now = new Date().toISOString();
  const timestamp = input.timestamp ?? now;
  const entryId = mintEntryId(timestamp);

  const entry: McsAuditLogEntry = {
    entryId,
    timestamp,
    createdAt: now,
    role: roleOfActor(input.actor),
    actor: input.actor,
    action: input.action,
    entity: input.entity,
    severity: input.severity ?? 'info',
    before: clampSnapshot(input.before),
    after: clampSnapshot(input.after),
    reason: input.reason ?? null,
    context: input.context ?? null,
    linkedTranscriptId: input.linkedTranscriptId ?? null,
  };

  // Neo4j: stamp the entry node and link out by actor kind. We don't
  // create generic Actor / Entity nodes — instead we connect to the
  // existing TeamMagnificentMember node when the actor is a BA/admin, since
  // those already exist in the graph. For prospect / system / anonymous
  // the entry stands alone (still traversable by action / timestamp).
  const cypher = buildCypher(entry);

  await tripleStackWrite({
    id: entryId,
    mongoCollection: COLLECTION,
    mongoDoc: { ...entry, _id: undefined } as Record<string, unknown>,
    neo4j: cypher,
    chroma: {
      collection: CHROMA_COLLECTION,
      document: semanticDocument(entry),
      metadata: {
        action: entry.action,
        role: entry.role,
        entityKind: entry.entity.kind,
        severity: entry.severity,
        timestamp: entry.timestamp,
      },
    },
  });

  return entry;
}

function buildCypher(
  entry: McsAuditLogEntry,
): { cypher: string; params?: Record<string, unknown> } {
  const baseProps =
    'entryId: $entryId, timestamp: datetime($timestamp), action: $action, role: $role, severity: $severity, entityKind: $entityKind, entityId: $entityId';
  const params: Record<string, unknown> = {
    entryId: entry.entryId,
    timestamp: entry.timestamp,
    action: entry.action,
    role: entry.role,
    severity: entry.severity,
    entityKind: entry.entity.kind,
    entityId: entry.entity.id,
  };

  if (entry.actor.kind === 'admin' || entry.actor.kind === 'ba') {
    params.actorTmagId = entry.actor.tmagId;
    return {
      cypher: `
        MERGE (a:TmagAuditEntry {entryId: $entryId})
        SET a += {${baseProps}}
        WITH a
        OPTIONAL MATCH (ba:TeamMagnificentMember {tmagId: $actorTmagId})
        FOREACH (_ IN CASE WHEN ba IS NULL THEN [] ELSE [1] END |
          MERGE (a)-[:ACTED_BY]->(ba)
        )
        RETURN a.entryId AS entryId
      `,
      params,
    };
  }

  return {
    cypher: `
      MERGE (a:TmagAuditEntry {entryId: $entryId})
      SET a += {${baseProps}}
      RETURN a.entryId AS entryId
    `,
    params,
  };
}

function buildMongoFilter(filters: McsAuditQueryFilters): Record<string, unknown> {
  const f: Record<string, unknown> = {};

  if (filters.role) f.role = filters.role;
  if (filters.action) f.action = filters.action;
  if (filters.actionPrefix && !filters.action) {
    // Mongo regex anchored at start. Escaped because the gateway passes
    // the value through verbatim and we don't want unintended pattern semantics.
    const safe = filters.actionPrefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    f.action = { $regex: `^${safe}` };
  }
  if (filters.entityKind) f['entity.kind'] = filters.entityKind;
  if (filters.entityId) f['entity.id'] = filters.entityId;
  if (filters.severity) f.severity = filters.severity;

  if (filters.actorTmagId) {
    // The actor.tmagId field lives on admin/ba shapes only. Match both.
    f['actor.tmagId'] = filters.actorTmagId;
  }

  const ts: Record<string, unknown> = {};
  if (filters.from) ts.$gte = filters.from;
  if (filters.to) ts.$lt = filters.to;
  if (Object.keys(ts).length > 0) f.timestamp = ts;

  return f;
}

/**
 * Reverse-chronological read with cursor pagination. Newest first.
 * Cursor is the last entry's `entryId` from the prior page; we look
 * up that entry's timestamp and ask Mongo for the next strictly-older
 * batch.
 *
 * The (timestamp, entryId) tuple is the sort key — entryId encodes
 * timestamp + random suffix so equal-timestamp ties resolve
 * deterministically.
 */
export async function queryAuditEntries(
  filters: McsAuditQueryFilters,
): Promise<{ entries: McsAuditLogEntry[]; nextCursor: string | null }> {
  const limit = Math.max(1, Math.min(filters.limit ?? DEFAULT_LIMIT, MAX_LIMIT));
  const filter = buildMongoFilter(filters);

  if (filters.before) {
    const cursorEntry = await findAuditEntry(filters.before);
    if (cursorEntry) {
      // Strictly older than the cursor's (timestamp, entryId) pair.
      filter.$or = [
        { timestamp: { $lt: cursorEntry.timestamp } },
        { timestamp: cursorEntry.timestamp, entryId: { $lt: cursorEntry.entryId } },
      ];
    }
  }

  const result = await gatewayCall<{ documents: McsAuditLogEntry[]; count: number }>(
    'mongodb',
    'query',
    {
      database: MONGO_DB,
      collection: COLLECTION,
      filter,
      sort: { timestamp: -1, entryId: -1 },
      limit: limit + 1,
    },
  );

  const docs = result.documents ?? [];
  const hasMore = docs.length > limit;
  const entries = hasMore ? docs.slice(0, limit) : docs;
  const nextCursor = hasMore ? entries[entries.length - 1]?.entryId ?? null : null;

  return { entries, nextCursor };
}

export async function findAuditEntry(entryId: string): Promise<McsAuditLogEntry | null> {
  const result = await gatewayCall<{ documents: McsAuditLogEntry[] }>('mongodb', 'query', {
    database: MONGO_DB,
    collection: COLLECTION,
    filter: { entryId },
    limit: 1,
  });
  return result.documents?.[0] ?? null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase 7 · R0 — Runtime audit persistence (P7.2 schema / P7.3 §3 write contract).
//
// A thin extension of the substrate above for the AGENT-RUNTIME turn lifecycle
// (Michael/Steve/Ivory turns, gate decisions, draft-emission markers). Same
// canonical `mcs_audit_log` triple-stack, same append-only invariant, same
// app-direct tripleStackWrite seam (NO Universal Gateway; ACR-0007). Differences
// from the admin substrate:
//   - metadata only: no before/after body EVER (lifecycle markers, not mutations);
//   - carries a dedicated `runtime` scope block (ids only — no content, no PII);
//   - idempotent on (turnId, action): a retried turn-open never double-writes;
//   - canary-gated by RUNTIME_AUDIT_PERSISTENCE_ENABLED (default OFF → no-op).
//
// This is a WIRED-DORMANT writer. It is intentionally NOT called from the inert
// S2.7 turn coordinator (whose governance boundary forbids persistence). Live
// wiring into a real turn path is a later, separately-approved activation step.
// ─────────────────────────────────────────────────────────────────────────────

const MAX_RUNTIME_REASON_CHARS = 500;

/** True iff the R0 runtime-audit canary is enabled (P7.1 §6 kill-switch). */
export function runtimeAuditPersistenceEnabled(): boolean {
  return env.RUNTIME_AUDIT_PERSISTENCE_ENABLED;
}

/**
 * Default severity per action (P7.2 §3.2): gate denials are expected traffic
 * (`warn`), persistence-flag flips are `critical`, everything else `info`.
 */
function runtimeSeverityFor(action: McsRuntimeAuditAction): McsAuditSeverity {
  if (action === 'runtime.gate.denied') return 'warn';
  if (action === 'runtime.persistence.enabled' || action === 'runtime.persistence.disabled') {
    return 'critical';
  }
  return 'info';
}

/**
 * Idempotency lookup for the (turnId, action) dedup key. The gateway `update`
 * path does not honor upsert, so the writer branches on existence instead
 * (documented gotcha at the top of tripleStack.ts).
 */
export async function findRuntimeAuditEntry(
  turnId: string,
  action: McsRuntimeAuditAction,
): Promise<McsRuntimeAuditLogEntry | null> {
  const result = await gatewayCall<{ documents: McsRuntimeAuditLogEntry[] }>('mongodb', 'query', {
    database: MONGO_DB,
    collection: COLLECTION,
    filter: { action, 'runtime.turnId': turnId },
    limit: 1,
  });
  return result.documents?.[0] ?? null;
}

/**
 * Append a runtime audit event. Returns the persisted row, the existing row on a
 * dedup hit, or `null` when the canary is disabled (no write attempted).
 *
 * Invariants (P7.2 §6): append-only, metadata-only (no before/after), all-three
 * -or-fail via tripleStackWrite, deterministic dedup on (turnId, action), tenant
 * + BA + agent scope on every row, no agent-authored writes.
 */
export async function appendRuntimeAuditEntry(
  input: McsRuntimeAuditInput,
): Promise<McsRuntimeAuditLogEntry | null> {
  if (!runtimeAuditPersistenceEnabled()) return null;

  const { runtime, action } = input;

  // Idempotent on (turnId, action): a retried lifecycle marker is a no-op.
  const existing = await findRuntimeAuditEntry(runtime.turnId, action);
  if (existing) return existing;

  const now = new Date().toISOString();
  const timestamp = input.timestamp ?? now;
  const entryId = mintEntryId(timestamp);
  const reason = input.reason ? input.reason.slice(0, MAX_RUNTIME_REASON_CHARS) : null;

  // Actor is the runtime agent acting as a system principal — never a BA-authored
  // write. Entity is the turn itself; kind stays 'none' (no new AuditEntityKind
  // member — append-only) and the `runtime.*` action prefix isolates the read.
  const actor: McsAuditActor = { kind: 'system', label: `runtime:${runtime.agent}` };
  const entity: McsAuditEntity = {
    kind: 'none',
    id: runtime.turnId,
    displayLabel: `${runtime.agent} turn`,
  };

  const entry: McsRuntimeAuditLogEntry = {
    entryId,
    timestamp,
    createdAt: now,
    role: 'system',
    actor,
    action,
    entity,
    severity: input.severity ?? runtimeSeverityFor(action),
    before: null, // metadata-only marker — never a body
    after: null,
    reason,
    context: null,
    linkedTranscriptId: null,
    runtime,
  };

  const cypher = buildRuntimeCypher(entry);

  await tripleStackWrite({
    id: entryId,
    mongoCollection: COLLECTION,
    mongoDoc: { ...entry, _id: undefined } as Record<string, unknown>,
    neo4j: cypher,
    chroma: {
      collection: CHROMA_COLLECTION,
      document: runtimeSemanticDocument(entry),
      metadata: {
        action: entry.action,
        role: entry.role,
        entityKind: entry.entity.kind,
        severity: entry.severity,
        timestamp: entry.timestamp,
        turnId: runtime.turnId,
        correlationId: runtime.correlationId,
        agent: runtime.agent,
        tenantId: runtime.tenantId,
        tmagId: runtime.tmagId,
      },
    },
  });

  return entry;
}

/** Semantic blob for Chroma — scope + action only, never a body. */
function runtimeSemanticDocument(entry: McsRuntimeAuditLogEntry): string {
  const { runtime } = entry;
  const parts = [
    `action=${entry.action}`,
    `agent=${runtime.agent}`,
    `turn=${runtime.turnId}`,
    `tmag=${runtime.tmagId}`,
    `tenant=${runtime.tenantId}`,
    `severity=${entry.severity}`,
  ];
  if (runtime.gate) parts.push(`gate=${runtime.gate}`);
  if (runtime.draftKind) parts.push(`draftKind=${runtime.draftKind}`);
  if (entry.reason) parts.push(`reason=${entry.reason}`);
  return parts.join(' | ');
}

/**
 * Neo4j leg: stamp the runtime turn on the AuditEntry node and link to the
 * TeamMagnificentMember on whose behalf the turn ran (when that node exists). MERGE on
 * {entryId}; specific verb only (:ACTED_FOR). No generic relationships.
 */
function buildRuntimeCypher(
  entry: McsRuntimeAuditLogEntry,
): { cypher: string; params?: Record<string, unknown> } {
  const { runtime } = entry;
  return {
    cypher: `
      MERGE (a:TmagAuditEntry {entryId: $entryId})
      SET a += {
        entryId: $entryId, timestamp: datetime($timestamp), action: $action,
        role: $role, severity: $severity, agent: $agent, turnId: $turnId,
        correlationId: $correlationId, tenantId: $tenantId, gate: $gate
      }
      WITH a
      OPTIONAL MATCH (ba:TeamMagnificentMember {tmagId: $tmagId})
      FOREACH (_ IN CASE WHEN ba IS NULL THEN [] ELSE [1] END |
        MERGE (a)-[:ACTED_FOR]->(ba)
      )
      RETURN a.entryId AS entryId
    `,
    params: {
      entryId: entry.entryId,
      timestamp: entry.timestamp,
      action: entry.action,
      role: entry.role,
      severity: entry.severity,
      agent: runtime.agent,
      turnId: runtime.turnId,
      correlationId: runtime.correlationId,
      tenantId: runtime.tenantId,
      gate: runtime.gate,
      tmagId: runtime.tmagId,
    },
  };
}
