# P5.8 — Phase 5 Production Readiness Gate

- Phase: Phase 5 — Michael Production Enablement and Operations
- Slice: P5.8 — the go/no-go gate that must be GREEN before P5.3 (Controlled Enablement) executes.
- Status: **DOCUMENTATION ONLY.** Defines criteria; grants no enablement.
- Date: 2026-07-01
- Depends on: P5.1 (inventory), P5.2 (runbook), P5.4 (incident SOP), P5.5 (copy compliance),
  P5.6 (abuse/rate controls), P5.7 (monitoring), and the anchor readiness assessment.
- Owner: Agent E (final verification)

> This gate is the single checklist Kevin consults before authorizing any production/staging
> enablement window. Every item is a **hard stop**: one red item = NO-GO. Passing the gate does not
> itself enable anything — it establishes that the pre-conditions for an approved enablement window
> are met. Kevin's explicit, recorded approval is still required to open the window (P5.3).

---

## 1. How to use this gate

Before an enablement window: walk every item below, mark GREEN/RED with evidence, and record the
result. If all GREEN, the gate is **passable** and Kevin may authorize a window. Any RED → **NO-GO**;
fix and re-run. The gate is re-run before **each** environment (staging, then production) and before
**each** re-attempt after a rollback.

## 2. Gate A — Repo / build integrity

| # | Criterion | Evidence source | Status |
|---|---|---|---|
| A1 | Deployed SHA matches the reviewed tree | `git rev-parse HEAD` vs release record | ☐ |
| A2 | `pnpm build:shared` clean | P5.9 gate run | ☐ |
| A3 | `pnpm typecheck` clean (all workspaces) | P5.9 gate run | ☐ |
| A4 | `pnpm build` clean (Vite chunk advisories non-failing) | P5.9 gate run | ☐ |
| A5 | `pnpm --filter @momentum/server test` green (record count) | P5.9 gate run | ☐ |
| A6 | `pnpm --filter @momentum/team typecheck` clean | P5.9 gate run | ☐ |

## 3. Gate B — Boundary / standing prohibitions (all must hold)

| # | Criterion | Evidence source | Status |
|---|---|---|---|
| B1 | No `/api/runtime/*` family mounted; only `/api/michael-runtime` | boundary tests + `server/src/index.ts` | ☐ |
| B2 | Route gated `requireAuth` + `requireSteveComplete`; no `requireMichaelComplete` | `server/src/routes/michael-runtime.ts` | ☐ |
| B3 | No `.com`/prospect consumer of the route | P5.5 review | ☐ |
| B4 | No persistence; `persistence:'disabled'`; no write to MCS-V2 `*2` stores | route source + write-freeze | ☐ |
| B5 | No LLM (`agentResponseGenerated:false`; `ANTHROPIC_API_KEY` unset) | route + env | ☐ |
| B6 | No voice/Telnyx path reachable from the route; `TELNYX_*` unset | route + env | ☐ |
| B7 | No dynamic generation (fixture-by-reference `catalogKey`) | route source | ☐ |

## 4. Gate C — Kill switch / environment

| # | Criterion | Evidence source | Status |
|---|---|---|---|
| C1 | Three `MICHAEL_RUNTIME_*` flags unset/off at baseline | P5.1 §2 pre-flight | ☐ |
| C2 | Stage 0 baseline returns `503 michael_runtime_disabled` in the target env | P5.2 §4 smoke | ☐ |
| C3 | Secret manager can set exactly `"true"` (verified, not assumed) | P5.1 §2 | ☐ |
| C4 | Deploy model re-reads `process.env` on restart | P5.1 §8 | ☐ |
| C5 | `ADMIN_BA_IDS`, `JWT_SECRET`, `PROSPECT_BASE_URL`, `CORS_ORIGINS` correct for env | P5.1 §4–§5 | ☐ |

## 5. Gate D — Compliance (BA-facing copy)

| # | Criterion | Evidence source | Status |
|---|---|---|---|
| D1 | BA-facing Michael copy passes compliance review (no income/placement/head-count/THREE) | P5.5 verdict | ☐ |
| D2 | Michael copy cannot reach any prospect-facing/`.com` path | P5.5 §3 | ☐ |
| D3 | No unresolved compliance FLAG open | P5.5 gaps list | ☐ |

## 6. Gate E — Operational readiness

| # | Criterion | Evidence source | Status |
|---|---|---|---|
| E1 | Enablement runbook approved and current | P5.2 | ☐ |
| E2 | Incident SOP approved; rollback owner = Kevin; rollback steps validated in staging | P5.4 | ☐ |
| E3 | Pre-enablement abuse/rate controls in place (per P5.6 "before enablement" set) | P5.6 sequencing | ☐ |
| E4 | Monitoring signals live (admin observability) + production alerting defined | P5.7 | ☐ |
| E5 | Observation windows + one-BA-first rollout agreed | P5.2 §7 | ☐ |

## 7. Gate F — Authorization

| # | Criterion | Evidence source | Status |
|---|---|---|---|
| F1 | Kevin's explicit, recorded approval to open an enablement window exists | P5.3 record header | ☐ |
| F2 | Environment order fixed: staging fully laddered + held before production | P5.2 §5 | ☐ |
| F3 | Rollback authority + window duration explicitly stated | P5.4 + approval | ☐ |

## 8. Verdict rule

- **GO (gate passable):** every A–F item GREEN. Kevin may authorize an enablement window; execution
  is recorded in P5.3.
- **NO-GO:** any item RED. Do not open a window. Remediate and re-run the full gate.

## 9. Non-approval

This gate defines readiness criteria only. A passable gate is a **necessary, not sufficient**,
condition: no flag is flipped, no `.env` edited, and no deployment performed until Kevin opens an
enablement window in writing (P5.3). The gate is re-run before each environment and after any
rollback.
