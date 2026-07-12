# Agent Capability Implementation Prompt Pack

Execute these prompts in order. Each prompt is implementation-ready but remains
subject to the decision ledger and locked spec at execution time.

1. `01_SCRIPTMAKER_WDYK_PERSONAL_PROSPECT_LIST.md`
2. `02_SCRIPTMAKER_INVITATION_TOKEN.md`
3. `03_SPONSOR_ASSISTED_COACHING.md`
4. `04_TRAINING_RECORDINGS.md`
5. `05_MICHAEL_DEBRIEF.md`
6. `06_DAILY_SUCCESS_THREE_ACTIONS.md`

Shared rules:

- Read `AGENTS.md`, `docs/READ-ME-FIRST.md`, the relevant locked-spec sections,
  `packages/shared/src/agent-registry.ts`, and `packages/shared/src/agent-skills.ts`.
- Reuse existing domains/routes/components; do not create parallel systems.
- Sponsor, BA, and leadership remain the human action owners.
- No automated outreach, qualification, scoring, income projections, medical
  claims, or placement promises.
- App-runtime persistent writes use the direct MCS triple-stack abstraction.
- Append shared types; preserve server index append-only rules.
- Every prompt must finish with focused tests, `pnpm typecheck`, server tests,
  build, a feature commit, push, and PR. Kevin merges.
- When implementation lands, change the matching skill/template status from
  `planned` to `implemented`/`active` only after tests prove the runtime exists.

