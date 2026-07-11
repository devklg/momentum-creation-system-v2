# LANE 4 - P0 Final Gates and Closeout

Final signal: `LANE4 COMPLETE PR:<number>` or `LANE4 FAILED: <reason>`

## Owned P0 Items

- 20. Run typecheck, build, and server tests again after P0 fixes and record the clean gate result.
- Validate item 4 outcome from Lane 1.
- Validate item 9 outcome from Lane 2.
- Verify items 1-19 in `PLATFORM_AUDIT_PRIORITY_TASKLIST.md` are either checked or blocked with explicit notes.

## Dependency

Start only after Lanes 1-3 have merged. Rebase onto `origin/main` before editing.

## Required Reads

- `PLATFORM_AUDIT_PRIORITY_TASKLIST.md`
- Active P0 tracker created by Lane 0
- PRs or merge commits from Lanes 0-3

## Guardrails

- This lane verifies and records. It does not implement new feature fixes unless a gate failure is a tiny direct correction.
- If a gate fails due to a real defect, document it and return `LANE4 FAILED: <reason>` rather than hiding the failure.
- Do not mark blocked items complete.

## Required Commands

```powershell
pnpm typecheck
pnpm build
pnpm --filter @momentum/server test
```

If `pnpm install --frozen-lockfile` is needed first, run it and record whether dependency approvals block normal gates.
