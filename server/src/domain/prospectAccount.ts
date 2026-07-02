/**
 * Prospect account domain (locked-spec 3.17).
 *
 * The temporary, scoped account that gives a prospect durable
 * re-entry to their OWN /p/{token} surface. Closes Chat #125's
 * prospect-re-entry open question.
 *
 * Lifecycle:
 *   1. Created in the placement path at video_complete (called from
 *      routes/p.ts after placeProspect returns). Phone is null.
 *      Triple-stack write: Mongo + Neo4j + Chroma.
 *   2. Phone is attached ONLY when the prospect submits a callback
 *      intent on dashboard Section 6. That submission is the consent
 *      signal to copy prospects.phone into the account row. Webinar
 *      reservation is NOT a consent signal (Kevin, Chat #131) — it's
 *      logistics for a Zoom call, not opt-in for SMS magic links.
 *      The BA→prospect SMS channel is already established by the
 *      original invite, so the magic link travels on the same channel
 *      (1.13 channel protection) once the prospect has explicitly
 *      asked the BA to reach out.
 *   3. Expires at the same 8-week flush boundary as the invite token
 *      (3.7). A future flush sweep should call deleteAccountByTokenId
 *      as part of the flush operation. The lazy-flush read path on
 *      /p/{token} handles token-side expiry today; the account-side
 *      cleanup will piggyback whenever the cron-based flush ships.
 *
 * Sponsor immutability (3.5):
 *   sponsorTmagId is stamped from the invite token at row creation
 *   and is NEVER recomputed or overwritten — re-entry by phone
 *   resolves back to the ORIGINAL inviting BA, never a different one.
 *   No route accepts sponsorTmagId as input.
 *
 * Multi-token edge case (3.17):
 *   A single phone may be tied to more than one active account if
 *   the same person was invited by two different BAs. findAccountsByPhone
 *   returns every active match — the magic-link layer fans out one SMS
 *   per match so the prospect picks. Auto-picking would silently bind
 *   a sponsor, violating 3.5.
 */

import { createHash, randomUUID } from 'node:crypto';
import { gatewayCall } from '../services/gateway.js';
import { tripleStackWrite } from '../services/tripleStack.js';
import type {
  McsIsoTimestamp,
  McsProspectAccountRecord,
} from '@momentum/shared';

const MONGO_DB = 'momentum';
const MONGO_COLLECTION = 'tmag_prospect_htank_accounts';
const CHROMA_COLLECTION = 'tmag_prospect_htank_accounts';

export interface CreateProspectAccountInput {
  prospectId: string;
  tokenId: string;
  sponsorTmagId: string;
  /** BA-supplied phone, set at mint (#148). Optional only so the legacy
   *  idempotent video-complete call site still type-checks. */
  phone?: string | null;
  /** App-generated re-entry code, set at mint (#148). */
  reentryCode?: string;
  /**
   * Token's expiresAt — copied onto the account so the magic-link
   * layer and any future flush sweep can find expired rows without
   * a join back to invite_tokens.
   */
  tokenExpiresAt: McsIsoTimestamp;
}

/**
 * SHA-256 hex of a normalized phone string. Used as the rate-limit
 * audit key on prospect_magic_links so the same phone hitting
 * /p/login/start repeatedly can be detected without storing the raw
 * phone twice across collections.
 */
export function hashPhone(e164: string): string {
  return createHash('sha256').update(e164).digest('hex');
}

/**
 * Normalize a caller-supplied phone string to E.164 (e.g. '+13235551234').
 * Conservative: returns null on anything ambiguous. Mirrors the rules
 * in routes/p.ts so /p/login/start and the F.2 expired view stay in
 * lockstep on what "the same phone" means.
 *
 *   - Strip everything except digits and a leading '+'.
 *   - If input starts with '+', keep as-is after digit-only strip.
 *   - 10 digits → assume NANP, prepend '+1'.
 *   - 11 digits starting with '1' → prepend '+'.
 *   - Anything else → null.
 */
export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('+')) {
    const digits = trimmed.slice(1).replace(/\D/g, '');
    if (digits.length < 8 || digits.length > 15) return null;
    return `+${digits}`;
  }
  const digits = trimmed.replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  return null;
}

/**
 * Idempotent lookup: if an account already exists for this tokenId,
 * return it without writing. The placement path is itself idempotent
 * on prospectId (holdingTank.placeProspect), so this matches that
 * contract — a replayed video_complete event must not mint a
 * duplicate account row.
 */
export async function findAccountByTokenId(
  tokenId: string,
): Promise<McsProspectAccountRecord | null> {
  const result = await gatewayCall<{ documents: McsProspectAccountRecord[] }>(
    'mongodb',
    'query',
    {
      database: MONGO_DB,
      collection: MONGO_COLLECTION,
      filter: { tokenId },
      limit: 1,
    },
  );
  return result.documents[0] ?? null;
}

/**
 * Find every active account whose phone matches. "Active" means
 * expiresAt is in the future and phone is not null. The phone
 * lookup is exact on the stored E.164 string — callers must
 * normalize first.
 *
 * Multi-row return is intentional per 3.17 — the magic-link layer
 * sends one SMS per row so the prospect picks which dashboard.
 */
export async function findAccountsByPhone(
  e164: string,
  nowMs: number = Date.now(),
): Promise<McsProspectAccountRecord[]> {
  const result = await gatewayCall<{ documents: McsProspectAccountRecord[] }>(
    'mongodb',
    'query',
    {
      database: MONGO_DB,
      collection: MONGO_COLLECTION,
      filter: {
        phone: e164,
        expiresAt: { $gt: new Date(nowMs).toISOString() },
      },
      limit: 16,
    },
  );
  return result.documents ?? [];
}

/**
 * Look up an account by its accountId. Used by the redeem path
 * after the magic-link row resolves to an accountId.
 */
export async function findAccountById(
  accountId: string,
): Promise<McsProspectAccountRecord | null> {
  const result = await gatewayCall<{ documents: McsProspectAccountRecord[] }>(
    'mongodb',
    'query',
    {
      database: MONGO_DB,
      collection: MONGO_COLLECTION,
      filter: { accountId },
      limit: 1,
    },
  );
  return result.documents[0] ?? null;
}

/**
 * Create the account row. Called from holdingTank.placeProspect
 * after the placement triple-stack write commits. Idempotent on
 * tokenId.
 *
 * Phone is intentionally null at creation. The consent-signal path
 * (callbackRequest / webinarReservation) attaches it later via
 * attachPhoneOnConsent.
 */
/**
 * Login validation (#148): find an active account matching phone + reentry
 * code. Exact match on normalized E.164 phone and the stored code. Returns
 * the single account or null. Used by POST /api/p/login/code.
 */
export async function findAccountByPhoneAndCode(
  e164: string,
  code: string,
  nowMs: number = Date.now(),
): Promise<McsProspectAccountRecord | null> {
  const result = await gatewayCall<{ documents: McsProspectAccountRecord[] }>(
    'mongodb',
    'query',
    {
      database: MONGO_DB,
      collection: MONGO_COLLECTION,
      filter: {
        phone: e164,
        reentryCode: code,
        expiresAt: { $gt: new Date(nowMs).toISOString() },
      },
      limit: 1,
    },
  );
  return result.documents[0] ?? null;
}

export async function createProspectAccount(
  input: CreateProspectAccountInput,
): Promise<McsProspectAccountRecord> {
  // Idempotency check — replayed video_complete must not mint a duplicate.
  const existing = await findAccountByTokenId(input.tokenId);
  if (existing) return existing;

  const accountId = `pacct_${randomUUID()}`;
  const createdAt = new Date().toISOString();

  const record: McsProspectAccountRecord = {
    accountId,
    prospectId: input.prospectId,
    tokenId: input.tokenId,
    sponsorTmagId: input.sponsorTmagId,
    phone: input.phone ?? null,
    reentryCode: input.reentryCode ?? '',
    createdAt,
    expiresAt: input.tokenExpiresAt,
    lastLoginAt: null,
  };

  try {
    await tripleStackWrite({
      id: accountId,
      mongoCollection: MONGO_COLLECTION,
      mongoDoc: { ...record },
      neo4j: {
        cypher:
          'MERGE (a:TmagProspectAccount {accountId: $accountId}) ' +
          'SET a.prospectId = $prospectId, ' +
          '    a.tokenId = $tokenId, ' +
          '    a.sponsorTmagId = $sponsorTmagId, ' +
          '    a.createdAt = $createdAt, ' +
          '    a.expiresAt = $expiresAt ' +
          'MERGE (t:TmagInviteToken {token: $tokenId}) ' +
          'MERGE (a)-[:KEYS]->(t) ' +
          'MERGE (b:TeamMagnificentMember {tmagId: $sponsorTmagId}) ' +
          'MERGE (a)-[:SPONSORED_BY]->(b)',
        params: {
          accountId,
          prospectId: input.prospectId,
          tokenId: input.tokenId,
          sponsorTmagId: input.sponsorTmagId,
          createdAt,
          expiresAt: input.tokenExpiresAt,
        },
      },
      chroma: {
        collection: CHROMA_COLLECTION,
        document:
          `prospect account created for prospect ${input.prospectId} ` +
          `(token ${input.tokenId}) · sponsor ${input.sponsorTmagId} ` +
          `· expires ${input.tokenExpiresAt}`,
        metadata: {
          kind: 'prospect_account_created',
          accountId,
          prospectId: input.prospectId,
          tokenId: input.tokenId,
          sponsorTmagId: input.sponsorTmagId,
          createdAt,
          expiresAt: input.tokenExpiresAt,
        },
      },
    });
  } catch (err) {
    // Concurrent placement won the race — return the persisted row.
    const winner = await findAccountByTokenId(input.tokenId);
    if (winner) return winner;
    throw err;
  }

  return record;
}

/**
 * Attach a phone to the account row for this token. Called from the
 * callback-request route after createCallbackRequest commits.
 * Webinar reservation does NOT call this — webinar is logistics, not
 * SMS consent (Kevin, Chat #131).
 *
 * Idempotent: if phone is already set to the same value, no-op.
 * If a different phone is recorded, the new value wins — the most
 * recent prospect-initiated consent reflects the current channel
 * the BA has for them.
 *
 * Scope: only the account row whose tokenId matches the consenting
 * token. A prospect with multiple tokens (rare) gets phone attached
 * per-token as each token's consent signal fires — preserves the
 * per-token sponsor binding (3.5).
 *
 * The callback form lives on dashboard Section 6 (Your Next Move).
 * Section 6 only renders post-placement, so by the time this is
 * called the account row is guaranteed to exist — the "no account
 * yet" branch below is defense-in-depth but should not fire in
 * practice. (The presentation page's former QuietDoor callback form
 * was replaced Chat #126 by the no-form WhatsNext bridge.)
 */
export async function attachPhoneOnConsent(
  tokenId: string,
  rawPhone: string,
): Promise<void> {
  const phone = normalizePhone(rawPhone);
  if (!phone) {
    // eslint-disable-next-line no-console
    console.warn(
      `[prospectAccount] attachPhoneOnConsent: phone failed normalization for token ${tokenId}`,
    );
    return;
  }
  const account = await findAccountByTokenId(tokenId);
  if (!account) {
    // Defense-in-depth: post-Chat-#126 both consent signals live on
    // dashboard Section 6 which only renders post-placement, so this
    // branch should not fire in practice. If it does (e.g. an
    // out-of-order replay), no-op silently — a later consent signal
    // after the account exists will attach phone.
    return;
  }
  if (account.phone === phone) return; // idempotent no-op
  await gatewayCall('mongodb', 'update', {
    database: MONGO_DB,
    collection: MONGO_COLLECTION,
    filter: { accountId: account.accountId },
    update: {
      $set: {
        phone,
        phoneAttachedAt: new Date().toISOString(),
      },
    },
  });
}

/**
 * Stamp lastLoginAt on the account. Called from the redeem path
 * after the magic-link row redeems cleanly and the session opens.
 * Best-effort — failure does not block the session.
 */
export async function recordLogin(accountId: string): Promise<void> {
  try {
    await gatewayCall('mongodb', 'update', {
      database: MONGO_DB,
      collection: MONGO_COLLECTION,
      filter: { accountId },
      update: { $set: { lastLoginAt: new Date().toISOString() } },
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(
      `[prospectAccount] recordLogin failed for ${accountId}:`,
      err instanceof Error ? err.message : err,
    );
  }
}

/**
 * Delete the account row. Reserved for a future 8-week flush sweep
 * (3.7). Not wired today because the cron-based flush is deferred —
 * the lazy-flush read path on /p/{token} handles token-side expiry
 * inline. This function is the matching account-side cleanup, ready
 * when the sweep ships.
 */
export async function deleteAccountByTokenId(tokenId: string): Promise<void> {
  await gatewayCall('mongodb', 'delete', {
    database: MONGO_DB,
    collection: MONGO_COLLECTION,
    filter: { tokenId },
  });
}
