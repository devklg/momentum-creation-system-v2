# P10.11 — High Finding Reconciliation

**Phase:** 10 — DevOps, Security, Environments, and Operations
**Slice:** P10.11 — Phase 10 Final Closeout Reconciliation
**Mode:** Documentation / governance only. No runtime behavior changed by this document.
**Author:** Claude Code, Phase 10 B3 worktree.
**Date:** 2026-07-01.
**Reconciles:** the nine HIGH findings H1–H9 from `SPRINT_010_PHASE_10_DEVOPS_SECURITY_OPERATIONS_VERIFICATION.md` against all follow-up docs (`P10_*`) and shipped code.
**Companions:** `P10_11_PHASE_10_CLOSEOUT_INVENTORY.md`, `P10_11_PHASE_10_FINAL_CLOSEOUT_RECONCILIATION.md`.

---

## Legend

Disposition classes: **RESOLVED** · **PARTIALLY RESOLVED** · **DOCUMENTED / DECISION MADE** · **STILL OPEN** · **DEFERRED (later phase / gated PR)** · **BLOCKED**.
"Blocks production?" is assessed against `P10_PRODUCTION_RELEASE_CHECKLIST.md` (R2).

Evidence paths are repo-relative. Code paths verified against this branch HEAD `165eb01`; doc paths verified against `origin/main` (see inventory §0 for branch-lag).

---

## H1 — Backup / outbox drift

**Original finding (H1 + P10.7 backup):** `drainProjectionOutbox()` was defined but never scheduled → failed Tier-2/3 Neo4j/Chroma projections enqueued durable rows that sat forever; stores silently drift from authoritative Mongo and the dead-letter alert can never fire (a correctness bug). Separately, **no backup/restore tooling exists** anywhere.

- **Disposition:** **PARTIALLY RESOLVED.**
  - Outbox-drain correctness bug → **RESOLVED (code).** `drainProjectionOutbox()` scheduled at boot + 30s interval, with a regression test.
  - Backup/restore tooling → **STILL OPEN.** No `mongodump`/`neo4j-admin`/Chroma-snapshot tooling, cadence, off-host copy, or restore runbook exists; only a recommendation to author a plan.
  - H1 **live smoke test** (verify drain end-to-end against the dedicated stack) → **DEFERRED / BLOCKED** behind the MCS V2 write-freeze until schemas (R7) are approved and applied.
- **Evidence:** `server/src/services/projectionOutbox.ts`; `server/src/index.ts` (boot scheduling); regression test in `server/src/**/__tests__`. Fix commit `d3ed12d` (PR #72). Smoke procedure: verification report §15. Write-freeze: `[[mcs-v2-db-write-freeze]]`; schema design `P10_MCS_V2_SCHEMA_DESIGN.md`.
- **PR/commit:** `d3ed12d` / PR #72 (code); `bf2575a` (smoke procedure doc); `84138db` (stack-exists note).
- **Current risk:** MEDIUM. The live drift bug is fixed in code, so ongoing operation no longer accumulates silent divergence. Residual risk: no disaster-recovery path (backup tooling), and the fix is not yet **operationally** verified against real stores (smoke pending).
- **Blocks production?** **YES** — checklist blocker **B4** (live smoke + backup plan) is open.
- **Next action:** approve + apply the MCS V2 schemas (R7) → run the H1 live smoke → author the backup/restore plan + RPO/RTO runbook. Owner: Kevin (schema approval, prod-affecting).

---

## H2 — Auth rate limiting

**Original finding:** `/api/auth/login`, `/register`, `/verify-code` had no throttle — brute-force / credential-stuffing / account-spam / code-enumeration open (contrast `/p/login`, which is limited).

- **Disposition:** **RESOLVED (code).**
- **Evidence:** `server/src/middleware/rateLimit.ts` (shared sliding-window limiter + `ipRateLimit()` + `clientIp()`); `server/src/routes/auth.ts` wires per-IP throttles: `/login` 10/15m, `/register` 5/60m, `/verify-code` 20/15m. Tests: `server/src/middleware/__tests__/rateLimit.test.ts` (+ auth wiring guard). All green.
- **PR/commit:** `165eb01` / PR #88.
- **Current risk:** LOW. Residual: limiter is in-memory single-instance (moves to Redis on horizontal scale), and per-IP keys are only trustworthy once `app.set('trust proxy', …)` matches the prod reverse-proxy topology (tracked as a P10.4 MED, tied to B1 execution). The `/verify-code` **PII disclosure** (sponsor name + `sponsorThreeBaId`) is throttled but not removed — tracked separately as a MED follow-up.
- **Blocks production?** **NO** — the checklist B3 blocker is satisfied. (`trust proxy` + `/verify-code` slimming are MED hardening, not GO blockers.)
- **Next action:** set `trust proxy` at deploy per topology; slim `/verify-code` response in a follow-up.

---

## H3 — JWT secret fail-closed

**Original finding:** placeholder `JWT_SECRET` (36-char `.env.example` value) passed `min(16)` validation → a verbatim `cp .env.example .env` in prod would sign sessions with a publicly-known secret.

- **Disposition:** **RESOLVED (code).**
- **Evidence:** `server/src/env.ts` — production-gated boot assertion **throws** when `JWT_SECRET` is a known placeholder or `<32` chars. Test: `server/src/__tests__/env.prod-assertion.test.ts` (placeholder/short → throw; strong → boot; dev unaffected). Green.
- **PR/commit:** `165eb01` / PR #88.
- **Current risk:** LOW. Fail-fast at boot; dev/test unchanged.
- **Blocks production?** **NO** — satisfied (part of checklist B3).
- **Next action:** none for the finding; ensure the real prod `JWT_SECRET` is a strong rotated value (checklist §7.1).

---

## H4 — Telnyx webhook fail-closed

**Original finding:** empty `TELNYX_PUBLIC_KEY` skipped signature verification (warn-only), gated on key presence not `NODE_ENV` → a prod deploy missing the key silently accepts **forged** webhooks.

- **Disposition:** **RESOLVED (code).**
- **Evidence:** `server/src/middleware/verifyTelnyxWebhook.ts` — when `TELNYX_PUBLIC_KEY` is empty **and** `NODE_ENV==='production'`, the middleware now returns **401** (`Webhook verification not configured.`) instead of skipping. Dev/test still skip with a warning. `NODE_ENV` read at call time (unit-testable, deploy-mode change needs no rebuild). `server/src/env.ts` additionally **warns** (not throws) at boot when the key is missing in prod — deliberate, so a deploy that intentionally runs without inbound webhooks still boots while the request path stays fail-closed. Test: `server/src/middleware/__tests__/verifyTelnyxWebhook.prod.test.ts`. Green.
- **PR/commit:** `165eb01` / PR #88.
- **Current risk:** LOW. Forged-webhook hole closed at the request layer. Note the design choice: the fail-closed guarantee is enforced by the **middleware**, not by a hard boot-throw — accurate to characterize as "request-time fail-closed + boot-time warning," not "boot refuses to start." The `VM_WEBHOOK_SHARED_SECRET` path is likewise warn-at-boot; VM live delivery is independently double-gated.
- **Blocks production?** **NO** — satisfied (part of checklist B3).
- **Next action:** set `TELNYX_PUBLIC_KEY` in the prod env (checklist); optionally decide whether VM-webhook auth should be a hard boot requirement when VM live delivery is enabled.

---

## H5 — Branch protection

**Original finding:** the CI `gates` check is declared Required but enforcement could not be confirmed from the repo; nothing in-repo proved protection was enabled.

- **Disposition:** **PARTIALLY RESOLVED / DOCUMENTED.**
  - Core gap → **RESOLVED (owner action + record).** Kevin confirmed (2026-06-30) the required `gates` status check is enabled on `main`; recorded in `P10_BRANCH_PROTECTION_SETTINGS.md`.
  - Auxiliary protections → **STILL OPEN.** Require-PR-before-merge, require-branches-up-to-date, block-force-push, block-deletion, and `CODEOWNERS` are unconfirmed/absent.
- **Evidence:** `P10_BRANCH_PROTECTION_SETTINGS.md` (R6); `.github/workflows/ci.yml` job `gates`.
- **PR/commit:** `78f31b1`.
- **Current risk:** MEDIUM. A required status check alone still leaves `main` open to direct/force-pushes unless those are separately blocked. Check-name fragility: renaming the `gates` job silently vacates the gate.
- **Blocks production?** Partially — checklist **B2** core is 🟢; aux confirmation is a maturity item, not a mechanical GO blocker.
- **Next action:** Kevin confirms the four auxiliary protections in the GitHub UI and updates R6; consider adding `CODEOWNERS` + extending the pre-push hook to run server tests (isolated PR).

---

## H6 — CI matrix coverage

**Original finding:** CI runs a single OS (`ubuntu-latest`) + single Node (22). The product runs on Windows 11; Windows-only breakage is invisible to the gate. Test gate is server-only.

- **Disposition:** **STILL OPEN / DEFERRED (gated CI change).**
- **Evidence:** `.github/workflows/ci.yml` (single job, no `strategy.matrix`); plan in verification report §4 and checklist §6.
- **PR/commit:** none (planned only).
- **Current risk:** MEDIUM. Local dev + this gate run on Windows/Node 24, but CI does not exercise Windows; a Windows-only regression could pass CI. Mitigated in practice by the fact that gates are also run locally on Windows.
- **Blocks production?** **NO** mechanically (it gates a *robust* operation, not the first cutover), but it is a real coverage gap for a Windows-hosted product.
- **Next action:** add `windows-latest` (+ optionally next-LTS Node) to a `strategy.matrix`; extend tests to client workspaces as they appear. Isolated, gated PR. Owner: Kevin. Recommend **Phase 11 / next DevOps slice**.

---

## H7 — Monitoring / alerting

**Original finding:** no real monitoring/alerting stack; `HalfWriteError` and outbox dead-letters are stdout-only strings with no sink; health check is shallow (Mongo-only), and `directPersistenceHealth()` is unmounted.

- **Disposition:** **STILL OPEN / DEFERRED.**
- **Evidence:** `server/src/routes/health.ts`; `server/src/persistence/index.ts` (`directPersistenceHealth()` exists, unmounted); plan in verification report §10 + checklist §6.
- **PR/commit:** none (planned only).
- **Current risk:** MEDIUM–HIGH for a live service — operational blindness once running. Lower right now because nothing is in production.
- **Blocks production?** **NO** mechanically for the first cutover, but a production service should not run long without it. Combined with H1's now-fixed drain, the "silent drift with no operator signal" scenario is reduced but alert-routing is still absent.
- **Next action:** liveness/readiness split backed by `directPersistenceHealth()`; route the existing `[ALERT]`/`[CRITICAL]` taxonomy to a real sink; define alert conditions. Reusing Telnyx/Resend as a channel would *send* → Kevin approval. Recommend **Phase 11**.

---

## H8 — Dependency / vulnerability scanning

**Original finding:** no automated vuln scanning (`pnpm audit` / Dependabot / Renovate / osv-scanner) in CI. Reproducibility is strong (committed lockfile with SHA-512 integrity, `--frozen-lockfile`); known-CVE detection is absent.

- **Disposition:** **STILL OPEN / DEFERRED (gated CI change).**
- **Evidence:** `.github/workflows/ci.yml` (no audit step); `.npmrc` + `pnpm-lock.yaml` (the strong controls that *are* present); plan in verification report §8 + checklist §6.
- **PR/commit:** none (planned only).
- **Current risk:** MEDIUM. Supply-chain provenance is solid; the gap is detecting newly-disclosed CVEs in pinned deps (`express`, `mongoose`, `undici`, `jose`, `argon2`, `pdfkit`, …).
- **Blocks production?** **NO** mechanically, but should precede sustained public exposure.
- **Next action:** add `pnpm audit --audit-level=high` and/or Dependabot/Renovate (network-dependent → CI or Kevin). Keep `--frozen-lockfile`. Recommend **Phase 11**.

---

## H9 — Release checklist / topology

**Original finding:** no single authoritative go/no-go checklist; production topology unresolved (triple-stack + GPU on local Windows; VPS has no GPU; `D:/server-gateway-mcp-v2` outside VCS).

- **Disposition:** **DOCUMENTED / DECISION MADE.**
  - "No checklist" gap → **RESOLVED (docs).** `P10_PRODUCTION_RELEASE_CHECKLIST.md` (R2) is the single authoritative go/no-go artifact (its own verdict: 🔴 NO-GO).
  - Topology → **DECIDED (R3):** InterServer VPS + Atlas + Aura + Chroma Cloud (approved knowledge) + local-GPU batch embeddings (MiniLM 384-dim, ≤12h SLA) + CPU MiniLM query-embedder; gateway dropped from the prod path. Execution not started.
  - Execution detail planned in `P10_EMBEDDING_PIPELINE_AND_DIRECT_MODE_MIGRATION_PLAN.md` (R4) and unblocked-by `P10_MCS_V2_SCHEMA_DESIGN.md` (R7).
- **Evidence:** R2, R3, R4, R7; `docs/DEPLOYMENT_GUIDE.md` §8.
- **PR/commit:** `543c060` (checklist), `34fdf87` (topology), `029d988`→`a10897d`→`f07d065`→`ef1acd7` (embedding plan evolution), `f976dd3` (schema design).
- **Current risk:** LOW as a *decision/knowledge* gap (now closed); the residual is pure **execution** (provisioning, pipeline build, direct-mode flip) + the write-freeze.
- **Blocks production?** **YES** at the execution level — checklist **B1** (execution pending) and the write-freeze both stand between "decided" and "deployed." As a Phase 10 *deliverable*, the finding is discharged.
- **Next action:** raise the ACR (managed-cloud + Chroma Cloud + batch pipeline; extends ACR-0007) and log it in the decision ledger; then execute B1 per R4. Owner: Kevin.

---

## Roll-up

| Finding | Disposition | Fix type | Blocks prod? | Recommended home |
|---|---|---|---|---|
| H1 | Partially resolved | code + plan | Yes (B4) | Kevin: schema → smoke → backup plan |
| H2 | Resolved | code | No | shipped (PR #88) |
| H3 | Resolved | code | No | shipped (PR #88) |
| H4 | Resolved | code | No | shipped (PR #88) |
| H5 | Partially resolved / documented | owner + docs | Partial (B2 aux) | Kevin: confirm aux protections |
| H6 | Still open | deferred | No | Phase 11 (gated CI PR) |
| H7 | Still open | deferred | No (maturity) | Phase 11 |
| H8 | Still open | deferred | No | Phase 11 (gated CI PR) |
| H9 | Documented / decided | docs/decision | Yes (B1 execution) | Kevin: ACR + execute |

**Four of nine resolved in code (H2/H3/H4 + H1's correctness bug). Two documented/decided (H5 core, H9). Three deferred to a later DevOps slice (H6/H7/H8). Production remains NO-GO on B1/B4/B5/B6.**

---

## Standing-prohibition note

Reconciliation only — nothing implemented, sent, or written to any store. No `.env` edit, no secret, no production flag, no Telnyx/voice/`.com`/LLM activation, no deployment.
