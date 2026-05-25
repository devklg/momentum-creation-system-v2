# TASK-134 — BA Profile / Settings (wireframe 3.8)

> Read THIS file, not the repo's tracked `TASK.md` (stale Fast Start brief on main).

Branch: `feat/ba-profile-settings`  ·  Worktree: `D:/mcs2-profile`  ·  Off `main` @ 796208f
Chat #134 parallel batch (3 of 5).

## Source of truth (read first, in order)
1. `docs/locked-spec.md` Part 3.5 (sponsor immutability — sponsor READ-ONLY here), 2.3 (access code: one per BA, read-only display), 3.14 (triple-stack), Part 5 open Qs J.8 (phone change verification) + J.12 (notif defaults).
2. `docs/project-wireframe.md` §3.8 Profile / settings.
3. `docs/Team-Magnificent-TEAM-Design.docx` profile/settings section.
4. Existing auth/session: `server/src/routes/auth.js`, `server/src/middleware/requireAuth.js`. Profile reads/writes the authed session BA only.

## Leaves you own (tick in docs/project-wireframe.md when done)
- wf_0071 — Editable: first/last (audit), email (re-verify), phone (update), password, photo, timezone, notif prefs
- wf_0072 — Read-only: sponsor, THREE BA ID, TM BA ID, access code held

## Hard locks (do not violate)
- Sponsor is READ-ONLY (3.5). Render it; never an edit control. Sponsor change = audited admin override only, NOT here.
- Access code held READ-ONLY (2.3 — one per BA, owned for life, only Kevin generates). Display; no regenerate button.
- THREE BA ID + TM BA ID READ-ONLY.
- First/last name edits write an AUDIT entry (use existing substrate `server/src/domain/auditLog.ts`).
- OPEN QUESTIONS — do NOT decide; implement the conservative default and flag in status note:
  - J.8 phone change: implement WITH SMS-code verification (mirror email re-verify) as safe default; note Kevin may want immediate-effect.
  - J.12 notif defaults: build the prefs UI; default to existing system default; flag the exact defaults chosen.

## Files you OWN (create/edit freely)
- `apps/team/src/routes/profile.tsx` (NEW)
- `apps/team/src/components/profile/*` (NEW)
- `server/src/routes/profile.js` (NEW — GET profile, PATCH editable, phone/email re-verify)
- `server/src/domain/profile.ts` (NEW)

## SHARED FILES — append-only, marked region, NEVER reorder
1. `packages/shared/src/types.ts` — append ONE block at END: `/* ─── #134 BA profile / settings ─── */`. Touch no existing export.
2. `server/src/index.ts` — ONE import + ONE `app.use('/api/profile', profileRoutes)` in the BA-FACING GATED block (handlers use requireAuth + requireMichaelComplete internally). Never reorder.
3. `apps/team/src/App.tsx` — ONE import + ONE `<Route path="/profile" element={<ProfilePage />} />`. Nothing else.

## Hard rules
- Triple-stack every write via gateway localhost:2525.
- All reads/writes scoped to session BA (baId from session, never body) — 3.5.
- Photo: store a reference, not raw bytes in Mongo; follow the existing asset pattern (check before inventing).

## REPORTING — heartbeat (Chat #134)
Your row `_id` is `agent_profile` in collection `agent_status`, db `momentum`.
Report at START / each leaf done / typecheck green / ready to merge / if BLOCKED.
Gateway `mongodb` `update` ($set only — row exists, do NOT upsert/create):

    tool=mongodb action=update params={
      database:"momentum", collection:"agent_status",
      filter:{_id:"agent_profile"},
      update:{ $set:{ state:"<in_progress|typecheck_green|ready_to_merge|blocked>",
        current_leaf:"<wf_id or null>", last_commit:"<short sha or null>",
        note:"<one honest line; J.8 + J.12 defaults chosen; if blocked, the REAL error>", updated_at:"<ISO8601 now>" }}}

## Done =
- typecheck green: shared, server, team
- leaves ticked in docs/project-wireframe.md
- commit on THIS branch only — KEVIN MERGES
- status note flags J.8 + J.12 defaults chosen
