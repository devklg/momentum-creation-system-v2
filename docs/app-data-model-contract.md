# MCS Application Data-Model Contract

> Scope: the **application** data of the Momentum Creation System — Brand
> Ambassadors, prospects, the holding-tank/genealogy, Michael, onboarding,
> CRM, Ivory, content, broadcasts, audit, and operational records.
>
> This is the app-side companion to `docs/graphrag-schema-contract.md` (which
> governs only the external MCP tooling memory/knowledge layer). Where that file
> governs *memory*, this file governs the *business records the app writes*.
>
> Status: **DRAFT for Kevin's approval.** It documents the current real state
> (grounded in code + live DB introspection) and the target model. The
> architectural decision in §2 needs Kevin's explicit sign-off before the
> cleanup in §4 is executed.

## 1. Why this exists

The app's data model grew implicitly, one build chat at a time, written
directly in `server/src/domain/*` and `packages/shared/src/types.ts`. There
has never been a single deliberate pass over the whole model: one source of
truth per entity, one naming convention, one id strategy, the right indexes,
and a clear statement of which store owns what.

The cost of not doing that is already visible in the live databases (§4). The
reason to do it **now** is timing: the application collections are essentially
empty (`brand_ambassadors` holds 2 test rows; the app barely registers in
Neo4j against 45,422 memory `Document` nodes; every `mcs_*` Chroma collection
is an empty stub with `dimension: null`). Fixing the model today is a rename.
Fixing it after 50 BAs and real prospect/interview data have landed is a
migration. This contract is meant to be settled before real data exists.

## 2. The integrity model (grounded in the code, not inferred)

### 2.0 What the write path actually does today (verified)

Every domain write goes through one wrapper: `server/src/services/tripleStack.ts`
(it does NOT call `QuadStackConnector` directly). Reading that file:

- **MongoDB is written first, always, unconditionally.**
- **Neo4j is optional** — runs only `if (input.neo4j)` is passed.
- **ChromaDB is optional** — runs only `if (input.chroma)` is passed.
- The three run **sequentially, fail-fast, and are NOT atomic.** If Mongo
  commits and a later leg throws, you get a Mongo row with no edge/embedding
  **and** an error to the caller, with **no rollback and no retry.** The header
  comment "No DB is optional" is stale relative to the actual signature.

So the app is *already* MongoDB-authoritative with optional projections. The
real decision is therefore **not** "Mongo-first vs quad-write" — it's the
**failure/consistency policy** per record, and the missing machinery is
**rollback (for membership) and durable retry (for knowledge).** Neither exists
in the helper today.

### 2.1 Why one global policy is wrong

This app is a tool that **trains and sponsors** via three agents — **Ivory**
(sponsorship coach), **Steve** (Discovery + non-scored Success Profile),
**Michael** (daily success coach), and the
**training agent** (Fast Start concierge). Those agents *reason over the graph
and the knowledge layer* to coach. So the integrity bar is set by a single
test, applied to every write:

> **Would Michael, Ivory, or the training agent give bad advice if this record
> half-wrote?**

If yes, the projection is not "best-effort" — it is part of the record's
correctness. That yields three tiers.

### 2.2 The three tiers

**Tier 1 — Graph-critical (membership + agent-reasoned relationships).**
BA + `UPLINE_IS` sponsor edge; prospect + sponsor edge; Ivory roster edges and
Ivory→Prospect conversion links. Rule: **Mongo + Neo4j atomic — both land or
the write rolls back.** The sponsor/target node **must pre-exist** (`MATCH`, not
`MERGE` — a phantom sponsor is forbidden). Canonical vocabulary only
(`BrandAmbassador`, `UPLINE_IS`). Rationale: membership *is* the edge — a BA
with no sponsor edge does not "belong yet," so a BA row without its edge is a
broken record, not a lagging one. Ivory walks these edges to coach, so they must
be true.

**Tier 2 — Knowledge-critical (what the agents learn from).**
Michael interview **including the full transcript**, master content, CRM notes,
and the BA's behavioral trail (invites, watches, callbacks, Fast Start). Rule:
**Mongo authoritative; projection to Neo4j/Chroma is MANDATORY via durable retry
until it lands; alert if it cannot.** Rationale: for these, the graph/vectors
*are* the deliverable — a record in Mongo but not in the knowledge layer is
invisible to the very agent meant to coach from it. The interview transcript is
the worked example (see §5D + §7): it must be chunked, embedded, graph-linked,
and access-gated, because it is the foundation the what/why/how of training
grows from.

**Tier 3 — Operational.**
Callbacks, fast-start ticks, webinar/orientation reservations, audit rows.
Rule: **Mongo-commit-is-success; projections retry but never block the user.**
A lagging operational projection is never data loss.

### 2.3 Store roles under this model

| Store | Role |
|---|---|
| **MongoDB** | Source of truth for every record, in full. Always written. |
| **Neo4j** | Derived graph. For Tier 1, co-required and atomic with Mongo. For Tier 2/3, durable-retry projection. Carries relationships, not full documents. |
| **ChromaDB** | Derived search. Only the four collections that earn it (§7). Tier-2 writes retry until they land; never auto-created empty stubs. |
| **SurrealDB** | Not a source of truth, not in the launch write path. No fact lives only here. |

### 2.4 What this requires of the shared helper (the one real build)

Replace fire-once `tripleStackWrite` with a tiered writer:
- `tier: 'graph_critical'` → Mongo+Neo4j in one unit; on Neo4j failure, **roll
  back the Mongo insert** (or write Neo4j-first so its failure aborts before
  Mongo commits); `MATCH` required nodes.
- `tier: 'knowledge'` → Mongo commit = success boundary; enqueue Neo4j/Chroma
  projection to a **durable retry queue**; alert on exhaustion.
- `tier: 'operational'` → Mongo commit = success; projections retry, non-urgent.
- **All tiers read the write back to verify it landed** (the "verify, don't
  assume" rule, §4A). One fix here; every caller inherits it.

> **DECIDED (Kevin, this session): the three-tier integrity model above is
> LOCKED.** It is not a re-architecture — the app is already Mongo-first; this
> finishes the failure policy the code left open and makes the three agents
> trustworthy to coach on. Implementation lives in the §13 finish-work queue.

## 3. Canonical conventions

1. **One app database: `momentum`.** All app collections live here. The
   hyphen/underscore duplicate *databases* (`team-magnificent` vs
   `team_magnificent`, `external-mcp-tooling` vs `agent_operations`, etc.) are
   memory/infra-layer drift, frozen by the GraphRAG contract's non-destructive
   rule — out of scope here, leave them.
2. **Collection names: bare `snake_case`, singular-domain plural** (e.g.
   `brand_ambassadors`, `michael_interviews`). **No `mcs_` prefix in Mongo.**
   The `mcs_` prefix is reserved for *Chroma* collections only (where it is a
   useful namespace against the shared Chroma instance).
3. **One canonical id per entity**, carried as both the Mongo `_id` and a
   named id field (`baId`, `prospectId`, …) so application code never depends
   on `_id` directly. When an entity is projected to Neo4j/Chroma, the **same
   id value** is the node `id` / Chroma document id. This is the same
   id-stitching rule the GraphRAG contract uses, applied to app data.
4. **Timestamps: ISO-8601 UTC strings ending in `Z`** (`IsoTimestamp`). No
   `Date` objects, no epoch ints, no `start_time`/`date` aliases. Event time
   and write time are distinct fields when both matter (see `audit_log`).
5. **Sponsor immutability (locked-spec 3.5) is a schema invariant, not just a
   route rule.** `sponsorBaId` is stamped from the authed session or the
   resolving token, never from a request body, and is never updated except
   through an audited admin override.
6. **Compliance fields carry no earnings/rank/placement claims** (locked-spec
   3.10/3.11). Current architecture: Steve creates the non-scored Success
   Profile; Michael records training/daily-success context only. No BA classification
   is computed or displayed.
7. **Append-only collections never update or delete**: `audit_log`,
   `crm_notes`, `invitation_activity`, `broadcast_optouts`.

## 4. Drift found in the live system + cleanup (do now, while empty)

Grounded in live introspection on the date of writing:

| Drift | Evidence | Action (safe now — near-zero data) |
|---|---|---|
| Duplicate audit collections | `audit_log` **and** `mcs_audit_log` both exist in `momentum` | Keep `audit_log`. Drop `mcs_audit_log`. Point all writers at `audit_log`. |
| Empty Chroma stubs | All 20 `mcs_*` Chroma collections have `dimension: null` (never written) | Drop the stubs. Recreate (with real embeddings) only the four that earn search (§7). Stop the boot-time "assert all collections" routine. |
| Mongo-vs-Chroma name split | Code references `mcs_access_codes` etc. that only ever existed as Chroma stubs | Lock the rule: Mongo bare, Chroma `mcs_`. Remove dead `mcs_*` Mongo references in code. |
| Neo4j label overlap | Both `BA` and `BrandAmbassador` appear as labels | Canonical label is **`BrandAmbassador`**. Retire `BA`. |
| Legacy memory labels live | `ClaudeSession` (772), `PersistedSession` (87), `Chat` (63) coexist with `Conversation` | Memory-layer concern, governed by the GraphRAG contract — noted here only so it isn't mistaken for app drift. |
| Stray probe collection | `_seed_probe` in `momentum` | Drop it. |
| Legacy app DB | `momentum_creation_system` (188 KB) separate from `momentum` | Confirm it's v1 leftover, then leave frozen (non-destructive rule) or archive on Kevin's word. |

Note: `session_handoffs` exists in `momentum` **and** is the canonical memory
record in `agent_operations`. Per your standing rule the canonical query
targets `agent_operations.session_handoffs`; the `momentum` copy is drift and
should not be written to by app code.

## 5. Entity catalog

Every entity below: **Mongo collection** (source of truth) + canonical id +
stored field set (grounded in `types.ts` / `domain/*`) + Neo4j projection +
Chroma projection + indexes + invariants. "Project: no" means Mongo-only — the
default. Only entities that earn a graph edge or a semantic search are projected.

### 5A. Identity & access

**`brand_ambassadors`** — the core user. Source: `domain/ba.ts:BARecord`.
- id: `baId` (= `_id`); also `threeBaId`, `threeUsername`.
- fields: `firstName, lastName, email, phone, timezone, passwordHash`(argon2), `sponsorBaId, sponsorThreeBaId, accessCodeUsed, createdAt, lastLoginAt`.
- Neo4j: **yes** — `(:BrandAmbassador {baId})`, `(:BrandAmbassador)-[:UPLINE_IS]->(:BrandAmbassador)` (downline→sponsor). Genealogy spine.
- Chroma: no. indexes: unique `baId`, unique `email`, unique `threeBaId`, index `sponsorBaId`, index `lastLoginAt`.
- invariants: `sponsorBaId` immutable except via audited override; `passwordHash` never leaves server; founders have `sponsorBaId=null`.

**`access_codes`** — sponsor invite codes. Source: `domain/access-codes.ts:AccessCodeRecord`.
- id: `code`(=`_id`, e.g. `TM-01`). fields: `sponsorBaId, sponsorThreeBaId, sponsorFirstName, sponsorLastName, active, createdAt`.
- indexes: unique `code`, index `sponsorBaId`, index `active`. invariant: one code per BA for life (2.3), immutable.

**`prospect_accounts`** — re-entry. Source: `types.ts:ProspectAccountRecord`.
- id: `accountId`. fields: `prospectId, tokenId, sponsorBaId, phone|null, reentryCode`(6-char), `createdAt, expiresAt, lastLoginAt`.
- indexes: unique `accountId`, index `prospectId`, index `reentryCode`, index `phone`, sweep `expiresAt`. invariants: `sponsorBaId`/`tokenId` immutable (3.5); `phone` null until consent.

**`prospect_magic_links`** — SMS login. Source: `types.ts:ProspectMagicLinkRecord`.
- id: `linkToken`. fields: `accountId, tokenId, issuedAt, expiresAt`(+15min), `redeemedAt|null, requestPhoneHash`(SHA-256). indexes: unique `linkToken`, index `accountId`, sweep `expiresAt`. invariant: single-use; never store raw phone.

**`prospect_sessions`** — prospect web sessions. Mongo only. id `sessionId`, index `accountId`, sweep `expiresAt`.

**`profile_change_challenges`** — email/phone OTP. Source: `types.ts:ProfileChangeChallengeRecord`.
- id: `challengeId`. fields: `baId, channel, target, codeHash`(SHA-256), `issuedAt, expiresAt, redeemedAt, deliveryStatus, deliveryError`. indexes: unique `challengeId`, index `baId`, sweep `expiresAt`. invariant: never store raw code; single-use.

### 5B. Prospect funnel (.com)

**`prospects`** — invited people. Source: `types.ts:ProspectRecord`.
- id: `prospectId`. fields: `firstName, lastName, lastInitial, location{city,stateOrRegion,country}, phone|null, email|null, sponsorBaId, state(TokenState), positionNumber|null, placedAt, becameCustomer, becameCustomerAt, customerNote, createdAt, updatedAt, expiresAt`.
- Neo4j: **yes** — `(:Prospect {prospectId})-[:SPONSORED_BY]->(:BrandAmbassador)`, and once placed `(:Prospect)-[:PLACED_IN]->(:Pool)`. (Consolidate the live ad-hoc `ENROLLED`/`ROUTED_TO`/`RECORDED_PROSPECT_ACTIVITY` edges into these deliberate ones.)
- Chroma: no. indexes: unique `prospectId`, index `sponsorBaId`, index `state`, index `expiresAt`, sparse-unique `positionNumber`, index `phone`.
- invariants: `sponsorBaId` immutable (3.5); `positionNumber` monotonic, never reshuffled (3.2); lazy-flush on read when `expiresAt` past.

**`invite_tokens`** — the /p/{token} credential. Source: `types.ts:InviteTokenRecord`.
- id: `token`(12-char alphabet, no 0/1/I/O/L). fields: `prospectId, sponsorBaId, state, createdAt, clickedAt, expiresAt`. indexes: unique `token`, index `prospectId`, index `sponsorBaId`. invariant: `sponsorBaId` immutable.

**`invitation_activity`** — append-only timeline. Source: `types.ts:InvitationActivityEntry`.
- id: `activityId`. fields: `prospectId, sponsorBaId, kind, note, at`. indexes: index `prospectId`, `sponsorBaId`, `at`. invariant: append-only.

**`callback_requests`** — raised-hand. Source: `types.ts:CallbackRequestRecord`.
- id: `callbackRequestId`. fields: `token, prospectId, sponsorBaId, intent, createdAt, smsDeliveryStatus, smsDeliveryError`. indexes: index `prospectId`, `sponsorBaId`, `createdAt`. invariant: many-per-prospect; not a lifecycle state.

**`webinar_events`** — Source: `types.ts:WebinarEvent`. id `eventId`; fields `scheduledFor, hosts[], zoomUrl|null, durationMinutes, status, createdAt`. indexes: `scheduledFor`, `status`.

**`webinar_reservations`** — Source: `types.ts:WebinarReservationRecord`. id `reservationId`; fields `eventId, token, prospectId, sponsorBaId, name, email, createdAt, email/smsDeliveryStatus+Error`. indexes: `eventId`, `prospectId`, `sponsorBaId`. invariant: `sponsorBaId` from token (3.5).

### 5C. Pool & genealogy

**`pool_placements`** — the one team-wide holding tank (Chat #84). Source: `types.ts:PoolPlacement` + `domain/holdingTank.ts`.
- id: `prospectId` (one active per prospect). fields: `sponsorBaId, positionNumber, placedAt, expiresAt, flushedAt|null, flushReason`.
- Neo4j: **yes** — `(:Prospect)-[:PLACED_IN {positionNumber}]->(:Pool {poolId:'team'})`, single shared pool node.
- indexes: unique `prospectId`, unique `positionNumber`, index `sponsorBaId`, index `expiresAt`, index `flushedAt`. invariants: positions monotonic, never reshuffle; flush preserves the vacated number.

**`pool_counters`** — monotonic allocator. id fixed key `team`; field `nextPosition`(int). Atomic `$inc` source for `positionNumber`. invariant: never decremented.

### 5D. Michael (voice interview)

**`michael_schedules`** — one per BA. Source: `domain/michael-schedule.ts:MichaelSchedule`.
- id: `_id`(one per BA) + `baId`. fields: `status, slotStartUtc|null, slotEndUtc|null, timezone|null, rescheduleCount(≤1), signupAt, scheduledAt, startedAt, completedAt, callSid|null`. indexes: unique `baId`, index `status`, `slotStartUtc`. invariant: reschedule capped at 1.

**`michael_interviews`** — completed artifact. Source: `types.ts:MichaelInterviewArtifact`.
- id: `baId`(one per BA). fields: `sponsorBaId|null, callSid, startedAt, completedAt, transcript[]{sequence,speaker,text,occurredAt}, answers[]{questionId,prompt,answerText,scoringTags[]}, scoring{overallTone,highlightTags[],signedBy}, audioUrl|null`.
- Neo4j: optional — `(:MichaelInterview {baId})-[:INTERVIEW_OF]->(:BrandAmbassador)` only if graph queries need it.
- Chroma: **yes** — `mcs_michael_interviews`, embed transcript/answer text (384-dim, GPU service). One of the four real Chroma uses.
- indexes: unique `baId`, index `sponsorBaId`, `completedAt`. invariants: `sponsorBaId` stamped server-side from BA record at ingest (3.5); no new classification is computed; worker auth via `MICHAEL_WORKER_SECRET`.

**`michael_founder_handoffs`** — Legacy collection from the retired scored-Michael path. New Michael ingests do not create classified founder handoffs. Human orientation/Launch Center readiness should read Steve Success Profile + Michael completion state instead.

### 5E. Onboarding (sponsor-led)

**`ba_workbooks`** — 20-Q sponsor interview. Source: `domain/workbook.ts:WorkbookRecord`. id `workbookId`; fields `forBaId, forThreeBaId, conductedByBaId, conductedByName, status('draft'|'final'), version, notes{q1..q20}, classification('gogetter'|'consumer'|null), firstActions[], partnershipNotes, createdAt, updatedAt, finalizedAt`. indexes: unique `workbookId`, index `forBaId`, `conductedByBaId`. (Not yet created — lock name now.)

**`ba_questionnaires`** — BA self-submission. Source: `domain/questionnaire.ts:QuestionnaireRecord`. id `questionnaireId`; fields `baId, threeBaId, version, submittedAt, ipAddress, userAgent` + body (`employmentStatus, biggestWin, whyNow, productStatus, incomeGoal, weeklyHours, coachabilityTest, nwmExperience, investmentReady, …`). indexes: unique `questionnaireId`, index `baId`, `submittedAt`.

**`ba_commitments`** — agreement acceptance. Source: `domain/commitments.ts:CommitmentRecord`. id `commitmentId`; fields `baId, threeBaId, email, version, acceptedAt, ipAddress, userAgent`. indexes: unique `commitmentId`, index `baId`. invariant: append-only legal record.

**`fast_start_progress`** — 5 modules. Source: `types.ts:FastStartProgressRecord`. id `_id=${baId}__${moduleId}`; fields `baId, moduleId(1..5), state, startedAt, completedAt, updatedAt, createdAt`. indexes: unique `_id`, index `baId`. (Not yet created — lock name `fast_start_progress`.)

**`orientation_sessions`** — Source: `types.ts:OrientationSession`. id `sessionId`; fields `scheduledFor, hosts[], capacity(=10), durationMinutes, joinUrl|null, status, createdAt`. indexes: `scheduledFor`, `status`.

**`orientation_reservations`** — Source: `types.ts:OrientationReservationRecord`. id `reservationId`; fields `sessionId, baId, baName, scheduledFor, status('reserved'|'cancelled'), createdAt, cancelledAt, smsDeliveryStatus, smsDeliveryError`. indexes: `sessionId`, `baId`. invariant: cancel flips status (roster history kept); enforce `capacity`.

### 5F. CRM (BA-private)

**`crm_notes`** — append-only notes. Source: `types.ts:CrmNoteRecord`. id `noteId`; fields `prospectId, sponsorBaId, text, createdAt`. indexes: index `prospectId`, `sponsorBaId`. Chroma: **yes** — `mcs_crm_notes`, embed `text` for cross-prospect recall. invariant: append-only; BA-private (filter `sponsorBaId`).

**`crm_followups`** — one active per (prospect,BA). Source: `types.ts:CrmFollowUpRecord`. fields `prospectId, sponsorBaId, dueAt, createdAt, clearedAt|null`. indexes: index `sponsorBaId`, `dueAt`. invariant: latest-wins; clearing keeps the row (audit).

**`crm_dispositions`** — latest tag per (prospect,BA). Source: `types.ts:CrmDispositionRecord`. fields `prospectId, sponsorBaId, disposition(CrmDisposition), updatedAt`. indexes: index `prospectId`, `sponsorBaId`. invariant: only latest matters.

### 5G. Ivory & Generator

**`ivory_names`** — BA-private "who do you know" roster. Source: `types.ts:IvoryName`. id `ivoryId`; fields `baId, firstName, lastName, lastInitial, notes, categories[], preferredAngle, status(IvoryStatus), lastProspectId|null, lastTouchedAt, createdAt, updatedAt`. indexes: unique `ivoryId`, index `baId`, `status`. Chroma: **yes** — `mcs_ivory`, embed name+notes for "who fits this product" recall. invariant: BA-private; status transitions BA-driven (Ivory is a coach, not a scorer).

**`generator_runs`** — batch invite generation. Source: `types.ts:GeneratorRun`. id `runId`; fields `baId, productKey, productName, angle, selectedIvoryIds[], invitations[]{ivoryId,prospectId,token,inviteUrl,createdAt}, createdAt, updatedAt`. indexes: unique `runId`, index `baId`.

### 5H. Content & tenant

**`master_content_versions`** — the F.5 content-override store. Source: `shared/tenant.ts:TenantTemplateVersion`. id `templateVersionId`; fields `tenantId, templateKey, surface, label, content, version, source('code_default'|'master_override'), createdAt, createdBy, reason`. indexes: index `templateKey`, `tenantId`, `version`. Chroma: **yes (optional)** — `mcs_master_content` if Kevin wants semantic lookup over templates; otherwise skip. invariant: versioned, append-only; resolution is code-default → master-override.

**`tenant_settings`** (+ versions) — Source: `shared/tenant.ts:TenantSettings`/`TenantSettingsVersion`. id `tenantId` (settings) / `settingsVersionId` (versions). fields `tenantName, publicComDomain, teamDomain, adminDomain, complianceMode('fail_closed'), contentInheritanceMode, updatedAt, updatedBy` (+ `version, reason, createdAt` on versions). indexes: unique `tenantId`, index `settingsVersionId`. Single tenant today; the model is multi-tenant-ready.

**`admin_settings`** — operational key/value admin config. Mongo only. id = setting key. Keep small; not graph/search.

### 5I. Broadcast (Kevin-only, BA-facing)

**`broadcasts`** — Source: `shared/broadcast.ts:BroadcastRecord`. id `broadcastId`; fields `createdByBaId, createdByDisplayName, createdAt, isTestSend, audiencePreset, customAudienceBaIds|null, channel, template{smsText,emailSubject,emailText}, recipientCount, status('queued'|'sending'|'complete'|'failed'), completedAt`. indexes: index `createdByBaId`, `status`, `createdAt`.

**`broadcast_recipients`** — Source: `shared/broadcast.ts:BroadcastRecipientRow`. id `rowId=${broadcastId}::${recipientBaId}`; fields `broadcastId, recipientBaId, recipient{FullName,FirstName,Email,Phone}, channel, smsRendered|null, emailSubjectRendered|null, emailTextRendered|null, status, smsMessageId, emailMessageId, failureReason, attempts, queuedAt, startedAt, finishedAt`. indexes: index `broadcastId`, `recipientBaId`, `status`. invariant: rendered text stored per-recipient (audit of exactly what was sent).

**`broadcast_optouts`** — append-only STOP list. Source: `shared/broadcast.ts:BroadcastOptoutRow`. id `baId`; fields `reason('stop_keyword'|'kevin_added'), addedAt, sourcePhone|null, note|null`. indexes: unique `baId`. invariant: global, append-only; filtered out of every audience preset server-side.

### 5J. Audit & operational

**`audit_log`** — the append-only substrate (canonical; retire `mcs_audit_log`). Source: `types.ts:AuditLogEntry`. id `entryId=audit_<ISO>_<rand>`; fields `timestamp(event), createdAt(write), role, actor(discriminated), action('domain.entity.action'), entity{kind,id,displayLabel}, severity('info'|'warn'|'critical'), before|null, after|null, reason|null, context|null, linkedTranscriptId|null`. indexes: index `timestamp`, `severity`, `actor` id, `entity.id`, `action`. invariant: append-only; `reason` REQUIRED on `critical` (locked-spec 2.4). `critical` feeds the admin "needs Kevin" widget.

**`agent_status`** — live-ops agent/worker heartbeats. Mongo only; small; index by agent id + `updatedAt`.

**`work_queue` / `work_queue_leaves`** — internal build/work-queue state. Mongo only; operational, not graph/search.

**`decisions`** — the app-side decision ledger (distinct from the external tooling memory `decisions`). id `decisionId`; index `createdAt`. Keep, but confirm it isn't duplicating the memory-layer decision store.

## 6. Neo4j graph model (derived) + the drift to fix

### 6.1 Canonical labels (one vocabulary)

Resolve the `:BA` vs `:BrandAmbassador` split by standardizing on
**`:BrandAmbassador`** — it is the label the newest files already use
(`training.ts`, `auditLog.ts`, `broadcast.ts`).

- `(:BrandAmbassador {baId, threeBaId, firstName, lastInitial, sponsorBaId, createdAt})`
- `(:Prospect {prospectId, firstName, lastInitial, state, positionNumber})`
- `(:Pool {poolId:'team'})` — the single shared holding tank
- `(:IvoryName {ivoryId, baId})`, `(:MichaelInterview {interviewId})`,
  `(:FastStartProgress {progressId})`, `(:AccessCode {code})`,
  `(:OrientationSession {sessionId})`, `(:Broadcast {broadcastId})`,
  `(:AuditEntry {entryId})`

### 6.2 Canonical relationships (specific verbs; pick one name each)

- `(:BrandAmbassador)-[:UPLINE_IS]->(:BrandAmbassador)` — sponsor chain. **LOCKED:**
  `UPLINE_IS` is canonical (matches the 210 live edges). `ba.ts` must change its
  `SPONSORED_BY` write to `UPLINE_IS`.
- `(:Prospect)-[:SPONSORED_BY]->(:BrandAmbassador)` — **LOCKED:** the prospect→
  sponsoring-BA fact is `SPONSORED_BY`. `invitations.ts`'s `INVITED` is the same
  fact reversed; drop it as a relationship (keep the invite as activity only) so
  the sponsorship fact lives on exactly one edge.
- `(:Prospect)-[:IN_HOLDING_TANK {positionNumber, placedAt}]->(:Pool)` — **LOCKED:**
  `IN_HOLDING_TANK` is canonical (it is what `holdingTank.ts` writes). `PLACED_IN`
  is retired from this contract.
- `(:InviteToken)-[:FOR_PROSPECT]->(:Prospect)`
- `(:BrandAmbassador)-[:HAS_FOLLOWUP|:DISPOSED]->(:Prospect)` — CRM edges.
- `(:BrandAmbassador)-[:USES]->(:AccessCode)`
- `(:BrandAmbassador)-[:RESERVED_ORIENTATION {reservationId}]->(:OrientationSession)`
- `(:BrandAmbassador)-[:HAD_MICHAEL_INTERVIEW]->(:MichaelInterview)` and
  `(:MichaelInterview)-[:VISIBLE_TO_SPONSOR]->(:BrandAmbassador)` — the latter
  must be **enforced at read** (access gate), not decorative.
- `(:BrandAmbassador)-[:HAS_PROGRESS]->(:FastStartProgress)`
- `(:BrandAmbassador)-[:READY_FOR_HANDOFF]->(:MichaelFounderHandoff)`
- `(:Broadcast)-[:SENT_BY]->(:BrandAmbassador)`, `(:AuditEntry)-[:ACTED_BY]->(:BrandAmbassador)`

### 6.3 `MATCH`, not `MERGE`, for nodes that must pre-exist

The membership rule (§2.2 Tier 1): a sponsor/BA the edge attaches to must
already be a member. Today these write `MERGE (b:BA {baId})`, which **invents a
phantom node** if the sponsor is missing/typo'd. Change to `MATCH` (or
`OPTIONAL MATCH` + guard, the pattern `auditLog.ts`/`broadcast.ts` already use)
so a bad sponsor fails loudly instead of corrupting the tree.

### 6.4 The drift, located (must-fix before launch)

`:BA` (WRONG) appears in: `ba.ts`, `invitations.ts`, `callbackRequest.ts`,
`crm.ts` (multiple), `codeGen.ts`, `orientationSession.ts`,
`michael-founder-handoff.ts`, `michaelScoring.ts`.
`:BrandAmbassador` (RIGHT) in: `training.ts`, `auditLog.ts`, `broadcast.ts`.
Fix the first group to match the second. Same pass: replace phantom-`MERGE`
sponsors with `MATCH`, and reconcile `SPONSORED_BY`/`UPLINE_IS` and
`IN_HOLDING_TANK`/`PLACED_IN` to one name each.

Node `id` always equals the Mongo canonical id. Constraints: unique on
`BrandAmbassador.baId`, `Prospect.prospectId`, `IvoryName.ivoryId`,
`MichaelInterview.interviewId`. The graph carries relationships, not full
documents.


## 7. ChromaDB model (derived — only four collections)

Embeddings come from the GPU service at `localhost:8300` (384-dim). Create a
Chroma collection **only** where free-text semantic search has real value:

1. `mcs_michael_interviews` — transcripts + answers
2. `mcs_crm_notes` — BA notes about prospects
3. `mcs_ivory` — the who-do-you-know roster (name + notes + categories)
4. `mcs_master_content` — templates (optional; only if Kevin wants it)

Everything else stays out of Chroma. **Delete the ~20 empty `mcs_*` stubs** and
stop the boot-time "assert every collection" routine that created them. Each
doc id equals the Mongo canonical id; metadata carries `{id, type, baId or
prospectId, sponsorBaId, createdAt}` for filtered search. A Chroma write that
fails is logged and retried — it never blocks the Mongo write.

## 8. SurrealDB

Not a source of truth and not in the launch write path. It stays available for
experiments, but no app fact may live only in Surreal. If a future feature
wants it as a primary store, that's a new decision recorded here first.

## 9. Day-one indexes (create before real data lands)

Unique: `brand_ambassadors.baId`, `.email`, `.threeBaId`; `access_codes.code`;
`prospects.prospectId`; `invite_tokens.token`; `pool_placements.prospectId`,
`.positionNumber`; `michael_schedules.baId`; `michael_interviews.baId`;
`prospect_accounts.accountId`; `prospect_magic_links.linkToken`;
`broadcast_optouts.baId`; `fast_start_progress._id`.

Lookup: `prospects.sponsorBaId`, `.state`, `.expiresAt`;
`brand_ambassadors.sponsorBaId`, `.lastLoginAt`; `*.prospectId` on
callback/webinar/crm/invitation_activity; `audit_log.timestamp`, `.severity`;
`crm_followups.dueAt`. (Mongo creates collections lazily — add these in a
single idempotent `ensureIndexes()` run at boot.)

## 10. Migration / enforcement plan

Mirrors the GraphRAG contract's phased approach, but most of it is free now
because the collections are near-empty:

1. **Approve §2** (Mongo-authority model). Nothing else proceeds without it.
2. **Cleanup pass** (§4): drop `mcs_audit_log`, `_seed_probe`, the empty Chroma
   stubs; stop the boot-time triple-stack assertion; fix `BA`→`BrandAmbassador`.
3. **Lock names** for the not-yet-created collections (`ba_workbooks`,
   `ba_questionnaires`, `ba_commitments`, `fast_start_progress`, `broadcasts`,
   `broadcast_recipients`, `broadcast_optouts`) so first write lands clean.
4. **`ensureIndexes()`** at boot (§9).
5. **One write path**: a thin `writeEntity(mongo) → projectGraph() →
   projectChroma()` helper replaces scattered triple-stack calls; projection
   failures log + retry, never block.
6. **Seed the real founder genealogy** (Kevin + the access-code tree) so
   `UPLINE_IS` is correct from the first BA.

## 11. Decisions (resolved this session)

1. **Integrity model (§2): LOCKED** — three-tier (graph-critical / knowledge /
   operational); Mongo-authoritative, rollback for Tier 1, durable retry for
   Tier 2.
2. **Canonical graph names (§6.2): LOCKED** — `UPLINE_IS` (BA→sponsor),
   `SPONSORED_BY` (prospect→BA), `IN_HOLDING_TANK` (prospect→Pool).
3. **Chroma scope (§7): LOCKED** — keep the four collections, including
   `mcs_master_content`.
4. **`decisions` collection: KEEP (verified by read).** `momentum.decisions`
   holds 30 real project-decision records with supersession tracking (e.g.
   `dec_flush_adaptive`→`dec_flush_fixed`); `agent_operations.decisions` is
   empty. Not a duplicate — it is the project decision ledger. Keep as-is.
5. **`momentum_creation_system` legacy DB: leave frozen** (non-destructive
   rule); revisit/archive later on Kevin's word.
6. **§4 cleanup timing: run now** (near-zero data) — approved in principle.
   BOUNDARY: the actual drops (`mcs_audit_log`, `_seed_probe`, the empty `mcs_*`
   Chroma stubs) are destructive and will be executed only on Kevin's explicit
   per-action go, since they remove collections.

## 12. A-vs-B reconciliation (what the code says vs. what it does)

Verified by reading each file this session. "A" = the intent the comments/names
claim; "B" = the actual behavior. This table exists so the gap is never
rediscovered one file at a time.

| Surface | A (described) | B (built) | Evidence |
|---|---|---|---|
| **Registration** (`ba.ts`) | BA joins the membership tree with a sponsor edge | Writes `:BA` not `:BrandAmbassador`; `MERGE` invents phantom sponsor; Mongo-then-Neo4j fire-once — can orphan a BA with no edge | `ba.ts` ~205 `MERGE (s:BA)...MERGE (n)-[:SPONSORED_BY]->(s)` |
| **Ivory** (`ivory.ts`) | LLM coach that walks a live graph; voice from master content | Coach LIVE (key set); create fire-once; **updates are separate Mongo-then-Neo4j (desync)**; coaching voice **inert until Wave 2** | `ivory.ts` 317/337 split update; `readMasterContent('team.ivory.coach_prompt')` |
| **Michael Training Agent + Daily Success Coach artifact** (`michaelScoring.ts`) | Launch transcript/context feed GraphRAG; sponsor-stamped; no classification | `sponsorBaId` correctly server-stamped; idempotent; retired score inputs ignored; BUT `:BA` drift; **transcript Mongo-only, never embedded** (only 500-char summary to Chroma); re-ingest silently skips Chroma | `michaelScoring.ts` artifactCypher `MERGE (b:BA)`; `appendTranscriptChunk` "Mongo only"; `mirrorArtifactToGraphAndChroma` skips Chroma |
| **Michael handoff** (`michael-founder-handoff.ts`) | Durable founder queue + dormant-safe dispatch | Dispatch well-built; idempotent; BUT `:BA` MERGE; update path desync; `getFounderRecipients` failure aborts before persist | `michael-founder-handoff.ts` handoffCypher `MERGE (b:BA)` |
| **Training** (`training.ts`) | Per-BA Fast Start trail, feeds the training agent | BEST FILE — real writes, forward-only, idempotent, **correct `:BrandAmbassador`**; same fire-once + phantom-MERGE gap; `fast_start_progress` empty only because no BA has run | `training.ts` `MERGE (b:BrandAmbassador)` |
| **Master content** (`masterContent.ts`) | Agents read copy via `code default → master override` | Read leg exists w/ good fallback; **consumers still read hardcoded defaults — saved overrides functionally inert** until Wave 2 rewires | `masterContent.ts` header: "a saved override is functionally inert" |
| **CRM** (`crm.ts`) | BA-private notes/followups/dispositions on the graph | Notes triple-stack; **followup/disposition updates Mongo-then-separate-Neo4j (most desync-prone surface)**; `:BA` drift throughout | `crm.ts` 229/235, 316/322, 349/355 |
| **Holding tank** (`holdingTank.ts`) | Prospect placed in the one team pool | Placement is **three separate persistenceCalls, not even tripleStackWrite**; edge is `IN_HOLDING_TANK` (contract said `PLACED_IN`) | `holdingTank.ts` 204/227/252 |

## 13. Finish-work list (finite; ordered for a clean launch)

The entire gap reduces to four systemic fixes + one vocabulary cleanup. None is
a re-architecture.

1. **One write discipline.** Replace fire-once `tripleStackWrite` with the
   tiered writer (§2.4): graph-critical = atomic-or-rollback; knowledge =
   durable-retry queue; operational = retry-non-blocking. All tiers read-back to
   verify. *Bites:* every agent surface. *Closing requires:* the new helper +
   a small durable retry queue (a `projection_outbox` collection works).
2. **One graph vocabulary.** `:BA` → `:BrandAmbassador` in the 8 wrong files
   (§6.4); reconcile `SPONSORED_BY`/`UPLINE_IS` and `IN_HOLDING_TANK`/`PLACED_IN`.
   *Bites:* any agent graph query splits across two label sets. *Closing
   requires:* a find/replace pass + one-time relabel of any existing nodes.
3. **`MATCH` not `MERGE`** for sponsors/subjects that must pre-exist (§6.3).
   *Bites:* phantom nodes corrupt the membership tree Ivory coaches from.
4. **Wire master-content Wave 2.** Point Ivory/Michael/training/.com consumers
   at `readMasterContent()` instead of hardcoded copy. *Bites:* admin edits to
   agent voice do nothing. *Closing requires:* the consumer rewires the file
   header calls "Wave 2."
5. **Make the interview transcript Tier-2 real** (§5D/§7): chunk + embed +
   graph-link + access-gate the full transcript, not just the summary. *Bites:*
   the training agent can't coach from what the BA actually said.

Dependency note: items 1–3 are the foundation (do first, while data is empty).
4 and 5 are feature-completion that ride on the fixed foundation. Michael's full
loop additionally needs `MICHAEL_WORKER_SECRET` set + the voice worker built
(see `Michael_Voice_Worker_Architecture_Recommendation.docx`); email needs the
Resend key + `teammagnificent.com` domain verify.
