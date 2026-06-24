# MCS v2 — Implementation Plan to Complete the App

Date: 2026-06-23
Source of truth: `docs/APP_STATE_AUDIT_PRINT_CHECKLIST_2026-06-23.md` (base `origin/main` @ `4a2b2df`)
Owner: Kevin La'Mont Gardner (TM-0001)

## Reading of the Audit

The app is structurally complete. Every route on all three surfaces (`.com`, `.team`, `/admin`) exists and is wired, the Express server mounts pre-gate prospect/admin routes and gated BA routes, and all four VM workers boot. The 162-item checklist is mostly **acceptance/verification**, not new construction.

What actually remains splits into five kinds of work. The plan is ordered so nothing is tested before the code and config it depends on are in place.

- **BUILD** — genuine missing or stubbed code. Small surface area.
- **CONFIG** — external launch dependencies (Resend, Telnyx, Anthropic, VM provider). No code; some gate features and have propagation latency, so they start early.
- **DECIDE** — forks only Kevin can resolve (implement vs. defer). Listed up front so they don't block execution.
- **VERIFY** — the bulk of the checklist: smoke + acceptance across surfaces.
- **RECONCILE** — stale docs (`project-wireframe.md`, `build-registry.md`) brought back to truth.

---

## Decisions Needed From Kevin (resolve before/early — they gate scope)

These are the audit's explicit "implement OR defer" forks. None blocks Phase 0, but each changes Phase 1 scope.

1. **`.com` root homepage `/`** — build a real landing page at `/`, or formally defer and keep the wildcard→`/p/invalid` behavior? (Audit item 34)
2. **VM ownership correction** — implement the mutation that actually moves ownership, or explicitly defer and leave it as a logged request? (Audit item 112)
3. **VM provider integration to our own dialer** — the VM provider is us:
   `D:\telnyx-voicemail-app` is a built ringless-voicemail platform (Telnyx
   backend, delivery/queue/compliance/suppressions, dist, tests, frontend,
   Momentum docs). MCS v2 is NOT yet wired to it — its provider layer registers
   `manual_csv` + `acquisition_provider_placeholder`, where the placeholder is a
   generic HTTP seam posting to `VM_ACQUISITION_PROVIDER_API_URL` /
   `VM_ACQUISITION_PROVIDER_API_KEY` (today unset; `getStatus` returns
   `status_lookup_not_configured`; `handleWebhook` echoes). DECISION: confirm we
   integrate MCS v2 to `telnyx-voicemail-app` as the provider for launch
   (vs. ship manual-CSV mode first). This is a build, not a vendor choice.
   (Audit items 111, 158.)
4. **Dossier / testimonial content** — confirmed deferred to a later version per the audit; confirm that holds for this completion pass. (Audit item, `.com` partial #5)
5. **Live agent surfaces (Michael/Steve/Ivory)** — launch with the live Anthropic-backed path, or ship with the dormant fallback and enable live post-launch? (Audit items 52/53, 157)

---

## Phase 0 — Foundation Lock (gates everything)

**Goal:** prove the current `main` builds, typechecks, and runs across all three apps before any acceptance work begins. Nothing downstream is meaningful until this passes.

VERIFY (audit items 1–10):
- Update all active worktrees to `main` at or after `4a2b2df`; confirm no stale feature work lives outside the intended worktree.
- `pnpm install` → `pnpm typecheck` → `pnpm build` → `git diff --check`.
- Boot server + all apps; confirm API health route responds.
- Confirm `.com`, `.team`, `/admin` all load in browser.
- Confirm Gateway is reachable on port **2526** (note: this is the app's expected port per the audit; the personal-memory gateway runs on 2525 — verify which the app config points at and that it answers).

**Exit criteria:** clean build, three apps load, API health green, gateway answers. No red here moves forward.

---

## Phase 1 — Close Genuine Code Gaps (the only real build work)

Everything here is actual missing/stubbed code. File paths are from the current tree.

### 1.1 Live Ops real data (VERIFY + 1-line flip — the build is DONE)
Correction (2026-06-23, verified against tree): the "H-server" is the server
side of /admin Section H Live Operations, and it is **already built and
mounted** — `server/src/domain/liveOps.ts` (570 lines, real gateway queries
against `brand_ambassadors`, `pool_placements`, `prospects`,
`michael_schedules`, `invitation_activity`), `server/src/routes/admin/liveOps.ts`,
imported in `server/src/index.ts`. The four endpoints (H.1 usage SSE, H.2 growth,
H.3 live grid, H.4 funnel) exist. The UI is also finished and reads
`@momentum/shared` contract types in both modes.
- The only remaining step is flipping `const USE_MOCKS = true;` → `false` in
  `apps/admin/src/routes/live-ops.tsx`. No other code change.
- Then verify: boot server, hit each endpoint, confirm panels render real data
  and the SSE usage strip emits a snapshot + heartbeat (curl -N), and audit
  entries append per request.
- (Audit items 92–96.) **Exit:** flag flipped; all four panels show real data;
  SSE/fallback behaves. Do NOT rebuild the endpoints — they are done.

### 1.2 Tenant Architecture URL-structure panel (BUILD)
The one explicit open build item in `/admin`. Add the read-only URL-structure panel to the tenant route. (Audit items 102–103.) **Exit:** tenant route shows current tenant config + the read-only URL map.

### 1.3 VM admin stubs (BUILD + DECIDE)
In the admin VM surface, three items currently report stub status:
- **Notification hooks** — wire to the real notifier or get explicit approval to ship stubbed. (Item 113)
- **Ownership correction** — implement the mutation or formally defer (Decision #2). (Item 112)
- **Provider integration** — wire MCS v2's `acquisition_provider_placeholder`
  adapter to our own `D:\telnyx-voicemail-app` (Decision #3). Concretely:
  (a) check `telnyx-voicemail-app/docs/API_ENDPOINT_MAPPING.md` for its send
  endpoint; (b) set `VM_ACQUISITION_PROVIDER_API_URL` + `_API_KEY` +
  `VM_LIVE_DELIVERY_ENABLED`; (c) implement `getStatus` + `handleWebhook` to map
  the dialer's Telnyx delivery/click events back into MCS v2 RVM token state;
  (d) rename the provider key from `acquisition_provider_placeholder` to a real
  name (e.g. `momentum_voicemail`). (Item 111)
**Exit:** each VM admin item is either real or an explicitly recorded, approved deferral — no silent stubs.

### 1.4 `.com` root homepage (BUILD or DECIDE)
Per Decision #1: build the `/` route or record the deferral. (Item 34.)

### 1.5 Comment / status hygiene (RECONCILE)
Reconcile stale "placeholder" comments in `.com` presentation/dashboard files where the real component now exists, so the code stops contradicting itself. (Audit `.com` partial #4.) **Exit:** no comment claims "placeholder" for a shipped component.

---

## Phase 2 — Launch Dependencies (CONFIG — start in parallel with Phase 1)

These have external propagation latency (especially DNS/domain), so kick them off as soon as Phase 0 is green; don't wait for Phase 1 to finish. Several gate features that later phases test.

- **Resend domain verification for `teammagnificent.com`** — hard gate for: webinar confirmation email (`.com`, items 35/107/108) and broadcast email (`/admin`). Verify domain + sender; configure key. Until done, those paths stay dormant.
- **Telnyx** — validate credentials + webhook signing against current env (gates broadcast SMS and RVM send/click webhooks). (Items 155, 128.)
- **Anthropic key** — confirm presence for live agent-backed flows (Michael/Steve/Ivory). Tied to Decision #5; either way the fallback path must be tested. (Item 157.)
- **VM provider credentials + webhook loop** — per Decision #3; test with real provider or approved manual mode. (Items 158, 121–122.)

**Exit:** each dependency is either verified-live or a recorded, approved dormant state with tested fallback.

---

## Phase 3 — Agent & Data-Flow Acceptance (VERIFY)

With code closed and keys resolved, confirm the intelligent surfaces actually move data.

- Michael gate (incomplete BA blocked), schedule, interview, transcript/event behavior. (Items 38–42.)
- Steve discovery route + persistence — confirm the discovery flow writes its triple-stack (`steve_discoveries` Mongo, Neo4j nodes, `mcs_steve_discoveries` Chroma) and **read it back to verify**. Confirm Steve never mutates Michael's state. (Items 43–44.)
- Ivory / ScriptMaker fallback-when-keys-missing AND live-when-keys-present. (Items 52–53.)
- Cockpit loads real BA data: sponsor, invitation, CRM summary, orientation/training cards. (Items 45–49.)

**Exit:** each agent flow persists/read-back-verifies; fallback and live paths both confirmed.

---

## Phase 4 — VM/RVM End-to-End (VERIFY — the money path)

The full prospect pipeline, `.team` → `.com`, exercised once end to end. This is the core business loop; treat as a single contiguous acceptance run. (Audit items 118–129.)

1. Import a fixture VM/RVM batch.
2. Confirm prospects are tokenized but **not placed into Holding Tank before `video_complete`**.
3. Send a manual/provider RVM test → provider delivery status updates.
4. Click activation / webhook updates token status.
5. Video milestones (start, quarter, half, three-quarter, complete) update token status.
6. `video_complete` places prospect into the correct post-video state and reveals dashboard.
7. Callback request and webinar reservation each create the expected **BA-facing** alert (addressed to the correct BA, not a hard-coded person — item 137).
8. Suppression + duplicate handling; provider failure/retry behavior.
9. Admin can audit the entire RVM path end to end.

**Exit:** one clean E2E pass with no premature placement and correct alert routing.

---

## Phase 5 — Compliance & Copy Gate (VERIFY — hard launch blocker)

NWM compliance. This gates launch regardless of how testing elsewhere is going. Scan every rendered `.com` surface AND all outbound SMS/email copy. (Audit items 130–138, 31.)

- No income claims, placement promises, spillover language, company branding/logo, AI-prospecting language, or current team head count on any prospect-facing page or outbound message.
- **Holding Tank / Live Place carve-out (locked-spec §3.10, disambiguated 2026-06-23):** the behind-you/beneath-you placement counter and recent-placements ticker ARE permitted — do NOT flag them as head-count violations. Instead verify they stay inside the carve-out: real placement events only, §3.8 disclaimer present verbatim, "benefit" framed as positional/spillover (never financial), and no earnings/CV/cycle/volume/rank or placement-equals-leg-position language attached. Total organizational head count remains prohibited.
- Alerts say the correct BA will reach out (no hard-coded person).
- PMV wording stays **People, Momentum, Volume, Checks**.

**Exit:** documented clean compliance scan across all prospect-facing copy and outbound messaging.

---

## Phase 6 — Surface Acceptance Smoke (VERIFY — the bulk)

Run each surface, desktop + mobile. These are the largest blocks of the checklist; grouped by surface so a worktree can own one surface at a time.

- **`.com`** — token states (valid/invalid/expired/enrolled), all PMV + RVM milestone writes, dashboard-only-after-complete, no-premature-Holding-Tank, callback/webinar CTAs, re-entry login + magic link, desktop + mobile. (Items 11–33.)
- **`.team`** — register/login, Michael gate, all training + Fast Start modules, invitation mints PMV tokens that open on `.com`, CRM, VM campaign create/import/list with tokens opening on `.com`, profile settings, leadership, onboarding/sponsor workbook, preview sandbox writes nothing persistent, desktop + mobile. (Items 36–75.)
- **`/admin`** — admin gate + non-admin rejection, dashboard real data, access codes, BA + prospect oversight with audited interventions/notes, queue, audit/reports with CSV + PDF exports + redaction, orientation, broadcast SMS (and email once Resend is live), VM overview + provider health, agents/outbox real records, desktop + admin viewport. (Items 76–117.)

**Exit:** every surface passes desktop + mobile smoke with real data.

---

## Phase 7 — Docs Reconciliation & Launch Ops (RECONCILE + VERIFY)

### 7.1 Bring docs back to truth (do before using them as readiness source)
- Reconcile `docs/project-wireframe.md` parent rows that show partial while their child leaves are checked. (Item 139.)
- Update `docs/build-registry.md` to match shipped state — the audit flags it as stale. (Item 140.)
- Record the Phase-0 decisions in the decision ledger. (Item 143.)
- Keep `APP_STATE_AUDIT_PRINT_CHECKLIST_2026-06-23.md` updated after each closing pass. (Item 144.)

### 7.2 Launch operations (final gate)
- Production `.env` for server, `.com`, `.team`, `/admin`; cookie domain + CORS; `ADMIN_BA_IDS` allowlist. (Items 145–150.)
- Connectivity: MongoDB, Neo4j, ChromaDB, Gateway @ 2526, Telnyx, Resend, Anthropic (if live agents), VM provider. (Items 151–158.)
- Final desktop smoke across all three; final mobile smoke on `.com`/`.team`; final admin-viewport smoke. (Items 159–161.)
- Confirm no uncommitted production changes; record branch, commit, deployment tags. (Items 162–163.)

**Exit:** docs match reality, all connectivity green, final smokes pass, release tagged.

---

## Critical Path (sequencing summary)

```
Phase 0 (Foundation Lock) ── gates ──> everything
        │
        ├─ Phase 2 (Resend/Telnyx/Anthropic/VM) starts in parallel — external latency
        │
        └─> Phase 1 (close code gaps)
                 │
                 └─> Phase 3 (agents) ─> Phase 4 (VM/RVM E2E)
                                              │
                 Phase 5 (Compliance) ── independent hard gate, can run anytime after copy is frozen
                                              │
                                              └─> Phase 6 (surface smoke) ─> Phase 7 (docs + launch ops)
```

No time estimates are attached by design — sequence first, Kevin sets pace.

## What Is NOT in This Plan (explicitly out of scope for completion)
- Dossier / testimonial content (deferred to a later version — confirm via Decision #4).
- Any Hot/Warm/Cold prospect scoring — intentionally excluded by locked architecture; `.com` tracks video-progress observations only.
