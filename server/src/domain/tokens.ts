/**
 * Invite token domain.
 *
 * The opaque 12-character identifier in /p/{token}. Per COM Design Section
 * A.3 the URL carries nothing but the token — no names, no IDs, no slugs.
 *
 * Token format (Chat #104 locked):
 *   - 12 characters from the access-code alphabet (31 chars, no 0/1/I/O/L).
 *   - Same alphabet as TM-XXXX access codes for one convention across the
 *     system. ~10^18 combinations, plenty for invite scale.
 *
 * Lifecycle (locked-spec Part 3.7 + COM Design Section E.1):
 *   - minted -> clicked -> video_started -> video_quarter -> video_half ->
 *     video_three_quarter -> video_complete (placement happens here)
 *     -> callback_requested OR webinar_reserved -> enrolled.
 *   - expired when 8 weeks elapse from createdAt without enrollment.
 *
 * Sponsor immutability:
 *   - sponsorBaId stamped at mint, never recomputed (locked-spec Part 3.5).
 */

import { gatewayCall } from '../services/gateway.js';
import type { InviteTokenRecord, TokenState } from '@momentum/shared';

const MONGO_DB = 'momentum';
const TOKENS_COLLECTION = 'invite_tokens';

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

export async function findTokenRecord(token: string): Promise<InviteTokenRecord | null> {
  const result = await gatewayCall<{ documents: InviteTokenRecord[] }>('mongodb', 'query', {
    database: MONGO_DB,
    collection: TOKENS_COLLECTION,
    filter: { token },
    limit: 1,
  });
  const doc = result.documents[0];
  return doc ?? null;
}

/** True if 'now' (default Date.now()) is past the token's expiresAt. */
export function isTokenExpired(record: InviteTokenRecord, nowMs: number = Date.now()): boolean {
  return new Date(record.expiresAt).getTime() <= nowMs;
}

/** Terminal token states for which /p/{token} should not render the funnel UI. */
export const TERMINAL_TOKEN_STATES: ReadonlySet<TokenState> = new Set(['enrolled', 'expired']);
