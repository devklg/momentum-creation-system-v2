# P2-130 Com API Import Boundary

Status: implemented and build-verified.

## Finding

`03-DrDanVideo.tsx` dynamically imported `apps/com/src/lib/api.ts` inside the
video milestone callback. Seven other com surfaces imported that same module
statically, so Rollup necessarily included it in the main module graph and
reported that the dynamic import could not move the module into another chunk.

The lazy import did not defer network or execution cost. It only introduced a
contradictory boundary and a production build warning.

## Resolution

Dr. Dan video milestones now statically import `postVideoEvent` and
`postRvmVideoEvent`, matching the existing com API authority. Milestone
deduplication, optimistic rollback, PMV/RVM selection, error handling, and
placement callback behavior are unchanged.

## Verification

- Com strict typecheck passes through the production build.
- Vite/Rollup production build completes without the dynamic/static import
  warning.
- Transformed modules: 107 before, 106 after.
- Minified JavaScript: 393.48 kB before, 392.04 kB after.
- Gzip JavaScript: 108.44 kB before, 107.83 kB after.

The com workspace has no behavioral test runner; P2-130 is specifically a
module-graph build finding, so the production compiler/bundler is the direct
acceptance authority.
