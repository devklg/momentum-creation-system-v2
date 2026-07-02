# MCS V2 — Master Schema Catalog (all stores)

- Status: **REVIEW SURFACE — reflects code + approved decisions; stores not yet schema-applied.** The complete model: every Mongo collection, Neo4j label, and Chroma collection with its key, core fields, relationships, and purpose.
- Sources: `P10_MCS_V2_SCHEMA_DESIGN.md` (`f976dd3`, code-grounded), `@momentum/shared` types, `DECISION_team_magnificent_membership_canonical_identity`, `ACR-0007`, locked-spec, Phase 7 (P7.7–P7.13).
- Scope: MongoDB `momentum`@30000 (49 app + 3 memory collections) · Neo4j@7710 (~37 business labels) · ChromaDB@8200 (`mcs_*`).
- Conventions: `_id` = natural/deterministic key; timestamps are **ISO-8601 strings** (never `Date`); app data **camelCase**; Chroma `mcs_`-prefixed, 384-dim; shared `id` stitches the three stores; triple-stack writes are **app-direct** (no Universal Gateway — ACR-0007).

---

## 0. Identity & membership — the spine

**The app is exclusively for Team Magnificent members.** A member is an **enrolled III International BA in Kevin's downline** (III enrollment + downline are hard preconditions; every member IS an enrolled III BA — no member-without-III-BA state). THREE is the upstream authority for enrollment/genealogy; the app **mirrors** the downline slice, never overrides.

- **Member id (canonical):** **`tmagId`** = **`TMAG-YYYYMMDD-XXXXXX`** — the sole login identifier.
- **III mirror (required attribute):** `threeBaId` (+ `threeUsername`, III status) — never authenticates.
- **Sponsor (immutable):** captured at signup; must itself be a member; founders **`TMAG-01`** (Kevin) / **`TMAG-02`** (Paul) are roots.
- **Membership graph:** the downline sponsor tree (see §7 Neo4j).

> **Naming — `tmag` is the Team Magnificent token** (decision 2026-07-01): the member id is `tmagId` (`TMAG-…`), the access code is `TMAG-XXXX`, and **every `tm*` identifier renames to `tmag*`** (`tmBaId → tmagId`, `ownerTmBaId → ownerTmagId`, …). **The tables below still show the current pre-migration `tm*`/`TMBA-`/`TM-` names as they exist in code today;** the `tmag` rename of live field names + persisted id values executes in the one governed reidentification migration (§9), not piecemeal.

Everything below is scoped to this identity: BA-owned records carry the member id; team-wide records carry `teamKey/tenantId = team_magnificent`.

---

## 1. MongoDB — Group A · Identity / Access (6)

| Collection | `_id` | Core fields | Relationships | Purpose |
|---|---|---|---|---|
| `brand_ambassadors` | `baId` | `baId`·`threeBaId`·`threeUsername`·`firstName`·`lastName`·`email`·`phone`·`timezone`·`createdAt`; `passwordHash`·`sponsorBaId`·`sponsorThreeBaId`·`accessCodeUsed`·`lastLoginAt`; onboarding flags (`welcome_seen`, `commitment_accepted`, `questionnaire_complete`, `workbook_complete`, `partnership_classification`, founder `role/onboardingState`) | sponsored-by → another member; holds one `access_code`; owns prospects/CRM/training | **Master member identity + login.** Most polymorphic collection — keep `additionalProperties:true`. |
| `access_codes` | `code` (`TM-XXXX`) | `code`·`sponsorBaId`·`sponsorThreeBaId`·`sponsorFirstName`·`sponsorLastName`·`createdAt`·`active` | belongs to one member (sponsor); used to mint new members | One active `TM-XXXX` code per member for life; reused for everyone they sponsor. **Only Kevin mints.** |
| `ba_commitments` | `commitmentId` | `commitmentId`·`baId`·`threeBaId`·`email`·`version`·`acceptedAt` | → member | **The Team Magnificent Commitment — click-acknowledge ACCEPTANCE record** (audit-grade: versioned + IP + user-agent; locked Chat #94: click, not typed signature). NOT an interview instrument — do not confuse with Steve/questionnaire/workbook. ⚠️ **Content deliverable (Kevin):** the commitment TEXT the member agrees to must be authored and versioned; code carries `COMMITMENT_VERSION` but the substantive agreement copy is not yet written as a governed artifact. |
| `ba_questionnaires` | `questionnaireId` | `questionnaireId`·`baId`·`threeBaId`·`version`·`submittedAt` + 21 enum answers | → member | **Stage 2 of the 3-stage onboarding spine** (T+1–4h Steve discovery → T+0–48h this written self-serve questionnaire, reviewed by the sponsor before the workbook call → T+24–72h sponsor workbook). DISTINCT from Steve: written snapshot in the member's own typed words + go-getter indicators; Steve is the conversational Success Profile. ⚠️ **RETIRED by Ruling 6 (2026-07-02): folds into Steve's interview** — two-stage spine (Steve → workbook); gap-map the 21 fields into Steve's script; existing rows preserved historical, no validators. |
| `ba_workbooks` | `workbookId` | `workbookId`·`forBaId`·`forThreeBaId`·`conductedByBaId`·`status(draft\|final)`·`version`·timestamps | for-member ← conducted-by sponsor | Sponsor-led 20-Q interview; draft→final. |
| `profile_change_challenges` | `challengeId` | `challengeId`·`baId`·`channel(email\|phone)`·`target`·`codeHash`·`issuedAt`·`expiresAt` | → member | 15-min single-use email/phone verification codes. |

### 1a. Field detail — the membership record (`brand_ambassadors`)

The load-bearing identity record, field by field (`tmag`-renamed names shown; current code uses the `tm*`/`ba*` pre-migration names).

| Field | Type | Req | Notes |
|---|---|---|---|
| `tmagId` (`baId`) | string | ✓ | **Canonical member id + login** (`TMAG-YYYYMMDD-XXXXXX`). |
| `threeBaId` | string | ✓ | III International BA id — **mirrored attribute**, never authenticates. |
| `threeUsername` | string | ✓ | III username (mirror). |
| `firstName`·`lastName`·`email`·`phone`·`timezone` | string | ✓ | Profile (editable via `/api/profile`). |
| `createdAt` | ISO string | ✓ | Enrollment into Team Magnificent. |
| `passwordHash` | string\|null | – | Login secret; null until set. |
| `sponsorTmagId` (`sponsorBaId`) | string\|null | – | **Immutable** — the member who sponsored them (their upline). |
| `sponsorThreeBaId` | string\|null | – | Sponsor's III id (mirror). |
| `accessCodeUsed` | string\|null | – | The `TMAG-XXXX` code they signed up with (→ resolves sponsor). |
| `accessCodeHeld` | string\|null | – | **Their own** `TMAG-XXXX` code to sponsor others (one for life; Kevin issues). |
| `lastLoginAt` | ISO string\|null | – | Session tracking. |
| `photoUrl` | string\|null | – | Avatar. |
| `notifPrefs` | object | – | Per-channel notification mix. |
| `pendingEmail`·`pendingPhone` | string\|null | – | In-flight verified-change targets. |
| onboarding flags | mixed | – | `welcome_seen`·`commitment_accepted`·`questionnaire_complete`·`workbook_complete`·`partnership_classification` (polymorphic `$set`). |
| founder fields | mixed | – | `role`·`welcomedAt`·`onboardingState` (founders TMAG-01/02). |

`access_codes`: `code`(`TMAG-XXXX`, PK) · `sponsorTmagId` · `sponsorThreeBaId` · `sponsorFirstName` · `sponsorLastName` · `createdAt` · `active`(bool). One active code per member for life; **only Kevin mints**; reused for everyone they sponsor.

**Eligibility invariant (membership decision):** a `brand_ambassadors` row may only exist for someone who is already an enrolled III BA (`threeBaId` present) in Kevin's downline (sponsor chain resolves to a member). Enforcement of that gate is the deferred reidentification migration (§9).

---

## 2. MongoDB — Group B · Prospect / Token / Pool / CRM (14)

| Collection | `_id` | Core fields | Relationships | Purpose |
|---|---|---|---|---|
| `prospects` | ObjectId (`prospectId`) | `prospectId`·`firstName`·`lastName`·`lastInitial`·`location`·`sponsorBaId`·`state`·`becameCustomer`·`token`·`source`·timestamps | sponsored-by member (**immutable**); has token/placement | The invited person; funnel record. |
| `invite_tokens` | `token` | `token`·`prospectId`·`sponsorBaId`·`state`·`createdAt`·`expiresAt`; RVM adds `source/tokenKind/leadId/vmCampaignId` | → prospect, → member | Opaque 12-char token; authoritative forward-only lifecycle rail. |
| `invitation_activity` | ObjectId (`activityId`) | `activityId`·`prospectId`·`sponsorBaId`·`kind`·`note`·`at` | → prospect, → member | Append-only BA-side timeline. |
| `pool_counters` | `'tm_team_pool'` | `current`·`createdAt` | — | Single-row monotonic team counter. |
| `pool_placements` | `prospectId` | `prospectId`·`sponsorBaId`·`positionNumber`·`placedAt`·`expiresAt`·`flushedAt` | → prospect, → member | One placement/prospect; monotonic slot, never renumbered. |
| `prospect_accounts` | `accountId` | `accountId`·`prospectId`·`tokenId`·`sponsorBaId`·`reentryCode`·timestamps | → prospect/token | Durable prospect re-entry account. |
| `prospect_magic_links` | `linkToken` | `linkToken`·`accountId`·`tokenId`·`issuedAt`·`expiresAt`·`smsDeliveryStatus` | → account | Single-use 60-min SMS re-entry. |
| `prospect_sessions` | `sessionId` | `sessionId`·`accountId`·`prospectId`·`tokenId`·`sponsorBaId`·timestamps | → account | Opaque `.com` session. **Mongo-only** (not triple-stacked). |
| `callback_requests` | `callbackRequestId` | `callbackRequestId`·`token`·`prospectId`·`sponsorBaId`·`intent`·`smsDeliveryStatus`·`createdAt` | → prospect, → member | Prospect "raised hand" (multiple/prospect). |
| `crm_notes` | `noteId` | `noteId`·`prospectId`·`sponsorBaId`·`text`·`createdAt` | → prospect, → member | BA-private append-only notes (≤2000). |
| `crm_followups` | `followUpId` | `followUpId`·`prospectId`·`sponsorBaId`·`dueAt`·`clearedAt`·`createdAt` | → prospect, → member | One active reminder per (prospect, member). |
| `crm_dispositions` | `crmdispo_<prospectId>_<sponsorBaId>` | `prospectId`·`sponsorBaId`·`updatedAt` | → prospect, → member | Current disposition tag per (prospect, member). |
| `prospect_crm_records` | `crm_<prospectId>` | `crmRecordId`·`prospectId`·`ownerTmBaId`·`sponsorTmBaId`·`source`·`status`·timestamps | → prospect, owner/sponsor member | VM/RVM lead-campaign CRM layer. |
| `prospect_timeline_events` | `eventId` | `eventId`·`prospectId`·`ownerTmBaId`·`sponsorTmBaId`·`kind`·`title`·`occurredAt` | → prospect | Append-only VM-aware CRM timeline (~30 kinds). |

### 2a. Token lifecycle & pool mechanic (the funnel's spine)

**Invite-token state machine** (`invite_tokens.state` — forward-only, the authoritative rail; `prospects.state` mirrors it):

```
minted → clicked → video_started → video_quarter → video_half
       → video_three_quarter → video_complete → enrolled | expired
```
- Position in the **one shared team-wide pool** is anchored at `video_complete` and is **monotonic** — flushes vacate slots but never renumber (`pool_placements.positionNumber`).
- Terminal states: **`enrolled`** (409 `EnrolledResponse`) and **`expired`** (410 `ExpiredResponse`). Lazy-flush happens at read time in `/api/p/:token`.
- Separate prospect signals (not token states): a **callback request** (`callback_requests`, intent enum below) and a **webinar reservation** (`webinar_reservations`). Real-time dashboard updates via SSE (`poolEvents`).
- `becameCustomer` on `prospects` is a distinct flag (customer, not enrolled BA).

**Sponsor immutability:** `prospects.sponsorBaId` / `invite_tokens.sponsorBaId` are stamped when the token is minted and **never recomputed**. Any route accepting a `sponsorBaId` in the body must reject it (the one exception is Kevin's audited admin override → `admin_sponsor_overrides`).

---

## 3. MongoDB — Group C · Webinar / Orientation / Training / Steve (6)

| Collection | `_id` | Core fields | Relationships | Purpose |
|---|---|---|---|---|
| `webinar_events` | `eventId` (date-slug) | `eventId`·`scheduledFor`·`hosts[]`·`durationMinutes`·`status`·`createdAt` | ← reservations | Scheduled prospect webinars. |
| `webinar_reservations` | `reservationId` | `reservationId`·`eventId`·`token`·`prospectId`·`sponsorBaId`·`name`·`email`·`emailDeliveryStatus`·`smsDeliveryStatus` | → event, → prospect | Prospect seat reservations. |
| `orientation_sessions` | `sessionId` | `sessionId`·`scheduledFor`·`hosts[]`·`capacity`·`durationMinutes`·`status` | ← reservations | BA group orientation (cap 10). |
| `orientation_reservations` | `reservationId` | `reservationId`·`sessionId`·`baId`·`baName`·`scheduledFor`·`status`·`smsDeliveryStatus` | → session, → member | BA seat reservations (soft-cancel). |
| `fast_start_progress` | `<baId>__module-<moduleId>` | `baId`·`moduleId`·`state`·timestamps | → member | Per-member-per-module training state. |
| `steve_discoveries` | `SD-<baId>` | `baId`·`successProfile` | → member | Discovery & Success Interview (1/member). |

---

## 4. MongoDB — Group D · Agents / Governance / Audit / Admin (12)

| Collection | `_id` | Core fields | Relationships | Purpose |
|---|---|---|---|---|
| `agent_events` | ObjectId (`eventId`) | `eventId`·`baId`·`agentId`·`kind`·`createdAt` | → member | Agent-interaction audit trail. |
| `generator_runs` | `runId` | `runId`·`baId`·`productKey`·`productName`·`angle`·timestamps | → member | WDYK Generator sessions. |
| `ivory_names` | `ivoryId` | `ivoryId`·`baId`·`firstName`·`lastName`·`lastInitial`·`categories[]`·`status`·timestamps | → member | BA-private warm-market roster. |
| `mcs_audit_log` | `entryId` (sortable) | `entryId`·`timestamp`·`createdAt`·`role`·`actor`·`action`·`entity`·`severity`; R0 adds optional `runtime` block | → member (ACTED_BY/ACTED_FOR) | **Canonical append-only audit substrate.** (Chroma `audit_log` unprefixed = sponsor-override mirror only.) |
| `projection_outbox` | `outboxId` | `outboxId`·`tier`·`target`·`entityId`·`mongoCollection`·`payload`·`priority`·`status`·`attempts`·`nextAttemptAt` | → any entity | Durable retry queue for lagging Neo4j/Chroma projections (H1). |
| `tenant_settings_versions` | `settingsVersionId` | `settingsVersionId`·`version`·`reason`·`tenantId`·`complianceMode`·`createdAt` | → tenant | Append-only tenant settings history. |
| `master_content_versions` | `templateVersionId` | `templateVersionId`·`tenantId`·`templateKey`·`surface`·`version`·`createdAt` | → tenant | Append-only master-content overrides. |
| `admin_settings` | human key | `value` | — | Single-row-per-key admin config. Mongo-only. |
| `admin_sponsor_overrides` | `overrideId` | `overrideId`·`baId`·`previousSponsorBaId`·`newSponsorBaId`·`requestingBaId`·`reason`·`performedByBaId`·`performedAt`·`auditEntryId` | → member(s) | Append-only sponsor-override history (the one sponsor exception). |
| `admin_curated_leader_tags` | `curated_<baId>` | `baId`·`curated`·`setByBaId`·`setAt` | → member | Curated-leader badge. Mongo-only. |
| `admin_ba_notes` | `noteId` | `noteId`·`baId`·`text`·`authorBaId`·`createdAt` | → member | Kevin-private BA notes. Mongo-only. |
| `admin_prospect_notes` | `noteId` | `noteId`·`prospectId`·`body`·`createdAt`·`createdByBaId`·`createdByDisplayName` | → prospect | Kevin-private prospect notes (triple-stacked). |

---

## 5. MongoDB — Group E · Voicemail (VM/RVM) / Broadcast (11)

| Collection | `_id` | Core fields | Relationships | Purpose |
|---|---|---|---|---|
| `vm_lead_batches` | `leadBatchId` | `leadBatchId`·`ownerTmBaId`·`sponsorTmBaId`·`name`·`source`·`country`·`leadType`·`status`·timestamps | owner member | BA-owned acquisition batch. |
| `vm_campaigns` | `vmCampaignId` | `vmCampaignId`·`ownerTmBaId`·`sponsorTmBaId`·`leadBatchId`·`name`·`provider`·`status`·timestamps | → batch, owner member | BA-owned campaign. `adminApprovedForLiveDelivery` read by worker. |
| `vm_bulk_leads` | `leadId` | `leadId`·`leadBatchId`·`ownerTmBaId`·`status`·`createdAt` | → batch/campaign | Imported VM/RVM leads. ⚠️ two divergent writers (P10 §5.3). |
| `vm_queue_jobs` | `jobId` | `jobId`·`kind`·`status`·`attempts`·`availableAt`·timestamps | — | Durable VM work queue. No shared type. |
| `vm_delivery_events` | `eventId` | `eventId`·`provider`·`leadId`·`vmCampaignId`·`ownerTmBaId`·`status`·`dryRun`·`attempt`·`createdAt` | → lead/campaign | VM send/webhook history. ⚠️ runtime ≠ typed contract (P10 §5.3). |
| `vm_provider_webhook_events` | `webhookEventId` | `webhookEventId`·`provider`·`payload`·`status`·`createdAt` | — | Raw webhook ingestion. No shared type. |
| `vm_audit_events` | `auditId` | `auditId`·`action`·`entityId`·`summary`·`createdAt` | → any VM entity | Append-only VM operational audit. No shared type. |
| `vm_suppression_list` | ⚠️ undetermined | `ownerTmBaId` + (`normalizedPhone`\|`normalizedEmail`) | owner member | Do-not-contact list. **Partial — no writer confirmed; do not schema yet.** |
| `broadcasts` | `broadcastId` | `broadcastId`·`createdByBaId`·`isTestSend`·`audiencePreset`·`channel`·`template`·`recipientCount`·`status`·`createdAt` | → recipients | Kevin-only broadcast master. |
| `broadcast_recipients` | `<broadcastId>::<baId>` | `rowId`·`broadcastId`·`recipientBaId`·`recipientFullName`·`channel`·`status`·`attempts`·`queuedAt` | → broadcast, → member | One row/recipient. Boot resets stuck sending→queued. |
| `broadcast_optouts` | `baId` | `baId`·`reason`·`addedAt` | → member | Global permanent STOP list. |

---

### 5a. Deep dive — VM/RVM acquisition + Prospect CRM

The least-settled group (P10 §5.3 divergent writers). Authoritative source: `server/src/domain/vmSchemas.ts` (`VM_SCHEMA_DEFINITIONS` centralizes collection names, indexes, graph). Ringless-voicemail / SMS / email outreach to **BA-owned** acquisition leads, feeding a per-prospect CRM.

**The pipeline (owner-scoped end to end):**
```
vm_lead_batches (BA imports a batch) → vm_bulk_leads (per lead, dedupe/suppress)
  → vm_campaigns (BA schedules; adminApprovedForLiveDelivery gates live send)
  → vm_delivery_events (per send/webhook: voicemail|sms|email|manual_export)
  → prospect_crm_records (per prospect: status + disposition + follow-up)
  → prospect_timeline_events (append-only ~26-kind activity log)
```

**Collections (7) — key · owner-scope · indexes · Neo4j graph:**

| Collection | `_id` | Owner-scope + core | Indexes | Neo4j (label · rels) |
|---|---|---|---|---|
| `vm_lead_batches` | `leadBatchId` | `ownerTmagId`·`sponsorTmagId`·`name`·`source`·`country`·`leadType`·`status`·timestamps | `{owner,status,createdAt}`·`{sponsor,createdAt}` | `LeadBatch` · `OWNS_LEAD_BATCH`,`SPONSORS_LEAD_BATCH` |
| `vm_bulk_leads` | `leadId` | `leadBatchId`·`ownerTmagId`·`vmCampaignId`·`status`·`dedupeKey`·contact·`createdAt` | `{batch,status}`·`{campaign,status}`·`{owner,createdAt}`·`{owner,dedupeKey}` | `BulkLead` · `CONTAINS_LEAD`,`TARGETS_LEAD`,`OWNS_LEAD` |
| `vm_campaigns` | `vmCampaignId` | `ownerTmagId`·`sponsorTmagId`·`leadBatchId`·`name`·`provider`·`status`·`adminApprovedForLiveDelivery`·timestamps | `{owner,status,createdAt}`·`{batch,createdAt}` | `VMCampaign` · `USES_LEAD_BATCH`,`OWNS_VM_CAMPAIGN` |
| `vm_delivery_events` | `eventId` | `provider`·`leadId`·`vmCampaignId`·`ownerTmagId`·`channel`·`status`·`dryRun`·`attempt`·`createdAt` | `{campaign,status}` | `VMDeliveryEvent` · `DELIVERED_TO_LEAD`,`BELONGS_TO_CAMPAIGN` |
| `prospect_crm_records` | `crm_<prospectId>` | `crmRecordId`·`prospectId`·`ownerTmagId`·`sponsorTmagId`·`source`·`status`·`disposition`·`closedReason`·`followUpDueAt`·timestamps | `{owner,status,followUpDueAt}`·`{campaign,status}`·`{batch,status}` | `ProspectCRMRecord` · `OWNS_CRM_RECORD`,`CRM_RECORD_FOR` |
| `prospect_timeline_events` | `eventId` | `prospectId`·`ownerTmagId`·`sponsorTmagId`·`kind`·`title`·`occurredAt` | `{prospect,owner}(occurredAt)` | `ProspectTimelineEvent` · `HAS_TIMELINE_EVENT`,`TRIGGERED_BY_BA` |
| `prospect_ownership_corrections` | *(undetermined)* | `ownerTmagId`·`prospectId`·correction fields | — | `OwnershipCorrection` · `CORRECTED_OWNERSHIP`,`FROM_OWNER`,`TO_OWNER` |

**VM/RVM enums (code-grounded):**
- **Campaign status:** `draft · ready · scheduled · dry_run · running · paused · completed · cancelled · archived`
- **Delivery channel:** `voicemail · sms · email · manual_export`
- **Delivery status:** `queued · sent · delivered · failed · skipped · opted_out · suppressed · unknown`
- **CRM status:** `inactive_pre_engagement · active · needs_follow_up · watching · presentation_completed · holding_tank · closed`
- **CRM disposition** (VM — note underscore variant vs Group B hyphen variant): `new_ba · new_customer · interested · not_interested · later · no_response · wrong_number · do_not_contact`
- **CRM closed reason:** `enrolled_as_ba · became_customer · not_interested · do_not_contact · expired · duplicate · invalid_contact · admin_closed`
- **Lead lifecycle status** (`vm_bulk_leads`): `imported · validated · suppressed · crm_created · token_created · queued · voicemail_sent · sms_sent · email_sent · link_clicked · activated · info_requested · callback_requested · presentation_started/25/50/75/completed · …`
- **Timeline event kind** (~26): `crm_created · token_created · voicemail_sent · sms_sent · email_sent · link_clicked · activated · info_requested · callback_requested · presentation_started/25/50/75/completed · dashboard_entered · holding_tank · note_added · follow_up_set/cleared · disposition_changed · closed_new_ba/new_customer/not_interested/later · expired · archived · ownership_corrected`

**Reconciliations to close before schema-tightening (P10 §5.3/5.4):**
1. **`vm_bulk_leads` two divergent writers** — `bulkLeads.ts` (`lead_<uuid>`, `VmLeadLifecycleStatus`, mints token+prospect) vs `vmProviderQueue.ts` (`vmlead_<uuid>`, `VmLeadStatus`, dedupe/suppress fields). Different id-prefix + status enum + field-set in one collection → unify or split before a strict schema.
2. **`vm_delivery_events` runtime ≠ typed contract** — writer emits `{eventId, details, dryRun, attempt}`; `VMDeliveryEventRecord` declares `{deliveryEventId, channel, occurredAt, metadata}`. Pick canonical.
3. **CRM disposition — DECIDED (Kevin 2026-07-01): one canonical enum, tmag-flavored.** The two competing enums (hyphen `new-ba` in `CrmDisposition`/`crm_dispositions`; underscore `new_ba` in `ProspectCrmDisposition`/`prospect_crm_records`) are a one-concept-two-names failure — collapse to **ONE** canonical disposition enum, **snake_case**. And **`new_ba` → `new_tmag_member`** (a prospect who enrolls becomes a new **Team Magnificent member**, not a generic "BA"); matching closed-reason **`enrolled_as_ba` → `enrolled_as_tmag_member`**. Canonical set: `new_tmag_member · new_customer · interested · not_interested · later · no_response · wrong_number · do_not_contact`. **This is a code + persisted-data rename** → executes in the governed reconciliation migration (§9), not piecemeal.
4. **4 VM collections lack `@momentum/shared` types**; `vm_suppression_list` shape unconfirmed; `prospect_ownership_corrections` `_id` undetermined (possibly inert) — confirm writers before schema.
5. **Neo4j `BA` label** — `vmSchemas.ts` uses `BA` (not `BrandAmbassador`); the §9 label reconciliation applies here (collapse to the one canonical member label).

---

## 6. MongoDB — Group F · Memory / Learning (Phase 7 — R0–R3)

See `P7_13_SCHEMA_CATALOG` for full detail. Summary:

| Collection | Rung | `_id` | Core (+ membership-scoped app-memory envelope) | Purpose |
|---|---|---|---|---|
| `mcs_audit_log` | R0 | `entryId` | *(shared with Group D)* + `runtime` block | Runtime turn/gate audit (metadata only). |
| `mcs_outcomes` | R1 | `id` | `kind`·`confirmedByBaId`·`outcomeAt` | BA-confirmed outcomes; `enrolled_three` = THREE mirror. |
| `mcs_learning_candidates` | R2 | `id` | `status`·`domain`·`language`·`proposedSummary`·`sourceOutcomeIds[]`·`review?` | Review-only; **no agent may approve**. |
| `mcs_graphrag_records` | R3 | `id` | `knowledgeObjectId`·`version`·`domain`·`language`·`summary`·`model`·`retrievalReady` | Active-knowledge retrieval index. |

App-memory envelope (all): `id·type·schemaVersion·namespace('momentum')·source·createdAt·title·originKind('system')·serviceName·tenantId·teamKey('team_magnificent')` + `baId`(member)·`derivedFrom[]`.

---

## 7. Neo4j — labels, constraints, relationships (~37 labels @7710)

Uniqueness constraint per label on its business key (P10 §6 — none exist in-repo yet). Relationship names are **specific verbs** (no `RELATED`/`CONNECTED_TO`).

### 7.1 Identity / membership graph (the spine)
```
(:BrandAmbassador {baId})            // canonical MEMBER node (BA/BrandAmbassador
                                     //   label split to be reconciled to ONE — P10 §5.1)
(:BrandAmbassador)-[:SPONSORED_BY]->(:BrandAmbassador)   // the downline tree (immutable)
(:BrandAmbassador)-[:MEMBER_OF]->(:TeamMagnificent {teamKey})
(:BrandAmbassador)-[:HOLDS_CODE]->(:AccessCode {code})
(:AccessCode)-[:MINTED_MEMBER]->(:BrandAmbassador)       // code → members it enrolled
```

### 7.2 Prospect / funnel graph
```
(:Prospect {prospectId})-[:SPONSORED_BY]->(:BrandAmbassador)   // immutable
(:Prospect)-[:HAS_TOKEN]->(:InviteToken {token})
(:Prospect)-[:IN_HOLDING_TANK {position}]->(:Pool {id})
(:Prospect)-[:RESERVED_WEBINAR]->(:WebinarEvent {eventId})
(:BrandAmbassador)-[:RESERVED_ORIENTATION {reservationId}]->(:OrientationSession {sessionId})
(:CrmNote)-[:ABOUT]->(:Prospect)     (:CallbackRequest)-[:FROM]->(:Prospect)
```

### 7.3 Business labels (constraint keys)
`Prospect.prospectId · InviteToken.token · AccessCode.code · Pool.id · Questionnaire.questionnaireId · Commitment.commitmentId · Workbook.workbookId · FastStartProgress.progressId · SteveDiscovery.discoveryId · OrientationSession.sessionId · WebinarEvent.eventId · CrmNote.noteId · ProspectCRMRecord.crmRecordId · ProspectAccount.accountId · ProspectMagicLink.linkToken · AdminProspectNote.noteId · SponsorOverride.overrideId · AuditEntry.entryId · AgentEvent.eventId · IvoryName.ivoryId · Broadcast.broadcastId · Tenant.tenantId · TenantSettingsVersion.settingsVersionId · MasterContent.templateKey · MasterContentVersion.templateVersionId · LeadBatch.leadBatchId · VMCampaign.vmCampaignId · BulkLead.leadId · VmQueueJob.jobId · VmAuditEvent.auditId · VmDeliveryEvent.eventId · VmProviderWebhook.webhookEventId`

### 7.4 Memory / learning graph (Phase 7)
```
(:AuditEntry)-[:ACTED_BY|:ACTED_FOR]->(:BrandAmbassador)
(:Outcome {id})-[:CONFIRMED_BY]->(:BrandAmbassador)
(:Outcome)-[:ABOUT_PROSPECT]->(:Prospect)   (:Outcome)-[:SUPERSEDES]->(:Outcome)
(:Outcome)-[:SCOPED_TO]->(:TeamMagnificent)
(:LearningCandidate {id})-[:DERIVED_FROM]->(:Outcome)  -[:SCOPED_TO]->(:TeamMagnificent)
(:Knowledge {id})-[:SCOPED_TO]->(:TeamMagnificent)  -[:SUPERSEDES]->(:Knowledge)
```
**Reconcile before applying:** `BA` vs `BrandAmbassador` (§5.1) and `ProspectCRMRecord` vs `ProspectCrmRecord` casing → pick one each.

---

## 8. ChromaDB — collections (`mcs_`-prefixed, 384-dim all-MiniLM-L6-v2 @8200)

Registry `CHROMA_COLLECTIONS` (26 base + Phase 7). Record: `id`==Mongo `_id`; `document`=short summary; flat `metadata` with `kind` + scope ids + ISO timestamps + `model`/`modelVersion`.

- **Identity/onboarding:** `mcs_access_codes · mcs_commitments · mcs_ba_questionnaires · mcs_ba_workbooks · mcs_steve_discoveries · mcs_training_progress · mcs_brand_ambassadors`(seeder — register)
- **Prospect/funnel:** `mcs_invitations · mcs_callback_requests · mcs_pool_events · mcs_prospect_accounts · mcs_prospect_magic_links · mcs_webinar_reservations · mcs_prospect_crm · mcs_prospect_timeline`
- **Agents/admin:** `mcs_ivory · mcs_agent_events · mcs_audit_log · admin_prospect_notes · audit_log`(sponsor-override mirror) · `mcs_tenant_settings · mcs_master_content · mcs_broadcasts`
- **VM:** `mcs_vm_lead_batches · mcs_vm_leads · mcs_vm_campaigns · mcs_vm_delivery_events`
- **Phase 7 memory:** `mcs_outcomes` · `mcs_learning_candidates_review`(review-only) · 10× `mcs_<domain>_knowledge_<lang>`(active)

---

## 8a. Enum reference (closed sets — code-grounded)

| Enum | Values |
|---|---|
| **Token / prospect state** | `minted · clicked · video_started · video_quarter · video_half · video_three_quarter · video_complete · enrolled · expired` |
| **Prospect callback intent** | `interested_tell_me_more · have_questions · ready_to_join` (`ready_to_join` only on the post-video dashboard) |
| **CRM disposition** | `new-ba · new-customer · interested · not-interested · later` |
| **Workbook status** | `draft · final` |
| **Pool flush reason** | `enrolled · expired · archived` |
| **Outcome kind** (R1) | `webinar_attended · callback_completed · orientation_attended · became_customer · enrolled_three · declined · no_show` |
| **Candidate status** (R2) | `detected · in_review · approved · rejected · superseded` |
| **Learning domain** (R2/R3) | `success · training · relationship · performance · organizational` |
| **Language** | `en · es` |
| **GraphRAG type** (R3) | `graphrag_record · graphrag_chunk` |
| **Runtime audit action** (R0) | `runtime.turn.{opened,draft_emitted,closed} · runtime.gate.{allowed,denied} · runtime.persistence.{enabled,disabled}` |
| **Audit severity** | `info · warn · critical` |
| **Persistence mode** (S1.3) | `gateway · direct` |

---

## 9. Cross-cutting conventions & open reconciliations

**Conventions:** ISO-string timestamps · shared canonical `id` · `additionalProperties:true` first pass → tighten later · direct-mode writes app-direct (ACR-0007).

**Nomenclature (one concept, one name, cased per layer — Kevin):** both camelCase and snake_case are used, **chosen by the software layer** — camelCase for TypeScript / app data / Mongo `momentum`; snake_case for the gateway-memory family / snake-case surfaces (P10 §3.6). The invariant is **consistency**: a concept has exactly ONE canonical name; casing is a deterministic transform of it (`tmagId` ⇄ `tmag_id` = same concept). Never two different names for the same thing (Chat #135 drift class; `DECISION_governed_dedicated_stack_founding_principle` §3.2).

**Naming & concept drift audit:** the full sweep of same-concept-many-names / `ba`-that-means-member / duplicate-enum / handoff-drift findings is in **`organization/FINDING_naming_concept_drift_audit.md`** — the canonical names every new store adopts from birth. Highlights: the member id has **~25 names** (→ `tmagId`/`<role>TmagId`); a **registration-handoff state machine** (`AdminProspectRegistrationHandoffState`) contradicts the mandatory no-handoff rule; two aliased duplicate types; overlapping funnel-event enums.

**Open reconciliations (P10 §5 — fix before tightening):**
1. Neo4j `BA` vs `BrandAmbassador` → one canonical **member** label (per membership decision).
2. `ProspectCRMRecord` vs `ProspectCrmRecord` casing.
3. `vm_bulk_leads` two divergent writers; `vm_delivery_events` runtime ≠ typed contract.
4. Delivery-timestamp drift (`smsDeliveredAt`/`emailDeliveredAt` written but untyped).
5. 4 VM collections lack shared types; `vm_suppression_list` shape unconfirmed.
6. `_id`=natural-key standardization for `prospects`/`invitation_activity`/`agent_events` (auto-ObjectId today).

**Deferred (membership decision §5):** app-wide reidentification — includes the **`tmag` rename** (`tm*`→`tmag*` field names, `TMBA-`→`TMAG-` id values, `TM-XXXX`→`TMAG-XXXX` codes across all 49 collections + auth/`ADMIN_BA_IDS`) **and** membership-eligibility enforcement (verify III enrollment + downline before granting membership) — one governed migration, not piecemeal.

---

## 10. Nothing here is applied

This catalog is the review surface. Applying schemas/constraints/validators to the stores is per-store, per-collection, reversible, and Kevin-approved (see `P7_12` for the Phase 7 apply order; `P10` §8 for the app-data rollout). Fields can be added/changed under governance; this catalog is the baseline to change against.
