# Build Registry — Team Magnificent Momentum Creation System v1

**Purpose.** A single index of every artifact that has been produced for the Momentum Creation System v1 build, where it lives, what state it's in, which chat locked it, and what (if anything) it supersedes. Read this BEFORE asking "is X done?" — the answer is here.

**Source hierarchy** (when this file conflicts with another, the higher source wins):
1. `docs/locked-spec.md` — authoritative spec
2. `D:/claude-learning/KEVIN-CONTEXT.md` — running session log
3. This file (`docs/build-registry.md`) — artifact index
4. Git log on `github.com/devklg/momentum-creation-system-v1`
5. Perry handoffs in MongoDB `session_handoffs` (last-resort lookup)

**How to read the status column:**
- `drafted` — exists as a prototype or working copy, not yet reviewed by Kevin
- `reviewed` — Kevin has seen it, may have markup pending
- `approved` — Kevin has signed off on the content; safe to wire into production
- `wired` — code in the v1 repo references or implements it
- `live` — pushed to GitHub on `main`, present in the working app
- `superseded` — replaced by a later artifact (named in the Supersedes column)
- `pending` — known to be needed, not yet started

**How to update this file.** When an artifact is produced, ships, or supersedes another, add or update its row. Keep one row per artifact, not per chat. The Chat Locked column points to the chat that finalized its current state.

---

## 1. Design documents (the four-doc design set + spec)

| Artifact | Where it lives | Status | Chat Locked | Supersedes | Notes |
|---|---|---|---|---|---|
| `locked-spec.md` (v2, 463 lines, six-part structure) | `D:/momentum-creation-system-v1/docs/locked-spec.md` | live | #94 | locked-spec.md v1 (157 lines) | Operating frame as Part 1. Authoritative source-of-truth. Read first, every session. |
| `Team-Magnificent-App-Description.docx` | `D:/momentum-creation-system-v1/docs/` | reviewed | #85 | — | Readback of the app in Kevin's words. Contains drift item: Section 3 names Dr. Dan as "THREE International's Chief Scientific Officer" — violates locked-spec 3.8 brand isolation, correct on port. |
| `Team-Magnificent-Signup-Architecture.docx` | `D:/momentum-creation-system-v1/docs/` | approved | #94 (E.1 closed) | — | 10-step server sequence on `/register`. Access code format closed in #94 (TM-XXXX 4-char, 31-char alphabet). 5 open questions remaining in Section E. |
| `Team-Magnificent-COM-Design.docx` | `D:/momentum-creation-system-v1/docs/` | approved | #88 (H.1 closed) | — | Prospect-facing surface. Brand isolation 3.8 locked. 9 open questions; H.1 resolved 2026-05-17 (page is never anonymous). |
| `Team-Magnificent-TEAM-Design.docx` | `D:/momentum-creation-system-v1/docs/` | approved | #86 (J.3 closed in #94) | — | BA-facing surface. Welcome click-acknowledge locked in #94. 12 open questions, J.3 resolved. |
| `Team-Magnificent-ADMIN-Design.docx` | `D:/momentum-creation-system-v1/docs/` (Kevin downloaded from chat UI) | approved | #89 | — | Kevin-only surface. 9 sections. Compliance review removed; enforcement lives at script-time + render-time. 10 open questions in J.5. |
| `Team-Magnificent-App-Style-Guide.html` | `D:/momentum-creation-system-v1/docs/` | approved | #82 token block | — | Canonical brand tokens, fonts, atmospheric treatment. Reused verbatim across all prototypes. |

---

## 2. Prototype artifacts (HTML, pre-React)

| Artifact | Where it lives | Status | Chat Locked | Supersedes | Notes |
|---|---|---|---|---|---|
| `dashboard-prototype.html` (1,437 lines, six locked sections) | `D:/momentum-creation-system-v1/docs/` + project knowledge | approved | #82 | — | The locked dashboard design. Footer drift item: "operational team inside THREE International" violates 3.8; correct on port to `apps/com`. |
| `tm-prospect-glp3-v3-UPDATED.html` (presentation page reference) | `D:/momentum-creation-system-v1/docs/` (reference only) | superseded | #99 | — | Working sketch. Superseded by the React tm-video-presentation in `apps/com`. |
| `preview.html` (standalone 11-section tm-video-presentation preview) | `D:/momentum-creation-system-v1/docs/` + Kevin's downloads | approved | #107 | — | Standalone single-file preview with live name-swap controls. Mirrors the React composer. Section 8 renders luxury-favorite.jpeg as-is. |
| `welcome-prototype-v2.html` (the /welcome screen prototype) | `/mnt/user-data/outputs/` (Chat #95 session) | drafted | #95 | welcome-prototype-v1 | Letter's voice, shorter format, click-acknowledge routes to /michael/schedule. **Markup pending.** |
| `welcome-letter-v2.html` (long-form welcome email) | Local disk + `github.com/devklg/team-magnificent-training` | approved | #95 | welcome-letter v1 | Full 7-day arc (Days 1–4 learn, Days 5–7 2-in-72). User confirmed done 2026-05-21. |
| `day1-prototype.html` (Fast Start Day 1) | `/mnt/user-data/outputs/` (Chat #95 session) | drafted | #95 | — | Three GLP-THREE packs side-by-side (Essential/Advantage/Complete), Essential visually emphasized, receiving-end framing, PDR foundation. **Markup pending.** |

---

## 3. Reference assets

| Artifact | Where it lives | Status | Chat Locked | Supersedes | Notes |
|---|---|---|---|---|---|
| `luxuryfavorite.jpeg` (Kevin's before/after marketing image) | `D:/TEAM-MAG/before-after/luxury-favorite.jpeg` (source) + `apps/com/public/assets/luxury-favorite.jpeg` (recompressed 216KB) | live | #95 (canonized) | — | Section 8 hero asset. Drift item: copy in `apps/com` is 216KB vs 254KB source — verify intentional. |
| `assets/logos/logo_dark_hero.png` | `D:/momentum-creation-system-v1/assets/logos/` | live | #92 (wired) | — | Team Magnificent wordmark for `apps/team` register page. Served by Vite via `publicDir` config. |
| THREE product fact sheets (15 PDFs: GLP-THREE + Simple Six + Visage + Kynetik + price sheet) | Project knowledge (Chat #95 upload) | reference | #95 | — | Source material for product claims. Day 2 Fast Start centerpiece. Cellular absorption + Dr. Dan + PDR + Collagène 60-day focus study (73% absorption, 99% recommend). |
| THREE Financial Rewards Plan v12.1 NAM-ENG (2026) | Project knowledge | reference | #95 | — | Authoritative source for every comp-plan dollar figure. PIB tiers: 25% (20–199 CV) / 28% (200–299) / 33% (300+). Cycles $35 on 300/600 CV. |
| Dr. Dan Gubler GLP-THREE video (YouTube `1IZiV7RXdCY`, 17 min) | YouTube | live | #39 | — | The product video. Foundation of the presentation page. |

---

## 4. Server (apps/server/)

| Artifact | Where it lives | Status | Chat Locked | Supersedes | Notes |
|---|---|---|---|---|---|
| Express boot + env loader + gateway client + triple-stack helper | `server/src/` | live | #92 | — | Foundation. `findRepoRoot` walks up to `pnpm-workspace.yaml` marker. |
| `POST /api/auth/verify-code` | `server/src/routes/auth.ts` | live | #92 | — | Live access-code validation, debounced from client. |
| `POST /api/auth/register` | `server/src/routes/auth.ts` | live | #92 | — | 10-step sequence per Signup Architecture A.4. Argon2 password hash, TMBA-YYYYMMDD-XXXXXX BA ID, sponsor immutability at step 2, JWT cookie scoped to `.teammagnificent.team`. |
| `server/src/domain/access-codes.ts` | `server/src/domain/` | live | #92 | — | `findAccessCode`. |
| `server/src/domain/ba.ts` | `server/src/domain/` | live | #92 | — | `registerBA` with argon2, `emailExists`, `threeBaIdExists`. |
| `server/src/domain/codeGen.ts` (TM-XXXX generator) | `server/src/domain/` | live | #94 | — | 4-char codes, 31-char alphabet excluding 0/O/1/I/L (~924k codes). |
| `server/src/domain/commitments.ts` (welcome commitment triple-stack) | `server/src/domain/` | live | #94 | — | Triple-stack write on "I accept" click. |
| `server/src/middleware/requireAuth.ts` (+ `requireAdmin` hard 403) | `server/src/middleware/` | live | #94 | — | `ADMIN_BA_IDS` env-var gate per ADMIN A.2. |
| `POST /api/welcome/load` + `/accept` | `server/src/routes/welcome.ts` | live | #94 | — | Welcome page server endpoints. |
| `POST /api/admin/access-codes` + `GET /api/admin/access-codes` | `server/src/routes/admin/access-codes.ts` | live | #94 | — | Admin code generator + list. |
| Founder seeding (TM-01 Kevin + TM-02 Paul) | MongoDB `momentum.brand_ambassadors` | live | #97 | placeholder TMBA-ROOT-KEVIN | Real founders seeded via mintAccessCode flow. |
| Timezone field on registration + Michael call-gating | `server/` | live | #98 | — | Per locked-spec Part 5 J.4 partial close. |
| Auth routes + Telnyx webhook + call origination + Admin scaffold + tsconfig fix | `server/src/` + `apps/admin/` | live | #102 | — | Telnyx integration foundation for Michael outbound voice. |
| `apps/com` scaffold + prospect/token domain + `GET /api/p/:token` | `apps/com/` + `server/src/domain/prospect.ts` | live | #104 | — | Phase 1 prospect flow at `/p/{token}` per locked-spec Part 4. |
| Holding-tank domain + `POST /api/p/:token/video-event` | `server/src/domain/holding-tank.ts` + `server/src/routes/p.ts` | live | #105 | — | Video milestone events fire monotonic position assignment at `video_complete`. Triple-stack write. |
| `/p/:token` token-lifecycle edge cases (409 enrolled + 410 expired) + EnrolledResponse/ExpiredResponse types | `server/src/routes/p.ts` + `packages/shared/types.ts` | live | #110, #111 | — | Lazy-flush at read time. F.1/F.2/E.2/F.4–F.6 error views in client. Commit `8216311`. |

---

## 5. Client — apps/team (BA-facing)

| Artifact | Where it lives | Status | Chat Locked | Supersedes | Notes |
|---|---|---|---|---|---|
| Vite + Tailwind + shadcn scaffold | `apps/team/` | live | #92 | — | Brand tokens in `tailwind.config.ts`. Compass-rose logo header. |
| `/register` page (10 fields, sponsor confirmation card, password strength, debounced code validation) | `apps/team/src/routes/register.tsx` | live | #92 | — | Working end-to-end test: Sally Sue registered TMBA-20260518-8KVZ2Q via TM-TEST. |
| `/welcome` page (click-acknowledge per TEAM C.4) | `apps/team/src/routes/welcome.tsx` (209 lines) | wired | #94 | hero "You just hit the lottery" v1 | Voice + atmosphere match welcome-letter-v2.html. Routes to /michael/schedule on accept. **Needs audit against locked-spec v2 per Chat #95 carry-forward.** |
| `/cockpit` stub ("Cockpit coming soon") | `apps/team/src/routes/cockpit.tsx` (27 lines) | live | #94 | — | Real cockpit per TEAM Design Section H is Phase 4. |
| Questionnaire + sponsor workbook routes + onboarding/sponsor surfaces | `apps/team/src/routes/` | live | (carry-forward `3418d61`) | — | Pushed alongside Chat #104. |
| Welcome-prototype-v2 reconciliation into `/welcome` | `apps/team/src/routes/welcome.tsx` | pending | #95 (drafted) | welcome.tsx (current) | Needs to merge the v2 prototype's letter-voice + 7-day-arc strip into the live route. |

---

## 6. Client — apps/com (prospect-facing)

| Artifact | Where it lives | Status | Chat Locked | Supersedes | Notes |
|---|---|---|---|---|---|
| Vite scaffold | `apps/com/` | live | #104 | — | Brand tokens, Tailwind, port 7701. |
| `/p/:token` route (token resolve, presentation page or dashboard based on state) | `apps/com/src/routes/p-token.tsx` | live | #104, extended #110/#111 | — | F.1/F.2/E.2/F.4–F.6 error views verbatim per locked-spec Part 4.9. |
| `tm-video-presentation` composer (11 sections + ticker strip) | `apps/com/src/routes/tm-video-presentation/tm-video-presentation.tsx` | live | #108, #109 | Chat #106 composer | Section 01–11 + ticker. Reconciliation note: B's 11-section structure + A's verbatim copy where B is silent. |
| Section 00 — TickerStrip | `sections/00-TickerStrip.tsx` | live | #107 | — | Fixed top bar (A1 copy). |
| Section 01 — PersonalOpen | `sections/01-PersonalOpen.tsx` | live | #106 | — | Hero stagger reveal. Locked Chat #39 schematic. |
| Section 02 — Invitation | `sections/02-Invitation.tsx` | approved | #117 | placeholder | Copy APPROVED by Kevin Chat #117 (Version 2 — the Chat #108 three-factor framing; the earlier preview.html "thirty years to assemble" wording was rejected as a fabricated track record). WORKING-COPY flag cleared. |
| Section 03 — DrDanVideo | `sections/03-DrDanVideo.tsx` | live | #107 | — | YouTube IFrame state machine. fires milestone events to `/api/p/:token/video-event`. Section 3 seekTo verification for mid-stream return-visits pending. |
| Section 04 — Market | `sections/04-Market.tsx` | live | #107 | — | IntersectionObserver count-up. |
| Section 05 — PharmaceuticalSolution | `sections/05-PharmaceuticalSolution.tsx` | live | #107 | — | — |
| Section 06 — NaturalPath | `sections/06-NaturalPath.tsx` | live | #107 | — | MBC-267 + comparison table. |
| Section 07 — Dossier | `sections/07-Dossier.tsx` | live | #107 | — | Accordion + gated PDF. **`DOSSIER_AVAILABLE = false`**: PDF needs to drop at `apps/com/public/dossier/glp-three-dossier.pdf` then flip the flag. |
| Section 08 — KevinStory | `sections/08-KevinStory.tsx` | live | #107 | — | luxury-favorite.jpeg as-is, full-bleed, no rebuilt card. Locked-spec 4.7. |
| Section 09 — Timing | `sections/09-Timing.tsx` | live | #107 | — | Three-factor convergence + locked Bebas closing. |
| Section 10 — QuietDoor (callback-request form) | `sections/10-QuietDoor.tsx` | approved | #117 | placeholder card | Two soft-CTA radios (interested / have questions) + "Have [BA] reach out" button + confirmation state. Copy APPROVED by Kevin Chat #117. **Both "Take your time / no clock on this page" footnotes REMOVED Chat #117** — inconsistent with the forthcoming 72-hour dashboard clock. (Note: the historical "three intent radios + phone + best time" description was superseded by the Chat #109 two-radio no-phone design.) |
| Section 11 — Footer | `sections/11-Footer.tsx` | live | #107 | — | BA attribution + G.5 disclaimer. |
| `og-injection.ts` middleware | `apps/server/src/middleware/og-injection.ts` | live | #107 | — | Token-resolved OG metadata. Requires marker pair in `apps/com/index.html`. |
| Dashboard six locked sections (Arrival → Opportunity → Mechanic → Live → Advantage → Next Move) | `apps/com/src/routes/tm-prospect-dashboard/` (composer + 7 section files) | wired | #114 | placeholder | Ported from `dashboard-prototype.html` Chat #114. **Chat #84 correction applied to Section 4**: behind-only counter, vertical layout, no left/right columns, no ahead-of-you tile. **Chat #112 drift correction applied to Footer**: Team Magnificent branding only, no THREE reference, locked-spec 3.10 compliance disclaimer verbatim. Rendered from `tm-video-presentation.tsx:169` when placement resolves. Typecheck GREEN. |

---

## 7. Client — apps/admin (Kevin-only)

| Artifact | Where it lives | Status | Chat Locked | Supersedes | Notes |
|---|---|---|---|---|---|
| Vite scaffold + ADMIN_BA_IDS gate middleware | `apps/admin/` | live | #102 | — | Hard 403 for non-allowed BAs. Port 7703. |
| Access code generator UI | `apps/admin/src/routes/` | pending | — | — | Calls existing `POST /api/admin/access-codes`. ADMIN-Design Section A.4.1 surface. |
| 9 admin surfaces (B–J per ADMIN-Design) | `apps/admin/src/routes/` | pending | #89 (design locked) | — | Build sequence in ADMIN J.6: gate → audit log → Core Dashboard → BA/Prospect Oversight → Queue → Live Ops → Reporting → Tenant → Broadcast. |

---

## 8. Shared package

| Artifact | Where it lives | Status | Chat Locked | Supersedes | Notes |
|---|---|---|---|---|---|
| Brand TS constants + CSS variables | `packages/shared/src/brand.ts` + `brand.css` | live | #92 | — | `--ink #0A0A0A`, `--gold #C9A84C`, `--gold-bright #F5C030`, `--teal #2DD4BF`, `--cream #F5EFE6`. |
| Compliance constants (`COMPLIANCE_FRAME`, `NEVER_ON_COM`, `COM_DISCLAIMER`) | `packages/shared/src/compliance.ts` | live | #92 | — | Reads at script-time (ScriptMaker) and render-time (platform). |
| Standing rules (4 const exports) | `packages/shared/src/rules.ts` | live | #92 | — | THREE-final-authority, sponsor immutability, monotonic queue, 8-week flush, brand isolation. |
| Shared types: `TokenState`, `CallbackIntent`, `TripleStackWriteResult` | `packages/shared/src/types.ts` | live | #92 | — | — |
| `EnrolledResponse` + `ExpiredResponse` types (token-lifecycle 409/410) | `packages/shared/src/types.ts` | live | #110 | — | Added in Chat #110 step B, used by p-token.tsx F.1/F.2 views. |

---

## 9. Infrastructure & seeded data

| Artifact | Where it lives | Status | Chat Locked | Supersedes | Notes |
|---|---|---|---|---|---|
| Port allocation 7700–7799 reserved for MCS | `D:/server-gateway-mcp/PORT-REGISTRY.md` (changelog 2026-05-18) | live | #92 | — | 7700 server / 7701 com / 7702 team / 7703 admin. |
| GitHub repo `devklg/momentum-creation-system-v1` (private, main) | https://github.com/devklg/momentum-creation-system-v1 | live | #92 | `devklg/momentum-creation-system` (abandoned) | 11 commits as of Chat #111, latest `8216311`. |
| MongoDB `momentum.access_codes` (TM-01 + TM-02 + TM-TEST seeded) | MongoDB universal_gateway | live | #97 | #92 placeholder | TM-01 Kevin, TM-02 Paul, TM-TEST for end-to-end testing. |
| Neo4j BA graph (founders + test BA, SPONSORED_BY edges, 5 camelCase constraints) | Neo4j on Universal Gateway | live | #97 | Onboarding OS residue (cleaned #94) | Constraints: `ba_baId_unique`, `ba_threeBaId_unique`, `ba_email_unique`, `accesscode_code_unique`, `commitment_id_unique`. |
| ChromaDB MCS collections (`mcs_commitments`, `mcs_access_codes`) | ChromaDB localhost:8100 | live | #94 | — | Bootstrapped during welcome flow build. |
| Maxwell GPU embedding service autostart (Windows Task Scheduler) | `D:/agents/doc-parser/gpu-embeddings-service/` | live | #92 | — | Triggers on user logon. Required for ChromaDB writes through gateway. |
| `.gitignore` includes `.handoff/` | `D:/momentum-creation-system-v1/.gitignore` | live | #111 | — | Per-session Perry write/verify files stay local. |

---

## 10. Pending — design-locked, not yet built

| Artifact | Spec Source | Chat Locked | Notes |
|---|---|---|---|
| Dashboard six locked sections (React port from `dashboard-prototype.html`) | COM Design Section C | #114 SHIPPED | Ported Chat #114 to `apps/com/src/routes/tm-prospect-dashboard/`. Footer drift correction applied (Team Magnificent only, no THREE). Chat #84 Section-4 correction applied (behind-only). Typecheck GREEN. |
| Real `/cockpit` (My Sponsor card + My Invites + CRM per invite) | TEAM Design Section H | #85 scope locked | Currently a stub. |
| Michael interview surface (3 states: Awaiting / In Progress / Complete) | TEAM Design Section D | #86 | Telnyx + STT wired #102. UI pending. |
| Fast Start Guide 5 modules | TEAM Design Section E | #86 + #95 7-day arc | Day 1 prototype drafted. Days 2–7 pending. |
| 10-step orientation surface | TEAM Design Section F + locked-spec | #100 curriculum ported | Currently scheduling-only; live hosted by Kevin/Paul. |
| Invitation generator (Ivory + ScriptMaker + token mint) | TEAM Design Section G | #86 | Verbatim agent roles transcribed. Build pending. |
| Replicated .com preview at `/preview` (sandboxed token) | TEAM Design Section I.1 | #86 | Standalone preview.html exists; in-app version pending. |
| 9 admin surfaces (B through J per ADMIN-Design) | ADMIN-Design | #89 | Scaffold gated #102. Surfaces pending. |
| Real-time SSE for behind-you counter + position stack | `server/src/services/poolEvents.ts` + `GET /api/p/:token/stream` + `apps/com/src/lib/usePlacementStream.ts` | #114 SHIPPED | **AUDIT CORRECTION**: previously listed here as "open question H.6 (SSE vs short-poll)." That was wrong — SSE was LOCKED in locked-spec 4.4 AND in Kevin's Phase 3 specification in project knowledge. Shipped Chat #114: in-process EventEmitter pub/sub, snapshot+placement+30s heartbeat. |
| Webinar event entity + reservation backend | `server/src/domain/webinarEvent.ts` + `server/src/domain/webinarReservation.ts` + `POST /api/p/:token/webinar-reserve` | #116 SHIPPED | Event entity + reservation triple-stack write + Telnyx BA SMS LIVE. Prospect-facing email-with-Zoom-link WIRED Chat #116 via Resend (see rows below) — DORMANT pending domain verification. Cadence RESOLVED Chat #116 (Mon/Thu 5pm Pacific) and SEEDED — `webinar_events` now populated. |
| Webinar cadence generator | `server/src/domain/webinarCadence.ts` | #116 SHIPPED | Pure DST-correct generator for Mon/Thu 5pm Pacific slots over an N-week horizon. Per-date America/Los_Angeles offset resolution (no hardcoded offset) so re-seeds across the Nov DST flip stay correct. Typecheck GREEN. |
| Webinar event seeder | `server/scripts/seed-webinar-events.ts` (`pnpm seed:webinar-events`) | #116 SHIPPED | Idempotent rolling-8-week triple-stack seeder (Mongo `webinar_events` + Neo4j `:WebinarEvent` + Chroma `mcs_webinar_events`). Ran Chat #116: 16 events created (May 26–Jul 17), all three stores verified. ChromaDB collection `mcs_webinar_events` created Chat #116 (CK-04). findNextUpcomingEvent() now returns the live next slot — dashboard countdown ticks, reserve endpoint no longer 404s. Auto-replenish cron deferred. |
| Resend email transport | `server/src/services/resend.ts` | #116 WIRED — DORMANT | Thin transport mirroring telnyx.ts. ResendConfigError (missing key) / ResendError (non-2xx), best-effort. **Untested against a live domain** — teammagnificent.com not yet verified in Resend (Namecheap DNS deferred by Kevin until app complete). Empty EMAIL_API_KEY → ResendConfigError → emailDeliveryStatus='skipped', BA-SMS fallback stays live. Sends begin with no code change once key + verified domain land. env vars EMAIL_PROVIDER/EMAIL_API_KEY/EMAIL_FROM/EMAIL_REPLY_TO added to env.ts + .env + .env.example. Typecheck GREEN, env boot verified. |
| Webinar Zoom link config | `WEBINAR_REGISTER_URL` env → `webinar_events.zoomUrl` | #116 SHIPPED | One persistent recurring Zoom registration link for all sessions, threaded into the reservation domain + confirmation email. Future Zoom S2S OAuth per-occurrence-link sync agent deferred (Kevin's paid plan supports it); `zoomUrl` already nullable per-event to accept it without migration. |

---

## 11. Open spec questions blocking future builds

From `locked-spec.md` Part 5, ordered roughly by what blocks earliest builds:

1. ~~**Email provider**~~ — *RESOLVED Chat #116: Resend, wired dormant pending teammagnificent.com domain verification.*
2. ~~**Webinar cadence (H.3)**~~ — *RESOLVED Chat #116: Mon/Thu 5pm Pacific, seeded 8-week rolling.*
3. **Michael's 5 interview prompts** — blocks: Michael interview surface. Placeholder list in TEAM D.4.
3. **10-step orientation curriculum titles + order** — partially closed in #100 port; Kevin's verbatim curriculum still pending.
4. **8-week flush adaptive vs fixed** — blocks: queue rule management in ADMIN E.6. Architecture doc says adaptive; design assumes fixed.
5. ~~**Behind-you counter update interval** — SSE vs short-poll. Engineering choice affects Live Ops live tiles.~~ **RESOLVED #114**: SSE. Was never actually open — locked in locked-spec 4.4 + Phase 3 spec; Chat #112 audit misclassified. Shipped Chat #114.
6. **Position stack visible window** — 5 / 10 / 20 cards. Sets in ADMIN E.3.
7. **Sponsor-leaves behavior** — auto-roll-up vs locked-with-escalation-contact (TEAM J.7).
8. **Phone change verification** — SMS code vs immediate effect (TEAM J.8).
9. **Fast Start gating** — sequential-but-not-gated current default; should some modules gate access (TEAM J.9)?
10. **Orientation scheduling mechanism** — Calendly embed / custom picker / manual sponsor outreach (TEAM J.10).
11. **Re-invite cooldown** — per-N-days or max-M-total (TEAM J.11).
12. **Notification preference defaults** — which alerts SMS/email/in-app by default (TEAM J.12).
13. **Market/geographic tracking** — collect region as a dimension (ADMIN J.5.4)?
14. **Compliance enforcement severity mapping** — block/warn/log per rule (ADMIN J.5.9).
15. **Export PII redaction default** — per-export confirmation vs persistent preference (ADMIN J.5.10).
16. **Webinar cadence** — every 72h or weekly Tuesday (COM H.3).
17. **Leadership track records placement inside .team** — added in #94 from leadership-as-structural-advantage clarification.

---

## 12. Known drift items

Tracked because they need fixing during a port or audit, not because they block anything today.

| Drift | Where | Notes |
|---|---|---|
| `luxury-favorite.jpeg` size mismatch | `apps/com/public/assets/luxury-favorite.jpeg` 216KB vs `D:/TEAM-MAG/before-after/luxury-favorite.jpeg` 254KB source | Confirm intentional recompression or overwrite. |
| Dr. Dan named as "THREE International's Chief Scientific Officer" | `Team-Magnificent-App-Description.docx` Section 3 | Violates locked-spec 3.8 brand isolation. Correct on next docx edit. |
| ~~Footer "operational team inside THREE International"~~ **RESOLVED #114** | `dashboard-prototype.html` (original prototype unchanged) | Drift CORRECTED at port time in `apps/com/src/routes/tm-prospect-dashboard/sections/07-Footer.tsx`. Footer carries Team Magnificent branding only + locked-spec 3.10 disclaimer verbatim. |
| Welcome route on disk pre-dates locked-spec v2 audit | `apps/team/src/routes/welcome.tsx` | Chat #94 flagged: needs audit against locked-spec v2 operating frame. |
| Chat #84 transcript only in system prompt summary | (not in project knowledge as a transcript) | Kevin planned to transcribe and save as text file. Captured as `chat-84-architecture-revelation.txt` in project knowledge in Chat #94+. **VERIFIED PRESENT.** |

---

## 13. Build sequence so far (chat-by-chat, condensed)

For narrative context. Authoritative detail lives in `D:/claude-learning/KEVIN-CONTEXT.md`.

- **Chat #82** (2026-05-14) — Dashboard revelation. Six locked sections + Section 6 headline locked. Power-of-2 cascade + 100,000 destination + financial-freedom-in-conversation-only.
- **Chat #84** (2026-05-14) — Architecture revelation. Pool mechanic, two-stage placement, replicated site vs dashboard, no-programmatic-handoff, no save-spot, 8-week adaptive flush, Telnyx, Michael as outbound voice agent. 46-page inventory + Open Design wireframe prompt produced.
- **Chat #85** (2026-05-17) — Cockpit scope locked to 3 elements (My Sponsor / My Invites / CRM). Founder sponsor-card override pattern.
- **Chat #86** (2026-05-17) — TEAM Design docx delivered (9 sections, 12 open questions).
- **Chat #88** — COM Design H.1 resolved (page never anonymous).
- **Chat #89** (2026-05-18) — ADMIN Design docx delivered. BA-requested-emergency override framing locked. Compliance Review surface removed in favor of script-time + render-time enforcement. No algorithmic BA scoring.
- **Chat #90** (2026-05-18) — v1 directory cleanup. Standing rule: reading the design docs is not authorization to scaffold from them.
- **Chat #92** (2026-05-18) — Phase 0 scaffold + Registration end-to-end. Sally Sue test BA registered. Three-client architecture (apps/com + apps/team + apps/admin). Ports 7700–7799 reserved. pnpm 9. Vite 6 + React 19 + TS 5.5.
- **Chat #93** — Triple-stack persistence fully restored (ChromaDB GPU patch).
- **Chat #94** (2026-05-18/19) — Locked-spec v2 rewrite (157 → 463 lines, six-part structure, operating frame as Part 1). 12 layered clarifications. Access code TM-XXXX 4-char locked. Welcome click-acknowledge locked. /welcome + /cockpit stub shipped.
- **Chat #95** (2026-05-18) — Welcome v2 prototype + welcome-letter v2 + Day 1 Fast Start prototype. 7-day arc locked. Essential Pack default + no-front-loading principle. 70% statistic sourced (MLM.com/InfoTrax). 15 THREE product docs uploaded.
- **Chat #97** (2026-05-18) — Founders seeded (TM-01 Kevin + TM-02 Paul). Michael call-scheduling.
- **Chat #98** (2026-05-19) — Timezone on registration + Michael gate + founder backfill.
- **Chat #99** (2026-05-19) — tm-video-presentation + tm-prospect-dashboard naming, ticker design, 10-step curriculum, OpenGraph card, visual-lead principle (Section 8 jpeg as-is), locked assets.
- **Chat #100** (2026-05-19) — Spec gap closure + 10-step orientation port.
- **Chat #102** (2026-05-19) — Admin scaffold, tsconfig fix, auth routes, Telnyx webhook + call origination.
- **Chat #104** (2026-05-19) — apps/com scaffold + prospect/token domain + `GET /api/p/:token`.
- **Chat #105** (2026-05-19) — holding-tank domain + `POST /api/p/:token/video-event` (video milestones → monotonic position).
- **Chat #106** — Section 01 + composer + p-token route (superseded by #107).
- **Chat #107** — 11-section bundle (Sections 00, 02–11 + og-injection middleware).
- **Chat #108–#109** (2026-05-20) — tm-video-presentation 11 sections + Section 10 callback-request form.
- **Chat #110** — Token-lifecycle 409/410 spec + shared types (EnrolledResponse/ExpiredResponse).
- **Chat #111** (2026-05-21) — Token-lifecycle wiring: server routes/p.ts 409+410 enrichment with lazy-flush, apps/com api.ts payload parsing + p-token.tsx F.1/F.2/E.2/F.4–F.6 verbatim views. Commit `8216311`. preview.html broken image fix.
- **Chat #112** (2026-05-21, this chat) — Project knowledge readback + build registry file created.
- **Chat #113** (2026-05-21) — Dashboard wiring scaffolded: composer import added in `tm-video-presentation.tsx:51` and render branch wired at `:169` with full prop contract. (Build went RED — actual six-section files weren't yet on disk; corrected in #114.)
- **Chat #114** (2026-05-21) — **Dashboard six-section port complete.** Shared types extended (PlacementTickerEntry, HoldingTankSnapshot, PlacementEvent, WebinarEvent, WebinarReservation*). Server: `services/poolEvents.ts` (in-process EventEmitter), `domain/holdingTank.ts` modified (publish after step 5 + snapshot builder), `domain/webinarEvent.ts` + `domain/webinarReservation.ts` new, `routes/p.ts` extended with `GET /:token/stream` SSE + `POST /:token/webinar-reserve`. Client: `lib/usePlacementStream.ts` React hook around EventSource + `lib/api.ts` postWebinarReservation, `routes/tm-prospect-dashboard/` composer + 7 section files (Ribbon, Arrival, Opportunity, Mechanic, LivePlace, TmAdvantage, YourNextMove, Footer). Chat #84 correction to Section 4 (behind-only, vertical). Chat #112 drift correction to Footer (TM only). Third callback intent `ready_to_join` wired in UI (server already supported). Typecheck GREEN: shared, server, apps/com, apps/team, apps/admin. Two locked-spec amendments queued (Part 3.4, Part 4.4). SSE was-locked-not-open audit correction recorded.

---

*Last updated: 2026-05-22 (Chat #117). Update this file at the end of every chat that ships an artifact, supersedes one, or closes an open spec question.*
