# SPRINT 003 · P3.15 — Michael Runtime UI Behavioral Test Coverage — Verification

Phase: Phase 3 — Finish Michael Runtime Activation Path
Slice: P3.15 (Michael Runtime UI Behavioral Test Coverage)
Worktree branch: `feature/phase-03-michael-runtime-closeout`
Base SHA (REPO_STATE_PACKET): `0550d32ccfbc2f09e9146fb5f5db9988dae88c71`
Builds on: P3.14 (runner + first suite), merged via PR #68
Date: 2026-06-29

---

## 1. Scope

P3.14 stood up the apps/team runner and pinned the helper's status mapping plus
the headline render states. P3.15 **broadens** behavioral coverage of the same
in-scope component (`apps/team/src/components/cockpit/MichaelRuntimeSupportCard`),
targeting render-state branches and side-effect governance the first suite did
not reach. No new infrastructure; no files outside the worktree's allowed list.

New file:
- `apps/team/src/components/cockpit/__tests__/MichaelRuntimeSupportCard.render-states.test.tsx`
  — 15 tests.

## 2. Coverage added (15 tests)

Loading & landmarks:
- Transient loading copy paints before the resolve settles (fetch held pending).
- Accessible region (`role="region"`, name "Michael runtime training support")
  and heading ("Michael · Training Support") are present.
- No "Try again" affordance while loading.

safe_fallback / safe_close defaults:
- Default safe_fallback copy renders when server text is empty.
- Default safe_close copy renders when server text is empty.
- Server-provided safe_close text is preferred over the default.

success variants:
- Text-only success renders no "Your next step" block.
- Title-only `nextStep` renders the block + title.
- Optional `nextStep.label` renders when present.
- Non-English guidance language read-back ("Guidance · es").
- `clarification_question` renders like a success state.

"Try again" gating:
- Present only in the error state; disappears after a successful recovery.
- Absent in the disabled state.

Side-effect governance (standing prohibitions at the UI edge):
- No `localStorage` / `sessionStorage` writes across a successful resolve.
- Exactly one network call on mount; no `navigator.sendBeacon` analytics.

## 3. Standing-prohibition verification

| Prohibition | Status |
|---|---|
| No `.com` exposure | Held — apps/team test only. |
| No `/api/runtime/*` | Held — no routes; mocked `fetch` to existing route. |
| No unapproved persistence | Held — explicit no-storage assertion added. |
| No LLM calls | Held — `fetch` stubbed. |
| No dynamic generation | Held — assertions over fixtures. |
| No voice/Telnyx/PSTN | Held. |
| No automatic sending/calling/scheduling/scoring/ranking | Held — no beacon / second request. |
| No income/comp/cycle/placement guarantees | Held (also asserted in P3.14 suite). |
| No agent approves knowledge | Held — N/A. |
| Context Manager sole Context Packet assembler | Held — client sends no packet. |

## 4. Gate results

| Gate | Result |
|---|---|
| `pnpm build:shared` | PASS |
| `pnpm typecheck` (all 5 projects) | PASS |
| `pnpm build` | PASS |
| `pnpm --filter @momentum/team typecheck` | PASS |
| `pnpm --filter @momentum/team typecheck:test` | PASS |
| `pnpm --filter @momentum/team test` | PASS — 2 files / 41 tests |
| `pnpm --filter @momentum/server test` | PASS — 85 files / 1091 tests |

## 5. Finding (not fixed in this slice)

The `safe_close` empty-text default in `MichaelRuntimeSupportCard.tsx`
(`'Nothing more to add for now. You&rsquo;re good to keep going.'`) is a JS
string literal, so the `&rsquo;` HTML entity is rendered **literally** rather
than as a curly apostrophe. This is a latent, low-severity display nit; the
`safe_fallback` default and JSX-text copy elsewhere are unaffected. Tests here
deliberately assert on the entity-free substring ("Nothing more to add for now")
so they do not lock in the quirk. Recommend fixing in a follow-up (replace the
entity with a literal `’` or move the string into JSX text). Out of scope for a
test-coverage slice.

Status: **P3.15 COMPLETE.** UI behavioral coverage broadened to 41 tests; all gates green.
