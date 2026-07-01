/**
 * Admin Prospect CRUD — manual prospect lifecycle (Chat #138, locked-spec 4.D).
 *
 * The manual complement to a BA minting an invitation on .team. Same
 * authority class as the D.4 interventions: reason required, every mutation
 * audited with before/after against the 4.J substrate.
 *
 * Lock decisions honored here:
 *
 *   CREATE (Chat #140 SUPERSEDES Chat #138):
 *     #138 said "mint a token then place in the holding tank at the next
 *     monotonic position at create." Kevin reversed this in #140: an
 *     admin-created prospect goes through the EXACT SAME PROCESS as a
 *     regular prospect — "nothing different." So create is MINT-ONLY:
 *     delegate to createInvitation (prospect at state 'minted', real
 *     /p/{token}, sponsor stamped immutably). Placement, the position
 *     number, video-completion tracking, and the SMS to the sponsoring BA
 *     ALL happen later through the existing POST /api/p/:token/video-event
 *     path — never here. No special-case placement, no silent placement,
 *     no duplicate of the regular flow. Reason: an admin-created prospect
 *     is typically Kevin's own; it must behave identically to one any BA
 *     creates, including the video_complete → placeProspect →
 *     alertBaVideoCompleted chain.
 *
 *   EDIT: ordinary fields only. Sponsor is intentionally ABSENT from the
 *     payload — a prospect's sponsor changes only through the D.4
 *     reassign_sponsor / move interventions (already built). Editing a
 *     DELETED prospect is REJECTED (#140 BA-parallel): restore first.
 *
 *   DELETE: SOFT, record-only. The prospect record flips to a `deleted`
 *     lifecycle state (distinct from the funnel `state`), reason required,
 *     fully reversible. The HOLDING TANK IS LEFT COMPLETELY UNTOUCHED
 *     (Chat #138 final word): no name change, no anonymizing, no
 *     placeholder, no placement write. The slot / positionNumber / ticker
 *     entry persist UNCHANGED. The tank entry only ages out later via the
 *     separate manual 8-week flush (flushExpiredPlacements). Severity
 *     `info` (#140) — reversible and routine.
 *
 *   RESTORE: clears deleted, stamps restoredAt/restoredByTmagId. Severity
 *     `info`.
 *
 * Delegation, not duplication:
 *   - createInvitation (invitations.ts) is the ONE prospect+token mint path.
 *   - appendAuditEntry (auditLog.ts) is the only audit writer.
 *   - refreshRowFor (adminProspectOversight.ts) builds the directory row so
 *     create/edit/restore responses match the D.1 directory exactly.
 *   - Sponsor changes belong to D.4 interventions; never duplicated here.
 */

import { gatewayCall } from '../services/gateway.js';
import { appendAuditEntry } from './auditLog.js';
import { createInvitation } from './invitations.js';
import { findBAByTmagId } from './ba.js';
import { refreshRowFor } from './adminProspectOversight.js';
import type {
  McsAdminProspectDirectoryRow,
  McsAdminCreateProspectPayload,
  McsAdminEditProspectPayload,
  McsAdminSoftDeletePayload,
  McsAdminRestorePayload,
  McsAdminSoftDeleteState,
  McsAuditActor,
  McsProspectRecord,
} from '@momentum/shared';

const MONGO_DB = 'momentum';
const PROSPECTS_COLLECTION = 'prospects';
const MIN_REASON_LEN = 8;

/**
 * Actor performing the mutation. Was kind-less in #138/#140 (admin only);
 * widened in #141 to the two BA-bearing audit-actor kinds so the SAME engine
 * serves both the /admin surface (kind:'admin') and the BA cockpit
 * (kind:'ba'). The kind flows straight to the audit entry AND selects the
 * action-verb namespace (admin.prospect.* vs ba.prospect.*), per Chat #141:
 * the verb tracks the actor so audit filtering by actionPrefix stays honest.
 */
export type CrudActor = Extract<McsAuditActor, { kind: 'admin' | 'ba' }>;

/** Back-compat alias — admin call sites kept this name. */
export type AdminActor = CrudActor;

/** The verb namespace for this actor: 'admin' | 'ba'. */
function verbNs(actor: CrudActor): 'admin' | 'ba' {
  return actor.kind;
}

export type AdminProspectCrudError =
  | { kind: 'reason_too_short' }
  | { kind: 'sponsor_not_found' }
  | { kind: 'prospect_not_found' }
  | { kind: 'prospect_deleted' }
  | { kind: 'prospect_not_deleted' }
  | { kind: 'no_fields' }
  | { kind: 'row_unavailable' };

type Result<T> = { ok: true; value: T } | { ok: false; error: AdminProspectCrudError };

/** A normally-minted prospect has no soft-delete block; absent === not deleted. */
type ProspectRecordMaybeDeleted = McsProspectRecord & Partial<McsAdminSoftDeleteState>;

function isDeleted(p: ProspectRecordMaybeDeleted): boolean {
  return p.deleted === true;
}

function validReason(reason: string | undefined | null): boolean {
  return typeof reason === 'string' && reason.trim().length >= MIN_REASON_LEN;
}

/**
 * Resolve a prospect by id INCLUDING soft-deleted records. CRUD needs to see
 * deleted rows for the state checks and for restore.
 */
async function findProspectByIdAnyState(
  prospectId: string,
): Promise<ProspectRecordMaybeDeleted | null> {
  const result = await gatewayCall<{ documents: ProspectRecordMaybeDeleted[] }>('mongodb', 'query', {
    database: MONGO_DB,
    collection: PROSPECTS_COLLECTION,
    filter: { prospectId },
    limit: 1,
  });
  return result.documents?.[0] ?? null;
}

/* ── create (MINT-ONLY — same process as a regular prospect) ────────── */

export async function adminCreateProspect(
  payload: McsAdminCreateProspectPayload,
  actor: AdminActor,
): Promise<Result<{
  prospectId: string;
  token: string;
  inviteUrl: string;
  row: McsAdminProspectDirectoryRow;
}>> {
  if (!validReason(payload.reason)) {
    return { ok: false, error: { kind: 'reason_too_short' } };
  }

  // Sponsor must resolve to a real BA. Stamped immutably by createInvitation.
  const sponsor = await findBAByTmagId(payload.sponsorTmagId);
  if (!sponsor) return { ok: false, error: { kind: 'sponsor_not_found' } };

  // MINT ONLY. Identical to the regular BA-minted flow. No placement here —
  // placement + SMS + video tracking happen later through the existing
  // /api/p/:token/video-event path when the video is completed.
  const created = await createInvitation({
    sponsorTmagId: payload.sponsorTmagId,
    firstName: payload.firstName,
    lastName: payload.lastName,
    email: payload.email ?? null,
    phone: payload.phone ?? null,
    city: payload.city,
    stateOrRegion: payload.stateOrRegion,
    country: payload.country ?? 'US',
    message: null,
    source: 'self',
  });

  await appendAuditEntry({
    actor,
    action: `${verbNs(actor)}.prospect.create`,
    entity: {
      kind: 'prospect',
      id: created.prospectId,
      displayLabel: `${payload.firstName} ${payload.lastName}`.trim(),
    },
    severity: 'info',
    before: null,
    after: {
      prospectId: created.prospectId,
      token: created.token,
      sponsorTmagId: payload.sponsorTmagId,
      state: 'minted',
    },
    reason: payload.reason,
  });

  const row = await refreshRowFor(created.prospectId);
  if (!row) return { ok: false, error: { kind: 'row_unavailable' } };

  return {
    ok: true,
    value: {
      prospectId: created.prospectId,
      token: created.token,
      inviteUrl: created.inviteUrl,
      row,
    },
  };
}

/* ── edit (ordinary fields; sponsor routes through D.4) ─────────────── */

export async function adminEditProspect(
  prospectId: string,
  payload: McsAdminEditProspectPayload,
  actor: AdminActor,
): Promise<Result<{ prospectId: string; row: McsAdminProspectDirectoryRow }>> {
  if (!validReason(payload.reason)) {
    return { ok: false, error: { kind: 'reason_too_short' } };
  }

  const prospect = await findProspectByIdAnyState(prospectId);
  if (!prospect) return { ok: false, error: { kind: 'prospect_not_found' } };
  if (isDeleted(prospect)) return { ok: false, error: { kind: 'prospect_deleted' } };

  // Ordinary fields only. Sponsor is NOT here by contract — D.4
  // reassign_sponsor owns it. firstName/lastName/phone/email are top-level;
  // city/stateOrRegion/country live under the `location` subdocument.
  const set: Record<string, unknown> = {};
  const before: Record<string, unknown> = {};
  const after: Record<string, unknown> = {};

  const topFields: Array<'firstName' | 'lastName' | 'phone' | 'email'> = [
    'firstName',
    'lastName',
    'phone',
    'email',
  ];
  for (const f of topFields) {
    if (payload[f] === undefined) continue;
    const raw = payload[f];
    const next = typeof raw === 'string' ? raw.trim() : raw;
    const prev = (prospect as unknown as Record<string, unknown>)[f] ?? null;
    if ((next ?? null) === (prev ?? null)) continue;
    set[f] = next ?? null;
    before[f] = prev;
    after[f] = next ?? null;
  }

  // Location subfields — only overwrite the supplied ones; keep the rest.
  const loc = prospect.location ?? { city: '', stateOrRegion: '', country: 'US' };
  const locFields: Array<'city' | 'stateOrRegion' | 'country'> = [
    'city',
    'stateOrRegion',
    'country',
  ];
  let locationTouched = false;
  const nextLoc = { ...loc };
  for (const f of locFields) {
    if (payload[f] === undefined) continue;
    const next = (payload[f] as string).trim();
    const prev = (loc as unknown as Record<string, unknown>)[f] ?? null;
    if ((next ?? null) === (prev ?? null)) continue;
    (nextLoc as Record<string, unknown>)[f] = next;
    before[`location.${f}`] = prev;
    after[`location.${f}`] = next;
    locationTouched = true;
  }

  // lastInitial mirrors lastName — keep it in sync if lastName changed.
  if (typeof set.lastName === 'string' && set.lastName.length > 0) {
    set.lastInitial = set.lastName.charAt(0).toUpperCase();
  }

  if (locationTouched) set.location = nextLoc;

  if (Object.keys(set).length === 0) {
    return { ok: false, error: { kind: 'no_fields' } };
  }

  const now = new Date().toISOString();
  set.updatedAt = now;

  await gatewayCall('mongodb', 'update', {
    database: MONGO_DB,
    collection: PROSPECTS_COLLECTION,
    filter: { prospectId },
    update: { $set: set },
  });

  await appendAuditEntry({
    actor,
    action: `${verbNs(actor)}.prospect.edit`,
    entity: {
      kind: 'prospect',
      id: prospectId,
      displayLabel: `${prospect.firstName} ${prospect.lastName}`.trim(),
    },
    severity: 'info',
    before,
    after,
    reason: payload.reason,
  });

  const row = await refreshRowFor(prospectId);
  if (!row) return { ok: false, error: { kind: 'row_unavailable' } };
  return { ok: true, value: { prospectId, row } };
}

/* ── soft delete (record-only; TANK UNTOUCHED) ──────────────────────── */

export async function adminSoftDeleteProspect(
  prospectId: string,
  payload: McsAdminSoftDeletePayload,
  actor: AdminActor,
): Promise<Result<{ prospectId: string; deletedAt: string }>> {
  if (!validReason(payload.reason)) {
    return { ok: false, error: { kind: 'reason_too_short' } };
  }

  const prospect = await findProspectByIdAnyState(prospectId);
  if (!prospect) return { ok: false, error: { kind: 'prospect_not_found' } };
  if (isDeleted(prospect)) return { ok: false, error: { kind: 'prospect_deleted' } };

  const deletedAt = new Date().toISOString();

  // RECORD-ONLY mutation. No pool_placements write, no counter touch, no
  // Neo4j tank-edge change, no ticker mutation. The slot persists exactly
  // as-is until the separate manual 8-week flush ages it out (Chat #138).
  const patch: Partial<McsAdminSoftDeleteState> = {
    deleted: true,
    deletedAt,
    deletedReason: payload.reason,
    deletedByTmagId: actor.tmagId,
  };

  await gatewayCall('mongodb', 'update', {
    database: MONGO_DB,
    collection: PROSPECTS_COLLECTION,
    filter: { prospectId },
    update: { $set: patch },
  });

  await appendAuditEntry({
    actor,
    action: `${verbNs(actor)}.prospect.delete`,
    entity: {
      kind: 'prospect',
      id: prospectId,
      displayLabel: `${prospect.firstName} ${prospect.lastName}`.trim(),
    },
    severity: 'info',
    before: { deleted: false },
    after: { deleted: true, deletedAt, tankUntouched: true },
    reason: payload.reason,
  });

  return { ok: true, value: { prospectId, deletedAt } };
}

/* ── restore ────────────────────────────────────────────────────────── */

export async function adminRestoreProspect(
  prospectId: string,
  payload: McsAdminRestorePayload,
  actor: AdminActor,
): Promise<Result<{ prospectId: string; restoredAt: string; row: McsAdminProspectDirectoryRow }>> {
  if (!validReason(payload.reason)) {
    return { ok: false, error: { kind: 'reason_too_short' } };
  }

  const prospect = await findProspectByIdAnyState(prospectId);
  if (!prospect) return { ok: false, error: { kind: 'prospect_not_found' } };
  if (!isDeleted(prospect)) return { ok: false, error: { kind: 'prospect_not_deleted' } };

  const restoredAt = new Date().toISOString();
  const patch: Partial<McsAdminSoftDeleteState> = {
    deleted: false,
    restoredAt,
    restoredByTmagId: actor.tmagId,
    // deletedAt / deletedReason / deletedByTmagId LEFT as the historical record.
  };

  await gatewayCall('mongodb', 'update', {
    database: MONGO_DB,
    collection: PROSPECTS_COLLECTION,
    filter: { prospectId },
    update: { $set: patch },
  });

  await appendAuditEntry({
    actor,
    action: `${verbNs(actor)}.prospect.restore`,
    entity: {
      kind: 'prospect',
      id: prospectId,
      displayLabel: `${prospect.firstName} ${prospect.lastName}`.trim(),
    },
    severity: 'info',
    before: { deleted: true, deletedReason: prospect.deletedReason ?? null },
    after: { deleted: false, restoredAt },
    reason: payload.reason,
  });

  const row = await refreshRowFor(prospectId);
  if (!row) return { ok: false, error: { kind: 'row_unavailable' } };
  return { ok: true, value: { prospectId, restoredAt, row } };
}
