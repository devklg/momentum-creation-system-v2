# SPRINT 003 · P3.16 — Michael Runtime Admin Observability UI — Verification

Phase: Phase 3 — Finish Michael Runtime Activation Path
Slice: P3.16 (Michael Runtime Admin Observability UI)
Worktree branch: `feature/phase-03-michael-runtime-closeout`
Base SHA (REPO_STATE_PACKET): `0550d32ccfbc2f09e9146fb5f5db9988dae88c71`
Builds on: P3.14 (runner, #68) and P3.15 (#69)
Date: 2026-06-29

---

## 1. Scope & authorization

The server side of admin observability already existed
(`server/src/routes/admin/michael-runtime-observability.ts` +
`services/michaelRuntimeObservability.ts`, S3.6). P3.16 adds the **admin UI** that
consumes it. That UI lives in `apps/admin`, which is **outside** this worktree's
allowed-files list, and `apps/admin` had **no test runner** (same as `apps/team`
before P3.14).

Surfaced to Kevin; he authorized **"Build component + tests, no nav wiring"**:
build the runner + component + behavioral tests, but do **not** modify existing
admin routing/navigation files. This slice honors that — no existing admin file
was edited except `package.json` / `tsconfig.json` (runner infra) and the
lockfile. The panel is a separately-importable component, intentionally **not**
wired into the router/nav (left for a follow-up).

## 2. What was added

Runner infrastructure (mirrors P3.14):
- `apps/admin/package.json` — devDeps `vitest@4.1.9`, `jsdom@^25`,
  `@testing-library/{react,dom,jest-dom}`; bumped `vite` `6.0.3 → 6.4.3` to match
  the vitest 4.1.9 ModuleRunner. Scripts `test`, `test:watch`, `typecheck:test`.
- `apps/admin/vitest.config.ts` (jsdom env, react plugin, setup, aliases).
- `apps/admin/src/test/setup.ts` (jest-dom matchers + DOM cleanup).
- `apps/admin/tsconfig.json` — `exclude` test/setup files so `tsc -b`
  (build + typecheck gates) stays clean and no test code ships in the bundle.
- `apps/admin/tsconfig.vitest.json` — statically type-checks the tests.

Component (P3.16):
- `apps/admin/src/components/admin/MichaelRuntimeObservabilityPanel.tsx` —
  read-only panel + exported `fetchMichaelRuntimeObservability()` helper.

Tests:
- `apps/admin/src/components/admin/__tests__/MichaelRuntimeObservabilityPanel.test.tsx`
  — 21 tests.

## 3. Component behavior

- GET `/api/admin/michael-runtime/observability` with `credentials: 'include'`,
  on mount and on manual **Refresh**. Read-only: no body, no write verb.
- Renders the three evaluated kill-switch flags (Route / Response / Trace) and
  the six aggregate counters (route-disabled skips, response-disabled skips,
  successful resolutions, facade failures, body BA-override rejections,
  missing-turn rejections).
- States: `loading` / `ok` / `unauthorized` (401/403) / `error` (any other
  non-200, network/parse failure, or malformed shape) — all leak-free.
- Counter fields are coerced to `0` when missing/non-numeric (defensive render);
  flags must be booleans or the result fails closed to `error`.

## 4. Coverage summary (21 tests)

Helper `fetchMichaelRuntimeObservability`:
- Credentialed GET to the admin route, no body, no write verb.
- 200 valid → `ok` with parsed flags + counters; 401/403 → `unauthorized`;
  400/404/500/503 → `error`; network throw, unparseable 200, `ok!==true`,
  non-boolean flags → `error`; garbage counter fields coerced to 0.

Component:
- Loading paint; labelled region + heading; flag states + counter values render;
  unauthorized and error messages; Refresh re-fetches and updates values.

Governance:
- Only GET requests ever issued (asserted across mount + refresh), never a body.
- No `localStorage` / `sessionStorage` writes.
- No income / compensation / placement copy in the render.

## 5. Standing-prohibition verification

| Prohibition | Status |
|---|---|
| No `.com` exposure | Held — admin-only panel; the route is `requireAdmin`. |
| No `/api/runtime/*` | Held — consumes existing `/api/admin/michael-runtime/observability`. |
| No unapproved persistence | Held — pure read; explicit no-storage assertion. |
| No LLM calls | Held — `fetch` stubbed; no model. |
| No dynamic generation | Held — renders fixtures/aggregates. |
| No voice/Telnyx/PSTN | Held. |
| No automatic sending/calling/scheduling/scoring/ranking | Held — GET-only; no writes. |
| No income/comp/cycle/placement guarantees | Held — negative render assertion. |
| No agent approves knowledge | Held — N/A. |
| Context Manager sole Context Packet assembler | Held — N/A; counts only. |

## 6. Gate results

| Gate | Result |
|---|---|
| `pnpm build:shared` | PASS |
| `pnpm typecheck` (all 5 projects) | PASS |
| `pnpm build` | PASS — apps/admin bundles clean; test files excluded |
| `pnpm --filter @momentum/admin typecheck` | PASS |
| `pnpm --filter @momentum/admin typecheck:test` | PASS |
| `pnpm --filter @momentum/admin test` | PASS — 1 file / 21 tests |
| `pnpm --filter @momentum/team test` | PASS — 2 files / 41 tests |
| `pnpm --filter @momentum/server test` | PASS — 85 files / 1091 tests |

## 7. Notes / follow-ups

- **Not wired into nav** by design (per the authorized scope). A follow-up should
  add the panel to the admin router/navigation when Kevin approves placement.
- `.env` / deployment config untouched.

Status: **P3.16 COMPLETE** (component + runner + tests). Nav wiring deferred to a
follow-up.
