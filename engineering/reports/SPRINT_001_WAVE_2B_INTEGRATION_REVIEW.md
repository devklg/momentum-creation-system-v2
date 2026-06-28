# Sprint 1 Wave 2B Integration Review

Date: 2026-06-28
Sprint: Sprint 1 - Platform Alignment
Architecture version: v1.0 frozen
Reviewer: Integration verification pass (independent gate re-run on clean `main` worktree)

## Result

PASS WITH CONDITIONS.

Wave 2B (S1.5 Context Packet Foundation + S1.6 Browser Voice/Text Foundation) is implemented and, with this commit, all three required gates pass on `main`.

## Important Finding: main was merged in a non-compiling state

The prior merge of the Wave 2B foundations into `main` left `main` failing `pnpm typecheck` and `pnpm build`. The committed `server/src/runtime/browser/foundation.ts` had a type error:

```text
server/src/runtime/browser/foundation.ts(236-238): error TS2345:
  Argument of type 'BrowserTranscriptTurn' is not assignable to parameter of type 'Record<string, unknown>'.
```

The server test suite passed even in that state because Vitest transpiles without type-checking, which masked the breakage. This commit applies the verified S1.6 browser foundation finishing work that resolves the error (the `requireString` helper signature was widened from `Record<string, unknown>` to `object`), and includes the matching `index.ts` exports and browser test files.

## Scope Reviewed

- S1.5 Context Packet Foundation (`server/src/runtime/context/`)
- S1.6 Browser Voice/Text Foundation (`server/src/runtime/browser/`)
- Wave 2B integration against the locked Sprint 1 platform-alignment boundaries

## Verification Method

Gates were run directly against a clean `main` worktree with this commit's files applied, and the raw output was read back. Architectural constraints were verified against the actual source.

## Gate Results (independently re-run on main + fix)

| Gate | Command | Result | Evidence |
|---|---|---:|---|
| Typecheck | `pnpm typecheck` | PASS | All 5 projects (shared, admin, com, team, server) report Done; the prior `foundation.ts` errors are resolved. |
| Build | `pnpm build` | PASS | All 5 projects build. Only pre-existing `.com` dynamic-import / chunk-size warnings remain - not errors. |
| Server tests | `pnpm --filter @momentum/server test` | PASS | `vitest run`: 15 test files / 60 tests passed, 0 failed. |

Wave 2B test coverage within the passing suite: `context/__tests__/contextManager.test.ts` (8), `context/__tests__/contextPacketFoundation.test.ts` (6), `browser/__tests__/foundation.test.ts` (7), `browser/__tests__/browserVoiceTextFoundation.test.ts` (6).

## Locked Rule Verification

| Locked Rule | Status |
|---|---:|
| Do not remove Gateway fallback | HELD (persistence adapters retain fallback; not in this diff) |
| Do not modify ratified documents | HELD (only reports/tracker + server runtime browser files changed) |
| Do not modify `.com` prospect-facing surfaces | HELD (no `apps/com` changes) |
| Do not rewrite caller sites | HELD |
| Do not mount `/api/runtime/*` | HELD (no mount; boundary descriptors `apiMounted: false`) |
| No event persistence/outbox/replay/subscribers/API | HELD (browser events `persisted: false`) |
| Runtime events use S1.4 validation foundation | HELD (`createRuntimeEventEnvelope` / `validateRuntimeEventEnvelope`) |
| Agents cannot access stores/GraphRAG/adapters/Gateway directly | HELD (runtime rule `agent_store_access_forbidden`) |
| Context Manager is the only Context Packet assembler | HELD (`generatedBy`/`assembledBy: context_manager` enforced) |
| Candidate/review-only knowledge excluded by default | HELD (forced exclusion; `authorizeCandidateKnowledge` rejected) |
| Browser Voice/Text is `.team` only | HELD (`team_surface_required`) |
| Telnyx/PSTN/call-control excluded | HELD (`external_telephony_forbidden`; only in absence-asserting test) |
| Text fallback required | HELD (`TEXT_FALLBACK_REQUIRED = true`, enforced in every state) |
| EN/ES preserved | HELD (`['en','es']`; es-US/es-MX/es-ES locale map) |

All runtime boundary descriptors remain inert (`activated: false`, `behaviorEnabled: false`, `apiMounted: false`).

## Conditions

1. Root cause: the Wave 2B foundation merge to `main` was not gated on `pnpm typecheck`/`pnpm build`, allowing a non-compiling `main`. Recommend enforcing typecheck + build as required status checks before merge to `main`.
2. Repository hygiene: several stale local feature branches and linked worktrees remain (`codex/s1-2-backend-runtime-boundary`, `codex/wave-2b-context-browser-foundations`, `codex/app-state-audit-html`, a detached `mcs-v2-s1-6` worktree). These should be reviewed and pruned by the owner.

## Recommendation

With this commit `main` compiles, builds, and passes the server suite. Recommended next governance-safe action: enforce typecheck/build as merge gates, prune stale branches/worktrees, then formally close Sprint 1 Wave 2B. Do not begin Sprint 2 without separate approval.
