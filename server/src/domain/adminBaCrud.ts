/**
 * Admin BA CRUD — manual BA lifecycle (Chat #138, locked-spec 4.C).
 *
 * The manual complement to access-code signup. Same authority class as the
 * C.5 sponsor override: friction-heavy, reason required, every mutation
 * audited with before/after against the 4.J substrate.
 *
 * Boundary (ADMIN-Design standing rule): these write TM-side mirror records
 * ONLY. They never enrol anyone in THREE, never fabricate THREE
 * genealogy/comp. THREE remains the final authority.
 *
 * Lock decisions honored here (Chat #138 + Chat #140):
 *   - CREATE: sponsorBaId REQUIRED, stamped as original/immutable from birth
 *     (sponsorBaId === originalSponsorBaId at creation). No password — an
 *     admin-created BA is a roster mirror entry, not a login. Unique email
 *     enforced (a soft-deleted BA's email stays claimed).
 *   - EDIT: ordinary fields only. The sponsor field has exactly ONE mutation
 *     path — the C.5 applySponsorOverride flow — and is intentionally absent
 *     from the edit payload. Editing a DELETED BA is REJECTED (#140):
 *     restore first.
 *   - DELETE: SOFT. A `deleted` lifecycle state distinct from `suspended`,
 *     reason required, fully reversible. Severity `info` (#140) — reversible
 *     and routine; only sponsor override is `critical`.
 *   - RESTORE: clears deleted, stamps restoredAt/restoredByBaId. Severity
 *     `info`.
 *
 * Delegation, not duplication:
 *   - emailExists (ba.ts) is the single email-uniqueness authority.
 *   - applySponsorOverride (adminBaOversight.ts) owns every sponsor change.
 *   - appendAuditEntry (auditLog.ts) is the only audit writer.
 *   - The returned AdminBaDirectoryRow is re-read through getBAProfileBundle
 *     so the create/edit/restore row matches the directory + drawer.
 */

import { gatewayCall } from '../services/gateway.js';
import { tripleStackWrite } from '../services/tripleStack.js';
import { appendAuditEntry } from './auditLog.js';
import { emailExists, type BARecord } from './ba.js';
import { getBAProfileBundle } from './adminBaOversight.js';
import type {
  AdminBaDirectoryRow,
  AdminCreateBaPayload,
  AdminEditBaPayload,
  AdminSoftDeletePayload,
  AdminRestorePayload,
  AdminSoftDeleteState,
} from '@momentum/shared';

const MONGO_DB = 'momentum';
const BA_COLLECTION = 'brand_ambassadors';
const MIN_REASON_LEN = 8;

/** Actor performing the mutation. Always Kevin in v1, carried explicitly so
 * the audit entry names a real admin and never a synthetic one. */
export interface AdminActor {
  baId: string;
  displayName: string;
}

export type AdminBaCrudError =
  | { kind: 'reason_too_short' }
  | { kind: 'sponsor_not_found' }
  | { kind: 'email_taken' }
  | { kind: 'ba_not_found' }
  | { kind: 'ba_deleted' }
  | { kind: 'ba_not_deleted' }
  | { kind: 'no_fields' }
  | { kind: 'row_unavailable' };

type Result<T> = { ok: true; value: T } | { ok: false; error: AdminBaCrudError };

/** A normally-registered BA has no soft-delete block; absent === not deleted. */
type BARecordMaybeDeleted = BARecord &
  Partial<AdminSoftDeleteState> & {
    originalSponsorBaId?: string | null;
    originalSponsorThreeBaId?: string | null;
  };

function mintBaId(): string {
  // Same format as ba.ts mintBaId — TMBA-YYYYMMDD-<6 alphanum>.
  const now = new Date();
  const ymd = now.toISOString().slice(0, 10).replace(/-/g, '');
  const r = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `TMBA-${ymd}-${r}`;
}

function isDeleted(ba: BARecordMaybeDeleted): boolean {
  return ba.deleted === true;
}

function validReason(reason: string | undefined | null): boolean {
  return typeof reason === 'string' && reason.trim().length >= MIN_REASON_LEN;
}

/**
 * Resolve a BA by id INCLUDING soft-deleted records. CRUD needs to see
 * deleted rows for the state checks and for restore, so we query the
 * collection directly with no deleted filter.
 */
async function findBAByBaIdAnyState(baId: string): Promise<BARecordMaybeDeleted | null> {
  const result = await gatewayCall<{ documents: BARecordMaybeDeleted[] }>('mongodb', 'query', {
    database: MONGO_DB,
    collection: BA_COLLECTION,
    filter: { baId },
    limit: 1,
  });
  return result.documents?.[0] ?? null;
}

/** Re-read the directory row so responses match the directory/drawer. */
async function readRow(baId: string): Promise<AdminBaDirectoryRow | null> {
  const bundle = await getBAProfileBundle(baId);
  return bundle?.row ?? null;
}

/* ── create ───────────────────────────────────────── */

export async function adminCreateBa(
  payload: AdminCreateBaPayload,
  actor: AdminActor,
): Promise<Result<{ baId: string; row: AdminBaDirectoryRow }>> {
  if (!validReason(payload.reason)) return { ok: false, error: { kind: 'reason_too_short' } };

  // Sponsor must resolve to a real, non-deleted BA. Sponsor immutability
  // (locked-spec 3.5): this becomes BOTH current and original sponsor.
  const sponsor = await findBAByBaIdAnyState(payload.sponsorBaId);
  if (!sponsor || isDeleted(sponsor)) return { ok: false, error: { kind: 'sponsor_not_found' } };

  // Unique email only when supplied. A soft-deleted BA's email stays claimed
  // because emailExists queries the whole collection.
  const email = payload.email?.trim() || null;
  if (email && (await emailExists(email))) {
    return { ok: false, error: { kind: 'email_taken' } };
  }

  const baId = mintBaId();
  const createdAt = new Date().toISOString();

  const softDelete: AdminSoftDeleteState = {
    deleted: false,
    deletedAt: null,
    deletedReason: null,
    deletedByBaId: null,
    restoredAt: null,
    restoredByBaId: null,
  };

  // No password: mirror entry, not a login.
  const record: BARecordMaybeDeleted = {
    baId,
    threeBaId: payload.threeBaId,
    threeUsername: payload.threeUsername,
    firstName: payload.firstName,
    lastName: payload.lastName,
    email: email ?? '',
    phone: payload.phone?.trim() || '',
    timezone: payload.timezone?.trim() || '',
    passwordHash: '',
    sponsorBaId: sponsor.baId,
    sponsorThreeBaId: sponsor.threeBaId,
    accessCodeUsed: '',
    createdAt,
    lastLoginAt: null,
    originalSponsorBaId: sponsor.baId,
    originalSponsorThreeBaId: sponsor.threeBaId,
    ...softDelete,
    ...(payload.marketRegion?.trim() ? { marketRegion: payload.marketRegion.trim() } : {}),
  } as BARecordMaybeDeleted;

  await tripleStackWrite({
    id: baId,
    mongoCollection: BA_COLLECTION,
    mongoDoc: { ...record },
    neo4j: {
      cypher:
        'MERGE (s:BA {baId: $sponsorBaId}) MERGE (n:BA {baId: $id}) ' +
        'SET n.threeBaId = $threeBaId, n.email = $email, n.firstName = $firstName, ' +
        'n.lastName = $lastName, n.timezone = $timezone ' +
        'MERGE (n)-[:SPONSORED_BY]->(s)',
      params: {
        sponsorBaId: sponsor.baId,
        threeBaId: payload.threeBaId,
        email: email,
        firstName: payload.firstName,
        lastName: payload.lastName,
        timezone: payload.timezone?.trim() || null,
      },
    },
  });

  await appendAuditEntry({
    actor: { kind: 'admin', baId: actor.baId, displayName: actor.displayName },
    action: 'admin.ba.create',
    entity: {
      kind: 'brand_ambassador',
      id: baId,
      displayLabel: `${payload.firstName} ${payload.lastName}`.trim(),
    },
    severity: 'info',
    before: null,
    after: { baId, sponsorBaId: sponsor.baId, threeBaId: payload.threeBaId, email },
    reason: payload.reason,
  });

  const row = await readRow(baId);
  if (!row) return { ok: false, error: { kind: 'row_unavailable' } };
  return { ok: true, value: { baId, row } };
}

/* ── edit ──────────────────────────────────────────── */

export async function adminEditBa(
  baId: string,
  payload: AdminEditBaPayload,
  actor: AdminActor,
): Promise<Result<{ baId: string; row: AdminBaDirectoryRow }>> {
  if (!validReason(payload.reason)) return { ok: false, error: { kind: 'reason_too_short' } };

  const ba = await findBAByBaIdAnyState(baId);
  if (!ba) return { ok: false, error: { kind: 'ba_not_found' } };
  // #140 lock: cannot edit a record that is off the roster. Restore first.
  if (isDeleted(ba)) return { ok: false, error: { kind: 'ba_deleted' } };

  const set: Record<string, unknown> = {};
  const before: Record<string, unknown> = {};
  const after: Record<string, unknown> = {};

  const fields: Array<keyof AdminEditBaPayload> = [
    'firstName',
    'lastName',
    'threeBaId',
    'threeUsername',
    'email',
    'phone',
    'timezone',
    'marketRegion',
  ];

  for (const f of fields) {
    if (payload[f] === undefined) continue;
    const raw = payload[f];
    const next = typeof raw === 'string' ? raw.trim() : raw;
    const bag = ba as unknown as Record<string, unknown>;
    const prev = bag[f] ?? null;
    if ((next ?? null) === (prev ?? null)) continue;
    set[f] = next ?? null;
    before[f] = prev;
    after[f] = next ?? null;
  }

  if (Object.keys(set).length === 0) return { ok: false, error: { kind: 'no_fields' } };

  // Email uniqueness if it's changing (emailExists is roster-wide; a match on
  // THIS ba is not a clash).
  if (typeof set.email === 'string' && set.email.length > 0) {
    const taken = await emailExists(set.email);
    if (taken && (ba.email ?? '') !== set.email) {
      return { ok: false, error: { kind: 'email_taken' } };
    }
  }

  await gatewayCall('mongodb', 'update', {
    database: MONGO_DB,
    collection: BA_COLLECTION,
    filter: { baId },
    update: { $set: set },
  });

  await appendAuditEntry({
    actor: { kind: 'admin', baId: actor.baId, displayName: actor.displayName },
    action: 'admin.ba.edit',
    entity: {
      kind: 'brand_ambassador',
      id: baId,
      displayLabel: `${ba.firstName} ${ba.lastName}`.trim(),
    },
    severity: 'info',
    before,
    after,
    reason: payload.reason,
  });

  const row = await readRow(baId);
  if (!row) return { ok: false, error: { kind: 'row_unavailable' } };
  return { ok: true, value: { baId, row } };
}

/* ── soft delete ───────────────────────────────────── */

export async function adminSoftDeleteBa(
  baId: string,
  payload: AdminSoftDeletePayload,
  actor: AdminActor,
): Promise<Result<{ baId: string; deletedAt: string }>> {
  if (!validReason(payload.reason)) return { ok: false, error: { kind: 'reason_too_short' } };

  const ba = await findBAByBaIdAnyState(baId);
  if (!ba) return { ok: false, error: { kind: 'ba_not_found' } };
  if (isDeleted(ba)) return { ok: false, error: { kind: 'ba_deleted' } };

  const deletedAt = new Date().toISOString();
  const patch: Partial<AdminSoftDeleteState> = {
    deleted: true,
    deletedAt,
    deletedReason: payload.reason,
    deletedByBaId: actor.baId,
  };

  await gatewayCall('mongodb', 'update', {
    database: MONGO_DB,
    collection: BA_COLLECTION,
    filter: { baId },
    update: { $set: patch },
  });

  await appendAuditEntry({
    actor: { kind: 'admin', baId: actor.baId, displayName: actor.displayName },
    action: 'admin.ba.delete',
    entity: {
      kind: 'brand_ambassador',
      id: baId,
      displayLabel: `${ba.firstName} ${ba.lastName}`.trim(),
    },
    severity: 'info',
    before: { deleted: false },
    after: { deleted: true, deletedAt },
    reason: payload.reason,
  });

  return { ok: true, value: { baId, deletedAt } };
}

/* ── restore ──────────────────────────────────────── */

export async function adminRestoreBa(
  baId: string,
  payload: AdminRestorePayload,
  actor: AdminActor,
): Promise<Result<{ baId: string; restoredAt: string; row: AdminBaDirectoryRow }>> {
  if (!validReason(payload.reason)) return { ok: false, error: { kind: 'reason_too_short' } };

  const ba = await findBAByBaIdAnyState(baId);
  if (!ba) return { ok: false, error: { kind: 'ba_not_found' } };
  if (!isDeleted(ba)) return { ok: false, error: { kind: 'ba_not_deleted' } };

  const restoredAt = new Date().toISOString();
  const patch: Partial<AdminSoftDeleteState> = {
    deleted: false,
    restoredAt,
    restoredByBaId: actor.baId,
    // deletedAt / deletedReason / deletedByBaId LEFT as the historical record.
  };

  await gatewayCall('mongodb', 'update', {
    database: MONGO_DB,
    collection: BA_COLLECTION,
    filter: { baId },
    update: { $set: patch },
  });

  await appendAuditEntry({
    actor: { kind: 'admin', baId: actor.baId, displayName: actor.displayName },
    action: 'admin.ba.restore',
    entity: {
      kind: 'brand_ambassador',
      id: baId,
      displayLabel: `${ba.firstName} ${ba.lastName}`.trim(),
    },
    severity: 'info',
    before: { deleted: true, deletedReason: ba.deletedReason ?? null },
    after: { deleted: false, restoredAt },
    reason: payload.reason,
  });

  const row = await readRow(baId);
  if (!row) return { ok: false, error: { kind: 'row_unavailable' } };
  return { ok: true, value: { baId, restoredAt, row } };
}
