/**
 * Admin BA Oversight — wireframe 4.C / locked-spec 4.C (Section C).
 *
 * Backs the Kevin-only /admin Brand Ambassador directory + per-BA profile
 * drawer + sponsor override flow. READ side composes one row per BA from
 * the 7 existing collections; WRITE side appends to two new collections
 * and the 4.J audit substrate.
 *
 *   READ
 *     brand_ambassadors          identity + sponsor + lastLoginAt
 *     access_codes               the BA's owned TM-XXXX code (one per BA, 2.3)
 *     ba_commitments             welcome completion (J.3)
 *     invite_tokens              2-in-72 count + lifetime invite count
 *     crm_followups              oldest open follow-up due date
 *     fast_start_progress        Fast Start modules complete (0..5)
 *     michael_schedules          interview status
 *     michael_interviews         transcript link (C.4 drawer only)
 *     admin_sponsor_overrides    override history (C.5)
 *     admin_curated_leader_tags  Kevin-toggled badge (C.4)
 *     admin_ba_notes             Kevin-private append-only notes (C.4)
 *
 *   WRITE
 *     applySponsorOverride       NEW override row + brand_ambassadors patch
 *                                + 4.J audit entry (severity 'critical')
 *     setCuratedLeaderTag        upsert (manual existence branch — gateway
 *                                doesn't honor upsert) + 4.J audit ('info')
 *     appendBaNote               NEW note row + 4.J audit ('info')
 *
 * Compliance discipline (Chat #89):
 *   - No algorithmic flagging. Every directory column is a raw count or a
 *     raw timestamp; the UI never compares them to a threshold and emits a
 *     judgment.
 *   - THREE International is the upstream authority. The sponsor override
 *     mirrors the BA's request and updates THIS system's mirror — it does
 *     NOT push to THREE. Original sponsor is preserved on the BA row as
 *     `originalSponsorBaId` so the drawer can render it as historical
 *     record (the BA cockpit only ever reads `sponsorBaId`).
 *   - System-detected leader = (binary-qualified) ∧ (≥5 personally
 *     enrolled). Binary qualification is not mirrored locally yet (same
 *     gap admin/dashboard surfaces in its `leaderDetectionNote`), so the
 *     badge is currently always false. Kept as a stub field so the moment
 *     the upstream feed lands, the row picks it up without a schema change.
 */

import { randomBytes } from 'node:crypto';
import { gatewayCall } from '../services/gateway.js';
import { tripleStackWrite } from '../services/tripleStack.js';
import { appendAuditEntry } from './auditLog.js';
import { findBAByBaId, type BARecord } from './ba.js';
import type {
  AdminBaDirectoryRow,
  AdminBaNoteEntry,
  AdminBaProfileBundle,
  AdminSponsorOverrideEntry,
  IsoTimestamp,
} from '@momentum/shared';

const MONGO_DB = 'momentum';
const BA_COLLECTION = 'brand_ambassadors';
const ACCESS_CODES_COLLECTION = 'access_codes';
const COMMITMENTS_COLLECTION = 'ba_commitments';
const TOKENS_COLLECTION = 'invite_tokens';
const FOLLOWUPS_COLLECTION = 'crm_followups';
const FAST_START_COLLECTION = 'fast_start_progress';
const MICHAEL_SCHEDULES_COLLECTION = 'michael_schedules';
const MICHAEL_INTERVIEWS_COLLECTION = 'michael_interviews';
const OVERRIDES_COLLECTION = 'admin_sponsor_overrides';
const CURATED_LEADER_TAGS_COLLECTION = 'admin_curated_leader_tags';
const BA_NOTES_COLLECTION = 'admin_ba_notes';

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
  welcome_seen?: boolean;
  welcome_seen_at?: string;
  commitment_accepted?: boolean;
  commitment_accepted_at?: string;
  /** Stamped only when a C.5 override has been applied. Original sponsor at signup. */
  originalSponsorBaId?: string | null;
  originalSponsorThreeBaId?: string | null;
}

type BARecordWithExtras = BARecord & BaRecordExtras;

interface AccessCodeLite {
  code: string;
  sponsorBaId: string;
}

interface CommitmentLite {
  baId: string;
  acceptedAt: string;
}

interface TokenLite {
  sponsorBaId: string;
  createdAt: string;
}

interface FollowUpLite {
  sponsorBaId: string;
  dueAt: string;
  clearedAt: string | null;
}

interface FastStartLite {
  baId: string;
  moduleId: number;
  state: 'not_started' | 'in_progress' | 'completed';
}

interface MichaelScheduleLite {
  baId: string;
  status: 'awaiting_schedule' | 'scheduled' | 'in_progress' | 'completed' | 'missed';
  completedAt: string | null;
}

interface MichaelInterviewLite {
  baId: string;
  completedAt: string | null;
  audioUrl: string | null;
}

interface SponsorOverrideRecord {
  _id?: string;
  overrideId: string;
  baId: string;
  previousSponsorBaId: string;
  newSponsorBaId: string;
  requestingBaId: string;
  reason: string;
  performedByBaId: string;
  performedAt: string;
  auditEntryId: string;
}

interface CuratedLeaderTagRecord {
  _id?: string;
  baId: string;
  curated: boolean;
  setByBaId: string;
  setAt: string;
}

interface BaNoteRecord {
  _id?: string;
  noteId: string;
  baId: string;
  text: string;
  authorBaId: string;
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

function maxIso(...values: Array<string | null | undefined>): IsoTimestamp | null {
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
  // The gateway has no cursor; we page by ascending _id. For now `filter`
  // is the same across pages; the BA roster is small enough that a single
  // bounded query (limit 2000) is fine, but the paged primitive is here so
  // the join collections can grow without changing the call sites.
  const all: T[] = [];
  let offset = 0;
  let lastBatchSize = pageSize;
  while (lastBatchSize === pageSize && offset < 50_000) {
    const res = await gatewayCall<{ documents: T[]; count?: number }>(
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
): Promise<{ rows: AdminBaDirectoryRow[]; leaderDetectionNote: string }> {
  // 1. Pull the BA roster (newest first, capped).
  const baRaw = await gatewayCall<{ documents: BARecordWithExtras[] }>(
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
  const baIds = bas.map((b) => b.baId);

  // 2. Resolve sponsor names (current + original). Build a baId -> name map
  // from the in-window roster, then batch-fetch any sponsors that fell
  // outside the window so the column is correct for the whole table.
  const nameByBaId = new Map<string, string>();
  for (const b of bas) {
    nameByBaId.set(b.baId, `${b.firstName} ${b.lastName}`.trim());
  }
  const missingSponsors = new Set<string>();
  for (const b of bas) {
    if (b.sponsorBaId && !nameByBaId.has(b.sponsorBaId)) {
      missingSponsors.add(b.sponsorBaId);
    }
    if (b.originalSponsorBaId && !nameByBaId.has(b.originalSponsorBaId)) {
      missingSponsors.add(b.originalSponsorBaId);
    }
  }
  if (missingSponsors.size > 0) {
    const r = await gatewayCall<{ documents: BARecord[] }>('mongodb', 'query', {
      database: MONGO_DB,
      collection: BA_COLLECTION,
      filter: { baId: { $in: Array.from(missingSponsors) } },
      limit: missingSponsors.size,
    });
    for (const s of r.documents ?? []) {
      nameByBaId.set(s.baId, `${s.firstName} ${s.lastName}`.trim());
    }
  }

  // 3. Owned access codes (one per BA — sponsorBaId is the owner).
  const codes = await fetchAllPaged<AccessCodeLite>(
    MONGO_DB,
    ACCESS_CODES_COLLECTION,
    { sponsorBaId: { $in: baIds }, active: true },
  );
  const codeByBaId = new Map<string, string>();
  for (const c of codes) {
    if (!codeByBaId.has(c.sponsorBaId)) codeByBaId.set(c.sponsorBaId, c.code);
  }

  // 4. Welcome commitments — most recent acceptedAt per BA.
  const commitments = await fetchAllPaged<CommitmentLite>(
    MONGO_DB,
    COMMITMENTS_COLLECTION,
    { baId: { $in: baIds } },
  );
  const welcomeByBaId = new Map<string, string>();
  for (const c of commitments) {
    const cur = welcomeByBaId.get(c.baId);
    if (!cur || c.acceptedAt > cur) welcomeByBaId.set(c.baId, c.acceptedAt);
  }

  // 5. Invite tokens — pull all for this batch, then compute lifetime count
  // + 2-in-72 client-side. (BA count × tokens-per-BA is small at v1 scale;
  // when it isn't, the gateway grows aggregation and this becomes a $match
  // + $group.)
  const tokens = await fetchAllPaged<TokenLite>(
    MONGO_DB,
    TOKENS_COLLECTION,
    { sponsorBaId: { $in: baIds } },
  );
  const lifetimeByBaId = new Map<string, number>();
  const twoIn72ByBaId = new Map<string, number>();
  const windowStart = new Date(Date.now() - TWO_IN_SEVENTY_TWO_WINDOW_MS).toISOString();
  for (const t of tokens) {
    lifetimeByBaId.set(t.sponsorBaId, (lifetimeByBaId.get(t.sponsorBaId) ?? 0) + 1);
    if (t.createdAt >= windowStart) {
      twoIn72ByBaId.set(t.sponsorBaId, (twoIn72ByBaId.get(t.sponsorBaId) ?? 0) + 1);
    }
  }

  // 6. CRM follow-ups — oldest open dueAt per BA.
  const followups = await fetchAllPaged<FollowUpLite>(
    MONGO_DB,
    FOLLOWUPS_COLLECTION,
    { sponsorBaId: { $in: baIds }, clearedAt: null },
  );
  const oldestFollowupByBaId = new Map<string, string>();
  for (const f of followups) {
    const cur = oldestFollowupByBaId.get(f.sponsorBaId);
    if (!cur || f.dueAt < cur) oldestFollowupByBaId.set(f.sponsorBaId, f.dueAt);
  }

  // 7. Fast Start — count modules in `completed` per BA.
  const fastStart = await fetchAllPaged<FastStartLite>(
    MONGO_DB,
    FAST_START_COLLECTION,
    { baId: { $in: baIds } },
  );
  const completedModulesByBaId = new Map<string, number>();
  for (const m of fastStart) {
    if (m.state === 'completed') {
      completedModulesByBaId.set(m.baId, (completedModulesByBaId.get(m.baId) ?? 0) + 1);
    }
  }

  // 8. Michael schedules.
  const michaels = await fetchAllPaged<MichaelScheduleLite>(
    MONGO_DB,
    MICHAEL_SCHEDULES_COLLECTION,
    { baId: { $in: baIds } },
  );
  const michaelByBaId = new Map<string, MichaelScheduleLite>();
  for (const m of michaels) {
    const cur = michaelByBaId.get(m.baId);
    // Prefer the most progressed status row when there are multiple.
    if (!cur) michaelByBaId.set(m.baId, m);
    else {
      const order: Record<MichaelScheduleLite['status'], number> = {
        awaiting_schedule: 0,
        missed: 1,
        scheduled: 2,
        in_progress: 3,
        completed: 4,
      };
      if (order[m.status] > order[cur.status]) michaelByBaId.set(m.baId, m);
    }
  }

  // 9. Curated leader tags.
  const tags = await fetchAllPaged<CuratedLeaderTagRecord>(
    MONGO_DB,
    CURATED_LEADER_TAGS_COLLECTION,
    { baId: { $in: baIds } },
  );
  const curatedByBaId = new Map<string, boolean>();
  for (const t of tags) curatedByBaId.set(t.baId, t.curated);

  // 10. Assemble rows.
  const rows: AdminBaDirectoryRow[] = bas.map((ba) => {
    const completedMods = completedModulesByBaId.get(ba.baId) ?? 0;
    const michael = michaelByBaId.get(ba.baId);
    const welcomeAt = welcomeByBaId.get(ba.baId) ?? null;
    const originalSponsorBaId =
      ba.originalSponsorBaId && ba.originalSponsorBaId !== ba.sponsorBaId
        ? ba.originalSponsorBaId
        : null;
    const lastActivityAt = maxIso(
      ba.lastLoginAt,
      welcomeAt,
      michael?.completedAt ?? null,
    );
    return {
      baId: ba.baId,
      threeBaId: ba.threeBaId,
      fullName: `${ba.firstName} ${ba.lastName}`.trim(),
      email: ba.email ?? null,
      phone: ba.phone ?? null,
      accessCodeOwned: codeByBaId.get(ba.baId) ?? null,
      sponsorBaId: ba.sponsorBaId ?? null,
      sponsorName: ba.sponsorBaId ? nameByBaId.get(ba.sponsorBaId) ?? null : null,
      originalSponsorBaId,
      originalSponsorName: originalSponsorBaId
        ? nameByBaId.get(originalSponsorBaId) ?? null
        : null,
      joinedAt: ba.createdAt,
      welcomeAcceptedAt: welcomeAt,
      lastLoginAt: ba.lastLoginAt ?? null,
      twoInSeventyTwoCount: twoIn72ByBaId.get(ba.baId) ?? 0,
      twoInSeventyTwoWindowStart: windowStart,
      profileCompletenessPct: profileCompletenessPct(ba),
      personalInvitesCount: lifetimeByBaId.get(ba.baId) ?? 0,
      oldestOpenFollowUpDueAt: oldestFollowupByBaId.get(ba.baId) ?? null,
      trainingModulesCompleted: completedMods,
      trainingComplete: completedMods >= 5,
      michaelStatus: michael?.status ?? null,
      status: deriveStatus(ba),
      lastActivityAt,
      systemDetectedLeader: false,
      curatedLeader: curatedByBaId.get(ba.baId) ?? false,
      deleted: (ba as unknown as Record<string, unknown>).deleted === true,
    };
  });

  return { rows, leaderDetectionNote: LEADER_DETECTION_NOTE };
}

/** Build the C.4 profile bundle for one BA. */
export async function getBAProfileBundle(
  baId: string,
): Promise<AdminBaProfileBundle | null> {
  // Reuse listBADirectory's projection so the table row + drawer row are
  // identical (the directory limit is enough for typical use; if the
  // target BA is outside the window, fall through to a focused build).
  const { rows } = await listBADirectory(2000);
  let row = rows.find((r) => r.baId === baId) ?? null;
  if (!row) {
    // Focused build — the requested BA wasn't in the recent batch.
    const single = await listBADirectory(1).then((r) =>
      r.rows.find((x) => x.baId === baId) ?? null,
    );
    if (single) row = single;
    else {
      const ba = await findBAByBaId(baId);
      if (!ba) return null;
      // Final fallback — synthesize a sparse row so the drawer renders SOMETHING.
      row = {
        baId: ba.baId,
        threeBaId: ba.threeBaId,
        fullName: `${ba.firstName} ${ba.lastName}`.trim(),
        email: ba.email ?? null,
        phone: ba.phone ?? null,
        accessCodeOwned: null,
        sponsorBaId: ba.sponsorBaId ?? null,
        sponsorName: null,
        originalSponsorBaId: null,
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
        michaelStatus: null,
        status: 'inactive',
        lastActivityAt: ba.lastLoginAt ?? null,
        systemDetectedLeader: false,
        curatedLeader: false,
        deleted: (ba as unknown as Record<string, unknown>).deleted === true,
      };
    }
  }

  const [interview, history, notes] = await Promise.all([
    fetchMichaelInterviewLink(baId),
    fetchOverrideHistory(baId),
    fetchBaNotes(baId),
  ]);

  return {
    row,
    michaelTranscript: interview,
    sponsorOverrideHistory: history,
    notes,
  };
}

async function fetchMichaelInterviewLink(
  baId: string,
): Promise<AdminBaProfileBundle['michaelTranscript']> {
  const r = await gatewayCall<{ documents: MichaelInterviewLite[] }>(
    'mongodb',
    'query',
    {
      database: MONGO_DB,
      collection: MICHAEL_INTERVIEWS_COLLECTION,
      filter: { baId },
      limit: 1,
    },
  );
  const doc = r.documents?.[0];
  if (!doc) return null;
  return {
    interviewId: baId,
    completedAt: doc.completedAt ?? null,
    audioUrl: doc.audioUrl ?? null,
  };
}

async function fetchOverrideHistory(
  baId: string,
): Promise<AdminSponsorOverrideEntry[]> {
  const r = await gatewayCall<{ documents: SponsorOverrideRecord[] }>(
    'mongodb',
    'query',
    {
      database: MONGO_DB,
      collection: OVERRIDES_COLLECTION,
      filter: { baId },
      sort: { performedAt: -1 },
      limit: 50,
    },
  );
  return (r.documents ?? []).map((o) => ({
    overrideId: o.overrideId,
    baId: o.baId,
    previousSponsorBaId: o.previousSponsorBaId,
    newSponsorBaId: o.newSponsorBaId,
    requestingBaId: o.requestingBaId,
    reason: o.reason,
    performedByBaId: o.performedByBaId,
    performedAt: o.performedAt,
    auditEntryId: o.auditEntryId,
  }));
}

async function fetchBaNotes(baId: string): Promise<AdminBaNoteEntry[]> {
  const r = await gatewayCall<{ documents: BaNoteRecord[] }>('mongodb', 'query', {
    database: MONGO_DB,
    collection: BA_NOTES_COLLECTION,
    filter: { baId },
    sort: { createdAt: -1 },
    limit: 100,
  });
  return (r.documents ?? []).map((n) => ({
    noteId: n.noteId,
    baId: n.baId,
    text: n.text,
    authorBaId: n.authorBaId,
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
  baId: string;
  requestingBaId: string;
  newSponsorBaId: string;
  reason: string;
  performedByBaId: string;
  performedByDisplayName: string;
}): Promise<{ ok: true; entry: AdminSponsorOverrideEntry } | { ok: false; error: SponsorOverrideError }> {
  const ba = (await findBAByBaId(args.baId)) as BARecordWithExtras | null;
  if (!ba) return { ok: false, error: { kind: 'ba_not_found' } };

  if (args.newSponsorBaId === args.baId) {
    return { ok: false, error: { kind: 'self_sponsor' } };
  }

  const [newSponsor, requestingBa] = await Promise.all([
    findBAByBaId(args.newSponsorBaId),
    findBAByBaId(args.requestingBaId),
  ]);
  if (!newSponsor) return { ok: false, error: { kind: 'new_sponsor_not_found' } };
  if (!requestingBa) return { ok: false, error: { kind: 'requesting_ba_not_found' } };

  const previousSponsorBaId = ba.sponsorBaId ?? '';
  if (previousSponsorBaId === args.newSponsorBaId) {
    return {
      ok: false,
      error: { kind: 'no_op', reason: 'new sponsor matches current sponsor' },
    };
  }

  // Preserve the original sponsor on the BA record if this is the first
  // override (sponsor immutability per locked-spec 3.5 says the BA's
  // ORIGINAL sponsor is what's immutable — the override changes the
  // mirror's current sponsor, but the original survives as history).
  const originalSponsorBaId = ba.originalSponsorBaId ?? previousSponsorBaId;
  const originalSponsorThreeBaId =
    ba.originalSponsorThreeBaId ?? ba.sponsorThreeBaId ?? '';

  const performedAt = new Date().toISOString();
  const overrideId = mintOverrideId();

  // 1. Apply the patch to the BA record. originalSponsorBaId is stamped
  // only the first time so re-overrides don't drift the original away.
  await gatewayCall('mongodb', 'update', {
    database: MONGO_DB,
    collection: BA_COLLECTION,
    filter: { baId: args.baId },
    update: {
      $set: {
        sponsorBaId: args.newSponsorBaId,
        sponsorThreeBaId: newSponsor.threeBaId,
        originalSponsorBaId,
        originalSponsorThreeBaId,
      },
    },
  });

  // 2. Append the audit entry FIRST so we have its entryId to stamp on the
  // override record (closes the substrate <-> record link).
  const audit = await appendAuditEntry({
    actor: {
      kind: 'admin',
      baId: args.performedByBaId,
      displayName: args.performedByDisplayName,
    },
    action: 'admin.sponsor.override',
    entity: {
      kind: 'brand_ambassador',
      id: args.baId,
      displayLabel: `${ba.firstName} ${ba.lastName}`.trim(),
    },
    severity: 'critical',
    before: {
      sponsorBaId: previousSponsorBaId,
      sponsorThreeBaId: ba.sponsorThreeBaId ?? null,
      originalSponsorBaId: ba.originalSponsorBaId ?? null,
    },
    after: {
      sponsorBaId: args.newSponsorBaId,
      sponsorThreeBaId: newSponsor.threeBaId,
      originalSponsorBaId,
    },
    reason: args.reason,
    context: {
      ip: null,
      userAgent: null,
      route: `/api/admin/bas/${args.baId}/sponsor-override`,
      method: 'POST',
      requestId: null,
    },
  });

  // 3. Write the override record (triple-stacked — Neo4j stamps a SUPERSEDED
  // edge so genealogy traversals can see the original sponsor too).
  const record: SponsorOverrideRecord = {
    overrideId,
    baId: args.baId,
    previousSponsorBaId,
    newSponsorBaId: args.newSponsorBaId,
    requestingBaId: args.requestingBaId,
    reason: args.reason,
    performedByBaId: args.performedByBaId,
    performedAt,
    auditEntryId: audit.entryId,
  };

  await tripleStackWrite({
    id: overrideId,
    mongoCollection: OVERRIDES_COLLECTION,
    mongoDoc: { ...record },
    neo4j: {
      cypher: `
        MERGE (n:BA {baId: $baId})
        MERGE (newS:BA {baId: $newSponsorBaId})
        MERGE (prevS:BA {baId: $previousSponsorBaId})
        MERGE (o:SponsorOverride {overrideId: $id})
        SET o.performedAt = datetime($performedAt),
            o.reason = $reason,
            o.auditEntryId = $auditEntryId
        MERGE (n)-[:SPONSORED_BY {current: true}]->(newS)
        MERGE (n)-[:HAS_ORIGINAL_SPONSOR]->(prevS)
        MERGE (n)-[:HAS_OVERRIDE]->(o)
      `,
      params: {
        baId: args.baId,
        newSponsorBaId: args.newSponsorBaId,
        previousSponsorBaId,
        performedAt,
        reason: args.reason,
        auditEntryId: audit.entryId,
      },
    },
    chroma: {
      collection: 'audit_log',
      document: `sponsor override baId=${args.baId} previous=${previousSponsorBaId} new=${args.newSponsorBaId} requestedBy=${args.requestingBaId} reason="${args.reason}"`,
      metadata: {
        action: 'admin.sponsor.override',
        entityKind: 'brand_ambassador',
        entityId: args.baId,
        performedAt,
      },
    },
  });

  const entry: AdminSponsorOverrideEntry = {
    overrideId,
    baId: args.baId,
    previousSponsorBaId,
    newSponsorBaId: args.newSponsorBaId,
    requestingBaId: args.requestingBaId,
    reason: args.reason,
    performedByBaId: args.performedByBaId,
    performedAt,
    auditEntryId: audit.entryId,
  };
  return { ok: true, entry };
}

/** Toggle the Kevin-curated leader badge for one BA. */
export async function setCuratedLeaderTag(args: {
  baId: string;
  curated: boolean;
  setByBaId: string;
  setByDisplayName: string;
  reason?: string;
}): Promise<void> {
  const setAt = new Date().toISOString();

  // Gateway doesn't honor upsert — branch on existence ourselves.
  const existing = await gatewayCall<{ documents: CuratedLeaderTagRecord[] }>(
    'mongodb',
    'query',
    {
      database: MONGO_DB,
      collection: CURATED_LEADER_TAGS_COLLECTION,
      filter: { baId: args.baId },
      limit: 1,
    },
  );
  const prior = existing.documents?.[0]?.curated ?? false;

  if (existing.documents && existing.documents.length > 0) {
    await gatewayCall('mongodb', 'update', {
      database: MONGO_DB,
      collection: CURATED_LEADER_TAGS_COLLECTION,
      filter: { baId: args.baId },
      update: { $set: { curated: args.curated, setByBaId: args.setByBaId, setAt } },
    });
  } else {
    await gatewayCall('mongodb', 'insert', {
      database: MONGO_DB,
      collection: CURATED_LEADER_TAGS_COLLECTION,
      documents: [
        {
          _id: `curated_${args.baId}`,
          baId: args.baId,
          curated: args.curated,
          setByBaId: args.setByBaId,
          setAt,
        },
      ],
    });
  }

  await appendAuditEntry({
    actor: { kind: 'admin', baId: args.setByBaId, displayName: args.setByDisplayName },
    action: args.curated ? 'admin.leader.curated_set' : 'admin.leader.curated_clear',
    entity: { kind: 'brand_ambassador', id: args.baId, displayLabel: null },
    severity: 'info',
    before: { curated: prior },
    after: { curated: args.curated },
    reason: args.reason ?? null,
  });
}

/** Append a Kevin-only note about a BA. Append-only. */
export async function appendBaNote(args: {
  baId: string;
  text: string;
  authorBaId: string;
  authorDisplayName: string;
}): Promise<AdminBaNoteEntry> {
  const noteId = mintNoteId();
  const createdAt = new Date().toISOString();
  const record: BaNoteRecord = {
    noteId,
    baId: args.baId,
    text: args.text,
    authorBaId: args.authorBaId,
    createdAt,
  };

  await gatewayCall('mongodb', 'insert', {
    database: MONGO_DB,
    collection: BA_NOTES_COLLECTION,
    documents: [{ _id: noteId, ...record }],
  });

  await appendAuditEntry({
    actor: {
      kind: 'admin',
      baId: args.authorBaId,
      displayName: args.authorDisplayName,
    },
    action: 'admin.ba.note_added',
    entity: { kind: 'brand_ambassador', id: args.baId, displayLabel: null },
    severity: 'info',
    before: null,
    after: { noteId, length: args.text.length },
  });

  return {
    noteId,
    baId: args.baId,
    text: args.text,
    authorBaId: args.authorBaId,
    createdAt,
  };
}
