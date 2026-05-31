/**
 * Smoke test for Michael's #147 interview → scoring → classification → founder
 * handoff round-trip (wireframe §3.2, dec_michael_interview / seq 20).
 *
 * Tests, in order:
 *   1. Pure classifier — band edges + clamping land on the right tiers.
 *   2. 29-Q backbone — exactly 29 questions across 9 sections, numbered 1..29.
 *   3. Live triple-stack: seed a synthetic BA + schedule, ingest a scored
 *      artifact with category scores, read back the sponsor cockpit card (with
 *      classification + profile) and the founder handoff. Cleans up after.
 *
 * Telnyx/Resend keys are dormant in dev, so the handoff dispatch records
 * 'skipped' — the handoff RECORD still lands. That is the expected dev result.
 *
 * Run:  node node_modules/tsx/dist/cli.mjs scripts/smoke-michael-interview.ts
 */

import { classifyInterview, buildSuccessProfile } from '../src/domain/michael-classification.js';
import {
  MICHAEL_INTERVIEW_SECTIONS,
  MICHAEL_INTERVIEW_QUESTIONS,
} from '../src/domain/michael-interview-script.js';
import {
  ingestInterviewArtifact,
  getCockpitCardForSponsor,
} from '../src/domain/michaelScoring.js';
import { getFounderHandoffByBaId } from '../src/domain/michael-founder-handoff.js';
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
    ['michael_founder_handoffs', { baId: SUB_BA }],
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
  header('TEST 1: pure classifier band edges + clamping');
  const builder = classifyInterview({
    vision: 20, commitment: 18, coachability: 18, availableTime: 14, network: 12, experience: 8,
  });
  console.log(`  builder-ish total=${builder.weightedTotal} tier=${builder.tier}`);
  assert(builder.weightedTotal === 90 && builder.tier === 'builder', 'expected Builder @90');

  const emerging = classifyInterview({
    vision: 15, commitment: 14, coachability: 14, availableTime: 10, network: 10, experience: 7,
  });
  console.log(`  emerging total=${emerging.weightedTotal} tier=${emerging.tier}`);
  assert(emerging.tier === 'emerging_leader', 'expected Emerging Leader (70-84)');

  const casual = classifyInterview({
    vision: 5, commitment: 4, coachability: 5, availableTime: 3, network: 3, experience: 2,
  });
  console.log(`  casual total=${casual.weightedTotal} tier=${casual.tier}`);
  assert(casual.tier === 'casual_participant', 'expected Casual Participant (0-49)');

  // Over-cap inputs clamp to the rubric max (no >100 totals).
  const clamped = classifyInterview({
    vision: 999, commitment: 999, coachability: 999, availableTime: 999, network: 999, experience: 999,
  });
  console.log(`  over-cap clamps to total=${clamped.weightedTotal} tier=${clamped.tier}`);
  assert(clamped.weightedTotal === 100 && clamped.tier === 'builder', 'clamp to 100/Builder');

  const profile = buildSuccessProfile({
    baId: 'X', classification: builder, generatedAt: new Date().toISOString(),
  });
  console.log(`  profile headline: ${profile.headline}`);
  assert(profile.strengths.length > 0 && profile.sponsorFocus.length > 0, 'profile non-empty');

  header('TEST 2: 29-Q backbone shape');
  console.log(`  sections=${MICHAEL_INTERVIEW_SECTIONS.length} questions=${MICHAEL_INTERVIEW_QUESTIONS.length}`);
  assert(MICHAEL_INTERVIEW_SECTIONS.length === 9, 'expected 9 sections');
  assert(MICHAEL_INTERVIEW_QUESTIONS.length === 29, 'expected 29 questions');
  const numbers = MICHAEL_INTERVIEW_QUESTIONS.map((q) => q.number);
  assert(numbers[0] === 1 && numbers[numbers.length - 1] === 29, 'numbered 1..29');
  assert(new Set(MICHAEL_INTERVIEW_QUESTIONS.map((q) => q.id)).size === 29, 'unique question ids');
  console.log('  ✓ 9 sections, 29 uniquely-numbered questions');

  header('TEST 3: live round-trip (seed → ingest → read back)');
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

  const card = await getCockpitCardForSponsor({ requestingBaId: SPONSOR_BA, downlineBaId: SUB_BA });
  console.log(`  cockpit card classification: ${card.classification?.tierLabel} ${card.classification?.weightedTotal}/100`);
  assert(card.classification != null, 'cockpit card carries classification');
  assert(card.classification!.tier === 'builder', 'expected Builder (86)');
  assert(card.successProfile != null, 'cockpit card carries success profile');

  const handoff = await getFounderHandoffByBaId(SUB_BA);
  console.log(`  founder handoff: tier=${handoff?.tier} total=${handoff?.weightedTotal} sms=${handoff?.dispatch.sms} email=${handoff?.dispatch.email}`);
  assert(handoff != null, 'founder handoff persisted');
  assert(handoff!.tier === 'builder', 'handoff tier matches classification');
  assert(handoff!.fastStartReady === true, 'handoff marks fast start ready');
  console.log('  ✓ classification + profile + handoff round-tripped live');

  header('cleanup');
  await cleanup();
  console.log('  ✓ removed smoke records');

  console.log('\nALL TESTS PASSED ✓');
}

main().catch((err) => {
  console.error('SMOKE TEST FAILED:', err);
  process.exit(1);
});
