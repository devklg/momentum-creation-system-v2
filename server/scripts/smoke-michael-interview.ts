/**
 * Smoke test for Michael's Training Agent + Daily Success Coach artifact round-trip
 * (wireframe §3.2, reconciled 2026-06-24).
 *
 * Tests, in order:
 *   1. 29-Q Training Agent + Daily Success Coach backbone — exactly 29 questions across 9 sections,
 *      numbered 1..29.
 *   2. Live triple-stack: seed a synthetic BA + sponsor, ingest an artifact
 *      with legacy category-score fields present, and verify the sponsor
 *      cockpit card remains non-classifying.
 *
 * Reconciled 2026-06-24: Steve owns Discovery + Success Profile without
 * scoring. Michael is the Training Agent and Daily Success Coach and does not classify, rank, or predict.
 *
 * Run:  node node_modules/tsx/dist/cli.mjs scripts/smoke-michael-interview.ts
 */

import {
  MICHAEL_INTERVIEW_SECTIONS,
  MICHAEL_INTERVIEW_QUESTIONS,
} from '../src/domain/michael-interview-script.js';
import {
  ingestInterviewArtifact,
  getCockpitCardForSponsor,
} from '../src/domain/michaelScoring.js';
import { gatewayCall } from '../src/services/gateway.js';
import type { MichaelScoringIngestPayload } from '@momentum/shared';

const SUB_BA = 'TMBA-SMOKE-INT-SUB-001';
const SPONSOR_BA = 'TMBA-SMOKE-INT-SPON-001';

function header(s: string): void {
  console.log(`\n=== ${s} ===`);
}

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(`ASSERT FAILED: ${msg}`);
}

async function cleanup(): Promise<void> {
  const dels: Array<[string, Record<string, unknown>]> = [
    ['brand_ambassadors', { baId: { $in: [SUB_BA, SPONSOR_BA] } }],
    ['michael_interviews', { baId: SUB_BA }],
  ];
  for (const [collection, filter] of dels) {
    try {
      await gatewayCall('mongodb', 'delete', { database: 'momentum', collection, filter });
    } catch {
      /* ignore */
    }
  }
}

async function main(): Promise<void> {
  header('TEST 1: 29-Q Training Agent + Daily Success Coach backbone shape');
  console.log(`  sections=${MICHAEL_INTERVIEW_SECTIONS.length} questions=${MICHAEL_INTERVIEW_QUESTIONS.length}`);
  assert(MICHAEL_INTERVIEW_SECTIONS.length === 9, 'expected 9 sections');
  assert(MICHAEL_INTERVIEW_QUESTIONS.length === 29, 'expected 29 questions');
  const numbers = MICHAEL_INTERVIEW_QUESTIONS.map((q) => q.number);
  assert(numbers[0] === 1 && numbers[numbers.length - 1] === 29, 'numbered 1..29');
  assert(new Set(MICHAEL_INTERVIEW_QUESTIONS.map((q) => q.id)).size === 29, 'unique question ids');
  console.log('  ✓ 9 sections, 29 uniquely-numbered questions');

  header('TEST 2: live round-trip (seed → ingest → read back)');
  await cleanup();
  await gatewayCall('mongodb', 'insert', {
    database: 'momentum',
    collection: 'brand_ambassadors',
    documents: [
      { _id: SPONSOR_BA, baId: SPONSOR_BA, firstName: 'SmokeSponsor', sponsorBaId: null, phone: null, email: null },
      { _id: SUB_BA, baId: SUB_BA, firstName: 'SmokeSub', sponsorBaId: SPONSOR_BA, phone: null, email: null },
    ],
  });
  console.log('  seeded sub + sponsor BA records');

  const now = new Date().toISOString();
  const payload: MichaelScoringIngestPayload = {
    baId: SUB_BA,
    callSid: 'smoke-call-int-001',
    startedAt: now,
    completedAt: now,
    transcript: [
      { sequence: 1, speaker: 'michael', text: 'Welcome to the team!', occurredAt: now },
      { sequence: 2, speaker: 'ba', text: 'I am all in — I want to change my family\'s future.', occurredAt: now },
    ],
    answers: [
      { questionId: 'q_vision_picture', prompt: 'Paint me the picture.', answerText: 'Financial freedom for my kids.', scoringTags: ['high-intent'] },
    ],
    scoring: { overallTone: 'positive', highlightTags: ['high-intent', 'time-rich'], signedBy: 'Michael' },
    audioUrl: null,
  };

  const artifact = await ingestInterviewArtifact(payload, {
    vision: 19, commitment: 18, coachability: 17, availableTime: 13, network: 12, experience: 7,
  });
  console.log(`  ingested artifact for ${artifact.baId} sponsor=${artifact.sponsorBaId}`);
  assert(artifact.classification == null, 'artifact does not carry classification');
  assert(artifact.successProfile == null, 'artifact does not carry Michael-generated success profile');

  const card = await getCockpitCardForSponsor({ requestingBaId: SPONSOR_BA, downlineBaId: SUB_BA });
  console.log(`  cockpit card classification: ${card.classification ?? 'none'}`);
  assert(card.classification == null, 'cockpit card does not carry classification');
  assert(card.successProfile == null, 'cockpit card does not carry Michael-generated success profile');
  console.log('  ✓ Training Agent + Daily Success Coach artifact round-tripped without classification');

  header('cleanup');
  await cleanup();
  console.log('  ✓ removed smoke records');

  console.log('\nALL TESTS PASSED ✓');
}

main().catch(async (err) => {
  console.error('SMOKE TEST FAILED:', err);
  try {
    await cleanup();
    console.error('Smoke cleanup attempted after failure.');
  } catch (cleanupErr) {
    console.error('Smoke cleanup failed:', cleanupErr);
  }
  process.exit(1);
});
