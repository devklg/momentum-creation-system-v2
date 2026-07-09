## Summary

- Pins shared VM campaign lifecycle contracts for status transitions, metrics, campaign leads, queued imports, and admin live approval.
- Adds the optional `adminApprovedForLiveDelivery` field to `McsVMCampaignRecord`.
- Aligns `McsVMDeliveryEventRecord` with the runtime queue writer shape from `vmProviderQueue.ts`.
- Extends the shared VM lead/provider vocabularies additively so existing legacy paths keep compiling.

## Verification

- `pnpm install --frozen-lockfile`
- `pnpm typecheck`
- `pnpm build`

## Scope Notes

- Contracts only: `packages/shared/src/types.ts`.
- Legacy `McsImportBulkLeadsResponse` is untouched.
- No server routes, domain logic, workers, UI, persistence migration, Holding Tank, placement, or CRM disposition changes.
