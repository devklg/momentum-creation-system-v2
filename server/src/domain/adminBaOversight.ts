/**
 * Admin BA Oversight — wireframe 4.C / locked-spec 4.C (Section C).
 *
 * Backs the Kevin-only /admin Brand Ambassador directory + per-BA profile
 * drawer + sponsor override flow. READ side composes one row per BA from
 * the 7 existing collections; WRITE side appends to two new collections
 * and the 4.J audit substrate.
 *
 *   READ
 *     team_magnificent_members          identity + sponsor + lastLoginAt
 *     access_codes               the BA's owned TMAG-XXXX code (one per BA, 2.3)
 *     ba_commitments             welcome completion (J.3)
 *     invite_tokens              2-in-72 count + lifetime invite count
 *     crm_followups              oldest open follow-up due date
 *     fast_start_progress        Fast Start modules complete (0..5)
 *     admin_sponsor_overrides    override history (C.5)
 *     admin_curated_leader_tags  Kevin-toggled badge (C.4)
 *     admin_ba_notes             Kevin-private append-only notes (C.4)
 *
 *   WRITE
 *     applySponsorOverride       NEW override row + team_magnificent_members patch
 *                                + 4.J audit entry (severity 'critical')
 *     setCuratedLeaderTag        upsert (manual existence branch — PERSISTENCE
 *                                doesn't honor upsert) + 4.J audit ('info')
 *     appendBaNote               NEW note row + 4.J audit ('info')
 *
 * Compliance discipline (Chat #89):
 *   - No algorithmic flagging. Every directory column is a raw count or a
 *     raw timestamp; the UI never compares them to a threshold and emits a
 *     judgment.
 *   - THREE is the upstream authority. The sponsor override
 *     mirrors the BA's request and updates THIS system's mirror — it does
 *     NOT push to THREE. Original sponsor is preserved on the BA row as
 *     `originalSponsorTmagId` so the drawer can render it as historical
 *     record (the BA cockpit only ever reads `sponsorTmagId`).
 *   - System-detected leader = (binary-qualified) ∧ (≥5 personally
 *     enrolled). Binary qualification is not mirrored locally yet (same
 *     gap admin/dashboard surfaces in its `leaderDetectionNote`), so the
 *     badge is currently always false. Kept as a stub field so the moment
 *     the upstream feed lands, the row picks it up without a schema change.
 */

import { randomBytes } from 'node:crypto';
import { persistenceCall } from '../services/persistence/dispatch.js';
import { tripleStackWrite } from '../services/tripleStack.js';
import { appendAuditEntry } from './auditLog.js';
import { findBAByTmagId, type BARecord } from './ba.js';
import { normalizeEntitlements, setMemberEntitlement, type EntitlementAction } from './entitlements.js';
import type {
  McsAdminBaDirectoryRow,
  McsAdminBaNoteEntry,
  McsAdminBaProfileBundle,
  McsAdminSponsorOverrideEntry,
  McsIsoTimestamp,
} from '@momentum/shared';

const MONGO_DB = 'momentum';
const BA_COLLECTION = 'team_magnificent_members';
const ACCESS_CODES_COLLECTION = 'tmag_access_codes';
const COMMITMENTS_COLLECTION = 'tmag_commitments';
const TOKENS_COLLECTION = 'tmag_prospect_invite_tokens';
const FOLLOWUPS_COLLECTION = 'tmag_prospect_crm_followups';
const FAST_START_COLLECTION = 'tmag_fast_start_progress';
const OVERRIDES_COLLECTION = 'tmag_admin_sponsor_overrides';
const CURATED_LEADER_TAGS_COLLECTION = 'tmag_admin_curated_leader_tags';
const BA_NOTES_COLLECTION = 'tmag_admin_member_notes';

/** Honest disclosure — same wording the Core Dashboard uses (Chat #134). */
export const LEADER_DETECTION_NOTE =
  "System-detected leader requires binary qualification, which is not yet mirrored from THREE. Until that feed lands, only Kevin-curated leader badges appear.";

const PROFILE_FIELDS_FOR_COMPLETENESS = [
  'firstName',
  'lastName',
  'email',
  'phone',
  'threeUsername',
  'threeBaId',
  'photoUrl',
  'bio',
  'marketRegion',
  'timezone',
  'preferredContact',
] as const;

const ACTIVE_LOGIN_WINDOW_MS = 24 * 60 * 60 * 1000;
const TWO_IN_SEVENTY_TWO_WINDOW_MS = 72 * 60 * 60 * 1000;

interface BaRecordExtras {
  photoUrl?: string | null;
  bio?: string | null;
  marketRegion?: string | null;
  preferredContact?: string | null;
  entitlements?: unknown;
  welcome_seen?: boolean;
  welcome_seen_at?: string;
  commitment_accepted?: boolean;
  commitment_accepted_at?: string;
  /** Stamped only when a C.5 override has been applied. Original sponsor at signup. */
  originalSponsorTmagId?: string | null;
  originalSponsorThreeBaId?: string | null;
}

type BARecordWithExtras = BARecord & BaRecordExtras;

interface AccessCodeLite {
  code: string;
  sponsorTmagId: string;
}

interface CommitmentLite {
  tmagId: string;
  acceptedAt: string;
}

interface TokenLite {
  sponsorTmagId: string;
  createdAt: string;
}

interface FollowUpLite {
  sponsorTmagId: string;
  dueAt: string;
  clearedAt: string | null;
}

interface FastStartLite {
  tmagId: string;
  moduleId: number;
  state: 'not_started' | 'in_progress' | 'completed';
}

interface SponsorOverrideRecord {
  _id?: string;
  overrideId: string;
  tmagId: string;
  previousSponsorTmagId: string;
  newSponsorTmagId: string;
  requestingTmagId: string;
  reason: string;
  performedByTmagId: string;
  performedAt: string;
  auditEntryId: string;
}

interface CuratedLeaderTagRecord {
  _id?: string;
  tmagId: string;
  curated: boolean;
  setByTmagId: string;
  setAt: string;
}

interface BaNoteRecord {
  _id?: string;
  noteId: string;
  tmagId: string;
  text: string;
  authorTmagId: string;
  createdAt: string;
}

function mintOverrideId(): string {
  return `override_${Date.now().toString(36)}_${randomBytes(4).toString('hex')}`;
}

function mintNoteId(): string {
  return `note_${Date.now().toString(36)}_${randomBytes(4).toString('hex')}`;
}

function profileCompletenessPct(ba: BARecordWithExtras): number {
  let filled = 0;
  const bag = ba as unknown as Record<string, unknown>;
  for (const f of PROFILE_FIELDS_FOR_COMPLETENESS) {
    const v = bag[f];
    if (typeof v === 'string' && v.trim().length > 0) filled += 1;
  }
  return Math.round((filled / PROFILE_FIELDS_FOR_COMPLETENESS.length) * 100);
}

function deriveStatus(ba: BARecordWithExtras): 'active' | 'inactive' | 'suspended' {
  if ((ba as unknown as Record<string, unknown>).suspended === true) return 'suspended';
  if (!ba.lastLoginAt) return 'inactive';
  const since = Date.now() - new Date(ba.lastLoginAt).getTime();
  return since <= ACTIVE_LOGIN_WINDOW_MS ? 'active' : 'inactive';
}

function maxIso(...values: Array<string | null | undefined>): McsIsoTimestamp | null {
  let best: string | null = null;
  for (const v of values) {
    if (!v) continue;
    if (best === null || v > best) best = v;
  }
  return best;
}

async function fetchAllPaged<T>(
  database: string,
  collection: string,
  filter: Record<string, unknown>,
  pageSize = 1000,
): Promise<T[]> {
  // The PERSISTENCE has no cursor; we page by ascending _id. For now `filter`
  // is the same across pages; the BA roster is small enough that a single
  // bounded query (limit 2000) is fine, but the paged primitive is here so
  // the join collections can grow without changing the call sites.
  const all: T[] = [];
  let offset = 0;
  let lastBatchSize = pageSize;
  while (lastBatchSize === pageSize && offset < 50_000) {
    const res = await persistenceCall<{ documents: T[]; count?: number }>(
      'mongodb',
      'query',
      {
        database,
        collection,
        filter,
        sort: { _id: 1 },
        limit: pageSize,
        skip: offset,
      },
    );
    const docs = res.documents ?? [];
    all.push(...docs);
    lastBatchSize = docs.length;
    offset += docs.length;
  }
  return all;
}

/**
 * Build the C.1 directory rows. One ORM-style aggregate across the 7
 * collections. Cap defaults to 500 BAs per page; the table view is the
 * primary surface and the design is "flat, sortable, filterable" — not a
 * deep-pagination experience.
 */
export async function listBADirectory(
  limit = 500,
): Promise<{ rows: McsAdminBaDirectoryRow[]; leaderDetectionNote: string }> {
  // 1. Pull the BA roster (newest first, capped).
  const baRaw = await persistenceCall<{ documents: BARecordWithExtras[] }>(
    'mongodb',
    'query',
    {
      database: MONGO_DB,
      collection: BA_COLLECTION,
      filter: {},
      sort: { createdAt: -1 },
      limit,
    },
  );
  const bas = baRaw.documents ?? [];
  if (bas.length === 0) {
    return { rows: [], leaderDetectionNote: LEADER_DETECTION_NOTE };
  }
  const baIds = bas.map((b) => b.tmagId);

  // 2. Resolve sponsor names (current + original). Build a tmagId -> name map
  // from the in-window roster, then batch-fetch any sponsors that fell
  // outside the window so the column is correct for the whole table.
  const nameByTmagId = new Map<string, string>();
  for (const b of bas) {
    nameByTmagId.set(b.tmagId, `${b.firstName} ${b.lastName}`.trim());
  }
  const missingSponsors = new Set<string>();
  for (const b of bas) {
    if (b.sponsorTmagId && !nameByTmagId.has(b.sponsorTmagId)) {
      missingSponsors.add(b.sponsorTmagId);
    }
    if (b.originalSponsorTmagId && !nameByTmagId.has(b.originalSponsorTmagId)) {
      missingSponsors.add(b.originalSponsorTmagId);
    }
  }
  if (missingSponsors.size > 0) {
    const r = await persistenceCall<{ documents: BARecord[] }>('mongodb', 'query', {
      database: MONGO_DB,
      collection: BA_COLLECTION,
      filter: { tmagId: { $in: Array.from(missingSponsors) } },
      limit: missingSponsors.size,
    });
    for (const s of r.documents ?? []) {
      nameByTmagId.set(s.tmagId, `${s.firstName} ${s.lastName}`.trim());
    }
  }

  // 3. Owned access codes (one per BA — sponsorTmagId is the owner).
  const codes = await fetchAllPaged<AccessCodeLite>(
    MONGO_DB,
    ACCESS_CODES_COLLECTION,
    { sponsorTmagId: { $in: baIds }, active: true },
  );
  const codeByTmagId = new Map<string, string>();
  for (const c of codes) {
    if (!codeByTmagId.has(c.sponsorTmagId)) codeByTmagId.set(c.sponsorTmagId, c.code);
  }

  // 4. Welcome commitments — most recent acceptedAt per BA.
  const commitments = await fetchAllPaged<CommitmentLite>(
    MONGO_DB,
    COMMITMENTS_COLLECTION,
    { tmagId: { $in: baIds } },
  );
  const welcomeByTmagId = new Map<string, string>();
  for (const c of commitments) {
    const cur = welcomeByTmagId.get(c.tmagId);
    if (!cur || c.acceptedAt > cur) welcomeByTmagId.set(c.tmagId, c.acceptedAt);
  }

  // 5. Invite tokens — pull all for this batch, then compute lifetime count
  // + 2-in-72 client-side. (BA count × tokens-per-BA is small at v1 scale;
  // when it isn't, the PERSISTENCE grows aggregation and this becomes a $match
  // + $group.)
  const tokens = await fetchAllPaged<TokenLite>(
    MONGO_DB,
    TOKENS_COLLECTION,
    { sponsorTmagId: { $in: baIds } },
  );
  const lifetimeByTmagId = new Map<string, number>();
  const twoIn72ByTmagId = new Map<string, number>();
  const windowStart = new Date(Date.now() - TWO_IN_SEVENTY_TWO_WINDOW_MS).toISOString();
  for (const t of tokens) {
    lifetimeByTmagId.set(t.sponsorTmagId, (lifetimeByTmagId.get(t.sponsorTmagId) ?? 0) + 1);
    if (t.createdAt >= windowStart) {
      twoIn72ByTmagId.set(t.sponsorTmagId, (twoIn72ByTmagId.get(t.sponsorTmagId) ?? 0) + 1);
    }
  }

  // 6. CRM follow-ups — oldest open dueAt per BA.
  const followups = await fetchAllPaged<FollowUpLite>(
    MONGO_DB,
    FOLLOWUPS_COLLECTION,
    { sponsorTmagId: { $in: baIds }, clearedAt: null },
  );
  const oldestFollowupByTmagId = new Map<string, string>();
  for (const f of followups) {
    const cur = oldestFollowupByTmagId.get(f.sponsorTmagId);
    if (!cur || f.dueAt < cur) oldestFollowupByTmagId.set(f.sponsorTmagId, f.dueAt);
  }

  // 7. Fast Start — count modules in `completed` per BA.
  const fastStart = await fetchAllPaged<FastStartLite>(
    MONGO_DB,
    FAST_START_COLLECTION,
    { tmagId: { $in: baIds } },
  );
  const completedModulesByTmagId = new Map<string, number>();
  for (const m of fastStart) {
    if (m.state === 'completed') {
      completedModulesByTmagId.set(m.tmagId, (completedModulesByTmagId.get(m.tmagId) ?? 0) + 1);
    }
  }

  // 8. Curated leader tags.
  const tags = await fetchAllPaged<CuratedLeaderTagRecord>(
    MONGO_DB,
    CURATED_LEADER_TAGS_COLLECTION,
    { tmagId: { $in: baIds } },
  );
  const curatedByTmagId = new Map<string, boolean>();
  for (const t of tags) curatedByTmagId.set(t.tmagId, t.curated);

  // 9. Assemble rows.
  const rows: McsAdminBaDirectoryRow[] = bas.map((ba) => {
    const completedMods = completedModulesByTmagId.get(ba.tmagId) ?? 0;
    const welcomeAt = welcomeByTmagId.get(ba.tmagId) ?? null;
    const originalSponsorTmagId =
      ba.originalSponsorTmagId && ba.originalSponsorTmagId !== ba.sponsorTmagId
        ? ba.originalSponsorTmagId
        : null;
    const lastActivityAt = maxIso(ba.lastLoginAt, welcomeAt);
    return {
      tmagId: ba.tmagId,
      threeBaId: ba.threeBaId,
      fullName: `${ba.firstName} ${ba.lastName}`.trim(),
      email: ba.email ?? null,
      phone: ba.phone ?? null,
      accessCodeOwned: codeByTmagId.get(ba.tmagId) ?? null,
      sponsorTmagId: ba.sponsorTmagId ?? null,
      sponsorName: ba.sponsorTmagId ? nameByTmagId.get(ba.sponsorTmagId) ?? null : null,
      originalSponsorTmagId,
      originalSponsorName: originalSponsorTmagId
        ? nameByTmagId.get(originalSponsorTmagId) ?? null
        : null,
      joinedAt: ba.createdAt,
      welcomeAcceptedAt: welcomeAt,
      lastLoginAt: ba.lastLoginAt ?? null,
      twoInSeventyTwoCount: twoIn72ByTmagId.get(ba.tmagId) ?? 0,
      twoInSeventyTwoWindowStart: windowStart,
      profileCompletenessPct: profileCompletenessPct(ba),
      personalInvitesCount: lifetimeByTmagId.get(ba.tmagId) ?? 0,
      oldestOpenFollowUpDueAt: oldestFollowupByTmagId.get(ba.tmagId) ?? null,
      trainingModulesCompleted: completedMods,
      trainingComplete: completedMods >= 5,
      status: deriveStatus(ba),
      lastActivityAt,
      systemDetectedLeader: false,
      curatedLeader: curatedByTmagId.get(ba.tmagId) ?? false,
      entitlements: normalizeEntitlements(ba.entitlements),
      deleted: (ba as unknown as Record<string, unknown>).deleted === true,
    };
  });

  return { rows, leaderDetectionNote: LEADER_DETECTION_NOTE };
}

/** Build the C.4 profile bundle for one BA. */
export async function getTmagProfileBundle(
  tmagId: string,
): Promise<McsAdminBaProfileBundle | null> {
  // Reuse listBADirectory's projection so the table row + drawer row are
  // identical (the directory limit is enough for typical use; if the
  // target BA is outside the window, fall through to a focused build).
  const { rows } = await listBADirectory(2000);
  let row = rows.find((r) => r.tmagId === tmagId) ?? null;
  if (!row) {
    // Focused build — the requested BA wasn't in the recent batch.
    const single = await listBADirectory(1).then((r) =>
      r.rows.find((x) => x.tmagId === tmagId) ?? null,
    );
    if (single) row = single;
    else {
      const ba = await findBAByTmagId(tmagId);
      if (!ba) return null;
      // Final fallback — synthesize a sparse row so the drawer renders SOMETHING.
      row = {
        tmagId: ba.tmagId,
        threeBaId: ba.threeBaId,
        fullName: `${ba.firstName} ${ba.lastName}`.trim(),
        email: ba.email ?? null,
        phone: ba.phone ?? null,
        accessCodeOwned: null,
        sponsorTmagId: ba.sponsorTmagId ?? null,
        sponsorName: null,
        originalSponsorTmagId: null,
        originalSponsorName: null,
        joinedAt: ba.createdAt,
        welcomeAcceptedAt: null,
        lastLoginAt: ba.lastLoginAt ?? null,
        twoInSeventyTwoCount: 0,
        twoInSeventyTwoWindowStart: new Date(
          Date.now() - TWO_IN_SEVENTY_TWO_WINDOW_MS,
        ).toISOString(),
        profileCompletenessPct: 0,
        personalInvitesCount: 0,
        oldestOpenFollowUpDueAt: null,
        trainingModulesCompleted: 0,
        trainingComplete: false,
        status: 'inactive',
        lastActivityAt: ba.lastLoginAt ?? null,
        systemDetectedLeader: false,
        curatedLeader: false,
        entitlements: normalizeEntitlements((ba as unknown as { entitlements?: unknown }).entitlements),
        deleted: (ba as unknown as Record<string, unknown>).deleted === true,
      };
    }
  }

  const [history, notes] = await Promise.all([
    fetchOverrideHistory(tmagId),
    fetchBaNotes(tmagId),
  ]);

  return {
    row,
    sponsorOverrideHistory: history,
    notes,
  };
}

export async function setBaEntitlement(args: {
  tmagId: string;
  action: EntitlementAction;
  performedByTmagId: string;
  performedByDisplayName: string;
}): Promise<{ ok: true; entitlements: string[] } | { ok: false; error: 'ba_not_found' }> {
  return setMemberEntitlement({
    tmagId: args.tmagId,
    entitlement: 'vm_dialer',
    action: args.action,
    performedByTmagId: args.performedByTmagId,
    performedByDisplayName: args.performedByDisplayName,
  });
}

async function fetchOverrideHistory(
  tmagId: string,
): Promise<McsAdminSponsorOverrideEntry[]> {
  const r = await persistenceCall<{ documents: SponsorOverrideRecord[] }>(
    'mongodb',
    'query',
    {
      database: MONGO_DB,
      collection: OVERRIDES_COLLECTION,
      filter: { tmagId },
      sort: { performedAt: -1 },
      limit: 50,
    },
  );
  return (r.documents ?? []).map((o) => ({
    overrideId: o.overrideId,
    tmagId: o.tmagId,
    previousSponsorTmagId: o.previousSponsorTmagId,
    newSponsorTmagId: o.newSponsorTmagId,
    requestingTmagId: o.requestingTmagId,
    reason: o.reason,
    performedByTmagId: o.performedByTmagId,
    performedAt: o.performedAt,
    auditEntryId: o.auditEntryId,
  }));
}

async function fetchBaNotes(tmagId: string): Promise<McsAdminBaNoteEntry[]> {
  const r = await persistenceCall<{ documents: BaNoteRecord[] }>('mongodb', 'query', {
    database: MONGO_DB,
    collection: BA_NOTES_COLLECTION,
    filter: { tmagId },
    sort: { createdAt: -1 },
    limit: 100,
  });
  return (r.documents ?? []).map((n) => ({
    noteId: n.noteId,
    tmagId: n.tmagId,
    text: n.text,
    authorTmagId: n.authorTmagId,
    createdAt: n.createdAt,
  }));
}

export type SponsorOverrideError =
  | { kind: 'ba_not_found' }
  | { kind: 'new_sponsor_not_found' }
  | { kind: 'requesting_ba_not_found' }
  | { kind: 'no_op'; reason: string }
  | { kind: 'self_sponsor' };

/** Apply the C.5 sponsor override. Critical audit entry. */
export async function applySponsorOverride(args: {
  tmagId: string;
  requestingTmagId: string;
  newSponsorTmagId: string;
  reason: string;
  performedByTmagId: string;
  performedByDisplayName: string;
}): Promise<{ ok: true; entry: McsAdminSponsorOverrideEntry } | { ok: false; error: SponsorOverrideError }> {
  const ba = (await findBAByTmagId(args.tmagId)) as BARecordWithExtras | null;
  if (!ba) return { ok: false, error: { kind: 'ba_not_found' } };

  if (args.newSponsorTmagId === args.tmagId) {
    return { ok: false, error: { kind: 'self_sponsor' } };
  }

  const [newSponsor, requestingBa] = await Promise.all([
    findBAByTmagId(args.newSponsorTmagId),
    findBAByTmagId(args.requestingTmagId),
  ]);
  if (!newSponsor) return { ok: false, error: { kind: 'new_sponsor_not_found' } };
  if (!requestingBa) return { ok: false, error: { kind: 'requesting_ba_not_found' } };

  const previousSponsorTmagId = ba.sponsorTmagId ?? '';
  if (previousSponsorTmagId === args.newSponsorTmagId) {
    return {
      ok: false,
      error: { kind: 'no_op', reason: 'new sponsor matches current sponsor' },
    };
  }

  // Preserve the original sponsor on the BA record if this is the first
  // override (sponsor immutability per locked-spec 3.5 says the BA's
  // ORIGINAL sponsor is what's immutable — the override changes the
  // mirror's current sponsor, but the original survives as history).
  const originalSponsorTmagId = ba.originalSponsorTmagId ?? previousSponsorTmagId;
  const originalSponsorThreeBaId =
    ba.originalSponsorThreeBaId ?? ba.sponsorThreeBaId ?? '';

  const performedAt = new Date().toISOString();
  const overrideId = mintOverrideId();

  // 1. Apply the patch to the BA record. originalSponsorTmagId is stamped
  // only the first time so re-overrides don't drift the original away.
  await persistenceCall('mongodb', 'update', {
    database: MONGO_DB,
    collection: BA_COLLECTION,
    filter: { tmagId: args.tmagId },
    update: {
      $set: {
        sponsorTmagId: args.newSponsorTmagId,
        sponsorThreeBaId: newSponsor.threeBaId,
        originalSponsorTmagId,
        originalSponsorThreeBaId,
      },
    },
  });

  // 2. Append the audit entry FIRST so we have its entryId to stamp on the
  // override record (closes the substrate <-> record link).
  const audit = await appendAuditEntry({
    actor: {
      kind: 'admin',
      tmagId: args.performedByTmagId,
      displayName: args.performedByDisplayName,
    },
    action: 'admin.sponsor.override',
    entity: {
      kind: 'brand_ambassador',
      id: args.tmagId,
      displayLabel: `${ba.firstName} ${ba.lastName}`.trim(),
    },
    severity: 'critical',
    before: {
      sponsorTmagId: previousSponsorTmagId,
      sponsorThreeBaId: ba.sponsorThreeBaId ?? null,
      originalSponsorTmagId: ba.originalSponsorTmagId ?? null,
    },
    after: {
      sponsorTmagId: args.newSponsorTmagId,
      sponsorThreeBaId: newSponsor.threeBaId,
      originalSponsorTmagId,
    },
    reason: args.reason,
    context: {
      ip: null,
      userAgent: null,
      route: `/api/admin/bas/${args.tmagId}/sponsor-override`,
      method: 'POST',
      requestId: null,
    },
  });

  // 3. Write the override record (triple-stacked — Neo4j stamps a SUPERSEDED
  // edge so genealogy traversals can see the original sponsor too).
  const record: SponsorOverrideRecord = {
    overrideId,
    tmagId: args.tmagId,
    previousSponsorTmagId,
    newSponsorTmagId: args.newSponsorTmagId,
    requestingTmagId: args.requestingTmagId,
    reason: args.reason,
    performedByTmagId: args.performedByTmagId,
    performedAt,
    auditEntryId: audit.entryId,
  };

  await tripleStackWrite({
    id: overrideId,
    mongoCollection: OVERRIDES_COLLECTION,
    mongoDoc: { ...record },
    neo4j: {
      cypher: `
        MERGE (n:TeamMagnificentMember {tmagId: $tmagId})
        MERGE (newS:TeamMagnificentMember {tmagId: $newSponsorTmagId})
        MERGE (prevS:TeamMagnificentMember {tmagId: $previousSponsorTmagId})
        MERGE (o:TmagSponsorOverride {overrideId: $id})
        SET o.performedAt = datetime($performedAt),
            o.reason = $reason,
            o.auditEntryId = $auditEntryId
        MERGE (n)-[:SPONSORED_BY {current: true}]->(newS)
        MERGE (n)-[:HAS_ORIGINAL_SPONSOR]->(prevS)
        MERGE (n)-[:HAS_OVERRIDE]->(o)
      `,
      params: {
        tmagId: args.tmagId,
        newSponsorTmagId: args.newSponsorTmagId,
        previousSponsorTmagId,
        performedAt,
        reason: args.reason,
        auditEntryId: audit.entryId,
      },
    },
    chroma: {
      collection: 'mcs_audit_log',
      document: `sponsor override tmagId=${args.tmagId} previous=${previousSponsorTmagId} new=${args.newSponsorTmagId} requestedBy=${args.requestingTmagId} reason="${args.reason}"`,
      metadata: {
        action: 'admin.sponsor.override',
        entityKind: 'brand_ambassador',
        entityId: args.tmagId,
        performedAt,
      },
    },
  });

  const entry: McsAdminSponsorOverrideEntry = {
    overrideId,
    tmagId: args.tmagId,
    previousSponsorTmagId,
    newSponsorTmagId: args.newSponsorTmagId,
    requestingTmagId: args.requestingTmagId,
    reason: args.reason,
    performedByTmagId: args.performedByTmagId,
    performedAt,
    auditEntryId: audit.entryId,
  };
  return { ok: true, entry };
}

/** Toggle the Kevin-curated leader badge for one BA. */
export async function setCuratedLeaderTag(args: {
  tmagId: string;
  curated: boolean;
  setByTmagId: string;
  setByDisplayName: string;
  reason?: string;
}): Promise<void> {
  const setAt = new Date().toISOString();

  // PERSISTENCE doesn't honor upsert — branch on existence ourselves.
  const existing = await persistenceCall<{ documents: CuratedLeaderTagRecord[] }>(
    'mongodb',
    'query',
    {
      database: MONGO_DB,
      collection: CURATED_LEADER_TAGS_COLLECTION,
      filter: { tmagId: args.tmagId },
      limit: 1,
    },
  );
  const prior = existing.documents?.[0]?.curated ?? false;

  if (existing.documents && existing.documents.length > 0) {
    await persistenceCall('mongodb', 'update', {
      database: MONGO_DB,
      collection: CURATED_LEADER_TAGS_COLLECTION,
      filter: { tmagId: args.tmagId },
      update: { $set: { curated: args.curated, setByTmagId: args.setByTmagId, setAt } },
    });
  } else {
    await persistenceCall('mongodb', 'insert', {
      database: MONGO_DB,
      collection: CURATED_LEADER_TAGS_COLLECTION,
      documents: [
        {
          _id: `curated_${args.tmagId}`,
          tmagId: args.tmagId,
          curated: args.curated,
          setByTmagId: args.setByTmagId,
          setAt,
        },
      ],
    });
  }

  await appendAuditEntry({
    actor: { kind: 'admin', tmagId: args.setByTmagId, displayName: args.setByDisplayName },
    action: args.curated ? 'admin.leader.curated_set' : 'admin.leader.curated_clear',
    entity: { kind: 'brand_ambassador', id: args.tmagId, displayLabel: null },
    severity: 'info',
    before: { curated: prior },
    after: { curated: args.curated },
    reason: args.reason ?? null,
  });
}

/** Append a Kevin-only note about a BA. Append-only. */
export async function appendBaNote(args: {
  tmagId: string;
  text: string;
  authorTmagId: string;
  authorDisplayName: string;
}): Promise<McsAdminBaNoteEntry> {
  const noteId = mintNoteId();
  const createdAt = new Date().toISOString();
  const record: BaNoteRecord = {
    noteId,
    tmagId: args.tmagId,
    text: args.text,
    authorTmagId: args.authorTmagId,
    createdAt,
  };

  await persistenceCall('mongodb', 'insert', {
    database: MONGO_DB,
    collection: BA_NOTES_COLLECTION,
    documents: [{ _id: noteId, ...record }],
  });

  await appendAuditEntry({
    actor: {
      kind: 'admin',
      tmagId: args.authorTmagId,
      displayName: args.authorDisplayName,
    },
    action: 'admin.ba.note_added',
    entity: { kind: 'brand_ambassador', id: args.tmagId, displayLabel: null },
    severity: 'info',
    before: null,
    after: { noteId, length: args.text.length },
  });

  return {
    noteId,
    tmagId: args.tmagId,
    text: args.text,
    authorTmagId: args.authorTmagId,
    createdAt,
  };
}
