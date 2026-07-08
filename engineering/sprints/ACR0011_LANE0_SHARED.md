# ACR-0011 — LANE 0: Shared Foundation (schema, provisioning, contracts)

You are an autonomous implementation agent in a dedicated git worktree of Momentum Creation System V2. Your branch: `feat/acr0011-shared`. Base: `origin/main`.

Read FIRST (all in this worktree):
1. `organization/ACR-0011-five-point-recruiting-cycle.md` (APPROVED spec)
2. `organization/DECISION_upline_onboarding_infusion.md`
3. `ACR0011_MASTER_BRIEF.md` (worktree root — full implementation brief; this lane is its task 1 plus contract pinning)
4. `SCHEMA_GOVERNANCE.md`, `server/scripts/provisioning/rev3-registry.mjs`

## Your scope — ONLY this

1. **Types + schema (`packages/shared`)**: `recruiting_cycle` domain types (camelCase TS) and the Mongoose schema for Mongo collection `tmag_recruiting_cycles` (snake_case at the store, `$jsonSchema` floor), fields per ACR-0011 §2.4 including: tmag_id, enrolled_at, five_point_target_at (+48h), five_point_completed_at, qba_target_at (+72h), qba_achieved_at, qba_left_leg_tmag_id, qba_right_leg_tmag_id, qba_attested_by, core3_achieved_at, core3_tmag_id, names_target (100), tranche_size (20), current_step (1-5), last_activity_at, stall_flagged_at, status. LOCKED constants (100, 20, 48h, 72h, stall 24h/72h) exported from ONE shared constants module.
2. **Provisioning**: add `tmag_recruiting_cycles` (Mongo) + `mcs_recruiting_cycles` (Chroma, 384-dim registry metadata like siblings) + Neo4j projection entries to the rev3 registry and provisioning scripts, exactly following existing sibling patterns.
3. **API contract pinning (types only, no server code)**: shared request/response types for (a) `GET /recruiting-cycle/me` (cycle state + derived step/tranche/counts for the team dashboard), (b) `POST /recruiting-cycle/:tmagId/attest` (sponsor attestation: leg 'left'|'right'|'core3', enrollee tmagId), so the server and team lanes build against one contract.

## Hard constraints

- Additive only in `packages/shared` — never break existing exports (concurrent briefs also touch shared).
- No server domain code, no team app code, no ratified-doc edits (`constitution/**`, `runtime/**`, `organization/**`, `docs/locked-spec.md`).
- Run `pnpm install` first if node_modules is absent in this worktree.
- No time estimates.

## Close (required)

- `pnpm --filter @momentum/shared typecheck` green; `pnpm --filter @momentum/shared test` green if a test target exists.
- Commit with a clear message, `git push -u origin feat/acr0011-shared`, then `gh pr create --base main` with a summary. DO NOT merge — the orchestrator merges after gates.
- Print a final line: `LANE0 COMPLETE PR:<number>` (or `LANE0 FAILED: <reason>`).
