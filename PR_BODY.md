## Summary

- Replaced the Team VM campaign mock page with live API-driven lead owner, campaign, import, lifecycle, metrics, lead table, and manual export UI.
- Added the VM dialer entitlement locked state for `VM_DIALER_NOT_ENABLED`.
- Added Admin VM campaign live-approval controls with confirmation, optimistic update, and rollback on error.

## Verification

- `pnpm install --frozen-lockfile`
- `pnpm typecheck`
- `pnpm build`
- `pnpm --filter @momentum/team test`
- `pnpm --filter @momentum/admin test`

## Scope

- UI only: `apps/team/**` and `apps/admin/**`.
- No server changes.
