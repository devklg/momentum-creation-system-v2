/**
 * Seed Team Magnificent's two founders:
 *   - TM-01 → Kevin L. Gardner   (THREE BA ID 1845964)
 *   - TM-02 → Paul Barrios       (THREE BA ID 892390)
 *
 * Writes each founder to TWO places (triple-stack each):
 *   1. `access_codes` — so the code resolves on signup (.team /register)
 *   2. `brand_ambassadors` — so admin lists, sponsor lookups, and BA-to-BA
 *      genealogy edges have real records to bind to.
 *
 * Neo4j edges seeded:
 *   - (kevin:BA {baId})-[:USES]->(:AccessCode {code:'TM-01'})
 *   - (paul:BA {baId})-[:USES]->(:AccessCode {code:'TM-02'})
 *   - (paul:BA)-[:SPONSORED_BY]->(kevin:BA)        ← Paul is Kevin's enroller
 *
 * Idempotent — safe to re-run. Skips any record whose _id already exists.
 *
 * Usage:  pnpm --filter @momentum/server seed:founders
 */

import { persistenceCall } from '../src/services/persistence/dispatch.js';
import { tripleStackWrite } from '../src/services/tripleStack.js';

interface FounderSeed {
  baId: string;            // TM-internal BA id (stable, never changes)
  code: string;            // their access code (TM-01 / TM-02)
  threeBaId: string;
  threeUsername: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  /** IANA timezone (e.g. "America/Los_Angeles"). Drives Michael scheduling. */
  timezone: string;
  role: 'founder' | 'co_leader';
  sponsorBaId: string | null;      // null = root of the tree
  sponsorThreeBaId: string | null;
}

const KEVIN: FounderSeed = {
  baId: 'TMBA-FOUNDER-KEVIN',
  code: 'TM-01',
  threeBaId: '1845964',
  threeUsername: 'devkev',
  firstName: 'Kevin',
  lastName: 'Gardner',
  email: 'devkev202@gmail.com',
  phone: '+13233519758',
  timezone: 'America/Los_Angeles',
  role: 'founder',
  sponsorBaId: null,
  sponsorThreeBaId: null,
};

const PAUL: FounderSeed = {
  baId: 'TMBA-FOUNDER-PAUL',
  code: 'TM-02',
  threeBaId: '892390',
  threeUsername: 'paulbarrios',
  firstName: 'Paul',
  lastName: 'Barrios',
  email: 'paul@teammagnificent.team', // placeholder — update via admin when known
  phone: '',                           // placeholder — update via admin when known
  // Confirmed Chat #98: Paul is in Pacific timezone (same as Kevin).
  timezone: 'America/Los_Angeles',
  role: 'co_leader',
  sponsorBaId: KEVIN.baId,
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
  if (await docExists('brand_ambassadors', { baId: f.baId })) {
    console.log(`[seed] BA ${f.baId} (${f.firstName} ${f.lastName}) — exists, skip`);
    return;
  }

  const createdAt = new Date().toISOString();
  await tripleStackWrite({
    id: f.baId,
    mongoCollection: 'brand_ambassadors',
    mongoDoc: {
      baId: f.baId,
      threeBaId: f.threeBaId,
      threeUsername: f.threeUsername,
      firstName: f.firstName,
      lastName: f.lastName,
      email: f.email,
      phone: f.phone,
      timezone: f.timezone,
      role: f.role,
      sponsorBaId: f.sponsorBaId,
      sponsorThreeBaId: f.sponsorThreeBaId,
      // Founders have no password hash (they don't sign up via .team /register);
      // when Kevin/Paul log in, auth will recognize them by THREE BA ID + a
      // founder-issued credential path. Leave as null for now.
      passwordHash: null,
      accessCodeUsed: null,   // founders did not enter through a code
      welcomedAt: createdAt,
      onboardingState: 'completed',
      createdAt,
    },
    neo4j: {
      // MERGE makes this idempotent. If sponsorBaId is set, also link upline.
      cypher: f.sponsorBaId
        ? `MERGE (s:BA {baId: $sponsorBaId})
           MERGE (n:BA {baId: $id})
           SET n.threeBaId = $threeBaId,
               n.email = $email,
               n.firstName = $firstName,
               n.lastName = $lastName,
               n.timezone = $timezone,
               n.role = $role,
               n.founder = true
           MERGE (n)-[:SPONSORED_BY]->(s)`
        : `MERGE (n:BA {baId: $id})
           SET n.threeBaId = $threeBaId,
               n.email = $email,
               n.firstName = $firstName,
               n.lastName = $lastName,
               n.timezone = $timezone,
               n.role = $role,
               n.founder = true`,
      params: {
        sponsorBaId: f.sponsorBaId,
        threeBaId: f.threeBaId,
        email: f.email,
        firstName: f.firstName,
        lastName: f.lastName,
        timezone: f.timezone,
        role: f.role,
      },
    },
    chroma: {
      collection: 'mcs_brand_ambassadors',
      document: `Founder BA ${f.firstName} ${f.lastName} (BA ${f.baId} / THREE ${f.threeBaId}) — role: ${f.role}, timezone: ${f.timezone}. Access code ${f.code}.`,
      metadata: {
        baId: f.baId,
        threeBaId: f.threeBaId,
        kind: 'brand_ambassador_founder',
        role: f.role,
        timezone: f.timezone,
        createdAt,
      },
    },
  });

  console.log(`[seed] BA ${f.baId} (${f.firstName} ${f.lastName}) — inserted`);
}

async function seedAccessCode(f: FounderSeed): Promise<void> {
  if (await docExists('access_codes', { code: f.code })) {
    console.log(`[seed] code ${f.code} — exists, skip`);
    return;
  }

  const createdAt = new Date().toISOString();
  await tripleStackWrite({
    id: f.code,
    mongoCollection: 'access_codes',
    mongoDoc: {
      code: f.code,
      sponsorBaId: f.baId,
      sponsorThreeBaId: f.threeBaId,
      sponsorFirstName: f.firstName,
      sponsorLastName: f.lastName,
      active: true,
      note: `Founder seed (${f.role})`,
      mintedByBaId: KEVIN.baId, // Kevin is the minter of record for both founder codes
      createdAt,
    },
    neo4j: {
      cypher:
        `MERGE (b:BA {baId: $sponsorBaId})
         MERGE (c:AccessCode {code: $id})
         SET c.active = true,
             c.createdAt = $createdAt,
             c.sponsorThreeBaId = $sponsorThreeBaId,
             c.founder = true
         MERGE (b)-[:USES]->(c)`,
      params: {
        sponsorBaId: f.baId,
        sponsorThreeBaId: f.threeBaId,
        createdAt,
      },
    },
    chroma: {
      collection: 'mcs_access_codes',
      document: `Access code ${f.code} (FOUNDER SEED) — assigned to ${f.firstName} ${f.lastName} (BA ${f.baId} / THREE ${f.threeBaId}).`,
      metadata: {
        code: f.code,
        sponsorBaId: f.baId,
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
