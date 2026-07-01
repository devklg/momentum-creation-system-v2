# P10.9 — Production Release Checklist (Go / No-Go)

**Phase:** 10 — DevOps, Security, Environments, and Operations
**Item:** P10.9 — Production Release Checklist
**Mode:** Documentation only (audit/planning gate). No production-affecting change is applied by this document.
**Author:** Claude Code (Instance 2), Phase 10 worktree
**Date:** 2026-06-30
**Companion:** `engineering/reports/SPRINT_010_PHASE_10_DEVOPS_SECURITY_OPERATIONS_VERIFICATION.md` (findings H1–H9), `docs/DEPLOYMENT_GUIDE.md` §8/§3.6, `ROADMAP.md` M9.

---

## 0. How to use this document

This is the single authoritative **go/no-go** artifact for shipping MCS V2 to production. It consolidates release knowledge that was previously scattered across `DEPLOYMENT_GUIDE.md`, `ROADMAP.md` M9, and the Phase 10 verification report.

- Each item has a **checkbox**, an **owner**, a **source reference**, and a **production-affecting** flag.
- `[ ]` = not done · `[~]` = in progress / partially done · `[x]` = done & verified.
- **Owner = Kevin** items are decisions or production-affecting changes that this phase's dependency gate reserves for explicit approval (`ORCHESTRATOR_PROMPT.md:32`). They are **not** implemented here.
- **Owner = Agent (docs)** items are docs-only and may be executed inside this worktree without further approval.
- This checklist **does not certify readiness.** It is a gate. Do not proceed to a real deploy while any **BLOCKER** row is unchecked.

> **Current verdict: 🔴 NO-GO.** At least four blockers are open (topology H9, branch protection H5, security hardening H2/H3/H4, data-integrity smoke H1). See §1.

---

## 1. Blocker summary (must all be `[x]` before GO)

| # | Blocker | Section | Owner | Status |
|---|---|---|---|---|
| B1 | Production topology for triple-stack + GPU embedder is undecided; `D:/server-gateway-mcp-v2` is outside VCS | §2 | Kevin | 🔴 open |
| B2 | Branch protection on `main` cannot be confirmed enforced | §3 | Kevin (GitHub UI) | 🔴 open |
| B3 | Auth endpoints unthrottled (H2); placeholder `JWT_SECRET` passes validation (H3); Telnyx webhook fail-open (H4) | §4 | Kevin | 🔴 open |
| B4 | H1 outbox-drain **live smoke test** not yet run against the app's dedicated triple-stack | §5 | Kevin / next session | 🔴 open |
| B5 | `.com` compliance pass not re-run against the release build | §7 | Kevin + Agent | 🔴 open |
| B6 | `USE_MOCKS = true` in `apps/admin/src/routes/live-ops.tsx` would ship mock telemetry | §7 | Kevin | 🔴 open |

Non-blocking-but-required-for-a-mature-release items (CI matrix, vuln scanning, monitoring, backup tooling) are tracked in §6 and §8 — they gate a *robust* operation, not the first cutover, and are called out where the distinction matters.

---

## 2. BLOCKER B1 — Infrastructure & topology decision (owner-only)

The single biggest unsettled item (`DEPLOYMENT_GUIDE.md:263`, finding **H9**). The gateway, MongoDB, Neo4j, ChromaDB, and the GPU embedding service currently run on Kevin's local Windows machine (RTX 4070 Ti). The target Namecheap Quasar VPS (Ubuntu, 4 CPU / 6 GB / 120 GB) **has no GPU**, and Chroma writes require the Maxwell GPU embedder on `:8300` (`CLAUDE.md`, triple-stack gotchas).

- [ ] **Decide where the triple-stack lives in prod** — VPS reaches back to the local gateway, OR prod runs its own gateway + DB stack. *(Kevin, production-affecting)*
- [ ] **Resolve GPU embeddings without a GPU** — remote embedder, hosted embedding API, or CPU fallback decision (repo policy is *never* accept a silent CPU fallback — `DEPLOYMENT_GUIDE.md:232`). *(Kevin, production-affecting)*
- [ ] **Bring `D:/server-gateway-mcp-v2` under version control** before it becomes a deploy dependency (`DEPLOYMENT_GUIDE.md:267`). *(Kevin)*
- [ ] Confirm the app connects to its **own dedicated triple-stack**, separate from INTERVECTOR (per active decision — see `[[p7-dedicated-triple-stack-decision]]`). *(Kevin)*

> Nothing downstream (backup cadence, monitoring targets, restore runbook) can be finalized until B1 is settled. This is why the phase stops at *plans* for those items.

---

## 3. BLOCKER B2 — Branch protection & change governance (owner-only)

Finding **H5** / P10.1. Enforcement is unverifiable from inside the repo; every source marks it as pending owner action.

- [ ] On `main` (GitHub UI): **require the `gates` status check**, require branches up-to-date, require PR before merge, block force-push and deletion; consider linear history. *(Kevin, owner-only)*
- [ ] Record the confirmed settings in an in-repo doc so declared state is auditable. *(Agent, docs-only — can be done once Kevin reports the settings)*
- [ ] (Optional, gated) Add `CODEOWNERS` and extend the pre-push hook to include server tests. *(Kevin — propose in isolated PR)*
- [ ] Governance live: changes flow through the ACR process + decision ledger (`ROADMAP.md:192`). *(Kevin)*

---

## 4. BLOCKER B3 — Security hardening before public exposure (owner-only, production-affecting)

All three are HIGH findings and change production behavior, so they are Kevin-gated. Listed with the smallest-safe implementation each.

- [ ] **H3 — Boot-time production assertion rejecting the placeholder `JWT_SECRET`** (`.env.example:53` 36-char placeholder passes `min(16)`). Reject known-default / low-entropy secret when `NODE_ENV==='production'`. *(Kevin)*
- [ ] **H4 — Fail-closed Telnyx webhook verification in production** — require `TELNYX_PUBLIC_KEY` (and `VM_WEBHOOK_SHARED_SECRET` if VM live-delivery is enabled) when `NODE_ENV==='production'`; do not skip verification on empty key in prod (`verifyTelnyxWebhook.ts:99-130`). *(Kevin)*
- [ ] **H2 — Rate-limit `/api/auth/login`, `/register`, `/verify-code`** (reuse the `p-login.ts` sliding-window limiter or `express-rate-limit`). *(Kevin)*
- [ ] Slim + throttle `/verify-code` so it stops disclosing sponsor full name + `sponsorThreeBaId` to unauthenticated callers (P10.4/P10.5 MED). *(Kevin)*
- [ ] Fix the magic-link **cleartext bearer-token log** on SMS failure — drop `linkToken`, log `phoneHash`/`accountId` (`prospectMagicLink.ts:252-255`). *(Kevin — smallest blast radius of the security items)*
- [ ] Set `app.set('trust proxy', …)` to match the reverse-proxy topology so per-IP limits and audit IPs are correct (P10.4 MED). *(Kevin, ties to §9)*
- [ ] Decide a JWT-revocation posture (shorter TTL / `jti` + deny-list / accept 30-day risk). *(Kevin)*
- [ ] Security & privacy review signed off (`ROADMAP.md:191`). *(Kevin)*

---

## 5. BLOCKER B4 — Data integrity & operational readiness

- [x] **H1 code fix shipped** — `drainProjectionOutbox()` is now scheduled at boot + 30s interval (PR #72 → `main`, regression test present). *(Verification report §15)*
- [ ] **H1 live smoke test** against the app's **dedicated** Neo4j/Mongo/Chroma — procedure in verification report §15. Deferred until that instance exists; the write-freeze (`[[mcs-v2-db-write-freeze]]`) means no writes to MCS V2 stores until schemas are approved. *(Kevin / next session — BLOCKER for GO)*
- [ ] **Backup & restore** — no tooling exists (finding H, P10.7). Author a backup PLAN (cadence, retention, off-host, Mongo as RPO anchor with Neo4j/Chroma as rebuildable projections) and a restore runbook + RPO/RTO. *(Plan = Agent docs-once B1 known; execution = Kevin)*
- [ ] Deployment, real-time, and **rollback** procedures verified (`ROADMAP.md:190`) — see §9. *(Kevin)*

---

## 6. CI, supply chain & monitoring (required for a robust operation)

These do not block the *first* cutover mechanically, but a production service should not run long without them. All CI edits are production-affecting/gated (`ORCHESTRATOR_PROMPT.md:53`) — propose in an isolated PR; do not edit `ci.yml` in this worktree.

- [ ] **H6 — CI matrix**: add `windows-latest` (the product runs on Windows 11; Windows-only breakage is currently invisible) and optionally next-LTS Node. *(Kevin, isolated PR)*
- [ ] **H8 — Vulnerability scanning**: add `pnpm audit --audit-level=high` and/or Dependabot/Renovate. Network-dependent — must run in CI or by Kevin. *(Kevin, isolated PR)*
- [ ] **H7 — Monitoring/alerting**: liveness/readiness split backed by `directPersistenceHealth()`; route the existing `[ALERT]`/`[CRITICAL]` taxonomy (HalfWriteError, outbox dead-letter, worker-tick failure, store-unreachable, embedder-down) to a real sink. Reusing Telnyx/Resend as a channel would *send* → Kevin approval. *(Kevin)*
- [ ] Supply-chain hygiene: convert caret pins to exact per the repo's own `save-exact` policy and align all `vite` specifiers to collapse the triple-`esbuild` duplication (P10.6 MED). *(Kevin)*
- [ ] Keep `--frozen-lockfile` in CI — the strongest control already present; do not remove. *(standing)*

---

## 7. Environment contract & compliance for production

### 7.1 Prod env contract (from `DEPLOYMENT_GUIDE.md:252-260`)

- [ ] `NODE_ENV=production` *(security-load-bearing; also add it to `.env.example` — P10.3 MED)*
- [ ] `PROSPECT_BASE_URL=https://teammagnificent.com` (no trailing slash) — else every minted `/p/{token}` points at localhost.
- [ ] `COM_PUBLIC_URL`, `TEAM_PUBLIC_URL`, `ADMIN_PUBLIC_URL` set to real domains.
- [ ] `CORS_ORIGINS` restricted to production origins only.
- [ ] `JWT_COOKIE_DOMAIN=.teammagnificent.team` (so `.team` session propagates to `admin.teammagnificent.team`; `.com` is a separate eTLD+1 with its own magic-link flow).
- [ ] Production `.env` on the VPS only, never committed; secrets rotated from any dev values. *(Kevin)*
- [ ] Reconcile `.env.example` ↔ code drift (dead keys, unschema'd raw `process.env` reads) — P10.3. *(Agent docs / Kevin for code)*

### 7.2 `.com` compliance pass (BLOCKER B5 — before any public exposure, `DEPLOYMENT_GUIDE.md:170`)

Walk the prospect surface on the **release build** and confirm NONE appear:

- [ ] No income/earnings claims.
- [ ] No placement promises (Holding Tank momentum counter is permitted; total org headcount is not).
- [ ] No AI-prospecting language (Michael is BA-facing only).
- [ ] No current/total team headcount.
- [ ] No THREE International branding.

### 7.3 Mock/telemetry (BLOCKER B6)

- [ ] Flip `USE_MOCKS = true → false` in `apps/admin/src/routes/live-ops.tsx` and smoke `/api/admin/live-ops/*` so real telemetry renders. *(Kevin, production-affecting)*

---

## 8. Dormant / guarded features — explicit go decisions (`DEPLOYMENT_GUIDE.md:197`)

- [ ] **Resend email**: dormant (`EMAIL_API_KEY` empty). To activate: verify `teammagnificent.com` in Resend, set the key, confirm `emailDeliveryStatus` flips skipped→sent. Otherwise ship SMS-only knowingly. *(Kevin)*
- [ ] **VM live delivery**: keep double-gated (`VM_LIVE_DELIVERY_ENABLED` **and** per-campaign `adminApprovedForLiveDelivery`). Leave off unless a campaign is explicitly approved. *(Kevin)*
- [ ] **Telnyx outbound**: key is set in the current `.env`; be deliberate — no automatic dialing (standing prohibition). Confirm intended prod posture. *(Kevin)*

---

## 9. Build, deploy mechanics & rollback (owner-only)

- [ ] Reverse proxy + TLS (nginx/Caddy) mapping the three domains/subdomains to the client bundles and `/api` → 7700; certificates issued. *(Kevin, `DEPLOYMENT_GUIDE.md:264`)*
- [ ] Process supervision (pm2/systemd) for the API **and** the VM/broadcast/outbox workers. *(Kevin)*
- [ ] Build: `pnpm build` (shared → server → three clients); serve client `dist` via proxy; run API via `node dist/index.js` under the supervisor. *(Kevin)*
- [ ] **Rollback procedure** documented and tested (previous release restore + how a bad deploy is reverted). *(Kevin — required by `ROADMAP.md:190`)*
- [ ] Full local smoke (`DEPLOYMENT_GUIDE.md` §3–§4) green on the release build before cutover. *(Kevin)*

---

## 10. Final go/no-go sign-off

Release is **GO** only when every blocker in §1 is `[x]` and the owner signs below. This document certifies a *process*, not readiness — do not interpret an unfinished checklist as a green light.

| Gate | Status | Signed (owner) | Date |
|---|---|---|---|
| B1 topology resolved | 🔴 | | |
| B2 branch protection enforced | 🔴 | | |
| B3 security hardening applied | 🔴 | | |
| B4 H1 live smoke passed + backup plan | 🔴 | | |
| B5 `.com` compliance pass | 🔴 | | |
| B6 live-ops mocks off | 🔴 | | |
| **Overall production GO** | **🔴 NO-GO** | | |

---

## 11. Standing-prohibition note

This is a planning/checklist document. It implements nothing, sends nothing, calls no LLM, adds no route, and writes to no store. Every production-affecting item is explicitly owner-gated. All Phase 10 standing prohibitions remain held (see verification report §13).
