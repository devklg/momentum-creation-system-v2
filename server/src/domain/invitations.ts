/**
 * Invitation spine domain (Chat #119).
 *
 * The WRITE-side counterpart to the /p READ-side. When a BA mints an
 * invitation on .team, this module atomically creates BOTH:
 *   - the prospect record (state 'minted')        — domain/prospects.ts shape
 *   - the invite_token record (state 'minted')    — domain/tokens.ts shape
 * across MongoDB + Neo4j + ChromaDB, mirroring the triple-stack discipline
 * of domain/holdingTank.ts placeProspect.
 *
 * Sponsor immutability (locked-spec Part 3.5):
 *   - sponsorBaId is stamped from the AUTHED SESSION BA at the route layer,
 *     never from the request body. createInvitation receives it as an
 *     argument and stamps it onto every artifact (prospect, token, both
 *     Neo4j edges, both Chroma events). It is never recomputed.
 *
 * "I sent this" (Chat #119 decision — FIELD not lifecycle state):
 *   - The token lifecycle rail (tokens.ts STATE_ORDER) describes what the
 *     PROSPECT did. "Sent" is a BA-side fact, tracked as `sentAt` on the
 *     prospect record + an activity-timeline entry — NOT a new rung in the
 *     forward-only rail. This avoids the rail fighting itself when a
 *     prospect clicks the link before the BA taps "I sent this".
 *   - markInvitationSent sets sentAt and appends to the activity timeline.
 *     The token state is untouched.
 *
 * Standalone "log an invite I sent" (Signup Architecture G.5):
 *   - logExternalInvite mints a token + prospect exactly like createInvitation
 *     but marks sentAt immediately — for the BA who shared a link outside the
 *     normal mint-then-send flow and is recording it after the fact.
 *
 * Form fields (Chat #119 lock): first name, last name, email, phone, city,
 * state — all captured at mint so the CRM export carries them and city/state
 * render on the dashboard ticker.
 *
 * Gateway bugs respected (per tripleStack.ts header + Chat #105/#118):
 *   - mongo `update` has no working upsert → branch on existence (here we
 *     only insert-new, so not hit on the create path).
 *   - mongo query param is `filter`, not `query`.
 *   - chromadb add() does not auto-create collections → mcs_invitations
 *     bootstrapped Chat #119 (CK-04).
 */

import { randomUUID, randomInt } from 'node:crypto';
import { env } from '../env.js';
import { gatewayCall } from '../services/gateway.js';
import { tripleStackWrite } from '../services/tripleStack.js';
import { createProspectAccount, normalizePhone } from './prospectAccount.js';
import { sendSms, TelnyxConfigError, TelnyxError } from '../services/telnyx.js';
import { mintUniqueToken, TOKEN_TTL_MS } from './tokens.js';
import { lastInitialOf } from './prospects.js';
import { createOrUpdateCrmRecordForToken } from './prospectCrm.js';
import type {
  InvitationActivityEntry,
  InvitationSource,
  InviteTokenRecord,
  ProspectCrmSource,
  ProspectLocation,
  ProspectRecord,
} from '@momentum/shared';

const MONGO_DB = 'momentum';
const PROSPECTS_COLLECTION = 'prospects';
const TOKENS_COLLECTION = 'invite_tokens';
const ACTIVITY_COLLECTION = 'invitation_activity';
const CHROMA_COLLECTION = 'mcs_invitations';

/**
 * Re-entry code alphabet (#148): unambiguous - no I, O, 0, 1. A prospect
 * writes this down from the presentation page to return via phone + code.
 */
const REENTRY_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function genReentryCode(len = 6): string {
  let out = '';
  for (let i = 0; i < len; i += 1) {
    out += REENTRY_ALPHABET[randomInt(REENTRY_ALPHABET.length)];
  }
  return out;
}

/**
 * Input to createInvitation. sponsorBaId is supplied by the route from the
 * authed session — it is NOT part of the BA-submitted form and must never be
 * read from the request body (locked-spec 3.5).
 */
export interface CreateInvitationInput {
  sponsorBaId: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  city: string;
  stateOrRegion: string;
  /** ISO 3166-1 alpha-2. Defaults to 'US' at the route layer if unspecified. */
  country: string;
  /**
   * Invitation text the BA will send (Chat #120). STORED for reuse +
   * history; storing is not sending (locked-spec 1.13 / 3.6 — the BA sends
   * from their own phone). null when not provided (e.g. legacy /log calls).
   */
  message: string | null;
  /** Who composed `message`. 'self' for the plain form. */
  source: InvitationSource;
  /** BA-authored relationship context captured by Ivory before drafting. */
  relationshipReason?: string | null;
}

export interface CreateInvitationResult {
  prospectId: string;
  token: string;
  sponsorBaId: string;
  /** App-generated re-entry code (#148), shown on-page for the prospect. */
  reentryCode: string;
  createdAt: string;
  expiresAt: string;
  /** Fully-substituted prospect link the BA shares. */
  inviteUrl: string;
  /** Echo of what was stored (Chat #120). */
  message: string | null;
  source: InvitationSource;
  relationshipReason: string | null;
}

/**
 * Base URL the /p/{token} link is built on. Env-driven (#145): prod sets
 * PROSPECT_BASE_URL=https://teammagnificent.com; dev defaults to
 * http://localhost:7701 (the .com app) so minted links resolve locally.
 * Was hardcoded to the prod domain through #144, which 404'd every dev link.
 */
const PROSPECT_BASE_URL = env.PROSPECT_BASE_URL;

function buildInviteUrl(token: string): string {
  return `${PROSPECT_BASE_URL}/p/${token}`;
}

function crmSourceForInvitation(source: InvitationSource): ProspectCrmSource {
  if (source === 'ivory') return 'ivory';
  if (source === 'scriptmaker') return 'scriptmaker';
  return 'pmv';
}

/**
 * Create an invitation: prospect record + invite-token record, atomically
 * triple-stacked. The prospect starts at state 'minted' with sentAt=null;
 * the BA confirms the send separately via markInvitationSent.
 *
 * Sequence (mirrors placeProspect's discipline):
 *   1. Mint a unique token string (collision-retry in tokens.ts).
 *   2. tripleStackWrite the prospect record (Mongo doc + Neo4j INVITED edge +
 *      Chroma searchable "invitation created" event).
 *   3. Insert the token record (Mongo) + MERGE the token node/edge (Neo4j).
 *      The token's Chroma presence is covered by the invitation event in
 *      step 2 — we don't double-log.
 *
 * If step 3 fails after step 2 committed, the prospect exists without a
 * token. That is a recoverable orphan (the BA can re-mint); we surface the
 * error rather than swallow it, so the route returns 500 and the BA retries.
 */
export async function createInvitation(
  input: CreateInvitationInput,
): Promise<CreateInvitationResult> {
  const prospectId = `prospect_${randomUUID()}`;
  const token = await mintUniqueToken();
  const reentryCode = genReentryCode();
  const createdAt = new Date().toISOString();
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS).toISOString();
  const lastInitial = lastInitialOf(input.lastName);

  const location: ProspectLocation = {
    city: input.city,
    stateOrRegion: input.stateOrRegion,
    country: input.country,
  };

  // ── Step 2: prospect record, triple-stacked. ──────────────────────────
  const prospectRecord: ProspectRecord = {
    prospectId,
    firstName: input.firstName,
    lastName: input.lastName,
    lastInitial,
    location,
    phone: input.phone ?? null,
    email: input.email ?? null,
    sponsorBaId: input.sponsorBaId,
    state: 'minted',
    positionNumber: null,
    placedAt: null,
    becameCustomer: false,
    becameCustomerAt: null,
    customerNote: null,
    createdAt,
    updatedAt: createdAt,
    expiresAt,
  };

  // sentAt is a spine field (Chat #119), not part of the shared ProspectRecord
  // funnel shape. Persist it on the Mongo doc alongside the record.
  const relationshipReason = input.relationshipReason?.trim() || null;

  await tripleStackWrite({
    id: prospectId,
    mongoCollection: PROSPECTS_COLLECTION,
    mongoDoc: {
      ...prospectRecord,
      sentAt: null,
      token,
      message: input.message,
      source: input.source,
      relationshipReason,
    },
    neo4j: {
      // BA INVITED prospect. sponsorBaId stamped immutably here.
      cypher:
        'MERGE (b:BA {baId: $sponsorBaId}) ' +
        'MERGE (p:Prospect {prospectId: $id}) ' +
        'SET p.firstName = $firstName, ' +
        '    p.lastInitial = $lastInitial, ' +
        '    p.city = $city, ' +
        '    p.stateOrRegion = $stateOrRegion, ' +
        '    p.country = $country, ' +
        '    p.state = $state, ' +
        '    p.sponsorBaId = $sponsorBaId, ' +
        '    p.relationshipReason = $relationshipReason, ' +
        '    p.createdAt = $createdAt ' +
        'MERGE (b)-[r:INVITED]->(p) ' +
        'SET r.token = $token, r.createdAt = $createdAt',
      params: {
        sponsorBaId: input.sponsorBaId,
        firstName: input.firstName,
        lastInitial,
        city: input.city,
        stateOrRegion: input.stateOrRegion,
        country: input.country,
        state: 'minted',
        relationshipReason,
        token,
        createdAt,
      },
    },
    chroma: {
      collection: CHROMA_COLLECTION,
      document:
        `${input.firstName} ${lastInitial}. from ${input.city}, ` +
        `${input.stateOrRegion} invited by ${input.sponsorBaId} ` +
        `at ${createdAt} (token ${token})` +
        (relationshipReason ? `. Relationship context: ${relationshipReason}` : ''),
      metadata: {
        kind: 'invitation_created',
        prospectId,
        token,
        sponsorBaId: input.sponsorBaId,
        city: input.city,
        stateOrRegion: input.stateOrRegion,
        source: input.source,
        relationshipReason,
        createdAt,
      },
    },
  });

  // ── Step 3: invite-token record, Mongo + Neo4j. ───────────────────────
  // Chroma already carries the invitation event from step 2; the token's
  // authoritative home is Mongo (resolver reads it) + Neo4j (graph walks).
  const tokenRecord: InviteTokenRecord = {
    token,
    prospectId,
    sponsorBaId: input.sponsorBaId,
    state: 'minted',
    createdAt,
    clickedAt: null,
    expiresAt,
  };

  await gatewayCall('mongodb', 'insert', {
    database: MONGO_DB,
    collection: TOKENS_COLLECTION,
    documents: [{ _id: token, ...tokenRecord }],
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
      sponsorBaId: input.sponsorBaId,
      state: 'minted',
      createdAt,
      expiresAt,
    },
  });

  // VM/CRM architecture rule: every token creation immediately creates
  // or updates a BA-scoped CRM record. Existing cockpit reads still work
  // from the prospect row; this dedicated record powers the CRM hub and VM
  // module without changing the /p/:token PMV spine.
  await createOrUpdateCrmRecordForToken({
    prospectId,
    token,
    ownerTmBaId: input.sponsorBaId,
    sponsorTmBaId: input.sponsorBaId,
    source: crmSourceForInvitation(input.source),
    leadId: null,
    leadBatchId: null,
    vmCampaignId: null,
    createdAt,
  });

  // Step 4 (#148): create the prospect-account at MINT with the BA-supplied
  // phone (normalized to E.164 so login lookups match) + the generated
  // re-entry code. Was created at video_complete; moving it here lets a
  // prospect return via phone + code even if he closes the tab before
  // finishing the video or requesting a callback. createProspectAccount is
  // idempotent on tokenId, so the later video_complete call finds this row.
  await createProspectAccount({
    prospectId,
    tokenId: token,
    sponsorBaId: input.sponsorBaId,
    tokenExpiresAt: expiresAt,
    phone: normalizePhone(input.phone),
    reentryCode,
  });

  return {
    prospectId,
    token,
    sponsorBaId: input.sponsorBaId,
    reentryCode,
    createdAt,
    expiresAt,
    inviteUrl: buildInviteUrl(token),
    message: input.message,
    source: input.source,
    relationshipReason,
  };
}

/**
 * Append an entry to the invitation activity timeline. Each entry is a
 * standalone Mongo doc keyed by a stable id; the cockpit reads them
 * chronologically per prospect. Triple-stack: Mongo doc + Neo4j event edge +
 * Chroma searchable line.
 */
async function appendActivity(entry: {
  prospectId: string;
  sponsorBaId: string;
  kind: InvitationActivityEntry['kind'];
  note: string;
  at: string;
}): Promise<string> {
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
  return activityId;
}

/**
 * "I sent this" — the BA confirms they texted the prospect the link.
 *
 * Sets sentAt on the prospect record (FIELD, not lifecycle state per Chat
 * #119) and appends an "invitation_sent" activity entry. The token state
 * rail is untouched — it advances only on prospect actions.
 *
 * Idempotent: if sentAt is already set, returns the existing value without
 * a second activity entry.
 */
export async function markInvitationSent(
  prospectId: string,
  sponsorBaId: string,
): Promise<{ sentAt: string; alreadySent: boolean }> {
  const existing = await gatewayCall<{
    documents: Array<{ sentAt?: string | null; sponsorBaId?: string }>;
  }>('mongodb', 'query', {
    database: MONGO_DB,
    collection: PROSPECTS_COLLECTION,
    filter: { prospectId },
    limit: 1,
  });
  const doc = existing.documents[0];
  if (!doc) throw new Error('prospect_not_found');

  // Sponsor immutability guard: the caller's sponsorBaId must match the
  // record's. The route already derives sponsorBaId from the session, so a
  // mismatch means a BA is trying to act on another BA's prospect.
  if (doc.sponsorBaId && doc.sponsorBaId !== sponsorBaId) {
    throw new Error('sponsor_mismatch');
  }

  if (doc.sentAt) {
    return { sentAt: doc.sentAt, alreadySent: true };
  }

  const sentAt = new Date().toISOString();
  await gatewayCall('mongodb', 'update', {
    database: MONGO_DB,
    collection: PROSPECTS_COLLECTION,
    filter: { prospectId },
    update: { $set: { sentAt, updatedAt: sentAt } },
  });

  await appendActivity({
    prospectId,
    sponsorBaId,
    kind: 'invitation_sent',
    note: 'BA confirmed the invitation link was sent.',
    at: sentAt,
  });

  return { sentAt, alreadySent: false };
}

/**
 * Standalone "log an invite I sent" (Signup Architecture G.5).
 *
 * For a BA who shared a link outside the normal mint-then-confirm flow and
 * is recording it after the fact. Mints the prospect + token exactly like
 * createInvitation, then immediately marks it sent (sentAt = createdAt) and
 * writes the "invitation_sent" activity entry — one call, fully logged.
 */
export async function logExternalInvite(
  input: CreateInvitationInput,
): Promise<CreateInvitationResult & { sentAt: string }> {
  const created = await createInvitation(input);
  const sentAt = created.createdAt;

  await gatewayCall('mongodb', 'update', {
    database: MONGO_DB,
    collection: PROSPECTS_COLLECTION,
    filter: { prospectId: created.prospectId },
    update: { $set: { sentAt, updatedAt: sentAt } },
  });

  await appendActivity({
    prospectId: created.prospectId,
    sponsorBaId: input.sponsorBaId,
    kind: 'invitation_sent',
    note: 'BA logged an invitation already sent (standalone path).',
    at: sentAt,
  });

  return { ...created, sentAt };
}

/**
 * Fire the "your prospect watched and completed the video" alert to the BA
 * (Chat #119 decision: video_complete + callback are the two events that
 * earn an SMS to the BA; partial milestones do NOT).
 *
 * Called from POST /api/p/:token/video-event ONLY when placeProspect returns
 * alreadyPlaced=false, so the alert fires exactly once per prospect — never
 * on idempotent replays of the complete event.
 *
 * Best-effort, mirroring callbackRequest.ts: the SMS is attempted after the
 * placement triple-stack has already committed. SMS failure is logged and
 * recorded on the activity timeline but never thrown — the placement landed
 * regardless, and the BA cockpit is the canonical surface.
 *
 * This also writes a 'video_completed' entry to the invitation activity
 * timeline so the cockpit shows the milestone even if the SMS fails or the
 * BA has no phone on record.
 */
export async function alertBaVideoCompleted(input: {
  prospectId: string;
  sponsorBaId: string;
  prospectFirstName: string;
  prospectLastInitial: string;
  positionNumber: number;
  baPhone: string | null;
}): Promise<void> {
  const at = new Date().toISOString();

  // Activity timeline first — durable record independent of SMS outcome.
  try {
    await appendActivity({
      prospectId: input.prospectId,
      sponsorBaId: input.sponsorBaId,
      kind: 'video_completed',
      note: `${input.prospectFirstName} ${input.prospectLastInitial}. finished the video (placed #${input.positionNumber}).`,
      at,
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(
      `[alertBaVideoCompleted ${input.prospectId}] activity write failed:`,
      err,
    );
  }

  // SMS to the BA. Best-effort. Body is factual, no income/placement claim
  // (locked-spec 3.10): the prospect's queue position is team activity, not
  // a compensation promise.
  if (!input.baPhone) return;
  const name = `${input.prospectFirstName} ${input.prospectLastInitial}.`;
  const text =
    `${name} just finished the video on your Team Magnificent page ` +
    `and joined the team line at #${input.positionNumber}. ` +
    `Reach out when you can.`;
  try {
    await sendSms({ to: input.baPhone, text });
  } catch (err) {
    let reason = 'unknown_sms_failure';
    if (err instanceof TelnyxConfigError || err instanceof TelnyxError) {
      reason = err.message;
    } else if (err instanceof Error) {
      reason = err.message;
    }
    // eslint-disable-next-line no-console
    console.error(
      `[alertBaVideoCompleted ${input.prospectId}] SMS to BA failed:`,
      reason,
    );
  }
}
