# LANE 2 - P0 Chroma Health Heartbeat

Final signal: `LANE2 COMPLETE PR:<number>` or `LANE2 FAILED: <reason>`

## Owned P0 Items

- 7. Fix Chroma health heartbeat readback so the metadata field used for write and readback matches.
- 8. Add a regression test for Chroma health readback and metadata filtering.
- 9. Validate the admin triple-stack health probe after the Chroma heartbeat fix.

## Dependency

Start after Lane 0 has merged. Rebase onto `origin/main` before editing.

## Required Reads

- `server/src/services/chromaCollections.ts`
- Chroma health or heartbeat code discovered by `rg "heartbeat|health|metadata|Chroma|triple-stack" server/src server/scripts`
- Admin health probe route/component discovered by `rg "health probe|triple-stack health|HEALTH_PROBE|Chroma" server/src apps/admin/src`

## Guardrails

- Runtime persistence uses the dedicated MCS stack: Mongo 30000, Neo4j 7710, Chroma 8200.
- Do not route app runtime writes through external MCP tooling.
- Fix the contract mismatch rather than papering over the readback.
- Regression coverage must prove metadata write and metadata filter/readback use the same canonical field.

## Verification

Required:

```powershell
pnpm --filter @momentum/server test
pnpm --filter @momentum/server typecheck
```

If a live Chroma probe is run, strip inherited DB/env variables before starting it and record the exact Chroma URL used.
