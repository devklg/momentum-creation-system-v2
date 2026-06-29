# SPRINT 003 · P3.14 — apps/team Behavioral Test Runner — Verification

Phase: Phase 3 — Finish Michael Runtime Activation Path
Slice: P3.14 (apps/team Behavioral Test Runner) + initial P3.15 coverage
Worktree branch: `feature/phase-03-michael-runtime-closeout`
Base SHA (REPO_STATE_PACKET): `0550d32ccfbc2f09e9146fb5f5db9988dae88c71`
Date: 2026-06-29

---

## 1. Readiness (Agent A)

- `git rev-parse HEAD` == Base SHA `0550d32…` — **MATCH**. No `LOCAL_REPO_STATE_MISMATCH`.
- Working tree before start carried only the three untracked bootstrap packets
  (`START_HERE.md`, `REPO_STATE_PACKET.md`, `ORCHESTRATOR_PROMPT.md`) — the
  instructions themselves, not work-in-progress. No tracked-file modifications,
  so no `DIRTY_WORKTREE_BEFORE_START`.
- Dependency gate: Phase 3 is the active runtime path with no upstream gate.
- Worktree `node_modules` were absent (fresh worktree). `pnpm install` was run
  (offline, lockfile up to date) to establish the baseline before any work.
- Baseline gates (pre-change) all green: `build:shared`, repo `typecheck`,
  server `test` (85 files / 1091 tests).

## 2. Problem statement

The next open slice is "apps/team Behavioral Test Runner". `apps/team` had **no
test runner at all** — no `vitest`/`jsdom`/RTL, no `test` script, no test config.
The server owns its own `vitest.config.ts` (node env), but a behavioral test for
`MichaelRuntimeSupportCard.tsx` (a React component) needs a browser-like DOM.

## 3. Scope decision

Standing up the runner requires touching files outside the worktree's narrow
"Allowed Files" list (specifically `apps/team/package.json` + new test config).
This was surfaced to Kevin and **explicitly authorized** ("Authorize infra +
implement") before any code was written. No other out-of-scope files were
touched.

## 4. What was added

Test-runner infrastructure (P3.14):

- `apps/team/package.json` — added devDeps `vitest@4.1.9`, `jsdom@^25`,
  `@testing-library/react@^16`, `@testing-library/dom@^10`,
  `@testing-library/jest-dom@^6`; bumped `vite` `6.0.3 → 6.4.3` to match the
  vitest 4.1.9 ModuleRunner (the server already pairs vitest 4.1.9 with vite
  6.4.3). Added scripts `test`, `test:watch`, `typecheck:test`.
- `apps/team/vitest.config.ts` — jsdom env, React plugin, `src/test/setup.ts`
  setup, aliases mirrored from `vite.config.ts`, globals OFF (explicit imports,
  matching the server suite style).
- `apps/team/src/test/setup.ts` — registers `@testing-library/jest-dom` matchers
  and cleans up the DOM between tests.
- `apps/team/tsconfig.json` — `exclude` test/setup files from the production
  build tsconfig so `tsc -b` (build + typecheck gates) stays clean and **no test
  code ships in the bundle**.
- `apps/team/tsconfig.vitest.json` — dedicated tsconfig that statically
  type-checks the tests (`typecheck:test` script), keeping the required
  `tsc -b` gate untouched.

Behavioral coverage (initial P3.15):

- `apps/team/src/components/cockpit/__tests__/MichaelRuntimeSupportCard.test.tsx`
  — 26 tests across the client helper and the rendered card.

## 5. Behavioral coverage summary (26 tests)

Helper `resolveMichaelRuntimeTrainingStep`:
- Server-owned request contract: POSTs to `/api/michael-runtime/resolve` with
  `credentials: 'include'`; body is `{}` with no hint and `{ language }` with
  one; **never** sends `baId`/`sponsorBaId`/`targetBaId`/`turn`/`contextPacket`/
  ids/tokens (sponsor immutability asserted at the UI edge).
- Kill-switch mapping: 503 `michael_runtime_disabled` → `disabled`; 503
  `michael_runtime_response_disabled` → `response_disabled`; unknown reason and
  unparseable 503 → generic `error`.
- Fail-closed: 400/401/403/422/500, network throw, unparseable 200, `ok:false`,
  missing/non-object `response`, and unknown `responseType` all → `error`.
- Safe shaping: `safe_fallback`/`safe_close` text preserved; `next_training_step`
  / `clarification_question` → `success`; `nextStep` boolean flags
  (`baOwned`/`automaticSending`/`automaticCalling`/`externalSideEffect`) stripped.

Component `MichaelRuntimeSupportCard`:
- Calls resolve exactly once on mount.
- Renders the calm "Not available yet" placeholder under the route kill switch,
  the paused message under the response kill switch, and the next-step
  title/instruction + language read-back on success.
- Error state exposes a "Try again" affordance that re-runs resolve.
- Governance render asserts: ids/trace/boolean-flag internals never reach the
  DOM, and no income/commission/cycle/payout/earnings/guarantee copy appears in
  any state.

## 6. Standing-prohibition verification (Agent D)

| Prohibition | Status under this slice |
|---|---|
| No `.com` exposure | Held — only `apps/team` test infra + tests touched. |
| No `/api/runtime/*` route family | Held — no routes added; tests call the existing `/api/michael-runtime/resolve` via a mocked `fetch`. |
| No unapproved persistence | Held — tests only; no stores/Gateway touched. |
| No LLM calls | Held — `fetch` is stubbed; no network, no model. |
| No dynamic generation | Held — assertions are over fixtures/mapping. |
| No voice/Telnyx/PSTN | Held — none referenced. |
| No automatic sending/calling/scheduling/scoring/ranking | Held — tests assert these flags are stripped and never rendered. |
| No income/comp/cycle/placement guarantees | Held — explicit negative render assertion added. |
| No agent approves knowledge | Held — N/A. |
| Context Manager sole Context Packet assembler | Held — client sends no Context Packet; reaffirmed by the request-contract test. |

## 7. Gate results (Agent E)

| Gate | Result |
|---|---|
| `pnpm build:shared` | PASS |
| `pnpm typecheck` (all 5 projects) | PASS |
| `pnpm build` | PASS — apps/team bundles clean; test files excluded |
| `pnpm --filter @momentum/team typecheck` | PASS |
| `pnpm --filter @momentum/team typecheck:test` | PASS |
| `pnpm --filter @momentum/team test` | PASS — 1 file / 26 tests |
| `pnpm --filter @momentum/server test` | PASS — 85 files / 1091 tests |

## 8. Decisions / notes

- `vite` bumped within v6 (`6.0.3 → 6.4.3`) solely to satisfy vitest 4.1.9; this
  matches the version the server already runs and is the lowest-risk fix for the
  `ModuleRunner … reading 'length'` startup error seen on 6.0.3.
- Test files live under `src/**/__tests__` but are excluded from the production
  tsconfig, so they are never compiled into `dist` or bundled by Vite.
- `.env` / deployment config were not touched.

## 9. Remaining Phase 3 backlog (not in this slice)

- P3.15 — broader Michael runtime UI behavioral coverage (this slice seeds it).
- P3.16 — Michael runtime admin observability UI.
- P3.17 — Phase 3 runtime activation closeout (the phase-level final report,
  `SPRINT_003_PHASE_3_RUNTIME_ACTIVATION_CLOSEOUT.md`, is intentionally deferred
  until the phase is actually complete).

Status: **P3.14 COMPLETE.** Runner is live and green; first behavioral suite landed.
