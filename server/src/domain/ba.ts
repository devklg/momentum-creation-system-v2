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
