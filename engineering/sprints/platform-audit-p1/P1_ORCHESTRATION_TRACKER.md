# Platform Audit P1 Orchestration Tracker

> Started 2026-07-11 after P0 merged. Source tasklist:
> `PLATFORM_AUDIT_PRIORITY_TASKLIST.md`.

## Current Tranche

Latest branch: `codex/platform-audit-p1-mongo-index-audit`

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
- P1-28: migrated VM ownership and provider queue writes through
  tiered persistence helpers.
- P1-29: migrated approved knowledge source and chunk writes to
  `writeKnowledge`.
- P1-30: moved all remaining graph-critical records to `writeGraphCritical`
  with rollback/readback expectations.
- P1-31: moved all remaining knowledge-tier records to `writeKnowledge`.
- P1-32: moved all remaining operational records to `writeOperational`.
- P1-33: added failure simulation tests for graph-critical, knowledge, and
  operational write tiers.
- P1-34: exposed projection outbox dead letters in the admin agent oversight
  surface.
- P1-35: added a bounded cross-store reconciliation job for Mongo, Neo4j, and
  Chroma.
- P1-36: added an admin consistency report for half-writes, stale projections,
  and orphan records.
- P1-37: generated a schema catalog across Mongo, Neo4j, Chroma, route
  payload surfaces, and shared exports.
- P1-38: generated a Mongo collection ownership map with zero unclassified
  collections.
- P1-39: generated a Mongo index audit and high-volume index plan.

Catalog artifacts:

- `engineering/sprints/platform-audit-p1/PERSISTENCE_WRITE_CATALOG.md`
- `engineering/sprints/platform-audit-p1/persistence-write-catalog.json`
- `server/scripts/generate-persistence-write-catalog.mjs`

Inventory result:

| Tier | Count |
| --- | ---: |
| `graph_critical` | 0 |
| `knowledge` | 0 |
| `operational` | 0 |
| Total production `tripleStackWrite` call sites remaining | 0 |

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

### P1-28: VM Ownership And Provider Queue

Migrated:

- `server/src/domain/vmLeadOwners.ts` VM lead-owner creation.
- `server/src/domain/vmProviderQueue.ts` provider audit events.
- `server/src/domain/vmProviderQueue.ts` VM queue job enqueue.
- `server/src/domain/vmProviderQueue.ts` imported VM lead upsert.
- `server/src/domain/vmProviderQueue.ts` provider delivery events.
- `server/src/domain/vmProviderQueue.ts` provider webhook records.

Implementation:

- VM lead-owner creation now uses `writeGraphCritical`, `MATCH`es the existing
  owner BA, and verifies the
  `(:TeamMagnificentMember)-[:OWNS_VM_LEAD_OWNER]->(:TmagVmLeadOwner)` graph
  shape with `RETURN count(lb) AS n`.
- Provider queue writes now use `writeOperational`, keeping Mongo readback as
  the operational success boundary while preserving the existing graph/chroma
  projection payloads.
- VM queue tests mock the tiered operational helper for Telnyx call-control and
  delivery-worker flows.
- Catalog regenerated to 41 remaining production `tripleStackWrite` call sites.

### P1-29: Knowledge Approval

Migrated:

- `server/src/services/knowledge/approvedKnowledgeStore.ts` Kevin/admin
  approved knowledge source writes.
- `server/src/services/knowledge/approvedKnowledgeStore.ts` approved knowledge
  chunk writes.

Implementation:

- Approved source and chunk records now use `writeKnowledge`, keeping Mongo
  readback as the success boundary while routing Neo4j and Chroma projections
  through the durable knowledge projection path.
- `approvedKnowledgeStore` tests mock `writeKnowledge` directly so the approved
  knowledge intake boundary asserts the tiered writer, not the legacy helper.
- Catalog regenerated to 39 remaining production `tripleStackWrite` call sites.

### P1-30: Graph-Critical Record Sweep

Migrated:

- `server/src/domain/bulkLeads.ts` legacy RVM prospect creation.
- `server/src/domain/bulkLeads.ts` legacy RVM bulk-lead graph creation.
- `server/src/domain/invitations.ts` prospect invitation creation.
- `server/src/domain/ivory.ts` Ivory roster name creation.

Implementation:

- All remaining graph-critical raw writes now use `writeGraphCritical`.
- Required graph anchors now use `MATCH` instead of `MERGE` so missing BA,
  lead-owner, campaign, or prospect anchors fail and trigger the tiered rollback
  path.
- Every migrated write has a `RETURN count(...) AS n` readback query covering
  the required graph edge shape.
- Ivory persistence tests now assert the tiered graph-critical write contract.
- Catalog regenerated to 35 remaining production `tripleStackWrite` call sites
  with zero `graph_critical` raw call sites remaining.

### P1-31: Knowledge Record Sweep

Migrated:

- `server/src/domain/adminTenantArchitecture.ts` content-template override
  writes.
- `server/src/domain/agents/orchestrator.ts` agent recommendation events.
- `server/src/domain/contentVideos.ts` content-video creation.
- `server/src/domain/crm.ts` notes, followups, dispositions, and invitation
  activity writes.
- `server/src/domain/generator.ts` generator run creation.
- `server/src/domain/graphrag.ts` GraphRAG record creation.
- `server/src/domain/invitations.ts` invitation activity writes.
- `server/src/domain/learningCandidates.ts` review-only learning candidate
  writes.
- `server/src/domain/prospectCrm.ts` prospect timeline event writes.
- `server/src/domain/questionnaire.ts` questionnaire writes.
- `server/src/domain/recruitingCycle.ts` Michael event and recruiting-cycle
  writes.
- `server/src/domain/steve-success-interview.ts` Steve discovery insert path.
- `server/src/domain/training.ts` training progress first-write path.

Implementation:

- All remaining knowledge-tier raw writes now use `writeKnowledge`, so Mongo
  readback remains the success boundary and Neo4j/Chroma projections route
  through the durable knowledge outbox path on failure.
- Updated focused tests to mock/assert the `writeKnowledge` boundary for
  content videos, GraphRAG, learning candidates, and Steve discovery.
- Catalog regenerated to 18 remaining production `tripleStackWrite` call sites,
  all `operational`.

### P1-32: Operational Record Sweep

Migrated:

- `server/scripts/seed-webinar-events.ts` webinar event seeding.
- `server/src/domain/adminProspectOversight.ts` admin prospect action audit.
- `server/src/domain/adminTenantArchitecture.ts` tenant settings versions.
- `server/src/domain/auditLog.ts` admin audit and runtime audit entries.
- `server/src/domain/broadcast.ts` broadcast records and recipient rows.
- `server/src/domain/callbackRequest.ts` callback requests.
- `server/src/domain/commitments.ts` welcome commitment records.
- `server/src/domain/orientationSession.ts` orientation session records and
  events.
- `server/src/domain/outcomes.ts` outcome records.
- `server/src/domain/prospectAccount.ts` prospect account creation.
- `server/src/domain/prospectMagicLink.ts` prospect magic-link rows.
- `server/src/domain/threeWayCalls.ts` three-way call records and call events.
- `server/src/domain/vmCampaigns.ts` VM campaign records.
- `server/src/domain/webinarReservation.ts` webinar reservations.

Implementation:

- All remaining operational raw writes now use `writeOperational`, so Mongo
  readback remains the success boundary and Neo4j/Chroma projections route
  through the durable operational outbox path on failure.
- Updated focused tests to mock/assert the `writeOperational` boundary for
  audit log, runtime audit, and outcomes.
- Catalog regenerated to 0 remaining production `tripleStackWrite` call sites.

### P1-33: Tier Failure Simulation Tests

Added:

- `server/src/services/__tests__/tieredWrite.test.ts`

Coverage:

- Graph-critical: simulates a Neo4j failure after Mongo insert/readback and
  asserts Mongo rollback plus `GraphCriticalWriteError`, with no projection
  queued.
- Knowledge: simulates a Neo4j projection failure and asserts Mongo success is
  preserved while a `knowledge` projection is queued.
- Operational: simulates a Chroma projection failure and asserts Mongo success
  is preserved while an `operational` projection is queued and no rollback is
  attempted.

### P1-34: Projection Outbox Dead-Letter Admin Exposure

Implemented:

- Extended `McsAdminAgentOversightResponse` with
  `projectionOutboxDeadLetters`.
- `buildAdminAgentOversight()` now summarizes `tmag_projection_outbox` rows
  with `status: "failed"` and reports failed projection count in memory health.
- `/agents` admin page now renders a Projection Dead Letters table with outbox
  id, source collection, tier, target, entity, attempts, and last error.
- Added `adminAgentMemory` regression coverage for failed outbox rows and the
  memory-health count/note.

### P1-35: Cross-Store Reconciliation Job

Implemented:

- Added `server/src/domain/crossStoreReconciliation.ts`.
- Added CLI script `server/scripts/run-cross-store-reconciliation.ts`.
- Added `pnpm --filter @momentum/server reconcile:stores`.
- Added regression coverage for clean readbacks, missing Neo4j/Chroma
  projections, and store exceptions that remain report rows instead of crashing
  the whole job.

Current reconciliation specs:

- Team Magnificent member identity.
- Prospect invitation ownership.
- Invite token graph links.
- Holding-tank placement edges.
- Steve discovery knowledge artifacts.
- Admin content video knowledge.

Operator command:

```powershell
pnpm --filter @momentum/server reconcile:stores -- --limit 25
pnpm --filter @momentum/server reconcile:stores -- --limit 25 --fail-on-drift
```

### P1-36: Admin Consistency Report

Implemented:

- Added `server/src/domain/adminConsistencyReport.ts`.
- Added `GET /api/admin/consistency/report` under `requireAdmin`.
- Added `/consistency` to the admin app and sidebar.
- Added shared response types appended to `packages/shared/src/types.ts`.
- Added tests for red half-write/orphan/dead-letter classification, yellow
  stale-pending projection classification, and the admin route shape.

Report coverage:

- Suspected graph-critical half-writes from sampled reconciliation rows whose
  required Neo4j leg is missing or errored.
- Stale and failed `tmag_projection_outbox` projections.
- Bounded graph-orphan scans for prospects, invite tokens, Steve discoveries,
  and CRM records.
- Cross-store reconciliation issue samples from P1-35.

### P1-37: Schema Catalog

Implemented:

- Added `server/scripts/generate-schema-catalog.mjs`.
- Added `pnpm catalog:schema` and `pnpm catalog:schema:check`.
- Generated:
  - `engineering/sprints/platform-audit-p1/SCHEMA_CATALOG.md`
  - `engineering/sprints/platform-audit-p1/schema-catalog.json`

Generated coverage:

- Mongo collections discovered from tiered writes and direct Mongo persistence
  calls, with explicit/permissive Mongoose schema mode.
- Neo4j labels and relationships discovered from Cypher strings.
- Chroma collections discovered from `CHROMA_COLLECTIONS`.
- Route modules, mounted prefixes, handlers, and shared route/payload type
  imports.
- Shared package exports across `packages/shared/src`.

### P1-38: Mongo Collection Ownership Map

Implemented:

- Added `server/scripts/generate-mongo-ownership-map.mjs`.
- Added `pnpm catalog:mongo-ownership` and
  `pnpm catalog:mongo-ownership:check`.
- Generated:
  - `engineering/sprints/platform-audit-p1/MONGO_COLLECTION_OWNERSHIP_MAP.md`
  - `engineering/sprints/platform-audit-p1/mongo-ownership-map.json`

Generated coverage:

- 65 Mongo collections from the schema catalog.
- Owner domain, steward, primary surface, conservative persistence-tier label,
  schema mode, resolved-string status, source count, and source files.
- 0 unclassified collection rows.

### P1-39: Mongo Index Audit

Implemented:

- Added `server/scripts/generate-mongo-index-audit.mjs`.
- Added `pnpm catalog:mongo-indexes` and
  `pnpm catalog:mongo-indexes:check`.
- Generated:
  - `engineering/sprints/platform-audit-p1/MONGO_INDEX_AUDIT_PLAN.md`
  - `engineering/sprints/platform-audit-p1/mongo-index-audit-plan.json`

Generated coverage:

- 46 high-volume/planned Mongo index rows.
- Current audit state: general `ensureIndexes` is not present; Knowledge
  Evolution has its own ensure helper; VM indexes are declared in
  `vmSchemas.ts` but not generally applied.
- 0 explicit high-volume collections without a plan row.

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
