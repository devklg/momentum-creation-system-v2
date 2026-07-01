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
| B1 | Production topology **DECIDED** (InterServer VPS + Atlas/Aura/Chroma Cloud + hosted embeddings, direct writes); execution pending | §2 | Kevin | 🟡 decided, execution pending |
| B2 | Branch protection: required `gates` check **confirmed enabled** on `main` (owner, 2026-06-30); auxiliary protections to confirm | §3 | Kevin (GitHub UI) | 🟢 core enforced |
| B3 | Auth endpoints unthrottled (H2); placeholder `JWT_SECRET` passes validation (H3); Telnyx webhook fail-open (H4) | §4 | Kevin | 🔴 open |
| B4 | H1 outbox-drain **live smoke test** not yet run against the app's dedicated triple-stack | §5 | Kevin / next session | 🔴 open |
| B5 | `.com` compliance pass not re-run against the release build | §7 | Kevin + Agent | 🔴 open |
| B6 | `USE_MOCKS = true` in `apps/admin/src/routes/live-ops.tsx` would ship mock telemetry | §7 | Kevin | 🔴 open |

Non-blocking-but-required-for-a-mature-release items (CI matrix, vuln scanning, monitoring, backup tooling) are tracked in §6 and §8 — they gate a *robust* operation, not the first cutover, and are called out where the distinction matters.

---

## 2. BLOCKER B1 — Infrastructure & topology (✅ DECIDED 2026-06-30)

**Decision (resolves the open questions in `DEPLOYMENT_GUIDE.md:261-267`):** production runs on an **InterServer Linux VPS** for the app tier with **managed cloud data services**. Full record + implications: **`engineering/reports/P10_PRODUCTION_TOPOLOGY_DECISION.md`**.

- App/API host: InterServer Linux VPS — Express API (7700), `.com`, `.team`, `/admin`, Caddy/Nginx + TLS.
- Data: **MongoDB Atlas**, **Neo4j Aura**, **Chroma Cloud** (or hosted vector), **OpenAI/hosted embeddings** (no local GPU).
- App writes **directly** to the stores; the Universal Gateway is **dev tooling only**, not in the prod runtime path.

The *decision* is made; **execution** remains (these move B1 from decide → do):

- [ ] Provision Atlas / Aura / Chroma Cloud; capture connection strings as VPS-only secrets. *(Kevin)*
- [ ] Choose hosted embeddings model + dimension; add `OPENAI_API_KEY`/`EMBEDDINGS_MODEL` to `env.ts` + `.env.example`; implement fail-closed hosted-embeddings path in the embedder adapter. ⚠️ 1536-dim (OpenAI) vs 384-dim (local MiniLM) — standardize from the start on the fresh dedicated stack. *(code slice)*
- [ ] Confirm direct-adapter coverage for all write paths; flip `PERSISTENCE_DIRECT_ENABLED=true` + all `PERSISTENCE_*_MODE=direct`. *(code/config)*
- [ ] Stand up the VPS: Node ≥22, pnpm 9, Caddy/Nginx + TLS, pm2/systemd for API + workers. *(Kevin — see §9)*
- [ ] Raise the ACR (managed-cloud hosting + hosted-embeddings provider; direct-persistence already ACR-0007) and log it in the decision ledger. *(Kevin)*
- [ ] (Hygiene, no longer a prod dependency) Bring `server-gateway-mcp-v2` under VCS.

> Downstream items (backup cadence, monitoring targets, restore runbook) can now be finalized against Atlas/Aura/Chroma-Cloud managed-service capabilities rather than a local stack.

---

## 3. BLOCKER B2 — Branch protection & change governance (owner-only)

Finding **H5** / P10.1. Recorded in **`engineering/reports/P10_BRANCH_PROTECTION_SETTINGS.md`**.

- [x] **Required `gates` status check enabled on `main`** — owner-confirmed 2026-06-30. This closes H5's core gap (the CI gate is enforced, not just declared).
- [ ] Confirm the auxiliary protections on `main`: require PR before merge, require branches up-to-date, block force-push, block deletion. *(Kevin, owner-only)*
- [x] Record the confirmed settings in an in-repo doc so declared state is auditable. *(done — see the settings record above)*
- [ ] (Optional, gated) Add `CODEOWNERS` and extend the pre-push hook to include server tests. *(Kevin — propose in isolated PR)*
- [ ] Governance live: changes flow through the ACR process + decision ledger (`ROADMAP.md:192`). *(Kevin)*

> ⚠️ Protection pins the exact check-name `gates`; renaming the CI job silently vacates the gate. Keep the name stable.

---

## 4. BLOCKER B3 — Security hardening before public exposure (owner-only, production-affecting)

All three are HIGH findings and change production behavior, so they are Kevin-gated. Listed with the smallest-safe implementation each.

> **📄 Copy-paste-ready patches drafted:** `engineering/reports/P10_B3_SECURITY_HARDENING_PATCHES.md` — H2 (shared rate-limiter + auth wires), H3 (JWT_SECRET prod assertion), H4 (fail-closed Telnyx verify), plus tests and gates. **Proposed, not applied** — apply in a dedicated `server/src` slice (out of scope for this docs worktree).

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
| B1 topology resolved | 🟡 decided; execution pending | | 2026-06-30 |
| B2 branch protection enforced | 🟢 `gates` required (aux to confirm) | | 2026-06-30 |
| B3 security hardening applied | 🔴 | | |
| B4 H1 live smoke passed + backup plan | 🔴 | | |
| B5 `.com` compliance pass | 🔴 | | |
| B6 live-ops mocks off | 🔴 | | |
| **Overall production GO** | **🔴 NO-GO** | | |

---

## 11. Standing-prohibition note

This is a planning/checklist document. It implements nothing, sends nothing, calls no LLM, adds no route, and writes to no store. Every production-affecting item is explicitly owner-gated. All Phase 10 standing prohibitions remain held (see verification report §13).
