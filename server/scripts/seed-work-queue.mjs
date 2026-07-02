#!/usr/bin/env node
/**
 * seed-work-queue.mjs — the FIRST DEFINITIVE master work queue (Chat #129).
 *
 * Every item the Momentum Creation System needs, gathered from ALL sources
 * (locked-spec all 6 parts, the four design docs .com/.team/admin/signup,
 * build-registry, git log, the file tree, and verified file contents), each
 * marked against VERIFIED reality — not against prose claims.
 *
 * This REPLACES the earlier 9-row sketch queue. It is the single place that
 * answers "what needs doing, and is it done?" so no chat has to be told.
 *
 * STATUS VALUES (grounded in disk evidence, not documents):
 *   done     — built, on disk at HEAD, verified this chat
 *   partial  — part shipped + part not; `note` says exactly which is which
 *   pending  — design-locked, not started
 *   blocked  — cannot proceed until a dependency clears (named in `blocked_by`)
 *
 * Each row carries: id, surface, order, status, title, evidence (the file/
 * commit that proves status), note (what remains), deps (decision-ledger
 * topics or open questions it waits on).
 *
 * Idempotent: deletes every wq_* row then re-inserts. Re-run safely.
 * Run:  node server/scripts/seed-work-queue.mjs   (from repo root)
 */

import { closeMomentumMongo, momentumCollection } from './lib/momentum-mongo.mjs';

const COLL = 'work_queue';

const Q = [
  // ============ FOUNDATION / SHARED (built) ============
  { id: 'wq_foundation_scaffold', surface: 'infra', order: 10, status: 'done',
    title: 'Monorepo scaffold (apps/com, apps/team, apps/admin, server, packages/shared)',
    evidence: 'apps/* + server/ + packages/ on disk; #92', note: 'Vite6+React19+TS5.5, pnpm9, ports 7700-7703.', deps: [] },
  { id: 'wq_triple_stack', surface: 'infra', order: 11, status: 'done',
    title: 'Triple-stack persistence via direct adapters',
    evidence: 'server/src/services/tripleStack.ts + persistence/dispatch.ts; #93', note: 'Mongo+Neo4j+Chroma all required.', deps: [] },
  { id: 'wq_shared_pkg', surface: 'shared', order: 12, status: 'done',
    title: 'Shared brand/compliance/rules/types package',
    evidence: 'packages/shared/src/{brand,compliance,rules,types}.ts; #92,#110', note: '', deps: [] },
  { id: 'wq_decision_ledger', surface: 'infra', order: 13, status: 'done',
    title: 'Decision ledger (currency layer) + master work queue',
    evidence: 'momentum.decisions (16 rows) + this queue; #129', note: 'Append-only, monotonic seq, topic-keyed. Built this chat.', deps: [] },

  // ============ SIGNUP / AUTH (built) ============
  { id: 'wq_access_codes', surface: 'auth', order: 20, status: 'done',
    title: 'Access codes TMAG-XXXX (gen + validate + sponsor-immutable)',
    evidence: 'server domain/codeGen.ts, access-codes.ts; routes/admin/access-codes.ts; #94', note: 'Admin-generated, reusable.', deps: [] },
  { id: 'wq_registration', surface: 'auth', order: 21, status: 'done',
    title: 'BA registration (10-step sequence, argon2, JWT, sponsor lock)',
    evidence: 'server routes/auth.ts, domain/ba.ts; apps/team register.tsx; #92,#98', note: 'Timezone + Michael gate added #98.', deps: [] },
  { id: 'wq_login', surface: 'auth', order: 22, status: 'done',
    title: 'BA login (.team) + admin login',
    evidence: 'apps/team login.tsx, apps/admin login.tsx; e1a2d7f', note: '', deps: [] },

  // ============ .COM PROSPECT SURFACE (built) ============
  { id: 'wq_token_resolver', surface: 'com', order: 30, status: 'done',
    title: 'Token mint + /p/:token resolver + lifecycle (200/404/409/410/500)',
    evidence: 'server domain/tokens.ts, routes/p.ts; apps/com p-token.tsx; #104,#110,#111', note: 'Lazy-flush, F.1/F.2/E.2 views.', deps: [] },
  { id: 'wq_video_presentation', surface: 'com', order: 31, status: 'done',
    title: 'tm-video-presentation (11 sections + ticker + OG card)',
    evidence: 'apps/com routes/tm-video-presentation/* (12 files); og-injection.ts; #107,#108,#109,#117', note: 'Dossier PDF gated false until asset drops.', deps: [] },
  { id: 'wq_holding_tank', surface: 'com', order: 32, status: 'done',
    title: 'Holding-tank placement at video_complete (silent, monotonic position)',
    evidence: 'server domain/holdingTank.ts, routes/p.ts video-event; #105', note: '', deps: [] },
  { id: 'wq_prospect_dashboard', surface: 'com', order: 33, status: 'done',
    title: 'tm-prospect-dashboard (6 sections + SSE behind-you counter + ticker)',
    evidence: 'apps/com routes/tm-prospect-dashboard/* (8 files); poolEvents.ts; usePlacementStream; #113,#114', note: 'Chat #84 behind-only correction applied.', deps: [] },
  { id: 'wq_callback_request', surface: 'com', order: 34, status: 'done',
    title: 'Callback request (Section 10, two-radio + reach-out)',
    evidence: 'apps/com .../10-QuietDoor.tsx; server domain/callbackRequest.ts; #109,#117', note: 'Telnyx BA SMS alert on submit.', deps: [] },
  { id: 'wq_webinar', surface: 'com', order: 35, status: 'partial',
    title: 'Webinar reservation + cadence + events',
    evidence: 'server domain/webinarEvent.ts, webinarReservation.ts, webinarCadence.ts; seed-webinar-events.ts; #116', note: 'BUILT + seeded (16 events). Prospect confirmation EMAIL dormant pending Resend domain verification; BA-SMS is live fallback.', deps: ['email_provider'] },
  { id: 'wq_prospect_reentry', surface: 'com', order: 36, status: 'partial',
    title: 'Prospect re-entry (durable self-serve return to /p)',
    evidence: 'Layer 1 only; 5c7105f #126', note: 'Layer 1 (completion-interrupt fix + presentation<->dashboard nav) SHIPPED. Layers 2+3 (temp prospect account + prospect login) DEFERRED to own eng-reviewed session. REVERSES no-account posture (2.1/3.6) — deliberate amendment. HARD: re-entry must resolve original token + original BA.', deps: ['prospect_identity'] },

  // ============ .TEAM BA SURFACE ============
  { id: 'wq_welcome', surface: 'team', order: 40, status: 'partial',
    title: 'Welcome screen (click-acknowledge commitment)',
    evidence: 'apps/team welcome.tsx (209 lines); server welcome.ts, commitments.ts; #94', note: 'LIVE but needs audit against locked-spec v2 + merge of welcome-prototype-v2 letter-voice/7-day-arc.', deps: [] },
  { id: 'wq_steve_discovery', surface: 'team', order: 41, status: 'partial',
    title: 'Steve discovery + Success Profile',
    evidence: 'apps/team steve-discovery route; server domain/steve-success-interview.ts, routes/steve.ts', note: 'Steve is the first-step discovery gate. Michael schedule/interview routes are retired; Michael only makes training suggestions.', deps: ['steve_discovery_worker'] },
  { id: 'wq_cockpit', surface: 'team', order: 42, status: 'partial',
    title: 'BA cockpit (My Sponsor + My Invites + CRM)',
    evidence: 'apps/team cockpit.tsx (670 lines); server domain/cockpit.ts; #121', note: 'My Sponsor + My Invites (invitation read-side) SHIPPED. CRM per-invite (timeline, notes, follow-up reminders, tags, dispositions, re-invite) STUBBED — own session.', deps: [] },
  { id: 'wq_invitation_spine', surface: 'team', order: 43, status: 'done',
    title: 'Invitation spine (plain-form front door + mint + cockpit read-side)',
    evidence: 'apps/team invitations.tsx (614 lines); server domain/invitations.ts, routes/invitations.ts; #119,#120,#121', note: 'Plain-form mint with phone-required (#125). This is the SPINE, not the generator (wq_02).', deps: [] },
  { id: 'wq_scriptmaker', surface: 'team', order: 44, status: 'done',
    title: 'ScriptMaker (product-video draft front door)',
    evidence: 'apps/team video-library.tsx (813 lines); server domain/scriptmaker.ts, routes/scriptmaker.ts; #122,#123', note: 'Per-product video library, one-name drafting, compliance-clean LLM draft -> /invitations seam. Drafting half of the generator only.', deps: [] },

  // ---- THE BIG OPEN BUILD ITEMS ----
  { id: 'wq_invitation_generator', surface: 'team', order: 45, status: 'pending',
    title: 'GENERATOR: gallery-driven per-product MULTI-ANGLE WDYK generator (was wq_02)',
    evidence: 'NOT on disk; verified #129', note: 'BA picks product -> per-product multi-angle Who-Do-You-Know (do the business / make money / lose fat) -> EVERY name converges on that product /p/{token}. The drafting half (ScriptMaker) is done; the gallery+multi-angle convergence is NOT. Gallery component SHARED with training (wq_training_gallery).', deps: [] },
  { id: 'wq_ivory', surface: 'team', order: 46, status: 'pending',
    title: 'IVORY: WDYK coach surface + persistent tagged warm-market roster (was wq_03)',
    evidence: 'NOT on disk; ScriptMaker header defers WDYK to Ivory; verified #129', note: 'Standalone /ivory + feeder into the generator. Persistent roster triple-stacked, tagged by product+angle, mark invited/customer/BA/not-interested/follow-up. Does NOT call/text/score (compliance). LLM coaching UNBLOCKED (ANTHROPIC_API_KEY in root .env).', deps: ['llm_layer'] },
  { id: 'wq_llm_layer', surface: 'infra', order: 47, status: 'partial',
    title: 'LLM layer through direct Anthropic integration (Ivory -> ScriptMaker -> Michael)',
    evidence: 'server services/anthropic.ts present; key in root .env', note: 'ScriptMaker consumes it (dormant-aware fallback). Ivory coaching + Michael Training Agent + Daily Success Coach consumers PENDING.', deps: [] },

  { id: 'wq_fast_start', surface: 'team', order: 50, status: 'partial',
    title: 'Fast Start Guide (5 modules, first 72 hours)',
    evidence: 'Day 1 prototype drafted #95; 10-steps page ported #100', note: 'Module 1 (product) drafted. Modules 2-5 (comp Layer-1, binary, WDYK list via Ivory, first-two-candidates) PENDING. Sequential-not-gated per E.3.', deps: ['fast_start_gating'] },
  { id: 'wq_orientation', surface: 'team', order: 51, status: 'partial',
    title: '10-step orientation surface (live-hosted, scheduling)',
    evidence: 'apps/team training/10-steps.tsx; #100', note: 'Curriculum page ported. Scheduling card + slot mechanism PENDING.', deps: ['orientation_scheduling'] },
  { id: 'wq_preview', surface: 'team', order: 52, status: 'pending',
    title: 'Replicated .com preview at /preview (sandboxed token)',
    evidence: 'standalone preview.html exists; in-app route NOT on disk', note: 'PREVIEW MODE ribbon, no holding-tank write, no alerts.', deps: [] },
  { id: 'wq_profile', surface: 'team', order: 53, status: 'pending',
    title: 'Profile / settings (editable fields + immutable refs + notif prefs)',
    evidence: 'NOT on disk', note: 'Email re-verify, phone update, password, photo, timezone, notification matrix. Sponsor/THREE-ID/TM-ID/code shown read-only.', deps: ['phone_change_verification', 'notification_defaults'] },
  { id: 'wq_onboarding_questionnaire', surface: 'team', order: 54, status: 'done',
    title: 'Onboarding questionnaire + sponsor interview workbook',
    evidence: 'apps/team onboarding/questionnaire.tsx, sponsor/interview-workbook.tsx; server questionnaire.ts, workbook.ts; 3418d61', note: 'Carry-forward surfaces.', deps: [] },

  // ============ /ADMIN (9 surfaces — mostly pending) ============
  { id: 'wq_admin_gate', surface: 'admin', order: 60, status: 'done',
    title: 'Admin gate (ADMIN_BA_IDS env, hard 403) + scaffold',
    evidence: 'apps/admin admin-shell.tsx, lib/auth.tsx; requireAuth/requireAdmin; #102', note: 'Section A.', deps: [] },
  { id: 'wq_admin_access_codes', surface: 'admin', order: 61, status: 'done',
    title: 'Admin access-code generator + management UI',
    evidence: 'apps/admin routes/access-codes.tsx; server routes/admin/access-codes.ts', note: 'Section A.4.1.', deps: [] },
  { id: 'wq_admin_bas', surface: 'admin', order: 62, status: 'partial',
    title: 'Admin BA directory',
    evidence: 'apps/admin routes/bas.tsx present', note: 'Directory present; BA profile detail + BA-requested sponsor override (Section C) need verification/completion.', deps: [] },
  { id: 'wq_admin_audit_log', surface: 'admin', order: 63, status: 'pending',
    title: 'Audit log substrate (Section J.1-J.3) — append-only',
    evidence: 'NOT on disk', note: 'Every surface writes against it. Build SECOND per ADMIN J.6 sequence. Before/after state on overrides.', deps: [] },
  { id: 'wq_admin_core_dashboard', surface: 'admin', order: 64, status: 'pending',
    title: 'Core Dashboard (Section B) — master metrics + live stream + drilldowns',
    evidence: 'NOT on disk', note: 'Active BAs, prospects in flow, queue movement, enrollments, training %. Clickable tiles.', deps: [] },
  { id: 'wq_admin_prospect_oversight', surface: 'admin', order: 65, status: 'pending',
    title: 'Prospect Oversight (Section D) + cross-team holding-tank intervention',
    evidence: 'NOT on disk', note: 'Sponsor-routed URL inspection, BA-requested move/reassign/flush/force-enroll, monotonic preserved.', deps: [] },
  { id: 'wq_admin_queue_oversight', surface: 'admin', order: 66, status: 'pending',
    title: 'Queue / Recruitment Leg Oversight (Section E) + queue rule mgmt',
    evidence: 'NOT on disk', note: 'Depth, movement, fixed queue numbers, position-stack window (E.3).', deps: ['flush_window', 'position_stack_window'] },
  { id: 'wq_admin_live_ops', surface: 'admin', order: 67, status: 'pending',
    title: 'Live Operations (Section H) — real-time usage, holding-tank grid, funnels',
    evidence: 'NOT on disk', note: 'Depends on audit log + live event stream.', deps: [] },
  { id: 'wq_admin_reporting', surface: 'admin', order: 68, status: 'pending',
    title: 'Reporting / Analytics (Section I) + export',
    evidence: 'NOT on disk', note: 'BA activation, training, queue velocity, leader scorecards. PII redaction default.', deps: ['export_pii_redaction', 'leader_detection'] },
  { id: 'wq_admin_tenant', surface: 'admin', order: 69, status: 'pending',
    title: 'Tenant Architecture (Section F) — master settings, template/content control',
    evidence: 'NOT on disk', note: 'Master content validated at save-time (compliance). Mostly read-only display.', deps: ['compliance_severity'] },
  { id: 'wq_admin_broadcast', surface: 'admin', order: 70, status: 'pending',
    title: 'Kevin-Only Broadcast (Section G) — audience selector + channels + guardrail',
    evidence: 'NOT on disk', note: 'Build LAST per J.6 — needs email provider + Telnyx. Opt-out/STOP handling.', deps: ['email_provider'] },

  // ============ CONTENT-PASS / DRIFT (non-blocking) ============
  { id: 'wq_content_dossier_pdf', surface: 'com', order: 80, status: 'pending',
    title: 'Drop GLP-THREE dossier PDF + flip DOSSIER_AVAILABLE flag',
    evidence: 'apps/com .../07-Dossier.tsx DOSSIER_AVAILABLE=false', note: 'Asset to apps/com/public/dossier/, then flip flag.', deps: [] },
  { id: 'wq_content_drift_app_desc', surface: 'docs', order: 81, status: 'pending',
    title: 'Fix Dr. Dan "THREE CSO" brand-isolation drift in App-Description.docx',
    evidence: 'App-Description Section 3', note: 'Violates locked-spec 3.8. Correct on next docx edit.', deps: [] },
  { id: 'wq_repo_hygiene', surface: 'infra', order: 82, status: 'pending',
    title: 'Repo hygiene: relocate WELCOME LETTER pdf out of com/public/assets; delete docs/_team-design-extract.txt',
    evidence: 'git status untracked files', note: 'Welcome letter is research, not a .com production asset.', deps: [] },
  { id: 'wq_registry_update', surface: 'docs', order: 83, status: 'pending',
    title: 'Update build-registry.md to cover #122-#126 + correct header source-hierarchy',
    evidence: 'docs/build-registry.md footer says #121', note: 'Add ScriptMaker/video-library/login/re-entry rows; remove KEVIN-CONTEXT from hierarchy per #129 ledger.', deps: [] },
];

async function main() {
  const collection = await momentumCollection(COLL);

  // Wipe old wq_* rows (the 9-row sketch + any prior).
  await collection.deleteMany({});

  const now = new Date().toISOString();
  const docs = Q.map((d) => ({ ...d, _id: d.id, seeded_at: now, seeded_chat: 129 }));
  await collection.insertMany(docs);

  // Read back: counts by status.
  const byStatus = await collection
    .aggregate([
      { $group: { _id: '$status', n: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ])
    .toArray();
  const total = await collection.aggregate([{ $count: 't' }]).toArray();
  const pendingActive = await collection
    .aggregate([
      { $match: { status: { $in: ['pending', 'partial'] } } },
      { $sort: { order: 1 } },
      { $project: { _id: 1, surface: 1, status: 1, title: 1 } },
    ])
    .toArray();

  console.log('=== MASTER WORK QUEUE SEEDED ===');
  console.log('total items:', JSON.stringify(total));
  console.log('by status:', JSON.stringify(byStatus));
  console.log('\n--- NOT-DONE (pending/partial), in order ---');
  for (const r of pendingActive) {
    console.log(`  [${r.status.toUpperCase().padEnd(7)}] ${r.surface.padEnd(6)} ${r.title}`);
  }
  await closeMomentumMongo();
}

main().catch(async (e) => {
  await closeMomentumMongo().catch(() => undefined);
  console.error('SEED FAILED:', e);
  process.exit(1);
});
