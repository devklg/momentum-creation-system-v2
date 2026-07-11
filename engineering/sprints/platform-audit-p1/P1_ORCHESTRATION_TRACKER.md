# Platform Audit P1 Orchestration Tracker

> Started 2026-07-11 after P0 merged. Source tasklist:
> `PLATFORM_AUDIT_PRIORITY_TASKLIST.md`.

## Current Tranche

Latest branch: `codex/platform-audit-p1-pre-gate-tests`

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
- P1-40: generated a Neo4j labels, relationships, constraints, and indexes
  catalog.
- P1-41: added Neo4j schema migration dry-run, apply, and verify commands.
- P1-42: generated a Chroma collection catalog by purpose, domain, language,
  source, and metadata contract.
- P1-43: added Chroma metadata contract tests and aligned GraphRAG retrieval
  with the direct Chroma adapter's `query_with_filter` action.
- P1-44: generated a source-backed API route map from `server/src/index.ts`,
  route modules, and the internal knowledge-evolution runtime router.
- P1-45: generated a route access matrix covering auth, admin, Steve
  completion, VM entitlement, worker-secret, provider-webhook, and internal
  runtime gate classes.
- P1-46: added QA tests proving every `/api/admin/*` route is protected by
  `requireAdmin` or the explicit `requireAdminOrHealthSecret` exception.
- P1-47: added QA tests proving BA-facing gated routes enforce auth, Steve
  completion, and VM entitlement gates where intended.
- P1-48: added QA tests proving pre-gate routes stay limited to approved
  route families and access classes.

Catalog artifacts:

- `engineering/sprints/platform-audit-p1/PERSISTENCE_WRITE_CATALOG.md`
- `engineering/sprints/platform-audit-p1/persistence-write-catalog.json`
- `server/scripts/generate-persistence-write-catalog.mjs`
- `engineering/sprints/platform-audit-p1/NEO4J_CATALOG.md`
- `engineering/sprints/platform-audit-p1/neo4j-catalog.json`
- `server/scripts/generate-neo4j-catalog.mjs`
- `server/src/services/persistence/neo4j/schemaMigration.ts`
- `server/scripts/apply-neo4j-schema.ts`
- `engineering/sprints/platform-audit-p1/CHROMA_COLLECTION_CATALOG.md`
- `engineering/sprints/platform-audit-p1/chroma-collection-catalog.json`
- `server/scripts/generate-chroma-catalog.mjs`
- `server/src/qa/__tests__/chromaMetadataContract.test.ts`
- `engineering/sprints/platform-audit-p1/API_ROUTE_MAP.md`
- `engineering/sprints/platform-audit-p1/api-route-map.json`
- `server/scripts/generate-api-route-map.mjs`
- `server/src/qa/__tests__/apiRouteMap.test.ts`
- `engineering/sprints/platform-audit-p1/ROUTE_ACCESS_MATRIX.md`
- `engineering/sprints/platform-audit-p1/route-access-matrix.json`
- `server/scripts/generate-route-access-matrix.mjs`
- `server/src/qa/__tests__/routeAccessMatrix.test.ts`
- `server/src/qa/__tests__/adminRouteProtection.test.ts`
- `server/src/qa/__tests__/baRouteGateProtection.test.ts`
- `server/src/qa/__tests__/preGateSurface.test.ts`

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

### P1-40: Neo4j Catalog

Implemented:

- Added `server/scripts/generate-neo4j-catalog.mjs`.
- Added `pnpm catalog:neo4j` and `pnpm catalog:neo4j:check`.
- Generated:
  - `engineering/sprints/platform-audit-p1/NEO4J_CATALOG.md`
  - `engineering/sprints/platform-audit-p1/neo4j-catalog.json`

Generated coverage:

- 68 Neo4j labels and 59 relationships from the schema catalog.
- 11 planned core uniqueness constraints for graph-critical app anchors.
- 7 declared Phase 7 constraints/indexes from
  `server/src/services/persistence/neo4j/phase7Constraints.ts`.
- 53 labels without a cataloged constraint/index, retained as explicit
  follow-up evidence for P1-41 and later graph diagnostics.

### P1-41: Neo4j Schema Migrations

Implemented:

- Added `server/src/services/persistence/neo4j/schemaMigration.ts`.
- Added `server/scripts/apply-neo4j-schema.ts`.
- Added root and server package scripts:
  - `pnpm neo4j:schema:dry-run`
  - `pnpm neo4j:schema:apply`
  - `pnpm neo4j:schema:verify`
- Added `server/src/services/persistence/neo4j/__tests__/schemaMigration.test.ts`.

Migration behavior:

- Uses the P1 Neo4j catalog as the migration authority.
- Runs through `persistenceCall('neo4j', 'cypher', ...)`, preserving the app's
  direct-only persistence gate and dedicated MCS stack.
- Dry-run is the default and does not call Neo4j.
- Apply executes only single-statement idempotent
  `CREATE CONSTRAINT/INDEX ... IF NOT EXISTS` Cypher, constraints before
  indexes.
- Verify compares expected cataloged names against `SHOW CONSTRAINTS` and
  `SHOW INDEXES` output instead of count-only checks.

Operator commands:

```powershell
pnpm neo4j:schema:dry-run
pnpm neo4j:schema:apply
pnpm neo4j:schema:verify
```

### P1-42: Chroma Collection Catalog

Implemented:

- Added `server/scripts/generate-chroma-catalog.mjs`.
- Added `pnpm catalog:chroma` and `pnpm catalog:chroma:check`.
- Generated:
  - `engineering/sprints/platform-audit-p1/CHROMA_COLLECTION_CATALOG.md`
  - `engineering/sprints/platform-audit-p1/chroma-collection-catalog.json`

Generated coverage:

- 50 registered Chroma collections from `server/src/services/chromaCollections.ts`.
- Rev3 collection metadata from `server/scripts/provisioning/rev3-registry.mjs`
  including embedding model and dimension.
- Purpose, domain, language, and source classification for every collection.
- Observed Chroma write/query actions, metadata keys, and filter keys from
  source call sites.
- Inferred required metadata keys for knowledge, active GraphRAG, identity,
  prospect, CRM, VM/RVM, audit, and operational collections.
- Observed unregistered/dynamic Chroma targets, including literal drift
  candidates and generic projection/tiered-write expressions.

Current catalog summary:

- 50 collection contract rows.
- 30 collections with observed write/query usage.
- 10 language-scoped active-knowledge collections.
- 7 observed unregistered/dynamic Chroma targets to drive P1-43 contract tests.

### P1-43: Chroma Metadata Contract Tests

Implemented:

- Added `server/src/qa/__tests__/chromaMetadataContract.test.ts`.
- Updated GraphRAG retrieval in `server/src/domain/graphrag.ts` to use the
  direct Chroma adapter's supported `query_with_filter` action.
- Updated `server/src/domain/__tests__/graphrag.test.ts`.

Coverage:

- Every registered Chroma collection has a catalog row with canonical
  `all-MiniLM-L6-v2` / 384-dim embedding metadata.
- Approved knowledge chunks require canonical source/id/scope fields:
  `sourceId`, `chunkId`, `documentId`, domain/language, status,
  `retrievalEligible`, and tenant/team scope keys.
- Active GraphRAG collections require `tenantId`, `domain`, `language`,
  `knowledgeObjectId`, and `retrievalReady`.
- Review-only learning candidates remain separate from active retrieval
  readiness.
- Literal and dynamic unregistered Chroma targets remain visible as follow-up
  evidence.

### P1-44: API Route Map

Implemented:

- Added `server/scripts/generate-api-route-map.mjs`.
- Added root scripts `pnpm catalog:api-routes` and
  `pnpm catalog:api-routes:check`.
- Generated `engineering/sprints/platform-audit-p1/API_ROUTE_MAP.md`.
- Generated `engineering/sprints/platform-audit-p1/api-route-map.json`.
- Added `server/src/qa/__tests__/apiRouteMap.test.ts`.

Current route-map summary:

- 46 mounted routers from `server/src/index.ts`.
- 46 route files, including
  `server/src/runtime/knowledge-evolution/routes.ts`.
- 206 static route rows.
- Mount phases preserved: raw-body before JSON, admin large-body parser,
  pre-gate routes, and BA-facing gated routes.
- Access profiles captured for admin, BA auth + Steve, prospect-token,
  internal runtime, public/pre-gate, and raw-body webhook families.
- Guard signals captured for `requireAdmin`, `requireAdminOrHealthSecret`,
  `requireAuth`, `requireSteveComplete`, `requireVmDialerAccess`,
  `requireRuntimeInternal`, rate-limit middleware, and raw-body parsers.

### P1-45: Route Access Matrix

Implemented:

- Added `server/scripts/generate-route-access-matrix.mjs`.
- Added root scripts `pnpm catalog:route-access` and
  `pnpm catalog:route-access:check`.
- Added the route-access freshness check to CI `gates`.
- Generated `engineering/sprints/platform-audit-p1/ROUTE_ACCESS_MATRIX.md`.
- Generated `engineering/sprints/platform-audit-p1/route-access-matrix.json`.
- Added `server/src/qa/__tests__/routeAccessMatrix.test.ts`.

Current access-matrix summary:

- 206 routes covered from `api-route-map.json`.
- 0 generated access findings.
- 88 `requireAdmin` routes.
- 1 `requireAdminOrHealthSecret` route.
- 87 `requireAuth` routes.
- 72 `requireSteveComplete` routes.
- 12 `requireVmDialerAccess` routes.
- Explicit categories for public health, auth bootstrap/session routes,
  BA pre-Steve routes, BA Steve-gated routes, VM-entitled BA routes,
  prospect-token and prospect re-entry routes, raw-body Telnyx webhooks,
  Steve worker-secret endpoints, VM provider webhooks, and internal runtime
  routes.

### P1-46: Admin Route Protection Tests

Implemented:

- Added `server/src/qa/__tests__/adminRouteProtection.test.ts`.
- Verifies every current `/api/admin/*` route from
  `route-access-matrix.json`.
- Proves ordinary admin routes declare `requireAdmin`, expect an
  `admin_session`, and carry no generated access findings.
- Keeps the only admin-secret exception narrow:
  `GET /api/admin/health/triple-stack` with `requireAdminOrHealthSecret`.

### P1-47: BA Gate Protection Tests

Implemented:

- Added `server/src/qa/__tests__/baRouteGateProtection.test.ts`.
- Proves all `ba_auth_steve_gated` routes declare `requireAuth` and
  `requireSteveComplete`.
- Proves all 12 `ba_auth_steve_vm_entitled` routes declare `requireAuth`,
  `requireSteveComplete`, and `requireVmDialerAccess`.
- Proves `ba_auth_pre_steve` routes still require a BA session while recording
  intentional Steve exceptions.
- Documents the key exceptions: `/api/cockpit/launch`,
  `/api/profile/*`, and dynamic Fast Start module state gating.

### P1-48: Pre-Gate Surface Tests

Implemented:

- Added `server/src/qa/__tests__/preGateSurface.test.ts`.
- Proves raw-body, admin large-body, and pre-gate mount phases stay limited
  to approved access classes.
- Proves pre-gate rows stay within approved route prefixes.
- Proves ordinary BA-gated app routes do not land in pre-gate phases except
  the explicit Michael training-support and Steve sponsor-profile support
  routes, both of which still declare auth + Steve completion.
- Proves authenticated pre-Steve rows require a BA session.
- Proves unauthenticated pre-gate rows are limited to auth bootstrap,
  auth logout/session exception, public health, prospect token/re-entry,
  raw webhook, worker secret, provider webhook, admin, or internal runtime
  families.

### P1-49: Prospect-Facing Compliance Architecture Lint

Implemented:

- Added `server/src/qa/__tests__/prospectFacingComplianceArchitecture.test.ts`.
- Proves `.com` runtime strings stay clear of high-risk forbidden language
  categories: income/earnings/commission/compensation, cycle/CV/rank math,
  spillover/binary-leg/placement-guarantee claims, AI prospecting/Michael
  language, current team head count, and product-company/promoter branding.
- Proves both `.com` footers render the shared `MCS_COM_DISCLAIMER` instead of
  hardcoding independent copies.
- Proves `.com` API literals stay within prospect token/re-entry families:
  `/api/p` and `/api/rvm`.
- Proves every `.com` client endpoint has a matching prospect-only route access
  matrix row with no BA, admin, runtime-internal, Steve, or VM entitlement gate.
- Closed a route-placement mismatch by adding missing RVM prospect-token routes
  for `/:token/stream`, `/:token/webinar-reserve`, and `/:token/team-stats`.

### P1-50: COM PMV And Prospect-Facing Compliance Scanner

Implemented:

- Added `server/scripts/generate-com-prospect-compliance-scan.mjs`.
- Added `pnpm compliance:com` and `pnpm compliance:com:check`; the CI `gates`
  job now runs the check.
- Generated `engineering/sprints/platform-audit-p1/COM_PROSPECT_COMPLIANCE_SCAN.md`
  plus `com-prospect-compliance-scan.json`.
- Added `server/src/qa/__tests__/comProspectComplianceScan.test.ts`.
- Scanner uses AST-backed visible strings from `apps/com/src` plus shared
  compliance constants, rather than raw source grep.
- Blocks income/compensation/rank/cycle/CV language, placement/spillover or
  binary-leg promises, AI prospecting/lead qualification/scoring language,
  current team head count, THREE company branding/promoter disclaimers, and
  programmatic THREE handoff language.
- Documents allowed signals for GLP-THREE product context, public market/cost
  context, the 100,000 goal, PMV language, placement-demo language, and the
  canonical shared disclaimer.

### P1-51: ScriptMaker And Ivory Generated-Copy Compliance

Implemented:

- Added `server/src/domain/generatedCopyCompliance.ts` as the shared
  deterministic post-generation guard for ScriptMaker and Ivory copy.
- Replaced ScriptMaker's private scanner with the shared generated-copy
  scanner while preserving degraded fallback behavior.
- Added generated-output scans around Ivory coach JSON, Ivory invitation-agent
  drafts, and Ivory Momentum follow-up suggestions; noncompliant model output
  drops to deterministic safe fallback copy.
- Added a generated-source persistence boundary in the invitation spine:
  `source: 'ivory' | 'scriptmaker'` messages that trip the scanner fail before
  token minting or prospect persistence. This covers ScriptMaker-seeded
  invitations, Ivory direct mint, and Generator mint paths.
- Kept the BA-side canonical `make_money` angle label intact, but added
  compliance-safe angle labels for LLM prompts and generated fallbacks so Ivory
  generated copy never echoes the risky phrase.
- Added focused Vitest coverage:
  `generatedCopyCompliance.test.ts`,
  `scriptmakerGeneratedCopyCompliance.test.ts`,
  `ivoryGeneratedCopyCompliance.test.ts`,
  `ivoryMomentumGeneratedCopyCompliance.test.ts`, and
  `invitationGeneratedMessageCompliance.test.ts`.

Verification:

- `pnpm --filter @momentum/server test -- generatedCopyCompliance scriptmakerGeneratedCopyCompliance ivoryGeneratedCopyCompliance ivoryMomentumGeneratedCopyCompliance invitationGeneratedMessageCompliance`
- `pnpm --filter @momentum/server typecheck`
- `pnpm typecheck`
- `pnpm build`
- `pnpm --filter @momentum/server test`
- Catalog and `.com` compliance checks:
  `pnpm catalog:persistence:check`,
  `pnpm catalog:schema:check`,
  `pnpm catalog:mongo-ownership:check`,
  `pnpm catalog:mongo-indexes:check`,
  `pnpm catalog:neo4j:check`,
  `pnpm catalog:chroma:check`,
  `pnpm catalog:api-routes:check`,
  `pnpm catalog:route-access:check`,
  `pnpm compliance:com:check`

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
pnpm catalog:schema:check
pnpm catalog:mongo-ownership:check
pnpm catalog:mongo-indexes:check
pnpm catalog:neo4j:check
pnpm catalog:chroma:check
pnpm catalog:api-routes:check
pnpm catalog:route-access:check
pnpm typecheck
pnpm build
pnpm --filter @momentum/server test
```
