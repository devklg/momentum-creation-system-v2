# ACR-0011 — LANE A: Server (Steve hook, derivation, evaluator, stall sweep, attestation)

You are an autonomous implementation agent in a dedicated git worktree of Momentum Creation System V2. Your branch: `feat/acr0011-server`. Base: `origin/main` AFTER the Lane 0 shared-foundation PR is merged — `packages/shared` already contains the recruiting-cycle types, constants, schema, and API contract types. Import them; do not redefine.

Read FIRST: `organization/ACR-0011-five-point-recruiting-cycle.md`, `organization/DECISION_upline_onboarding_infusion.md`, `ACR0011_MASTER_BRIEF.md` (worktree root — you own its tasks 2–6 and 8 server-side), and the shared recruiting-cycle module.

## Your scope

1. **Domain `server/src/domain/recruitingCycle.ts`**: cycle creation, derived state (current_step, tranche math from `tmag_ivory_prospect_names` count; invites/presentations from `tmag_prospects` PMV states; follow-ups from `tmag_prospect_crm_followups`; onboarding from prospect `enrolled`), `last_activity_at` updates. Triple-stack writes (Mongo+Neo4j+Chroma) read-back verified, per ACR-0007 — mirror an existing domain's persistence pattern (e.g. `threeWayCalls.ts`). NO parallel activity log.
2. **Steve hook**: on Discovery completion in `steve-success-interview.ts`, create the cycle (targets from enrollment), extract `why_statement` verbatim from the Success Profile motivation section, embed to Chroma, emit handoff event to `tmag_agent_michael_events`. Steve initializes only — never coaches.
3. **Milestone evaluator**: computes five-point completion from derived state; QBA/CORE3 fields are written ONLY via attestation — the evaluator validates against Neo4j `(:BA)-[:ENROLLED {leg, at}]->(:BA)` edges and never self-declares QBA. Milestone hits emit triple-stack milestone events + Michael celebration event.
4. **Stall sweep worker** (mirror `server/src/workers/vmDeliveryWorker.ts`): flag stalled when no qualifying activity for 24h inside the 72h QBA window, 72h thereafter (import the shared LOCKED constants). Flag only (`stall_flagged_at` + support event) — Michael's touch (via `michael-training-support.ts`/`todaysActions.ts` surfaces) retrieves the BA's why from Chroma and opens with it before coaching the earliest incomplete step.
5. **Routes**: implement the Lane 0 contract — `GET /recruiting-cycle/me` (requireAuth + requireSteveComplete) and `POST /recruiting-cycle/:tmagId/attest` (sponsor-of-record or admin ONLY; writes milestone fields + qba_attested_by + audit entry + Neo4j enrollment edges; rejects non-sponsors). Manual attestation ONLY — no THREE back-office calls.
6. **Tests (Vitest, existing style)** per the master brief's task 8: creation on Steve completion, derived counts, sweep timing + flag-only behavior, attestation authz + graph edges, evaluator refusing self-declared QBA, triple-leg read-backs.

## Hard constraints

No ratified-doc edits. No `.com` changes. No new shared types (extend only if a genuine gap — additive). No parallel prospect/names/activity store. Lead-qual repo excluded. Constants from the shared module only. `pnpm install` first if needed. No time estimates.

## Close (required)

- `pnpm --filter @momentum/server typecheck` and `pnpm --filter @momentum/server test` green.
- Commit, `git push -u origin feat/acr0011-server`, `gh pr create --base main`. DO NOT merge.
- Final line: `LANEA COMPLETE PR:<number>` (or `LANEA FAILED: <reason>`).
