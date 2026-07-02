/**
 * Access codes domain (TMAG-XXXX).
 *
 * Locked Chat #94: width = TMAG-XXXX (4 chars, ~1.6M codes).
 * Per Signup Architecture Section D:
 *   - Pattern: TMAG-XXXX where XXXX is uppercase alphanumeric.
 *   - Generation is admin-only; code is assigned to a single BA at mint.
 *   - First use does NOT consume the code — it stays active for the BA's
 *     entire downline.
 *   - One code per BA. Codes are not transferable.
 *   - Owner is set at generation and never changes.
 *
 * Generation strategy:
 *   - Excludes confusing chars (0/O, 1/I, L). 32-char alphabet, 4 positions =
 *     1,048,576 candidates. Collision check on mint; retry up to 8 times.
 *   - TM-XX (Kevin TM-01, Paul TM-07 etc.) seeded outside this generator;
 *     this generator produces fresh codes for new BAs going forward.
 */

import { gatewayCall } from '../services/gateway.js';
import { tripleStackWrite } from '../services/tripleStack.js';
import type { AccessCodeRecord } from './access-codes.js';

const ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ'; // 31 chars (no 0,1,I,O,L)
const CODE_LEN = 4;
const MAX_GEN_ATTEMPTS = 8;

function randomCode(): string {
  let out = 'TMAG-';
  for (let i = 0; i < CODE_LEN; i++) {
    out += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return out;
}

async function codeExists(code: string): Promise<boolean> {
  const result = await gatewayCall<{ count: number }>('mongodb', 'query', {
    database: 'momentum',
    collection: 'tmag_access_codes',
    filter: { code },
    limit: 1,
  });
  return result.count > 0;
}

export async function baOwnsACode(tmagId: string): Promise<AccessCodeRecord | null> {
  const result = await gatewayCall<{ documents: AccessCodeRecord[] }>('mongodb', 'query', {
    database: 'momentum',
    collection: 'tmag_access_codes',
    filter: { sponsorTmagId: tmagId, active: true },
    limit: 1,
  });
  return result.documents.length > 0 ? result.documents[0] ?? null : null;
}

export interface MintAccessCodeInput {
  sponsorTmagId: string;
  sponsorThreeBaId: string;
  sponsorFirstName: string;
  sponsorLastName: string;
  note?: string;
  mintedByTmagId: string;
  /** Optional explicit code (e.g. for seeding TM-01, TM-07). Must be unique. */
  explicit?: string;
}

export async function mintAccessCode(
  input: MintAccessCodeInput,
): Promise<AccessCodeRecord> {
  // Enforce "one code per BA" — if this BA already owns an active code, return it.
  const existing = await baOwnsACode(input.sponsorTmagId);
  if (existing) {
    return existing;
  }

  let code: string | null = null;
  if (input.explicit) {
    const ex = input.explicit.trim().toUpperCase();
    if (!/^TMAG-[A-Z0-9-]{2,8}$/.test(ex)) {
      throw new Error(`Invalid explicit code shape: ${ex}`);
    }
    if (await codeExists(ex)) {
      throw new Error(`Explicit code ${ex} already exists.`);
    }
    code = ex;
  } else {
    for (let attempt = 0; attempt < MAX_GEN_ATTEMPTS; attempt++) {
      const candidate = randomCode();
      if (!(await codeExists(candidate))) {
        code = candidate;
        break;
      }
    }
    if (!code) {
      throw new Error('Could not mint a unique access code after retries.');
    }
  }

  const createdAt = new Date().toISOString();
  const record: AccessCodeRecord = {
    _id: code,
    code,
    sponsorTmagId: input.sponsorTmagId,
    sponsorThreeBaId: input.sponsorThreeBaId,
    sponsorFirstName: input.sponsorFirstName,
    sponsorLastName: input.sponsorLastName,
    active: true,
    createdAt,
  };

  await tripleStackWrite({
    id: code,
    mongoCollection: 'tmag_access_codes',
    mongoDoc: { ...record, note: input.note ?? null, mintedByTmagId: input.mintedByTmagId },
    neo4j: {
      // The owning BA may or may not exist yet in our graph (early seeds);
      // MERGE makes both edge endpoints safe.
      cypher:
        'MERGE (b:TeamMagnificentMember {tmagId: $sponsorTmagId}) ' +
        'MERGE (c:TmagAccessCode {code: $id}) ' +
        'SET c.active = true, c.createdAt = $createdAt, c.sponsorThreeBaId = $sponsorThreeBaId ' +
        'MERGE (b)-[:USES]->(c)',
      params: {
        sponsorTmagId: input.sponsorTmagId,
        sponsorThreeBaId: input.sponsorThreeBaId,
        createdAt,
      },
    },
    chroma: {
      collection: 'mcs_access_codes',
      document: `Access code ${code} minted ${createdAt}, assigned to ${input.sponsorFirstName} ${input.sponsorLastName} (BA ${input.sponsorTmagId} / THREE ${input.sponsorThreeBaId}). ${input.note ?? ''}`.trim(),
      metadata: {
        code,
        sponsorTmagId: input.sponsorTmagId,
        sponsorThreeBaId: input.sponsorThreeBaId,
        kind: 'access_code',
        createdAt,
      },
    },
  });

  return record;
}

export interface AccessCodeListItem {
  code: string;
  sponsorTmagId: string;
  sponsorThreeBaId: string;
  sponsorFirstName: string;
  sponsorLastName: string;
  active: boolean;
  createdAt: string;
  note?: string | null;
}

export async function listAccessCodes(
  limit = 100,
): Promise<AccessCodeListItem[]> {
  const result = await gatewayCall<{ documents: AccessCodeListItem[] }>('mongodb', 'query', {
    database: 'momentum',
    collection: 'tmag_access_codes',
    filter: {},
    sort: { createdAt: -1 },
    limit,
  });
  return result.documents ?? [];
}
