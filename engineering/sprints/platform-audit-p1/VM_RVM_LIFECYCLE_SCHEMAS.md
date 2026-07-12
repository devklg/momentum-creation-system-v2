# VM/RVM Lifecycle Schemas

**Authority:** Generated-from-code engineering reference for P1-77. Runtime code and shared TypeScript contracts remain authoritative when this document drifts.

**Scope:** Campaigns, recipients, provider queue jobs, provider webhooks, delivery attempts/events, and RVM invitation tokens. This reference does not authorize live delivery. A campaign still requires the existing environment gate and audited admin approval.

## Identity and ownership invariants

- `ownerTmagId` is the BA who owns the record; `sponsorTmagId` is captured from the authenticated/token-derived relationship and is not client-overridable.
- `leadOwnerId` groups an imported source batch. `vmCampaignId` groups campaign activity. `leadId` identifies one imported recipient.
- A VM/RVM recipient is not placed in the Holding Tank by import, token creation, delivery, or link click. Placement occurs only after the shared token reaches `video_complete`.
- `doNotDrop: true` and `leadType: interviewed` fail closed before provider delivery.

## Lifecycle relationship

```text
tmag_vm_lead_owners
  -> tmag_vm_campaigns
  -> tmag_vm_bulk_leads (recipients)
  -> tmag_vm_queue_jobs
       -> tmag_vm_delivery_events
       -> tmag_vm_provider_webhook_events
  -> tmag_prospect_invite_tokens
  -> tmag_prospect_crm_records / tmag_prospect_timeline_events
```

## Campaign schema

**Collection:** `tmag_vm_campaigns`  
**Contract:** `McsVMCampaignRecord` in `packages/shared/src/types.ts`  
**Runtime:** `server/src/domain/vmCampaigns.ts`

Required identity and control fields are `vmCampaignId`, `ownerTmagId`, `sponsorTmagId`, `leadOwnerId`, `name`, `provider`, `status`, `createdAt`, and `updatedAt`. Delivery configuration includes `voicemailAudioId`, `audioUrl`, `smsTemplateId`, `emailTemplateId`, and `scheduledAt`. Runtime timestamps are `startedAt` and `completedAt`. Live delivery additionally depends on `adminApprovedForLiveDelivery`; the runtime persists `liveApprovalBy` and `liveApprovalAt` as audit-control fields even though those two fields are not yet declared by the shared interface.

Campaign status transitions:

| From | Action | To |
|---|---|---|
| `draft` | `ready` | `ready` |
| `ready` | `schedule` | `scheduled` |
| `ready`, `scheduled`, `paused` | `start` | `running` |
| `running` | `pause` | `paused` |
| `paused` | `resume` | `running` |
| `scheduled`, `running`, `paused` | `cancel` | `cancelled` |
| `running` | worker sees no queued/processing delivery jobs | `completed` |

`dry_run` and `archived` exist in the shared status union but have no campaign status action in the current transition function. They must not be inferred as reachable through the owner status endpoint.

## Recipient schema

**Collection:** `tmag_vm_bulk_leads`  
**Contracts:** `McsBulkLeadRecord` and runtime `VmBulkLeadRecord`  
**Runtime:** `server/src/domain/vmProviderQueue.ts`, `server/src/domain/bulkLeads.ts`

Every recipient carries `leadId`, `importJobId`, `leadOwnerId`, `vmCampaignId`, `ownerTmagId`, `sponsorTmagId`, contact/source fields, normalized contact fields, `dedupeKey`, consent controls, `status`, `token`, `crmRecordId`, validation evidence, and timestamps. Runtime-only compatibility fields include `leadType` and `doNotDrop`.

The import/processing rail is:

`imported -> validated | invalid | duplicate -> suppressed | token_created -> crm_created -> queued -> delivery_dry_run | manual_exported | voicemail_drop_queued -> voicemail_drop_delivered | voicemail_drop_failed | opted_out`

`callback_requested` is also a runtime recipient state when the inbound callback flow matches the lead. Prospect engagement after token resolution continues on the shared CRM/token rails rather than creating a second placement system.

## Queue job and attempt schema

**Collection:** `tmag_vm_queue_jobs`  
**Contract:** `VmQueueJob` in `server/src/domain/vmProviderQueue.ts`

Fields are `jobId`, `kind`, `status`, `attempts`, `maxAttempts`, `availableAt`, `lockedAt`, `completedAt`, `failedAt`, `failureReason`, `payload`, `createdAt`, and `updatedAt`.

Kinds: `import_validate`, `suppression_check`, `token_generate`, `crm_create`, `delivery`, `webhook_event`.

Status behavior:

- Declared statuses are `queued`, `processing`, `complete`, `failed`, `dead_lettered`, and `skipped`. The current queue functions do not assign `failed`; retryable failures return to `queued`.
- Enqueue creates `queued` with `attempts: 0`.
- Claim changes `queued -> processing`, sets `lockedAt`, and increments `attempts`.
- Success changes `processing -> complete`; a policy skip changes it to `skipped`.
- Failure below `maxAttempts` returns the job to `queued` with exponential backoff capped at 15 minutes.
- Failure at `maxAttempts` changes it to `dead_lettered`.
- A campaign timing/state requeue returns the job to `queued` and decrements the claim increment, so waiting does not burn an attempt.

The queue row is the attempt controller. A provider delivery outcome is separately appended to `tmag_vm_delivery_events`; it does not replace queue history.

`lockedAt` records a claim, but the current queue domain has no stale-lock recovery transition. P1-78 owns stuck-state visibility; this document does not claim that elapsed time changes or closes a job.

## Provider webhook schema

**Collection:** `tmag_vm_provider_webhook_events`  
**Runtime:** `recordProviderWebhook()` / `processWebhookEvent()` in `server/src/domain/vmProviderQueue.ts`

Ingress stores `webhookEventId`, `provider`, raw `payload`, received `headers`, `status: received`, `createdAt`, and `processedAt: null`, then enqueues a `webhook_event` job. Successful processing changes the webhook row to `status: processed` and sets `processedAt` before completing its queue job.

The current provider webhook event does not persist an external idempotency key. Duplicate provider callbacks can therefore create distinct webhook rows; P1-80 owns that correction. P1-77 records the gap and does not mutate webhook behavior.

## Delivery event / attempt schema

**Collection:** `tmag_vm_delivery_events`  
**Contracts:** `McsVMDeliveryEventRecord` and runtime `VmDeliveryEventRecord`

Each append-only delivery event carries `eventId`, `provider`, `leadId`, `vmCampaignId`, `ownerTmagId`, normalized `status`, `providerMessageId`, `providerStatus`, `dryRun`, queue `attempt`, provider `details`, and `createdAt`.

The declarative `VM_SCHEMA_DEFINITIONS.deliveryEvents` entry currently names legacy fields `deliveryEventId`, `channel`, and `occurredAt`; runtime writes use `eventId`, no `channel`, and `createdAt`. Runtime records are the operational truth until a separately approved schema reconciliation changes code and stored data.

## RVM token schema

**Collection:** `tmag_prospect_invite_tokens` (shared PMV/RVM token rail)  
**Contract:** `McsInviteTokenRecord` in `packages/shared/src/types.ts`  
**Runtime:** `server/src/domain/tokens.ts`, `server/src/domain/rvmTokens.ts`, `server/src/domain/bulkLeads.ts`

The token row carries `token`, `prospectId`, immutable `sponsorTmagId`, lifecycle `state`, `createdAt`, `expiresAt`, `clickedAt`, `sentAt`, and `updatedAt`. RVM provenance is linked through the bulk lead (`leadId`, `leadOwnerId`, `vmCampaignId`, `token`) and the created prospect/CRM records; it does not use a separate token collection.

Shared token rail:

`minted -> clicked -> video_started -> video_quarter -> video_half -> video_three_quarter -> video_complete -> enrolled | expired`

Callback requests and webinar reservations are independent intent records, not token states. Transitions are forward-only. Resolve lazily marks an expired token `expired`; `enrolled` and `expired` reject further RVM engagement. Only `video_complete` invokes placement, preserving the monotonic pool rule.

## Schema registry gaps recorded by P1-77

`server/src/domain/vmSchemas.ts` remains useful for lead-owner, bulk-lead, campaign, delivery, CRM, timeline, and ownership-correction declarations, but it is not a complete VM/RVM lifecycle registry. It currently omits `tmag_vm_queue_jobs`, `tmag_vm_provider_webhook_events`, and the shared token collection. It also carries the delivery-event field mismatch described above. These are documented findings, not permission to perform an unreviewed data migration.

The CRM cross-state map currently names `tmag_vm_suppressions`, while the runtime writes `tmag_vm_suppression_list`. That naming drift is report-only in P1-77 and must be reconciled through a separately scoped schema change.

## Source index

- Shared contracts: `packages/shared/src/types.ts`
- Declarative registry: `server/src/domain/vmSchemas.ts`
- Campaign transitions: `server/src/domain/vmCampaigns.ts`
- Recipients, queue, webhooks, attempts, delivery events: `server/src/domain/vmProviderQueue.ts`
- RVM token bridge: `server/src/domain/rvmTokens.ts`
- Shared token state: `server/src/domain/tokens.ts`
- Token/prospect creation for imported leads: `server/src/domain/bulkLeads.ts`
- Delivery gating and campaign completion: `server/src/workers/vmDeliveryWorker.ts`
