/**
 * Seed Team Magnificent's two founders:
 *   - TMAG-KEVN → Kevin L. Gardner   (THREE BA ID 1845964)
 *   - TMAG-PAUB → Paul Barrios       (THREE BA ID 892390)
 *
 * Writes each founder to TWO places (triple-stack each):
 *   1. `tmag_access_codes` — so the code resolves on signup (.team /register)
 *   2. `team_magnificent_members` — so admin lists, sponsor lookups, and BA-to-BA
 *      genealogy edges have real records to bind to.
 *
 * Neo4j edges seeded:
 *   - (kevin:TeamMagnificentMember {tmagId})-[:HOLDS_CODE]->(:TmagAccessCode {code:'TMAG-KEVN'})
 *   - (paul:TeamMagnificentMember {tmagId})-[:HOLDS_CODE]->(:TmagAccessCode {code:'TMAG-PAUB'})
 *   - (paul:TeamMagnificentMember)-[:SPONSORED_BY]->(kevin:TeamMagnificentMember)
 *
 * Idempotent — safe to re-run. Skips any record whose _id already exists.
 *
 * Usage:  pnpm --filter @momentum/server seed:founders
 */

import { persistenceCall } from '../src/services/persistence/dispatch.js';
import { connectMongo } from '../src/services/persistence/mongo/connection.js';
import { writeBaIdentityGraphCritical } from '../src/domain/baIdentityPersistence.js';
import { writeAccessCodeGraphCritical } from '../src/domain/sponsorImmutabilityPersistence.js';

interface FounderSeed {
  tmagId: string;          // TM-internal member id (stable, never changes)
  code: string;            // their Rev 3 access code (TMAG-XXXX)
  threeBaId: string;
  threeUsername: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  /** IANA timezone (e.g. "America/Los_Angeles"). Drives Michael scheduling. */
  timezone: string;
  role: 'founder' | 'co_leader';
  sponsorTmagId: string | null;    // null = root of the tree
  sponsorThreeBaId: string | null;
}

const KEVIN: FounderSeed = {
  tmagId: 'TMAG-01',
  code: 'TMAG-KEVN',
  threeBaId: '1845964',
  threeUsername: 'devkev',
  firstName: 'Kevin',
  lastName: 'Gardner',
  email: 'devkev202@gmail.com',
  phone: '+13233519758',
  timezone: 'America/Los_Angeles',
  role: 'founder',
  sponsorTmagId: null,
  sponsorThreeBaId: null,
};

const PAUL: FounderSeed = {
  tmagId: 'TMAG-02',
  code: 'TMAG-PAUB',
  threeBaId: '892390',
  threeUsername: 'paulbarrios',
  firstName: 'Paul',
  lastName: 'Barrios',
  email: 'paul@teammagnificent.team', // placeholder — update via admin when known
  phone: '',                           // placeholder — update via admin when known
  // Confirmed Chat #98: Paul is in Pacific timezone (same as Kevin).
  timezone: 'America/Los_Angeles',
  role: 'co_leader',
  sponsorTmagId: KEVIN.tmagId,
  sponsorThreeBaId: KEVIN.threeBaId,
};

const FOUNDERS: FounderSeed[] = [KEVIN, PAUL];

async function docExists(
  collection: string,
  filter: Record<string, unknown>,
): Promise<boolean> {
  const result = await persistenceCall<{ count: number }>('mongodb', 'query', {
    database: 'momentum',
    collection,
    filter,
    limit: 1,
  });
  return result.count > 0;
}

async function seedBaRecord(f: FounderSeed): Promise<void> {
  if (await docExists('team_magnificent_members', { tmagId: f.tmagId })) {
    console.log(`[seed] member ${f.tmagId} (${f.firstName} ${f.lastName}) — exists, skip`);
    return;
  }

  const createdAt = new Date().toISOString();
  const mongoDoc = {
    tmagId: f.tmagId,
    threeBaId: f.threeBaId,
    threeUsername: f.threeUsername,
    firstName: f.firstName,
    lastName: f.lastName,
    email: f.email,
    phone: f.phone,
    timezone: f.timezone,
    role: f.role,
    sponsorTmagId: f.sponsorTmagId,
    sponsorThreeBaId: f.sponsorThreeBaId,
    // Founders have no password hash (they don't sign up via .team /register);
    // when Kevin/Paul log in, auth will recognize them by THREE BA ID + a
    // founder-issued credential path. Leave as null for now.
    passwordHash: null,
    accessCodeUsed: null,   // founders did not enter through a code
    accessCodeHeld: f.code,
    welcomedAt: createdAt,
    onboardingState: 'completed',
    createdAt,
  };

  await writeBaIdentityGraphCritical({
    id: f.tmagId,
    mongoDoc,
    sponsorTmagId: f.sponsorTmagId,
    nodeProps: {
      threeBaId: f.threeBaId,
      email: f.email,
      firstName: f.firstName,
      lastName: f.lastName,
      timezone: f.timezone,
      role: f.role,
      founder: true,
    },
    chroma: {
      collection: 'mcs_members',
      document: `Founder member ${f.firstName} ${f.lastName} (${f.tmagId} / THREE ${f.threeBaId}) — role: ${f.role}, timezone: ${f.timezone}. Access code ${f.code}.`,
      metadata: {
        tmagId: f.tmagId,
        threeBaId: f.threeBaId,
        kind: 'team_magnificent_member_founder',
        role: f.role,
        timezone: f.timezone,
        createdAt,
      },
    },
  });

  console.log(`[seed] member ${f.tmagId} (${f.firstName} ${f.lastName}) — inserted`);
}

async function seedAccessCode(f: FounderSeed): Promise<void> {
  if (await docExists('tmag_access_codes', { code: f.code })) {
    console.log(`[seed] code ${f.code} — exists, skip`);
    return;
  }

  const createdAt = new Date().toISOString();
  await writeAccessCodeGraphCritical({
    id: f.code,
    mongoDoc: {
      code: f.code,
      sponsorTmagId: f.tmagId,
      sponsorThreeBaId: f.threeBaId,
      sponsorFirstName: f.firstName,
      sponsorLastName: f.lastName,
      active: true,
      note: `Founder seed (${f.role})`,
      mintedByTmagId: KEVIN.tmagId, // Kevin is the minter of record for both founder codes
      mintedVia: 'kevin',
      createdAt,
    },
    sponsorTmagId: f.tmagId,
    relationship: 'HOLDS_CODE',
    codeProps: {
      active: true,
      createdAt,
      sponsorThreeBaId: f.threeBaId,
      founder: true,
    },
    chroma: {
      collection: 'mcs_access_codes',
      document: `Access code ${f.code} (FOUNDER SEED) — assigned to ${f.firstName} ${f.lastName} (${f.tmagId} / THREE ${f.threeBaId}).`,
      metadata: {
        code: f.code,
        sponsorTmagId: f.tmagId,
        sponsorThreeBaId: f.threeBaId,
        kind: 'access_code',
        founder: true,
        createdAt,
      },
    },
  });

  console.log(`[seed] code ${f.code} → ${f.firstName} ${f.lastName} — inserted`);
}

async function main(): Promise<void> {
  await connectMongo();
  console.log('[seed] founders — begin');
  console.log('[seed] order: BA records first, then access codes (codes reference BAs)');

  // 1. BA records first (Kevin before Paul — Paul's SPONSORED_BY needs Kevin)
  for (const f of FOUNDERS) {
    await seedBaRecord(f);
  }

  // 2. Access codes (each one references its owning BA)
  for (const f of FOUNDERS) {
    await seedAccessCode(f);
  }

  console.log('[seed] founders — done');
}

main().catch((err) => {
  console.error('[seed] failed:', err);
  process.exit(1);
});
