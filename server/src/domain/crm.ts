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
 *   crm_followups          one ACTIVE row per (prospectId, sponsorTmagId);
 *                          replaced on set, clearedAt-stamped on clear
 *   crm_dispositions       one row per (prospectId, sponsorTmagId), latest wins
 *
 * Sponsor immutability (locked-spec 3.5): every function takes sponsorTmagId
 * from the route's session and assertOwnership() runs against the prospect
 * before any mutation. A BA cannot read or write another BA's prospect's
 * CRM, ever.
 *
 * Re-invite (Chat #147 EDGE, seq 23, dec_cockpit_sponsor_and_reinvite):
 * NO enforced cooldown — the BA decides when to re-invite. (The 7-day
 * cooldown from Chat #132 was REMOVED here.) If the existing token has
 * expired, the spine mints a fresh one and points the prospect doc at it
 * (state reset to 'minted'). If the prospect was never marked sent, the BA
 * must use the existing "I sent this" path instead — there's nothing to
 * re-send yet. A re-invite SCRIPT button (reinviteScript) surfaces ready-to-
 * send copy; it never gates the re-invite.
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
import { findBAByTmagId } from './ba.js';
import {
  adminCreateProspect,
  adminEditProspect,
  adminSoftDeleteProspect,
  type CrudActor,
  type AdminProspectCrudError,
} from './adminProspectCrud.js';
import type {
  McsAdminProspectDirectoryRow,
  McsCallbackIntent,
  McsCrmDisposition,
  McsCrmDispositionRecord,
  McsCrmFollowUpRecord,
  McsCrmNoteRecord,
  McsProspectCrmBundle,
  McsReinviteResponse,
  McsReinviteScriptResponse,
  McsTodayActionItem,
} from '@momentum/shared';

const MONGO_DB = 'momentum';
const PROSPECTS_COLLECTION = 'tmag_prospects';
const TOKENS_COLLECTION = 'tmag_prospect_invite_tokens';
const ACTIVITY_COLLECTION = 'tmag_prospect_invitation_activity';
const CALLBACK_COLLECTION = 'tmag_prospect_callback_requests';
const NOTES_COLLECTION = 'tmag_prospect_crm_notes';
const FOLLOWUPS_COLLECTION = 'tmag_prospect_crm_followups';
const DISPOSITIONS_COLLECTION = 'tmag_prospect_crm_dispositions';
const CHROMA_COLLECTION = 'tmag_prospect_invitation_activity';

/** Max note length — generous for a free-form journal entry. */
const NOTE_MAX = 2000;

/** All five disposition tags Kevin locked. Server-side validation list. */
const VALID_DISPOSITIONS: ReadonlySet<McsCrmDisposition> = new Set([
  'new_brand_ambassador',
  'new_customer',
  'interested',
  'not_interested',
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
  sponsorTmagId: string;
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
  sponsorTmagId: string,
): Promise<ProspectGuardDoc> {
  const doc = await fetchProspect(prospectId);
  if (!doc) throw new CrmError('prospect_not_found');
  if (doc.sponsorTmagId !== sponsorTmagId) throw new CrmError('sponsor_mismatch');
  return doc;
}

// ── Notes ─────────────────────────────────────────────────────────────────

export async function addNote(
  prospectId: string,
  sponsorTmagId: string,
  text: string,
): Promise<McsCrmNoteRecord> {
  const trimmed = text.trim();
  if (!trimmed) throw new CrmError('empty_note');
  if (trimmed.length > NOTE_MAX) throw new CrmError('note_too_long');

  await assertOwnership(prospectId, sponsorTmagId);

  const noteId = `crmnote_${randomUUID()}`;
  const createdAt = new Date().toISOString();
  const record: McsCrmNoteRecord = {
    noteId,
    prospectId,
    sponsorTmagId,
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
        'MERGE (b:TeamMagnificentMember {tmagId: $sponsorTmagId}) ' +
        'MERGE (p:TmagProspect {prospectId: $prospectId}) ' +
        'CREATE (n:TmagCrmNote {noteId: $id, text: $text, at: $createdAt, sponsorTmagId: $sponsorTmagId}) ' +
        'CREATE (b)-[:WROTE_NOTE]->(n) ' +
        'CREATE (n)-[:ABOUT]->(p)',
      params: { sponsorTmagId, prospectId, text: trimmed, createdAt },
    },
    chroma: {
      collection: CHROMA_COLLECTION,
      document: `crm note (BA ${sponsorTmagId} about prospect ${prospectId}): ${trimmed}`,
      metadata: {
        kind: 'crm_note',
        prospectId,
        sponsorTmagId,
        at: createdAt,
      },
    },
  });

  return record;
}

export async function listNotes(
  prospectId: string,
  sponsorTmagId: string,
): Promise<McsCrmNoteRecord[]> {
  const res = await gatewayCall<{ documents: McsCrmNoteRecord[] }>(
    'mongodb',
    'query',
    {
      database: MONGO_DB,
      collection: NOTES_COLLECTION,
      filter: { prospectId, sponsorTmagId },
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
  sponsorTmagId: string,
  dueAt: string,
): Promise<McsCrmFollowUpRecord> {
  // Validate: ISO timestamp, in the future.
  const dueMs = new Date(dueAt).getTime();
  if (Number.isNaN(dueMs)) throw new CrmError('invalid_due_at');
  if (dueMs <= Date.now()) throw new CrmError('due_at_in_past');

  await assertOwnership(prospectId, sponsorTmagId);

  const existing = await getActiveFollowUp(prospectId, sponsorTmagId);
  const dueAtIso = new Date(dueMs).toISOString();
  const now = new Date().toISOString();

  if (existing) {
    // Replace in place — keep createdAt as the original ask.
    await gatewayCall('mongodb', 'update', {
      database: MONGO_DB,
      collection: FOLLOWUPS_COLLECTION,
      filter: { prospectId, sponsorTmagId, clearedAt: null },
      update: { $set: { dueAt: dueAtIso, updatedAt: now } },
    });
    await gatewayCall('neo4j', 'cypher', {
      query:
        'MATCH (b:TeamMagnificentMember {tmagId: $sponsorTmagId})-[r:HAS_FOLLOWUP]->(p:TmagProspect {prospectId: $prospectId}) ' +
        'SET r.dueAt = $dueAt, r.updatedAt = $now',
      params: { sponsorTmagId, prospectId, dueAt: dueAtIso, now },
    });
    return {
      prospectId,
      sponsorTmagId,
      dueAt: dueAtIso,
      createdAt: existing.createdAt,
      clearedAt: null,
    };
  }

  // Insert new active follow-up. Use compound id so a second insert with
  // clearedAt set later can co-exist (cleared rows live alongside the active).
  const followUpId = `crmfup_${randomUUID()}`;
  const record: McsCrmFollowUpRecord = {
    prospectId,
    sponsorTmagId,
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
        'MERGE (b:TeamMagnificentMember {tmagId: $sponsorTmagId}) ' +
        'MERGE (p:TmagProspect {prospectId: $prospectId}) ' +
        'MERGE (b)-[r:HAS_FOLLOWUP]->(p) ' +
        'SET r.dueAt = $dueAt, r.createdAt = $createdAt, r.followUpId = $id',
      params: { sponsorTmagId, prospectId, dueAt: dueAtIso, createdAt: now },
    },
    chroma: {
      collection: CHROMA_COLLECTION,
      document: `crm follow-up set (BA ${sponsorTmagId} -> prospect ${prospectId}) due ${dueAtIso}`,
      metadata: {
        kind: 'crm_followup_set',
        prospectId,
        sponsorTmagId,
        dueAt: dueAtIso,
        at: now,
      },
    },
  });

  return record;
}

export async function getActiveFollowUp(
  prospectId: string,
  sponsorTmagId: string,
): Promise<McsCrmFollowUpRecord | null> {
  const res = await gatewayCall<{ documents: McsCrmFollowUpRecord[] }>(
    'mongodb',
    'query',
    {
      database: MONGO_DB,
      collection: FOLLOWUPS_COLLECTION,
      filter: { prospectId, sponsorTmagId, clearedAt: null },
      limit: 1,
    },
  );
  return res.documents[0] ?? null;
}

export async function clearFollowUp(
  prospectId: string,
  sponsorTmagId: string,
): Promise<void> {
  await assertOwnership(prospectId, sponsorTmagId);

  const existing = await getActiveFollowUp(prospectId, sponsorTmagId);
  if (!existing) return; // idempotent

  const clearedAt = new Date().toISOString();
  await gatewayCall('mongodb', 'update', {
    database: MONGO_DB,
    collection: FOLLOWUPS_COLLECTION,
    filter: { prospectId, sponsorTmagId, clearedAt: null },
    update: { $set: { clearedAt } },
  });
  await gatewayCall('neo4j', 'cypher', {
    query:
      'MATCH (b:TeamMagnificentMember {tmagId: $sponsorTmagId})-[r:HAS_FOLLOWUP]->(p:TmagProspect {prospectId: $prospectId}) ' +
      'DELETE r',
    params: { sponsorTmagId, prospectId },
  });
}

// ── Dispositions ──────────────────────────────────────────────────────────

export async function setDisposition(
  prospectId: string,
  sponsorTmagId: string,
  disposition: McsCrmDisposition | null,
): Promise<McsCrmDisposition | null> {
  if (disposition !== null && !VALID_DISPOSITIONS.has(disposition)) {
    throw new CrmError('invalid_disposition');
  }

  await assertOwnership(prospectId, sponsorTmagId);

  const existing = await getDisposition(prospectId, sponsorTmagId);
  const now = new Date().toISOString();

  // Clear path
  if (disposition === null) {
    if (!existing) return null;
    await gatewayCall('mongodb', 'update', {
      database: MONGO_DB,
      collection: DISPOSITIONS_COLLECTION,
      filter: { prospectId, sponsorTmagId },
      update: { $set: { disposition: null, updatedAt: now } },
    });
    await gatewayCall('neo4j', 'cypher', {
      query:
        'MATCH (b:TeamMagnificentMember {tmagId: $sponsorTmagId})-[r:DISPOSED]->(p:TmagProspect {prospectId: $prospectId}) ' +
        'DELETE r',
      params: { sponsorTmagId, prospectId },
    });
    return null;
  }

  // Set path
  if (existing) {
    await gatewayCall('mongodb', 'update', {
      database: MONGO_DB,
      collection: DISPOSITIONS_COLLECTION,
      filter: { prospectId, sponsorTmagId },
      update: { $set: { disposition, updatedAt: now } },
    });
    await gatewayCall('neo4j', 'cypher', {
      query:
        'MERGE (b:TeamMagnificentMember {tmagId: $sponsorTmagId}) ' +
        'MERGE (p:TmagProspect {prospectId: $prospectId}) ' +
        'MERGE (b)-[r:DISPOSED]->(p) ' +
        'SET r.disposition = $disposition, r.updatedAt = $now',
      params: { sponsorTmagId, prospectId, disposition, now },
    });
    return disposition;
  }

  const dispoId = `crmdispo_${prospectId}_${sponsorTmagId}`;
  const record: McsCrmDispositionRecord = {
    prospectId,
    sponsorTmagId,
    disposition,
    updatedAt: now,
  };
  await tripleStackWrite({
    id: dispoId,
    mongoCollection: DISPOSITIONS_COLLECTION,
    mongoDoc: { ...record },
    neo4j: {
      cypher:
        'MERGE (b:TeamMagnificentMember {tmagId: $sponsorTmagId}) ' +
        'MERGE (p:TmagProspect {prospectId: $prospectId}) ' +
        'MERGE (b)-[r:DISPOSED]->(p) ' +
        'SET r.disposition = $disposition, r.updatedAt = $now',
      params: { sponsorTmagId, prospectId, disposition, now },
    },
    chroma: {
      collection: CHROMA_COLLECTION,
      document: `crm disposition '${disposition}' (BA ${sponsorTmagId} -> prospect ${prospectId})`,
      metadata: {
        kind: 'crm_disposition_set',
        prospectId,
        sponsorTmagId,
        disposition,
        at: now,
      },
    },
  });
  return disposition;
}

export async function getDisposition(
  prospectId: string,
  sponsorTmagId: string,
): Promise<McsCrmDisposition | null> {
  const res = await gatewayCall<{ documents: Array<{ disposition: McsCrmDisposition | null }> }>(
    'mongodb',
    'query',
    {
      database: MONGO_DB,
      collection: DISPOSITIONS_COLLECTION,
      filter: { prospectId, sponsorTmagId },
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
  sponsorTmagId: string,
): Promise<McsProspectCrmBundle> {
  const prospect = await assertOwnership(prospectId, sponsorTmagId);

  const [notes, followUp, disposition] = await Promise.all([
    listNotes(prospectId, sponsorTmagId),
    getActiveFollowUp(prospectId, sponsorTmagId),
    getDisposition(prospectId, sponsorTmagId),
  ]);

  // Editable identity fields (Chat #141). assertOwnership's guard doc is
  // privacy-minimal (firstName + lastInitial), so read the full record for
  // the fields the owning BA's edit form needs. Sponsor is intentionally
  // NOT surfaced — not editable from the cockpit (locked-spec 3.5).
  const full = await fetchFullProspectForEdit(prospectId);

  return {
    prospectId,
    notes,
    followUp,
    disposition,
    // No enforced re-invite cooldown (Chat #147, seq 23) — always available.
    // The field is retained on the bundle shape for back-compat; null means
    // "re-invite anytime".
    reinviteAvailableAt: null,
    editable: {
      firstName: full?.firstName ?? prospect.firstName ?? '',
      lastName: full?.lastName ?? '',
      phone: full?.phone ?? null,
      email: full?.email ?? null,
      city: full?.location?.city ?? '',
      stateOrRegion: full?.location?.stateOrRegion ?? '',
      country: full?.location?.country ?? 'US',
    },
  };
}

/** Full identity read for the edit form. Separate from the privacy-minimal
 * guard doc so the guard stays lean. Sponsor-scoping already enforced by the
 * assertOwnership call in getCrmBundle before this runs. */
async function fetchFullProspectForEdit(prospectId: string): Promise<{
  firstName: string;
  lastName: string;
  phone: string | null;
  email: string | null;
  location?: { city: string; stateOrRegion: string; country: string };
} | null> {
  const res = await gatewayCall<{
    documents: Array<{
      firstName: string;
      lastName: string;
      phone: string | null;
      email: string | null;
      location?: { city: string; stateOrRegion: string; country: string };
    }>;
  }>('mongodb', 'query', {
    database: MONGO_DB,
    collection: PROSPECTS_COLLECTION,
    filter: { prospectId },
    limit: 1,
  });
  return res.documents?.[0] ?? null;
}

// ── Re-invite ─────────────────────────────────────────────────────────────

/**
 * Re-invite a prospect: bump sentAt, append an activity entry, and — if the
 * existing token has expired — mint a fresh token and point the prospect
 * at it (state reset to 'minted', expiresAt extended).
 *
 * No enforced cooldown (Chat #147, seq 23) — the BA decides when to re-invite.
 *
 * Forbidden states:
 *   - prospect.sentAt null → CrmError('not_yet_sent'): use "I sent this".
 *   - prospect.state 'enrolled' → CrmError('enrolled'): terminal.
 */
export async function reinvite(
  prospectId: string,
  sponsorTmagId: string,
): Promise<McsReinviteResponse> {
  const prospect = await assertOwnership(prospectId, sponsorTmagId);

  if (prospect.state === 'enrolled') {
    throw new CrmError('enrolled');
  }
  if (!prospect.sentAt) {
    throw new CrmError('not_yet_sent');
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
          sponsorTmagId,
          state: 'minted',
          createdAt: now,
          clickedAt: null,
          expiresAt: newExpiresAt,
        },
      ],
    });
    await gatewayCall('neo4j', 'cypher', {
      query:
        'MERGE (t:TmagInviteToken {token: $token}) ' +
        'SET t.prospectId = $prospectId, ' +
        '    t.sponsorTmagId = $sponsorTmagId, ' +
        '    t.state = $state, ' +
        '    t.createdAt = $createdAt, ' +
        '    t.expiresAt = $expiresAt ' +
        'WITH t ' +
        'MATCH (p:TmagProspect {prospectId: $prospectId}) ' +
        'MERGE (t)-[:FOR_PROSPECT]->(p)',
      params: {
        token,
        prospectId,
        sponsorTmagId,
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
        'MATCH (p:TmagProspect {prospectId: $prospectId}) ' +
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
    sponsorTmagId,
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

// ── Re-invite script (Chat #147, seq 23) ──────────────────────────────────

/**
 * Generate a ready-to-send, compliance-clean re-invite message the BA can copy
 * (Chat #147, seq 23, dec_cockpit_sponsor_and_reinvite). This is the SCRIPT
 * BUTTON's server side. It NEVER mints, sends, or gates — it only returns copy.
 *
 * Compliance (locked-spec 3.10 / 3.11): BA-facing, personal word-of-mouth
 * follow-up. Compliance-safe by construction — no income, earnings, comp,
 * placement/queue, or AI-prospecting language. The message leads with a warm,
 * low-pressure nudge to (re)watch a short video and decide for themselves.
 *
 * State-aware opener:
 *   - watched (video_complete / callback / webinar) → "you watched it, let's talk"
 *   - everything else → "circling back on that short video"
 */
export async function reinviteScript(
  prospectId: string,
  sponsorTmagId: string,
): Promise<McsReinviteScriptResponse> {
  const prospect = await assertOwnership(prospectId, sponsorTmagId);

  const name = (prospect.firstName ?? '').trim() || 'there';
  const link = prospect.token
    ? `https://teammagnificent.com/p/${prospect.token}`
    : '';

  const watched =
    prospect.state === 'video_complete' ||
    prospect.state === 'callback_requested' ||
    prospect.state === 'webinar_reserved';

  const opener = watched
    ? `Hey ${name}, I know you got a chance to watch that short video — I'd ` +
      `genuinely love to hear what you thought, no pressure at all. ` +
      `Whenever you have a few minutes to chat, I'm here.`
    : `Hey ${name}, just circling back on that short video I sent over — no ` +
      `pressure at all, I just didn't want it to get buried in your messages. ` +
      `Whenever you have a few minutes, I'd love to hear what you think.`;

  const script = link ? `${opener}\n\nHere's the link again: ${link}` : opener;

  return { ok: true, prospectId, script };
}

/**
 * Append an entry to the invitation activity timeline. Mirrors the spine's
 * appendActivity in domain/invitations.ts — same collection, same shape, so
 * the cockpit read pipeline picks it up with no changes.
 */
async function appendActivity(entry: {
  prospectId: string;
  sponsorTmagId: string;
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
      sponsorTmagId: entry.sponsorTmagId,
      kind: entry.kind,
      note: entry.note,
      at: entry.at,
    },
    neo4j: {
      cypher:
        'MATCH (p:TmagProspect {prospectId: $prospectId}) ' +
        'CREATE (a:TmagInvitationActivity {' +
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
        sponsorTmagId: entry.sponsorTmagId,
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
  sponsorTmagId: string,
): Promise<McsTodayActionItem[]> {
  const fourteenDaysAgoIso = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
  const nowIso = new Date().toISOString();

  // Fan out three reads.
  const [callbacksRes, followUpsRes, prospectsRes] = await Promise.all([
    gatewayCall<{
      documents: Array<{
        prospectId: string;
        intent: McsCallbackIntent;
        createdAt: string;
      }>;
    }>('mongodb', 'query', {
      database: MONGO_DB,
      collection: CALLBACK_COLLECTION,
      filter: { sponsorTmagId, createdAt: { $gte: fourteenDaysAgoIso } },
      sort: { createdAt: -1 },
      limit: 200,
    }),
    gatewayCall<{ documents: McsCrmFollowUpRecord[] }>('mongodb', 'query', {
      database: MONGO_DB,
      collection: FOLLOWUPS_COLLECTION,
      filter: { sponsorTmagId, clearedAt: null, dueAt: { $lte: nowIso } },
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
      filter: { sponsorTmagId, deleted: { $ne: true } },
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
  const callbackItems: McsTodayActionItem[] = [];
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
  const followupItems: McsTodayActionItem[] = [];
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
  const draftItems: McsTodayActionItem[] = [];
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
  const byAtDesc = (a: McsTodayActionItem, b: McsTodayActionItem) =>
    a.at < b.at ? 1 : a.at > b.at ? -1 : 0;

  return [
    ...callbackItems.sort(byAtDesc),
    ...followupItems.sort(byAtDesc),
    ...draftItems.sort(byAtDesc),
  ];
}

// ── BA-scoped prospect CRUD (Chat #141) ───────────────────────────────────
//
// The cockpit complement to the /admin prospect CRUD (#138/#140). A BA may
// create / edit / soft-delete / restore THEIR OWN prospects. The actual
// mutation logic is NOT duplicated here — it lives once in
// adminProspectCrud.ts ("the shared machines", Chat #141 decision). These
// wrappers do three things and nothing more:
//
//   1. Force sponsorTmagId from the session (locked-spec 3.5 — never the body).
//   2. Enforce ownership on edit/delete/restore via the existing
//      assertOwnership() guard, so a BA can never touch another BA's
//      prospect (3.5 "no strays"). Create needs no ownership check — the
//      session BA becomes the sponsor by construction.
//   3. Pass a { kind: 'ba' } actor so the audit entry names the BA and the
//      action verb lands in the ba.prospect.* namespace (Chat #141 — the
//      verb tracks the actor; the shared engine derives it from actor.kind).
//
// Scope (Chat #141, against locked-spec 3.2 / 3.7): a BA may soft-delete ANY
// of their own prospects, placed or not — identical to admin. The holding
// tank is left ENTIRELY untouched on delete (the shared engine guarantees
// this); a placed prospect's monotonic position only vacates via the 8-week
// flush or enrollment, never via a CRUD delete.
//
// Create is MINT-ONLY (Chat #141 mirrors #140-A): the BA-created prospect
// goes through the exact same path as any other — a real /p/{token}, sponsor
// stamped immutably, NO placement. Position is earned later at
// video_complete through /api/p/:token/video-event, never assigned here. A
// BA's normal create path is still the invitation generator (locked-spec
// 1.8); this cockpit create is the manual complement for a prospect the BA
// is recording directly, and it behaves identically downstream.

/** Resolve the calling BA's audit actor. Display name from the BA record;
 * falls back to the tmagId if the record is somehow nameless. */
async function baActor(sponsorTmagId: string): Promise<CrudActor> {
  const ba = await findBAByTmagId(sponsorTmagId);
  const displayName = ba
    ? `${ba.firstName ?? ''} ${ba.lastName ?? ''}`.trim() || sponsorTmagId
    : sponsorTmagId;
  return { kind: 'ba', tmagId: sponsorTmagId, displayName };
}

/**
 * Map a shared-engine CRUD error to the CrmError vocabulary the crm route
 * layer already knows how to status-map (sendCrmError). prospect_not_found
 * and sponsor_mismatch keep their existing 404 / 403 meaning; the rest are
 * 400-class validation codes surfaced verbatim.
 */
function crmErrorFromCrud(error: AdminProspectCrudError): CrmError {
  switch (error.kind) {
    case 'prospect_not_found':
      return new CrmError('prospect_not_found');
    case 'row_unavailable':
      return new CrmError('row_unavailable');
    default:
      // reason_too_short | sponsor_not_found | prospect_deleted |
      // prospect_not_deleted | no_fields — all 400-class, surfaced by code.
      return new CrmError(error.kind);
  }
}

/** Fields a BA may supply when creating a prospect from the cockpit.
 * sponsorTmagId is intentionally absent — it is forced from the session. */
export interface BaCreateProspectInput {
  firstName: string;
  lastName: string;
  city: string;
  stateOrRegion: string;
  country?: string;
  phone?: string | null;
  email?: string | null;
  reason: string;
}

/** Fields a BA may edit. Sponsor is never here (3.5). */
export interface BaEditProspectInput {
  firstName?: string;
  lastName?: string;
  city?: string;
  stateOrRegion?: string;
  country?: string;
  phone?: string | null;
  email?: string | null;
  reason: string;
}

export async function baCreateProspect(
  sponsorTmagId: string,
  input: BaCreateProspectInput,
): Promise<{
  prospectId: string;
  token: string;
  inviteUrl: string;
  row: McsAdminProspectDirectoryRow;
}> {
  const actor = await baActor(sponsorTmagId);
  // sponsorTmagId forced from session — the body never carries it (3.5).
  const result = await adminCreateProspect(
    {
      firstName: input.firstName,
      lastName: input.lastName,
      city: input.city,
      stateOrRegion: input.stateOrRegion,
      country: input.country,
      sponsorTmagId,
      phone: input.phone ?? null,
      email: input.email ?? null,
      reason: input.reason,
    },
    actor,
  );
  if (!result.ok) throw crmErrorFromCrud(result.error);
  return result.value;
}

export async function baEditProspect(
  prospectId: string,
  sponsorTmagId: string,
  input: BaEditProspectInput,
): Promise<{ prospectId: string; row: McsAdminProspectDirectoryRow }> {
  // Ownership first: a BA edits only their own prospect. assertOwnership
  // throws CrmError('prospect_not_found' | 'sponsor_mismatch') which the
  // route maps to 404 / 403 without leaking which prospect belongs to whom.
  await assertOwnership(prospectId, sponsorTmagId);

  const actor = await baActor(sponsorTmagId);
  const result = await adminEditProspect(
    prospectId,
    {
      firstName: input.firstName,
      lastName: input.lastName,
      city: input.city,
      stateOrRegion: input.stateOrRegion,
      country: input.country,
      phone: input.phone ?? undefined,
      email: input.email ?? undefined,
      reason: input.reason,
    },
    actor,
  );
  if (!result.ok) throw crmErrorFromCrud(result.error);
  return result.value;
}

export async function baSoftDeleteProspect(
  prospectId: string,
  sponsorTmagId: string,
  reason: string,
): Promise<{ prospectId: string; deletedAt: string }> {
  await assertOwnership(prospectId, sponsorTmagId);
  const actor = await baActor(sponsorTmagId);
  const result = await adminSoftDeleteProspect(prospectId, { reason }, actor);
  if (!result.ok) throw crmErrorFromCrud(result.error);
  return result.value;
}

// baRestoreProspect REMOVED (Chat #141): restore is admin-only. A BA can
// soft-delete their own prospect but cannot undo it; recovery is a Kevin
// lever from /admin (adminRestoreProspect). No BA-scoped restore exists.
