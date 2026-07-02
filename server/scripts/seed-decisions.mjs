#!/usr/bin/env node
/**
 * seed-decisions.mjs — seed the momentum.decisions ledger (Chat #129).
 *
 * THE DECISION LEDGER is the currency layer for the Momentum Creation System.
 * Documents (locked-spec, design docs, build-registry) describe STATE in prose.
 * This ledger records the ORDERED HISTORY of how that state changed and what
 * each change superseded. When two sources disagree on what is CURRENT, this
 * ledger is authoritative on currency (precedence set Chat #129).
 *
 * RULES (what makes it solve the "everything looks canonical" problem):
 *  - Append-only. A reversal NEVER edits the old row. It inserts a NEW row
 *    with supersedes=<old_id>, and flips the old row to status='superseded'
 *    + superseded_by=<new_id>. Both rows survive forever.
 *  - Monotonic `seq`. Integer that only increments, independent of the
 *    unreliable chat counter. Latest decision on a topic = highest seq in
 *    its supersession chain whose status='active'.
 *  - Topic-keyed. "What's the current rule on X?" = filter topic=X,
 *    status='active' -> exactly one row.
 *
 * This script is idempotent: it deletes each seeded _id then re-inserts, so
 * re-running re-asserts the seeded ledger without duplicating.
 *
 * Run:  node server/scripts/seed-decisions.mjs   (from repo root)
 */

import { closeMomentumMongo, momentumCollection } from './lib/momentum-mongo.mjs';

const COLL = 'decisions';

const DECISIONS = [
  // ---- superseded originals (kept for history) ----
  {
    _id: 'dec_flush_adaptive',
    topic: 'flush_window',
    statement: 'Holding-tank flush window is ADAPTIVE (varies by BA / prospect intent; tightens if no-rate climbs).',
    rationale: 'Original Chat #84 architecture framing.',
    chat: 84, date: '2026-05-14',
    status: 'superseded', supersedes: null, superseded_by: 'dec_flush_fixed',
    sources: ['locked-spec 3.7', 'COM Design H.8', 'ADMIN J.5.2'],
  },
  {
    _id: 'dec_phone_optional',
    topic: 'invite_phone_requirement',
    statement: 'At invitation mint, BOTH email and phone are optional.',
    rationale: 'Chat #119 reasoning: a BA may not have both for every warm-market name.',
    chat: 119, date: '2026-05-22',
    status: 'superseded', supersedes: null, superseded_by: 'dec_phone_required',
    sources: ['locked-spec 3.16'],
  },
  {
    _id: 'dec_email_open',
    topic: 'email_provider',
    statement: 'Email provider is an open question (Resend / Postmark / SendGrid / SES).',
    rationale: 'Carried open from Signup Architecture E.6 / ADMIN J.5.1.',
    chat: 84, date: '2026-05-14',
    status: 'superseded', supersedes: null, superseded_by: 'dec_email_resend',
    sources: ['locked-spec 3.13', 'Signup Architecture E.6'],
  },
  {
    _id: 'dec_counter_open',
    topic: 'behind_you_counter_transport',
    statement: 'Behind-you counter update interval is an open question (SSE vs short-poll).',
    rationale: 'Misclassified as open in the Chat #112 audit.',
    chat: 112, date: '2026-05-21',
    status: 'superseded', supersedes: null, superseded_by: 'dec_counter_sse',
    sources: ['locked-spec 4.4', 'ADMIN J.5.3'],
  },
  {
    _id: 'dec_callback_three_radio',
    topic: 'callback_form_shape',
    statement: 'Callback request uses three intent radios + phone + best time.',
    rationale: 'Original Chat #84 presentation-page form design.',
    chat: 84, date: '2026-05-14',
    status: 'superseded', supersedes: null, superseded_by: 'dec_callback_two_radio',
    sources: ['locked-spec 3.4 sec6', 'COM Design'],
  },
  {
    _id: 'dec_source_hierarchy_with_key',
    topic: 'source_hierarchy',
    statement: 'Source precedence: locked-spec > KEVIN-CONTEXT.md > build-registry > git log > Perry handoffs.',
    rationale: 'Original build-registry header hierarchy.',
    chat: 112, date: '2026-05-21',
    status: 'superseded', supersedes: null, superseded_by: 'dec_source_hierarchy_no_key',
    sources: ['build-registry header'],
  },

  // ---- active decisions ----
  {
    _id: 'dec_flush_fixed',
    topic: 'flush_window',
    statement: 'Holding-tank flush window is FIXED at 8 weeks for everyone. Not adaptive by BA or intent.',
    rationale: 'Simplicity; closes ADMIN J.5.2 / COM H.8.',
    chat: 100, date: '2026-05-19',
    status: 'active', supersedes: 'dec_flush_adaptive', superseded_by: null,
    sources: ['locked-spec 3.7', 'locked-spec Part 5'],
  },
  {
    _id: 'dec_phone_required',
    topic: 'invite_phone_requirement',
    statement: 'At invitation mint, PHONE is REQUIRED; email is optional. (Mint route only; /invitations/log stays lenient.) City/state required everywhere.',
    rationale: 'The BA sends the invite by SMS from their own phone; no phone = no delivery channel. Email is not the invite path.',
    chat: 125, date: '2026-05-23',
    status: 'active', supersedes: 'dec_phone_optional', superseded_by: null,
    sources: ['locked-spec 3.16'],
  },
  {
    _id: 'dec_email_resend',
    topic: 'email_provider',
    statement: 'Email provider is Resend. Wired in server/src/services/resend.ts; DORMANT pending teammagnificent.com domain verification. Until key+domain land, emailDeliveryStatus=skipped and BA-SMS is the live fallback.',
    rationale: 'Chosen at wiring time; thin transport mirroring telnyx.ts.',
    chat: 116, date: '2026-05-21',
    status: 'active', supersedes: 'dec_email_open', superseded_by: null,
    sources: ['locked-spec Part 5', 'server/src/services/resend.ts'],
  },
  {
    _id: 'dec_counter_sse',
    topic: 'behind_you_counter_transport',
    statement: 'Behind-you counter + position stack use SSE (server push). Shipped Chat #114: in-process EventEmitter pub/sub, snapshot+placement+30s heartbeat.',
    rationale: 'Was never actually open — locked in locked-spec 4.4 + the Phase 3 spec; the #112 audit misclassified it.',
    chat: 114, date: '2026-05-21',
    status: 'active', supersedes: 'dec_counter_open', superseded_by: null,
    sources: ['locked-spec 4.4', 'server/src/services/poolEvents.ts'],
  },
  {
    _id: 'dec_callback_two_radio',
    topic: 'callback_form_shape',
    statement: 'Callback request (Section 10) uses TWO soft-CTA radios (interested / have questions) + "Have [BA] reach out" button. No phone field on the page. (UI also wires a third intent ready_to_join, server-supported.)',
    rationale: 'Chat #109 redesign; phone already captured at mint, not re-asked on the prospect page.',
    chat: 109, date: '2026-05-20',
    status: 'active', supersedes: 'dec_callback_three_radio', superseded_by: null,
    sources: ['locked-spec 3.4 sec6', 'apps/com .../10-QuietDoor.tsx'],
  },
  {
    _id: 'dec_source_hierarchy_no_key',
    topic: 'source_hierarchy',
    statement: 'Source precedence (Chat #129): decision ledger (currency) > locked-spec (state) > design docs > build-registry > git log > Perry handoffs. KEVIN-CONTEXT.md and THE-KEY are NOT session-start reads (current userPreferences); pull a specific doc only when the work needs it.',
    rationale: 'Kevin changed session-start posture in userPreferences; KEVIN-CONTEXT is older than the new settings. Ledger added as currency layer this chat.',
    chat: 129, date: '2026-05-24',
    status: 'active', supersedes: 'dec_source_hierarchy_with_key', superseded_by: null,
    sources: ['userPreferences', 'build-registry header', 'locked-spec Part 6'],
  },

  // ---- net-new locks (no prior reversal, but belong in the ledger) ----
  {
    _id: 'dec_webinar_cadence',
    topic: 'webinar_cadence',
    statement: 'Webinars: Mon & Thu 5:00pm Pacific wall-clock, year-round (DST-tracking), 60 min, Kevin+Paul. One persistent recurring Zoom registration link; seeded rolling 8-week horizon.',
    rationale: 'Resolved Chat #116; closes COM H.3.',
    chat: 116, date: '2026-05-21',
    status: 'active', supersedes: null, superseded_by: null,
    sources: ['locked-spec Part 5', 'server/scripts/seed-webinar-events.ts'],
  },
  {
    _id: 'dec_leader_threshold',
    topic: 'leader_detection',
    statement: 'A BA is a "leader" when BOTH: (1) binary-qualified (one personally sponsored each leg) AND (2) 5 personally enrolled BAs total. Durable structural threshold, no lookback window.',
    rationale: 'Resolved Chat #100; closes ADMIN J.5.7-8.',
    chat: 100, date: '2026-05-19',
    status: 'active', supersedes: null, superseded_by: null,
    sources: ['locked-spec Part 5'],
  },
  {
    _id: 'dec_prospect_account_reversal',
    topic: 'prospect_identity',
    statement: 'GOAL LOCKED, BUILD DEFERRED: a temporary prospect account (auto-created at video_complete, expires at 8-week flush) will give durable self-serve re-entry. This REVERSES the "prospects have no account; token IS identity" posture (2.1/3.6) — treat as a deliberate amendment when built. HARD CONSTRAINT: re-entry must resolve to the ORIGINAL token + ORIGINAL inviting BA (sponsor immutability survives re-entry).',
    rationale: 'Chat #125 live testing: token SMS link is the only door; prospects study the page repeatedly across the consideration window.',
    chat: 125, date: '2026-05-23',
    status: 'active', supersedes: null, superseded_by: null,
    sources: ['locked-spec Part 5', 'locked-spec 2.1', 'locked-spec 3.5', 'locked-spec 3.6'],
  },
  {
    _id: 'dec_scriptmaker_not_wq02',
    topic: 'invitation_generator_scope',
    statement: 'CLARIFICATION (verified Chat #129 against disk): SHIPPED invitation work = (a) plain-form spine #119-#121 and (b) ScriptMaker product-anchored drafting #122-#123 (per-product video library, one prospect name at a time, compliance-clean LLM draft -> /invitations seam). This is NOT wq_02. wq_02 = a gallery-driven, per-product, MULTI-ANGLE Who-Do-You-Know generator with a PERSISTED tagged roster (product+angle, triple-stacked) where every name converges on that product /p/{token}. The multi-angle WDYK + persisted roster is Ivory (wq_03) and is NOT built. wq_02 and wq_03 are OPEN.',
    rationale: 'ScriptMaker own header defers prospect-surfacing ("who do you know") to Ivory, a separate unbuilt surface. Confirmed by reading scriptmaker.ts, routes/scriptmaker.ts, video-library.tsx.',
    chat: 129, date: '2026-05-24',
    status: 'active', supersedes: null, superseded_by: null,
    sources: ['work_queue wq_02', 'work_queue wq_03', 'apps/team/src/routes/video-library.tsx'],
  },
];

async function main() {
  const collection = await momentumCollection(COLL);
  let seq = 1;
  const now = new Date().toISOString();
  const docs = DECISIONS.map((d) => ({ ...d, seq: seq++, ledger_written_at: now }));

  await collection.deleteMany({ _id: { $in: docs.map((d) => d._id) } });
  await collection.insertMany(docs);
  await collection.deleteOne({ _id: 'dec_seed_probe' });

  const back = await collection
    .aggregate([
      { $match: { status: 'active' } },
      { $sort: { seq: 1 } },
      { $project: { _id: 1, seq: 1, topic: 1, status: 1, supersedes: 1 } },
    ])
    .toArray();
  const all = await collection.aggregate([{ $count: 'total' }]).toArray();

  console.log('=== LEDGER SEEDED ===');
  console.log('total rows:', JSON.stringify(all));
  console.log('active rows:', back.length);
  for (const r of back) {
    console.log(`  seq ${r.seq}  ${r.topic}  (${r._id})${r.supersedes ? '  <- supersedes ' + r.supersedes : ''}`);
  }
  await closeMomentumMongo();
}

main().catch(async (e) => {
  await closeMomentumMongo().catch(() => undefined);
  console.error('SEED FAILED:', e);
  process.exit(1);
});
