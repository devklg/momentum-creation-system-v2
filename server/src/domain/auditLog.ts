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
 *   - Neo4j    (:AuditEntry) -[:ACTED_BY]-> (:Actor)
 *              (:AuditEntry) -[:ACTED_ON]-> (:Entity)
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
import { gatewayCall } from '../services/gateway.js';
import { tripleStackWrite } from '../services/tripleStack.js';
import type {
  AppendAuditEntryInput,
  AuditActor,
  AuditEntity,
  AuditLogEntry,
  AuditQueryFilters,
  AuditActorRole,
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

function roleOfActor(actor: AuditActor): AuditActorRole {
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

function entityLabel(entity: AuditEntity): string {
  if (entity.displayLabel) return `${entity.kind}:${entity.displayLabel}`;
  if (entity.kind === 'none') return 'none';
  return `${entity.kind}:${entity.id}`;
}

function actorLabel(actor: AuditActor): string {
  switch (actor.kind) {
    case 'admin':
    case 'ba':
      return `${actor.kind}:${actor.displayName} (${actor.baId})`;
    case 'prospect':
      return `prospect:${actor.displayName} (${actor.prospectId})`;
    case 'system':
      return `system:${actor.label}`;
    case 'anonymous':
      return `anonymous${actor.ip ? `:${actor.ip}` : ''}`;
  }
}

function semanticDocument(entry: AuditLogEntry): string {
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
export async function appendAuditEntry(input: AppendAuditEntryInput): Promise<AuditLogEntry> {
  const now = new Date().toISOString();
  const timestamp = input.timestamp ?? now;
  const entryId = mintEntryId(timestamp);

  const entry: AuditLogEntry = {
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
  // existing BrandAmbassador node when the actor is a BA/admin, since
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
  entry: AuditLogEntry,
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
    params.actorBaId = entry.actor.baId;
    return {
      cypher: `
        MERGE (a:AuditEntry {entryId: $entryId})
        SET a += {${baseProps}}
        WITH a
        OPTIONAL MATCH (ba:BrandAmbassador {baId: $actorBaId})
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
      MERGE (a:AuditEntry {entryId: $entryId})
      SET a += {${baseProps}}
      RETURN a.entryId AS entryId
    `,
    params,
  };
}

function buildMongoFilter(filters: AuditQueryFilters): Record<string, unknown> {
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

  if (filters.actorBaId) {
    // The actor.baId field lives on admin/ba shapes only. Match both.
    f['actor.baId'] = filters.actorBaId;
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
  filters: AuditQueryFilters,
): Promise<{ entries: AuditLogEntry[]; nextCursor: string | null }> {
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

  const result = await gatewayCall<{ documents: AuditLogEntry[]; count: number }>(
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

export async function findAuditEntry(entryId: string): Promise<AuditLogEntry | null> {
  const result = await gatewayCall<{ documents: AuditLogEntry[] }>('mongodb', 'query', {
    database: MONGO_DB,
    collection: COLLECTION,
    filter: { entryId },
    limit: 1,
  });
  return result.documents?.[0] ?? null;
}
