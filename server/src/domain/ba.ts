/**
 * BA registration domain. Triple-stack writes the new BA record.
 * Sponsor link in Neo4j is the second source of truth (independent of THREE's genealogy).
 */

import argon2 from 'argon2';
import { tripleStackWrite } from '../services/tripleStack.js';
import { gatewayCall } from '../services/gateway.js';
import type { AccessCodeRecord } from './access-codes.js';

export interface NewBAInput {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  threeUsername: string;
  threeBaId: string;
  passwordPlain: string;
  /**
   * IANA timezone name (e.g. "America/Los_Angeles"). Captured from the
   * browser at signup via Intl.DateTimeFormat().resolvedOptions().timeZone.
   * Required by Michael's slot generator (08:00-21:45 BA local time).
   */
  timezone: string;
}

export interface BARecord {
  baId: string;
  threeBaId: string;
  threeUsername: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  /** IANA timezone (e.g. "America/Los_Angeles"). Drives Michael scheduling. */
  timezone: string;
  passwordHash: string;
  sponsorBaId: string;
  sponsorThreeBaId: string;
  accessCodeUsed: string;
  createdAt: string;
  /**
   * Most recent successful login timestamp (ISO 8601). Null until the BA
   * has logged in for the first time. Used by team-stats to compute
   * "BAs active in last 24h" — active = logged into .team in the last
   * 24 hours (Chat #115 decision). Stamped by POST /api/auth/login on
   * every successful credential verification.
   */
  lastLoginAt: string | null;
}

function mintBaId(): string {
  // Format: TM-YYYYMMDD-<6 random alphanum>. Stable, sortable, easy to read.
  const now = new Date();
  const ymd = now.toISOString().slice(0, 10).replace(/-/g, '');
  const r = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `TMBA-${ymd}-${r}`;
}

export async function emailExists(email: string): Promise<boolean> {
  const result = await gatewayCall<{ count: number }>('mongodb', 'query', {
    database: 'momentum',
    collection: 'brand_ambassadors',
    filter: { email },
    limit: 1,
  });
  return result.count > 0;
}

export async function threeBaIdExists(threeBaId: string): Promise<boolean> {
  const result = await gatewayCall<{ count: number }>('mongodb', 'query', {
    database: 'momentum',
    collection: 'brand_ambassadors',
    filter: { threeBaId },
    limit: 1,
  });
  return result.count > 0;
}

/**
 * Look up a BA by TM BA ID. The TM BA ID is the only login identifier in the
 * system (locked Chat #102). THREE BA ID and email live on the record but
 * never resolve to a session.
 */
export async function findBAByBaId(baId: string): Promise<BARecord | null> {
  const result = await gatewayCall<{ documents: BARecord[] }>('mongodb', 'query', {
    database: 'momentum',
    collection: 'brand_ambassadors',
    filter: { baId },
    limit: 1,
  });
  return result.documents.length > 0 ? result.documents[0] ?? null : null;
}

/**
 * Stamp the BA's most recent successful login. Called by POST /api/auth/login
 * AFTER credential verification succeeds; never on failed attempts. Used by
 * team-stats to compute "BAs active in last 24h" (Chat #115 decision —
 * active = logged into .team in the last 24h).
 *
 * Best-effort: a failure here must NOT block the login response. If the
 * Mongo write fails the user is still authenticated; the stat is just
 * slightly less accurate for that BA until their next login.
 */
export async function recordLogin(baId: string): Promise<void> {
  const at = new Date().toISOString();
  try {
    await gatewayCall('mongodb', 'update', {
      database: 'momentum',
      collection: 'brand_ambassadors',
      filter: { baId },
      update: { $set: { lastLoginAt: at } },
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[recordLogin] best-effort update failed', { baId, err });
  }
}

/**
 * Admin-only flat BA list. Returns the entire roster in reverse-chronological
 * order, joined with sponsor name. No genealogy traversal — that lives in
 * THREE. This is the operational mirror per ADMIN Design Section C.
 */
export interface BAListItem {
  baId: string;
  threeBaId: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  timezone: string | null;
  sponsorBaId: string | null;
  sponsorName: string | null;
  joinedAt: string;
}

export async function listAllBAsForAdmin(limit = 500): Promise<BAListItem[]> {
  const raw = await gatewayCall<{ documents: BARecord[] }>('mongodb', 'query', {
    database: 'momentum',
    collection: 'brand_ambassadors',
    filter: {},
    sort: { createdAt: -1 },
    limit,
  });
  const bas = raw.documents ?? [];

  // Build a baId -> fullName map from the same result set so the sponsor name
  // resolves without an extra query when the sponsor is also in the list
  // (the common case once the team has any depth).
  const nameByBaId = new Map<string, string>();
  for (const b of bas) {
    nameByBaId.set(b.baId, `${b.firstName} ${b.lastName}`.trim());
  }

  // Any sponsors not in the result window get a follow-up batch lookup so the
  // sponsor column is correct even when the upline pre-dates the page.
  const missingSponsors = new Set<string>();
  for (const b of bas) {
    if (b.sponsorBaId && !nameByBaId.has(b.sponsorBaId)) {
      missingSponsors.add(b.sponsorBaId);
    }
  }
  if (missingSponsors.size > 0) {
    const sponsorLookup = await gatewayCall<{ documents: BARecord[] }>('mongodb', 'query', {
      database: 'momentum',
      collection: 'brand_ambassadors',
      filter: { baId: { $in: Array.from(missingSponsors) } },
      limit: missingSponsors.size,
    });
    for (const s of sponsorLookup.documents ?? []) {
      nameByBaId.set(s.baId, `${s.firstName} ${s.lastName}`.trim());
    }
  }

  return bas.map((b) => ({
    baId: b.baId,
    threeBaId: b.threeBaId,
    fullName: `${b.firstName} ${b.lastName}`.trim(),
    email: b.email ?? null,
    phone: b.phone ?? null,
    timezone: b.timezone ?? null,
    sponsorBaId: b.sponsorBaId ?? null,
    sponsorName: b.sponsorBaId ? nameByBaId.get(b.sponsorBaId) ?? null : null,
    joinedAt: b.createdAt,
  }));
}

export async function registerBA(input: NewBAInput, sponsor: AccessCodeRecord): Promise<BARecord> {
  const passwordHash = await argon2.hash(input.passwordPlain, { type: argon2.argon2id });
  const baId = mintBaId();
  const record: BARecord = {
    baId,
    threeBaId: input.threeBaId,
    threeUsername: input.threeUsername,
    firstName: input.firstName,
    lastName: input.lastName,
    email: input.email,
    phone: input.phone,
    timezone: input.timezone,
    passwordHash,
    sponsorBaId: sponsor.sponsorBaId,
    sponsorThreeBaId: sponsor.sponsorThreeBaId,
    accessCodeUsed: sponsor.code,
    createdAt: new Date().toISOString(),
    lastLoginAt: null,
  };

  await tripleStackWrite({
    id: baId,
    mongoCollection: 'brand_ambassadors',
    mongoDoc: { ...record },
    neo4j: {
      cypher:
        'MERGE (s:BA {baId: $sponsorBaId}) MERGE (n:BA {baId: $id}) ' +
        'SET n.threeBaId = $threeBaId, n.email = $email, n.firstName = $firstName, ' +
        'n.lastName = $lastName, n.timezone = $timezone ' +
        'MERGE (n)-[:SPONSORED_BY]->(s)',
      params: {
        sponsorBaId: sponsor.sponsorBaId,
        threeBaId: input.threeBaId,
        email: input.email,
        firstName: input.firstName,
        lastName: input.lastName,
        timezone: input.timezone,
      },
    },
  });

  return record;
}
