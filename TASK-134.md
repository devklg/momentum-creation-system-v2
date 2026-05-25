# TASK-134 — /admin Core Dashboard (wireframe 4.B)

> Read THIS file, not the repo's tracked `TASK.md` (stale Fast Start brief on main).

Branch: `feat/admin-core-dashboard`  ·  Worktree: `D:/mcs2-admin-dash`  ·  Off `main` @ 796208f
Chat #134 parallel batch (2 of 5).

## Source of truth (read first, in order)
1. `docs/locked-spec.md` Part 3.1 (admin in .team, ADMIN_BA_IDS allowlist), 3.10/3.11 (compliance + aggregated enforcement metrics, NOT a triage queue), 3.14 (triple-stack), 4.9 (status codes).
2. `docs/project-wireframe.md` §4.B Core Dashboard.
3. `docs/Team-Magnificent-ADMIN-Design.docx` Section B.
4. Audit-log substrate ALREADY on main: `server/src/domain/auditLog.ts`, `server/src/routes/admin/audit.js`, `apps/admin/src/routes/audit.tsx`, the `#audit` types block. READ aggregates; WRITE an audit entry for admin views (4.J). Reuse, don't duplicate.

## Leaves you own (tick in docs/project-wireframe.md when done)
- wf_0077 — Master metrics row: active BAs, prospects in flow, queue movement 24h, enrollments 24h, training %
- wf_0078 — Each tile clickable → drilldown panel
- wf_0079 — Filter bar: by BA, by leader group (system-detected + Kevin-curated)
- wf_0080 — Live event stream

## Compliance note specific to /admin
Inside .team, Kevin-only, gated by ADMIN_BA_IDS. CV/cycle/rank math IS allowed here (regulated surface) — but this dashboard shows OPERATIONAL metrics (activity, funnel, queue), not earnings. Leader detection is LOCKED (locked-spec Part 5): binary-qualified AND ≥5 personally enrolled. Use that exact rule for "leader group"; do not invent a heuristic.

## Files you OWN (create/edit freely)
- `apps/admin/src/routes/dashboard.tsx` (NEW)
- `apps/admin/src/components/dashboard/*` (NEW — tiles, drilldown panel, filter bar, live event stream)
- `server/src/routes/admin/dashboard.js` (NEW — metrics aggregation + SSE for live stream)
- `server/src/domain/adminMetrics.ts` (NEW)

## SHARED FILES — append-only, marked region, NEVER reorder
1. `packages/shared/src/types.ts` — append ONE block at END: `/* ─── #134 Admin core dashboard ─── */`. Do NOT touch existing exports (esp the #audit block).
2. `server/src/index.ts` — ONE import + ONE `app.use('/api/admin/dashboard', adminDashboardRoutes)` beside the existing `/api/admin/*` mounts. Never reorder.
3. `apps/admin/src/App.tsx` — the index currently redirects `/` → `/access-codes`. LEAVE that redirect as-is; add `/dashboard` as a sibling `<Route>` inside the authed `<AdminShell>` block (ONE import + ONE Route) and append a nav link if there's a nav list. DECISION FOR KEVIN: should `/` now point to `/dashboard`? Do NOT change it — note the question in your status `note`.

## Hard rules
- Triple-stack any write; reads hit Mongo via gateway.
- Every /admin request writes an audit entry via the existing substrate (4.J).
- No PII beyond what ADMIN Design authorizes for Kevin.

## REPORTING — heartbeat (Chat #134)
Your row `_id` is `agent_admin_dash` in collection `agent_status`, db `momentum`.
Report at START / each leaf done / typecheck green / ready to merge / if BLOCKED.
Gateway `mongodb` `update` ($set only — row exists, do NOT upsert/create):

    tool=mongodb action=update params={
      database:"momentum", collection:"agent_status",
      filter:{_id:"agent_admin_dash"},
      update:{ $set:{ state:"<in_progress|typecheck_green|ready_to_merge|blocked>",
        current_leaf:"<wf_id or null>", last_commit:"<short sha or null>",
        note:"<one honest line; if blocked, the REAL error; include the / redirect question>", updated_at:"<ISO8601 now>" }}}

## Done =
- typecheck green: shared, server, admin
- leaves ticked in docs/project-wireframe.md
- commit on THIS branch only — KEVIN MERGES
- status note carries the `/` redirect question
