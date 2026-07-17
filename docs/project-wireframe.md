# Project Wireframe â€” Team Magnificent Marketing Momentum Creation System

**What this is.** The full structural tree of the entire app â€” every surface, every
section, every buildable leaf â€” with a verified status on each. Built Chat #129
from locked-spec (6 parts) + the four design docs (.com/.team/admin/signup) +
git log + the file tree + read-back of the invitation surfaces.

**How to use it.** This is the BUILD MAP. Open it at session start. Pick an
unbuilt surface, and its leaves ARE your task list â€” no re-deriving from design
docs. Status is at the leaf, grounded in disk, not in prose.

**Status legend.**
- `[x]` done â€” on disk at HEAD, verified
- `[~]` partial â€” part shipped; the leaf says which part remains
- `[ ]` pending â€” design-locked, not started

**Authority.** Decision ledger (momentum.decisions) wins on what's CURRENT.
locked-spec wins on STATE. This wireframe is the BUILD DECOMPOSITION of that
state â€” if it disagrees with locked-spec, locked-spec wins and this gets fixed.
Depth is weighted toward UNBUILT surfaces (that's where a session needs detail).

HEAD at write: `d20741f` (Chat #146). Reconciled Chat #147 (Category-A decisions seq 19-25: F.6 dropped, Michael/orientation/leader-credibility/track-record/cockpit+profile-edges leaves added, open-decisions block cleared). Reconciled again 2026-06-24: Steve owns Discovery + Success Profile with no scoring; Michael is the Training Agent and Daily Success Coach and no longer classifies BAs.

---

## 0 Â· FOUNDATION (infra + shared)

- [x] Monorepo scaffold â€” apps/com, apps/team, apps/admin, server, packages/shared (#92)
- [x] Triple-stack persistence: MongoDB + Neo4j + ChromaDB — services/tripleStack.ts, persistence/dispatch.ts (#93). NOTE (2026-07-02): runtime persistence is direct store access per locked-spec §3.14; the old HTTP persistence path is retired.
- [x] Shared package â€” brand.ts, compliance.ts, rules.ts, types.ts (#92,#110)
- [x] Decision ledger + master work queue + this wireframe (#129)
- [x] LLM layer (direct Anthropic Messages API, NOT through external tooling, #118) â€” services/anthropic.ts; ScriptMaker + Ivory consume it. VERIFIED LIVE #145: ANTHROPIC_API_KEY landed in root .env, server restarted, Ivory Coach returned input-specific questions (typed "i went to oru" produced 7 ORU-specific prompts, impossible from the evergreen fallback). Key live, complete() reaching the API end to end.
  - [x] anthropic.ts transport + dormant-aware fallback (default claude-haiku-4-5-20251001; prompt-caching on stable prefix)
  - [x] Ivory coaching consumer (#131/#132 â€” coach surfaces WDYK prompts; evergreen fallback when key unset; VERIFIED firing real LLM #145)
  - [x] Michael Training Agent + Daily Success Coach artifact consumer (#134/#147 reconciled 2026-06-24 — server/src/domain/michaelScoring.ts, triple-stacked, sponsor-stamped, no classification)

---

## 1 Â· AUTH / SIGNUP (all built)

- [x] Access codes TM-XXXX â€” gen + validate, sponsor-immutable, admin-issued (#94)
- [x] BA registration â€” 10-step sequence, argon2, JWT, timezone, Michael gate (#92,#98)
- [x] BA login (.team) + admin login (e1a2d7f)

---

## 2 Â· .COM â€” PROSPECT SURFACE (teammagnificent.com)

One route /p/{token}, two faces by token state.

### 2.1 Token resolver + lifecycle  `[x]` (#104,#110,#111)
- [x] Mint + GET /api/p/:token
- [x] 200 presentation/dashboard by state; 404 invalid; 409 enrolled; 410 expired (lazy-flush); 500 soft-degrade
- [x] Sponsor immutability enforced at route layer every branch

### 2.2 tm-video-presentation â€” 11 sections  `[x]` (#107,#108,#109,#117)
- [x] 00 TickerStrip Â· 01 PersonalOpen Â· 02 Invitation (copy approved #117)
- [x] 03 DrDanVideo (YT IFrame state machine, fires video-event milestones)
- [x] 04 Market Â· 05 PharmaceuticalSolution Â· 06 NaturalPath Â· 07 Dossier
- [x] 08 KevinStory (luxury-favorite.jpeg full-bleed) Â· 09 Timing Â· 10 WhatsNext (presentationâ†’dashboard bridge closer, #126 â€” REPLACED QuietDoor callback section; callback now lives on dashboard Â§6) Â· 11 Footer
- [x] OG-injection middleware (token-resolved card)
- [x] CONTENT: drop dossier PDF -> flip DOSSIER_AVAILABLE flag in 07-Dossier.tsx (done #115; PDF at `apps/com/public/assets/glp-three-dossier.pdf`)
- [x] HYGIENE #147: removed orphaned `10-QuietDoor.tsx` (replaced by 10-WhatsNext #126, never imported by the composer; em-dash content fix is moot with the file gone)

### 2.3 Holding-tank placement  `[x]` (#105)
- [x] Silent placement at video_complete, monotonic position, triple-stack write
- [x] 8-week expiry flush — holdingTank.ts flushExpiredPlacements() manual sweep + listProspectsAgedBeyond(8) alert (#140; clock anchored to placedAt, NOT mint expiresAt; flushes past-window placements to flushReason:'expired', vacates slot WITHOUT reshuffle). VERIFIED LIVE #142: seeded a 9-week-aged placement across Mongo+Neo4j, ran the real fn, read back all legs — flushedAt+reason stamped, position preserved, counter never decremented, idempotent on re-run. No scheduler — Kevin-run.

### 2.4 tm-prospect-dashboard â€” 6 sections  `[x]` (#113,#114)
- [x] Ribbon Â· 01 Arrival Â· 02 Opportunity Â· 03 Mechanic
- [x] 04 LivePlace (behind-you SSE counter + vertical ticker; #84 behind-only correction)
- [x] 05 TmAdvantage Â· 06 YourNextMove Â· 07 Footer (TM-only, 3.10 disclaimer)
- [x] SSE: poolEvents.ts EventEmitter + usePlacementStream hook (snapshot+placement+30s heartbeat)
- [x] CONTENT: remove stray 'leg' wording on position card (01-Arrival.tsx h3 + comment: "Held in {ba}'s leg" â†’ "Held by {ba}", content/hygiene pass)

### 2.5 Callback request  `[x]` (#109,#117)
- [x] Two-radio + reach-out button + confirmation; Telnyx BA SMS alert

### 2.6 Webinar  `[~]` (#116)
- [x] Event entity + cadence generator (Mon/Thu 5pm PT, DST-correct) + reservation + seeded 16 events
- [x] BA SMS notification on reserve (live fallback)
- [~] Prospect confirmation EMAIL â€” wired via Resend, DORMANT pending teammagnificent.com domain verification

### 2.7 Prospect re-entry  `[x]` (#126, #131)
- [x] Layer 1: completion-interrupt fix + presentation<->dashboard nav (#126)
- [x] Layer 2: temporary prospect account (auto-create at video_complete, expire at 8wk flush) (#131)
- [x] Layer 3: prospect login surface on .com â€” /p/login phone-entry + /p/login/r/:linkToken redeem (#131)
- HARD CONSTRAINT met: re-entry resolves ORIGINAL token + ORIGINAL inviting BA per sponsorBaId stamped on prospect_accounts at video_complete (#131 enforced data-layer).
- Spec amendment locked in Part 3.17 (Chat #131): phone-only SMS magic link, 60-min single-use click window, opaque-by-design /p/login, callback-intent-only consent signal.

---

## 3 Â· .TEAM â€” BA SURFACE (teammagnificent.team)

### 3.1 Welcome  `[x]` (#94, #147)
- [x] Click-acknowledge commitment, triple-stack write, routes to Michael
- [x] Audit current welcome.tsx against locked-spec v2; merge welcome-prototype-v2 letter-voice + 7-day-arc strip (#147 wf_0037)

### 3.2 Steve discovery + Michael training and daily success coach  `[x]` (#102, #134, #147; reconciled 2026-06-24)
- [x] 2026-07-17 turn-taking/completion UX fix — while `voiceOn` is enabled, active speech recognition is explicitly stopped/aborted before each `/api/steve/discovery/converse` submit, its `onend` restart is suppressed for that in-flight request, and fresh listening only resumes after the returned Steve utterance `onend`.
- [x] Scheduler + Telnyx call origination + webhook + STT wiring
- [x] State 1 â€” Awaiting call (gold pill, pulsing dot, wrong-number link) (#134 wf_0038)
- [x] State 2 â€” Call in progress (teal pill, near-real-time transcript via SSE, speaker labels, no buttons) (#134 wf_0039)
- [x] State 3 â€” Complete (gold check, answer readback, signed-by, CTA to Fast Start) (#134 wf_0040)
- [x] Fallbacks (no-answer + reschedule, invalid-number banner, page-close resume via /state refetch, STT-fail audio) (#134 wf_0041)
- [x] Upline cockpit event card (answers + audio link + support tags, SPONSOR-ONLY server-enforced, no classification) (#134 wf_0042)
- [x] ACR-0032 durable interview versioning: BA-confirmed edits and retakes preserve prior versions; the current plan remains active until replacement completion; no ordinary delete path (P2-141)
- [x] RECONCILED 2026-06-24: old Michael scoring/classification is retired. No Builder / Emerging Leader / Part-Time Producer / Casual Participant labels. Steve conducts New BA Discovery + Success Interview and creates the Success Profile without scoring, ranking, or predicting. Michael receives that context and acts as the Training Agent and Daily Success Coach: clarify, support, answer questions, build confidence, prepare for action, and route the BA into orientation + Launch Center. Everyone receives the same opportunity, tools, training, and support; actions and outcomes determine results.
- DEP RESOLVED (#147): Michael's interview content = full 29-Q script (was "5 prompts open"); call-timing immediate-vs-delay (Kevin chose scheduler)

### 3.3 BA Cockpit  `[~]` (#121, #132)
- [x] My Sponsor card (name+phone+SMS button; founder override for Kevin/Paul)
- [x] My Invites pipeline (read side: status badges, expandable rows, 'I sent this')
- [x] Welcome banner / left-rail surfaces nav
- [x] Today's actions card (callbacks + due follow-ups + expiring windows, bias-prompt empty state, jump-to-row) (#132/#134 wf_0046)
- [x] P2-107 unified human follow-up queue (prospect + VM/RVM callbacks and reminders; raised hand > overdue > upcoming; no automated contact) (ACR-0018)
- [x] P2-108 Event Center multi-timezone hardening (UTC canonical storage, epoch ordering, BA-local display, Pacific DST tests)
- [x] CRM per invite â€” notes (append-only), follow-up reminders (one active, replace-or-clear), 5-tag dispositions (new-ba/new-customer/interested/later/not-interested), re-invite (7-day cooldown, mints fresh if expired) (#132)
- [x] EDGE (#147, dec_cockpit_sponsor_and_reinvite seq 23): REMOVE the 7-day re-invite cooldown gate â€” BA decides timing; add a re-invite SCRIPT BUTTON (surfaces/generates a re-invite script; does not gate)
- [x] EDGE (#147, seq 23): My Sponsor card â€” if the (immutable) sponsor is INACTIVE, point the BA to founders Kevin+Paul as support/contact fallback (placement + immutable relationship unchanged)

### 3.4 Invitation engine
- [x] **Spine** â€” plain-form front door + mint (phone-required #125) + cockpit read-side (#119,#120,#121). VERIFIED LIVE #145: Generator minted /p/{token}, prospect page rendered against local Mongo (position #3, held by Kevin, live placement strip). NOTE the link rendered only after swapping the prod domain for localhost â€” see PROSPECT_BASE_URL bug in Section 5.
- [x] **ScriptMaker** â€” per-product video library, one-name compliance-clean draft -> /invitations seam (#122,#123)
- [x] **GENERATOR** (#131) â€” gallery-driven, per-product, MULTI-ANGLE WDYK:
  - [x] BA picks product from gallery (shared `packages/shared/src/product-catalog.ts`)
  - [x] Per-product multi-angle WDYK prompts (do-the-business / make-money / lose-fat)
  - [x] Every name converges on ONE action: send that product's /p/{token} via spine + source='ivory'
  - [x] Roster persists triple-stacked, tagged by product + angle (Generator runs in `generator_runs`)
- [x] **IVORY** (#131) â€” standalone /ivory + feeder into generator:
  - [x] Persistent warm-market roster, category tags (`ivory_names`, BA-private)
  - [x] Mark invited / customer / BA / not-interested / follow-up (`updateIvoryStatus`)
  - [x] LLM coaching layer (Anthropic transport, evergreen fallback when key unset) â€” VERIFIED LIVE #145: Coach returned ORU-specific questions from a 13-char ask; Generator ran "THE THREE PRODUCT LINE / make-money" and queued a name for mint; ADD A NAME triple-stacked clean after the mcs_ivory Chroma bootstrap was run (#145 â€” collection was missing, every prior add 500'd silently while Mongo committed; see Section 5)
  - [x] Does NOT call/text/score (compliance â€” coach surfaces WDYK prompts, never names)

### 3.5 Fast Start Guide â€” 5 modules  `[x]` (#95, feat/fast-start-training)
- [x] Module 1 â€” The Product (GLP-THREE fact-sheet + MBC-267 + six-pillar product CV table)
- [x] Module 2 â€” Comp Plan Layer 1 (6 ways, cycle 300+600=900=$35, Active+Qualified, PIBs, 2-by-2)
- [x] Module 3 â€” The Binary as Two Legs (Power/Pay legs, no breakage, first-mover, 14-level dup chart)
- [x] Module 4 â€” Build Your Prospect List (names list, mindset, first-touch script, LINK to /ivory)
- [x] Module 5 â€” Build Your Team (22-in-2-weeks model, far-left/far-right, mark candidates in CRM)
- [x] Completion logic: 5 modules complete AND >=1 invitation sent (cross-checked from spine)
- [x] Triple-stack progress entity (mongo + neo4j + chroma `mcs_training_progress`, lazy bootstrap)
- [x] Welcome '/welcome' "Day 1 unlocks" step card now links to /training/fast-start
- DEP RESOLVED: Fast Start gating â€” sequential UI, NOT hard-gated (Kevin, this branch).
  Michael gate whitelisted for Module 1 + hub progress; Modules 2-5 stay gated.
- Merged onto main Chat #133 (feat/ba-crm + feat/fast-start-training); PDFs gitignored, stored locally

### 3.6 10-step orientation  `[x]` (#100, #147)
- [x] Curriculum page ported to /training/10-steps
- [x] Cockpit scheduling card + slot mechanism (#147, dec_orientation_scheduling seq 21): in-app GROUP orientation sessions, cap 10 BAs/session, hosts Kevin+Paul (host field assignable, leader-extensible later), REUSE webinar Event/reservation pattern (2.6) â€” NOT new infra; Michael-handoff -> cockpit card shows available sessions -> BA reserves seat -> founders see per-session roster; founders add sessions as growth demands; Google Calendar sync DEFERRED. SHIPPED: domain/orientationSession.ts (entity+reservation+roster, triple-stack, mcs_orientation Chroma), routes/orientation.ts (BA list/reserve/cancel, gated), routes/admin/orientation.ts (founder roster+create, audited), apps/team OrientationCard in cockpit, apps/admin /orientation roster page, seed:orientation-sessions; live round-trip verified (create->reserve->roster->cancel)
- DEP RESOLVED (#147): scheduling mechanism = fixed scheduled group sessions reusing webinar pattern (was Calendly/custom/manual open)

### 3.7 Replicated .com preview  `[x]` (#134)
- [x] /preview route in-app (standalone preview.html exists, not in-app)
- [x] Sandboxed token (no holding-tank write, no placement, no alerts, no counter)
- [x] PREVIEW MODE ribbon

### 3.8 Profile / settings  `[x]` (#134)
- [x] Editable: first/last (audit), email (re-verify), phone (update), password, photo, timezone, notif prefs
- [x] Read-only: sponsor, THREE BA ID, TM BA ID, access code held
- [x] J.8 phone-change verification (#147, dec_profile_verification_and_notifications seq 22): NO SMS code â€” confirmation MODAL restating the new number + why it matters (Telnyx alerts, Michael calls, prospect-login), explicit confirm before save (confirm-your-input, not an OTP)
- [x] J.12 notification defaults (#147, seq 22): operational signals ON by default (callback alerts, video-complete, follow-up-due); promotional/digest OFF until opt-in; all tunable in settings
- DEP RESOLVED (#147): phone-change verification (J.8 = confirm-modal); notification defaults (J.12 = operational-on/promotional-off)

### 3.9 Onboarding carry-forward  `[x]` (3418d61)
- [x] Questionnaire + sponsor interview workbook

### 3.11 Leadership credibility + BA track-record  `[ ]` (#147, dec_leadership_credibility_and_track_record seq 25)
- [x] #1 LEADER CREDIBILITY (Paul+Kevin) — founder credibility component (who leads, Kevin+Paul track records, why trust the path); STATIC content, NOT master-content-driven; renders on BOTH .com presentation (prospect trust) AND .team (new-BA confidence); .com side compliance-clean (no income/comp/THREE branding) (#147 — packages/shared/src/leaders.ts LEADER_CREDIBILITY; .com Section 12-Leadership.tsx; .team /leadership route + cockpit link; income line stripped for .com)
- [x] #2 BA INVITATION TRACK-RECORD — .team-ONLY display of the BA's own activity (invitations generated + who they invite) as the success indicator; DISPLAY layer over existing data (spine mint log + admin per-BA invite funnel); activity metric NOT income; never shown raw on .com (protects new BAs) (#147 — cockpit TrackRecordCard over already-loaded GET /api/cockpit/invites)

---

## 4 Â· /ADMIN â€” KEVIN-ONLY (teammagnificent.team/admin/*)

Nine surfaces. Build order per ADMIN J.6: gate -> audit log -> Core -> BA/Prospect -> Queue -> Live Ops -> Reporting -> Tenant -> Broadcast.

### 4.A Gate  `[x]` (#102)
- [x] ADMIN_BA_IDS env gate, hard 403, audit-logged attempt, server-side every route
- [x] Admin shell + scaffold (port 7703)

### 4.A.4.1 Access-code generator UI  `[x]`
- [x] routes/access-codes.tsx + server route

### 4.B Core Dashboard  `[x]` (Section B â€” build 3rd, #134)
- [x] Master metrics row: active BAs, prospects in flow, queue movement 24h, enrollments 24h, training %
- [x] Each tile clickable -> drilldown panel
- [x] Filter bar: by BA, by leader group (system-detected + Kevin-curated)
- [x] Live event stream

### 4.C BA Oversight  `[x]` (Section C â€” build 4th; UI shipped #141, VERIFIED #143)
- [x] BA directory (routes/bas.tsx mounts DirectoryTable + filter + create; GET /api/admin/bas with leaderDetectionNote)
- [x] BA profile detail (ProfileDrawer, GET /api/admin/bas/:baId profile bundle)
- [x] BA-requested sponsor override (audited, before/after, requesting-BA, reason) â€” sponsor-override-flow.tsx via drawer, POST /:baId/sponsor-override
- [x] Leader tag toggle + at-risk tag (Kevin-curated, no algorithmic flagging) â€” POST /:baId/leader-tag, system-detected dormant per leaderDetectionNote

### 4.C.CRUD Manual BA lifecycle  `[x]` (Section C CRUD — domain+routes #140, UI #141)
- [x] domain/adminBaCrud.ts — create / edit / softDelete / restore (#140, round-tripped live Mongo)
- [x] CREATE: sponsorBaId required + stamped original/immutable-from-birth, no password (mirror entry), unique-email enforced
- [x] EDIT: ordinary fields + reason→info audit; sponsor change delegates to C.5 applySponsorOverride (one mutation path)
- [x] SOFT DELETE: distinct `deleted` state, reason required, reversible; severity info (#140); EDIT rejects a deleted BA (restore first)
- [x] RESTORE: clears deleted, stamps restoredAt, keeps delete history
- [x] routes/admin/bas.ts — POST / · PATCH /:baId · DELETE /:baId · POST /:baId/restore (typecheck clean, round-tripped)
- [x] Admin UI: bas.tsx create/edit/delete/restore forms + friction-heavy confirm (before/after on sponsor) (#141, typecheck clean)

### 4.D Prospect Oversight  `[x]` (Section D â€” build 4th; UI shipped #141, VERIFIED #143)
- [x] Cross-team prospect view (routes/prospects.tsx: FilterBar + DirectoryTable, GET /api/admin/prospects)
- [x] Sponsor-routed URL inspection (resolved-BA-at-mint vs now, discrepancy surfacing) â€” DetailPanel drift detector (sponsorBaIdAtMint !== sponsorBaIdNow, warn banner) + Token+sponsor-routed-URL section w/ sandbox preview
- [x] Prospect detail panel (token, callback, webinar, enrollment, Kevin's private notes) â€” DetailPanel, ?prospectId= deep-link contract w/ Agent E
- [x] BA-requested holding-tank intervention: move / reassign sponsor / manual flush / force-enroll (monotonic preserved, audited) â€” InterventionModal + prospects.ts intervention routes

### 4.D.CRUD Manual prospect lifecycle  `[x]` (Section D CRUD — domain+routes #140, UI #141)
- [x] domain/adminProspectCrud.ts — create / edit / softDelete / restore (#140, round-tripped live Mongo)
- [x] CREATE: MINT-ONLY via createInvitation — #140 SUPERSEDES #138 "place at create"; placement+SMS+video tracking happen later through the normal /api/p/:token/video-event path (position earned at video_complete, not create)
- [x] EDIT: ordinary fields + reason; sponsor stays D.4 reassign-only; EDIT rejects a deleted prospect
- [x] SOFT DELETE: record-only `deleted` flip + audit; HOLDING TANK LEFT ENTIRELY UNTOUCHED (slot/position/ticker persist until the manual 8-week flush); severity info
- [x] RESTORE: clears deleted, keeps delete history
- [x] routes/admin/prospects.ts — POST / · PATCH /:prospectId · DELETE /:prospectId · POST /:prospectId/restore · POST /flush-expired · GET /alerts/aged (typecheck clean, round-tripped)
- [x] Cockpit BA-scoped prospect edit/delete (sponsor-guarded to own prospects) — routes + UI (#141; restore is admin-only by decision, no cockpit restore; soft-deleted excluded from invites + today's actions)
- [x] Admin UI: prospects.tsx create/edit/delete/restore forms (#141, typecheck clean)

### 4.E Queue / Recruitment Leg Oversight  `[x]` (Section E â€” build 5th; UI shipped #141, VERIFIED #143)
- [x] Queue depth + movement (placements/flushes/enrollments, net) â€” QueueDepthPanel (E.1), GET /api/admin/queue/summary
- [x] Fixed assigned queue numbers (monotonic, highest today / ever, vacant slots) â€” QueueNumbersPanel (E.2), GET /queue/lookup
- [x] Ticker config (E.3 â€” position-stack visible window) â€” VisibleWindowPanel, GET/PUT /queue/visible-window + GrowthSparkline (E.4) + AdminTickerPanel (E.5, SSE /queue/ticker/stream)
- [x] Queue rule management (E.6) â€” QueueRulesPanel, GET /queue/rules + PUT /queue/rules/:key (audited)
- DEP: flush window (RESOLVED fixed-8wk); position-stack window (open â€” VisibleWindowPanel lets Kevin set it live)

### 4.H Live Operations  `[x]` (Section H — build 6th; shipped Chat #144 fan-out)
- [x] Real-time usage strip (active dashboard viewers, events/min, persistence p50/p95, active admin sessions) via SSE — UsageStrip.tsx + useUsageStream.ts hook (H.1, snapshot+heartbeat at 30s); server services/persistenceLatency.ts + services/poolEvents.ts extended additively (eventsInLastMinute / activeAdminSessions counters added; original public API unchanged); GET /api/admin/live-ops/usage/stream
- [x] Growth stat cards 24h / 7d / 30d with previous-window deltas (BAs added, prospects placed, enrollments) — GrowthCards.tsx; GET /api/admin/live-ops/growth
- [x] Holding-tank live grid (color by age bucket fresh/warming/aging/stale, hover detail, click → /admin/prospects?prospectId={id} deep-link) — HoldingTankGrid.tsx; GET /api/admin/live-ops/grid
- [x] Toggleable conversion funnels (prospect funnel: mint→click→video_started→video_complete→enrolled; BA activation funnel: signed_up→welcomed→michael_done→first_invite→first_video_complete→first_enrollment) — ConversionFunnel.tsx; GET /api/admin/live-ops/funnel?kind=prospect|ba_activation
- [x] Contract pinned in packages/shared/src/admin-live-ops.ts (AdminLiveUsageSample, AdminLiveUsageStreamEvent, AdminGrowthCard*, AdminLiveGridSlot, AdminFunnel*, ADMIN_LIVE_OPS_PATHS); H-server and H-UI both import from @momentum/shared, neither defines locally
- DEP RESOLVED: audit log + live event stream (substrate already in place since #134 dashboard); events-per-minute scope honestly == placements-per-minute until a broader event firehose exists (flagged in poolEvents.ts JSDoc)

### 4.I Reporting / Analytics  `[x]` (Section I — build 7th; I.1 library shipped #143, I.4/I.5 export shipped #144)
- [x] I.1 standard-report library (Chat #143) â€” BA activation, training completion, invite-to-presentation movement (incl. per-BA breakdown w/ ?sort=completes|mints|completion_pct, Chat #143), queue velocity, enrollment completion (renamed from spec's "Registration handoff completion" per locked-spec 3.6), follow-up aging, leader scorecards. Each report = a JSON domain fn under server/src/domain/reports/* consumed by GET /api/admin/reporting/<name> AND a PDF section in I.3. Time range supports preset (lifetime|last_30d|last_90d|by_month) AND explicit from/to per Kevin decision A. Reports 7 (compliance count) + 8 (exception dashboard) intentionally NOT built (decision dec_reporting_i1_scope). FUTURE: video playback telemetry deferred to dec_video_playback_telemetry_deferred. Round-tripped live; full 5-workspace typecheck green.
- [x] I.3 Print Master Report â€” routes/admin/reporting.ts GET /master-report.pdf + domain/adminMasterReport.ts (#142, completed #143). Brand-locked PDF, verifiability footer (timestamp + SHA-256 source hash), audited on generate. Composites Section B dashboard metrics AND the full I.1 library (Reports 1–6 + 9) as of Chat #143 â€” provenance note now records that scope rather than pending state. Round-tripped live (valid %PDF, deterministic hash).
- [x] Cockpit BA prospect-list print â€” cockpit GET /invites/print.pdf + domain/cockpitPrint.ts (#142). Sponsor-scoped via listInvitesForBA; brand-locked PDF, same pdfReport.ts foundation. Round-tripped live (3 prospects, valid %PDF).
- [x] services/pdfReport.ts â€” shared pdfkit foundation (brand header + verifiability footer + table/section helpers); pdfkit + @types/pdfkit added to server (#142)
- [x] Export with PII redaction — modal every export, Kevin picks redact/raw each time (locked Chat #144; never persisted as a preference). Redacted fields: prospectFirstName, prospectLastName, phone, email. Kept verbatim: city, prospectId, tokenId, sponsorBaId, sponsorFullName. Pure functions in server/src/services/piiRedact.ts; CSV serializer in server/src/domain/reports/export.ts. 7 append-only routes on routes/admin/reporting.ts (one per I.1 report) returning text/csv with attachment disposition. Every export (raw OR redacted) appends one audit entry with redaction choice recorded (info severity). Admin UI: ExportPanel.tsx + RedactionModal.tsx mounted on /reports route.
- DEP RESOLVED: leader detection (Chat #100); export PII redaction (Chat #144); I.1 report library (Chat #143, I.3 composites all seven)

### 4.F Tenant Architecture  `[~]` (Section F — build 8th; editor surface shipped via Codex PR #4 / bb03711 merged Chat #144, wireframe reconciled Chat #146)
- [x] F.1 master settings — tenant name + .com/.team/admin domains + compliance posture (hard-locked `fail_closed`, read-only display per spec) — GET /api/admin/tenant/overview + PATCH /api/admin/tenant/settings; triple-stacked to `tenant_settings_versions` / `:TenantSettingsVersion` / `mcs_tenant_settings`; every PATCH audit warn
- [x] F.4 role permission matrix — 5 roles (founder_admin / leader / brand_ambassador / prospect / system) × 10 permissions, read-only display. NOTE: goes beyond locked-spec F.4 which calls for two roles (BA, Admin) — extra granularity is informational only; role assignment still env-var-only per Section A.2, no UI flow
- [x] master-content EDITOR surface — sandboxed preview + POST /api/admin/tenant/templates/validate + PUT /api/admin/tenant/templates/:templateKey; .com violations block save with 422 + structured `TenantComplianceValidation`; saves triple-stacked to `master_content_versions` / `:MasterContentVersion` / `mcs_master_content`; audit critical on save AND on block. Resolves the #144 deferral concern (the editor surface did not exist when F was deferred)
- [x] F.2 / F.5 master-content INHERITANCE — COMPLETE (Chat #147). Editor exists; 17 templates defined (keystone). readMasterContent() read-path resolves override-else-code-default with infra-failure fallback. All four BA-facing consumers re-wired to read from `master_content_versions` (Wave-2 inherit-* lanes): .com renderers (6 dashboard sections + presentation hero via server route p.ts), ScriptMaker (4 team.invitation.* seeds + render-time compliance scan), Ivory (team.ivory.coach_prompt voice layer; compliance/JSON guardrails stay code-owned), Michael (team.michael.interview_prompts served to the external voice worker; 29-Q backbone untouched). Live override-test verified per consumer (default → override → revert, no residue). A saved master override is now FUNCTIONAL, not inert.
- [x] F.2 add `{{baVoiceCopy}}` token to `com.presentation.hero` (Chat #147 keystone) — token declared on the hero template definition; apps/com PersonalOpen renders an optional inviting-BA voice line when supplied
- [x] F.5 add remaining master-content categories per spec F.5 (Chat #147 keystone) — 12 template keys added (.com dashboard sections, ScriptMaker seed library, training, michael.interview_prompts scaffold, ivory.coach_prompt); .com defaults pass validateMasterContent; all surface in the registry-driven editor
- [x] F.5 wire BA-facing consumers (.com renderers, ScriptMaker, Ivory, Michael) to read from `master_content_versions` — the leg that makes inheritance actually inherit. READ-PATH NOW EXISTS (Chat #147 keystone): `server/src/services/masterContent.ts` readMasterContent(key) resolves override-else-code-default with infra-failure fallback + interpolateMasterContent(). Wave-2 inherit-* lanes swap call sites to this helper.
- RESOLVED (#147, dec_compliance_severity_mapping seq 19): J.5.9 BLESSED as Codex default (block=critical fail-closed / warn=warn+audited / log=info). F.6 BUILD DECLINED — no versioned compliance rule set, no expanded render/script-time enforcement; existing validateMasterContent() RegExp backstop + packages/shared/src/compliance.ts checks stay as-is. (Two former F.6 leaves dropped: Kevin authors clean content by design and wants no governor; existing checks already protect the .com no-claims boundary without firing on compliant content.)
- [ ] F.3 explicit URL-structure read-only panel — locked-spec F.3 lists token pattern, mint endpoint, resolution rules as a read-only display. Currently absorbed into F.1 domain fields. Low priority — spec itself flags this surface as read-only-display, "URL structure changes require a deploy."
- AWAITING KEVIN (J.5.9): RESOLVED #147 — see note below.

### 4.G Kevin-Only Broadcast  `[x]` (Section G — shipped Chat #144 fan-out; was scheduled LAST per ADMIN J.6, landed in the same tranche as H + I export)
- [x] Composer with per-recipient {{firstName}} interpolation + preview — Composer.tsx; server-side interpolation only (client never sees rendered text for a third-party recipient)
- [x] Audience selector (all / first-72h / leaders / at-risk / custom, live count) — AudienceSelector.tsx; STOP-exclusion-list members filtered server-side at audience resolution, not client-side
- [x] Channel selector (email / text / both) — ChannelSelector.tsx; email DORMANT pending teammagnificent.com domain verification in Resend (transport stamps emailDeliveryStatus='skipped' until both EMAIL_API_KEY and verified domain land); SMS via Telnyx LIVE
- [x] Send-test-to-Kevin — SendTestButton.tsx; sends ONE message to Kevin's own BA contact identical to what the audience will receive (full interpolation); audit severity info
- [x] Queue master broadcast — server/src/domain/broadcast.ts (audience resolution, interpolation, enqueue, status reporting) + server/src/services/broadcastQueue.ts (in-memory worker w/ retry+backoff, startBroadcastWorker() void-called after listen); broadcast record + per-recipient rows triple-stacked; states queued → sending → sent | failed; BroadcastStatus.tsx renders live counts; audit severity critical for full sends
- [x] Audit/consent guardrail — STOP keyword permanent exclusion enforced server-side at audience resolution; opt-out global across Team Magnificent; every broadcast send audited with audience preset + recipient count + channel
- [x] Contract pinned in packages/shared/src/broadcast.ts (exported via index.ts barrel); routes/admin/broadcast.ts mounted at /api/admin/broadcast
- DEP RESOLVED: email provider (Resend, dormant); Telnyx (live)

### 4.J Audit / Controls  `[~]` (Section J.1-J.3 â€” build 2nd, SUBSTRATE)
- [x] Append-only audit log (every triple-stack write, every /admin request, every mutation)
- [x] Views: by actor / role / action / entity / timestamp
- [x] Before/after state on overrides, queue rule changes, compliance changes, master content saves
- [x] Michael transcripts linked from audit entries (no separate tab, #89)
- [x] FIX #140: appendAuditEntry chroma leg targeted a nonexistent collection (500'd, left half-written records). Renamed bare `audit_log` → `mcs_audit_log` (Mongo + Chroma) to match mcs_ convention; created the collection; migrated 3 real pre-existing entries; dropped the old Mongo collection. Audit triple-stack now lands clean across all four CRUD actions.

---

## 5 Â· DRIFT / HYGIENE (non-blocking)

- [x] Relocate WELCOME LETTER pdf out of apps/com/public/assets (verified absent at content/hygiene pass â€” already not in tree)
- [x] Delete docs/_team-design-extract.txt scratch file (verified absent; also deleted `docs/_leaves.json` at content/hygiene pass)
- [x] Update build-registry.md to cover #122-#131; KEVIN-CONTEXT removed from source hierarchy in favor of momentum.decisions ledger (content/hygiene pass)
- [x] FIX (#148, wf_0151): Dr. Dan "THREE CSO" brand-isolation drift in App-Description.docx Section 3 - source build-app-description.cjs corrected to brand-isolation lock (G.5, 2026-05-17): Part 1 lead + product-detail card now name him "Chief Scientific Officer and Chief Formulator", employer not named. Regenerated docx VERIFIED #148 (read-back of word/document.xml): old "THREE International's Chief Scientific Officer" string absent, new title present 2x. Sibling Section-3 brand-isolation drifts (hero eyebrow + footer "Independent Promoter Tool") corrected separately in wf_0152.
- [x] FIX (#148, wf_0152): remaining Section-3 brand-isolation drift in App-Description.docx - hero eyebrow corrected to "Team Magnificent" alone (was "Team Magnificent / THREE International"); footer corrected to Team Magnificent only (removed "THREE International Independent Promoter Tool"), per brand-isolation lock G.5 (2026-05-17). Source build-app-description.cjs edited + docx regenerated, VERIFIED #148 via word/document.xml read-back. Also closed a stale Section-7 compliance open-question that quoted the now-banned promoter-tool footer language (resolved per the same lock).
- [x] FIX (#145â†’#147, wf_0147): PROSPECT_BASE_URL is env-driven. env.ts carries `PROSPECT_BASE_URL` (default `http://localhost:7701`); invitations.ts reads `env.PROSPECT_BASE_URL`; .env.example documents the prod value (`https://teammagnificent.com`). VERIFIED #147: dev default resolves to `http://localhost:7701/p/{token}`. Old minted tokens keep the pre-fix inviteUrl â€” accepted for stale test invites (re-mint to refresh).
- [x] HARDEN (#145â†’#147, wf_0148): triple-stack Chroma collection guard, two layers in services/chromaCollections.ts. (1) BOOT: ensureChromaCollections() idempotently creates every registered collection that's missing + logs loud (wired before app.listen in index.ts). (2) WRITE: assertChromaCollectionExists() runs in tripleStackWrite BEFORE the Mongo insert, throwing ChromaCollectionMissingError so a missing collection fails loud on the Chroma leg instead of orphaning a Mongo row. VERIFIED LIVE #147: boot ensure created the 8 missing collections (mcs_broadcasts, mcs_tenant_settings, mcs_master_content, mcs_prospect_accounts, mcs_prospect_magic_links, mcs_webinar_reservations, mcs_training_progress, admin_prospect_notes); a bogus collection throws loud at the write guard. Same failure class as the #140 audit_log fix.

---

## OPEN DECISIONS BLOCKING BUILDS (from ledger + locked-spec Part 5)

Resolved: email=Resend(dormant) · flush=fixed-8wk · counter=SSE · webinar=Mon/Thu-5pmPT · leader-threshold · callback=two-radio · source-hierarchy(#129) · export-PII-redaction=modal-every-export(#144) · **2026-06-24 correction:** Steve=Discovery+Success Profile, no scoring; Michael=Training Agent + Daily Success Coach, no classification · Fast-Start-gating=sequential-not-gated(#133) · orientation=fixed-group-sessions-cap10(seq21) · phone-verify=confirm-modal(seq22) · notif-defaults=operational-on(seq22) · position-stack-window=live-VisibleWindowPanel(#141) · compliance-severity=Codex-default+F.6-declined(seq19) · sponsor-leaves=founder-fallback(seq23) · re-invite-cooldown=removed+script-button(seq23) · leadership-track-record=defined-as-3.11-both-surfaces(seq25)

Still open (only these block their surfaces):
- (none currently — all Category-A decisions cleared Chat #147)

---

*Source of truth for STATE: locked-spec.md. For CURRENCY: momentum.decisions.*
*This wireframe = build decomposition. Update leaf status at the end of any chat that ships one.*
*Written Chat #129. Updated Chat #144 (H + I.4/I.5 export + G all shipped; F deferred).*
*Updated Chat #145: LLM layer VERIFIED LIVE (Anthropic key landed in .env, Ivory Coach + Generator + spine exercised end-to-end, /p/{token} rendered). Found PROSPECT_BASE_URL hardcoded-to-prod bug + triple-stack missing-collection-no-warning gap (both logged in Section 5). No new leaves shipped â€” this was runtime verification of #131 surfaces + the key activation.*
*Updated Chat #146: Reconciled Section 4.F vs Codex PR #4 / bb03711 — code is shipped; wireframe had been silently reverted in #145 (664b42c clobbered Codex's [x] flip back to [ ] and re-added J.5.9 to open decisions). Flipped to [~] with honest sub-leaves: F.1 settings + F.4 role matrix + master-content editor [x]; F.2/F.5 inheritance [~] (saves land in master_content_versions but BA-facing consumers still read code defaults — functionally inert until rewired); 6 explicit gap leaves carried (F.2 baVoiceCopy token, F.5 remaining content categories + consumer rewire, F.6 versioned rules + render/script-time enforcement, F.3 URL panel). J.5.9 severity mapping awaiting Kevin's bless on Codex's default (block=critical fail-closed, warn=warn returned+audited, log=info). No code changed; docs-only edit.*
*Updated Chat #147: Category-A decisions cleared (ledger seq 19-25). F.6 build DECLINED (J.5.9 blessed as Codex default) — two F.6 leaves dropped, C2 compliance lane closed. New leaves added: Michael 29-Q interview build (3.2), orientation fixed-group-session scheduler (3.6), cockpit re-invite/sponsor-fallback edges (3.3), profile J.8/J.12 (3.8), new §3.11 leadership credibility (#1 Paul/Kevin, .com+.team) + BA invitation track-record (#2, .team-only). QuietDoor orphan removed (2.2). Open-decisions block now empty. Dispatched as 8 Wave-1 worktrees (D:\mcs-*) + heartbeats agent_147_*. Queue re-synced.*
