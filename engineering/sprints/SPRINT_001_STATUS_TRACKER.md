# Sprint 1 Status Tracker

Date: 2026-06-28 (updated after Wave 2B verification and main repair)

Sprint: Sprint 1 - Platform Alignment

Architecture version: v1.0 frozen

## Current Sprint State

Sprint 1 remains governed by the frozen v1.0 architecture and the Sprint 1 platform-alignment boundaries. Wave 2B (S1.5, S1.6) is approved, implemented, and verified, and `main` has been repaired to a compiling/passing state. This tracker records status only. ACR-0009 later approved and implemented Gateway HTTP persistence fallback retirement; this tracker does not approve runtime activation, event persistence/outbox/replay/subscriber/API activation, `/api/runtime/*` mounting, or Sprint 2 work.

## Workstream Status

| Item | Workstream | Status | Evidence / Next Step |
|---|---|---:|---|
| S1.1 | Shared Runtime Contracts | IMPLEMENTED / VERIFIED | `engineering/reports/S1_1_SHARED_RUNTIME_CONTRACTS_IMPLEMENTATION_VERIFICATION.md` |
| S1.2 | Backend Runtime Boundary Skeleton | IMPLEMENTED / VERIFIED | `engineering/reports/S1_2_BACKEND_RUNTIME_BOUNDARY_IMPLEMENTATION_VERIFICATION.md` |
| S1.3 | Runtime Persistence Direct Adapter Migration | CLOSED / VERIFIED | `engineering/reports/S1_3_CLOSEOUT_GOVERNANCE_RECORD.md` |
| S1.4 | Runtime Event Foundation | IMPLEMENTED / VERIFIED | `engineering/reports/S1_4_RUNTIME_EVENT_FOUNDATION_IMPLEMENTATION_VERIFICATION.md` |
| S1.5 | Context Packet Foundation | IMPLEMENTED / VERIFIED | `engineering/reports/S1_5_CONTEXT_PACKET_FOUNDATION_IMPLEMENTATION_VERIFICATION.md` |
| S1.6 | Browser Voice/Text Foundation | IMPLEMENTED / VERIFIED | `engineering/reports/S1_6_BROWSER_VOICE_TEXT_FOUNDATION_IMPLEMENTATION_VERIFICATION.md` |
| S1.7 | QA Harness Scaffolding | IMPLEMENTED / VERIFIED | `engineering/reports/S1_7_QA_HARNESS_SCAFFOLDING_VERIFICATION.md` |

## Wave 2B Status

Wave 2B Integration Review: PASS WITH CONDITIONS - `engineering/reports/SPRINT_001_WAVE_2B_INTEGRATION_REVIEW.md`.

Wave 2B implemented / verified items:

1. S1.5 - Context Packet Foundation.
2. S1.6 - Browser Voice/Text Foundation.

main repair note: The prior Wave 2B merge left `main` failing `pnpm typecheck` and `pnpm build` due to a type error in `server/src/runtime/browser/foundation.ts`. This was repaired by applying the verified S1.6 browser foundation finishing work (and matching `index.ts` exports and browser tests).

Gates re-run independently on a clean `main` worktree with the repair applied:

- `pnpm typecheck` - PASS (5 projects).
- `pnpm build` - PASS (warnings only).
- `pnpm --filter @momentum/server test` - PASS (15 files / 60 tests).

Locked rules confirmed held at Sprint 1 closeout: ratified docs untouched; `.com` untouched; caller sites not rewritten; `/api/runtime/*` not mounted; no event persistence/outbox/replay/subscriber/API; runtime events use the S1.4 foundation; agents cannot directly access stores; Context Manager is the sole Context Packet assembler; candidate/review-only knowledge excluded by default; Browser Voice/Text is `.team` only; Telnyx/PSTN/call-control excluded; text fallback required; EN/ES preserved. Gateway HTTP fallback status is superseded by ACR-0009.

## Open Conditions

1. The Wave 2B foundation merge to `main` was not gated on typecheck/build. Recommend enforcing `pnpm typecheck` and `pnpm build` as required merge checks.
2. Stale local feature branches and linked worktrees remain and should be reviewed and pruned by the owner.

## Governance Confirmations

- Gateway HTTP persistence fallback retirement was approved and implemented by ACR-0009.
- `.com` prospect-facing surfaces remain untouched.
- Ratified documents were not modified.
- `/api/runtime/*` is not mounted.
- Agents cannot directly access stores.
- Sprint 2 implementation has not started.

## Explicit Non-Actions

- Do not reintroduce Universal Gateway as an app runtime persistence dependency.
- Do not begin Sprint 2.
- Do not activate event persistence, outbox, replay, subscribers, or the event API.
- Do not mount `/api/runtime/*`.
- Do not modify ratified documents.
- Do not modify `.com` prospect-facing surfaces.

## Owner Cleanup — Stale Branches / Worktrees (action: owner; not executed here)

Recorded per Sprint 1 final-review prep. Nothing below was deleted; this is a
reviewed inventory for the owner. Branch comparison is against `main` as
`main-ahead / branch-ahead`.

### Local branches

| Branch | vs main | Disposition |
|---|---|---|
| `codex/app-state-audit-html` | 120 / 0 | Fully contained in `main` — safe to delete. |
| `codex/s1-2-backend-runtime-boundary` | 8 / 0 | Fully contained — safe to delete, but it is checked out in the primary dir `D:/momentum-creation-system-v2`; re-point that worktree to `main` first. |
| `codex/wave-2a-integration-review` | 8 / 0 | Fully contained — safe to delete. |
| `codex/wave-2b-context-browser-foundations` | 7 / 4 | Has 4 unique commits not on `main` (divergent older browser foundation + a redundant S1.5 commit). Superseded by `main`'s reconciled S1.5/S1.6. **Do NOT merge into `main`** (would regress the repaired browser foundation). Force-delete only after the owner confirms nothing unique is wanted. |
| `feat/s1.3-phase0-1-direct-persistence` | 53 / 0 | Fully contained (S1.3 CLOSED/VERIFIED on `main`) — safe to delete. |

### Worktrees

| Path | Branch / HEAD | Note |
|---|---|---|
| `D:/momentum-creation-system-v2` | `codex/s1-2-backend-runtime-boundary` | Primary clone dir is pinned to a feature branch, not `main`. Recommend `git switch main` here. |
| `D:/agents/.codex/worktrees/6a15/momentum-creation-system-v2` | `codex/app-state-audit-html` | Stale linked worktree. |
| `D:/momentum-creation-system-v2-wave2a-status` | `codex/wave-2b-context-browser-foundations` | Stale linked worktree (divergent branch above). |
| `D:/tmp/mcs-main-s1-5` | `main` | Canonical `main` worktree. Keep. |
| `D:/tmp/mcs-v2-s1-6` | detached HEAD `6796c74` | Stale detached worktree. |

### Suggested owner commands (review first; run manually)

```sh
# Re-point the primary dir to main, then prune stale linked worktrees:
git -C D:/momentum-creation-system-v2 switch main
git worktree remove D:/momentum-creation-system-v2-wave2a-status
git worktree remove D:/tmp/mcs-v2-s1-6
git worktree remove "D:/agents/.codex/worktrees/6a15/momentum-creation-system-v2"
git worktree prune

# Delete fully-merged branches:
git branch -d codex/app-state-audit-html codex/s1-2-backend-runtime-boundary codex/wave-2a-integration-review feat/s1.3-phase0-1-direct-persistence

# Only after confirming nothing unique is wanted (4 unique commits, do NOT merge):
git branch -D codex/wave-2b-context-browser-foundations
```
