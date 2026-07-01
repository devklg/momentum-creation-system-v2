# P10 — MCS V2 Schema Design (MongoDB · Neo4j · ChromaDB)

**Phase:** 10 — DevOps, Security, Environments, and Operations
**Purpose:** Define the schemas for the app's dedicated triple-stack so the write-freeze (`[[mcs-v2-db-write-freeze]]`) can be lifted per-store once approved. This is the linchpin that unblocks release-checklist **B4** (H1 smoke) and the direct-mode data cutover.
**Status:** 📐 **PROPOSED — NOT APPLIED.** Creates nothing in any store. Per the GraphRAG contract's Non-Destructive Rule and the MCS V2 write-freeze, approval is Kevin's before any validator/constraint is applied.
**Author:** Claude Code (Instance 2), Phase 10 worktree. **Date:** 2026-06-30.
**Companions:** `P10_PRODUCTION_TOPOLOGY_DECISION.md`, `P10_EMBEDDING_PIPELINE_AND_DIRECT_MODE_MIGRATION_PLAN.md`, `docs/graphrag-schema-contract.md`.

---

## 1. Methodology — how these schemas were determined

**Derived from the running code, not invented.** Every collection/label below is reverse-engineered from what the code actually reads and writes, with `file:line` evidence gathered by three read-only inventory passes (Mongo / Neo4j / Chroma). Precedence when sources disagree:

1. **`@momentum/shared` TypeScript types** (`packages/shared/src/*.ts`) — the strongest typed contract for a persisted shape.
2. **Domain builders + seeders** (`server/src/domain/*`, `server/scripts/*`) — the code that constructs the documents; wins over stale type comments (several noted below).
3. **Gateway call sites** (`tripleStack.ts`, `tieredWrite.ts`, `projectionOutbox.ts`) — confirm the collection name and the id/`_id` convention.

**The Mongo pipeline already exists; only the content is missing.** `mongo/jsonSchema/generate.ts` turns a Mongoose schema into a `$jsonSchema` validator and `apply.ts` applies it (`collMod`, `validationAction:'error'`, `validationLevel:'moderate'`). Today `models/registry.ts` returns **one permissive placeholder** for every collection (only `_id` required, `strict:false`). This design supplies the per-collection Mongoose models that generator was built to consume — no new machinery.

**Memory/lineage records are not redesigned here.** Decisions, handoffs, transcripts, knowledge chunks, and derived GraphRAG memory follow the **already-approved base envelope** in `docs/graphrag-schema-contract.md` (`id, type, schema_version, namespace, source, created_at, title, origin_kind` + conditional origin fields). This design covers the **app/domain** stores and points memory records at that contract.

**Purpose** for each collection/label is read from its call sites (what domain operation produces/consumes it), cross-checked against the locked-spec — never guessed.

---

## 2. Scope & the two schema families

| Family | Owner | Governed by |
|---|---|---|
| **App / domain data** (49 Mongo collections, ~37 Neo4j business labels, 26 Chroma collections) | this document | derived per §1 |
| **Memory / lineage / GraphRAG** (`session_handoffs`, `chat_registry`, `perry_handoffs`, `memory_*`, decisions, transcripts, chunks; Neo4j `Conversation/Handoff/Decision/Chunk/…`) | `docs/graphrag-schema-contract.md` | the base-envelope contract; **out of app-runtime scope** |

The memory family lives in the `universal_gateway` database and the gateway's stores — the app writes to `momentum`. Keep them separate; do not cross-apply validators.

---

## 3. Cross-cutting conventions (derived from the inventory)

These hold across the app data model and are the backbone of the schemas:

1. **Database:** every app collection is in `momentum`.
2. **Shared canonical id:** for triple-stacked entities, `Mongo _id === Neo4j node key === Chroma id`. Most collections set `_id` = a natural/human key (`baId`, `code`, `token`, `prospectId` for placements, composite keys). **Exceptions** (auto `ObjectId`, logical key stored as a field): `prospects` (`prospectId`), `invitation_activity` (`activityId`), `agent_events` (`eventId`). *Design choice for Kevin (§7): standardize on `_id`=natural-key for new collections.*
3. **Timestamps are ISO-8601 strings** (`...Z`), never BSON `Date`. Validators use `bsonType:'string'` for time fields (not `date`).
4. **Chroma record contract:** `id` = the Mongo `_id`; `document` = a short human-readable summary sentence (never JSON); `metadata` = a flat scalar map that always carries a **`kind`** discriminator + entity ids + ISO timestamps (for `where` filtering).
5. **Embeddings:** all vectors are **all-MiniLM-L6-v2, 384-dim**. Add embedding provenance (`model`, `model_version`) per the parity decision (§6.3) — absent today.
6. **Field naming:** app data uses **camelCase** (existing). The memory family uses **snake_case** per the GraphRAG contract. Do not mix within a family.
7. **Validator posture (first pass):** `validationLevel:'moderate'`, `validationAction:'error'`, `additionalProperties:true`, `required` = only the **proven-always-present** core (key + fields written on every path). This hardens type/required-core without breaking the polymorphic/divergent writers (§5). Tighten to `additionalProperties:false` per-collection **only after** the §5 reconciliations.

---

## 4. MongoDB — collection schemas (49, database `momentum`)

For each: **key** (`_id` convention), **required-core** (validated `required` + bsonType), **indexes**, **purpose**. Full optional/polymorphic field lists are in the domain builders cited. Types: `s`=string, `n`=number, `b`=bool, `arr`=array, `obj`=object.

### A. Identity / Access

| Collection | `_id` | Required-core (bsonType) | Indexes | Purpose |
|---|---|---|---|---|
| `brand_ambassadors` | `baId` | baId·threeBaId·threeUsername·firstName·lastName·email·phone·timezone·createdAt (s); passwordHash·sponsorBaId·sponsorThreeBaId·accessCodeUsed·lastLoginAt (s/null) | email, threeBaId | Master BA identity + login. **Most polymorphic** — onboarding `$set` flags (`welcome_seen`, `commitment_accepted`, `questionnaire_complete`, `workbook_complete`, `partnership_classification`, `photoUrl`, `notifPrefs`, `pendingEmail/Phone`, founder `role/welcomedAt/onboardingState`) → keep `additionalProperties:true`. |
| `access_codes` | `code` | code·sponsorBaId·sponsorThreeBaId·sponsorFirstName·sponsorLastName·createdAt (s)·active (b) | sponsorBaId+active | `TM-XXXX` sponsor codes, one active/BA for life. |
| `ba_commitments` | `commitmentId` | commitmentId·baId·threeBaId·email·version·acceptedAt (s) | baId | One-click commitment acceptance (audit-grade). |
| `ba_questionnaires` | `questionnaireId` | questionnaireId·baId·threeBaId·version·submittedAt (s) + enum answer fields | baId | 21-answer self-serve interview. Enum fields (`employmentStatus`, `productStatus`, `weeklyHours`, `coachabilityTest`, `nwmExperience`, `investmentReady`, …) validated as string enums. |
| `ba_workbooks` | `workbookId` | workbookId·forBaId·forThreeBaId·conductedByBaId·status(`draft\|final`)·version·createdAt·updatedAt (s) | forBaId | Sponsor-led 20-Q interview; draft→final. |
| `profile_change_challenges` | `challengeId` | challengeId·baId·channel(`email\|phone`)·target·codeHash·issuedAt·expiresAt (s) | {baId,channel,redeemedAt:null} | 15-min single-use verification codes. One collection w/ `channel` discriminator (type comment says per-channel — code wins). |

### B. Prospect / Token / Pool / CRM

| Collection | `_id` | Required-core | Indexes | Purpose |
|---|---|---|---|---|
| `prospects` | ObjectId (key `prospectId`) | prospectId·firstName·lastName·lastInitial·location(obj)·sponsorBaId·state·becameCustomer(b)·createdAt·updatedAt·expiresAt·token·source (s) | {prospectId}, {sponsorBaId,deleted}, {state,positionNumber,placedAt} | The invited person; funnel record. `sponsorBaId` **immutable**. |
| `invite_tokens` | `token` | token·prospectId·sponsorBaId·state·createdAt·expiresAt (s) | {token}, {sponsorBaId} | Opaque 12-char token; authoritative lifecycle rail (forward-only state machine). RVM path adds `source/tokenKind/leadId/vmCampaignId`. |
| `invitation_activity` | ObjectId (key `activityId`) | activityId·prospectId·sponsorBaId·kind·note·at (s) | {sponsorBaId}(at) | Append-only BA-side timeline. |
| `pool_counters` | `'tm_team_pool'` | current (n)·createdAt (s) | — | Single-row monotonic team counter. **No shared type** (inline). |
| `pool_placements` | `prospectId` | prospectId·sponsorBaId·positionNumber(n)·placedAt·expiresAt (s) | {prospectId,flushedAt:null}, {flushedAt:null,placedAt} | One placement/prospect; monotonic slot, never renumbered. |
| `prospect_accounts` | `accountId` | accountId·prospectId·tokenId·sponsorBaId·reentryCode·createdAt·expiresAt (s) | {tokenId}, {phone,expiresAt}, {phone,reentryCode,expiresAt} | Durable prospect re-entry account. |
| `prospect_magic_links` | `linkToken` | linkToken·accountId·tokenId·issuedAt·expiresAt·requestPhoneHash·smsDeliveryStatus (s) | {linkToken,redeemedAt:null} | Single-use 60-min SMS re-entry (type says 15-min — code wins). |
| `prospect_sessions` | `sessionId` | sessionId·accountId·prospectId·tokenId·sponsorBaId·createdAt·expiresAt (s) | {sessionId} | Opaque `.com` session. **Mongo-only** (not triple-stacked). |
| `callback_requests` | `callbackRequestId` | callbackRequestId·token·prospectId·sponsorBaId·intent·createdAt·smsDeliveryStatus (s) | {sponsorBaId,createdAt} | Prospect "raised hand" (multiple/prospect). |
| `crm_notes` | `noteId` | noteId·prospectId·sponsorBaId·text·createdAt (s) | {prospectId,sponsorBaId} | BA-private append-only notes (≤2000 chars). |
| `crm_followups` | `followUpId` | followUpId·prospectId·sponsorBaId·dueAt·createdAt (s) | {prospectId,sponsorBaId,clearedAt:null}, {sponsorBaId,clearedAt:null,dueAt} | One active reminder per (prospect,BA). |
| `crm_dispositions` | `crmdispo_<prospectId>_<sponsorBaId>` | prospectId·sponsorBaId·updatedAt (s) | (key) | Current disposition tag per (prospect,BA). |
| `prospect_crm_records` | `crm_<prospectId>` | crmRecordId·prospectId·ownerTmBaId·sponsorTmBaId·source·status·createdAt·updatedAt (s) | {prospectId}, {token}, {ownerTmBaId} | VM/RVM lead-campaign CRM layer. |
| `prospect_timeline_events` | `eventId` | eventId·prospectId·ownerTmBaId·sponsorTmBaId·kind·title·occurredAt (s) | {prospectId,ownerTmBaId}(occurredAt) | Append-only VM-aware CRM timeline (~30 `kind` enum). |

### C. Webinar / Orientation / Training / Steve

| Collection | `_id` | Required-core | Indexes | Purpose |
|---|---|---|---|---|
| `webinar_events` | `eventId` (date-slug) | eventId·scheduledFor·hosts(arr)·durationMinutes(n)·status·createdAt | {status,scheduledFor} | Scheduled prospect webinars. |
| `webinar_reservations` | `reservationId` | reservationId·eventId·token·prospectId·sponsorBaId·name·email·createdAt·emailDeliveryStatus·smsDeliveryStatus (s) | — | Prospect seat reservations. Undeclared-but-written: `smsDeliveredAt`,`emailDeliveredAt` → include in schema (fix drift). |
| `orientation_sessions` | `sessionId` | sessionId·scheduledFor·hosts(arr)·capacity(n)·durationMinutes(n)·status·createdAt | {status,scheduledFor} | BA group orientation (capacity 10). |
| `orientation_reservations` | `reservationId` | reservationId·sessionId·baId·baName·scheduledFor·status·createdAt·smsDeliveryStatus (s) | {sessionId,status}, {baId,status} | BA seat reservations (soft-cancel). |
| `fast_start_progress` | `<baId>__module-<moduleId>` | baId·moduleId(n)·state·updatedAt·createdAt (s) | {baId,moduleId}, {baId} | Per-BA-per-module training state. |
| `steve_discoveries` | `SD-<baId>` | baId (s)·successProfile(obj) | {baId} | Discovery & Success Interview (1/BA). `successProfile` is authoritative here (a reader declares a divergent subset — Steve wins). |

### D. Agents / Governance / Audit / Admin

| Collection | `_id` | Required-core | Indexes | Purpose |
|---|---|---|---|---|
| `agent_events` | ObjectId (key `eventId`) | eventId·baId·agentId·kind·createdAt (s) | — | Agent-interaction audit trail. |
| `generator_runs` | `runId` | runId·baId·productKey·productName·angle·createdAt·updatedAt (s) | {runId}, {baId} | WDYK Generator sessions. |
| `ivory_names` | `ivoryId` | ivoryId·baId·firstName·lastName·lastInitial·categories(arr)·status·createdAt·updatedAt (s) | {baId}(lastTouchedAt), {ivoryId} | BA-private warm-market roster. |
| `mcs_audit_log` | `entryId` (sortable) | entryId·timestamp·createdAt·role·actor(obj)·action·entity(obj)·severity (s/obj) | {timestamp,entryId}, filters: role/action/entity.kind/entity.id/severity/actor.baId | Canonical append-only audit substrate. (Chroma mirror is `mcs_audit_log`; `audit_log` w/o prefix is a Chroma-only sponsor-override mirror — do not create a Mongo `audit_log`.) |
| `projection_outbox` | `outboxId` | outboxId·tier·target·entityId·mongoCollection·payload(obj)·priority·status·attempts(n)·maxAttempts(n)·nextAttemptAt·createdAt·updatedAt | {status,nextAttemptAt}, {entityId} | Durable retry queue for lagging Neo4j/Chroma projections (H1). |
| `tenant_settings_versions` | `settingsVersionId` | settingsVersionId·version(n)·reason·createdAt·tenantId·complianceMode (s) | {tenantId}(version) | Append-only tenant settings history. |
| `master_content_versions` | `templateVersionId` | templateVersionId·tenantId·templateKey·surface·version(n)·createdAt (s) | {tenantId,templateKey}(version) | Append-only master-content overrides. |
| `admin_settings` | human key | value(n) | (key) | Single-row-per-key admin config. Mongo-only; upsert branches on existence. |
| `admin_sponsor_overrides` | `overrideId` | overrideId·baId·previousSponsorBaId·newSponsorBaId·requestingBaId·reason·performedByBaId·performedAt·auditEntryId (s) | {baId}(performedAt) | Append-only sponsor-override history. |
| `admin_curated_leader_tags` | `curated_<baId>` | baId·curated(b)·setByBaId·setAt (s) | {baId} | Curated-leader badge. Mongo-only. |
| `admin_ba_notes` | `noteId` | noteId·baId·text·authorBaId·createdAt (s) | {baId}(createdAt) | Kevin-private BA notes. Mongo-only. |
| `admin_prospect_notes` | `noteId` | noteId·prospectId·body·createdAt·createdByBaId·createdByDisplayName (s) | {prospectId}(createdAt) | Kevin-private prospect notes (triple-stacked). |

### E. Voicemail (VM/RVM) / Broadcast

| Collection | `_id` | Required-core | Indexes | Purpose / flag |
|---|---|---|---|---|
| `vm_lead_batches` | `leadBatchId` | leadBatchId·ownerTmBaId·sponsorTmBaId·name·source·country·leadType·status·createdAt·updatedAt (s) | {ownerTmBaId,status,createdAt}, {sponsorTmBaId,createdAt} | BA-owned acquisition batch. |
| `vm_campaigns` | `vmCampaignId` | vmCampaignId·ownerTmBaId·sponsorTmBaId·leadBatchId·name·provider·status·createdAt·updatedAt (s) | {ownerTmBaId,status,createdAt}, {leadBatchId,createdAt} | BA-owned campaign. `adminApprovedForLiveDelivery` read by worker, never written here. |
| `vm_bulk_leads` | `leadId` | leadId·leadBatchId·ownerTmBaId·status·createdAt (s) | {leadBatchId,status}, {vmCampaignId,status}, {ownerTmBaId,createdAt}, {ownerTmBaId,dedupeKey} | Imported VM/RVM leads. ⚠️ **TWO divergent writers** (§5.3) — keep permissive until reconciled. |
| `vm_queue_jobs` | `jobId` | jobId·kind·status·attempts(n)·maxAttempts(n)·availableAt·createdAt·updatedAt (s) | {kind,status,availableAt} | Durable VM work queue. **No shared type.** |
| `vm_delivery_events` | `eventId` | eventId·provider·leadId·vmCampaignId·ownerTmBaId·status·dryRun(b)·attempt(n)·createdAt (s) | — | VM send/webhook history. ⚠️ **runtime shape ≠ typed contract** (§5.3). |
| `vm_provider_webhook_events` | `webhookEventId` | webhookEventId·provider·payload(obj)·status·createdAt (s) | — | Raw webhook ingestion. **No shared type.** |
| `vm_audit_events` | `auditId` | auditId·action·entityId·summary·createdAt (s) | — | Append-only VM operational audit. **No shared type.** |
| `vm_suppression_list` | ⚠️ undetermined | ownerTmBaId + (normalizedPhone \| normalizedEmail) | {ownerTmBaId,normalizedPhone/Email} | Do-not-contact list. **Partial** — no writer in scanned scope; shape unconfirmed, `'global'` scope sentinel. Do NOT schema until a writer is confirmed. |
| `broadcasts` | `broadcastId` | broadcastId·createdByBaId·createdAt·isTestSend(b)·audiencePreset·channel·template(obj)·recipientCount(n)·status (s) | — | Kevin-only broadcast master. |
| `broadcast_recipients` | `<broadcastId>::<baId>` | rowId·broadcastId·recipientBaId·recipientFullName·channel·status·attempts(n)·queuedAt (s) | {status}(queuedAt) | One row/recipient. Boot resets stuck `sending`→`queued`. |
| `broadcast_optouts` | `baId` | baId·reason·addedAt (s) | (key) | Global permanent STOP list. |

**Undetermined / defer:** `vm_suppression_list` (no writer found), `prospect_ownership_corrections` (in the VM registry but no runtime writer). Do not create validators for these until a writer confirms the shape.

---

## 5. Prerequisite reconciliations (fix in code BEFORE tightening validators)

Applying strict schemas over these divergences would reject valid writes. The first-pass posture (§3.7) tolerates them; **tightening requires fixing them first.**

1. **Neo4j `BA` vs `BrandAmbassador`** — the same ambassador is written under two labels (registration/CRM/codes use `:BA`; training/audit/broadcast/VM use `:BrandAmbassador`). Edges silently attach to the wrong node. **Reconcile to one label** before declaring constraints (or knowingly constrain both).
2. **Neo4j `ProspectCRMRecord` vs `ProspectCrmRecord`** — casing split, same key `crmRecordId`. Pick one.
3. **`vm_bulk_leads` two writers** — `bulkLeads.ts` (`lead_<uuid>`, `VmLeadLifecycleStatus`, mints token+prospect) vs `vmProviderQueue.ts` (`vmlead_<uuid>`, `VmLeadStatus`, dedupe/suppress fields). Different field-sets + status enums in one collection. Unify or split into two collections before a strict schema.
4. **`vm_delivery_events` runtime ≠ contract** — writer produces `{eventId, details, dryRun, attempt}`; the typed `VMDeliveryEventRecord` declares `{deliveryEventId, channel, occurredAt, metadata}`. Reconcile which is canonical.
5. **Delivery-timestamp drift** — `smsDeliveredAt`/`emailDeliveredAt` are `$set` on reservation collections but absent from their TS types. Add to types + schema.
6. **Four VM collections have no `@momentum/shared` type** (`vm_queue_jobs`, `vm_provider_webhook_events`, `vm_audit_events`, `vm_suppression_list`) — add types before validating.
7. **Mixed `_id` convention** — standardize new collections on `_id`=natural-key (`prospects`/`invitation_activity`/`agent_events` currently use auto-ObjectId).

---

## 6. Neo4j — constraints & indexes

Zero constraints/indexes exist in-repo today; identity relies on `MERGE`. Node keys and relationships were inventoried from literal Cypher in `server/src/domain/*` (~37 business labels, ~45 relationship types).

### 6.1 Uniqueness constraints (one per label on its key)
One `CREATE CONSTRAINT … IF NOT EXISTS FOR (n:Label) REQUIRE n.<key> IS UNIQUE` per label. Business keys:
`BA.baId`, `BrandAmbassador.baId` (until §5.1 reconciled), `Prospect.prospectId`, `Pool.id`, `InviteToken.token`, `AccessCode.code`, `Questionnaire.questionnaireId`, `Commitment.commitmentId`, `Workbook.workbookId`, `FastStartProgress.progressId`, `SteveDiscovery.discoveryId`, `OrientationSession.sessionId`, `WebinarEvent.eventId`, `CrmNote.noteId`, `ProspectCRMRecord.crmRecordId` (+`ProspectCrmRecord` until §5.2), `ProspectAccount.accountId`, `ProspectMagicLink.linkToken`, `AdminProspectNote.noteId`, `SponsorOverride.overrideId`, `AuditEntry.entryId`, `AgentEvent.eventId`, `IvoryName.ivoryId`, `Broadcast.broadcastId`, `Tenant.tenantId`, `TenantSettingsVersion.settingsVersionId`, `MasterContent.templateKey`, `MasterContentVersion.templateVersionId`, `LeadBatch.leadBatchId`, `VMCampaign.vmCampaignId`, `BulkLead.leadId`, `VmLead.leadId`, `VmQueueJob.jobId`, `VmAuditEvent.auditId`, `VmDeliveryEvent.eventId`, `VmProviderWebhook.webhookEventId`.
**Confirm inline id-prop names first** for `ProspectTimelineEvent`, `InvitationActivity`, `GeneratorRun` (created via inline `CREATE`).
**Memory layer** (out of app scope, keyed on `id`): `MemoryImport, MemorySource, Conversation, Transcript, Handoff, Decision, LearningNote, Document, Chunk, Entity` — governed by the GraphRAG contract.

### 6.2 Indexes (non-key lookup properties)
`Prospect.sponsorBaId`, `Prospect.state`, `InviteToken.prospectId`, `InviteToken.sponsorBaId`, `LeadBatch.ownerTmBaId`, `VmLead.ownerTmBaId`, `CrmNote.sponsorBaId`, `BA.email`, `AuditEntry.entityId`. Relationship-property indexes worth considering: `:IN_HOLDING_TANK(position)`, `:RESERVED_ORIENTATION(reservationId)`.

### 6.3 Note
Constraints guarantee no duplicate ids but do **not** stop `MERGE`-on-typo phantom nodes (only `tieredWrite` Tier-1 uses MATCH-anchor + read-back). The `tripleStack.ts:6` comment about an enforced email-uniqueness constraint is aspirational — none exists in-repo.

---

## 7. ChromaDB — collection & record schema

### 7.1 Collections
The canonical registry already exists: `services/chromaCollections.ts` `CHROMA_COLLECTIONS` (26 collections) with boot `ensureChromaCollections()` + write-time `assertChromaCollectionExists()`. Keep it as the source of truth. Two gaps to close: add `mcs_brand_ambassadors` (written by seeders, not registered) and confirm the orientation collection constant.

### 7.2 Record contract (per §3.4)
Every record: `id` = Mongo `_id`; `document` = summary sentence; `metadata` = flat map with **required `kind`** + entity ids + ISO timestamps. Validation for Chroma is convention-enforced in the writers (Chroma itself doesn't validate metadata schemas) — so the "schema" here is a **writer contract** + the registry, not a DB validator.

### 7.3 Embedding provenance (new — the parity decision)
Add to every record's metadata: `model` (`all-MiniLM-L6-v2`) and `model_version` (locked checksum). Enforce the two client checks (`dimensions===384`; `model_version` matches the local publisher) from the embedding-pipeline plan §4.2. Collections are fixed at **384-dim**.

### 7.4 Knowledge-intake collection (BA-facing approved knowledge)
The intake pipeline (`runtime/knowledge/intake/*`) is inert today (no writes). When activated it produces index records with a **richer retrieval metadata set**: `language, domain, heading, topicTags, agentScopes, surfaceScopes, sourceVersion`, deterministic ids (`kidx_/knw_/kchunk_/kdoc_`), `searchableText` = chunk verbatim. This is the corpus the 12h batch pipeline publishes to Chroma Cloud — define its collection + metadata schema (incl. `model_version`) as part of activating that pipeline.

---

## 8. Rollout (per-store, per-collection, reversible)

1. **Approve this design** (lifts the write-freeze for the covered collections).
2. **Mongo:** replace the permissive placeholder in `models/registry.ts` with real per-collection Mongoose schemas (required-core + typed known fields, `strict:false` → `additionalProperties:true`); apply via the existing `apply.ts` at `validationLevel:'moderate'`. Start with the stable identity/prospect/pool collections; defer the VM divergent ones (§5) until reconciled.
3. **Neo4j:** apply §6.1 constraints + §6.2 indexes (idempotent `IF NOT EXISTS`). Do the §5.1/§5.2 label reconciliations first, or knowingly double-constrain.
4. **Chroma:** keep the registry; add `model`/`model_version` to the writer contract; define the knowledge-intake collection when that pipeline activates.
5. **Tighten** (`additionalProperties:false`, stricter `required`) per-collection only after §5 reconciliations and a validation-error soak in `moderate` mode.
6. Then run the **H1 smoke** (B4) and the direct-mode cutover against the schema'd stores.

---

## 9. Open decisions for Kevin

1. **`_id` standardization** — adopt `_id`=natural-key for all new collections (recommended), and optionally migrate `prospects`/`invitation_activity`/`agent_events`?
2. **VM reconciliations (§5.3/5.4)** — unify `vm_bulk_leads` writers and pick the canonical `vm_delivery_events` shape before schema-tightening.
3. **Neo4j label reconciliation (§5.1/5.2)** — approve renaming to single labels (`BA`, `ProspectCRMRecord`).
4. **Strictness target** — how far to tighten (`additionalProperties:false`) vs stay permissive for polymorphic collections like `brand_ambassadors`.
5. **`vm_suppression_list` / `prospect_ownership_corrections`** — confirm shapes (no writer found) before schema.

---

## 10. Standing-prohibition note

Planning only — nothing created in any store. Memory/lineage schemas defer to the approved GraphRAG contract. The design proposes; approval and application are Kevin's, per the write-freeze and the contract's Non-Destructive Rule.
