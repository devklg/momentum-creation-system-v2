/**
 * Invite token domain.
 *
 * The opaque 12-character identifier in /p/{token}. Per COM Design Section
 * A.3 the URL carries nothing but the token — no names, no IDs, no slugs.
 *
 * Token format (Chat #104 locked):
 *   - 12 characters from the access-code alphabet (31 chars, no 0/1/I/O/L).
 *   - Same alphabet as TMAG-XXXX access codes for one convention across the
 *     system. ~10^18 combinations, plenty for invite scale.
 *
 * Lifecycle (locked-spec Part 3.7 + COM Design Section E.1):
 *   - minted -> clicked -> video_started -> video_quarter -> video_half ->
 *     video_three_quarter -> video_complete (placement happens here)
 *     -> enrolled.
 *   - expired when 8 weeks elapse from createdAt without enrollment.
 *   - Note: callback_requested and webinar_reserved are NOT lifecycle
 *     states (Chat #105 spec amendment); they are independent intent
 *     records that may co-exist after placement.
 *
 * Sponsor immutability:
 *   - sponsorTmagId stamped at mint, never recomputed (locked-spec Part 3.5).
 */

import { gatewayCall } from '../services/gateway.js';
import type { McsInviteTokenRecord, McsTokenState } from '@momentum/shared';

const MONGO_DB = 'momentum';
const TOKENS_COLLECTION = 'tmag_prospect_invite_tokens';

const ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
const TOKEN_LEN = 12;
const MAX_GEN_ATTEMPTS = 8;

/** 8-week consideration window per locked-spec Part 3.7. */
export const TOKEN_TTL_MS = 8 * 7 * 24 * 60 * 60 * 1000;

function randomToken(): string {
  let out = '';
  for (let i = 0; i < TOKEN_LEN; i++) {
    out += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return out;
}

async function tokenExists(token: string): Promise<boolean> {
  const result = await gatewayCall<{ count?: number; documents?: unknown[] }>('mongodb', 'query', {
    database: MONGO_DB,
    collection: TOKENS_COLLECTION,
    filter: { token },
    limit: 1,
  });
  return (result.count ?? result.documents?.length ?? 0) > 0;
}

/** Generate a unique 12-character token. Retries on collision. */
export async function mintUniqueToken(): Promise<string> {
  for (let attempt = 0; attempt < MAX_GEN_ATTEMPTS; attempt++) {
    const candidate = randomToken();
    if (!(await tokenExists(candidate))) return candidate;
  }
  throw new Error('token_generation_exhausted');
}

export async function findTokenRecord(token: string): Promise<McsInviteTokenRecord | null> {
  const result = await gatewayCall<{ documents: McsInviteTokenRecord[] }>('mongodb', 'query', {
    database: MONGO_DB,
    collection: TOKENS_COLLECTION,
    filter: { token },
    limit: 1,
  });
  const doc = result.documents[0];
  return doc ?? null;
}

/** True if 'now' (default Date.now()) is past the token's expiresAt. */
export function isTokenExpired(record: McsInviteTokenRecord, nowMs: number = Date.now()): boolean {
  return new Date(record.expiresAt).getTime() <= nowMs;
}

/** Terminal token states for which /p/{token} should not render the funnel UI. */
export const TERMINAL_TOKEN_STATES: ReadonlySet<McsTokenState> = new Set(['enrolled', 'expired']);

/**
 * Forward ordering of token lifecycle states. Used by transitionTokenState
 * to enforce the never-go-backward rule (Chat #105 lock): a 'video_complete'
 * token receiving a 'video_started' event must NOT regress.
 *
 * Order matches COM Design Section E.1 and locked-spec Part 3.7.
 *
 * Note: callback_requested and webinar_reserved are NOT lifecycle states.
 * They are independent intent records that may co-exist for the same
 * prospect after placement; see domain/callbackRequest.ts and
 * domain/webinarReservation.ts (Chat #109).
 */
const STATE_ORDER: Record<McsTokenState, number> = {
  minted: 0,
  clicked: 1,
  video_started: 2,
  video_quarter: 3,
  video_half: 4,
  video_three_quarter: 5,
  video_complete: 6,
  enrolled: 7,
  expired: 99,
};

export function isForwardTransition(from: McsTokenState, to: McsTokenState): boolean {
  // 'expired' is terminal regardless of forward order.
  if (from === 'expired') return false;
  return STATE_ORDER[to] > STATE_ORDER[from];
}

/**
 * Set the token's state to `next` if and only if it is forward of the
 * current state. Idempotent: receiving the same state twice is a no-op.
 * Replaying a stale state is also a no-op (the YouTube IFrame can re-fire
 * earlier milestones; we do not regress).
 *
 * Returns the effective state after the call: either `next` (forward
 * transition applied) or the unchanged current state.
 */
export async function transitionTokenState(
  token: string,
  next: McsTokenState,
): Promise<{ state: McsTokenState; changed: boolean }> {
  const record = await findTokenRecord(token);
  if (!record) throw new Error('token_not_found');

  if (!isForwardTransition(record.state, next)) {
    return { state: record.state, changed: false };
  }

  await gatewayCall('mongodb', 'update', {
    database: MONGO_DB,
    collection: TOKENS_COLLECTION,
    filter: { token },
    update: { $set: { state: next, updatedAt: new Date().toISOString() } },
  });

  return { state: next, changed: true };
}

/**
 * Stamp the first prospect-facing open for PMV/click visibility.
 *
 * GET /p/{token} is the open signal: the prospect resolved the link. We set
 * clickedAt once and advance minted -> clicked when that is still the forward
 * lifecycle move. Later video states keep their higher state but still get a
 * backfilled clickedAt if legacy rows are missing it.
 */
export async function markTokenOpened(
  token: string,
): Promise<{ state: McsTokenState; clickedAt: string; changed: boolean }> {
  const record = await findTokenRecord(token);
  if (!record) throw new Error('token_not_found');

  const clickedAt = record.clickedAt ?? new Date().toISOString();
  const shouldAdvanceState = isForwardTransition(record.state, 'clicked');
  const shouldStampClick = record.clickedAt === null;

  if (!shouldAdvanceState && !shouldStampClick) {
    return { state: record.state, clickedAt, changed: false };
  }

  const set: Partial<McsInviteTokenRecord> & { updatedAt: string } = {
    updatedAt: clickedAt,
  };
  if (shouldStampClick) set.clickedAt = clickedAt;
  if (shouldAdvanceState) set.state = 'clicked';

  await gatewayCall('mongodb', 'update', {
    database: MONGO_DB,
    collection: TOKENS_COLLECTION,
    filter: { token },
    update: { $set: set },
  });

  return {
    state: shouldAdvanceState ? 'clicked' : record.state,
    clickedAt,
    changed: true,
  };
}

