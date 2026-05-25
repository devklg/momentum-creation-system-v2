# TASK-134 — Cockpit "Today's Actions" card (wireframe 3.3)

> Read THIS file, not the repo's tracked `TASK.md` (stale Fast Start brief on main).

Branch: `feat/cockpit-todays-actions`  ·  Worktree: `D:/mcs2-cockpit-actions`  ·  Off `main` @ 796208f
Chat #134 parallel batch (5 of 5).

## Source of truth (read first, in order)
1. `docs/locked-spec.md` Part 1.8/1.9 (cockpit's job; primary metric = invitations sent; bias = "Who are you sharing with today?"), 3.5 (own prospects only), 3.10 (BA-facing, no income/placement claims — status is funnel progress).
2. `docs/project-wireframe.md` §3.3 BA Cockpit.
3. Existing cockpit read-side ON MAIN: `apps/team/src/routes/cockpit.tsx`, `server/src/routes/cockpit.js` (`/api/cockpit/invites`, `/api/cockpit/summary`), the `#121` cockpit types block. Existing CRM write-side ON MAIN: `server/src/routes/crm.js`, the `#132` block.
4. Types `InviteSummary`, `MyInvitesResponse`, `CockpitSummaryResponse`, `InvitationActivityEntry` already exist — REUSE.

## Leaf you own (tick in docs/project-wireframe.md when done)
- wf_0046 — Today's actions card (DERIVED from pipeline — what needs attention NOW)

## What "Today's Actions" is (locked-spec 1.8/1.9)
A DERIVED card at the top of the cockpit. Reads the BA's existing pipeline (invites + activity + CRM follow-ups, all on main) and surfaces what needs action today, ordered by urgency:
- callbacks raised (a raised hand is #1 — InviteDisplayStatus puts 'callback' above 'watched')
- follow-up reminders due today (CRM, #132)
- prospects about to expire (8-week window closing — 3.7)
- bias prompt when nothing's pressing: "Who are you sharing with today?" (1.9)
DERIVED = NO new persistence. Compute server-side from existing collections. Do not add a stored entity.

## Files you OWN (create/edit freely)
- `apps/team/src/components/cockpit/TodaysActions.tsx` (NEW)
- `server/src/domain/todaysActions.ts` (NEW — derivation over existing pipeline)
- GET endpoint: EXTEND `server/src/routes/cockpit.js` with `/api/cockpit/todays-actions` (you're the only batch agent touching cockpit.js). No new mount needed if added there.

## SHARED FILES — minimal, careful
1. `packages/shared/src/types.ts` — append ONE block at END: `/* ─── #134 Cockpit Today's Actions ─── */` (ActionItem union + TodaysActionsResponse). REUSE existing cockpit/CRM types for underlying data. Touch no existing export.
2. `server/src/index.ts` — if you extend cockpit.js (recommended), NO change. Only a separate route file needs a mount. Prefer extending.
3. `apps/team/src/routes/cockpit.tsx` — render `<TodaysActions />` at the TOP of the existing cockpit page. ONE import + the component near the top. Do NOT refactor the existing My Invites list.

## CROSS-WORKTREE NOTE
The Michael agent (mcs2-michael) creates `apps/team/src/components/cockpit/MichaelEventCard.tsx`. You're both in `components/cockpit/` but DIFFERENT files — no collision. You do NOT wire their card; Kevin wires them at merge if desired.

## Hard rules
- Reads scoped to session BA only (3.5).
- No income/placement/comp/rank claims — status is funnel progress only.
- No new persisted entity — purely derived.

## REPORTING — heartbeat (Chat #134)
Your row `_id` is `agent_cockpit_actions` in collection `agent_status`, db `momentum`.
Report at START / leaf done / typecheck green / ready to merge / if BLOCKED.
Gateway `mongodb` `update` ($set only — row exists, do NOT upsert/create):

    tool=mongodb action=update params={
      database:"momentum", collection:"agent_status",
      filter:{_id:"agent_cockpit_actions"},
      update:{ $set:{ state:"<in_progress|typecheck_green|ready_to_merge|blocked>",
        current_leaf:"<wf_id or null>", last_commit:"<short sha or null>",
        note:"<one honest line; if blocked, the REAL error>", updated_at:"<ISO8601 now>" }}}

## Done =
- typecheck green: shared, server, team
- leaf ticked in docs/project-wireframe.md
- commit on THIS branch only — KEVIN MERGES
