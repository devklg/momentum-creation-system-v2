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
 *   - Read-only (wf_0072): sponsor, threeBaId, tmBaId, accessCodeHeld.
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
 * J.8 is open — the conservative default chosen here is SMS code for phone
 * change (mirrors email re-verify). Kevin may amend later; if he does, the
 * phone-side route becomes a no-challenge direct patch and the verify
 * endpoint can be removed.
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
import { gatewayCall } from '../services/gateway.js';
import { appendAuditEntry } from './auditLog.js';
import { findBAByBaId } from './ba.js';
import { sendEmail, ResendConfigError, ResendError } from '../services/resend.js';
import { sendSms, TelnyxConfigError, TelnyxError } from '../services/telnyx.js';
import type {
  BAProfile,
  BAProfilePatch,
  BANotifPrefs,
  ProfileChangeChallengeRecord,
} from '@momentum/shared';
import { BA_NOTIF_DEFAULTS } from '@momentum/shared';

const MONGO_DB = 'momentum';
const BA_COLLECTION = 'brand_ambassadors';
const ACCESS_CODES_COLLECTION = 'access_codes';
const CHALLENGES_COLLECTION = 'profile_change_challenges';

/** 15 minutes — long enough for the user to switch apps and copy the code. */
const CHALLENGE_TTL_MS = 15 * 60 * 1000;

interface BAExtras {
  /** Photo URL added Chat #134; older records may not have it. */
  photoUrl?: string | null;
  notifPrefs?: BANotifPrefs;
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

function mergeNotifPrefs(stored: BANotifPrefs | undefined): BANotifPrefs {
  // Defensive merge: a stored record from a pre-#134 BA has no notifPrefs;
  // a record from a partial save may be missing a topic added later. Always
  // resolve to the full shape so the UI never has to defend against undef.
  if (!stored) return BA_NOTIF_DEFAULTS;
  return {
    callbackRequested: { ...BA_NOTIF_DEFAULTS.callbackRequested, ...(stored.callbackRequested ?? {}) },
    webinarReserved: { ...BA_NOTIF_DEFAULTS.webinarReserved, ...(stored.webinarReserved ?? {}) },
    newSponsoredBA: { ...BA_NOTIF_DEFAULTS.newSponsoredBA, ...(stored.newSponsoredBA ?? {}) },
    michaelComplete: { ...BA_NOTIF_DEFAULTS.michaelComplete, ...(stored.michaelComplete ?? {}) },
    poolMovement: { ...BA_NOTIF_DEFAULTS.poolMovement, ...(stored.poolMovement ?? {}) },
  };
}

async function findActiveCodeForBA(baId: string): Promise<string | null> {
  const r = await gatewayCall<{ documents: Array<{ code: string }> }>('mongodb', 'query', {
    database: MONGO_DB,
    collection: ACCESS_CODES_COLLECTION,
    filter: { sponsorBaId: baId, active: true },
    limit: 1,
  });
  return r.documents[0]?.code ?? null;
}

export async function getProfileForBA(baId: string): Promise<BAProfile | null> {
  const ba = await findBAByBaId(baId);
  if (!ba) return null;
  const extras = ba as typeof ba & BAExtras;

  const [accessCodeHeld, sponsor] = await Promise.all([
    findActiveCodeForBA(baId),
    ba.sponsorBaId ? findBAByBaId(ba.sponsorBaId) : Promise.resolve(null),
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
    tmBaId: ba.baId,
    threeBaId: ba.threeBaId,
    accessCodeHeld,
    sponsor: {
      baId: ba.sponsorBaId,
      threeBaId: ba.sponsorThreeBaId,
      fullName: sponsorFullName,
    },
    pendingEmail: extras.pendingEmail ?? null,
    pendingPhone: extras.pendingPhone ?? null,
  };
}

/**
 * Apply the patch to the BA record. Returns the fresh profile.
 *
 * Validation lives in the route layer (zod); this trusts the shape.
 * First/last name changes append an audit entry with before/after.
 */
export async function patchProfile(
  baId: string,
  patch: BAProfilePatch,
): Promise<BAProfile> {
  const current = await findBAByBaId(baId);
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
    set.notifPrefs = { ...existing, ...patch.notifPrefs } satisfies BANotifPrefs;
  }

  if (Object.keys(set).length > 0) {
    await gatewayCall('mongodb', 'update', {
      database: MONGO_DB,
      collection: BA_COLLECTION,
      filter: { baId },
      update: { $set: set },
    });

    // Keep the Neo4j BA node aligned for name changes — sponsor genealogy
    // queries surface firstName/lastName off the node.
    if (set.firstName !== undefined || set.lastName !== undefined) {
      const nextFirst = (set.firstName as string | undefined) ?? current.firstName;
      const nextLast = (set.lastName as string | undefined) ?? current.lastName;
      await gatewayCall('neo4j', 'cypher', {
        query:
          'MATCH (n:BA {baId: $baId}) SET n.firstName = $firstName, n.lastName = $lastName',
        params: { baId, firstName: nextFirst, lastName: nextLast },
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
        baId,
        displayName: `${current.firstName} ${current.lastName}`.trim(),
      },
      action: 'ba.profile.name_change',
      entity: {
        kind: 'brand_ambassador',
        id: baId,
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

  const next = await getProfileForBA(baId);
  if (!next) throw new Error('BA disappeared after patch');
  return next;
}

export type PasswordResult =
  | { ok: true }
  | { ok: false; error: 'current_password_wrong' };

export async function changePassword(
  baId: string,
  currentPassword: string,
  newPassword: string,
): Promise<PasswordResult> {
  const ba = await findBAByBaId(baId);
  if (!ba) return { ok: false, error: 'current_password_wrong' };

  let valid = false;
  try {
    valid = await argon2.verify(ba.passwordHash, currentPassword);
  } catch {
    valid = false;
  }
  if (!valid) return { ok: false, error: 'current_password_wrong' };

  const newHash = await argon2.hash(newPassword, { type: argon2.argon2id });
  await gatewayCall('mongodb', 'update', {
    database: MONGO_DB,
    collection: BA_COLLECTION,
    filter: { baId },
    update: { $set: { passwordHash: newHash } },
  });

  await appendAuditEntry({
    actor: {
      kind: 'ba',
      baId,
      displayName: `${ba.firstName} ${ba.lastName}`.trim(),
    },
    action: 'ba.profile.password_change',
    entity: {
      kind: 'brand_ambassador',
      id: baId,
      displayLabel: `${ba.firstName} ${ba.lastName}`.trim(),
    },
    severity: 'info',
    before: null,
    after: null,
  });

  return { ok: true };
}

/* ─── Challenge flow (email + phone) ─── */

async function persistChallenge(rec: ProfileChangeChallengeRecord): Promise<void> {
  await gatewayCall('mongodb', 'insert', {
    database: MONGO_DB,
    collection: CHALLENGES_COLLECTION,
    documents: [{ _id: rec.challengeId, ...rec }],
  });
}

async function stampPendingTarget(
  baId: string,
  channel: 'email' | 'phone',
  target: string,
): Promise<void> {
  const field = channel === 'email' ? 'pendingEmail' : 'pendingPhone';
  await gatewayCall('mongodb', 'update', {
    database: MONGO_DB,
    collection: BA_COLLECTION,
    filter: { baId },
    update: { $set: { [field]: target } },
  });
}

async function clearPendingTarget(
  baId: string,
  channel: 'email' | 'phone',
): Promise<void> {
  const field = channel === 'email' ? 'pendingEmail' : 'pendingPhone';
  await gatewayCall('mongodb', 'update', {
    database: MONGO_DB,
    collection: BA_COLLECTION,
    filter: { baId },
    update: { $set: { [field]: null } },
  });
}

async function findLatestActiveChallenge(
  baId: string,
  channel: 'email' | 'phone',
): Promise<ProfileChangeChallengeRecord | null> {
  const r = await gatewayCall<{ documents: ProfileChangeChallengeRecord[] }>(
    'mongodb',
    'query',
    {
      database: MONGO_DB,
      collection: CHALLENGES_COLLECTION,
      filter: { baId, channel, redeemedAt: null },
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
  baId: string,
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

  const record: ProfileChangeChallengeRecord = {
    challengeId,
    baId,
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
  await stampPendingTarget(baId, 'email', newEmail);

  return { ok: true, challengeId, deliveryStatus };
}

export async function startPhoneChange(
  baId: string,
  newPhone: string,
): Promise<StartChallengeResult> {
  const code = mintNumericCode();
  const now = new Date();
  const issuedAt = now.toISOString();
  const expiresAt = new Date(now.getTime() + CHALLENGE_TTL_MS).toISOString();
  const challengeId = mintChallengeId();

  let deliveryStatus: 'sent' | 'failed' | 'skipped' = 'failed';
  let deliveryError: string | null = null;
  try {
    await sendSms({
      to: newPhone,
      text:
        `Team Magnificent verification code: ${code}. ` +
        `Expires in 15 minutes. Reply STOP to opt out.`,
    });
    deliveryStatus = 'sent';
  } catch (err) {
    if (err instanceof TelnyxConfigError) {
      deliveryStatus = 'skipped';
      deliveryError = err.message;
    } else if (err instanceof TelnyxError) {
      deliveryStatus = 'failed';
      deliveryError = err.message;
    } else {
      deliveryStatus = 'failed';
      deliveryError = err instanceof Error ? err.message : 'unknown';
    }
  }

  const record: ProfileChangeChallengeRecord = {
    challengeId,
    baId,
    channel: 'phone',
    target: newPhone,
    codeHash: hashCode(code),
    issuedAt,
    expiresAt,
    redeemedAt: null,
    deliveryStatus,
    deliveryError,
  };
  await persistChallenge(record);
  await stampPendingTarget(baId, 'phone', newPhone);

  return { ok: true, challengeId, deliveryStatus };
}

export type VerifyResult =
  | { ok: true; appliedTo: string }
  | { ok: false; error: 'no_pending_challenge' | 'code_invalid' | 'code_expired' };

async function verifyChallenge(
  baId: string,
  channel: 'email' | 'phone',
  code: string,
): Promise<VerifyResult> {
  const row = await findLatestActiveChallenge(baId, channel);
  if (!row) return { ok: false, error: 'no_pending_challenge' };

  const expiresAtMs = new Date(row.expiresAt).getTime();
  if (Number.isFinite(expiresAtMs) && expiresAtMs <= Date.now()) {
    return { ok: false, error: 'code_expired' };
  }

  if (hashCode(code) !== row.codeHash) {
    return { ok: false, error: 'code_invalid' };
  }

  const redeemedAt = new Date().toISOString();
  await gatewayCall('mongodb', 'update', {
    database: MONGO_DB,
    collection: CHALLENGES_COLLECTION,
    filter: { challengeId: row.challengeId, redeemedAt: null },
    update: { $set: { redeemedAt } },
  });

  return { ok: true, appliedTo: row.target };
}

export async function completeEmailChange(
  baId: string,
  code: string,
): Promise<VerifyResult> {
  const ba = await findBAByBaId(baId);
  if (!ba) return { ok: false, error: 'no_pending_challenge' };

  const result = await verifyChallenge(baId, 'email', code);
  if (!result.ok) return result;

  const before = { email: ba.email };
  const after = { email: result.appliedTo };

  await gatewayCall('mongodb', 'update', {
    database: MONGO_DB,
    collection: BA_COLLECTION,
    filter: { baId },
    update: { $set: { email: result.appliedTo } },
  });
  // Keep Neo4j BA node email aligned (used by genealogy queries).
  await gatewayCall('neo4j', 'cypher', {
    query: 'MATCH (n:BA {baId: $baId}) SET n.email = $email',
    params: { baId, email: result.appliedTo },
  });
  await clearPendingTarget(baId, 'email');

  await appendAuditEntry({
    actor: {
      kind: 'ba',
      baId,
      displayName: `${ba.firstName} ${ba.lastName}`.trim(),
    },
    action: 'ba.profile.email_change',
    entity: {
      kind: 'brand_ambassador',
      id: baId,
      displayLabel: `${ba.firstName} ${ba.lastName}`.trim(),
    },
    severity: 'info',
    before,
    after,
  });

  return result;
}

export async function completePhoneChange(
  baId: string,
  code: string,
): Promise<VerifyResult> {
  const ba = await findBAByBaId(baId);
  if (!ba) return { ok: false, error: 'no_pending_challenge' };

  const result = await verifyChallenge(baId, 'phone', code);
  if (!result.ok) return result;

  const before = { phone: ba.phone };
  const after = { phone: result.appliedTo };

  await gatewayCall('mongodb', 'update', {
    database: MONGO_DB,
    collection: BA_COLLECTION,
    filter: { baId },
    update: { $set: { phone: result.appliedTo } },
  });
  await clearPendingTarget(baId, 'phone');

  await appendAuditEntry({
    actor: {
      kind: 'ba',
      baId,
      displayName: `${ba.firstName} ${ba.lastName}`.trim(),
    },
    action: 'ba.profile.phone_change',
    entity: {
      kind: 'brand_ambassador',
      id: baId,
      displayLabel: `${ba.firstName} ${ba.lastName}`.trim(),
    },
    severity: 'info',
    before,
    after,
  });

  return result;
}
