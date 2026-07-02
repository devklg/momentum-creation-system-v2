/**
 * Prospect magic-link domain (locked-spec 3.17).
 *
 * The single-use, time-boxed credential a returning prospect uses to
 * re-enter their dashboard on `.com`.
 *
 * Window (Kevin, Chat #131): 60 minutes from issue. Long enough that
 * a prospect who reads the SMS late still gets in without re-requesting;
 * short enough that a leaked SMS (stale screenshot, over-the-shoulder
 * glimpse) doesn't grant an open-ended key. The link is single-use:
 * redeeming stamps redeemedAt and that row is dead forever — replay
 * returns "expired or already used".
 *
 * Multi-token fan-out (3.17):
 *   One phone can be tied to multiple active accounts (rare but legal —
 *   the same prospect invited by two different BAs). issueLinksForPhone
 *   issues one link per matching active account and sends one SMS per
 *   link. The prospect picks which dashboard. Auto-picking would
 *   silently bind a sponsor, violating 3.5.
 *
 * Channel protection (1.13):
 *   The SMS travels on the same Telnyx number the original invite was
 *   sent from. The prospect already trusts this channel; the magic link
 *   is the prospect-initiated continuation of that channel.
 *
 * Failure posture:
 *   - findAccountsByPhone returns 0 → no link rows written, no SMS sent;
 *     the route still returns the opaque success response (3.17 anti-
 *     probing rule).
 *   - Telnyx failure on any one SMS → that link row's smsDeliveryStatus
 *     stamps 'failed', the route still returns opaque success. The
 *     prospect can retry; rate-limit caps the per-phone retry rate
 *     in the route layer.
 *   - tripleStackWrite throws → bubble; the route returns 500. The
 *     prospect sees a soft "try again" message and the original
 *     /p/{token} URL stays as the fallback.
 */

import { randomBytes } from 'node:crypto';
import { gatewayCall } from '../services/gateway.js';
import { tripleStackWrite } from '../services/tripleStack.js';
import { sendSms, TelnyxConfigError, TelnyxError } from '../services/telnyx.js';
import {
  findAccountsByPhone,
  hashPhone,
  normalizePhone,
} from './prospectAccount.js';
import type { McsProspectMagicLinkRecord } from '@momentum/shared';

const MONGO_DB = 'momentum';
const MONGO_COLLECTION = 'tmag_prospect_magic_links';
const CHROMA_COLLECTION = 'tmag_prospect_magic_links';

/**
 * Click window: how long an issued link stays redeemable (Kevin,
 * Chat #131). Single source of truth — surface in env later if we
 * want to tune without a code change.
 */
export const MAGIC_LINK_WINDOW_MS = 60 * 60 * 1000;

/**
 * Link token character set + length. Distinct from the invite-token
 * alphabet on purpose — these tokens never appear in /p/{token} and
 * keeping the alphabets separate makes "is this a magic-link token
 * or an invite token?" trivial during debugging.
 *
 * 32 chars from a 62-char alphabet (a-zA-Z0-9) → 62^32 ≈ 2.3 * 10^57
 * combinations. Brute-force lookup is not a concern.
 */
const LINK_TOKEN_LEN = 32;

function randomLinkToken(): string {
  // randomBytes(24) gives 192 bits → 32 chars base64url after stripping
  // padding. Trim to exactly LINK_TOKEN_LEN.
  return randomBytes(24)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
    .slice(0, LINK_TOKEN_LEN);
}

/**
 * Build the SMS body sent to the prospect's phone. Compliance: this
 * is the FIRST system-initiated SMS to the prospect after the original
 * invite. No income claims, no urgency theater, no marketing copy —
 * a logistics line with the link. The prospect's BA's first name
 * grounds it in the BA-to-prospect relationship the prospect already
 * trusts.
 *
 * Format intentionally short — SMS preview-friendly, easy to recognize.
 */
function buildLoginSmsBody(args: {
  baFirstName: string;
  loginUrl: string;
}): string {
  return (
    `Your Team Magnificent re-entry link (from ${args.baFirstName}). ` +
    `Tap to open: ${args.loginUrl}`
  );
}

export interface IssueLinkResult {
  /** Link rows written + SMS dispatched (success OR failure). */
  attempted: number;
  /** Subset of attempted where the Telnyx send returned 2xx. */
  sent: number;
}

export interface IssueLinkInput {
  rawPhone: string;
  /**
   * Resolves a sponsor BA's first name for a given tmagId. The route
   * layer injects this so this domain stays decoupled from the BA
   * domain (avoids a circular import).
   */
  resolveBaFirstName: (tmagId: string) => Promise<string | null>;
  /**
   * Base URL the SMS link points at. The route builds this from
   * the request's Host header so dev / staging / prod all work
   * without an env-coupled constant.
   * Example: 'https://teammagnificent.com'
   */
  baseUrl: string;
}

/**
 * Issue magic links for every active account matching the phone.
 *
 * Returns counts only — the route layer is responsible for returning
 * the opaque success response regardless of whether attempted=0 or
 * attempted=N. Callers never reveal the count to the client.
 */
export async function issueLinksForPhone(
  input: IssueLinkInput,
): Promise<IssueLinkResult> {
  const phone = normalizePhone(input.rawPhone);
  if (!phone) {
    // Caller already returns opaque success for malformed input; this
    // is the defense-in-depth check. No accounts can match a phone
    // that didn't normalize.
    return { attempted: 0, sent: 0 };
  }

  const accounts = await findAccountsByPhone(phone);
  if (accounts.length === 0) {
    return { attempted: 0, sent: 0 };
  }

  const phoneHash = hashPhone(phone);
  const issuedAt = new Date().toISOString();
  const expiresAt = new Date(Date.now() + MAGIC_LINK_WINDOW_MS).toISOString();
  let sent = 0;

  for (const account of accounts) {
    const linkToken = randomLinkToken();
    const record: McsProspectMagicLinkRecord = {
      linkToken,
      accountId: account.accountId,
      tokenId: account.tokenId,
      issuedAt,
      expiresAt,
      redeemedAt: null,
      requestPhoneHash: phoneHash,
    };

    try {
      await tripleStackWrite({
        id: linkToken,
        mongoCollection: MONGO_COLLECTION,
        mongoDoc: {
          ...record,
          smsDeliveryStatus: 'queued' as const,
          smsDeliveryError: null,
        },
        neo4j: {
          cypher:
            'MERGE (ml:TmagProspectMagicLink {linkToken: $linkToken}) ' +
            'SET ml.accountId = $accountId, ' +
            '    ml.tokenId = $tokenId, ' +
            '    ml.issuedAt = $issuedAt, ' +
            '    ml.expiresAt = $expiresAt ' +
            'WITH ml ' +
            'MATCH (a:TmagProspectAccount {accountId: $accountId}) ' +
            'MERGE (ml)-[:ISSUED_FOR]->(a)',
          params: {
            linkToken,
            accountId: account.accountId,
            tokenId: account.tokenId,
            issuedAt,
            expiresAt,
          },
        },
        chroma: {
          collection: CHROMA_COLLECTION,
          document:
            `magic link issued for account ${account.accountId} ` +
            `(token ${account.tokenId}) · expires ${expiresAt}`,
          metadata: {
            kind: 'prospect_magic_link_issued',
            linkToken,
            accountId: account.accountId,
            tokenId: account.tokenId,
            phoneHash,
            issuedAt,
            expiresAt,
          },
        },
      });
    } catch (err) {
      // Persistence failed for this link row. Skip the SMS — sending
      // an SMS the system can't later resolve would be worse than
      // not sending. Continue to the next matching account.
      // eslint-disable-next-line no-console
      console.error(
        `[prospect-magic-link] tripleStackWrite failed for account ${account.accountId}:`,
        err instanceof Error ? err.message : err,
      );
      continue;
    }

    // Build the SMS body. Resolve the BA's first name so the prospect
    // recognizes which channel the link belongs to (matters most in
    // the multi-token case).
    let baFirstName = 'your sponsor';
    try {
      const resolved = await input.resolveBaFirstName(account.sponsorTmagId);
      if (resolved) baFirstName = resolved;
    } catch {
      // Fallback to the generic copy on lookup failure; not a blocker.
    }

    const loginUrl = `${input.baseUrl}/p/login/r/${linkToken}`;
    const smsBody = buildLoginSmsBody({ baFirstName, loginUrl });

    let smsDeliveryStatus: 'sent' | 'failed' = 'failed';
    let smsDeliveryError: string | null = null;

    try {
      await sendSms({ to: phone, text: smsBody });
      smsDeliveryStatus = 'sent';
      sent += 1;
    } catch (err) {
      if (err instanceof TelnyxConfigError || err instanceof TelnyxError) {
        smsDeliveryError = err.message;
      } else if (err instanceof Error) {
        smsDeliveryError = err.message;
      } else {
        smsDeliveryError = 'unknown_sms_failure';
      }
      // eslint-disable-next-line no-console
      console.error(
        `[prospect-magic-link ${linkToken}] SMS to prospect failed:`,
        smsDeliveryError,
      );
    }

    // Stamp the SMS outcome onto the link row.
    await gatewayCall('mongodb', 'update', {
      database: MONGO_DB,
      collection: MONGO_COLLECTION,
      filter: { linkToken },
      update: {
        $set: {
          smsDeliveryStatus,
          smsDeliveryError,
          smsDeliveredAt:
            smsDeliveryStatus === 'sent' ? new Date().toISOString() : null,
        },
      },
    });
  }

  return { attempted: accounts.length, sent };
}

export type RedeemResult =
  | { ok: true; accountId: string; tokenId: string }
  | { ok: false; error: 'invalid_link' | 'expired_link' | 'already_used' };

/**
 * Redeem a magic link. Validates TTL + not-already-redeemed, stamps
 * redeemedAt, and returns the accountId so the caller can open the
 * session and the tokenId so the client redirects to /p/{tokenId}.
 *
 * The three failure shapes are distinguishable here for telemetry,
 * but the route layer returns ONE generic "expired or already used"
 * response to the client — we never leak which specific case it was.
 */
export async function redeemLink(linkToken: string): Promise<RedeemResult> {
  if (
    typeof linkToken !== 'string' ||
    linkToken.length !== LINK_TOKEN_LEN ||
    !/^[A-Za-z0-9_-]+$/.test(linkToken)
  ) {
    return { ok: false, error: 'invalid_link' };
  }

  const result = await gatewayCall<{
    documents: Array<
      McsProspectMagicLinkRecord & {
        smsDeliveryStatus?: string;
        smsDeliveryError?: string | null;
      }
    >;
  }>('mongodb', 'query', {
    database: MONGO_DB,
    collection: MONGO_COLLECTION,
    filter: { linkToken },
    limit: 1,
  });
  const row = result.documents[0];
  if (!row) return { ok: false, error: 'invalid_link' };

  if (row.redeemedAt) return { ok: false, error: 'already_used' };

  const expiresAtMs = new Date(row.expiresAt).getTime();
  if (Number.isFinite(expiresAtMs) && expiresAtMs <= Date.now()) {
    return { ok: false, error: 'expired_link' };
  }

  // Stamp redeemedAt. Best-effort race protection: if another worker
  // races and the second update is a no-op, both responses still
  // resolve to the same account — single-use is preserved because
  // subsequent reads see redeemedAt non-null.
  const redeemedAt = new Date().toISOString();
  await gatewayCall('mongodb', 'update', {
    database: MONGO_DB,
    collection: MONGO_COLLECTION,
    filter: { linkToken, redeemedAt: null },
    update: { $set: { redeemedAt } },
  });

  // Re-read to confirm we won the race. If redeemedAt was already
  // stamped by a concurrent redeem, return already_used.
  const after = await gatewayCall<{ documents: McsProspectMagicLinkRecord[] }>(
    'mongodb',
    'query',
    {
      database: MONGO_DB,
      collection: MONGO_COLLECTION,
      filter: { linkToken },
      limit: 1,
    },
  );
  const post = after.documents[0];
  if (!post || post.redeemedAt !== redeemedAt) {
    return { ok: false, error: 'already_used' };
  }

  return { ok: true, accountId: row.accountId, tokenId: row.tokenId };
}

/**
 * Hash export so the route layer can rate-limit by phone without
 * touching prospectAccount internals directly. Convenience pass-through.
 */
export { hashPhone };

/**
 * Length and alphabet validation export so the redeem-side route
 * can do a cheap shape check before hitting the database.
 */
export const MAGIC_LINK_TOKEN_LEN = LINK_TOKEN_LEN;
