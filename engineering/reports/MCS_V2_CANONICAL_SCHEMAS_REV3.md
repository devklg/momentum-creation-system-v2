# MOMENTUM CREATION SYSTEM V2

## Canonical Schema List — for Provisioning Approval (Rev 3)

*Team Magnificent · dedicated triple-stack (Mongo momentum@30000 · Neo4j@7710 · Chroma@8200) · post-reidentification canonical names*

**Rev 3 folds in Kevin's 2026-07-02 schema-review rulings (1–12)** on top of Rev 2: date-free member id **TMAG-XXXXXX** (six crypto-random, ambiguity-free); **questionnaire retired into Steve** (two-stage onboarding spine: Steve → workbook); **Chroma = `mcs_` prefix on every collection** (store-deterministic naming: one base name, prefix per store); **`tmag_vm_lead_owners`** rename (tracking whose leads these are — multiple members build with RVM); **agent vs content templates kept separate** ("the template is the road that the agent travels on"); Neo4j member label **`TeamMagnificentMember`** + `TeamMagnificent` scope node; genealogy = downline membership only; Continuous Discovery doctrine with ingestion coverage. Rev 2's three open confirms are all resolved. All prior Rev 2 decisions stand.

---

## 0 · Identity & Membership

Brand Ambassador = a THREE International role. Being a BA does **not** make someone a Team Magnificent member. A **member** is a BA in Kevin's downline; membership and team-BA status are coextensive (Ruling 4). The app's canonical entity is the MEMBER — id `tmagId`, value **`TMAG-XXXXXX`** (six crypto-random ambiguity-free characters; **date-free** — enrollment date lives only in `createdAt`; founders `TMAG-01`/`TMAG-02` are named exceptions).

Eligibility is enforced by ACCESS CODES: to become a member you must be an enrolled III BA AND hold a `TMAG-XXXX` access code issued by an existing team member (sponsor). Phase 1: only Kevin mints codes; Phase 2 (~100 members): a deterministic access-code agent issues new members their own lifetime code (Ruling 5; `mintedVia` attribution). Members reuse their one code to sponsor. Sponsor is immutable.

Genealogy scope (Ruling 3): the only genealogy fact in this app is downline membership, computed from the immutable `sponsorTmagId` chain rooted at `TMAG-01`. No THREE genealogy (legs/placement/depth/volume/rank) is modeled or mirrored. Holding-tank position and beneath-you counters are app-owned marketing mechanics, not THREE placement claims.

Onboarding spine (Ruling 6): **two stages** — Steve Discovery & Success Interview (the setup baseline) → sponsor-led workbook call. The self-serve questionnaire is retired (folded into Steve; its 21 fields gap-mapped into Steve's script; historical rows preserved, no validators). Ongoing discovery accrues via the runtime pipeline (Rulings 8–9): all agents interview; every encounter that creates something new has an ingestion mechanism.

## 1 · MongoDB — collections (database momentum)

### A · Identity / Access

| Collection | Key (`_id`) | Core fields | Purpose |
|---|---|---|---|
| `team_magnificent_members` | `tmagId` | tmagId · threeBaId · threeUsername · firstName · lastName · email · phone · timezone · createdAt; passwordHash · sponsorTmagId · accessCodeUsed · accessCodeHeld; onboarding flags | Master MEMBER identity + login (`TMAG-XXXXXX`, date-free). Not "brand ambassador" — that is the III credential (`threeBaId`). |
| `tmag_access_codes` | `code` | code (TMAG-XXXX) · sponsorTmagId · sponsorFirstName · sponsorLastName · createdAt · active · mintedVia(kevin\|agent) | TMAG-XXXX sponsor codes; the membership-eligibility gate. One active/member for life; Kevin mints now, deterministic agent at ~100 members (Ruling 5). |
| `tmag_commitments` | `commitmentId` | commitmentId · tmagId · threeBaId · email · version · acceptedAt (+IP · userAgent) | One-click acceptance of The Team Magnificent Commitment (audit-grade). ⚠️ Commitment TEXT is an unauthored deliverable (Kevin). |
| `tmag_workbooks` | `workbookId` | workbookId · forTmagId · conductedByTmagId · status(draft\|final) · version | Sponsor-led 20-Q member interview; draft→final. Stage 2 of the onboarding spine. |
| `tmag_profile_change_challenges` | `challengeId` | challengeId · tmagId · channel(email\|phone) · target · codeHash · issuedAt · expiresAt | 15-min single-use email/phone verification. |

*`tmag_questionnaires` — RETIRED (Ruling 6): folded into Steve's interview. Historical rows preserved; no validators; drops from provisioning.*

### B · Prospect / Token / Holding-tank / CRM

| Collection | Key (`_id`) | Core fields | Purpose |
|---|---|---|---|
| `tmag_prospects` | `prospectId` | prospectId · firstName · lastName · location · sponsorTmagId · state · becameCustomer · token · source | The invited person (funnel). `sponsorTmagId` immutable. |
| `tmag_prospect_invite_tokens` | `token` | token · prospectId · sponsorTmagId · state · createdAt · expiresAt | Opaque 12-char token; forward-only lifecycle rail. |
| `tmag_prospect_invitation_activity` | `activityId` | activityId · prospectId · sponsorTmagId · kind · note · at | Append-only member-side timeline. |
| `tmag_prospect_htank_counters` | `'tm_team_pool'` | current · createdAt | Holding-tank: single-row monotonic team counter. |
| `tmag_prospect_htank_placements` | `prospectId` | prospectId · sponsorTmagId · positionNumber · placedAt · expiresAt · flushedAt | Holding-tank: one placement/prospect; monotonic, never renumbered. |
| `tmag_prospect_htank_accounts` | `accountId` | accountId · prospectId · tokenId · sponsorTmagId · reentryCode | Holding-tank: durable prospect re-entry account. |
| `tmag_prospect_magic_links` | `linkToken` | linkToken · accountId · tokenId · issuedAt · expiresAt · smsDeliveryStatus | Single-use 60-min SMS re-entry link. |
| `tmag_prospect_sessions` | `sessionId` | sessionId · accountId · prospectId · tokenId · sponsorTmagId | Opaque .com session. Mongo-only (named ephemeral exception). |
| `tmag_prospect_callback_requests` | `callbackRequestId` | callbackRequestId · token · prospectId · sponsorTmagId · intent · smsDeliveryStatus | Prospect "raise hand": clicks "have my sponsor contact me" → surfaces in the sponsor cockpit. The immediate "call me" signal (≠ booking a webinar). |
| `tmag_prospect_crm_notes` | `noteId` | noteId · prospectId · sponsorTmagId · text · createdAt | Member-private append-only prospect notes. |
| `tmag_prospect_crm_followups` | `followUpId` | followUpId · prospectId · sponsorTmagId · dueAt · clearedAt | One active reminder per (prospect, member). |
| `tmag_prospect_crm_dispositions` | `crmdispo_<p>_<m>` | prospectId · sponsorTmagId · disposition · updatedAt | Current disposition (one canonical CrmDisposition enum). |
| `tmag_prospect_crm_records` | `crm_<prospectId>` | crmRecordId · prospectId · ownerTmagId · sponsorTmagId · source · status · disposition · closedReason · followUpDueAt | VM/RVM lead-campaign CRM layer (kept as a named layer distinct from member-private CRM — Ruling 11). |
| `tmag_prospect_timeline_events` | `eventId` | eventId · prospectId · ownerTmagId · sponsorTmagId · kind · title · occurredAt | Append-only VM-aware CRM timeline (~26 kinds). |

### C · Webinar / Orientation / Training / Steve

| Collection | Key (`_id`) | Core fields | Purpose |
|---|---|---|---|
| `tmag_prospect_webinar_events` | `eventId` | eventId · scheduledFor · hosts[] · durationMinutes · status | Scheduled prospect webinars. |
| `tmag_prospect_webinar_reservations` | `reservationId` | reservationId · eventId · token · prospectId · sponsorTmagId · attendance(yes\|no\|missed\|rescheduled) · scheduledFor · rescheduledTo | Prospect seat reservations + attendance. |
| `tmag_new_member_orientation_sessions` | `sessionId` | sessionId · scheduledFor · hosts[] · capacity · durationMinutes · status | New-member group orientation (cap 10). |
| `tmag_new_member_orientation_reservations` | `reservationId` | reservationId · sessionId · tmagId · scheduledFor · status | Member seat reservations. |
| `tmag_fast_start_progress` | `<tmagId>__module-<n>` | tmagId · moduleId · state | Per-member-per-module training state. |
| `tmag_steve_success_interview` | `SD-<tmagId>` | tmagId · successProfile | Steve Discovery & Success Interview — the setup BASELINE (1/member, Ruling 8). Ongoing discovery accrues via the runtime pipeline, never by rewriting this artifact. |

### D · Agents / Templates / Governance / Audit / Admin

| Collection | Key (`_id`) | Core fields | Purpose |
|---|---|---|---|
| `tmag_agent_ivory_events` | `eventId` | eventId · tmagId · agentId · kind · createdAt | Ivory agent-interaction audit trail (split per agent). |
| `tmag_agent_michael_events` | `eventId` | eventId · tmagId · agentId · kind · createdAt | Michael agent-interaction audit trail. |
| `tmag_agent_steve_events` | `eventId` | eventId · tmagId · agentId · kind · createdAt | Steve agent-interaction audit trail. |
| `tmag_agent_templates` | `templateId` | templateId · agentKey(ivory\|michael\|steve\|…) · templateKind(learning\|interviewing\|invitation\|…) · version · steps · questionSet · guardrails · knowledgeDomains[] | **THE TEMPLATE IS THE ROAD THE AGENT TRAVELS ON** (Ruling 12c): the operating roads each agent runs on and the knowledge domains it pulls from. First-class agent operating system; natural home of the encounter-to-ingestion coverage matrix (Ruling 9). Kept separate from content templates. |
| `tmag_content_templates` | `templateVersionId` | templateVersionId · tenantId · templateKey · surface · version | Renamed from master_content_versions. Versioned served copy/content rendered to users. Distinct concept from agent templates. |
| `tmag_invitation_generator_runs` | `runId` | runId · tmagId · productKey · productName · angle | WDYK invitation-generator sessions. |
| `tmag_ivory_prospect_names` | `ivoryId` | ivoryId · tmagId · firstName · lastName · categories[] · status | Member-private warm-market roster (Ivory). |
| `mcs_audit_log` | `entryId` | entryId · timestamp · role · actor · action · entity · severity + runtime block (R0) | SYSTEM. Canonical append-only audit substrate. |
| `tmag_projection_outbox` | `outboxId` | outboxId · tier · target · entityId · payload · status · attempts · nextAttemptAt | Durable retry queue for PROJECTIONS = the triple-stack mirror writes (Mongo→Neo4j/Chroma). Keeps the three stores in sync when one hiccups (H1). |
| `tenant_settings_versions` | `settingsVersionId` | settingsVersionId · version · reason · tenantId · complianceMode | SYSTEM. Append-only tenant settings history. |
| `tmag_admin_settings` | human key | value | Single-row-per-key admin config. |
| `tmag_admin_sponsor_overrides` | `overrideId` | overrideId · tmagId · previousSponsorTmagId · newSponsorTmagId · requestingTmagId · reason · performedByTmagId · auditEntryId | Append-only sponsor-override history (the ONE sponsor-immutability exception). |
| `tmag_admin_curated_leader_tags` | `curated_<tmagId>` | tmagId · curated · setByTmagId · setAt | Curated-leader badge. |
| `tmag_admin_member_notes` | `noteId` | noteId · tmagId · text · authorTmagId · createdAt | Kevin-private member notes. |
| `tmag_admin_prospect_notes` | `noteId` | noteId · prospectId · body · createdByTmagId | Kevin-private prospect notes. |

### E · Voicemail (VM/RVM) / Broadcast

| Collection | Key (`_id`) | Core fields | Purpose |
|---|---|---|---|
| `tmag_vm_lead_owners` | `leadOwnerId` | leadOwnerId · ownerTmagId · sponsorTmagId · name · source · country · leadType · status | **Renamed from vm_lead_batches (Ruling 12b): tracks WHOSE leads these are** — multiple members build with the RVM system. Reference field `leadBatchId` → `leadOwnerId` in the same migration. |
| `tmag_vm_campaigns` | `vmCampaignId` | vmCampaignId · ownerTmagId · leadOwnerId · name · provider · status · adminApprovedForLiveDelivery | Member-owned VM campaign. |
| `tmag_vm_bulk_leads` | `leadId` | leadId · leadOwnerId · ownerTmagId · vmCampaignId · status · dedupeKey | Imported VM/RVM leads — **ONE unified collection, one id format, one lead one journey** (Ruling 11; Apache Leads lineage: imported → dropped-to → responded → qualified → prospect). |
| `tmag_vm_queue_jobs` | `jobId` | jobId · kind · status · attempts · availableAt | Durable VM work queue. |
| `tmag_vm_delivery_events` | `eventId` | eventId · provider · leadId · vmCampaignId · ownerTmagId · channel · status · dryRun · attempt | VM send/webhook history — merged canonical shape (Ruling 11). |
| `tmag_vm_provider_webhook_events` | `webhookEventId` | webhookEventId · provider · payload · status | Raw webhook ingestion. |
| `tmag_vm_audit_events` | `auditId` | auditId · action · entityId · summary | Append-only VM operational audit. |
| `tmag_vm_suppression_list` | (undetermined) | ownerTmagId + (normalizedPhone\|normalizedEmail) | Do-not-contact list (defer until writer confirmed). |
| `tmag_broadcasts` | `broadcastId` | broadcastId · createdByTmagId · isTestSend · audiencePreset · channel · template · recipientCount · status | Kevin-only broadcast master. |
| `tmag_broadcast_recipients` | `<bc>::<tmagId>` | rowId · broadcastId · recipientTmagId · channel · status · attempts · queuedAt | One row/recipient. |
| `tmag_broadcast_optouts` | `tmagId` | tmagId · reason · addedAt | Global permanent STOP list. |

### F · Memory / Learning (system, `mcs_`)

| Collection | Key (`_id`) | Core fields | Purpose |
|---|---|---|---|
| `mcs_outcomes` | `id` | envelope + kind(pending\|enrolled_iii\|became_customer\|declined) · confirmedByTmagId · outcomeAt | MEMORY (R1). Member-confirmed prospect resolution — the raw signal the system learns from. |
| `mcs_learning_candidates` | `id` | envelope + status · domain · language · proposedSummary · sourceOutcomeIds[] · review? | MEMORY (R2). A PROPOSED insight derived from outcomes ("this seems to work"), awaiting KEVIN's approval. No agent may approve. |
| `mcs_graphrag_records` | `id` | envelope + knowledgeObjectId · version · domain · language · summary · model · retrievalReady | MEMORY (R3). Approved ACTIVE knowledge the agent templates pull from at runtime. |

*First-pass validator posture (all): required = core above; additionalProperties:true; ISO-string timestamps (never Date); field enums; tighten to additionalProperties:false per-collection after a soak.*

## 2 · Neo4j — labels & constraints (@7710)

| Label | Key | Relationships | Purpose |
|---|---|---|---|
| `TeamMagnificentMember` | tmagId | SPONSORED_BY→(:TeamMagnificentMember); MEMBER_OF→(:TeamMagnificent); HOLDS_CODE→(:TmagAccessCode) | The canonical MEMBER node (downline tree). Genealogy scope = downline membership only (Ruling 3). |
| `TeamMagnificent` | teamKey | (target of MEMBER_OF / SCOPED_TO) | The single team scope node. |
| `TmagProspect` | prospectId | SPONSORED_BY→(:TeamMagnificentMember); HAS_TOKEN→(:TmagInviteToken); IN_HOLDING_TANK→(:TmagPool) | Funnel entity (non-member). |
| `TmagOutcome` | id | CONFIRMED_BY→(:TeamMagnificentMember); ABOUT_PROSPECT→(:TmagProspect); SUPERSEDES; SCOPED_TO→(:TeamMagnificent) | R1 outcome lineage (graph side of mcs_outcomes). |
| `TmagLearningCandidate` | id | DERIVED_FROM→(:TmagOutcome); SCOPED_TO→(:TeamMagnificent) | R2 provenance: a proposed insight and the outcomes it came from. |
| `TmagKnowledge` | id | SCOPED_TO→(:TeamMagnificent); SUPERSEDES | R3 active-knowledge nodes (graph side of mcs_graphrag). |
| `TmagAuditEntry` | entryId | ACTED_FOR→(:TeamMagnificentMember) | Graph side of mcs_audit_log: links each audited action to who did it. |
| `Tmag<BusinessLabel>` | business key | TmagInviteToken.token · TmagAccessCode.code · TmagWebinarEvent.eventId · TmagIvoryName.ivoryId · TmagBroadcast.broadcastId · TmagVmCampaign.vmCampaignId · TmagVmLeadOwner.leadOwnerId · … | Per-label uniqueness constraints. This SET GROWS as features are added — same constraint pattern each time (P10 §6). |

## 3 · ChromaDB — collections (384-dim, @8200)

**Store-deterministic prefix (Rulings 10 + 12a): every Chroma collection takes `mcs_` — one base name across stores, prefix per store** (Mongo `tmag_access_codes` ⇄ Chroma `mcs_access_codes`; `team_magnificent_members` ⇄ `mcs_members`). Every record: `id` = Mongo `_id`; document = summary sentence; flat metadata with required `kind` + embedding provenance (`model`, `model_version`, 384-dim).

| Group | Collections |
|---|---|
| Identity / onboarding | mcs_members · mcs_access_codes · mcs_commitments · mcs_workbooks · mcs_steve_success_interview · mcs_fast_start_progress |
| Prospect / funnel | mcs_prospect_invitation_activity · mcs_prospect_callback_requests · mcs_prospect_htank_events · mcs_prospect_magic_links · mcs_prospect_webinar_reservations · mcs_prospect_crm_records · mcs_prospect_timeline_events |
| Agents / templates / admin | mcs_agent_ivory_events · mcs_agent_michael_events · mcs_agent_steve_events · mcs_agent_templates · mcs_ivory_prospect_names · mcs_audit_log · mcs_content_templates · mcs_broadcasts |
| VM | mcs_vm_lead_owners · mcs_vm_bulk_leads · mcs_vm_campaigns · mcs_vm_delivery_events |
| Memory / learning (system) | mcs_outcomes · mcs_learning_candidates_review (review-only) · 10× mcs_<domain>_knowledge_<lang> (active) |

## 4 · Enum reference (closed sets)

| Enum | Values |
|---|---|
| Prospect / token state | minted · clicked · video_started · video_quarter · video_half · video_three_quarter · video_complete · enrolled · expired |
| Outcome / prospect status | pending · enrolled_iii · became_customer · declined |
| Webinar attendance | yes · no · missed · rescheduled (+ scheduledFor / rescheduledTo) |
| CRM disposition (one enum) | new_brand_ambassador · new_customer · interested · not_interested · later · no_response · wrong_number · do_not_contact |
| Agent template kind | learning · interviewing · invitation · (+ future) |
| Learning domain | success · training · relationship · performance · organizational |
| Language | en · es |
| Runtime audit action | runtime.turn.{opened,draft_emitted,closed} · runtime.gate.{allowed,denied} · runtime.persistence.{enabled,disabled} |
| Persistence mode | direct (gateway retired — ACR-0009) |

## 5 · Approval

Reviewed and approved for provisioning (Mongo $jsonSchema + Neo4j constraints + Chroma registry, moderate mode, reversible). Approval lifts the schema write-freeze (blocker B4).

Kevin L. Gardner ________________________________

Date ______________
