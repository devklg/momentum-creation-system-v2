# Platform Audit P1 Orchestration Tracker

> Started 2026-07-11 after P0 merged. Source tasklist:
> `PLATFORM_AUDIT_PRIORITY_TASKLIST.md`.

## Current Tranche

Latest branch: `codex/platform-audit-p1-crm-ownership-tiered`

Closed in this tranche:

- P1-21: inventoried all 56 production `tripleStackWrite` call sites.
- P1-22: classified every production `tripleStackWrite` call site as
  `graph_critical`, `knowledge`, or `operational`.
- P1-69: added a generated persistence write catalog and wired
  `pnpm catalog:persistence:check` into the CI `gates` job.
- P1-23: migrated BA identity writes to `writeGraphCritical` through
  `server/src/domain/baIdentityPersistence.ts`.
- P1-24: migrated sponsor immutability writes to `writeGraphCritical` through
  `server/src/domain/sponsorImmutabilityPersistence.ts`.
- P1-25: migrated token lifecycle creation and state-mutation writes through
  `server/src/domain/tokenLifecyclePersistence.ts`.
- P1-26: migrated pool placement creation and placement patch writes through
  `server/src/domain/poolPlacementPersistence.ts`.
- P1-27: migrated CRM ownership record creation through
  `server/src/domain/crmOwnershipPersistence.ts`.

Catalog artifacts:

- `engineering/sprints/platform-audit-p1/PERSISTENCE_WRITE_CATALOG.md`
- `engineering/sprints/platform-audit-p1/persistence-write-catalog.json`
- `server/scripts/generate-persistence-write-catalog.mjs`

Inventory result:

| Tier | Count |
| --- | ---: |
| `graph_critical` | 5 |
| `knowledge` | 19 |
| `operational` | 23 |
| Total production `tripleStackWrite` call sites remaining | 47 |

## Completed Migration Tranches

### P1-23: BA Identity

Migrated:

- `server/src/domain/ba.ts` registration.
- `server/src/domain/adminBaCrud.ts` admin manual BA create.
- `server/scripts/seed-founders.ts` founder BA record seeding.

Implementation:

- New helper: `server/src/domain/baIdentityPersistence.ts`.
- Uses `writeGraphCritical`.
- Sponsor-backed writes use `MATCH (s:TeamMagnificentMember {tmagId: $sponsorTmagId})`
  instead of `MERGE` so a missing graph sponsor fails the graph leg.
- Neo4j readback uses `RETURN count(n) AS n` for the BA node plus sponsor edge.
- Root founder bootstrap remains the explicit no-sponsor exception and verifies
  the root node.
### P1-24: Sponsor Immutability

Migrated:

- `server/src/domain/codeGen.ts` admin access-code minting.
- `server/scripts/seed-founders.ts` founder access-code seeding.
- `server/src/domain/adminBaOversight.ts` sponsor override record and graph
  relationship write.

Implementation:

- New helper: `server/src/domain/sponsorImmutabilityPersistence.ts`.
- Uses `writeGraphCritical`.
- Access-code owner writes use `MATCH (b:TeamMagnificentMember {tmagId: $sponsorTmagId})`
  instead of `MERGE` so a missing BA owner fails the graph leg and rolls back
  the Mongo record.
- Access-code readback verifies the owner-to-code edge with `RETURN count(c) AS n`.
- Sponsor override graph writes `MATCH` the BA, new sponsor, and existing
  original sponsor when present, then verifies the current sponsor edge,
  original sponsor edge, and override node link with `RETURN count(o) AS n`.
- Catalog regenerated to 50 remaining production `tripleStackWrite` call sites.

### P1-25: Token Lifecycle

Migrated:

- `server/src/domain/invitations.ts` invite-token creation.
- `server/src/domain/bulkLeads.ts` legacy bulk-lead token creation.
- `server/src/domain/crm.ts` re-invite fresh-token creation.
- `server/src/domain/vmProviderQueue.ts` VM provider token generation.
- `server/src/domain/tokens.ts` shared forward lifecycle transitions and
  click-open stamping.
- `server/src/domain/prospectCrm.ts` token enrollment state update when a CRM
  record is closed as a new Brand Ambassador.

Implementation:

- New helper: `server/src/domain/tokenLifecyclePersistence.ts`.
- Prospect token creation uses `writeGraphCritical`, `MATCH`es the existing
  `TmagProspect`, and verifies the `(:TmagInviteToken)-[:FOR_PROSPECT]->(:TmagProspect)`
  edge with `RETURN count(t) AS n`.
- VM lead token creation uses `writeGraphCritical`, `MATCH`es the existing
  `TmagVmBulkLead`, and verifies the `FOR_VM_LEAD` edge with
  `RETURN count(t) AS n`.
- Token lifecycle state updates keep Mongo as the operational success boundary,
  verify the Mongo patch by readback, then project the Neo4j token-state patch
  inline or enqueue it in `tmag_projection_outbox` on graph failure.
- Catalog regenerated to 49 remaining production `tripleStackWrite` call sites.

### P1-26: Pool Placement

Migrated:

- `server/src/domain/holdingTank.ts` `placeProspect` placement insert, holding
  tank edge, and Chroma event.
- `server/src/domain/holdingTank.ts` `flushExpiredPlacements` placement flush
  stamp and holding-tank edge patch.
- `server/src/domain/adminProspectOversight.ts` admin move, sponsor reassign,
  manual flush, and force-enroll placement patches.

Implementation:

- New helper: `server/src/domain/poolPlacementPersistence.ts`.
- Placement creation uses `writeGraphCritical`, `MATCH`es the existing
  `TmagProspect`, and verifies the `(:TmagProspect)-[:IN_HOLDING_TANK]->(:TmagPool)`
  edge with `RETURN count(r) AS n`.
- Placement patch operations keep Mongo as the operational success boundary,
  verify the placement row by readback, then project the holding-tank edge
  patch inline or enqueue it in `tmag_projection_outbox` on graph failure.
- Catalog remains at 49 remaining production `tripleStackWrite` call sites
  because P1-26 migrated direct persistence calls rather than cataloged
  `tripleStackWrite` callers.

### P1-27: CRM Ownership

Migrated:

- `server/src/domain/prospectCrm.ts` CRM record creation for prospect tokens.
- `server/src/domain/vmProviderQueue.ts` CRM record creation for VM leads.

Implementation:

- New helper: `server/src/domain/crmOwnershipPersistence.ts`.
- Prospect CRM ownership creation uses `writeGraphCritical`, `MATCH`es the
  owner BA and existing `TmagProspect`, and verifies the
  `(:TeamMagnificentMember)-[:OWNS_CRM_RECORD]->(:TmagProspectCrmRecord)-[:FOR_PROSPECT]->(:TmagProspect)`
  graph shape with `RETURN count(c) AS n`.
- VM CRM ownership creation uses `writeGraphCritical`, `MATCH`es the owner BA
  and existing `TmagVmBulkLead`, and verifies the
  `(:TeamMagnificentMember)-[:OWNS_CRM_RECORD]->(:TmagProspectCrmRecord)<-[:HAS_CRM_RECORD]-(:TmagVmBulkLead)`
  graph shape with `RETURN count(c) AS n`.
- Catalog regenerated to 47 remaining production `tripleStackWrite` call sites.

## Lane Map

### Lane P1-A: Persistence Migration

Source items: 23-36, 70-72.

Use the generated persistence catalog as the migration map. Migrate in this
order:

1. `graph_critical`: BA identity, sponsor immutability, prospect sponsorship,
   Ivory roster, VM ownership.
2. `knowledge`: approved knowledge, agent context, CRM behavioral trail,
   content governance.
3. `operational`: audit controls, delivery/reservation flows, prospect access,
   governance records.

Target helpers already exist:

- `server/src/services/tieredWrite.ts`
- `server/src/services/projectionOutbox.ts`

Do not re-invent those helpers. Move callers onto `writeGraphCritical`,
`writeKnowledge`, or `writeOperational`, then add failure simulation tests for
all three tiers.

### Lane P1-B: Route, Access, Schema, And Security

Source items: 37-48, 73, 75-76.

Implementation order from sidecar recon:

1. Generate source-backed API route map first from `server/src/index.ts` and
   `server/src/routes/**`.
2. Derive the access/permissions matrix from the route map.
3. Add route protection tests after the matrix exists.
4. Generate schema catalogs from Mongo model registries, Neo4j constraints,
   Chroma collection definitions, route payloads, and shared types.
5. Add Mongo index audit and Neo4j dry-run constraint scripts.
6. Add Chroma metadata contract tests by collection purpose.
7. Centralize admin audit taxonomy before expanding destructive-action tests.

Known gotchas:

- `docs/SERVER_ROUTE_TASKLIST.md` appears stale; regenerate from source.
- `/api/admin/health/triple-stack` intentionally supports
  `requireAdminOrHealthSecret`, so it is not a pure `requireAdmin` exception.
- `/api/vm/provider` mixes admin utility and provider webhook routes; model it
  explicitly.
- Some BA routes are intentional Steve/onboarding whitelist routes.
- `requireAdmin` currently warns denied attempts rather than appending audit
  entries, which affects strict admin-denial audit tests.

### Lane P1-C: Compliance, PMV, Agents, VM/RVM, Knowledge, GraphRAG

Source items: 49-64, 77-93.

Implementation order from sidecar recon:

1. Compliance scanner foundation for `.com`, ScriptMaker, Ivory, and VM/RVM copy.
2. PMV contract and event taxonomy with no earnings, cycle math, placement
   promise, scoring, or qualification language.
3. Agent registry and prompt governance. Keep `agentKey` as semantic role and
   `agentId` as runtime/database instance.
4. Admin agent health/debug cards.
5. VM/RVM lifecycle schemas, provider queue stuck-state handling, idempotency,
   retry/backpressure, and dead-letter controls.
6. Resource and knowledge lifecycle states, unified resource catalog, publishing
   gate, source lineage, and admin retrieval-readiness state.
7. GraphRAG and Context Manager retrieval-readiness tests and degraded reasons.
8. Schema drift checks and generated route/access/schema/persistence maps.

Known blockers:

- VM/RVM live delivery remains blocked until
  `constitution/acr/ACR-002-vm-rvm-live-delivery-governance.md` is approved.
- GraphRAG and Context Manager live expansion remains behind canary criteria and
  live flags.
- `recordProviderWebhook()` currently uses a random webhook id; provider-event
  idempotency is not proven.
- Knowledge lifecycle naming currently uses `candidate` / `queued_for_review`,
  while P1 asks for `draft` / `review`.
- Admin VM ownership correction is still a stub; dashboards must not imply that
  corrections are applied until implementation exists.

## Verification For Current Tranche

Run before merging this tranche:

```powershell
pnpm catalog:persistence:check
pnpm typecheck
pnpm build
pnpm --filter @momentum/server test
```
