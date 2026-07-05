/**
 * BA profile / settings domain (locked-spec 3.5 + 2.3, project-wireframe 3.8).
 *
 * Read + write side of the authed BA's own profile. Everything here is
 * scoped to the session BA id — there is no cross-BA read or write path
 * on this surface (3.5).
 *
 * Field discipline:
 *   - Editable (wf_0071): firstName, lastName, email, phone, password,
 *     photoUrl, timezone, notifPrefs.
 *   - Read-only (wf_0072): sponsor, threeBaId, tmagId, accessCodeHeld.
 *     These fields never appear in any PATCH body; the route layer rejects
 *     them at parse time and the read shape carries them so the page can
 *     render the read-only card in one fetch.
 *
 * Sensitive changes (email, phone) go through a two-step challenge flow:
 *   start → mints a 6-digit numeric code, dispatches it to the NEW
 *           channel, persists the code's sha256 hash on a challenge row
 *           (collection: profile_change_challenges).
 *   verify → looks up the latest unredeemed/unexpired challenge for the
 *            authed BA + channel, matches the hash, stamps redeemedAt,
 *            and applies the change to the BA record.
 *
 * J.8 (RESOLVED Chat #147, seq 22, dec_profile_verification_and_notifications):
 * phone change is NOT SMS-verified. Routinely SMS-challenging phone edits would
 * fire thousands of needless texts. Instead the .team client shows a
 * confirm-your-input MODAL (restating the new number and why it matters —
 * Telnyx alerts, Michael's calls, prospect-login), and on explicit confirm the
 * server applies the change directly via setPhone(). Email still uses the
 * two-step code challenge (verifying ownership of a NEW inbox is different from
 * confirming a number you typed).
 *
 * Audit:
 *   - First/last name edits append an audit entry (action
 *     `ba.profile.name_change`, severity info) per TASK-134.
 *   - Email and phone verify-completes also audit (sensitive contact swap).
 *   - Password change audits (no before/after; just the event).
 *   - Other field edits do not audit (timezone / photo / notifPrefs are
 *     low-stakes preferences).
 */

import argon2 from 'argon2';
import { createHash, randomInt, randomBytes } from 'node:crypto';
import { persistenceCall } from '../services/persistence/dispatch.js';
import { appendAuditEntry } from './auditLog.js';
import { findBAByTmagId } from './ba.js';
import { sendEmail, ResendConfigError, ResendError } from '../services/resend.js';
import type {
  TmagProfile,
  TmagProfilePatch,
  McsBANotifPrefs,
  McsProfileChangeChallengeRecord,
} from '@momentum/shared';
import { MCS_BA_NOTIF_DEFAULTS } from '@momentum/shared';

const MONGO_DB = 'momentum';
const BA_COLLECTION = 'team_magnificent_members';
const ACCESS_CODES_COLLECTION = 'tmag_access_codes';
const CHALLENGES_COLLECTION = 'tmag_profile_change_challenges';

export interface SponsorQuickAccessCard {
  fullName: string;
  firstName: string;
  lastInitial: string;
  phone: string | null;
  bestContactNote: string;
  whenToCall: string;
}

/** 15 minutes — long enough for the user to switch apps and copy the code. */
const CHALLENGE_TTL_MS = 15 * 60 * 1000;

interface BAExtras {
  /** Photo URL added Chat #134; older records may not have it. */
  photoUrl?: string | null;
  notifPrefs?: McsBANotifPrefs;
  pendingEmail?: string | null;
  pendingPhone?: string | null;
}

function mintChallengeId(): string {
  return `chg_${Date.now().toString(36)}_${randomBytes(4).toString('hex')}`;
}

function mintNumericCode(): string {
  // 6 digits; randomInt is uniform across [0, 999999].
  return randomInt(0, 1_000_000).toString().padStart(6, '0');
}

function hashCode(code: string): string {
  return createHash('sha256').update(code, 'utf8').digest('hex');
}

function mergeNotifPrefs(stored: McsBANotifPrefs | undefined): McsBANotifPrefs {
  // Defensive merge: a stored record from a pre-#134 BA has no notifPrefs;
  // a record from a partial save may be missing a topic added later. Always
  // resolve to the full shape so the UI never has to defend against undef.
  if (!stored) return MCS_BA_NOTIF_DEFAULTS;
  const legacy = stored as Partial<McsBANotifPrefs> & {
    michaelComplete?: McsBANotifPrefs['steveDiscoveryComplete'];
  };
  return {
    callbackRequested: { ...MCS_BA_NOTIF_DEFAULTS.callbackRequested, ...(stored.callbackRequested ?? {}) },
    webinarReserved: { ...MCS_BA_NOTIF_DEFAULTS.webinarReserved, ...(stored.webinarReserved ?? {}) },
    newSponsoredBA: { ...MCS_BA_NOTIF_DEFAULTS.newSponsoredBA, ...(stored.newSponsoredBA ?? {}) },
    steveDiscoveryComplete: {
      ...MCS_BA_NOTIF_DEFAULTS.steveDiscoveryComplete,
      ...(legacy.steveDiscoveryComplete ?? legacy.michaelComplete ?? {}),
    },
    poolMovement: { ...MCS_BA_NOTIF_DEFAULTS.poolMovement, ...(stored.poolMovement ?? {}) },
  };
}

function lastInitial(name: string): string {
  return name.trim().slice(0, 1).toUpperCase();
}

function sponsorQuickCardFromBA(
  sponsor: NonNullable<Awaited<ReturnType<typeof findBAByTmagId>>>,
): SponsorQuickAccessCard {
  const phone = sponsor.phone && sponsor.phone.trim() ? sponsor.phone : null;
  return {
    fullName: `${sponsor.firstName} ${sponsor.lastName}`.trim(),
    firstName: sponsor.firstName,
    lastInitial: lastInitial(sponsor.lastName),
    phone,
    bestContactNote: phone
      ? 'Best contact: call or text the number on file.'
      : 'Best contact: connect through your next Team Magnificent touchpoint.',
    whenToCall:
      'Call when you are stuck, ready to send your first invitation, or need a quick read before a follow-up.',
  };
}

async function findActiveCodeForBA(tmagId: string): Promise<string | null> {
  const r = await persistenceCall<{ documents: Array<{ code: string }> }>('mongodb', 'query', {
    database: MONGO_DB,
    collection: ACCESS_CODES_COLLECTION,
    filter: { sponsorTmagId: tmagId, active: true },
    limit: 1,
  });
  return r.documents[0]?.code ?? null;
}

export async function getProfileForBA(tmagId: string): Promise<TmagProfile | null> {
  const ba = await findBAByTmagId(tmagId);
  if (!ba) return null;
  const extras = ba as typeof ba & BAExtras;

  const [accessCodeHeld, sponsor] = await Promise.all([
    findActiveCodeForBA(tmagId),
    ba.sponsorTmagId ? findBAByTmagId(ba.sponsorTmagId) : Promise.resolve(null),
  ]);

  const sponsorFullName = sponsor
    ? `${sponsor.firstName} ${sponsor.lastName}`.trim()
    : '';

  return {
    firstName: ba.firstName,
    lastName: ba.lastName,
    email: ba.email,
    phone: ba.phone,
    timezone: ba.timezone,
    photoUrl: extras.photoUrl ?? null,
    notifPrefs: mergeNotifPrefs(extras.notifPrefs),
    tmagId: ba.tmagId,
    threeBaId: ba.threeBaId,
    accessCodeHeld,
    sponsor: {
      tmagId: ba.sponsorTmagId,
      threeBaId: ba.sponsorThreeBaId,
      fullName: sponsorFullName,
    },
    pendingEmail: extras.pendingEmail ?? null,
    pendingPhone: extras.pendingPhone ?? null,
  };
}

export async function getSponsorQuickAccessForBA(
  tmagId: string,
): Promise<SponsorQuickAccessCard | null> {
  const ba = await findBAByTmagId(tmagId);
  if (!ba?.sponsorTmagId) return null;
  const sponsor = await findBAByTmagId(ba.sponsorTmagId);
  if (!sponsor) return null;
  return sponsorQuickCardFromBA(sponsor);
}

/**
 * Apply the patch to the BA record. Returns the fresh profile.
 *
 * Validation lives in the route layer (zod); this trusts the shape.
 * First/last name changes append an audit entry with before/after.
 */
export async function patchProfile(
  tmagId: string,
  patch: TmagProfilePatch,
): Promise<TmagProfile> {
  const current = await findBAByTmagId(tmagId);
  if (!current) throw new Error('BA not found');

  const set: Record<string, unknown> = {};
  if (patch.firstName !== undefined && patch.firstName !== current.firstName) {
    set.firstName = patch.firstName;
  }
  if (patch.lastName !== undefined && patch.lastName !== current.lastName) {
    set.lastName = patch.lastName;
  }
  if (patch.timezone !== undefined && patch.timezone !== current.timezone) {
    set.timezone = patch.timezone;
  }
  if (patch.photoUrl !== undefined) {
    set.photoUrl = patch.photoUrl;
  }
  if (patch.notifPrefs !== undefined) {
    const existing = mergeNotifPrefs((current as typeof current & BAExtras).notifPrefs);
    set.notifPrefs = { ...existing, ...patch.notifPrefs } satisfies McsBANotifPrefs;
  }

  if (Object.keys(set).length > 0) {
    await persistenceCall('mongodb', 'update', {
      database: MONGO_DB,
      collection: BA_COLLECTION,
      filter: { tmagId },
      update: { $set: set },
    });

    // Keep the Neo4j BA node aligned for name changes — sponsor genealogy
    // queries surface firstName/lastName off the node.
    if (set.firstName !== undefined || set.lastName !== undefined) {
      const nextFirst = (set.firstName as string | undefined) ?? current.firstName;
      const nextLast = (set.lastName as string | undefined) ?? current.lastName;
      await persistenceCall('neo4j', 'cypher', {
        query:
          'MATCH (n:TeamMagnificentMember {tmagId: $tmagId}) SET n.firstName = $firstName, n.lastName = $lastName',
        params: { tmagId, firstName: nextFirst, lastName: nextLast },
      });
    }
  }

  // Audit the name change if either part shifted (TASK-134 hard lock).
  const nameChanged =
    (set.firstName !== undefined && set.firstName !== current.firstName) ||
    (set.lastName !== undefined && set.lastName !== current.lastName);

  if (nameChanged) {
    await appendAuditEntry({
      actor: {
        kind: 'ba',
        tmagId,
        displayName: `${current.firstName} ${current.lastName}`.trim(),
      },
      action: 'ba.profile.name_change',
      entity: {
        kind: 'brand_ambassador',
        id: tmagId,
        displayLabel: `${current.firstName} ${current.lastName}`.trim(),
      },
      severity: 'info',
      before: { firstName: current.firstName, lastName: current.lastName },
      after: {
        firstName: (set.firstName as string | undefined) ?? current.firstName,
        lastName: (set.lastName as string | undefined) ?? current.lastName,
      },
    });
  }

  const next = await getProfileForBA(tmagId);
  if (!next) throw new Error('BA disappeared after patch');
  return next;
}

export type PasswordResult =
  | { ok: true }
  | { ok: false; error: 'current_password_wrong' };

export async function changePassword(
  tmagId: string,
  currentPassword: string,
  newPassword: string,
): Promise<PasswordResult> {
  const ba = await findBAByTmagId(tmagId);
  if (!ba) return { ok: false, error: 'current_password_wrong' };

  let valid = false;
  try {
    valid = await argon2.verify(ba.passwordHash, currentPassword);
  } catch {
    valid = false;
  }
  if (!valid) return { ok: false, error: 'current_password_wrong' };

  const newHash = await argon2.hash(newPassword, { type: argon2.argon2id });
  await persistenceCall('mongodb', 'update', {
    database: MONGO_DB,
    collection: BA_COLLECTION,
    filter: { tmagId },
    update: { $set: { passwordHash: newHash } },
  });

  await appendAuditEntry({
    actor: {
      kind: 'ba',
      tmagId,
      displayName: `${ba.firstName} ${ba.lastName}`.trim(),
    },
    action: 'ba.profile.password_change',
    entity: {
      kind: 'brand_ambassador',
      id: tmagId,
      displayLabel: `${ba.firstName} ${ba.lastName}`.trim(),
    },
    severity: 'info',
    before: null,
    after: null,
  });

  return { ok: true };
}

/* ─── Challenge flow (email + phone) ─── */

async function persistChallenge(rec: McsProfileChangeChallengeRecord): Promise<void> {
  await persistenceCall('mongodb', 'insert', {
    database: MONGO_DB,
    collection: CHALLENGES_COLLECTION,
    documents: [{ _id: rec.challengeId, ...rec }],
  });
}

async function stampPendingTarget(
  tmagId: string,
  channel: 'email' | 'phone',
  target: string,
): Promise<void> {
  const field = channel === 'email' ? 'pendingEmail' : 'pendingPhone';
  await persistenceCall('mongodb', 'update', {
    database: MONGO_DB,
    collection: BA_COLLECTION,
    filter: { tmagId },
    update: { $set: { [field]: target } },
  });
}

async function clearPendingTarget(
  tmagId: string,
  channel: 'email' | 'phone',
): Promise<void> {
  const field = channel === 'email' ? 'pendingEmail' : 'pendingPhone';
  await persistenceCall('mongodb', 'update', {
    database: MONGO_DB,
    collection: BA_COLLECTION,
    filter: { tmagId },
    update: { $set: { [field]: null } },
  });
}

async function findLatestActiveChallenge(
  tmagId: string,
  channel: 'email' | 'phone',
): Promise<McsProfileChangeChallengeRecord | null> {
  const r = await persistenceCall<{ documents: McsProfileChangeChallengeRecord[] }>(
    'mongodb',
    'query',
    {
      database: MONGO_DB,
      collection: CHALLENGES_COLLECTION,
      filter: { tmagId, channel, redeemedAt: null },
      sort: { issuedAt: -1 },
      limit: 1,
    },
  );
  return r.documents[0] ?? null;
}

export type StartChallengeResult = {
  ok: true;
  challengeId: string;
  deliveryStatus: 'sent' | 'failed' | 'skipped';
};

export async function startEmailChange(
  tmagId: string,
  newEmail: string,
): Promise<StartChallengeResult> {
  const code = mintNumericCode();
  const now = new Date();
  const issuedAt = now.toISOString();
  const expiresAt = new Date(now.getTime() + CHALLENGE_TTL_MS).toISOString();
  const challengeId = mintChallengeId();

  // Dispatch first so we can persist the actual outcome on the row.
  let deliveryStatus: 'sent' | 'failed' | 'skipped' = 'failed';
  let deliveryError: string | null = null;
  try {
    await sendEmail({
      to: newEmail,
      subject: 'Verify your new Team Magnificent email',
      text:
        `Your verification code is ${code}\n\n` +
        `This code expires in 15 minutes. ` +
        `If you didn't request this change, ignore this email.`,
    });
    deliveryStatus = 'sent';
  } catch (err) {
    if (err instanceof ResendConfigError) {
      deliveryStatus = 'skipped';
      deliveryError = err.message;
    } else if (err instanceof ResendError) {
      deliveryStatus = 'failed';
      deliveryError = err.message;
    } else {
      deliveryStatus = 'failed';
      deliveryError = err instanceof Error ? err.message : 'unknown';
    }
  }

  const record: McsProfileChangeChallengeRecord = {
    challengeId,
    tmagId,
    channel: 'email',
    target: newEmail,
    codeHash: hashCode(code),
    issuedAt,
    expiresAt,
    redeemedAt: null,
    deliveryStatus,
    deliveryError,
  };
  await persistChallenge(record);
  await stampPendingTarget(tmagId, 'email', newEmail);

  return { ok: true, challengeId, deliveryStatus };
}

/**
 * J.8 (Chat #147, seq 22): apply a phone change directly — NO SMS code.
 * The .team client gates this behind a confirm-your-input modal (restating the
 * number + why it matters), so by the time we're called the BA has explicitly
 * confirmed. Audited like any sensitive contact swap. pendingPhone is cleared
 * defensively in case a stale challenge row from the old flow lingers.
 *
 * Phone is not on the Neo4j BA node (registerBA only sets email/name/timezone),
 * so unlike email there's no graph update — Mongo + audit only.
 */
export async function setPhone(
  tmagId: string,
  newPhone: string,
): Promise<{ ok: true; phone: string } | { ok: false; error: 'ba_not_found' }> {
  const ba = await findBAByTmagId(tmagId);
  if (!ba) return { ok: false, error: 'ba_not_found' };

  const next = newPhone.trim();
  const before = { phone: ba.phone };
  const after = { phone: next };

  await persistenceCall('mongodb', 'update', {
    database: MONGO_DB,
    collection: BA_COLLECTION,
    filter: { tmagId },
    update: { $set: { phone: next, pendingPhone: null } },
  });

  await appendAuditEntry({
    actor: {
      kind: 'ba',
      tmagId,
      displayName: `${ba.firstName} ${ba.lastName}`.trim(),
    },
    action: 'ba.profile.phone_change',
    entity: {
      kind: 'brand_ambassador',
      id: tmagId,
      displayLabel: `${ba.firstName} ${ba.lastName}`.trim(),
    },
    severity: 'info',
    before,
    after,
  });

  return { ok: true, phone: next };
}

export type VerifyResult =
  | { ok: true; appliedTo: string }
  | { ok: false; error: 'no_pending_challenge' | 'code_invalid' | 'code_expired' };

async function verifyChallenge(
  tmagId: string,
  channel: 'email' | 'phone',
  code: string,
): Promise<VerifyResult> {
  const row = await findLatestActiveChallenge(tmagId, channel);
  if (!row) return { ok: false, error: 'no_pending_challenge' };

  const expiresAtMs = new Date(row.expiresAt).getTime();
  if (Number.isFinite(expiresAtMs) && expiresAtMs <= Date.now()) {
    return { ok: false, error: 'code_expired' };
  }

  if (hashCode(code) !== row.codeHash) {
    return { ok: false, error: 'code_invalid' };
  }

  const redeemedAt = new Date().toISOString();
  await persistenceCall('mongodb', 'update', {
    database: MONGO_DB,
    collection: CHALLENGES_COLLECTION,
    filter: { challengeId: row.challengeId, redeemedAt: null },
    update: { $set: { redeemedAt } },
  });

  return { ok: true, appliedTo: row.target };
}

export async function completeEmailChange(
  tmagId: string,
  code: string,
): Promise<VerifyResult> {
  const ba = await findBAByTmagId(tmagId);
  if (!ba) return { ok: false, error: 'no_pending_challenge' };

  const result = await verifyChallenge(tmagId, 'email', code);
  if (!result.ok) return result;

  const before = { email: ba.email };
  const after = { email: result.appliedTo };

  await persistenceCall('mongodb', 'update', {
    database: MONGO_DB,
    collection: BA_COLLECTION,
    filter: { tmagId },
    update: { $set: { email: result.appliedTo } },
  });
  // Keep Neo4j BA node email aligned (used by genealogy queries).
  await persistenceCall('neo4j', 'cypher', {
    query: 'MATCH (n:TeamMagnificentMember {tmagId: $tmagId}) SET n.email = $email',
    params: { tmagId, email: result.appliedTo },
  });
  await clearPendingTarget(tmagId, 'email');

  await appendAuditEntry({
    actor: {
      kind: 'ba',
      tmagId,
      displayName: `${ba.firstName} ${ba.lastName}`.trim(),
    },
    action: 'ba.profile.email_change',
    entity: {
      kind: 'brand_ambassador',
      id: tmagId,
      displayLabel: `${ba.firstName} ${ba.lastName}`.trim(),
    },
    severity: 'info',
    before,
    after,
  });

  return result;
}

// completePhoneChange REMOVED (Chat #147, seq 22): phone changes no longer use
// the SMS-code challenge. setPhone() applies the change directly after the
// client-side confirm modal. Email retains the two-step challenge above.
