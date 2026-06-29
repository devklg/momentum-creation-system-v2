# Sprint 3 · S3.13 — Controlled UI Canary (Route + Response Flags) — Final Verification

**Slice:** S3.13 — controlled UI canary with route + response flags (canary-only package)
**Role:** Agent E — final integrator / verifier
**Date:** 2026-06-29
**Verdict:** `PASS WITH CONDITIONS`

---

## 1. Executive Result

S3.13 delivers a **canary-only** package — readiness review, operator checklist, a local-only
operator canary guide, and one new additive static UI-leak governance test — that lets Kevin
observe the live degraded `safe_fallback` Michael runtime render on `.team` before any broader
enablement. **No production code changed.** All build/typecheck/test gates are green (full server
suite 1091/1091; the new S3.13 governance test 42/42; every adjacent regression suite intact).

The verdict is **`PASS WITH CONDITIONS`** for one honest reason: the canary *package* is complete
and the gates are green, but the **manual browser/local canary was NOT executed by an agent** —
no real authenticated `.team` session was driven, no screenshots taken, no flags flipped. The
package is the deliverable; the live run is Kevin/operator-owned and remains pending. Flags stay
default-off and the route remains degraded-`safe_fallback`-only.

## 2. Latest Verified `main` Commit

- **`main` HEAD:** `9670d32` — *"Merge pull request #66 from devklg/codex/s3-12-body-ba-rejection-canary"*.
- **Working tree at start:** clean apart from the five new S3.13 artifacts (below).
- Verified against the repository (`git rev-parse`, `git log`), not chat memory.

## 3. Prior Slice (S3.12) — Committed + Passed

- **Prior slice:** S3.12 — Body-BA / Client Runtime Input Rejection Canary.
- **Report on disk:** `engineering/reports/SPRINT_003_S3_12_BODY_BA_REJECTION_CANARY_VERIFICATION.md`.
- **Status / verdict:** **`PASS WITH CONDITIONS`** (report header and §1 Executive Result).
- S3.12 is committed to `main` (it is the content of the merged PR #66 at HEAD `9670d32`).

## 4. S3.12 Recommendation Followed

S3.12 consumed S3.11 recommendation #1 (the body-BA rejection canary). The **next** ordered
S3.11 recommendation is *"Controlled UI canary with route + response flags enabled — Kevin-owned,
`.team` only, to observe the live degraded `safe_fallback` end-to-end render before broader
enablement."* S3.13 follows that recommendation **exactly** and does **not** advance into
approved-knowledge retrieval, production/staging enablement, persistence, LLM, voice, or `.com`.

## 5. S3.13 Scope

Confined to a `.team`-only, local/controlled, **degraded `safe_fallback`-only** canary:

- Observe the calm `disabled` state (flags default-off → real `503 michael_runtime_disabled`).
- Observe the degraded `safe_fallback` render when route + response are enabled **locally only**.
- Pin the UI-leak boundary additively with one new static governance test.
- No flag-default change, no prod/staging enablement, no persistence/LLM/voice/`.com`/retrieval,
  no new `/api/runtime/*` route, no acceptance of client runtime / body-authority input.

## 6. Files Changed (the five new, additive artifacts)

1. `engineering/reports/S3_13_CONTROLLED_UI_CANARY_READINESS_REVIEW.md` (Agent A — readiness gate).
2. `engineering/reports/S3_13_CONTROLLED_UI_CANARY_CHECKLIST.md` (Agent B — operator checklist).
3. `engineering/canaries/s3_13_michael_ui_canary.md` (Agent C — local-only operator guide).
4. `server/src/routes/__tests__/s313MichaelRuntimeControlledUiCanaryBoundary.test.ts` (Agent D — new static UI-leak governance test, 42 tests).
5. `engineering/reports/SPRINT_003_S3_13_CONTROLLED_UI_CANARY_VERIFICATION.md` (this report).

All five are **new** files (additive). No existing file was modified.

## 7. Files Explicitly NOT Touched

- `server/src/routes/michael-runtime.ts` — unchanged (production route).
- `apps/team/src/components/cockpit/MichaelRuntimeSupportCard.tsx` — unchanged (production card).
- `server/src/config/michaelRuntimeFlags.ts` — unchanged; flag **defaults** stay default-off.
- `server/src/index.ts` — no edits (no new mount needed).
- `apps/com/**` (`.com` / prospect-facing) — untouched.
- `.env`, `.env.example`, deployment / infra / env config — untouched.
- Existing S3.x tests (S3.4 / S3.6 / S3.9 / S3.10 / S3.11 / S3.12 behavioral + governance) — not
  weakened, relaxed, deleted, or reordered.
- Ratified governance docs (locked-spec, build-registry, wireframe, decision ledger,
  handoff-contract) — not rewritten.

## 8. Canary Checklist Summary

The Agent B checklist (`S3_13_CONTROLLED_UI_CANARY_CHECKLIST.md`) and the Agent C operator guide
(`engineering/canaries/s3_13_michael_ui_canary.md`) provide a human-runnable, `.team`-only,
local-non-production canary with a 10-row pass/fail table (C1–C10): card loads → calm disabled
state from real 503 → enable route+response locally → single live `POST` → degraded `safe_fallback`
renders → no IDs/trace/counters/internals → no `trace` key (trace off) → body is `{}`/`{language}`
only → optional admin-only counter → rollback restores the disabled state. Both documents forbid
prod/staging enablement, `.env`/deploy commits, body/PII/cookie logging, and any real
`next_training_step`. The Agent C guide sends only the three safe payloads (`{}`, `{language:"en"}`,
`{language:"es"}`) and inspects only status / `ok` / `responseType` / optional `catalogKey`.

## 9. Automated Test Summary

- **New S3.13 governance test:** `s313MichaelRuntimeControlledUiCanaryBoundary.test.ts` — **42/42 passed.**
  Static source-text scan (no production import): card sends only `{}`/`{language}`; never references
  `turn`/`runtimeTurn`/`contextPacket`/`baId`/`sponsorBaId`/`targetBaId`/`downlineBaId`/`prospectId`/
  `prospectToken`/`sessionId`/`turnId`/`correlationId`; renders no `trace`/`selectionRequest`/Context-Packet/
  `safety`/`persistence`/`agentResponseGenerated`/nextStep-boolean-flags; no storage/analytics; no
  `.com`/voice/LLM imports; useEffect has a cancellation guard; no retry loop; route allowlists only
  `language`, rejects unknown keys via `CLIENT_RUNTIME_INPUT_NOT_ALLOWED`, uses `requireAuth` +
  `requireSteveComplete`, builds the turn via `createMichaelRuntimeTurnForAuthenticatedBa`, resolves via
  the inert `resolveMichaelRuntimeTurnResponse` facade, wires no store/Gateway/GraphRAG/retrieval/LLM/
  voice/persistence, and mounts no bare `/api/runtime`.
- **Regression:** full server suite **1091/1091** passed (85 files); adjacent Michael-runtime and
  governance suites all green (see §11 table). No existing test weakened.

## 10. Manual Canary Status

**`not_run_by_agent`.** No agent executed the live browser/local canary: no authenticated `.team`
session was driven, no flags were flipped, no `POST /api/michael-runtime/resolve` was issued against a
running server, and no screenshots/evidence were captured. The checklist (Agent B) and operator guide
(Agent C) exist to be run by Kevin/operator. This report does **not** claim any live observation.

**Expected local canary result** (for the operator who runs it):
- **Flags off (default):** `POST /api/michael-runtime/resolve` → **`503`** `{ ok:false, reason:"michael_runtime_disabled" }`;
  card shows the calm `disabled` state ("Not available yet"), driven by the real endpoint.
- **Route + response on (local only):** route → **`200`**, `ok:true`, `response.responseType` =
  **`safe_fallback`**, `catalogKey` = **`michael_safe_fallback_degraded_en`**, `agentResponseGenerated:false`,
  persistence `"disabled"`, **no `trace` key** (trace axis off); the card renders the calm degraded
  guidance paragraph with no "next step" block and **no IDs/trace/counters/internals leaked**.
- **Negative guards unchanged:** missing session → `401`; any non-`language` body key or bad `language`
  value → `400 CLIENT_RUNTIME_INPUT_NOT_ALLOWED`; body allowlist stays exactly `{ language?: 'en' | 'es' }`.

## 11. Actual Gate Results

| Gate command | Result | Counts |
|---|---|---|
| `pnpm build:shared` | PASS | `@momentum/shared` tsc build clean |
| `pnpm typecheck` | PASS | 5 projects (shared, com, admin, team, server) — all Done |
| `pnpm build` | PASS | all workspaces built (team chunk-size warning only — informational) |
| `pnpm --filter @momentum/team typecheck` | PASS | `tsc -b` clean |
| `pnpm --filter @momentum/server test` | PASS | 85 files / **1091 tests** passed |
| `pnpm --filter @momentum/server test -- s313MichaelRuntimeControlledUiCanaryBoundary` | PASS | 1 file / **42 tests** |
| `pnpm --filter @momentum/server test -- s312MichaelRuntimeBodyBaRejectionCanary s312MichaelRuntimeBodyBaCanaryGovernanceBoundary` | PASS | 2 files / **53 tests** |
| `pnpm --filter @momentum/server test -- michael-runtime michael-runtime.server-owned-turn` | PASS | 7 files / **100 tests** |
| `pnpm --filter @momentum/server test -- s311MichaelRuntimeServerOwnedTurnGovernanceBoundary s39MichaelRuntimeUiServerBoundary` | PASS | 2 files / **40 tests** |
| `pnpm --filter @momentum/server test -- orchestrationBoundary s24GovernanceBoundary` | PASS | 2 files / **22 tests** |

No transient failures; no re-run required.

## 12. 22-Point Canary Boundary Confirmation

All confirmed for this slice (verified against the route, card, flags, and new governance test):

1. **Canary-only** — package of docs + one additive test; no production code changed. ✔
2. **No production enablement** — flags untouched, defaults stay off. ✔
3. **No staging enablement** — no staging config touched; staging stays default-off. ✔
4. **No flags flipped by default** — `michaelRuntimeFlags.ts` unchanged. ✔
5. **No `.env` / deploy config changed** — `.env`/`.env.example`/infra untouched. ✔
6. **No `.com`** — `apps/com/**` untouched; Michael never prospect-facing. ✔
7. **No `/api/runtime`** — no bare runtime route; test #41 pins its absence. ✔
8. **No persistence** — no Mongo/Neo4j/Chroma/Gateway/GraphRAG/tripleStack write (route + test #40). ✔
9. **No LLM** — no OpenAI/Anthropic/Claude client (route + tests #25/#38). ✔
10. **No dynamic generation** — fixture returned by reference; `agentResponseGenerated:false`. ✔
11. **No voice / Telnyx / PSTN** — no call-control wiring (tests #24/#39). ✔
12. **No store/Gateway/GraphRAG/retrieval** — route imports none (test #37). ✔
13. **Context Manager sole assembler** — turn built via `createMichaelRuntimeTurnForAuthenticatedBa`
    delegating to the sanctioned context layer; route assembles no packet itself. ✔
14. **UI sends no turn / Context Packet / BA-prospect-session authority** — body is `{}`/`{language}`
    only (card + tests #2–#14). ✔
15. **Route server-owned + session BA** — BA scope from `req.session.baId`; body BA authority rejected. ✔
16. **Route resolves degraded `safe_fallback`** — `michael_safe_fallback_degraded_en`, fail-closed. ✔
17. **UI read-only + leak-free** — no IDs/trace/counters/internals rendered (tests #15–#30). ✔
18. **Approved-knowledge retrieval deferred** — only the degraded fixture resolves today. ✔
19. **Michael `.team` BA-facing only** — never on `.com`, never an automated actor. ✔
20. **Steve / Ivory inactive** — neither invoked; onboarding gate (`requireSteveComplete`) only gates access. ✔
21. **No client runtime/body-authority input accepted** — non-`language` keys → `400 CLIENT_RUNTIME_INPUT_NOT_ALLOWED`. ✔
22. **No existing S3.x test weakened** — the new test is purely additive; full suite green. ✔

## 13. Remaining Conditions

1. The **manual local canary was not run by an agent** (`not_run_by_agent`). The live observation —
   flags-off `503` + calm UI, then route+response-on `200` `safe_fallback` with no leaks — is
   Kevin/operator-owned and pending. Evidence is not yet recorded.
2. **Flags remain default-off.** No production or staging enablement was performed or is recommended
   without Kevin's explicit, separate approval.
3. **Approved-knowledge / Context Manager retrieval is still deferred** — only the degraded
   `safe_fallback` resolves; no real `next_training_step` exists yet.
4. `apps/team` still has **no behavioral test runner**, so UI enforcement remains static-scan-based
   in the server vitest suite (the proven s39/s311/s313 convention).

## 14. Next Recommended Slice

Per the brief's decision tree — the controlled UI canary **package** is complete and gates are green,
but the **manual canary was not run with evidence** — recommend:

- **S3.14 — Controlled UI Canary Execution Record.** Kevin/operator runs the S3.13 checklist locally
  (route + response flags on, `.team` only), confirms the flags-off `503`/calm-UI and flags-on `200`
  `safe_fallback`/leak-free observations, then records the evidence (status + safe fields + worded UI
  state; no PII/cookies/bodies) and rolls back to default-off. Do **not** implement S3.14 in this slice.

Later options (not next): plan approved Context Manager retrieval to move beyond degraded
`safe_fallback`; and stand up an `apps/team` behavioral test runner.

**Guardrail for the next slice:** do not flip flag defaults, enable prod/staging, persist runtime
data, call an LLM, generate text, activate voice, touch `.com`, create `/api/runtime/*`, or accept
client runtime / body-authority input.

---

**Final verdict: `PASS WITH CONDITIONS`** — canary package complete, all gates green, no production
code changed; the live manual canary is pending (`not_run_by_agent`) and flags remain default-off.
