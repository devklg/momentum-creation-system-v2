/**
 * BA CRM write-side domain (Chat #132 — wireframe 3.3 CRM leaves).
 *
 * The WRITE companion to domain/cockpit.ts. The cockpit READS what the BA's
 * pipeline looks like; this module lets the BA ACT on it — notes, follow-up
 * reminders, dispositions, re-invite — plus derives the Today's Actions
 * card from the existing pipeline (no new prospect state needed for it).
 *
 * Collections:
 *   crm_notes              one doc per note, append-only
 *   crm_followups          one ACTIVE row per (prospectId, sponsorBaId);
 *                          replaced on set, clearedAt-stamped on clear
 *   crm_dispositions       one row per (prospectId, sponsorBaId), latest wins
 *
 * Sponsor immutability (locked-spec 3.5): every function takes sponsorBaId
 * from the route's session and assertOwnership() runs against the prospect
 * before any mutation. A BA cannot read or write another BA's prospect's
 * CRM, ever.
 *
 * Re-invite (Kevin lock, Chat #132): 7-day cooldown counted from the
 * prospect's latest sentAt. If the existing token has expired, the spine
 * also mints a fresh one and points the prospect doc at it (state reset to
 * 'minted'). If the prospect was never marked sent, the BA must use the
 * existing "I sent this" path instead — there's nothing to re-send yet.
 *
 * Gateway quirks (per tripleStack.ts header):
 *   - mongodb.query filter param is `filter`, returns {count, documents}
 *   - mongodb.update has no working upsert — branch on existence
 *   - mongodb.insert wants `documents:` array
 *   - chromadb collections must already exist; we reuse `mcs_invitations`
 *     (bootstrapped Chat #119) and discriminate by metadata.kind
 */

import { randomUUID } from 'node:crypto';
import { gatewayCall } from '../services/gateway.js';
import { tripleStackWrite } from '../services/tripleStack.js';
import { mintUniqueToken, TOKEN_TTL_MS } from './tokens.js';
import type {
  CallbackIntent,
  CrmDisposition,
  CrmDispositionRecord,
  CrmFollowUpRecord,
  CrmNoteRecord,
  ProspectCrmBundle,
  ReinviteResponse,
  TodayActionItem,
} from '@momentum/shared';

const MONGO_DB = 'momentum';
const PROSPECTS_COLLECTION = 'prospects';
const TOKENS_COLLECTION = 'invite_tokens';
const ACTIVITY_COLLECTION = 'invitation_activity';
const CALLBACK_COLLECTION = 'callback_requests';
const NOTES_COLLECTION = 'crm_notes';
const FOLLOWUPS_COLLECTION = 'crm_followups';
const DISPOSITIONS_COLLECTION = 'crm_dispositions';
const CHROMA_COLLECTION = 'mcs_invitations';

/** 7 days, per Kevin lock (Chat #132). */
export const REINVITE_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;

/** Max note length — generous for a free-form journal entry. */
const NOTE_MAX = 2000;

/** All five disposition tags Kevin locked. Server-side validation list. */
const VALID_DISPOSITIONS: ReadonlySet<CrmDisposition> = new Set([
  'new-ba',
  'new-customer',
  'interested',
  'not-interested',
  'later',
]);

export class CrmError extends Error {
  constructor(public readonly code: string) {
    super(code);
    this.name = 'CrmError';
  }
}

// ── Internal: prospect lookup + sponsor guard ─────────────────────────────

interface ProspectGuardDoc {
  prospectId: string;
  sponsorBaId: string;
  state: string;
  token?: string;
  sentAt?: string | null;
  expiresAt?: string;
  firstName?: string;
  lastInitial?: string;
}

async function fetchProspect(prospectId: string): Promise<ProspectGuardDoc | null> {
  const res = await gatewayCall<{ documents: ProspectGuardDoc[] }>(
    'mongodb',
    'query',
    {
      database: MONGO_DB,
      collection: PROSPECTS_COLLECTION,
      filter: { prospectId },
      limit: 1,
    },
  );
  return res.documents[0] ?? null;
}

/**
 * Assert the prospect exists AND belongs to the calling BA. Throws
 * CrmError('prospect_not_found') or CrmError('sponsor_mismatch'); the route
 * layer maps both to the right HTTP status without leaking the distinction
 * to other BAs.
 */
async function assertOwnership(
  prospectId: string,
  sponsorBaId: string,
): Promise<ProspectGuardDoc> {
  const doc = await fetchProspect(prospectId);
  if (!doc) throw new CrmError('prospect_not_found');
  if (doc.sponsorBaId !== sponsorBaId) throw new CrmError('sponsor_mismatch');
  return doc;
}

// ── Notes ─────────────────────────────────────────────────────────────────

export async function addNote(
  prospectId: string,
  sponsorBaId: string,
  text: string,
): Promise<CrmNoteRecord> {
  const trimmed = text.trim();
  if (!trimmed) throw new CrmError('empty_note');
  if (trimmed.length > NOTE_MAX) throw new CrmError('note_too_long');

  await assertOwnership(prospectId, sponsorBaId);

  const noteId = `crmnote_${randomUUID()}`;
  const createdAt = new Date().toISOString();
  const record: CrmNoteRecord = {
    noteId,
    prospectId,
    sponsorBaId,
    text: trimmed,
    createdAt,
  };

  await tripleStackWrite({
    id: noteId,
    mongoCollection: NOTES_COLLECTION,
    mongoDoc: { ...record },
    neo4j: {
      // BA WROTE_NOTE Note ABOUT Prospect — graph reflects ownership.
      cypher:
        'MERGE (b:BA {baId: $sponsorBaId}) ' +
        'MERGE (p:Prospect {prospectId: $prospectId}) ' +
        'CREATE (n:CrmNote {noteId: $id, text: $text, at: $createdAt, sponsorBaId: $sponsorBaId}) ' +
        'CREATE (b)-[:WROTE_NOTE]->(n) ' +
        'CREATE (n)-[:ABOUT]->(p)',
      params: { sponsorBaId, prospectId, text: trimmed, createdAt },
    },
    chroma: {
      collection: CHROMA_COLLECTION,
      document: `crm note (BA ${sponsorBaId} about prospect ${prospectId}): ${trimmed}`,
      metadata: {
        kind: 'crm_note',
        prospectId,
        sponsorBaId,
        at: createdAt,
      },
    },
  });

  return record;
}

export async function listNotes(
  prospectId: string,
  sponsorBaId: string,
): Promise<CrmNoteRecord[]> {
  const res = await gatewayCall<{ documents: CrmNoteRecord[] }>(
    'mongodb',
    'query',
    {
      database: MONGO_DB,
      collection: NOTES_COLLECTION,
      filter: { prospectId, sponsorBaId },
      sort: { createdAt: -1 },
      limit: 200,
    },
  );
  return res.documents ?? [];
}

// ── Follow-ups ────────────────────────────────────────────────────────────

/**
 * Set or replace the active follow-up for a prospect. The cockpit allows
 * only one active reminder at a time — calling set again replaces the
 * existing record's dueAt (createdAt is preserved as the original ask).
 */
export async function setFollowUp(
  prospectId: string,
  sponsorBaId: string,
  dueAt: string,
): Promise<CrmFollowUpRecord> {
  // Validate: ISO timestamp, in the future.
  const dueMs = new Date(dueAt).getTime();
  if (Number.isNaN(dueMs)) throw new CrmError('invalid_due_at');
  if (dueMs <= Date.now()) throw new CrmError('due_at_in_past');

  await assertOwnership(prospectId, sponsorBaId);

  const existing = await getActiveFollowUp(prospectId, sponsorBaId);
  const dueAtIso = new Date(dueMs).toISOString();
  const now = new Date().toISOString();

  if (existing) {
    // Replace in place — keep createdAt as the original ask.
    await gatewayCall('mongodb', 'update', {
      database: MONGO_DB,
      collection: FOLLOWUPS_COLLECTION,
      filter: { prospectId, sponsorBaId, clearedAt: null },
      update: { $set: { dueAt: dueAtIso, updatedAt: now } },
    });
    await gatewayCall('neo4j', 'cypher', {
      query:
        'MATCH (b:BA {baId: $sponsorBaId})-[r:HAS_FOLLOWUP]->(p:Prospect {prospectId: $prospectId}) ' +
        'SET r.dueAt = $dueAt, r.updatedAt = $now',
      params: { sponsorBaId, prospectId, dueAt: dueAtIso, now },
    });
    return {
      prospectId,
      sponsorBaId,
      dueAt: dueAtIso,
      createdAt: existing.createdAt,
      clearedAt: null,
    };
  }

  // Insert new active follow-up. Use compound id so a second insert with
  // clearedAt set later can co-exist (cleared rows live alongside the active).
  const followUpId = `crmfup_${randomUUID()}`;
  const record: CrmFollowUpRecord = {
    prospectId,
    sponsorBaId,
    dueAt: dueAtIso,
    createdAt: now,
    clearedAt: null,
  };

  await tripleStackWrite({
    id: followUpId,
    mongoCollection: FOLLOWUPS_COLLECTION,
    mongoDoc: { followUpId, ...record },
    neo4j: {
      cypher:
        'MERGE (b:BA {baId: $sponsorBaId}) ' +
        'MERGE (p:Prospect {prospectId: $prospectId}) ' +
        'MERGE (b)-[r:HAS_FOLLOWUP]->(p) ' +
        'SET r.dueAt = $dueAt, r.createdAt = $createdAt, r.followUpId = $id',
      params: { sponsorBaId, prospectId, dueAt: dueAtIso, createdAt: now },
    },
    chroma: {
      collection: CHROMA_COLLECTION,
      document: `crm follow-up set (BA ${sponsorBaId} -> prospect ${prospectId}) due ${dueAtIso}`,
      metadata: {
        kind: 'crm_followup_set',
        prospectId,
        sponsorBaId,
        dueAt: dueAtIso,
        at: now,
      },
    },
  });

  return record;
}

export async function getActiveFollowUp(
  prospectId: string,
  sponsorBaId: string,
): Promise<CrmFollowUpRecord | null> {
  const res = await gatewayCall<{ documents: CrmFollowUpRecord[] }>(
    'mongodb',
    'query',
    {
      database: MONGO_DB,
      collection: FOLLOWUPS_COLLECTION,
      filter: { prospectId, sponsorBaId, clearedAt: null },
      limit: 1,
    },
  );
  return res.documents[0] ?? null;
}

export async function clearFollowUp(
  prospectId: string,
  sponsorBaId: string,
): Promise<void> {
  await assertOwnership(prospectId, sponsorBaId);

  const existing = await getActiveFollowUp(prospectId, sponsorBaId);
  if (!existing) return; // idempotent

  const clearedAt = new Date().toISOString();
  await gatewayCall('mongodb', 'update', {
    database: MONGO_DB,
    collection: FOLLOWUPS_COLLECTION,
    filter: { prospectId, sponsorBaId, clearedAt: null },
    update: { $set: { clearedAt } },
  });
  await gatewayCall('neo4j', 'cypher', {
    query:
      'MATCH (b:BA {baId: $sponsorBaId})-[r:HAS_FOLLOWUP]->(p:Prospect {prospectId: $prospectId}) ' +
      'DELETE r',
    params: { sponsorBaId, prospectId },
  });
}

// ── Dispositions ──────────────────────────────────────────────────────────

export async function setDisposition(
  prospectId: string,
  sponsorBaId: string,
  disposition: CrmDisposition | null,
): Promise<CrmDisposition | null> {
  if (disposition !== null && !VALID_DISPOSITIONS.has(disposition)) {
    throw new CrmError('invalid_disposition');
  }

  await assertOwnership(prospectId, sponsorBaId);

  const existing = await getDisposition(prospectId, sponsorBaId);
  const now = new Date().toISOString();

  // Clear path
  if (disposition === null) {
    if (!existing) return null;
    await gatewayCall('mongodb', 'update', {
      database: MONGO_DB,
      collection: DISPOSITIONS_COLLECTION,
      filter: { prospectId, sponsorBaId },
      update: { $set: { disposition: null, updatedAt: now } },
    });
    await gatewayCall('neo4j', 'cypher', {
      query:
        'MATCH (b:BA {baId: $sponsorBaId})-[r:DISPOSED]->(p:Prospect {prospectId: $prospectId}) ' +
        'DELETE r',
      params: { sponsorBaId, prospectId },
    });
    return null;
  }

  // Set path
  if (existing) {
    await gatewayCall('mongodb', 'update', {
      database: MONGO_DB,
      collection: DISPOSITIONS_COLLECTION,
      filter: { prospectId, sponsorBaId },
      update: { $set: { disposition, updatedAt: now } },
    });
    await gatewayCall('neo4j', 'cypher', {
      query:
        'MERGE (b:BA {baId: $sponsorBaId}) ' +
        'MERGE (p:Prospect {prospectId: $prospectId}) ' +
        'MERGE (b)-[r:DISPOSED]->(p) ' +
        'SET r.disposition = $disposition, r.updatedAt = $now',
      params: { sponsorBaId, prospectId, disposition, now },
    });
    return disposition;
  }

  const dispoId = `crmdispo_${prospectId}_${sponsorBaId}`;
  const record: CrmDispositionRecord = {
    prospectId,
    sponsorBaId,
    disposition,
    updatedAt: now,
  };
  await tripleStackWrite({
    id: dispoId,
    mongoCollection: DISPOSITIONS_COLLECTION,
    mongoDoc: { ...record },
    neo4j: {
      cypher:
        'MERGE (b:BA {baId: $sponsorBaId}) ' +
        'MERGE (p:Prospect {prospectId: $prospectId}) ' +
        'MERGE (b)-[r:DISPOSED]->(p) ' +
        'SET r.disposition = $disposition, r.updatedAt = $now',
      params: { sponsorBaId, prospectId, disposition, now },
    },
    chroma: {
      collection: CHROMA_COLLECTION,
      document: `crm disposition '${disposition}' (BA ${sponsorBaId} -> prospect ${prospectId})`,
      metadata: {
        kind: 'crm_disposition_set',
        prospectId,
        sponsorBaId,
        disposition,
        at: now,
      },
    },
  });
  return disposition;
}

export async function getDisposition(
  prospectId: string,
  sponsorBaId: string,
): Promise<CrmDisposition | null> {
  const res = await gatewayCall<{ documents: Array<{ disposition: CrmDisposition | null }> }>(
    'mongodb',
    'query',
    {
      database: MONGO_DB,
      collection: DISPOSITIONS_COLLECTION,
      filter: { prospectId, sponsorBaId },
      limit: 1,
    },
  );
  const doc = res.documents[0];
  if (!doc) return null;
  return doc.disposition ?? null;
}

// ── Per-prospect bundle (cockpit row expansion) ───────────────────────────

/**
 * Everything the cockpit needs when a BA expands an invite row's CRM panel.
 * One round trip; sponsor-scoped reads only.
 */
export async function getCrmBundle(
  prospectId: string,
  sponsorBaId: string,
): Promise<ProspectCrmBundle> {
  const prospect = await assertOwnership(prospectId, sponsorBaId);

  const [notes, followUp, disposition] = await Promise.all([
    listNotes(prospectId, sponsorBaId),
    getActiveFollowUp(prospectId, sponsorBaId),
    getDisposition(prospectId, sponsorBaId),
  ]);

  return {
    prospectId,
    notes,
    followUp,
    disposition,
    reinviteAvailableAt: computeReinviteAvailableAt(prospect),
  };
}

/**
 * Null when re-invite is allowed right now. ISO timestamp when the BA must
 * wait until. Returns null for unsent drafts (no cooldown applies — the BA
 * uses "I sent this" not re-invite for those) so the UI can render a
 * different affordance instead of a misleading countdown.
 */
function computeReinviteAvailableAt(prospect: ProspectGuardDoc): string | null {
  if (!prospect.sentAt) return null;
  const next = new Date(prospect.sentAt).getTime() + REINVITE_COOLDOWN_MS;
  if (next <= Date.now()) return null;
  return new Date(next).toISOString();
}

// ── Re-invite ─────────────────────────────────────────────────────────────

/**
 * Re-invite a prospect: bump sentAt, append an activity entry, and — if the
 * existing token has expired — mint a fresh token and point the prospect
 * at it (state reset to 'minted', expiresAt extended).
 *
 * Forbidden states:
 *   - prospect.sentAt null → CrmError('not_yet_sent'): use "I sent this".
 *   - prospect.state 'enrolled' → CrmError('enrolled'): terminal.
 *   - within 7-day cooldown → CrmError('cooldown'): UI shows countdown.
 *
 * The cooldown is checked here as well as surfaced via `reinviteAvailableAt`
 * on the bundle. Two paths can race; the server is authoritative.
 */
export async function reinvite(
  prospectId: string,
  sponsorBaId: string,
): Promise<ReinviteResponse> {
  const prospect = await assertOwnership(prospectId, sponsorBaId);

  if (prospect.state === 'enrolled') {
    throw new CrmError('enrolled');
  }
  if (!prospect.sentAt) {
    throw new CrmError('not_yet_sent');
  }

  // 7-day cooldown gate (server-authoritative).
  const sentMs = new Date(prospect.sentAt).getTime();
  if (Date.now() - sentMs < REINVITE_COOLDOWN_MS) {
    throw new CrmError('cooldown');
  }

  const now = new Date().toISOString();

  // Decide whether the existing token is still usable. If expired, mint
  // a fresh one and reset the prospect's funnel back to 'minted' with a
  // new 8-week window. If usable, leave the token alone — same link, the
  // BA just sends it again.
  let token = prospect.token ?? '';
  let expiresAt = prospect.expiresAt ?? '';
  let fresh = false;
  const expiredAt = prospect.expiresAt ? new Date(prospect.expiresAt).getTime() : 0;
  const tokenExpired =
    prospect.state === 'expired' ||
    (expiredAt > 0 && expiredAt <= Date.now());

  if (tokenExpired || !token) {
    fresh = true;
    token = await mintUniqueToken();
    const newExpiresAt = new Date(Date.now() + TOKEN_TTL_MS).toISOString();
    expiresAt = newExpiresAt;

    // 1. Insert the fresh token record.
    await gatewayCall('mongodb', 'insert', {
      database: MONGO_DB,
      collection: TOKENS_COLLECTION,
      documents: [
        {
          _id: token,
          token,
          prospectId,
          sponsorBaId,
          state: 'minted',
          createdAt: now,
          clickedAt: null,
          expiresAt: newExpiresAt,
        },
      ],
    });
    await gatewayCall('neo4j', 'cypher', {
      query:
        'MERGE (t:InviteToken {token: $token}) ' +
        'SET t.prospectId = $prospectId, ' +
        '    t.sponsorBaId = $sponsorBaId, ' +
        '    t.state = $state, ' +
        '    t.createdAt = $createdAt, ' +
        '    t.expiresAt = $expiresAt ' +
        'WITH t ' +
        'MATCH (p:Prospect {prospectId: $prospectId}) ' +
        'MERGE (t)-[:FOR_PROSPECT]->(p)',
      params: {
        token,
        prospectId,
        sponsorBaId,
        state: 'minted',
        createdAt: now,
        expiresAt: newExpiresAt,
      },
    });

    // 2. Repoint the prospect doc + reset funnel state.
    await gatewayCall('mongodb', 'update', {
      database: MONGO_DB,
      collection: PROSPECTS_COLLECTION,
      filter: { prospectId },
      update: {
        $set: {
          token,
          state: 'minted',
          expiresAt: newExpiresAt,
          sentAt: now,
          updatedAt: now,
        },
      },
    });
    await gatewayCall('neo4j', 'cypher', {
      query:
        'MATCH (p:Prospect {prospectId: $prospectId}) ' +
        'SET p.state = $state, p.updatedAt = $now',
      params: { prospectId, state: 'minted', now },
    });
  } else {
    // Same token, fresh sentAt only.
    await gatewayCall('mongodb', 'update', {
      database: MONGO_DB,
      collection: PROSPECTS_COLLECTION,
      filter: { prospectId },
      update: { $set: { sentAt: now, updatedAt: now } },
    });
  }

  // Activity entry — reuse the existing 'invitation_sent' kind with a
  // distinguishing note (locked-spec HARD RULE: don't widen the union).
  await appendActivity({
    prospectId,
    sponsorBaId,
    kind: 'invitation_sent',
    note: fresh
      ? 'BA re-invited (minted a fresh link; previous had expired).'
      : 'BA re-sent the invitation link.',
    at: now,
  });

  return {
    ok: true,
    prospectId,
    token,
    inviteUrl: `https://teammagnificent.com/p/${token}`,
    sentAt: now,
    expiresAt,
    fresh,
  };
}

/**
 * Append an entry to the invitation activity timeline. Mirrors the spine's
 * appendActivity in domain/invitations.ts — same collection, same shape, so
 * the cockpit read pipeline picks it up with no changes.
 */
async function appendActivity(entry: {
  prospectId: string;
  sponsorBaId: string;
  kind: 'invitation_sent';
  note: string;
  at: string;
}): Promise<void> {
  const activityId = `invact_${randomUUID()}`;
  await tripleStackWrite({
    id: activityId,
    mongoCollection: ACTIVITY_COLLECTION,
    mongoDoc: {
      activityId,
      prospectId: entry.prospectId,
      sponsorBaId: entry.sponsorBaId,
      kind: entry.kind,
      note: entry.note,
      at: entry.at,
    },
    neo4j: {
      cypher:
        'MATCH (p:Prospect {prospectId: $prospectId}) ' +
        'CREATE (a:InvitationActivity {' +
        '  activityId: $id, kind: $kind, note: $note, at: $at' +
        '}) ' +
        'CREATE (p)-[:HAS_ACTIVITY]->(a)',
      params: {
        prospectId: entry.prospectId,
        kind: entry.kind,
        note: entry.note,
        at: entry.at,
      },
    },
    chroma: {
      collection: CHROMA_COLLECTION,
      document: `${entry.kind}: ${entry.note} (prospect ${entry.prospectId}) at ${entry.at}`,
      metadata: {
        kind: entry.kind,
        prospectId: entry.prospectId,
        sponsorBaId: entry.sponsorBaId,
        at: entry.at,
      },
    },
  });
}

// ── Today's Actions (derived from the existing pipeline) ──────────────────

/**
 * Three sources, merged into one BA-action-priority list:
 *
 *   1. Callbacks raised in the last 14 days, newest-first. The cockpit reads
 *      callback_requests already; we re-derive the latest per prospect here
 *      so this card never disagrees with the rows below.
 *   2. Active follow-ups whose dueAt has elapsed (and not been cleared).
 *   3. Drafts the BA minted but never marked sent — surfaced as a nudge,
 *      since the BA's job is to share (locked-spec 1.9).
 *
 * Sorting: newest-first within each source, then concatenated with the
 * priority order callback > follow-up > draft (a raised hand outranks
 * a stale draft).
 *
 * Compliance (locked-spec 3.10): nothing here mentions earnings, position,
 * or rank. Action labels are operational ("asked for a callback", "draft
 * not sent"). Safe to render on the BA-facing cockpit.
 */
export async function getTodaysActions(
  sponsorBaId: string,
): Promise<TodayActionItem[]> {
  const fourteenDaysAgoIso = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
  const nowIso = new Date().toISOString();

  // Fan out three reads.
  const [callbacksRes, followUpsRes, prospectsRes] = await Promise.all([
    gatewayCall<{
      documents: Array<{
        prospectId: string;
        intent: CallbackIntent;
        createdAt: string;
      }>;
    }>('mongodb', 'query', {
      database: MONGO_DB,
      collection: CALLBACK_COLLECTION,
      filter: { sponsorBaId, createdAt: { $gte: fourteenDaysAgoIso } },
      sort: { createdAt: -1 },
      limit: 200,
    }),
    gatewayCall<{ documents: CrmFollowUpRecord[] }>('mongodb', 'query', {
      database: MONGO_DB,
      collection: FOLLOWUPS_COLLECTION,
      filter: { sponsorBaId, clearedAt: null, dueAt: { $lte: nowIso } },
      sort: { dueAt: -1 },
      limit: 200,
    }),
    gatewayCall<{
      documents: Array<{
        prospectId: string;
        firstName: string;
        lastInitial?: string;
        lastName?: string;
        state: string;
        sentAt?: string | null;
        createdAt: string;
      }>;
    }>('mongodb', 'query', {
      database: MONGO_DB,
      collection: PROSPECTS_COLLECTION,
      filter: { sponsorBaId },
      sort: { createdAt: -1 },
      limit: 1000,
    }),
  ]);

  // Build a prospectId → display info map (one source of truth for names).
  const prospectInfo = new Map<
    string,
    { firstName: string; lastInitial: string; state: string; sentAt: string | null; createdAt: string }
  >();
  for (const p of prospectsRes.documents ?? []) {
    prospectInfo.set(p.prospectId, {
      firstName: p.firstName,
      lastInitial:
        p.lastInitial ??
        (p.lastName ? p.lastName.trim().charAt(0).toUpperCase() : ''),
      state: p.state,
      sentAt: p.sentAt ?? null,
      createdAt: p.createdAt,
    });
  }

  // 1. Callbacks — one entry per prospect (most recent intent).
  const callbackItems: TodayActionItem[] = [];
  const seenCallback = new Set<string>();
  for (const cb of callbacksRes.documents ?? []) {
    if (seenCallback.has(cb.prospectId)) continue;
    seenCallback.add(cb.prospectId);
    const info = prospectInfo.get(cb.prospectId);
    if (!info) continue; // orphaned — skip
    callbackItems.push({
      kind: 'callback',
      prospectId: cb.prospectId,
      firstName: info.firstName,
      lastInitial: info.lastInitial,
      at: cb.createdAt,
      intent: cb.intent,
      followUpDueAt: null,
    });
  }

  // 2. Follow-ups that are due (dueAt <= now, not cleared).
  const followupItems: TodayActionItem[] = [];
  for (const f of followUpsRes.documents ?? []) {
    const info = prospectInfo.get(f.prospectId);
    if (!info) continue;
    followupItems.push({
      kind: 'followup',
      prospectId: f.prospectId,
      firstName: info.firstName,
      lastInitial: info.lastInitial,
      at: f.dueAt,
      intent: null,
      followUpDueAt: f.dueAt,
    });
  }

  // 3. Drafts (sentAt null AND state 'minted'). Anything beyond minted has
  // implicitly had the link sent already (the prospect engaged with it).
  const draftItems: TodayActionItem[] = [];
  for (const p of prospectsRes.documents ?? []) {
    if (p.sentAt) continue;
    if (p.state !== 'minted') continue;
    const info = prospectInfo.get(p.prospectId);
    if (!info) continue;
    draftItems.push({
      kind: 'draft',
      prospectId: p.prospectId,
      firstName: info.firstName,
      lastInitial: info.lastInitial,
      at: p.createdAt,
      intent: null,
      followUpDueAt: null,
    });
  }

  // Priority order: callbacks > follow-ups > drafts. Within each source,
  // sort newest-first by `at`.
  const byAtDesc = (a: TodayActionItem, b: TodayActionItem) =>
    a.at < b.at ? 1 : a.at > b.at ? -1 : 0;

  return [
    ...callbackItems.sort(byAtDesc),
    ...followupItems.sort(byAtDesc),
    ...draftItems.sort(byAtDesc),
  ];
}
