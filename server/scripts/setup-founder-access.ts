/**
 * Founder access setup - Kevin only.
 *
 * Two things stand between the founder and the .team app:
 *   1. passwordHash is null on TMBA-FOUNDER-KEVIN, so login fails.
 *   2. There is no steve_discoveries row, so the Steve gate keeps protected
 *      routes closed.
 *
 * This script fixes both for TMBA-FOUNDER-KEVIN only:
 *   - Sets a real argon2id passwordHash from FOUNDER_PASSWORD.
 *   - Seeds a clearly flagged Steve discovery artifact through the same
 *     ingest path the live worker uses, so Mongo + Neo4j + Chroma stay aligned.
 *
 * The seed opens local build access. It is not a real Steve discovery
 * conversation and should be replaced by a real artifact when available.
 *
 * Usage (PowerShell):
 *   $env:FOUNDER_PASSWORD = "your-password-here"
 *   pnpm --filter @momentum/server setup:founder-access
 *   Remove-Item Env:\FOUNDER_PASSWORD
 */

import argon2 from 'argon2';
import type { SteveDiscoveryIngestPayload } from '@momentum/shared';
import { ingestDiscoveryArtifact } from '../src/domain/steve-success-interview.js';
import { persistenceCall } from '../src/services/persistence/dispatch.js';

const FOUNDER_BA_ID = 'TMBA-FOUNDER-KEVIN';

interface BARow {
  baId: string;
  firstName?: string;
  lastName?: string;
  passwordHash?: string | null;
}

async function setFounderPassword(): Promise<void> {
  const plain = process.env.FOUNDER_PASSWORD;
  if (!plain || plain.length < 8) {
    throw new Error(
      'FOUNDER_PASSWORD env var is missing or shorter than 8 chars. ' +
        'Set it before running:  $env:FOUNDER_PASSWORD = "your-password"',
    );
  }

  const found = await persistenceCall<{ documents: BARow[]; count: number }>('mongodb', 'query', {
    database: 'momentum',
    collection: 'brand_ambassadors',
    filter: { baId: FOUNDER_BA_ID },
    limit: 1,
  });
  const ba = found.documents[0];
  if (!ba) {
    throw new Error(
      `No brand_ambassadors record for ${FOUNDER_BA_ID}. ` +
        'Run `pnpm --filter @momentum/server seed:founders` first.',
    );
  }

  const passwordHash = await argon2.hash(plain, { type: argon2.argon2id });

  await persistenceCall('mongodb', 'update', {
    database: 'momentum',
    collection: 'brand_ambassadors',
    filter: { baId: FOUNDER_BA_ID },
    update: { $set: { passwordHash } },
  });

  const had = ba.passwordHash ? 'rotated existing' : 'set (was null)';
  console.log(
    `[founder-access] password ${had} for ${FOUNDER_BA_ID} ` +
      `(${ba.firstName ?? '?'} ${ba.lastName ?? ''}). Hash written to Mongo.`,
  );
}

async function seedCompletedSteveDiscovery(): Promise<void> {
  const nowIso = new Date().toISOString();
  const seedPayload: SteveDiscoveryIngestPayload = {
    baId: FOUNDER_BA_ID,
    callSid: 'seed-founder-access',
    startedAt: nowIso,
    completedAt: nowIso,
    transcript: [
      {
        sequence: 1,
        speaker: 'steve',
        text: 'Founder build-access seed. Not a real Steve discovery conversation.',
        occurredAt: nowIso,
      },
    ],
    answers: [
      {
        questionId: 'seed_founder_access',
        prompt: 'Founder build-access seed',
        answerText:
          'Build-access seed only. Replace with a real Steve discovery artifact when Kevin completes discovery.',
      },
    ],
    audioUrl: null,
    profile: {
      primaryWhy: {
        statement: 'Founder access seed for local build work.',
        who: 'Team Magnificent',
        whyNow: 'Local development access setup.',
      },
      successVision: {
        statement: 'Keep founder login usable while building the app.',
        oneBigChange: 'Steve gate is satisfied with an explicitly marked seed artifact.',
      },
      learningStyle: {
        modalities: ['discussing'],
        feedbackPreference: 'Direct build-access seed.',
        notes: 'Seed profile only; not a real discovery synthesis.',
      },
      communicationPreferences: {
        preferredChannels: ['in_app'],
        cadence: 'as_needed',
        bestTimes: 'Local development only.',
        notes: 'Seed profile only.',
      },
      supportNeeds: {
        areas: ['founder-access'],
        potentialObstacles: ['No real Steve discovery artifact exists yet.'],
        helpStyle: 'Use this only for build access; replace with real discovery.',
        notes: 'Seed profile only.',
      },
      launchRecommendations: [
        {
          text: 'Open the cockpit after founder password setup.',
          href: '/cockpit',
        },
      ],
      trainingRecommendations: [
        {
          text: 'Use real Steve discovery output for personalized training once available.',
          href: '/steve/discovery',
        },
      ],
      michaelHandoffSummary:
        'Founder build-access seed only. Michael should not use this as real training context.',
    },
  };

  await ingestDiscoveryArtifact(seedPayload);
  console.log(`[founder-access] steve_discoveries row SD-${FOUNDER_BA_ID} seeded. Gate will open.`);
}

async function main(): Promise<void> {
  console.log(`[founder-access] begin - target ${FOUNDER_BA_ID} (Kevin only; Paul untouched)`);
  await setFounderPassword();
  await seedCompletedSteveDiscovery();
  console.log('[founder-access] done. Log in at .team with baId TMBA-FOUNDER-KEVIN + your password.');
}

main().catch((err) => {
  console.error('[founder-access] failed:', err instanceof Error ? err.message : err);
  process.exit(1);
});
