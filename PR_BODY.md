## Summary

- Repointed BA VM imports to the queued provider pipeline and added owner-scoped import status, campaign metrics, leads pagination, and manual CSV export endpoints.
- Added VM campaign lifecycle persistence/audit helpers plus delivery-worker status gating, scheduled auto-start, no-attempt requeue, skip, and completion sweep.
- Added admin live-delivery approval endpoint with Mongo/Neo4j/Chroma sync and audit logging.

## Verification

- `pnpm install --frozen-lockfile`
- `pnpm typecheck`
- `pnpm build`
- `pnpm --filter @momentum/server test`

## Scope

- Server only: `server/src/**`
- No UI changes.
- Legacy `bulkLeads.importBulkLeads` is quarantined/deprecated; BA import path no longer calls it.
