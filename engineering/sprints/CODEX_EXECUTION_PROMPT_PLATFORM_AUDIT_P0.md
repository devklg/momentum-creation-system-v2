# Codex Execution Prompt - Platform Audit P0

Source tasklist: `PLATFORM_AUDIT_PRIORITY_TASKLIST.md`
Generated for: platform audit P0 orchestration
Priority rule: complete P0 before P1/P2/P3.

## Mission

Close the P0 platform-audit blockers without widening scope. P0 is release-control work: contract drift, local gates, Chroma heartbeat correctness, agent/governance docs, VM/RVM guardrails, GraphRAG/Context Manager canary guardrails, stale-doc warnings, and final verification.

Agents must not skip items. If an item cannot be completed because it requires Kevin's approval, create the required draft/decision artifact, mark the item blocked-with-evidence in the active tracking location, and stop that lane cleanly.

## Required Start Reads

Read these first inside every worktree:

1. `AGENTS.md`
2. `PLATFORM_AUDIT_PRIORITY_TASKLIST.md`
3. This master prompt
4. The lane's `LANE_BRIEF.md`
5. Only the source docs/code named by the lane brief

If a lane touches agent runtime, prompts, GraphRAG, Context Manager, VM/RVM, or governance, also read:

- `constitution/MOMENTUM_CONSTITUTION.md`
- `constitution/MOMENTUM_DECISION_FRAMEWORK.md`
- `constitution/MOMENTUM_ACR_SYSTEM.md`
- `AGENT_ARCHITECTURE.md`
- `AGENT_PROMPT_GOVERNANCE.md`

## Hard Constraints

- Kevin merges. Lane agents create PRs and stop.
- Lane 0 must merge before dependent lanes start implementation.
- Do not edit unrelated files.
- Do not revert user or other-agent changes.
- Do not change `.com` compliance boundaries except to strengthen fail-closed checks.
- Do not enable VM/RVM live delivery.
- Do not enable GraphRAG or Context Manager live flags.
- Do not add AI lead qualification, automated prospecting, income claims, cycle math, placement promises, or prospect-facing AI language.
- For DB-touching commands, strip inherited env vars first:

```powershell
foreach ($v in 'ANTHROPIC_API_KEY','ANTHROPIC_AUTH_TOKEN','MONGODB_URI','MONGO_URI','NEO4J_URI','NEO4J_URL','CHROMA_URL','CHROMADB_URL') {
  Remove-Item ("Env:" + $v) -ErrorAction SilentlyContinue
}
```

## Lane Map

| Lane | Branch | Worktree | Items | Focus | Dependency |
| --- | --- | --- | --- | --- | --- |
| 0 | `codex/platform-audit-p0-lane0-foundation` | `D:/mcs-v2-platform-audit-p0/lane0-foundation` | 5,6,10,16,17,18,19 | release-control foundation and stale-doc reconciliation | first |
| 1 | `codex/platform-audit-p0-lane1-michael` | `D:/mcs-v2-platform-audit-p0/lane1-michael` | 1,2,3,4 | Michael runtime contract and tests | after Lane 0 |
| 2 | `codex/platform-audit-p0-lane2-chroma` | `D:/mcs-v2-platform-audit-p0/lane2-chroma` | 7,8,9 | Chroma heartbeat readback and admin health probe | after Lane 0 |
| 3 | `codex/platform-audit-p0-lane3-governance` | `D:/mcs-v2-platform-audit-p0/lane3-governance` | 11,12,13,14,15 | agent playbook links, VM/RVM governance, GraphRAG/Context canary guardrails | after Lane 0 |
| 4 | `codex/platform-audit-p0-lane4-final-gates` | `D:/mcs-v2-platform-audit-p0/lane4-final-gates` | 20 plus validation of 4 and 9 | final typecheck/build/server tests and release-blocker note | after Lanes 1-3 |

## Shared Verification Standard

Each lane reports:

- files changed
- tasklist item numbers closed or blocked
- exact commands run
- exact failures remaining
- whether `pnpm --filter @momentum/server test` was run when server behavior changed
- whether `pnpm typecheck` / `pnpm build` were run or deferred to Lane 4

Machine-readable final line:

```text
LANEX COMPLETE PR:<number>
```

or

```text
LANEX FAILED: <short reason>
```

## Completion Criteria For P0

P0 is complete only when:

- Items 1-20 in `PLATFORM_AUDIT_PRIORITY_TASKLIST.md` are checked or explicitly blocked with a blocker note.
- Michael runtime tests are green or the remaining decision is recorded as a Kevin approval blocker.
- Chroma health heartbeat has a matching write/readback metadata contract and regression coverage.
- VM/RVM live delivery remains disabled unless Kevin explicitly approves a governance decision.
- GraphRAG and Context Manager live flags remain off until canary criteria exist.
- `pnpm typecheck`, `pnpm build`, and the server Vitest suite have been run after P0 fixes and their result recorded.
