/**
 * BA registration domain. Triple-stack writes the new BA record.
 * Sponsor link in Neo4j is the second source of truth (independent of THREE's genealogy).
 */

import argon2 from 'argon2';
import { tripleStackWrite } from '../services/tripleStack.js';
import { persistenceCall } from '../services/persistence/dispatch.js';
import type { AccessCodeRecord } from './access-codes.js';
import { mintUniqueTmagId } from './tmagIds.js';

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
  tmagId: string;
  threeBaId: string;
  threeUsername: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  /** IANA timezone (e.g. "America/Los_Angeles"). Drives Michael scheduling. */
  timezone: string;
  passwordHash: string;
  sponsorTmagId: string;
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
  /** Feature entitlements explicitly granted by Kevin/admin. */
  entitlements: string[];
}

export async function emailExists(email: string): Promise<boolean> {
  const result = await persistenceCall<{ count: number }>('mongodb', 'query', {
    database: 'momentum',
    collection: 'team_magnificent_members',
    filter: { email },
    limit: 1,
  });
  return result.count > 0;
}

export async function threeBaIdExists(threeBaId: string): Promise<boolean> {
  const result = await persistenceCall<{ count: number }>('mongodb', 'query', {
    database: 'momentum',
    collection: 'team_magnificent_members',
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
export async function findBAByTmagId(tmagId: string): Promise<BARecord | null> {
  const result = await persistenceCall<{ documents: BARecord[] }>('mongodb', 'query', {
    database: 'momentum',
    collection: 'team_magnificent_members',
    filter: { tmagId },
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
export async function recordLogin(tmagId: string): Promise<void> {
  const at = new Date().toISOString();
  try {
    await persistenceCall('mongodb', 'update', {
      database: 'momentum',
      collection: 'team_magnificent_members',
      filter: { tmagId },
      update: { $set: { lastLoginAt: at } },
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[recordLogin] best-effort update failed', { tmagId, err });
  }
}

/**
 * Admin-only flat BA list. Returns the entire roster in reverse-chronological
 * order, joined with sponsor name. No genealogy traversal — that lives in
 * THREE. This is the operational mirror per ADMIN Design Section C.
 */
export interface BAListItem {
  tmagId: string;
  threeBaId: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  timezone: string | null;
  sponsorTmagId: string | null;
  sponsorName: string | null;
  joinedAt: string;
}

export async function listAllBAsForAdmin(limit = 500): Promise<BAListItem[]> {
  const raw = await persistenceCall<{ documents: BARecord[] }>('mongodb', 'query', {
    database: 'momentum',
    collection: 'team_magnificent_members',
    filter: {},
    sort: { createdAt: -1 },
    limit,
  });
  const bas = raw.documents ?? [];

  // Build a tmagId -> fullName map from the same result set so the sponsor name
  // resolves without an extra query when the sponsor is also in the list
  // (the common case once the team has any depth).
  const nameByTmagId = new Map<string, string>();
  for (const b of bas) {
    nameByTmagId.set(b.tmagId, `${b.firstName} ${b.lastName}`.trim());
  }

  // Any sponsors not in the result window get a follow-up batch lookup so the
  // sponsor column is correct even when the upline pre-dates the page.
  const missingSponsors = new Set<string>();
  for (const b of bas) {
    if (b.sponsorTmagId && !nameByTmagId.has(b.sponsorTmagId)) {
      missingSponsors.add(b.sponsorTmagId);
    }
  }
  if (missingSponsors.size > 0) {
    const sponsorLookup = await persistenceCall<{ documents: BARecord[] }>('mongodb', 'query', {
      database: 'momentum',
      collection: 'team_magnificent_members',
      filter: { tmagId: { $in: Array.from(missingSponsors) } },
      limit: missingSponsors.size,
    });
    for (const s of sponsorLookup.documents ?? []) {
      nameByTmagId.set(s.tmagId, `${s.firstName} ${s.lastName}`.trim());
    }
  }

  return bas.map((b) => ({
    tmagId: b.tmagId,
    threeBaId: b.threeBaId,
    fullName: `${b.firstName} ${b.lastName}`.trim(),
    email: b.email ?? null,
    phone: b.phone ?? null,
    timezone: b.timezone ?? null,
    sponsorTmagId: b.sponsorTmagId ?? null,
    sponsorName: b.sponsorTmagId ? nameByTmagId.get(b.sponsorTmagId) ?? null : null,
    joinedAt: b.createdAt,
  }));
}

export async function registerBA(input: NewBAInput, sponsor: AccessCodeRecord): Promise<BARecord> {
  const passwordHash = await argon2.hash(input.passwordPlain, { type: argon2.argon2id });
  const tmagId = await mintUniqueTmagId();
  const record: BARecord = {
    tmagId,
    threeBaId: input.threeBaId,
    threeUsername: input.threeUsername,
    firstName: input.firstName,
    lastName: input.lastName,
    email: input.email,
    phone: input.phone,
    timezone: input.timezone,
    passwordHash,
    sponsorTmagId: sponsor.sponsorTmagId,
    sponsorThreeBaId: sponsor.sponsorThreeBaId,
    accessCodeUsed: sponsor.code,
    createdAt: new Date().toISOString(),
    lastLoginAt: null,
    entitlements: [],
  };

  await tripleStackWrite({
    id: tmagId,
    mongoCollection: 'team_magnificent_members',
    mongoDoc: { ...record },
    neo4j: {
      cypher:
        'MERGE (s:TeamMagnificentMember {tmagId: $sponsorTmagId}) MERGE (n:TeamMagnificentMember {tmagId: $id}) ' +
        'SET n.threeBaId = $threeBaId, n.email = $email, n.firstName = $firstName, ' +
        'n.lastName = $lastName, n.timezone = $timezone, n.entitlements = $entitlements ' +
        'MERGE (n)-[:SPONSORED_BY]->(s)',
      params: {
        sponsorTmagId: sponsor.sponsorTmagId,
        threeBaId: input.threeBaId,
        email: input.email,
        firstName: input.firstName,
        lastName: input.lastName,
        timezone: input.timezone,
        entitlements: record.entitlements,
      },
    },
  });

  return record;
}
