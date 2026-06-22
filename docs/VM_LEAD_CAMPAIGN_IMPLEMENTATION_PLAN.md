# VM Lead Campaign Module Implementation Plan

## Momentum Creation System V2

Status: Implementation planning document  
Depends on: `docs/VM_LEAD_CAMPAIGN_MODULE_ARCHITECTURE.md`  
Repository: `devklg/momentum-creation-system-v2`  
Primary apps affected: `apps/team`, `apps/com`, `apps/admin`, `server`, `packages/shared`

---

## 1. Purpose

This document converts the VM Lead Campaign Module Architecture into an executable implementation plan.

The goal is to build a LeadRain-style VM campaign engine inside Momentum Creation System V2 while preserving the existing PMV spine:

```txt
Token
  -> presentation
  -> video tracking
  -> video_complete
  -> placement
  -> holding tank
  -> follow-up
  -> enrollment
```

The VM module is not a separate BA dashboard. It is an optional module inside the existing `.team` BA Cockpit.

The VM module is not a Three International replacement. Three remains the system of record for customers, genealogy, orders, commissions, ranks, and active BA back-office management.

Momentum owns prospects before enrollment.

---

## 2. Non-Negotiable Build Rules

### Rule 1 — TM ID Ownership Lock

Every lead and prospect must belong to exactly one BA by TM BA ID.

Required ownership fields:

```txt
ownerTmBaId
sponsorTmBaId
```

For VM leads, also require:

```txt
leadBatchId
vmCampaignId
```

Client requests must never be allowed to override ownership.

Only Kevin/Admin may perform audited ownership correction.

---

### Rule 2 — Token Creation Creates CRM Record

Whenever a token is created for any prospect type, the system must immediately create or update a BA-scoped CRM record.

Applies to:

```txt
PMV
RVM
QR
manual
referral
social
personal prospect
```

Important distinction:

```txt
CRM visibility = immediately after token creation
Holding Tank visibility = after PMV/RVM engagement rule
```

---

### Rule 3 — Imported Lead Is Not an Active Prospect

Imported lead records are acquisition records.

They do not appear in the public momentum leg.

They do not enter the Holding Tank.

They become activated only when they engage.

Activation events:

```txt
link_clicked
info_requested
callback_requested
request_to_speak_to_someone
presentation_started
```

---

### Rule 4 — Holding Tank Placement Requires Video Complete

Preserve the current PMV rule:

```txt
video_complete -> placeProspect -> positionNumber -> Holding Tank visibility
```

Do not place leads into the Holding Tank because they were imported, tokenized, contacted, or activated.

---

### Rule 5 — CRM Closes at BA Enrollment

Momentum CRM is for leads and prospects only.

When a prospect becomes a BA:

```txt
disposition = new-ba
crmStatus = closed
closedReason = enrolled_as_ba
closedAt = timestamp
```

After that, active BA business management belongs to Three International.

Momentum may retain historical records for attribution, audit, reporting, and agent learning.

---

## 3. Recommended Multi-Agent Build Team

Use 6 focused implementation agents. Each agent owns a narrow area and produces a PR-ready diff or task bundle.

### Agent 1 — Architecture & Schema Agent

Mission:

Create the shared types, database schema/migrations, ownership constraints, and lifecycle enums.

Owns:

```txt
packages/shared
server data models
migrations
schema validation
ownership invariants
status lifecycle definitions
```

Key outputs:

- `LeadBatch` type
- `BulkLead` type
- `VMCampaign` type
- `VMDeliveryEvent` type
- `ProspectCRMRecord` type
- `ProspectTimelineEvent` type
- status enums
- TM ID ownership enforcement helpers

Prompt:

```txt
You are Agent 1: Architecture & Schema Agent.

Audit the repo and implement the VM Lead Campaign data foundation from docs/VM_LEAD_CAMPAIGN_MODULE_ARCHITECTURE.md and docs/VM_LEAD_CAMPAIGN_IMPLEMENTATION_PLAN.md.

Create shared TypeScript types, server-side domain models, migration-ready schema definitions, ownership guard helpers, and lifecycle enums.

Hard rules:
- Every lead/prospect must have ownerTmBaId and sponsorTmBaId.
- VM leads must also have leadBatchId and vmCampaignId.
- Client input must never override owner/sponsor identity.
- Imported leads are not Holding Tank prospects.
- CRM records are created when tokens are created.
- Closed BA outcomes stay historical only.

Do not implement UI.
Do not implement provider calls.
Do not create team member, genealogy, rank, commission, order, or customer management.
```

---

### Agent 2 — Server API & Domain Logic Agent

Mission:

Create the backend domain services and API routes for lead batches, VM campaigns, CRM creation, activation, and RVM token resolution.

Owns:

```txt
server/src/domain/vmLeadBatches.ts
server/src/domain/vmCampaigns.ts
server/src/domain/prospectCrm.ts
server/src/domain/rvmTokens.ts
server/src/routes/vm.ts
server/src/routes/rvm.ts
server/src/routes/crmHub.ts
```

Key outputs:

- create lead batch
- import bulk leads
- generate RVM tokens
- create CRM records immediately after token creation
- activate lead on link click / callback / info request
- preserve TM ID ownership
- close CRM record as new BA
- API endpoints for BA and admin views

Prompt:

```txt
You are Agent 2: Server API & Domain Logic Agent.

Build the server-side VM lead campaign module.

Use the existing token and PMV server patterns as the model. Preserve sponsor immutability: sponsor/owner identity must come from server-side token, BA session, or admin operation, never from client override.

Implement domain services and routes for:
- lead batches
- bulk leads
- VM campaigns
- RVM token generation
- CRM record creation at token creation
- lead activation
- callback/info request tracking
- prospect CRM hub data
- close-as-new-BA CRM transition

Do not alter the existing /api/p/:token PMV behavior except where shared helper extraction is necessary.

Keep the existing video_complete placement rule intact.
```

---

### Agent 3 — `.team` BA Cockpit & CRM UI Agent

Mission:

Add the BA-facing VM Campaigns module and standalone Prospect CRM Hub inside the existing `.team` app.

Owns:

```txt
apps/team/src/routes/vm-campaigns.tsx
apps/team/src/routes/crm.tsx
apps/team/src/components/vm/*
apps/team/src/components/crm/*
apps/team route registration/navigation
cockpit module cards
```

Key outputs:

- VM Campaigns route/module
- lead batch upload/import UI
- campaign list
- campaign detail screen
- VM campaign analytics
- Prospect CRM Hub
- filters for personal / PMV / VM / callbacks / follow-up / closed
- CRM contact timeline
- no team member management UI

Prompt:

```txt
You are Agent 3: .team BA Cockpit & CRM UI Agent.

Extend the existing .team BA Cockpit. Do not create a separate BA dashboard.

Add:
- /vm-campaigns route
- /crm route
- cockpit cards linking to both
- lead batch upload/import UI
- VM campaign list/detail screens
- Prospect CRM Hub for leads/prospects only

The CRM must show leads immediately after token creation.
It must include VM leads, personal prospects, PMV prospects, callback requests, follow-ups, Holding Tank prospects, and closed historical lead outcomes.

Do not add active team members, genealogy, binary tree, ranks, commissions, orders, or customer management.

Use existing .team style patterns from cockpit/profile components.
```

---

### Agent 4 — `.com` RVM Prospect Experience Agent

Mission:

Create `/rvm/:token` as the separate VM prospect entry page while reusing PMV token, presentation, video tracking, CTA, dashboard, and Holding Tank mechanics.

Owns:

```txt
apps/com/src/routes/rvm-token.tsx
apps/com/src/routes/rvm-video-presentation/*
apps/com/src/routes/rvm-prospect-dashboard/*
server RVM token resolver integration
video event integration
```

Key outputs:

- `/rvm/:token` route
- VM lead activation on first click
- presentation page with VM-specific context
- same video milestone tracking
- completion CTA to dashboard / Holding Tank
- source attribution preserved
- owner/sponsor TM ID preserved

Prompt:

```txt
You are Agent 4: .com RVM Prospect Experience Agent.

Create a separate VM prospect route /rvm/:token using the same mechanics as /p/:token.

The RVM page is separate because voicemail leads have a different acquisition context. However, the mechanics must remain aligned with PMV:
- token resolution
- activation on click
- presentation display
- video milestone tracking
- complete event
- CTA to dashboard
- placement only after video_complete
- Holding Tank visibility after placement

Do not create a separate business model explanation funnel.
Do not make income, placement, or guaranteed spillover claims.
Do not allow client input to change ownerTmBaId or sponsorTmBaId.
```

---

### Agent 5 — VM Provider, Queue, Import & Scale Agent

Mission:

Build the scalable import, queue, delivery, webhook, provider adapter, and analytics ingestion foundation for 250,000+ lead tests and future multi-BA growth.

Owns:

```txt
server/src/services/vmProviders/*
server/src/workers/vmImportWorker.ts
server/src/workers/vmDeliveryWorker.ts
server/src/workers/vmWebhookWorker.ts
server/src/routes/vmProviderWebhooks.ts
queue setup
batch processing
```

Key outputs:

- provider adapter interface
- placeholder LeadsRain-style adapter
- manual CSV export/import provider mode
- lead import chunking
- validation queue
- dedupe queue
- suppression queue
- token generation queue
- CRM creation queue
- delivery queue
- webhook event queue
- retry logic
- rate limiting
- audit logs

Prompt:

```txt
You are Agent 5: VM Provider, Queue, Import & Scale Agent.

Build the scale layer for VM campaigns.

The first expected test may be 250,000 leads. The architecture must later support multiple BAs and millions of total leads.

Implement:
- chunked import jobs
- validation and normalization
- deduplication
- suppression/opt-out handling
- token generation queue
- CRM creation queue
- delivery queue
- provider adapter interface
- manual CSV mode
- placeholder LeadsRain-style adapter
- webhook processing route
- retry/rate-limit/audit logging

Do not hard-code one vendor.
Do not send live VM/SMS/email by default without feature flags and admin approval.
```

---

### Agent 6 — Admin, Analytics, Notifications & Agent Memory Agent

Mission:

Create Kevin/Admin oversight, global analytics, notifications/events hooks, and Success Profile to GraphRAG/agent memory integration points.

Owns:

```txt
apps/admin VM oversight screens
server admin VM analytics routes
notifications/events/team news hooks
Success Profile read/index interfaces
GraphRAG/agent memory bridge stubs
```

Key outputs:

- admin VM campaign overview
- BA-by-BA VM campaign performance
- lead batch health
- activation/conversion analytics
- compliance/suppression reporting
- notification triggers
- team news hooks
- Success Profile DB/GraphRAG integration design stubs

Prompt:

```txt
You are Agent 6: Admin, Analytics, Notifications & Agent Memory Agent.

Build Kevin/Admin oversight for the VM Lead Campaign module and connect event signals to notifications, events/team news, and agent memory.

Admin must see:
- all BA lead batches
- all VM campaigns
- activation rates
- video starts/completions
- Holding Tank entries
- callbacks/info requests
- closed new BA outcomes
- provider status
- suppression/compliance summaries

Success Profile belongs to Kevin/Admin + DB + GraphRAG/Agent Memory, not to the editable BA profile. Add integration stubs that allow Steve Success and training agents to use the Success Profile for personalized BA support.

Do not create downline/team member management.
Do not copy Three International back-office features.
```

---

## 4. Sprint Plan

### Sprint 0 — Repo Audit & Branch Discipline

Goal:

Confirm current code paths, avoid duplication, and create branch structure.

Tasks:

- Audit current PMV token routes.
- Audit current CRM routes.
- Audit current BA Cockpit UI.
- Audit admin queue/live ops routes.
- Audit current profile and notification preferences.
- Create one parent feature branch or six agent branches.

Recommended branches:

```txt
feature/vm-schema
feature/vm-server
feature/vm-team-ui
feature/vm-com-rvm
feature/vm-provider-queue
feature/vm-admin-analytics
```

Merge order:

```txt
schema -> server -> team ui -> com rvm -> provider queue -> admin analytics
```

---

### Sprint 1 — Shared Types & Schema

Agent: Agent 1

Tasks:

1. Add shared lifecycle enums.
2. Add shared VM lead types.
3. Add shared CRM hub types.
4. Add server schema/migration definitions.
5. Add ownership guard helpers.
6. Add test fixtures.

Acceptance criteria:

- All VM entities carry `ownerTmBaId` and `sponsorTmBaId`.
- VM leads require `leadBatchId` and `vmCampaignId`.
- Status lifecycle is centralized.
- Existing PMV types are not broken.

---

### Sprint 2 — Prospect CRM Hub Foundation

Agents: Agent 1 + Agent 2 + Agent 3

Tasks:

1. Create `ProspectCRMRecord` domain.
2. Add `createOrUpdateCrmRecordForToken()` service.
3. Modify token creation flows to call CRM creation.
4. Add `/api/crm-hub` list/detail routes.
5. Add `/team/crm` route.
6. Add filters for source/status/follow-up/callback/closed.

Acceptance criteria:

- Any new token creates a CRM record immediately.
- CRM records are scoped by TM ID.
- BA sees only their own prospects.
- Admin can query all prospects.
- Closed new BA records are hidden from active CRM by default.

---

### Sprint 3 — VM Lead Batch Import

Agents: Agent 2 + Agent 5

Tasks:

1. Create `LeadBatch` domain service.
2. Create `BulkLead` domain service.
3. Add upload/import endpoint.
4. Add chunked import worker.
5. Add validation and dedupe.
6. Add suppression/opt-out placeholders.
7. Generate inactive RVM tokens.
8. Create CRM records immediately.

Acceptance criteria:

- Kevin can import a test batch metadata record for 250,000 leads.
- Leads are imported as inactive records.
- Every lead belongs to one `ownerTmBaId`.
- Every token creates a CRM record.
- No imported lead appears in Holding Tank.

---

### Sprint 4 — VM Campaign Builder

Agents: Agent 2 + Agent 3 + Agent 5

Tasks:

1. Create `VMCampaign` domain.
2. Add campaign create/update/list/detail endpoints.
3. Add `/team/vm-campaigns` route.
4. Add campaign setup UI.
5. Add script/audio selection UI.
6. Add SMS/email template UI.
7. Add campaign metrics cards.
8. Add campaign status controls.

Acceptance criteria:

- BA can create a VM campaign from a lead batch.
- Campaign is tied to BA TM ID.
- Campaign metrics display imported/contacted/clicked/activated/completed/closed.
- Live delivery is feature-flagged until provider is configured.

---

### Sprint 5 — RVM Prospect Page

Agents: Agent 2 + Agent 4

Tasks:

1. Add server RVM token resolver.
2. Add activation-on-click logic.
3. Add `/rvm/:token` route in `.com`.
4. Render VM-specific presentation surface.
5. Reuse or mirror video event tracking.
6. Reuse placement only on video complete.
7. Add CTA to dashboard / Holding Tank.
8. Preserve source/campaign attribution.

Acceptance criteria:

- Opening `/rvm/:token` activates the lead.
- Lead status updates to clicked/activated.
- Video milestones update CRM timeline.
- Video complete triggers existing placement rule.
- Token ownership cannot be changed by the client.

---

### Sprint 6 — Provider Adapter & Delivery Pipeline

Agents: Agent 5 + Agent 2

Tasks:

1. Create `RinglessVoicemailProvider` interface.
2. Add manual CSV provider mode.
3. Add placeholder LeadsRain-style adapter.
4. Add delivery queue.
5. Add webhook receiver.
6. Add delivery event persistence.
7. Add retry/rate-limit/audit logic.
8. Add feature flags for live send.

Acceptance criteria:

- Campaign can run in dry-run mode.
- Manual export mode works.
- Provider events update campaign metrics.
- Live send cannot happen without admin enablement.

---

### Sprint 7 — Admin Oversight

Agents: Agent 6 + Agent 2

Tasks:

1. Add admin VM dashboard.
2. Add lead batch monitoring.
3. Add BA campaign overview.
4. Add activation/conversion metrics.
5. Add suppression/compliance summary.
6. Add ownership correction audit tool.
7. Add provider status surface.

Acceptance criteria:

- Kevin can see every BA's VM campaign performance.
- Kevin can audit ownership by TM ID.
- Admin correction is logged.
- Admin can identify batch health and conversion bottlenecks.

---

### Sprint 8 — Notifications, Events, Team News

Agents: Agent 6 + Agent 3

Tasks:

1. Add notification triggers.
2. Add BA notifications for activation, callback, completion, follow-up due.
3. Add admin notifications for batch/campaign failures.
4. Add event hooks for campaign milestones.
5. Add team news hooks for global momentum updates.

Acceptance criteria:

- BA receives relevant in-app notifications.
- Admin receives operational alerts.
- No notification exposes another BA's private lead ownership.

---

### Sprint 9 — Success Profile / Agent Memory Bridge

Agents: Agent 6 + Agent 1

Tasks:

1. Add Success Profile read interface.
2. Add GraphRAG indexing stub.
3. Add Steve Success/training agent context fetch stub.
4. Add admin-only Success Profile access boundary.
5. Add tests that BA profile does not expose private Success Profile fields.

Acceptance criteria:

- Success Profile is available to agents/admin support.
- BA editable profile remains simple.
- Agents can fetch context for personalized support.
- No Success Profile data is exposed to prospect-facing pages.

---

## 5. API Endpoint Draft

### BA VM Campaign APIs

```txt
GET    /api/vm/batches
POST   /api/vm/batches
GET    /api/vm/batches/:batchId
POST   /api/vm/batches/:batchId/import

GET    /api/vm/campaigns
POST   /api/vm/campaigns
GET    /api/vm/campaigns/:campaignId
PATCH  /api/vm/campaigns/:campaignId
POST   /api/vm/campaigns/:campaignId/dry-run
POST   /api/vm/campaigns/:campaignId/schedule
POST   /api/vm/campaigns/:campaignId/pause
POST   /api/vm/campaigns/:campaignId/resume
```

### CRM Hub APIs

```txt
GET    /api/crm-hub/prospects
GET    /api/crm-hub/prospects/:prospectId
POST   /api/crm-hub/prospects
PATCH  /api/crm-hub/prospects/:prospectId
POST   /api/crm-hub/prospects/:prospectId/notes
POST   /api/crm-hub/prospects/:prospectId/followup
POST   /api/crm-hub/prospects/:prospectId/disposition
POST   /api/crm-hub/prospects/:prospectId/close-as-ba
```

### RVM Prospect APIs

```txt
GET    /api/rvm/:token
POST   /api/rvm/:token/activate
POST   /api/rvm/:token/video-event
POST   /api/rvm/:token/callback-request
POST   /api/rvm/:token/info-request
```

### Provider/Webhook APIs

```txt
POST   /api/vm/provider/:provider/webhook
GET    /api/vm/provider/status
```

### Admin APIs

```txt
GET    /api/admin/vm/overview
GET    /api/admin/vm/batches
GET    /api/admin/vm/campaigns
GET    /api/admin/vm/ba/:tmBaId
POST   /api/admin/vm/ownership-correction
GET    /api/admin/vm/compliance
GET    /api/admin/vm/provider-health
```

---

## 6. UI Route Draft

### `.team`

```txt
/team/cockpit
/team/crm
/team/crm/:prospectId
/team/vm-campaigns
/team/vm-campaigns/new
/team/vm-campaigns/:campaignId
/team/vm-campaigns/:campaignId/leads
/team/vm-campaigns/:campaignId/analytics
/team/profile
```

### `.com`

```txt
/rvm/:token
/rvm/:token/dashboard
```

### `admin`

```txt
/admin/vm
/admin/vm/batches
/admin/vm/campaigns
/admin/vm/ba/:tmBaId
/admin/vm/compliance
/admin/vm/provider-health
/admin/success-profiles
```

---

## 7. Test Plan

### Ownership Tests

- Cannot create lead without ownerTmBaId.
- Cannot create lead without sponsorTmBaId.
- Cannot create VM lead without leadBatchId.
- Cannot create VM lead without vmCampaignId.
- Client cannot override sponsorTmBaId.
- BA cannot see another BA's leads.
- Admin can see all leads.
- Admin ownership correction writes audit record.

### CRM Tests

- Token creation creates CRM record.
- CRM record appears before click.
- Lead click changes CRM status to activated.
- Video events update CRM timeline.
- Closing as new BA removes record from active CRM views.
- Closed record remains in historical view.

### RVM Tests

- Unknown token returns invalid token.
- Expired token returns expired view.
- First click activates lead.
- Repeated click is idempotent.
- Video started updates state.
- Video complete places prospect.
- Placement is idempotent.

### Batch/Scale Tests

- Import 1,000 test leads.
- Import 10,000 test leads.
- Simulate 250,000 batch metadata and chunk processing.
- Duplicate phone/email detection works.
- Suppressed leads are not queued.
- Token generation is idempotent.
- CRM creation is idempotent.

### Provider Tests

- Dry-run mode sends nothing externally.
- Manual CSV export produces expected rows.
- Webhook updates delivery event.
- Retry does not duplicate terminal events.

---

## 8. Risk Controls

### Compliance Risk

Ringless voicemail and SMS must be handled with compliance guardrails:

- opt-out handling
- suppression list
- DNC/compliance flags
- quiet-hour controls
- source consent fields
- audit logs
- admin approval for live campaigns

### Scale Risk

Do not process large lead files synchronously.

Use workers and queues.

### Ownership Risk

All CRM, callback, token, campaign, and enrollment attribution must resolve through TM ID.

### PMV Integrity Risk

Do not allow imported leads to inflate public momentum.

Only engaged/video-complete prospects enter the Holding Tank.

---

## 9. Final Build Definition

The implementation is complete when:

1. A BA can upload or create a lead batch.
2. Every imported lead is locked to the BA's TM ID.
3. Every generated token immediately creates a CRM record.
4. The BA can see those leads in Prospect CRM before they click.
5. The BA can create a VM campaign using those leads.
6. VM/SMS/email delivery can run in dry-run/manual mode.
7. A clicked VM token activates the lead.
8. `/rvm/:token` shows the presentation.
9. Video complete places the prospect using the existing PMV rule.
10. The prospect enters the Holding Tank only after placement.
11. Callback/info requests route to the owning BA.
12. The lead closes as `new-ba` when they enroll.
13. The closed lead is removed from active CRM.
14. Kevin/Admin can see global VM, CRM, and ownership analytics.
15. No Three International back-office functionality is duplicated.

---

## 10. Suggested First Codex Task

```txt
Audit the current repository and implement Sprint 1 from docs/VM_LEAD_CAMPAIGN_IMPLEMENTATION_PLAN.md.

Scope:
- shared types
- lifecycle enums
- server domain skeletons
- ownership guard helpers
- test fixtures

Do not implement UI.
Do not implement provider calls.
Do not alter existing /api/p/:token behavior.
Preserve sponsor immutability and video_complete placement rules.
```
