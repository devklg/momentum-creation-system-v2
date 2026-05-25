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

HEAD at write: `5c7105f` (Chat #126). Verified Chat #129.

---

## 0 Â· FOUNDATION (infra + shared)

- [x] Monorepo scaffold â€” apps/com, apps/team, apps/admin, server, packages/shared (#92)
- [x] Triple-stack persistence via Universal Gateway 2525 â€” services/tripleStack.ts, gateway.ts (#93)
- [x] Shared package â€” brand.ts, compliance.ts, rules.ts, types.ts (#92,#110)
- [x] Decision ledger + master work queue + this wireframe (#129)
- [~] LLM layer through gateway â€” services/anthropic.ts present; ScriptMaker + Ivory consume it
  - [x] anthropic.ts transport + dormant-aware fallback
  - [x] Ivory coaching consumer (#131/#132 â€” coach surfaces WDYK prompts, evergreen fallback)
  - [x] Michael scoring consumer (#134 â€” server/src/domain/michaelScoring.ts, triple-stacked, sponsor-stamped)

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
- [x] CONTENT: fix literal \u2014 in Part 7 eyebrow (10-QuietDoor.tsx: 4 occurrences replaced with real em dash, content/hygiene pass)

### 2.3 Holding-tank placement  `[x]` (#105)
- [x] Silent placement at video_complete, monotonic position, triple-stack write

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

### 3.1 Welcome  `[~]` (#94)
- [x] Click-acknowledge commitment, triple-stack write, routes to Michael
- [ ] Audit current welcome.tsx against locked-spec v2; merge welcome-prototype-v2 letter-voice + 7-day-arc strip

### 3.2 Michael interview surface  `[x]` (#102, #134)
- [x] Scheduler + Telnyx call origination + webhook + STT wiring
- [x] State 1 â€” Awaiting call (gold pill, pulsing dot, wrong-number link) (#134 wf_0038)
- [x] State 2 â€” Call in progress (teal pill, near-real-time transcript via SSE, speaker labels, no buttons) (#134 wf_0039)
- [x] State 3 â€” Complete (gold check, answer readback, signed-by, CTA to Fast Start) (#134 wf_0040)
- [x] Fallbacks (no-answer + reschedule, invalid-number banner, page-close resume via /state refetch, STT-fail audio) (#134 wf_0041)
- [x] Upline cockpit event card (answers + audio link + scoring tags, SPONSOR-ONLY server-enforced) (#134 wf_0042)
- DEP: Michael's 5 prompts (open â€” surface renders whatever the scoring worker submits; no hard-coded prompts on client); call-timing immediate-vs-delay (resolved â€” Kevin chose scheduler)

### 3.3 BA Cockpit  `[~]` (#121, #132)
- [x] My Sponsor card (name+phone+SMS button; founder override for Kevin/Paul)
- [x] My Invites pipeline (read side: status badges, expandable rows, 'I sent this')
- [x] Welcome banner / left-rail surfaces nav
- [x] Today's actions card (callbacks + due follow-ups + drafts, jump-to-row) (#132)
- [x] CRM per invite â€” notes (append-only), follow-up reminders (one active, replace-or-clear), 5-tag dispositions (new-ba/new-customer/interested/later/not-interested), re-invite (7-day cooldown, mints fresh if expired) (#132)

### 3.4 Invitation engine
- [x] **Spine** â€” plain-form front door + mint (phone-required #125) + cockpit read-side (#119,#120,#121)
- [x] **ScriptMaker** â€” per-product video library, one-name compliance-clean draft -> /invitations seam (#122,#123)
- [x] **GENERATOR** (#131) â€” gallery-driven, per-product, MULTI-ANGLE WDYK:
  - [x] BA picks product from gallery (shared `packages/shared/src/product-catalog.ts`)
  - [x] Per-product multi-angle WDYK prompts (do-the-business / make-money / lose-fat)
  - [x] Every name converges on ONE action: send that product's /p/{token} via spine + source='ivory'
  - [x] Roster persists triple-stacked, tagged by product + angle (Generator runs in `generator_runs`)
- [x] **IVORY** (#131) â€” standalone /ivory + feeder into generator:
  - [x] Persistent warm-market roster, category tags (`ivory_names`, BA-private)
  - [x] Mark invited / customer / BA / not-interested / follow-up (`updateIvoryStatus`)
  - [x] LLM coaching layer (Anthropic transport, evergreen fallback when key unset)
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

### 3.6 10-step orientation  `[~]` (#100)
- [x] Curriculum page ported to /training/10-steps
- [ ] Cockpit scheduling card + slot mechanism
- DEP: scheduling mechanism (Calendly / custom / manual â€” open)

### 3.7 Replicated .com preview  `[ ]`
- [ ] /preview route in-app (standalone preview.html exists, not in-app)
- [ ] Sandboxed token (no holding-tank write, no placement, no alerts, no counter)
- [ ] PREVIEW MODE ribbon

### 3.8 Profile / settings  `[ ]`
- [ ] Editable: first/last (audit), email (re-verify), phone (update), password, photo, timezone, notif prefs
- [ ] Read-only: sponsor, THREE BA ID, TM BA ID, access code held
- DEP: phone-change verification (open); notification defaults (open)

### 3.9 Onboarding carry-forward  `[x]` (3418d61)
- [x] Questionnaire + sponsor interview workbook

---

## 4 Â· /ADMIN â€” KEVIN-ONLY (teammagnificent.team/admin/*)

Nine surfaces. Build order per ADMIN J.6: gate -> audit log -> Core -> BA/Prospect -> Queue -> Live Ops -> Reporting -> Tenant -> Broadcast.

### 4.A Gate  `[x]` (#102)
- [x] ADMIN_BA_IDS env gate, hard 403, audit-logged attempt, server-side every route
- [x] Admin shell + scaffold (port 7703)

### 4.A.4.1 Access-code generator UI  `[x]`
- [x] routes/access-codes.tsx + server route

### 4.B Core Dashboard  `[ ]` (Section B â€” build 3rd)
- [ ] Master metrics row: active BAs, prospects in flow, queue movement 24h, enrollments 24h, training %
- [ ] Each tile clickable -> drilldown panel
- [ ] Filter bar: by BA, by leader group (system-detected + Kevin-curated)
- [ ] Live event stream

### 4.C BA Oversight  `[~]` (Section C â€” build 4th)
- [~] BA directory (routes/bas.tsx present)
- [ ] BA profile detail
- [ ] BA-requested sponsor override (audited, before/after, requesting-BA, reason)
- [ ] Leader tag toggle + at-risk tag (Kevin-curated, no algorithmic flagging)

### 4.D Prospect Oversight  `[ ]` (Section D â€” build 4th)
- [ ] Cross-team prospect view
- [ ] Sponsor-routed URL inspection (resolved-BA-at-mint vs now, discrepancy surfacing)
- [ ] Prospect detail panel (token, callback, webinar, enrollment, Kevin's private notes)
- [ ] BA-requested holding-tank intervention: move / reassign sponsor / manual flush / force-enroll (monotonic preserved, audited)

### 4.E Queue / Recruitment Leg Oversight  `[ ]` (Section E â€” build 5th)
- [ ] Queue depth + movement (placements/flushes/enrollments, net)
- [ ] Fixed assigned queue numbers (monotonic, highest today / ever, vacant slots)
- [ ] Ticker config (E.3 â€” position-stack visible window)
- [ ] Queue rule management (E.6)
- DEP: flush window (RESOLVED fixed-8wk); position-stack window (open)

### 4.H Live Operations  `[ ]` (Section H â€” build 6th)
- [ ] Real-time usage strip (active .team/.com, events/min, gateway p50/p95) via SSE
- [ ] Growth stat cards
- [ ] Holding-tank live grid (color by days, hover detail, click -> prospect panel)
- [ ] Toggleable conversion funnels (prospect funnel / BA activation funnel)
- DEP: audit log + live event stream

### 4.I Reporting / Analytics  `[ ]` (Section I â€” build 7th)
- [ ] BA activation, training, queue velocity, leader scorecards
- [ ] Export with PII redaction default
- DEP: leader detection (RESOLVED threshold); export PII redaction (open)

### 4.F Tenant Architecture  `[ ]` (Section F â€” build 8th)
- [ ] Master settings, template control, role/permission, content inheritance
- [ ] Master content validated at save-time (compliance fail-closed)
- DEP: compliance severity mapping (open)

### 4.G Kevin-Only Broadcast  `[ ]` (Section G â€” build LAST)
- [ ] Composer + per-recipient interpolation + preview
- [ ] Audience selector (all / first-72h / leaders / at-risk / custom, live count)
- [ ] Channel selector (email / text / both)
- [ ] Send-test-to-Kevin
- [ ] Queue master broadcast (triple-stack, per-recipient queue, async delivery, live status)
- [ ] Audit/consent guardrail (opt-out, STOP keyword, permanent exclusion)
- DEP: email provider (RESOLVED Resend, dormant) + Telnyx

### 4.J Audit / Controls  `[~]` (Section J.1-J.3 â€” build 2nd, SUBSTRATE)
- [x] Append-only audit log (every triple-stack write, every /admin request, every mutation)
- [x] Views: by actor / role / action / entity / timestamp
- [x] Before/after state on overrides, queue rule changes, compliance changes, master content saves
- [x] Michael transcripts linked from audit entries (no separate tab, #89)

---

## 5 Â· DRIFT / HYGIENE (non-blocking)

- [x] Relocate WELCOME LETTER pdf out of apps/com/public/assets (verified absent at content/hygiene pass â€” already not in tree)
- [x] Delete docs/_team-design-extract.txt scratch file (verified absent; also deleted `docs/_leaves.json` at content/hygiene pass)
- [x] Update build-registry.md to cover #122-#131; KEVIN-CONTEXT removed from source hierarchy in favor of momentum.decisions ledger (content/hygiene pass)
- [ ] Fix Dr. Dan "THREE CSO" brand-isolation drift in App-Description.docx Section 3

---

## OPEN DECISIONS BLOCKING BUILDS (from ledger + locked-spec Part 5)

Resolved: email=Resend(dormant) Â· flush=fixed-8wk Â· counter=SSE Â· webinar=Mon/Thu-5pmPT Â· leader-threshold Â· callback=two-radio Â· source-hierarchy(#129)

Still open (only these block their surfaces):
- Michael's 5 interview prompts -> blocks Michael State-3 readback
- Fast Start gating (sequential-not-gated vs hard-gate) -> Fast Start
- Orientation scheduling mechanism -> orientation card
- Phone-change verification -> profile
- Notification preference defaults -> profile
- Position-stack visible window -> admin Queue E.3
- Compliance severity mapping (block/warn/log) -> admin Tenant
- Export PII redaction default -> admin Reporting
- Sponsor-leaves card behavior -> cockpit My Sponsor edge case
- Re-invite cooldown -> cockpit CRM re-invite
- Leadership track-record placement inside .team -> training

---

*Source of truth for STATE: locked-spec.md. For CURRENCY: momentum.decisions.*
*This wireframe = build decomposition. Update leaf status at the end of any chat that ships one.*
*Written Chat #129.*