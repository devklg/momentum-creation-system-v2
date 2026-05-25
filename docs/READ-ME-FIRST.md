# READ ME FIRST — Team Magnificent Momentum Creation System

**Agent: if you are opening this project, this is your orientation. 60 seconds.**

Kevin was spending most of every session re-teaching scope because the answer to
"what needs building and what's done" lived nowhere whole. As of Chat #129 it
lives in four artifacts. Use them. Do not ask Kevin "what's next" — it is written down.

## The four artifacts

| Artifact | What it is | Use it to… |
|---|---|---|
| `docs/project-wireframe.md` | **THE BUILD MAP.** Whole project decomposed to 114 buildable leaves, each `[x]`/`[~]`/`[ ]` vs verified disk. | Know what to build. Pending leaves = your task list. |
| `momentum.work_queue_leaves` (Mongo) | Queryable mirror of the wireframe, 1 row/leaf. | Pull next work: `{status:"pending", surface:"team"}` sorted by `seq`. |
| `momentum.decisions` (Mongo) | **DECISION LEDGER.** Append-only currency layer. | Resolve "which version is current?": `{topic:X, status:"active"}`. |
| `docs/build-checklist.html` | Printable B/W checklist, 114 numbered items. | Hand to Kevin to print/track. |

## The one rule (this is what keeps it from rotting)

**The wireframe is the SOURCE. The queues are its MIRROR.**

When you finish a leaf:
1. tick its checkbox in `docs/project-wireframe.md`
2. `node server/scripts/sync-queue-from-wireframe.mjs`  (regenerates leaf queue)
3. `node server/scripts/build-checklist.mjs`  (regenerates printable)

Never hand-edit the queue separately from the wireframe. That drift is the exact
disease this system was built to cure.

## Precedence (when sources disagree)

decision ledger (currency) > `docs/locked-spec.md` (state) > design docs >
`docs/build-registry.md` > git log > Perry handoffs.

`KEVIN-CONTEXT.md` / `THE-KEY` are NOT session-start reads under current settings.
Pull a specific doc only when the work needs it.

## Where the build stands (#129)

- `.com` prospect surface: ~complete (17 done / 1 partial / 5 pending).
- `.team`: the heavy lift — invitation **generator** + **Ivory** (the real WDYK
  engine; ScriptMaker shipped only the drafting half), Michael 3-state UI, Fast
  Start modules, profile, preview. 29 pending.
- `/admin`: 8 of 9 surfaces unbuilt (33 pending). Build the **audit-log
  substrate** first — every other admin surface writes against it.

## Session scripts (all in `server/scripts/`, all re-runnable)

- `seed-decisions.mjs` — (re)seed the decision ledger
- `seed-work-queue.mjs` — (re)seed the surface-grain queue (`work_queue`)
- `sync-queue-from-wireframe.mjs` — regenerate `work_queue_leaves` from the wireframe
- `build-checklist.mjs` — regenerate the printable checklist
- `write-handoff-129.mjs` — example session-close handoff writer (Mongo+Neo4j+Chroma+SurrealDB).
  SurrealDB contract: action `create` (not `query`-with-params), param `id`, e.g.
  `id:"session_handoff:chat_NNN"`; `session_handoff` table exists in `team_magnificent/parallel_test`.

## Gateway gotchas (cost time every session until known)

- desktop-commander run action toggles between `start_process` and `execute_command` — if one errors "Action not found", use the other.
- PowerShell: use `;` not `&&`; `Out-File -Encoding utf8` writes a BOM that breaks `JSON.parse` (strip `/^\uFEFF/`).
- Mongo `insert` wants `documents` (array). `update` does not honor upsert — delete-then-insert.
- Chroma: actions are `add` / `query_with_filter` (no `get`); `add` returns `verified:true`.
- The sandbox `str_replace`/`create_file` tools do NOT touch the D drive — use desktop-commander `write_file`/`edit_block`.

*Written Chat #129. If this file and reality disagree, fix the wireframe + re-run the syncs.*
