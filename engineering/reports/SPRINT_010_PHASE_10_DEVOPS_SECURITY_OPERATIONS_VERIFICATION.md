# SPRINT 010 — Phase 10: DevOps, Security, Environments & Operations — Verification Report

**Phase:** 10 — DevOps, Security, Environments, and Operations
**Branch:** `feature/phase-10-devops-security-operations`
**Base SHA:** `0550d32ccfbc2f09e9146fb5f5db9988dae88c71` (per `REPO_STATE_PACKET.md`)
**Mode:** Audit / Planning only (dependency gate — no production-affecting implementation performed)
**Date:** 2026-06-29
**Author:** Claude Code (Instance 2), Phase 10 worktree

---

## 0. Pre-flight gate checks

| Check | Command | Result |
|---|---|---|
| HEAD matches Base SHA | `git rev-parse HEAD` | ✅ `0550d32…88c71` — no `LOCAL_REPO_STATE_MISMATCH` |
| Branch | `git branch --show-current` | ✅ `feature/phase-10-devops-security-operations` |
| Working tree | `git status --short` | Only the 3 untracked orchestration packet files (`START_HERE.md`, `REPO_STATE_PACKET.md`, `ORCHESTRATOR_PROMPT.md`). No modified tracked files. |

**On `DIRTY_WORKTREE_BEFORE_START`:** the only untracked files are the orchestration packet itself; there are no uncommitted code changes. This was judged not to trigger the stop condition. Flagged for Kevin's awareness.

This phase produced **documentation only**, all within the allowed paths (`engineering/reports/P10_*`, `engineering/reports/SPRINT_010_*`). No code, CI, `.env`, or secret files were edited. Every standing prohibition was held (see §13).

---

## 1. Scope & method

All ten backlog items (P10.1–P10.10) were audited **read-only** by five parallel sub-agents, each restricted to reading files in this worktree with no network and no GitHub browsing:

| Agent | Items | Domain |
|---|---|---|
| A | P10.1, P10.2, P10.9 | CI, branch protection, release readiness |
| B | P10.3 | Environment configuration |
| C | P10.4, P10.5 | Auth/session & privacy/PII |
| D | P10.6 | Dependencies & supply chain |
| E | P10.7, P10.8 | Backup/restore & monitoring/alerting |

**Authoritative source of truth:** `REPO_STATE_PACKET.md`. Branch-protection *settings* live in the GitHub UI and **cannot be verified from here** — those findings rest on repo declarations and prior sprint reports, and are flagged accordingly.

---

## 2. Executive summary — severity roll-up

### HIGH (act before any production exposure)

| # | Item | Finding | Production-affecting? |
|---|---|---|---|
| H1 | P10.7 | **`drainProjectionOutbox()` is never scheduled or called** — Tier-2/3 Neo4j/Chroma projections that fail inline enqueue durable rows that sit forever; stores silently drift from authoritative Mongo, and the dead-letter alert can never fire. A **correctness bug**, not just an ops gap. (`projectionOutbox.ts:247` defined; no caller in `index.ts`.) | Yes (code fix) |
| H2 | P10.4 | **No rate limiting on `/api/auth/login`, `/register`, `/verify-code`** — brute-force / credential-stuffing / account-spam open. Contrast `/p/login` which *is* limited. | Yes |
| H3 | P10.3 | **Placeholder `JWT_SECRET` passes validation.** `.env.example` ships a 36-char placeholder that satisfies `min(16)`; a verbatim `cp .env.example .env` signs sessions with a publicly-known secret. No known-default/entropy guard. | Yes |
| H4 | P10.3 | **Telnyx webhook signature verification fail-open with no `NODE_ENV` guard** — empty `TELNYX_PUBLIC_KEY` skips verification (warn only). A prod deploy missing the key silently accepts forged webhooks. | Yes |
| H5 | P10.1 | **Branch protection cannot be confirmed enforced.** CI declares a `gates` check intended to be Required, but every source marks enforcement as still-pending owner action; unverifiable without GitHub UI. | Yes (owner action) |
| H6 | P10.2 | **CI is not a matrix** — single OS (`ubuntu-latest`), single Node (22). The product runs on Windows 11; Windows-only breakage is invisible to the gate. | Yes (gated CI change) |
| H7 | P10.8 | **No real monitoring/alerting stack** and **critical-failure alerts are non-actionable** — `HalfWriteError` (orphaned-row corruption) and outbox dead-letters are only stdout strings with no sink. | Yes |
| H8 | P10.6 | **No automated vulnerability scanning** — no `pnpm audit` / Dependabot / Renovate in CI. Reproducibility is solid; known-CVE detection is absent. | Yes (gated CI change) |
| H9 | P10.9 | **No single authoritative release checklist** and **production topology unresolved** — triple-stack + GPU embedder run on Kevin's local Windows machine; prod VPS has no GPU, and `D:/server-gateway-mcp-v2` is outside version control. | Yes (owner decision) |

### MED / LOW
Tabulated per item in §3–§12. Notable MED items: `verify-code` leaks sponsor PII + THREE BA ID to unauthenticated callers (P10.5/P10.4); magic-link bearer token logged in cleartext on SMS failure (P10.5); no JWT revocation (P10.4); `trust proxy` unset taints audit IPs and defeats per-IP rate limits (P10.4); caret version ranges violate the repo's own `save-exact` policy and create a triple-`esbuild` duplication (P10.6); shallow health check reports healthy when Neo4j/Chroma/GPU are down (P10.8).

### Strengths to preserve
- Committed `pnpm-lock.yaml` (v9.0) with **full SHA-512 integrity hashes**, registry-only sources, `engine-strict` + `packageManager` pinning, `--frozen-lockfile` in CI.
- Fail-fast env validation via Zod at boot; `ANTHROPIC_API_KEY` / `EMAIL_API_KEY` degrade gracefully (verified).
- Prospect session is an opaque server-resolved id (not a JWT); cookie flags correct (`httpOnly`, `secure` in prod, `sameSite:lax`); admin gate is a hard 403 with non-enumerating `'Not found.'`.
- Sponsor immutability **enforced** — no route reads `sponsorBaId` from the body.
- PII minimization on `/p` prospect payloads holds; CSV export redaction (`piiRedact.ts`) is solid; the **five `.com`-forbidden categories are not leaked** in audited prospect paths.
- A newer tiered writer (`tieredWrite.ts`) with atomic-or-rollback Tier-1 and a durable outbox exists — the consistency *model* is sound; it is just not fully wired (see H1).

---

## 3. P10.1 — Branch Protection Enforcement

**Current state.** One workflow, `.github/workflows/ci.yml`, defines a single job `gates` (`ci.yml:22-23`) named so a Required status check `gates` matches the published context. Header comment (`ci.yml:5-8`) explicitly states branch protection is an owner action. No `CODEOWNERS`. An opt-in local backstop exists (`scripts/git-hooks/pre-push:19-25`) running `typecheck` + `build` (not tests), off by default. Enforcement is documented as still-pending across `SPRINT_001_*` reports.

**Gaps / risks.**
- **HIGH (H5)** — Enforcement unverifiable without GitHub UI; nothing in-repo proves protection was enabled.
- **MED** — Local backstop is weaker than CI (omits server tests) and opt-in.
- **MED** — No `CODEOWNERS` to route mandatory review.
- **LOW** — Check-name fragility: protection pins the exact string `gates`; renaming the job silently vacates the gate.

**Recommendations (planning).**
- **Kevin (owner, GitHub UI):** on `main` — require `gates` status check; require branches up-to-date; require PR before merge; block force-push/deletion; consider linear history. *Production-affecting, owner-only.*
- Record the confirmed settings in an in-repo doc (docs-only, non-production-affecting) so declared state is auditable.
- Consider adding the server-test step to the pre-push hook and a `CODEOWNERS` file — propose, do not apply (gated).

---

## 4. P10.2 — CI Matrix Hardening

**Current state.** Job `gates` (`runs-on: ubuntu-latest`), steps in order: checkout `@v4` → `pnpm/action-setup@v4` (9.15.0) → `setup-node@v4` (node 22, `cache: pnpm`) → `pnpm install --frozen-lockfile` → `pnpm build:shared` → `pnpm typecheck` → `pnpm build` → `pnpm --filter @momentum/server test` (`ci.yml:26-53`). `concurrency` cancels in-progress per ref. `.npmrc` adds `engine-strict=true` + `save-exact=true`.

**Gaps / risks.**
- **HIGH (H6)** — Not a matrix: single OS, single Node. Windows-only breakage (path separators, the PowerShell `ensure:gpu` prereq, `rm -rf` in `clean`, line endings) is never exercised.
- **MED** — Test gate is server-only; `apps/com`, `apps/team`, `apps/admin`, `packages/shared` have no tests/test script. The highest-compliance-risk surface (`.com`) is only typechecked/built.
- **MED** — No supply-chain/security steps (no `pnpm audit`, secret scan, SAST).
- **LOW** — No lint/format gate; no `timeout-minutes`; actions pinned by major tag not SHA.

**Recommendations (planning).** Plan a `strategy.matrix` adding `windows-latest` (+ optional next-LTS Node); extend the test gate to client workspaces as tests appear; add a `pnpm audit`/Dependabot step (ties to P10.6); add `timeout-minutes` and consider SHA-pinning. **All CI changes are production-affecting / gated** (`ORCHESTRATOR_PROMPT.md:53`) — propose in an isolated PR for Kevin; do not edit `ci.yml` here.

> **Note — stale doc:** `CLAUDE.md` says "no test runner wired." This is **false**: `server` uses `vitest@4.1.9` (`server/vitest.config.ts`, `server/package.json:12`) with **85 `*.test.ts` files**, all under `server/`. Reconcile `CLAUDE.md` (docs-only).

---

## 5. P10.3 — Environment Configuration Audit

**Current state.** `server/src/env.ts` walks up ≤10 levels to the `pnpm-workspace.yaml` marker then loads `<root>/.env` (`env.ts:13-28`) — the CLAUDE.md claim is **verified**. Single Zod `Env.parse(process.env)` at import (`:214`), no try/catch → **fail-fast at boot**. Only `JWT_SECRET` is truly required (`min(16)`, `:65`); everything else has a default, so the server boots with no `.env`. `DEBUG_ENV` logs key counts only, never values. Cookie `secure`/`domain` gated on `NODE_ENV==='production'` (`session.ts`). `ANTHROPIC_API_KEY` (`anthropic.ts:56-58`) and `EMAIL_API_KEY` (`resend.ts:49-54`) **degrade rather than crash — verified.**

**Gaps / risks.**
- **HIGH (H3)** — Placeholder `JWT_SECRET` (`.env.example:53`, 36 chars) passes `min(16)`; verbatim copy signs with a known secret.
- **HIGH (H4)** — Telnyx signature skipped when `TELNYX_PUBLIC_KEY` empty, gated on key presence not `NODE_ENV` (`verifyTelnyxWebhook.ts:99-130`).
- **MED** — VM provider webhook fail-open: unset `VM_WEBHOOK_SHARED_SECRET` skips the secret check (`vmProviderWebhooks.ts:132-138`); blast radius limited by `VM_LIVE_DELIVERY_ENABLED` + per-campaign approval.
- **MED** — Env-var sprawl: schema-bypassing raw `process.env` reads (`STEVE_WORKER_SECRET`, `FOUNDER_PASSWORD`, `PUBLIC_ORIGIN`, `COM_PUBLIC_URL`, and three `MICHAEL_RUNTIME_*` flags with ad-hoc parsing) — unvalidated and undiscoverable.
- **MED** — `NODE_ENV` is security-load-bearing yet absent from `.env.example`.
- **LOW** — `.env.example` ↔ code drift (below); `NEO4J_PASSWORD` defaults to `''`.

**`.env.example` ↔ code cross-check.**
- *Validated but missing from template:* `NODE_ENV`; entire VM block (`VM_PROVIDER_MODE`, `VM_LIVE_DELIVERY_ENABLED`, `VM_DELIVERY_RATE_PER_MINUTE`, `VM_WEBHOOK_SHARED_SECRET`, `VM_ACQUISITION_PROVIDER_API_URL`, `VM_ACQUISITION_PROVIDER_API_KEY`).
- *Raw `process.env` (unschema'd) and missing from template:* `STEVE_WORKER_SECRET` (secret), `FOUNDER_PASSWORD`, `PUBLIC_ORIGIN`, `DEBUG_ENV`, `MICHAEL_RUNTIME_{ROUTE,RESPONSE,TRACE}_ENABLED`.
- *In template but dead (no `.ts` ref):* `TEAM_PUBLIC_URL`, `ADMIN_PUBLIC_URL`, `COM_PORT`, `TEAM_PORT`, `ADMIN_PORT`.

**Recommendations (planning).** Add a boot-time production assertion rejecting the placeholder `JWT_SECRET` and requiring `TELNYX_PUBLIC_KEY` (and `VM_WEBHOOK_SHARED_SECRET` if VM prod-enabled) when `NODE_ENV==='production'` *(prod-affecting — Kevin)*; consolidate raw `process.env` reads into the Zod schema; reconcile `.env.example`; document fail-open vs fail-closed posture per secret in `docs/DEPLOYMENT_GUIDE.md`.

---

## 6. P10.4 — Auth & Session Review

**Current state.** HS256 JWT via `jose`, claims `{baId, threeBaId, email}`, `exp=${ttlDays}d` (`session.ts:7-19`); cookie `httpOnly`, `secure`(prod), `sameSite:lax`, domain `.teammagnificent.team` (prod), 30-day default. Prospect session is an **opaque** random id resolved server-side (`prospectSession.ts:58-78`). `requireAdmin` (`requireAuth.ts:47-82`) enforces the `ADMIN_BA_IDS` allowlist with a hard 403 / non-enumerating `'Not found.'`, applied **per-route across all 14 admin files**. Login uses argon2 with generic `'Invalid credentials.'`. Telnyx Ed25519 verified over raw body with a 5-min replay window. Token lifecycle 404/409/410 contract enforced consistently in `routes/p.ts`. Hardening present: `x-powered-by` off, 256kb JSON cap, CORS allowlist with credentials, `/p/login` rate-limited + anti-probing opaque responses.

**Gaps / risks.**
- **HIGH (H2)** — No rate limiting on `/auth/login`, `/register`, `/verify-code` (`routes/auth.ts`).
- **MED** — `/verify-code` unauthenticated + unthrottled returns sponsor full name + `sponsorThreeBaId` (`auth.ts:14-39`); ~923k code space is enumerable → sponsor PII + THREE-identity harvest.
- **MED** — No JWT revocation: `logout` only clears the cookie (`session.ts:49-57`); a captured 30-day token stays valid; no `jti`/deny-list/rotation.
- **MED** — `clientIp()` trusts raw `x-forwarded-for` (`p-login.ts:95-99`) and `app.set('trust proxy')` is never set → per-IP limits spoofable and audit IPs tainted (`req.ip` becomes the proxy).
- **LOW** — `verifySession` casts without schema validation (`session.ts:23-24`); no CSRF token / `__Host-` prefix (mitigated by `sameSite:lax` + CORS); all sessions are 30-day "remember"; admin-gate denials are `console.warn` only, not in the durable `auditLog`.

**Recommendations (planning).** Add a limiter (reuse the `p-login.ts` sliding-window or `express-rate-limit`) to the auth endpoints; set `app.set('trust proxy', …)` per deployment topology; decide a JWT-revocation strategy (shorter TTL / `jti` + deny-list / accept risk); throttle and slim `/verify-code`; persist admin-gate denials to `auditLog`; add zod validation in `verifySession`. *Items changing prod behavior need Kevin.*

---

## 7. P10.5 — Privacy / PII Review

**Current state.** PII stored — BA: name, email, phone, threeUsername/threeBaId, argon2 hash, timezone; login/commitment also store IP + user-agent (`welcome.ts:70-82`). Prospect: name/lastInitial, city/state/country, phone, email; phone copied to the account row **only on explicit callback consent** (`p.ts:616-633`). PII minimization on `/p` payloads holds (firstName + lastInitial + region only, `p.ts:283-302`); 409/410 expose only BA name + a `tel:` phone. CSV export redaction (`piiRedact.ts:44-134`) is solid. Magic-link phone is hashed (`phoneHash`), not raw. **Sponsor immutability enforced** (`invitations.ts:84-140`, `p.ts:147-159`). External wrappers don't log bodies/recipients. OG injection escapes all values, private cache header.

**Gaps / risks.**
- **MED** — Magic-link **bearer token logged in cleartext** on SMS failure: `console.error(\`[prospect-magic-link ${linkToken}] …\`)` (`prospectMagicLink.ts:252-255`) — a leaked log line within the click window = account takeover.
- **MED** — `/verify-code` sponsor PII + THREE BA ID disclosure (cross-listed from P10.4) — the only thing keeping THREE branding off `.com` is that the prospect app doesn't call it, not a server guard.
- **LOW** — IP + user-agent stored (commitment + audit) with no documented retention/deletion policy (IP is personal data under GDPR/CCPA); audit/error logs carry `baId`/`threeBaId`; no central PII-scrubbing log wrapper (redaction only on the CSV path); generic `err.message` echoed in several 500s.

**Recommendations (planning).** Fix the magic-link log line to drop `linkToken` (log `phoneHash`/`accountId`) — smallest-blast, highest-value, in-worktree-able but raised for approval; throttle/slim `/verify-code`; define an IP/user-agent retention policy *(Kevin)*; replace client-facing `err.message` with generic codes; consider a PII-redacting logging helper.

---

## 8. P10.6 — Dependency & Supply Chain Audit

**Current state.** pnpm 9 workspace (`apps/*`, `server`, `packages/*`), Node ≥22. Strong tooling: `packageManager: pnpm@9.15.0`, `engines node>=22/pnpm>=9`, `.npmrc` with `engine-strict`, `save-exact`, `shamefully-hoist=false`, `link-workspace-packages`. `pnpm-lock.yaml` v9.0 committed, ~432 packages, **every resolution carries an SHA-512 integrity hash**, registry-only sources, no git/tarball/`file:` deps, no `overrides`/`patchedDependencies`/`resolutions`. CI runs `--frozen-lockfile`. Leaf deps are almost all exact-pinned.

**Gaps / risks.**
- **HIGH (H8)** — No automated vuln scanning (no `pnpm audit`/Dependabot/Renovate/osv-scanner). Surfaces to check when run: `express 4.21.1`, `mongoose 9.7.3`, `undici 7.1.0`, `jose 5.9.6`, `argon2 0.41.1`, `pdfkit 0.18.0`.
- **MED** — Caret ranges violate the repo's own `save-exact` policy: `server` `vite ^6.4.3` (apps pin `6.0.3` exactly), root + shared `typescript ^5.5.4`. Drives a **triple-`esbuild`** duplication (0.23.1 / 0.24.2 / 0.25.12).
- **LOW** — Orphan `docs/package.json` (git-tracked, not a workspace member, default `npm init` stub); `argon2` native build with no `onlyBuiltDependencies` allowlist (works on Linux CI via prebuilds, silent-fail risk on platforms lacking one); `UNLICENSED`/`ISC` with no license-compliance gate.

**Recommendations (planning).** Add a `pnpm audit --audit-level=high` and/or Dependabot/Renovate step *(network-dependent — must run in CI or by Kevin; cannot validate here)*; convert the caret pins to exact and align all `vite` specifiers to one version to collapse the esbuild duplication *(touches all frontends — Kevin)*; add `onlyBuiltDependencies: ["argon2"]` *(auth — Kevin)*; resolve the `docs/package.json` orphan. **Keep `--frozen-lockfile` — the strongest control present.**

---

## 9. P10.7 — Backup and Restore Plan

**Current state.** Authoritative state is MongoDB + Neo4j + ChromaDB behind **Universal Gateway V2 at `localhost:2526`** (`gateway.ts:79`); the repo is a client holding no data/credentials. Default mode is `gateway` (HTTP); direct DB connections flag-gated off (`persistence/flags.ts:9,35`). THREE International is upstream authority — the app backs up its **own** derived state (pool/token lifecycle, BA/access-code records, CRM, agent knowledge, audit log, outbox, broadcast queue), not THREE genealogy. Two write paths coexist: legacy `tripleStackWrite()` (sequential, no rollback/retry, `tripleStack.ts:45-79`) and the newer `tieredWrite.ts` (Tier-1 Mongo+Neo4j atomic-or-rollback with read-back verify `:242-257`; Tier-2/3 Mongo-then-durable-outbox).

**Gaps / risks.**
- **HIGH** — **No backup/restore tooling exists anywhere** (no `mongodump`/`neo4j-admin`/Chroma snapshot, no cadence, no off-host copy, no PITR, no runbook). `server/scripts/` holds only seeders.
- **HIGH (H1)** — **`drainProjectionOutbox()` (`projectionOutbox.ts:247`) is never scheduled or called** (confirmed: `index.ts:273-276` starts broadcastQueue + 3 VM workers, no outbox timer; no other caller). Failed Tier-2/3 projections enqueue rows that sit forever → Neo4j/Chroma silently drift from Mongo; the dead-letter alert (`:216-223`) never fires. A backup taken in this state captures divergent stores. **Correctness bug.**
- **MED** — No restore procedure / cross-store reconciliation runbook; no tool to detect Mongo rows missing graph/search projections.
- **MED** — Mixed write paths → inconsistent recoverability guarantees per collection (migration to `tieredWrite` incomplete, `tieredWrite.ts:31-33`).
- **LOW** — Writes `insert` by `_id` → not idempotent on replay/restore-then-reprocess (duplicate-key, not upsert); VM workers have no boot de-stale equivalent to `resetStuckSendingRows()` (`broadcastQueue.ts:66`).

**Recommendations (planning).** Author a **backup PLAN** for all three Gateway-V2 stores (cadence, retention, off-host, consistent-set vs per-store + reconciliation; Mongo as the RPO anchor, Neo4j/Chroma as rebuildable projections) *(prod-affecting — touches `D:/server-gateway-mcp-v2`, Kevin)*; **flag the un-drained outbox to Kevin as a correctness bug** and recommend scheduling `drainProjectionOutbox()` on boot+timer (code change — approval, not implemented here); plan a reconciliation/verify tool; define RPO/RTO + restore runbook.

---

## 10. P10.8 — Monitoring and Alerting

**Current state.** `GET /api/health/` is static liveness only (`health.ts:7-9`); `GET /api/health/gateway` pings **Mongo only** (`:11-20`) — Neo4j/Chroma/GPU embedder unprobed. A richer `directPersistenceHealth()` (per-store + embedder, `persistence/index.ts:21-33`) exists but is **unmounted on any route**. Metrics are in-memory, process-local, reset on restart, exposed only via `/admin` Live-Ops SSE (gateway latency p50/p95 over 60s but only from Live-Ops callers `gatewayLatency.ts:9-50`; placements/min + subscriber counts `poolEvents.ts:115-157`; Michael runtime counters). No Prometheus/OTel/scrape endpoint. Logging is unstructured `console.*` — **113 occurrences across 46 files**, no logging library, no correlation IDs/levels/shipping. "Alerts" are stdout strings (`[projection-outbox][ALERT] DEAD-LETTER`, `[tiered][CRITICAL] half-write`). Workers are in-process `setInterval` loops whose tick failures `console.error` but emit no metric/alert.

**Gaps / risks.**
- **HIGH (H7)** — No real monitoring/alerting stack; operational visibility = human watching `/admin` or tailing stdout.
- **HIGH** — Critical-failure alerts non-actionable: `HalfWriteError` (orphaned-row corruption) and outbox dead-letters are stdout-only with no sink; combined with H1, divergence accumulates with zero operator signal.
- **MED** — Health check too shallow for an LB/orchestrator: a degraded Neo4j/Chroma/down GPU embedder reports healthy. `directPersistenceHealth()` should back a real readiness probe.
- **MED** — No log aggregation/correlation; metrics evaporate on restart and latency p95 covers only Live-Ops callers (not global).
- **LOW** — No worker observability (heartbeat, last-success, backlog depth).

**Recommendations (planning).** Plan a liveness/readiness split (keep static `/health`; add readiness backed by `directPersistenceHealth()` + outbox/queue backlog snapshot); plan structured logging + aggregation with correlation IDs, routing the existing `[ALERT]`/`[CRITICAL]` taxonomy to a real channel *(reusing Telnyx/Resend would send — Kevin approval)*; plan a Prometheus/OTel export; define alert conditions for `HalfWriteError`, outbox dead-letter, worker tick failure, store-unreachable, embedder-down. All **plans**, nothing implemented.

---

## 11. P10.9 — Production Release Checklist

**Current state.** No dedicated release-checklist artifact exists. Closest material: `docs/DEPLOYMENT_GUIDE.md` §8 (prod env diffs + 5 open questions, biggest being where the triple-stack/GPU lives in prod — the VPS has no RTX 4070 Ti — and that `D:/server-gateway-mcp-v2` is outside VCS, `:263,267`), §3.6 (`.com` compliance pass), and `ROADMAP.md` M9 (prod completion criteria). Known blockers: `apps/admin/src/routes/live-ops.tsx` `USE_MOCKS = true` would ship mock telemetry; dormant features (Resend empty, VM double-gated, Telnyx key).

**Gaps / risks.**
- **HIGH (H9)** — No single authoritative go/no-go checklist; release knowledge scattered.
- **HIGH** — Production topology unresolved (triple-stack + GPU on local Windows; VPS has no GPU; Chroma writes need the GPU embedder); `D:/server-gateway-mcp-v2` untracked.
- **MED** — Admin live-ops `USE_MOCKS` would ship fake telemetry if not flipped/smoked; prod secrets/CORS/cookie-domain unverifiable here.
- **LOW** — Release gates not tied to prod env; smoke path is manual.

**Recommendations (planning).** Author a consolidated **Production Release Checklist** as a new `engineering/reports/P10_*` doc (docs-only, in-scope): env-contract diffs, infra/topology decision gate, bring `server-gateway-mcp-v2` under VCS, `.com` compliance pass, flip `USE_MOCKS` + smoke `/api/admin/live-ops/*`, dormant-feature activation decisions, reverse-proxy/TLS + process supervision, rollback procedure, and the P10.1 branch-protection confirmation. **Do not assert production readiness** — the topology open-question is a genuine blocker only Kevin can resolve.

---

## 12. P10.10 — Phase 10 Closeout

This report is the Phase 10 deliverable. Closeout status:

- ✅ All ten backlog items audited; findings recorded with file:line references and severity.
- ✅ Documentation-only; all writes within allowed paths; no code/CI/`.env`/secret edits.
- ✅ Standing prohibitions verified held (§13).
- ⏳ **Gates** — see §14 (run results appended).
- ⛔ **No production-affecting implementation** performed — every such item is explicitly flagged for Kevin's approval. The dependency gate (`ORCHESTRATOR_PROMPT.md:32`) is respected.

**Recommended next actions for Kevin (priority order):**
1. **H1** — schedule `drainProjectionOutbox()` (correctness bug; cross-store drift).
2. **H3/H4** — boot-time prod assertions for `JWT_SECRET` placeholder + `TELNYX_PUBLIC_KEY`.
3. **H2** — rate-limit `/auth/login`, `/register`, `/verify-code`; fix magic-link cleartext log; slim `/verify-code`.
4. **H5** — confirm/enable branch protection in GitHub UI.
5. **H9** — resolve prod topology + author the release checklist.
6. **H6/H8** — CI matrix (`windows-latest`) + vuln-scan step (isolated, gated PR).

---

## 13. Standing-prohibition verification

| Prohibition | Held? | Note |
|---|---|---|
| No `.com` exposure | ✅ | Audit confirmed the 5 forbidden categories absent from prospect paths; no new `.com` surface added. |
| No `/api/runtime/*` route family | ✅ | None created. |
| No unapproved persistence | ✅ | No writes; recommendations are plans flagged for approval. |
| No LLM calls | ✅ | None. |
| No dynamic generation | ✅ | None. |
| No voice/Telnyx/PSTN/call-control | ✅ | Telnyx only read/audited, not invoked. |
| No automatic sending/calling/scheduling/prospecting/scoring/ranking/qualification | ✅ | None; alert-routing via Telnyx/Resend explicitly deferred to Kevin. |
| No income/compensation/cycle/placement guarantees | ✅ | None. |
| No agent may approve knowledge | ✅ | This report recommends; it approves nothing. |
| Context Manager remains sole Context Packet assembler | ✅ | Not assumed or bypassed. |

---

## 14. Required gates

```
pnpm build:shared
pnpm typecheck
pnpm build
pnpm --filter @momentum/team typecheck
pnpm --filter @momentum/server test
```

This phase changed documentation only; gates are run for honest verification of the branch's current state, not because code was modified. Run on this worktree after `pnpm install --frozen-lockfile` (exit 0). Environment: Node v24.15.0, pnpm 9.15.0, Windows 11.

| Gate | Command | Result |
|---|---|---|
| Shared build | `pnpm build:shared` | ✅ PASS (`tsc -p tsconfig.json`, exit 0) |
| Repo typecheck | `pnpm typecheck` | ✅ PASS — all 5 workspaces (shared, com, team, admin, server) Done |
| Repo build | `pnpm build` | ✅ PASS — all workspaces Done (team chunk-size warning only, non-fatal) |
| Team typecheck | `pnpm --filter @momentum/team typecheck` | ✅ PASS (`tsc -b`) |
| Server tests | `pnpm --filter @momentum/server test` | ✅ PASS — **85 files, 1091 tests passed**, 0 failed (vitest 4.1.9, 2.46s) |

**All required gates green** on `feature/phase-10-devops-security-operations` at Base SHA `0550d32`. Note: the test count (1091, all under `server/`) corrects the earlier stale figure and confirms the test runner is fully wired (see §4 note).

> Local environment ran Node v24.15.0; CI pins Node 22 (`ci.yml:36`). The Windows-only / single-Node coverage gap (H6) means CI does not exercise this exact local toolchain — gates passing here does not substitute for the proposed matrix.
