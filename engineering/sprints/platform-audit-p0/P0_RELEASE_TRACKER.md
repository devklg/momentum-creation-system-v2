# Platform Audit P0 Release Tracker

Status: active P0 tracker.
Created: 2026-07-11.
Source tasklist: `PLATFORM_AUDIT_PRIORITY_TASKLIST.md`.

This tracker is the active place for P0 blockers, cautions, gate commands, and lane closeout notes. It does not supersede the numbered tasklist; it records execution evidence for items 1-20.

## Current Blockers And Cautions

| Item | Area | Status | Evidence / next action |
| --- | --- | --- | --- |
| 1-4 | Michael runtime | Closed | Current contract is degraded `safe_fallback` while live Context Manager retrieval is off. Lane 1 evidence: Michael runtime tests 7 files / 104 tests passed; full server Vitest passed. |
| 5 | Dependency approvals | Closed | `pnpm-workspace.yaml` contains `allowBuilds` for `argon2` and `esbuild`. `pnpm install --frozen-lockfile` succeeded on 2026-07-11 in Lane 0. |
| 6 | Local gate command pattern | Closed | Use the command pattern below. No bypass flags were needed for the frozen install in Lane 0. |
| 7-9 | Chroma heartbeat/admin health | Closed | Lane 2 fixed Chroma heartbeat readback to use canonical `heartbeatId`; targeted tests, full server Vitest, and server typecheck passed. |
| 10 | Agent playbook | Closed | `AI_AGENT_PLAYBOOK.md` created at repo root as the named current playbook. |
| 11 | Agent playbook cross-links | Closed | Lane 3 linked `AI_AGENT_PLAYBOOK.md` from agent architecture, prompt governance, and runtime docs. |
| 12-14 | VM/RVM governance | Closed | Lane 3 added proposed ACR-002, VM/RVM compliance checklist, and explicit disabled-live-delivery guardrails. ACR-002 remains Proposed pending Kevin approval. |
| 15 | GraphRAG/Context flags | Closed | Lane 3 added canary criteria and confirmed live flags remain off by default. |
| 16 | Build registry status | Closed | `docs/build-registry.md` now carries a visible P0 status warning at the top. |
| 17 | Root TASK.md | Closed | Root `TASK.md` replaced with a current main-branch P0 audit pointer. |
| 18 | Graphify freshness | Closed | `graphify-out/GRAPH_REPORT.md` now carries a visible stale-against-HEAD warning. |
| 19 | Release blockers/cautions | Closed | This tracker records the current P0 blockers and cautions. |
| 20 | Final gates | Closed | Lane 4 integration branch ran `pnpm install --frozen-lockfile`, `pnpm typecheck`, `pnpm build`, and `pnpm --filter @momentum/server test`; all passed. |

## Accepted Local Gate Commands

Use these from the repo root or the active lane worktree:

```powershell
pnpm install --frozen-lockfile
pnpm typecheck
pnpm build
pnpm --filter @momentum/server test
```

For commands that start the app server or touch runtime databases, strip inherited gateway/Codex environment values first so the MCS app uses its dedicated local stack and `.env`:

```powershell
foreach ($v in 'ANTHROPIC_API_KEY','ANTHROPIC_AUTH_TOKEN','MONGODB_URI','MONGO_URI','NEO4J_URI','NEO4J_URL','CHROMA_URL','CHROMADB_URL') {
  Remove-Item ("Env:" + $v) -ErrorAction SilentlyContinue
}
```

## Lane 0 Evidence

- Branch/worktree: `codex/platform-audit-p0-lane0-foundation` at `D:/mcs-v2-platform-audit-p0/lane0-foundation`.
- `pnpm install --frozen-lockfile`: passed on 2026-07-11.
- `pnpm typecheck`: passed on 2026-07-11.
- Runtime behavior: unchanged.
- Lane 4 final gates after integrating Lanes 0-3: `pnpm install --frozen-lockfile`, `pnpm typecheck`, `pnpm build`, and `pnpm --filter @momentum/server test` all passed on 2026-07-11.
- Build cautions that remain non-blocking P2/P3 work: `.com` dynamic/static import split warning and `.team` chunk size warning over 500 kB.
