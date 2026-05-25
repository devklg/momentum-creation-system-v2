# Project Wireframe — Team Magnificent Marketing Momentum Creation System

**What this is.** The full structural tree of the entire app — every surface, every
section, every buildable leaf — with a verified status on each. Built Chat #129
from locked-spec (6 parts) + the four design docs (.com/.team/admin/signup) +
git log + the file tree + read-back of the invitation surfaces.

**How to use it.** This is the BUILD MAP. Open it at session start. Pick an
unbuilt surface, and its leaves ARE your task list — no re-deriving from design
docs. Status is at the leaf, grounded in disk, not in prose.

**Status legend.**
- `[x]` done — on disk at HEAD, verified
- `[~]` partial — part shipped; the leaf says which part remains
- `[ ]` pending — design-locked, not started

**Authority.** Decision ledger (momentum.decisions) wins on what's CURRENT.
locked-spec wins on STATE. This wireframe is the BUILD DECOMPOSITION of that
state — if it disagrees with locked-spec, locked-spec wins and this gets fixed.
Depth is weighted toward UNBUILT surfaces (that's where a session needs detail).

HEAD at write: `5c7105f` (Chat #126). Verified Chat #129.

---

## 0 · FOUNDATION (infra + shared)

- [x] Monorepo scaffold — apps/com, apps/team, apps/admin, server, packages/shared (#92)
- [x] Triple-stack persistence via Universal Gateway 2525 — services/tripleStack.ts, gateway.ts (#93)
- [x] Shared package — brand.ts, compliance.ts, rules.ts, types.ts (#92,#110)
- [x] Decision ledger + master work queue + this wireframe (#129)
- [~] LLM layer through gateway — services/anthropic.ts present; ScriptMaker + Ivory consume it
  - [x] anthropic.ts transport + dormant-aware fallback
  - [x] Ivory coaching consumer (#131/#132 — coach surfaces WDYK prompts, evergreen fallback)
  - [ ] Michael scoring consumer

---

## 1 · AUTH / SIGNUP (all built)

- [x] Access codes TM-XXXX — gen + validate, sponsor-immutable, admin-issued (#94)
- [x] BA registration — 10-step sequence, argon2, JWT, timezone, Michael gate (#92,#98)
- [x] BA login (.team) + admin login (e1a2d7f)

---

## 2 · .COM — PROSPECT SURFACE (teammagnificent.com)

One route /p/{token}, two faces by token state.

### 2.1 Token resolver + lifecycle  `[x]` (#104,#110,#111)
- [x] Mint + GET /api/p/:token
- [x] 200 presentation/dashboard by state; 404 invalid; 409 enrolled; 410 expired (lazy-flush); 500 soft-degrade
- [x] Sponsor immutability enforced at route layer every branch

### 2.2 tm-video-presentation — 11 sections  `[x]` (#107,#108,#109,#117)
- [x] 00 TickerStrip · 01 PersonalOpen · 02 Invitation (copy approved #117)
- [x] 03 DrDanVideo (YT IFrame state machine, fires video-event milestones)
- [x] 04 Market · 05 PharmaceuticalSolution · 06 NaturalPath · 07 Dossier
- [x] 08 KevinStory (luxury-favorite.jpeg full-bleed) · 09 Timing · 10 WhatsNext (presentation→dashboard bridge closer, #126 — REPLACED QuietDoor callback section; callback now lives on dashboard §6) · 11 Footer
- [x] OG-injection middleware (token-resolved card)
- [x] CONTENT: drop dossier PDF -> flip DOSSIER_AVAILABLE flag in 07-Dossier.tsx (done #115; PDF at `apps/com/public/assets/glp-three-dossier.pdf`)
- [x] CONTENT: fix literal \u2014 in Part 7 eyebrow (10-QuietDoor.tsx: 4 occurrences replaced with real em dash, content/hygiene pass)

### 2.3 Holding-tank placement  `[x]` (#105)
- [x] Silent placement at video_complete, monotonic position, triple-stack write

### 2.4 tm-prospect-dashboard — 6 sections  `[x]` (#113,#114)
- [x] Ribbon · 01 Arrival · 02 Opportunity · 03 Mechanic
- [x] 04 LivePlace (behind-you SSE counter + vertical ticker; #84 behind-only correction)
- [x] 05 TmAdvantage · 06 YourNextMove · 07 Footer (TM-only, 3.10 disclaimer)
- [x] SSE: poolEvents.ts EventEmitter + usePlacementStream hook (snapshot+placement+30s heartbeat)
- [x] CONTENT: remove stray 'leg' wording on position card (01-Arrival.tsx h3 + comment: "Held in {ba}'s leg" → "Held by {ba}", content/hygiene pass)

### 2.5 Callback request  `[x]` (#109,#117)
- [x] Two-radio + reach-out button + confirmation; Telnyx BA SMS alert

### 2.6 Webinar  `[~]` (#116)
- [x] Event entity + cadence generator (Mon/Thu 5pm PT, DST-correct) + reservation + seeded 16 events
- [x] BA SMS notification on reserve (live fallback)
- [~] Prospect confirmation EMAIL — wired via Resend, DORMANT pending teammagnificent.com domain verification

### 2.7 Prospect re-entry  `[x]` (#126, #131)
- [x] Layer 1: completion-interrupt fix + presentation<->dashboard nav (#126)
- [x] Layer 2: temporary prospect account (auto-create at video_complete, expire at 8wk flush) (#131)
- [x] Layer 3: prospect login surface on .com — /p/login phone-entry + /p/login/r/:linkToken redeem (#131)
- HARD CONSTRAINT met: re-entry resolves ORIGINAL token + ORIGINAL inviting BA per sponsorBaId stamped on prospect_accounts at video_complete (#131 enforced data-layer).
- Spec amendment locked in Part 3.17 (Chat #131): phone-only SMS magic link, 60-min single-use click window, opaque-by-design /p/login, callback-intent-only consent signal.

---

## 3 · .TEAM — BA SURFACE (teammagnificent.team)

### 3.1 Welcome  `[~]` (#94)
- [x] Click-acknowledge commitment, triple-stack write, routes to Michael
- [ ] Audit current welcome.tsx against locked-spec v2; merge welcome-prototype-v2 letter-voice + 7-day-arc strip

### 3.2 Michael interview surface  `[~]` (#102)
- [x] Scheduler + Telnyx call origination + webhook + STT wiring
- [ ] State 1 — Awaiting call (gold pill, pulsing dot, wrong-number link)
- [ ] State 2 — Call in progress (teal pill, near-real-time transcript, speaker labels, no buttons)
- [ ] State 3 — Complete (gold check, answer readback, signed-by, CTA to Fast Start)
- [ ] Fallbacks (no-answer voicemail+retry, invalid-number banner, page-close resume, STT-fail audio)
- [ ] Upline cockpit event card (answers + audio link + scoring tags, sponsor-only)
- DEP: Michael's 5 prompts (open); call-timing immediate-vs-delay (open — Kevin chose scheduler)

### 3.3 BA Cockpit  `[~]` (#121)
- [x] My Sponsor card (name+phone+SMS button; founder override for Kevin/Paul)
- [x] My Invites pipeline (read side: status badges, expandable rows, 'I sent this')
- [x] Welcome banner / left-rail surfaces nav
- [ ] Today's actions card (derived from pipeline — what needs attention now)
- [ ] CRM per invite (activity timeline, notes, follow-up reminders, tags, dispositions, re-invite) — STUBBED, own session

### 3.4 Invitation engine
- [x] **Spine** — plain-form front door + mint (phone-required #125) + cockpit read-side (#119,#120,#121)
- [x] **ScriptMaker** — per-product video library, one-name compliance-clean draft -> /invitations seam (#122,#123)
- [x] **GENERATOR** (#131) — gallery-driven, per-product, MULTI-ANGLE WDYK:
  - [x] BA picks product from gallery (shared `packages/shared/src/product-catalog.ts`)
  - [x] Per-product multi-angle WDYK prompts (do-the-business / make-money / lose-fat)
  - [x] Every name converges on ONE action: send that product's /p/{token} via spine + source='ivory'
  - [x] Roster persists triple-stacked, tagged by product + angle (Generator runs in `generator_runs`)
- [x] **IVORY** (#131) — standalone /ivory + feeder into generator:
  - [x] Persistent warm-market roster, category tags (`ivory_names`, BA-private)
  - [x] Mark invited / customer / BA / not-interested / follow-up (`updateIvoryStatus`)
  - [x] LLM coaching layer (Anthropic transport, evergreen fallback when key unset)
  - [x] Does NOT call/text/score (compliance — coach surfaces WDYK prompts, never names)

### 3.5 Fast Start Guide — 5 modules  `[x]` (#95, #132)
- [x] Module 1 — The product (Dr. Dan video + six-pillar; CV/price table current per Kevin #132) (#132)
- [x] Module 2 — Comp plan Layer 1 (written, walked through) (#132)
- [x] Module 3 — The binary as two legs (#132)
- [x] Module 4 — Build your prospect list (intro + open Ivory) (#132)
- [x] Module 5 — Identify first two candidates (mark in CRM) (#132)
- [x] Completion logic: 5 modules complete AND >=1 invitation sent (#132)
- RESOLVED: Fast Start gating — sequential, not hard-gated (TASK.md #132); Module 1 whitelisted pre-Michael, Modules 2-5 gated
- Merged feat/fast-start-training b74b4e3; full pnpm -w build green (com+team+server)

### 3.6 10-step orientation  `[~]` (#100)
- [x] Curriculum page ported to /training/10-steps
- [ ] Cockpit scheduling card + slot mechanism
- DEP: scheduling mechanism (Calendly / custom / manual — open)

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

## 4 · /ADMIN — KEVIN-ONLY (teammagnificent.team/admin/*)

Nine surfaces. Build order per ADMIN J.6: gate -> audit log -> Core -> BA/Prospect -> Queue -> Live Ops -> Reporting -> Tenant -> Broadcast.

### 4.A Gate  `[x]` (#102)
- [x] ADMIN_BA_IDS env gate, hard 403, audit-logged attempt, server-side every route
- [x] Admin shell + scaffold (port 7703)

### 4.A.4.1 Access-code generator UI  `[x]`
- [x] routes/access-codes.tsx + server route

### 4.B Core Dashboard  `[ ]` (Section B — build 3rd)
- [ ] Master metrics row: active BAs, prospects in flow, queue movement 24h, enrollments 24h, training %
- [ ] Each tile clickable -> drilldown panel
- [ ] Filter bar: by BA, by leader group (system-detected + Kevin-curated)
- [ ] Live event stream

### 4.C BA Oversight  `[~]` (Section C — build 4th)
- [~] BA directory (routes/bas.tsx present)
- [ ] BA profile detail
- [ ] BA-requested sponsor override (audited, before/after, requesting-BA, reason)
- [ ] Leader tag toggle + at-risk tag (Kevin-curated, no algorithmic flagging)

### 4.D Prospect Oversight  `[ ]` (Section D — build 4th)
- [ ] Cross-team prospect view
- [ ] Sponsor-routed URL inspection (resolved-BA-at-mint vs now, discrepancy surfacing)
- [ ] Prospect detail panel (token, callback, webinar, enrollment, Kevin's private notes)
- [ ] BA-requested holding-tank intervention: move / reassign sponsor / manual flush / force-enroll (monotonic preserved, audited)

### 4.E Queue / Recruitment Leg Oversight  `[ ]` (Section E — build 5th)
- [ ] Queue depth + movement (placements/flushes/enrollments, net)
- [ ] Fixed assigned queue numbers (monotonic, highest today / ever, vacant slots)
- [ ] Ticker config (E.3 — position-stack visible window)
- [ ] Queue rule management (E.6)
- DEP: flush window (RESOLVED fixed-8wk); position-stack window (open)

### 4.H Live Operations  `[ ]` (Section H — build 6th)
- [ ] Real-time usage strip (active .team/.com, events/min, gateway p50/p95) via SSE
- [ ] Growth stat cards
- [ ] Holding-tank live grid (color by days, hover detail, click -> prospect panel)
- [ ] Toggleable conversion funnels (prospect funnel / BA activation funnel)
- DEP: audit log + live event stream

### 4.I Reporting / Analytics  `[ ]` (Section I — build 7th)
- [ ] BA activation, training, queue velocity, leader scorecards
- [ ] Export with PII redaction default
- DEP: leader detection (RESOLVED threshold); export PII redaction (open)

### 4.F Tenant Architecture  `[ ]` (Section F — build 8th)
- [ ] Master settings, template control, role/permission, content inheritance
- [ ] Master content validated at save-time (compliance fail-closed)
- DEP: compliance severity mapping (open)

### 4.G Kevin-Only Broadcast  `[ ]` (Section G — build LAST)
- [ ] Composer + per-recipient interpolation + preview
- [ ] Audience selector (all / first-72h / leaders / at-risk / custom, live count)
- [ ] Channel selector (email / text / both)
- [ ] Send-test-to-Kevin
- [ ] Queue master broadcast (triple-stack, per-recipient queue, async delivery, live status)
- [ ] Audit/consent guardrail (opt-out, STOP keyword, permanent exclusion)
- DEP: email provider (RESOLVED Resend, dormant) + Telnyx

### 4.J Audit / Controls  `[~]` (Section J.1-J.3 — build 2nd, SUBSTRATE)
- [x] Append-only audit log (every triple-stack write, every /admin request, every mutation)
- [x] Views: by actor / role / action / entity / timestamp
- [x] Before/after state on overrides, queue rule changes, compliance changes, master content saves
- [x] Michael transcripts linked from audit entries (no separate tab, #89)

---

## 5 · DRIFT / HYGIENE (non-blocking)

- [x] Relocate WELCOME LETTER pdf out of apps/com/public/assets (verified absent at content/hygiene pass — already not in tree)
- [x] Delete docs/_team-design-extract.txt scratch file (verified absent; also deleted `docs/_leaves.json` at content/hygiene pass)
- [x] Update build-registry.md to cover #122-#131; KEVIN-CONTEXT removed from source hierarchy in favor of momentum.decisions ledger (content/hygiene pass)
- [ ] Fix Dr. Dan "THREE CSO" brand-isolation drift in App-Description.docx Section 3

---

## OPEN DECISIONS BLOCKING BUILDS (from ledger + locked-spec Part 5)

Resolved: email=Resend(dormant) · flush=fixed-8wk · counter=SSE · webinar=Mon/Thu-5pmPT · leader-threshold · callback=two-radio · source-hierarchy(#129)

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
