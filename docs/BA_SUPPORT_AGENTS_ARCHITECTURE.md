# BA Support Agents Architecture

## Momentum Creation System V2

Status: Implementation architecture and Codex directive  
Repository: `devklg/momentum-creation-system-v2`  
Primary apps affected: `apps/team`, `apps/admin`, `server`, `packages/shared`  
Related docs:

- `docs/VM_LEAD_CAMPAIGN_MODULE_ARCHITECTURE.md`
- `docs/VM_LEAD_CAMPAIGN_IMPLEMENTATION_PLAN.md`
- `NEW_BA_DISCOVERY_SUCCESS_INTERVIEW_SPEC.md` when present in repo/project context

---

## 1. Purpose

The BA Support Agents are not prospect-facing closers.

Their purpose is to empower, support, guide, train, and activate the Brand Ambassador.

The agents exist to help each BA know:

```txt
Who should I invite?
What should I say?
What training should I complete?
Who needs follow-up?
What activity should I do next?
How do I keep momentum today?
```

The agents are support infrastructure for the BA journey, not replacement for human relationship.

They support Momentum Creation System V2 by turning the BA dashboard into an intelligent daily operating environment.

---

## 2. Core Agent Philosophy

The agents shall:

- Encourage
- Guide
- Teach
- Suggest
- Personalize
- Clarify
- Prioritize next actions
- Support confidence
- Help the BA create daily momentum

The agents shall never:

- Pressure
- Shame
- Judge
- Rank the BA's worth
- Predict success or failure
- Make earnings claims
- Make placement promises
- Replace corporate compliance
- Replace Three International's back office
- Manage genealogy, commissions, ranks, orders, or active team members

The agents exist to increase skill, confidence, clarity, consistency, and activity.

---

## 3. The Three Core BA Support Agents

### Agent 1 — Ivory Invitation Assistant

Primary role:

```txt
Invitation Provider
```

Ivory helps the BA create invitations and outreach language.

Ivory supports:

- Who-do-you-know prompts
- Personal prospect invitation scripts
- SMS drafts
- Email drafts
- Social post drafts
- QR/link share messages
- VM campaign script drafts
- Follow-up scripts
- Re-invite scripts
- Callback response scripts
- Tone adaptation based on relationship type

Ivory does not close prospects.

Ivory helps the BA communicate clearly, warmly, and consistently.

#### Ivory Inputs

Ivory may use:

- BA profile basics
- BA Success Profile context through server-side agent memory
- Prospect CRM status
- Prospect source
- Prospect relationship type
- PMV lifecycle stage
- VM campaign status
- Follow-up due date
- Prior notes
- Approved master content / templates
- Compliance-safe language rules

#### Ivory Outputs

Ivory produces:

- Invitation message
- Follow-up message
- Callback reply
- Re-invite message
- VM script draft
- SMS/email sequence suggestions
- Suggested next communication step

Ivory output must be editable by the BA before sending unless a future approved automation explicitly allows otherwise.

---

### Agent 2 — Michael Discovery Guide

Primary role:

```txt
Discovery Interview and Personalization Guide
```

Michael supports the new BA immediately after enrollment.

Michael's main job is to understand the BA so the system can support the BA personally.

Michael conducts or supports the New BA Discovery & Success Interview.

Michael is not an evaluator.

Michael is not a qualifier.

Michael is not a gatekeeper of human worth.

Michael gathers information for support and personalization.

#### Michael Inputs

Michael may use:

- New BA registration data
- Sponsor / access code context
- Discovery interview responses
- Learning style answers
- Communication preferences
- Confidence indicators
- Goals
- Primary why
- Vision
- Support needs

#### Michael Outputs

Michael produces:

- Interview transcript
- Interview summary
- Success Profile
- Recommended orientation path
- Recommended launch path
- Recommended coaching focus
- Agent memory record
- Admin briefing for Kevin
- Steve Success context package

#### Michael Boundaries

Michael shall not:

- Rank the BA
- Predict success or failure
- Limit opportunity
- Assign worth
- Shame low confidence
- Force a single path

Michael prepares the system to support the BA better.

---

### Agent 3 — Steve Success Coach

Primary role:

```txt
Training Coach and Activity Coach
```

Steve Success helps the BA know what to do next.

Steve turns the Success Profile, training progress, CRM status, PMV activity, VM campaign activity, events, notifications, and daily tasks into a clear daily action plan.

Steve supports:

- Daily activity coaching
- Training recommendations
- Launch Center guidance
- Follow-up prioritization
- CRM next actions
- VM campaign next actions
- PMV prospect next actions
- Event attendance reminders
- Confidence support
- Encouragement
- Skill reinforcement
- Duplication habits

Steve is the primary daily BA support agent.

#### Steve Inputs

Steve may use:

- Success Profile
- Launch Center progress
- Training progress
- CRM focus queue
- PMV lifecycle states
- VM campaign metrics
- Callback requests
- Follow-up due dates
- Events and team news
- Notifications
- BA communication preferences
- BA learning style
- BA primary why
- BA stated goals

#### Steve Outputs

Steve produces:

- Today's action plan
- Next best action
- Training recommendation
- Follow-up priority list
- Suggested message to send through Ivory
- Event recommendation
- VM campaign recommendation
- Encouragement based on primary why
- Weekly progress summary
- Admin-visible coaching signals

Steve does not manage active downline members.

Steve supports the BA's Momentum Creation activity.

---

## 4. Agent Relationship Model

```txt
Michael learns the BA.
Steve develops the BA.
Ivory helps the BA communicate.
```

Expanded flow:

```txt
New BA enrolls
  -> Michael Discovery Interview
  -> Success Profile saved to DB
  -> Success Profile indexed into GraphRAG / Agent Memory
  -> Launch Center personalizes
  -> Steve Success recommends training and daily actions
  -> Ivory creates invitation and follow-up language
  -> BA sends invitations / runs VM campaigns / follows up
  -> CRM and PMV generate new activity signals
  -> Steve updates next action guidance
```

---

## 5. Success Profile Boundary

The Success Profile is not the BA's public profile.

The BA-facing profile remains simple:

- Name
- Photo
- Phone
- Email
- Bio
- Calendar link
- Social links
- Notification preferences

The Success Profile belongs to:

```txt
Kevin/Admin Dashboard
  -> Database
  -> GraphRAG / Agent Memory
  -> Agent Support Context
```

The agents use the Success Profile to support training and development.

The BA does not manage the Success Profile as a normal editable profile screen.

### Success Profile Use Cases

Agents use it to personalize:

- Training path
- Launch path
- Coaching focus
- Communication cadence
- Encouragement style
- Daily action recommendations
- Confidence support
- Follow-up coaching
- Leadership development suggestions

---

## 6. Agent Memory Architecture

The agent memory layer should store and retrieve BA support context.

### Data Sources

```txt
Discovery Interview
Success Profile
Training progress
Launch Center progress
CRM activity
PMV activity
VM campaign activity
Event participation
Notification interactions
BA stated goals
Admin notes
```

### Storage Targets

Use the existing multi-database strategy where appropriate:

```txt
Postgres / relational store
  -> canonical BA support records and statuses

Mongo
  -> transcripts, summaries, flexible agent event documents

Neo4j
  -> relationship graph: BA, sponsor, prospects, campaigns, training, goals, support needs

Chroma / vector DB
  -> semantic retrieval of interview summaries, coaching notes, training context, scripts

GraphRAG
  -> agent retrieval layer for personalized support
```

### Agent Memory Rule

Agents may retrieve only the context necessary to support the BA's Momentum Creation activity.

Agents must not expose private Success Profile details to prospects.

Agents must not expose another BA's private prospect ownership, notes, or Success Profile.

---

## 7. BA Dashboard Integration

Do not create a separate agent dashboard.

Agents live inside the existing `.team` BA Cockpit.

Recommended cockpit modules:

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
  -> Profile
  -> Agent Support Panel
```

### Agent Support Panel

Add a prominent panel to the BA Cockpit:

```txt
What should I do next?
```

This panel is powered primarily by Steve Success.

It may show:

- Today's top 3 actions
- Prospect to follow up with
- Training lesson to complete
- Invitation to send
- Event to attend
- VM campaign task
- Encouragement tied to BA's why

Example:

```txt
Today's Momentum Plan

1. Follow up with Angela — she completed the presentation yesterday.
2. Send 3 personal invitations using Ivory.
3. Complete the 8-minute training on callback conversations.
```

---

## 8. CRM Integration

The agents support the Prospect CRM.

The CRM is for leads and prospects only.

When a lead becomes a BA, the CRM closes the record as:

```txt
disposition = new-ba
crmStatus = closed
closedReason = enrolled_as_ba
```

Then Three International becomes the system of record for active BA business management.

### Ivory + CRM

Ivory helps write:

- Initial invite
- Follow-up
- Callback reply
- Re-invite
- Soft nudge
- VM/SMS/email campaign language

### Steve + CRM

Steve helps decide:

- Who needs follow-up now
- Which prospect matters today
- Which message type to use
- Which CRM task should be prioritized
- Which prospect should be moved to later / not interested / closed

### Michael + CRM

Michael does not manage prospects.

Michael manages BA understanding and personalization.

---

## 9. VM Campaign Integration

The VM Campaign Module creates acquisition activity.

Agents help the BA use it wisely.

### Ivory in VM Campaigns

Ivory can draft:

- VM message script
- SMS follow-up
- Email follow-up
- Callback reply
- Second-touch message

All high-volume VM/SMS/email language must follow approved templates and compliance guardrails.

### Steve in VM Campaigns

Steve can recommend:

- Start with a smaller test batch
- Review campaign analytics
- Follow up with activated leads
- Pause campaign if callbacks are stacking up
- Complete training before scaling volume
- Attend a campaign review session

### Michael in VM Campaigns

Michael does not run VM campaigns.

Michael's Success Profile helps Steve and Ivory adapt coaching and communication support to the BA.

---

## 10. Training Integration

Training is a core BA support surface.

Agents must connect to training progress.

### Steve Training Coach

Steve recommends:

- Next lesson
- Review lesson
- Practice activity
- Script practice
- Event attendance
- Launch Center step
- VM campaign readiness training

Recommendations should be based on:

- Success Profile
- Learning style
- Confidence level
- Launch stage
- CRM activity
- Prospecting behavior
- Missed tasks
- Recent wins

### Ivory Training Connection

Ivory may suggest micro-training when the BA struggles with language.

Example:

```txt
Before sending this follow-up, review the 5-minute lesson on curiosity-based invitations.
```

### Michael Training Connection

Michael determines recommended orientation path from the Discovery Interview.

---

## 11. Events, Notifications, and Team News Integration

Agents must use platform events to guide the BA.

### Notifications

Steve can turn notifications into action.

Examples:

```txt
A prospect completed the presentation. Follow up within 24 hours.
A callback was requested. Respond now.
A VM lead activated. Review their CRM timeline.
A training event starts tonight. Attend live.
```

### Events

Steve can recommend event attendance based on BA needs.

Examples:

- New BA orientation
- VM campaign training
- Follow-up training
- Product overview call
- Team Magnificent webinar

### Team News

Steve can use team news as encouragement and context, but must not turn it into pressure or hype.

---

## 12. Agent Permissions

### Ivory Permissions

Can read:

- BA basic profile
- BA Success Profile summary through safe agent context
- CRM prospect context owned by the BA
- PMV/VM status for owned prospects
- approved templates

Can write:

- draft messages
- suggested scripts
- proposed CRM note draft if BA approves

Cannot:

- send messages automatically unless future approved workflow exists
- edit ownership
- close CRM records without BA/admin action

### Michael Permissions

Can read:

- BA registration context
- Discovery Interview session
- prior interview answers if resuming

Can write:

- interview transcript
- interview summary
- Success Profile
- recommendations
- agent memory records

Cannot:

- manage prospects
- send invitations
- change CRM ownership
- make enrollment claims

### Steve Permissions

Can read:

- Success Profile safe context
- training progress
- Launch Center progress
- CRM tasks
- PMV activity
- VM campaign activity
- events/notifications/team news

Can write:

- recommended action plan
- coaching notes
- suggested tasks
- suggested training assignments
- agent memory observations

Cannot:

- alter ownership
- manage active Three back-office BA records
- make earnings/rank/placement claims

---

## 13. Data Model Draft

### SupportAgentKind

```ts
export type SupportAgentKind = 'ivory' | 'michael' | 'steve_success';
```

### AgentInteractionRecord

```ts
export interface AgentInteractionRecord {
  interactionId: string;
  agent: SupportAgentKind;
  tmBaId: string;
  relatedProspectId: string | null;
  relatedCampaignId: string | null;
  kind:
    | 'invitation_draft'
    | 'followup_draft'
    | 'discovery_interview'
    | 'success_profile_generated'
    | 'training_recommendation'
    | 'daily_action_plan'
    | 'vm_campaign_recommendation'
    | 'crm_next_action';
  summary: string;
  payload: Record<string, unknown>;
  createdAt: string;
}
```

### DailyActionPlan

```ts
export interface DailyActionPlan {
  planId: string;
  tmBaId: string;
  generatedAt: string;
  primaryFocus: 'invite' | 'follow_up' | 'training' | 'vm_campaign' | 'event' | 'launch';
  actions: Array<{
    actionId: string;
    label: string;
    reason: string;
    priority: 1 | 2 | 3 | 4 | 5;
    relatedProspectId: string | null;
    relatedCampaignId: string | null;
    suggestedAgent: SupportAgentKind | null;
    dueAt: string | null;
    completedAt: string | null;
  }>;
}
```

### SuccessProfileAgentContext

```ts
export interface SuccessProfileAgentContext {
  tmBaId: string;
  primaryWhy: string | null;
  successVision: string | null;
  learningStyle: {
    watching: number;
    reading: number;
    listening: number;
    doing: number;
  };
  communicationPreferences: string[];
  supportNeeds: string[];
  recommendedOrientationPath: string | null;
  recommendedLaunchPath: string | null;
  recommendedCoachingFocus: string | null;
  updatedAt: string;
}
```

---

## 14. API Endpoint Draft

### Agent Context APIs

```txt
GET  /api/agents/context/me
GET  /api/agents/context/:tmBaId        admin only
POST /api/agents/interactions
GET  /api/agents/interactions
```

### Ivory APIs

```txt
POST /api/agents/ivory/invitation-draft
POST /api/agents/ivory/followup-draft
POST /api/agents/ivory/callback-reply-draft
POST /api/agents/ivory/vm-script-draft
```

### Michael APIs

```txt
GET  /api/agents/michael/session
POST /api/agents/michael/session
POST /api/agents/michael/response
POST /api/agents/michael/complete
GET  /api/agents/michael/success-profile
```

### Steve Success APIs

```txt
GET  /api/agents/steve/today
POST /api/agents/steve/action/:actionId/complete
POST /api/agents/steve/training-recommendation
POST /api/agents/steve/crm-next-action
POST /api/agents/steve/vm-campaign-next-action
```

### Admin APIs

```txt
GET /api/admin/agents/overview
GET /api/admin/agents/ba/:tmBaId/success-profile
GET /api/admin/agents/ba/:tmBaId/interactions
GET /api/admin/agents/graphrag/status
```

---

## 15. UI Route Draft

### `.team`

```txt
/team/cockpit
/team/agents
/team/agents/ivory
/team/agents/michael
/team/agents/steve
/team/training
/team/crm
/team/vm-campaigns
```

### Recommended UI Pattern

Do not force the BA to think about separate agents first.

Use job-to-be-done language in the cockpit:

```txt
What should I do next?      -> Steve
Help me invite someone      -> Ivory
Complete my success interview -> Michael
```

Agent names can appear as guides, but the user experience should be action-centered.

---

## 16. Implementation Order

### Sprint 1 — Agent Types and Boundaries

Tasks:

1. Add shared agent types.
2. Add `SupportAgentKind`.
3. Add `AgentInteractionRecord`.
4. Add `DailyActionPlan`.
5. Add `SuccessProfileAgentContext`.
6. Add permission/boundary comments.

### Sprint 2 — Success Profile Agent Context

Tasks:

1. Create server service to read Success Profile safe context.
2. Add admin-only full Success Profile read.
3. Add BA-safe agent context read.
4. Add GraphRAG indexing stub.
5. Add tests ensuring BA profile route does not expose Success Profile fields.

### Sprint 3 — Michael Discovery Session

Tasks:

1. Implement Michael session domain.
2. Add response capture.
3. Add completion flow.
4. Generate Success Profile.
5. Store transcript/summary.
6. Write Success Profile to DB and agent memory.

### Sprint 4 — Steve Daily Action Coach

Tasks:

1. Create daily action plan generator.
2. Pull CRM focus queue.
3. Pull PMV activity.
4. Pull VM campaign activity.
5. Pull training progress.
6. Pull event/notification context.
7. Generate top 3 actions.
8. Add cockpit panel.

### Sprint 5 — Ivory Invitation Assistant

Tasks:

1. Create invitation draft endpoint.
2. Create follow-up draft endpoint.
3. Create callback reply draft endpoint.
4. Create VM script draft endpoint.
5. Use approved templates.
6. Add UI buttons inside CRM/PMV/VM screens.

### Sprint 6 — Admin Oversight and GraphRAG

Tasks:

1. Add admin agent overview.
2. Add agent interaction timeline.
3. Add GraphRAG status screen.
4. Add agent memory health checks.
5. Add admin ability to review Success Profile and coaching signals.

---

## 17. Codex Master Prompt

Use this prompt to implement the BA Support Agents architecture.

```txt
You are implementing the BA Support Agents layer for Momentum Creation System V2.

Read:
- docs/BA_SUPPORT_AGENTS_ARCHITECTURE.md
- docs/VM_LEAD_CAMPAIGN_MODULE_ARCHITECTURE.md
- docs/VM_LEAD_CAMPAIGN_IMPLEMENTATION_PLAN.md
- NEW_BA_DISCOVERY_SUCCESS_INTERVIEW_SPEC.md if present

Mission:
Build the architecture foundation for three BA support agents:

1. Ivory — Invitation Provider
Helps the BA create invitations, follow-ups, callback replies, VM scripts, SMS/email drafts, and prospecting language.

2. Michael — Discovery Guide
Conducts the New BA Discovery & Success Interview, generates the Success Profile, and stores it for admin/agent support.

3. Steve Success — Training and Activity Coach
Uses the Success Profile, training progress, CRM, PMV, VM campaigns, notifications, events, and team news to tell the BA what to do next.

Core principle:
The agents empower and support the BA. They do not pressure, judge, qualify, rank, predict success/failure, make earnings claims, make placement promises, or replace Three International.

Hard boundaries:
- Momentum manages prospects before enrollment.
- Three International manages active BA/customer/order/rank/commission/genealogy records after enrollment.
- CRM is for leads/prospects only.
- Success Profile is not the BA editable profile.
- Success Profile belongs to Kevin/Admin + DB + GraphRAG/Agent Memory.
- Agents use Success Profile to support training and development.
- No agent may alter prospect ownership or sponsor attribution.
- No agent may expose another BA's private prospects or Success Profile.

Implementation sequence:
1. Add shared agent types.
2. Add server agent context services.
3. Add Success Profile safe context retrieval.
4. Add Michael session skeleton.
5. Add Steve daily action plan skeleton.
6. Add Ivory draft generation skeleton.
7. Add .team cockpit support panel.
8. Add admin/agent memory stubs.

Do not build full LLM integration in the first pass unless the repo already has a standard provider abstraction. Stub generation services with deterministic placeholder output and clear TODOs.

Preserve existing PMV token behavior, video_complete placement rule, sponsor immutability, and BA Cockpit structure.
```

---

## 18. Final Architecture Statement

The BA Support Agents are the intelligence layer of the `.team` experience.

```txt
Ivory helps the BA invite.
Michael helps the system understand the BA.
Steve helps the BA know what to do next.
```

Together they support the BA's growth, training, activity, confidence, and momentum without replacing human relationship or the Three International back office.
