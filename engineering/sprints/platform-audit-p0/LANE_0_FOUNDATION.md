# LANE 0 - P0 Release-Control Foundation

Final signal: `LANE0 COMPLETE PR:<number>` or `LANE0 FAILED: <reason>`

## Owned P0 Items

- 5. Resolve pnpm dependency approval state for argon2 and esbuild so normal gates run without bypass flags.
- 6. Document the accepted local gate command pattern if pnpm approval state intentionally remains constrained.
- 10. Create `AI_AGENT_PLAYBOOK.md` or formally reconcile the missing file to a named current replacement.
- 16. Regenerate or clearly mark `docs/build-registry.md` as stale/current so agents do not rely on old status.
- 17. Replace, remove, or explicitly mark the stale root `TASK.md` on main.
- 18. Regenerate graphify output or add a visible stale-against-HEAD warning to existing graphify artifacts.
- 19. Document the current release blockers and cautions in the active project tracking location.

## Scope

This lane creates the shared release-control surface that later lanes update. It must merge before lanes 1-4 begin implementation.

Expected artifacts:

- A current active tracking location for P0 blockers and cautions.
- A clear local gate command pattern.
- An `AI_AGENT_PLAYBOOK.md` file or an explicit replacement decision documented and linked.
- A visible stale/current status on `docs/build-registry.md`, root `TASK.md` if present, and graphify artifacts.

## Guardrails

- Do not change application runtime behavior.
- Do not solve Michael runtime or Chroma heartbeat issues here.
- Do not run broad code migrations.
- Do not delete stale docs unless the tasklist explicitly says delete; prefer visible stale warnings.
- If root `TASK.md` does not exist, record that the item is reconciled as "absent on main" in the active tracker.

## Verification

Run the narrowest checks needed for docs/scripts changed. If package gate work changes dependency state, run:

```powershell
pnpm install --frozen-lockfile
pnpm typecheck
```

If dependencies are not installed or pnpm approval remains blocked, record the exact command and exact blocker in the tracker.
