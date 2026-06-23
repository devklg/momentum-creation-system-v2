# Agent Work Orchestration Prompt

## Momentum Creation System V2

Use this prompt to guide Codex, Claude Code, or other coding agents so they build the VM Lead Campaign Module and BA Support Agents with the correct project context.

---

## Master Prompt

You are working in the repository:

```txt
devklg/momentum-creation-system-v2
```

You are implementing the next phase of Momentum Creation System V2.

You must read and follow these documents first:

```txt
docs/VM_LEAD_CAMPAIGN_MODULE_ARCHITECTURE.md
docs/VM_LEAD_CAMPAIGN_IMPLEMENTATION_PLAN.md
docs/BA_SUPPORT_AGENTS_ARCHITECTURE.md
NEW_BA_DISCOVERY_SUCCESS_INTERVIEW_SPEC.md if present in the repo or provided in context
```

Do not begin coding until you have audited the current repo paths for:

```txt
apps/team/src/routes/cockpit.tsx
apps/team/src/routes/profile.tsx
server/src/routes/p.ts
packages/shared/src/types.ts
server/src/domain/holdingTank.ts
server/src/domain/tokens.ts
server/src/domain/prospects.ts
server/src/domain/invitations.ts
admin queue/live-ops routes and components if present
```

The existing PMV spine is the foundation. Do not replace it.

The current system already has:

```txt
/p/:token
  -> token resolution
  -> presentation
  -> video tracking
  -> video_complete
  -> placement
  -> Holding Tank / dashboard
```

The VM/RVM system must extend this spine, not break it.

---

## Core Product Context

Momentum Creation System V2 is not a Three International back-office clone.

Momentum manages:

```txt
prospects
lead acquisition
invitations
PMV
Holding Tank
Prospect CRM
VM campaigns
training
events
notifications
team news
BA support agents
```

Three International manages:

```txt
customers
orders
genealogy
binary tree
commissions
ranks
active BA back-office records
team member management
```

Do not build genealogy, commissions, ranks, orders, customer management, or active downline management into Momentum.

---

## Non-Negotiable Rules

### 1. TM ID Ownership Lock

Every lead and prospect belongs to exactly one BA by TM BA ID.

Required fields:

```txt
ownerTmBaId
sponsorTmBaId
```

For VM leads also require:

```txt
leadBatchId
vmCampaignId
```

The BA's leads are their prospects and their potential personally sponsored BAs.

No lead may float without ownership.

No client request may override ownership.

Only Kevin/Admin may perform an audited ownership correction.

---

### 2. Token Creation Creates CRM Record

Whenever a PMV, RVM, QR, manual, referral, social, or personal prospect token is created, immediately create or update a BA-scoped CRM record.

```txt
Token created
  -> Prospect CRM record created immediately
  -> visible in BA CRM
```

Important distinction:

```txt
CRM visibility = immediately after token creation
Holding Tank visibility = only after engagement/video completion rule
```

---

### 3. Imported Lead Is Not an Active Prospect

Imported VM leads are acquisition records, not active public momentum prospects.

They do not appear in the public momentum leg.

They do not enter the Holding Tank.

They become activated only after:

```txt
link_clicked
info_requested
callback_requested
request_to_speak_to_someone
presentation_started
```

---

### 4. Holding Tank Placement Requires Video Complete

Preserve the existing PMV rule:

```txt
video_complete -> placeProspect -> positionNumber -> Holding Tank visibility
```

Do not place leads because they were imported, tokenized, contacted, or activated.

---

### 5. Momentum CRM Is For Leads Only

The CRM is a lead/prospect CRM.

When a lead becomes a Brand Ambassador, close the CRM record:

```txt
disposition = new-ba
crmStatus = closed
closedReason = enrolled_as_ba
closedAt = timestamp
```

After enrollment, active business record management belongs to Three International.

Momentum may retain historical CRM records for attribution, audit, reporting, and agent learning.

---

## VM Campaign Module Context

The VM Campaign Module is a LeadRain-style ringless voicemail campaign engine inside Momentum.

It supports:

```txt
lead purchase/upload
lead batch processing
VM campaign creation
voicemail scripts/audio
SMS follow-up
email follow-up
token generation
CRM creation
link click tracking
activation tracking
presentation tracking
callback/info request tracking
Holding Tank conversion
closed outcome reporting
```

The quantity of leads is chosen by each BA.

Kevin may test with 250,000 leads first, then scale as other BAs add the VM module.

A Lead Batch is simply a container for one BA's uploaded or purchased group of leads.

Examples:

```txt
Kevin Test Campaign 001
Owner: TM-000001
Quantity: 250,000
Source: Apache Leads
Type: Mobile VM Leads
```

```txt
Maria VM Campaign 001
Owner: TM-000174
Quantity: 5,000
Source: Apache Leads
Type: Australian Mobile VM Leads
```

Each BA's lead batch remains owned by that BA's TM ID.

The public Holding Tank may show collective Team Magnificent momentum, but backend ownership, CRM, callback routing, and sponsor attribution must remain exact.

---

## BA Dashboard Context

Do not create a separate BA dashboard.

Add modules to the existing `.team` BA Cockpit.

The BA Cockpit should support:

```txt
Launch Center
Training
Prospect CRM
PMV
VM Campaigns
Events
Notifications
Team News
Profile
Agent Support Panel
```

The profile route remains a simple BA profile/settings surface.

The Success Profile is not the BA public/editable profile.

---

## Success Profile Context

The Success Profile comes from the New BA Discovery & Success Interview.

It belongs to:

```txt
Kevin/Admin Dashboard
  -> Database
  -> GraphRAG / Agent Memory
  -> BA support agents
```

The agents use it to support training and BA development.

The BA profile remains simple:

```txt
name
photo
phone
email
bio
calendar link
social links
notification preferences
```

The Success Profile is used by agents to personalize:

```txt
training
launch path
coaching focus
confidence support
communication style
daily action recommendations
activity coaching
```

---

## BA Support Agents Context

There are three core BA support agents.

### Ivory — Invitation Provider

Ivory helps the BA invite and communicate.

Ivory supports:

```txt
personal invitation drafts
SMS drafts
email drafts
social post drafts
follow-up drafts
callback replies
re-invite scripts
VM script drafts
```

Ivory helps the BA communicate; Ivory does not close prospects.

---

### Michael — Discovery Guide

Michael supports the New BA Discovery & Success Interview.

Michael learns the BA's:

```txt
primary why
success vision
learning style
communication preferences
support needs
confidence indicators
experience
goals
```

Michael creates the Success Profile for admin/agent support.

Michael is not an evaluator, qualifier, or judge.

---

### Steve Success — Training Coach and Activity Coach

Steve helps the BA know what to do next.

Steve uses:

```txt
Success Profile
training progress
Launch Center progress
Prospect CRM
PMV activity
VM campaign activity
events
notifications
team news
```

to generate:

```txt
today's action plan
next best action
training recommendation
CRM follow-up priority
VM campaign next step
event recommendation
encouragement based on the BA's why
```

Steve is the main daily BA support agent.

---

## Implementation Agents

Use 6 focused coding agents if possible.

### Agent 1 — Schema & Shared Types

Implement:

```txt
shared VM types
shared CRM hub types
shared agent support types
status lifecycle enums
ownership guard helpers
schema/migration definitions
```

Start with this work before UI.

---

### Agent 2 — Server API & Domain Logic

Implement:

```txt
LeadBatch domain
BulkLead domain
VMCampaign domain
ProspectCRMRecord domain
RVM token resolver
activation logic
CRM creation at token creation
close-as-new-BA logic
admin ownership correction audit
```

Preserve sponsor/owner immutability.

---

### Agent 3 — `.team` BA Cockpit UI

Implement:

```txt
/team/crm
/team/vm-campaigns
cockpit cards/modules
Prospect CRM Hub
VM campaign screens
Agent Support Panel
```

Do not create team member management.

---

### Agent 4 — `.com` RVM Prospect Experience

Implement:

```txt
/rvm/:token
RVM token resolution
activation on click
presentation display
video milestone tracking
CTA to dashboard
placement only after video_complete
```

Reuse the PMV mechanics.

---

### Agent 5 — Provider, Queue, Import & Scale

Implement:

```txt
bulk import worker
validation
dedupe
suppression / opt-out placeholder
token generation queue
CRM creation queue
VM delivery queue
provider adapter interface
manual CSV mode
placeholder LeadsRain-style adapter
webhook receiver
retry/rate limit/audit logic
```

Live sending must be feature-flagged and admin-approved.

---

### Agent 6 — Admin, Analytics, Notifications & Agent Memory

Implement:

```txt
admin VM overview
BA-by-BA campaign analytics
lead batch monitoring
activation/conversion analytics
compliance/suppression summaries
notification triggers
events/team news hooks
Success Profile -> GraphRAG/agent memory bridge stubs
admin agent oversight
```

---

## Recommended Build Order

```txt
1. Agent 1: shared types/schema/guards
2. Agent 2: server domain/API foundations
3. Agent 3: Prospect CRM Hub shell
4. Agent 4: /rvm/:token shell
5. Agent 5: import/queue/provider foundation
6. Agent 6: admin/analytics/agent memory stubs
7. Integrate all with tests
```

Do not begin high-volume provider sending until the CRM, ownership lock, token creation, and dry-run campaign paths are proven.

---

## First Task For Any Agent

Before coding, perform a repo audit and report:

```txt
What already exists?
What can be reused?
What must be modified?
What must be built new?
What files will be touched?
What risks exist?
```

Then implement only the assigned scope.

---

## Universal Acceptance Criteria

A PR is acceptable only if:

```txt
- It does not break existing /p/:token PMV behavior.
- It preserves video_complete placement rule.
- It preserves sponsor/owner immutability.
- It scopes all BA-visible data by TM ID.
- It does not create genealogy, ranks, commissions, orders, or active customer/team management.
- It keeps CRM for leads/prospects only.
- It closes CRM records when a lead becomes a BA.
- It avoids income, placement, or guaranteed spillover claims.
- It includes or updates tests where applicable.
- It documents any stubs/TODOs clearly.
```

---

## Copy-Paste Codex Prompt

```txt
You are working in devklg/momentum-creation-system-v2.

Read these docs first:
- docs/AGENT_WORK_ORCHESTRATION_PROMPT.md
- docs/VM_LEAD_CAMPAIGN_MODULE_ARCHITECTURE.md
- docs/VM_LEAD_CAMPAIGN_IMPLEMENTATION_PLAN.md
- docs/BA_SUPPORT_AGENTS_ARCHITECTURE.md
- NEW_BA_DISCOVERY_SUCCESS_INTERVIEW_SPEC.md if present

Then audit these existing areas:
- apps/team/src/routes/cockpit.tsx
- apps/team/src/routes/profile.tsx
- server/src/routes/p.ts
- packages/shared/src/types.ts
- server/src/domain/holdingTank.ts
- server/src/domain/tokens.ts
- server/src/domain/prospects.ts
- server/src/domain/invitations.ts

Mission:
Implement the assigned slice of the VM Lead Campaign Module and BA Support Agents architecture without breaking the existing PMV spine.

Core rules:
- Every lead/prospect belongs to exactly one BA by TM BA ID.
- Token creation immediately creates a Prospect CRM record.
- CRM is for leads/prospects only.
- Imported VM leads do not enter Holding Tank.
- Holding Tank placement requires video_complete.
- When a lead becomes a BA, CRM closes as new-ba and Three International becomes the active system of record.
- BA profile stays simple; Success Profile belongs to Kevin/Admin + DB + GraphRAG/Agent Memory.
- Ivory helps invitation, Michael handles discovery/personalization, Steve Success coaches training and daily activity.
- Do not build genealogy, commissions, ranks, orders, active customer management, or active team member management.

Before coding, return a short audit:
1. Existing files/components to reuse
2. Files you will modify
3. New files you will create
4. Risks
5. Test plan

Then implement only your assigned scope.
```
