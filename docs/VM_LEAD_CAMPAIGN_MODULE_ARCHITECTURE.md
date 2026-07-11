# VM Lead Campaign Module Architecture

## Momentum Creation System V2

Status: Proposed implementation architecture  
Scope: `.team` BA Cockpit, `.com` RVM prospect page, Admin oversight, Prospect CRM, VM campaign engine  
Primary boundary: Momentum manages prospects before enrollment. Three International manages active business records after enrollment.

P0 governance note (2026-07-11): live VM/RVM delivery is not approved by this architecture document. Expansion beyond dry-run/manual operation requires `constitution/acr/ACR-002-vm-rvm-live-delivery-governance.md` approval and the checklist in `docs/VM_RVM_COMPLIANCE_CHECKLIST.md`.

---

## 1. Purpose

The VM Lead Campaign Module adds a scalable ringless voicemail, SMS, email, callback, and tokenized presentation acquisition system to Momentum Creation System V2.

The module allows Kevin and approved Team Magnificent Brand Ambassadors to purchase or upload lead groups of any size, create VM campaigns, send tokenized presentation links, track lead engagement, and move activated prospects into the existing PMV / Holding Tank mechanics.

This is not a separate BA dashboard.

This is not a replacement for Three International's back office.

This is not genealogy, commission, rank, order, or customer management.

This is a Momentum prospect acquisition and follow-up system.

---

## 2. Existing Repo Alignment

The current repository already contains the foundation this module must extend.

### Existing `.team` Cockpit

The BA Cockpit already loads:

- Launch Center
- PMV summary
- PMV rows
- Invites
- Focus queue
- CRM-safe row drawers

Existing API calls include:

```txt
GET /api/cockpit/launch
GET /api/cockpit/summary
GET /api/cockpit/pmv
GET /api/cockpit/invites
```

The VM module must be added inside this existing BA Cockpit experience.

### Existing CRM Behavior

The cockpit currently states that CRM controls live inside each PMV row drawer. The VM build must promote this into a real Prospect CRM Hub while keeping the existing row CRM behavior usable.

### Existing BA Profile

The `.team` profile route already supports BA identity and settings:

- Name
- Photo
- Email
- Phone
- Timezone
- Notification preferences
- THREE BA ID
- TM BA ID
- Sponsor
- Access code

The BA-facing profile must remain simple. It must not become the Success Profile.

### Existing Token Spine

The current `.com` prospect token architecture is the model to reuse.

Current flow:

```txt
/p/:token
  -> token resolution
  -> presentation
  -> video tracking
  -> video_complete
  -> placement
  -> holding tank / dashboard
```

The existing server route protects sponsor immutability by resolving the BA from the token record, not from client input.

The video event endpoint already places a prospect only after `video_complete`. The RVM module must preserve this rule.

---

## 3. Core Architecture

```txt
BA Cockpit
   -> Optional VM Campaigns Module
   -> BA purchases/uploads leads
   -> Lead Batch created under BA TM ID
   -> Inactive lead records created
   -> Tokens generated
   -> CRM records created immediately
   -> VM / SMS / Email / callback campaign begins
   -> Lead clicks token or requests info/callback
   -> Lead becomes activated prospect
   -> /rvm/:token presentation page
   -> Video tracked
   -> Video complete
   -> CTA to dashboard / Holding Tank
   -> Collective Team Magnificent momentum leg
   -> Follow-up / enrollment
   -> CRM closed if lead becomes BA
   -> Three International back office becomes system of record
```

---

## 4. Non-Negotiable Ownership Rule

### TM ID Ownership Lock

Every prospect lead and VM lead belongs to exactly one Brand Ambassador by TM BA ID.

The TM BA ID is the permanent ownership key for all Momentum Creation System prospects.

This applies to:

- Personal prospects
- Manual CRM prospects
- PMV invitation prospects
- Referral prospects
- QR code prospects
- Social media prospects
- VM bulk leads
- Callback requests
- Info requests
- Re-invites

Collective momentum visibility must never blur ownership.

No prospect may be created without:

```txt
ownerTmBaId
sponsorTmBaId
```

No VM lead may be created without:

```txt
ownerTmBaId
sponsorTmBaId
leadBatchId
vmCampaignId
```

No client-side request may override `ownerTmBaId` or `sponsorTmBaId`.

Only Kevin/Admin may perform an audited ownership correction.

### Ownership Meaning

If a BA purchases or uploads leads, those leads are that BA's prospects and potential personally sponsored Brand Ambassadors.

Example:

```json
{
  "leadId": "lead_001",
  "ownerTmBaId": "TM-000123",
  "sponsorTmBaId": "TM-000123",
  "leadBatchId": "batch_kevin_250k_test_001",
  "vmCampaignId": "vm_kevin_001",
  "source": "apache_leads",
  "status": "imported",
  "token": "RVM-8X7KQ2"
}
```

This means:

```txt
The BA owns the lead.
The BA sees the lead in CRM.
The BA receives the callback.
The BA receives follow-up tasks.
The BA remains the sponsor attribution if the person enrolls.
```

---

## 5. CRM Boundary Rule

### Prospect CRM Boundary Rule

The Momentum CRM is a lead and prospect CRM only.

It manages people before enrollment.

When a lead or prospect becomes a Brand Ambassador, the CRM record is closed with:

```txt
disposition = new-ba
crmStatus = closed
closedReason = enrolled_as_ba
closedAt = timestamp
```

After enrollment, the person is no longer managed as an active Momentum CRM lead.

Their ongoing business record, genealogy, orders, commissions, ranks, customers, and team placement belong to the Three International back office.

Momentum may retain historical CRM activity for attribution, reporting, audit, and agent learning, but it must not manage the enrolled BA as a downline/team member inside the Momentum CRM.

### Active CRM Scope

The Momentum CRM contains:

- Personal prospects
- PMV invitation prospects
- RVM / VM leads
- Callback requests
- Info requests
- Follow-up prospects
- Holding Tank prospects
- Closed historical lead records

The Momentum CRM does not contain active team member management.

---

## 6. Token Creation to CRM Creation Rule

Whenever a PMV, RVM, QR, manual, referral, social, or personal prospect token is created, the system must immediately create or update a BA-scoped CRM record.

The CRM record is owned by the creating BA's TM ID.

The lead appears in the BA's Prospect CRM immediately with an inactive or pre-engagement status.

The lead does not appear in the collective momentum leg or Holding Tank until the PMV/RVM engagement rules are satisfied.

### Important Distinction

```txt
CRM visibility = immediately after token creation
Momentum visibility = after engagement / video completion rule
```

This means a purchased or manually added lead can be managed immediately, but the public momentum system remains authentic.

---

## 7. Lead Batch System

A Lead Batch is a container for a group of leads purchased or uploaded by one BA.

The quantity is chosen by the individual BA.

Examples:

```txt
Kevin Test Campaign 001
Owner: TM-000001
Source: Apache Leads
Quantity: 250,000
Country: US
Lead Type: Mobile VM Leads
```

```txt
Maria VM Campaign 001
Owner: TM-000174
Source: Apache Leads
Quantity: 5,000
Country: Australia
```

The batch system answers:

- Who owns these leads?
- Where did they come from?
- How many were uploaded?
- Which campaign are they attached to?
- How many were contacted?
- How many clicked?
- How many watched?
- How many entered the Holding Tank?
- How many requested callback?
- How many enrolled?

### Lead Batch Flow

```txt
BA buys/uploads leads
  -> Lead Batch created
  -> Leads imported as inactive records
  -> Leads validated, deduped, and suppressed if needed
  -> Tokens generated
  -> CRM records created immediately
  -> VM/SMS/email campaign begins
```

---

## 8. VM Campaign Engine

The VM Campaign Engine is the LeadRain-style acquisition system inside Momentum.

It should provide feature-equivalent campaign mechanics without copying proprietary branding, UI, or code.

### BA-Facing Features

Inside `.team`:

```txt
/team/vm-campaigns
```

Features:

- Create campaign
- Upload leads
- Buy/import lead batch record
- Choose approved voicemail script/audio
- Choose SMS follow-up template
- Choose email follow-up template
- Generate token links
- Schedule campaign
- Track delivery
- Track link clicks
- Track callbacks
- Track info requests
- Track video starts
- Track video completion
- Track dashboard entries
- Track Holding Tank entries
- Track closed outcomes

### Provider Adapter Layer

Do not hard-code one provider.

Use a provider abstraction:

```ts
interface RinglessVoicemailProvider {
  sendDrop(payload: VoicemailDropPayload): Promise<DropResult>;
  getStatus(dropId: string): Promise<DropStatus>;
  handleWebhook(payload: unknown): Promise<void>;
}
```

Initial provider modes:

- LeadsRain-style provider adapter
- Slybroadcast-style provider adapter
- Manual CSV export/import mode
- Future direct telecom adapter

---

## 9. RVM Prospect Page

Create a separate RVM prospect page while reusing the existing PMV mechanics.

Suggested route:

```txt
/rvm/:token
```

This page must:

- Resolve the token
- Activate the VM lead when clicked
- Show the presentation
- Track video started / 25 / 50 / 75 / complete
- Show CTA after video
- Route to dashboard / Holding Tank
- Preserve ownerTmBaId and sponsorTmBaId
- Preserve source attribution

The RVM page is separate because voicemail leads have a different acquisition context.

The mechanics remain the same because PMV is the core momentum engine.

---

## 10. Activation Rules

Imported leads are not active prospects.

A lead becomes activated when one of the following occurs:

- Link clicked
- Info requested
- Callback requested
- Request to speak to someone
- Presentation started

Activation updates the CRM status, but does not automatically create public momentum placement.

### Placement Rule

Placement / Holding Tank visibility follows the existing PMV rule:

```txt
video_complete -> placeProspect -> positionNumber -> Holding Tank visibility
```

Do not place leads into the public momentum leg merely because they were imported, contacted, or tokenized.

---

## 11. Prospect CRM Hub

The existing CRM row drawers should be promoted into a standalone Prospect CRM Hub.

Suggested route:

```txt
/team/crm
```

Views:

- All prospects
- Personal prospects
- PMV prospects
- VM leads
- Callback requests
- Info requests
- Needs follow-up
- Watching / partial video
- Completed presentation
- Holding Tank
- Closed / Not Now
- Closed as New BA

Contact record:

- Name
- Phone
- Email
- Source
- Owner TM BA ID
- Sponsor TM BA ID
- Campaign
- Batch
- Tags
- Status
- Notes
- Follow-up date
- Disposition
- Activity timeline
- Presentation activity
- VM activity
- SMS/email history
- Callback requests

---

## 12. BA Cockpit Placement

Do not create a separate BA dashboard.

Add modules to the existing BA Cockpit:

```txt
Cockpit
  -> Launch Center
  -> Training
  -> Prospect CRM
  -> PMV
  -> VM Campaigns
  -> Events
  -> Notifications
  -> Team News
  -> Calendar / Tasks
  -> Analytics
  -> Simple Profile
```

Exclude:

- Team member management
- Binary tree
- Genealogy
- Commissions
- Ranks
- Orders
- Customer management

Those belong to Three International.

---

## 13. Admin / Kevin Oversight

Kevin's Admin Dashboard should include:

- Global VM campaign oversight
- BA campaign oversight
- Lead batch monitoring
- Activation rates
- Click rates
- Video start rates
- Video completion rates
- Dashboard entries
- Holding Tank entries
- Callback requests
- Closed as BA outcomes
- Compliance and suppression reports
- Provider performance
- Cost per activation
- Cost per video completion
- Cost per new BA

### Ownership Correction

Kevin/Admin may perform ownership correction only through an audited process.

Audit fields:

```txt
oldOwnerTmBaId
newOwnerTmBaId
oldSponsorTmBaId
newSponsorTmBaId
reason
adminUserId
changedAt
```

---

## 14. Success Profile / Agent Memory Boundary

The BA-facing profile remains simple.

The Success Profile created by the New BA Discovery & Success Interview belongs to:

```txt
Kevin/Admin Dashboard
  -> Database
  -> GraphRAG / Agent Memory
  -> Steve Success + Training Agents
  -> Personalized BA support
```

The Success Profile is not a public BA profile management screen.

Agents use the Success Profile to personalize:

- Training
- Launch path
- Confidence support
- Coaching
- Development
- Communication style
- Daily success guidance

This aligns with the Discovery Interview principle that the Success Profile exists for personalization, orientation, launch planning, coaching, mentorship, AI guidance, community placement, and long-term success.

---

## 15. Events, Notifications, and Team News

### Notifications

Trigger notifications for:

- VM lead activated
- Prospect clicked token
- Prospect started presentation
- Prospect completed presentation
- Callback requested
- Info requested
- Follow-up due
- Campaign completed
- Import completed
- Event starting soon

### Events

Support:

- Team webinars
- Training sessions
- Product overview calls
- Launch calls
- Replay links
- Registration tracking

### Team News

Support:

- Announcements
- Success stories
- Training updates
- Challenge updates
- Team Magnificent momentum updates

---

## 16. Data Model Draft

### LeadBatch

```json
{
  "leadBatchId": "batch_001",
  "ownerTmBaId": "TM-000123",
  "source": "apache_leads",
  "country": "US",
  "leadType": "mobile_vm",
  "quantityImported": 250000,
  "status": "processing",
  "createdAt": "",
  "completedAt": null
}
```

### BulkLead

```json
{
  "leadId": "lead_001",
  "leadBatchId": "batch_001",
  "vmCampaignId": "vm_001",
  "ownerTmBaId": "TM-000123",
  "sponsorTmBaId": "TM-000123",
  "firstName": "",
  "lastName": "",
  "phone": "",
  "email": "",
  "city": "",
  "stateOrRegion": "",
  "country": "",
  "token": "RVM-8X7KQ2",
  "status": "imported",
  "activatedAt": null,
  "createdAt": ""
}
```

### ProspectCRMRecord

```json
{
  "crmRecordId": "crm_001",
  "prospectId": "prospect_001",
  "leadId": "lead_001",
  "ownerTmBaId": "TM-000123",
  "sponsorTmBaId": "TM-000123",
  "source": "rvm",
  "status": "inactive_pre_engagement",
  "disposition": null,
  "followUpDueAt": null,
  "closedAt": null,
  "closedReason": null
}
```

### VMCampaign

```json
{
  "vmCampaignId": "vm_001",
  "ownerTmBaId": "TM-000123",
  "leadBatchId": "batch_001",
  "name": "Kevin 250k VM Test 001",
  "provider": "leadsrain_style_adapter",
  "status": "draft",
  "voicemailAudioId": "audio_001",
  "smsTemplateId": "sms_001",
  "emailTemplateId": "email_001",
  "scheduledAt": null,
  "createdAt": ""
}
```

---

## 17. Status Lifecycle

Recommended lead/prospect statuses:

```txt
imported
validated
suppressed
crm_created
token_created
queued
voicemail_sent
sms_sent
email_sent
link_clicked
activated
info_requested
callback_requested
presentation_started
presentation_25
presentation_50
presentation_75
presentation_completed
dashboard_entered
holding_tank
closed_new_ba
closed_new_customer
closed_not_interested
closed_later
expired
archived
```

---

## 18. Scale Requirements

The first Kevin test may use 250,000 leads.

The architecture must later support:

- Multiple BAs
- Independent lead quantities per BA
- 100,000+ lead batches
- 1,000,000+ lead campaigns
- 10,000,000+ total lead universe

Use queue-based processing:

```txt
CSV/provider import
  -> validation queue
  -> dedupe queue
  -> suppression queue
  -> token generation queue
  -> CRM creation queue
  -> delivery queue
  -> webhook event queue
  -> activation queue
  -> analytics update queue
```

Required capabilities:

- Chunked imports
- Deduplication
- Phone normalization
- Email validation
- Suppression list
- Opt-out handling
- DNC/compliance status
- Batch processing
- Queue workers
- Rate limits
- Provider webhooks
- Retry logic
- Audit logs

---

## 19. Implementation Order

1. Add shared VM and CRM ownership types.
2. Add database schema/migrations for LeadBatch, BulkLead, VMCampaign, VMDeliveryEvent, ProspectCRMRecord, ProspectTimelineEvent.
3. Add token creation to CRM creation service.
4. Add TM ID ownership lock enforcement.
5. Add Prospect CRM Hub route in `.team`.
6. Add VM Campaigns route in `.team`.
7. Add `/rvm/:token` route in `.com`.
8. Add server RVM token resolver and activation route.
9. Reuse or mirror video event tracking and placement logic.
10. Add provider adapter interface.
11. Add import/upload processing.
12. Add BA campaign analytics.
13. Add Kevin/Admin VM oversight.
14. Add notifications/events hooks.
15. Add Success Profile -> GraphRAG / agent memory linkage for BA support.

---

## 20. Final Boundary Statement

The VM Lead Campaign Module is an acquisition and prospect management engine.

It feeds PMV.

It feeds the Prospect CRM.

It feeds the Holding Tank only after engagement rules are satisfied.

It does not manage active BAs after enrollment.

It does not replace Three International.

It protects every BA's prospect ownership by TM BA ID.

It allows collective Team Magnificent momentum to be visible while keeping lead ownership, callback routing, follow-up, CRM access, and personally sponsored attribution exact and non-confusing.
