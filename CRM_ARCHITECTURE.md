# CRM_ARCHITECTURE.md

# Momentum Creation System V2

## Relationship, Momentum, and Success CRM Architecture

Version 1.0

Constitutional Authority:
MOMENTUM_CREATION_SYSTEM_V2_FOUNDATION.md

Companion Governance:
SCHEMA_GOVERNANCE.md
MULTI_DB_AGENT_LEARNING_GOVERNANCE.md
AGENT_ARCHITECTURE.md
PMV_ARCHITECTURE.md
COMMUNITY_ARCHITECTURE.md
LAUNCH_CENTER_ARCHITECTURE.md
ORIENTATION_ARCHITECTURE.md

---

# DOCUMENT PURPOSE

This document defines the complete Momentum Creation System CRM architecture.

This CRM is not a traditional transaction CRM.

It is a relationship, momentum, and success CRM.

It governs:

* CRM philosophy
* Relationship-first design
* Prospect management
* Brand Ambassador management
* Success management
* Activity tracking
* Follow-up management
* Momentum tracking
* Prospect CRM
* Brand Ambassador CRM
* Success Profile CRM
* Discovery Interview CRM
* PMV CRM
* Training CRM
* Event CRM
* Community CRM
* Activity architecture
* Follow-up architecture
* Timeline architecture
* CRM dashboard architecture
* CRM recommendation architecture
* CRM intelligence architecture
* Integrations with PMV, Michael, Ivory, Daily Success Coach, Launch Center, Orientation, Training, and Events

The foundation establishes that technology should strengthen relationships rather than replace them.

The CRM exists to preserve context, support timing, create clarity, and help humans care for people well.

---

# PAGE 1 - GOVERNING PRINCIPLE

## CRM Serves Relationship

The Momentum Creation System CRM exists to help people steward relationships, momentum, and success.

It does not exist to reduce people to records.

It does not exist to pressure action.

It does not exist to rank human worth.

It exists to help a Brand Ambassador, sponsor, mentor, or leader understand:

* Who needs support?
* What happened recently?
* What context matters?
* What follow-up is appropriate?
* What momentum exists?
* Where is confidence growing?
* Where is confusion appearing?
* What human relationship should be strengthened next?

The CRM must preserve the constitutional order:

People first.

Technology second.

AI assists.

Humans decide.

---

# PAGE 2 - CRM PHILOSOPHY

## Relationship Memory, Not Transaction Memory

The CRM is the relationship memory of Momentum Creation System V2.

It stores context so humans can follow up thoughtfully, mentor responsibly, and support momentum.

## CRM Must Protect Trust

The CRM must never create the feeling that people are being processed, chased, or scored for pressure.

Every CRM view should reinforce:

* Respect
* Timing
* Clarity
* Encouragement
* Stewardship
* Support

## CRM Is a Compass

CRM data should point to the next useful human action.

It should not replace judgment.

It should not create hidden urgency.

It should make care easier.

---

# PAGE 3 - RELATIONSHIP-FIRST DESIGN

## Design Principle

Every CRM screen, field, note, recommendation, and timeline entry should answer:

"How does this help preserve or strengthen the relationship?"

## Relationship-First Fields

CRM should prioritize:

* Relationship source
* Preferred communication context
* Last meaningful touchpoint
* Support needs
* Timing notes
* Questions asked
* Follow-up promises
* Boundaries and pause instructions
* Success context

## Relationship Boundaries

CRM must not encourage:

* Pressure messaging
* Over-contacting
* Over-interpretation of engagement
* Labels that diminish dignity
* Hidden qualification judgments
* Public comparison

Relationship-first design means the CRM helps the user slow down when slowing down protects trust.

---

# PAGE 4 - SUCCESS MANAGEMENT PHILOSOPHY

## Success Is Transformation

The foundation defines transformation as the true product.

CRM success management therefore tracks more than activity.

It tracks signals of:

* Understanding
* Confidence
* Participation
* Consistency
* Contribution
* Leadership
* Mentorship
* Community connection

## Success Is Personal

Success Profile context matters because each Brand Ambassador arrives with unique goals, motivations, fears, strengths, and dreams.

CRM should help humans remember the person behind the activity.

## Success Boundary

CRM success management must not become pressure management.

Success context should guide support, not judgment.

---

# PAGE 5 - ACTIVITY AND MOMENTUM PHILOSOPHY

## Activity Is Evidence, Not Identity

Activity shows what happened.

It does not define who a person is.

## Momentum Is Movement

Momentum is sustained forward progress resulting from consistent action, learning, growth, contribution, and leadership.

CRM momentum tracking should identify movement:

* Prospect exploration
* Follow-up completion
* Orientation progress
* Launch progress
* Training progress
* Event attendance
* Daily action rhythm
* Contribution
* Mentorship

## Momentum Boundary

Momentum tracking must avoid shame.

If momentum slows, CRM should recommend support, simplification, or human connection.

---

# PAGE 6 - CRM ARCHITECTURE OVERVIEW

## CRM Layers

The CRM architecture has eight layers:

1. Canonical entity records
2. Activity events
3. Timeline entries
4. Follow-up obligations
5. Relationship notes
6. Momentum state
7. Recommendations
8. Intelligence and learning

## Data Layer Roles

Mongo owns canonical CRM records and activity truth.

Neo4j owns relationship paths.

Chroma owns semantic summaries and retrieval memory.

GraphRAG grounds recommendations in real evidence.

Agents may recommend.

Humans own relationship action.

## Core CRM Collections

* `crm_profiles`
* `crm_notes`
* `crm_activities`
* `crm_timelines`
* `follow_ups`
* `relationship_contexts`
* `momentum_snapshots`
* `agent_recommendations`
* `agent_outcomes`

---

# PAGE 7 - CRM ENTITY MODEL

## CRM Entities

The CRM includes these primary entity views:

* Prospect CRM
* Brand Ambassador CRM
* Success Profile CRM
* Discovery Interview CRM
* PMV CRM
* Training CRM
* Event CRM
* Community CRM

## Entity Design Rule

Each CRM entity must define:

* Purpose
* Ownership
* Lifecycle
* Statuses
* Activities
* Relationships
* Integrations

## Entity Boundary

CRM entity views may combine context.

They may not create duplicate canonical business records.

Canonical schema remains the source.

CRM is a relationship and timeline interface over governed data.

---

# PAGE 8 - PROSPECT CRM

## Purpose

Prospect CRM helps a BA steward a prospect relationship with respect, timing, education, and follow-up care.

## Ownership

The assigned BA owns the relationship.

PMV owns engagement awareness.

Ivory owns invitation and follow-up wording support.

CRM owns notes, activity, timeline, and follow-up obligations.

## Lifecycle

* `identified`
* `invited`
* `opened`
* `engaged`
* `conversation_ready`
* `webinar_ready`
* `holding_tank`
* `not_now`
* `enrolled`
* `expired`

## Statuses

* `active`
* `waiting`
* `follow_up_due`
* `conversation_scheduled`
* `holding`
* `paused`
* `closed_respectfully`
* `converted_to_ba`

## Activities

* Invitation sent
* Link opened
* PMV milestone reached
* Follow-up created
* Follow-up completed
* Question recorded
* Webinar reserved
* Callback requested
* Holding Tank note added

## Relationships

* Prospect belongs to assigned BA
* Prospect has invitations
* Prospect has PMV record
* Prospect has follow-ups
* Prospect has CRM notes
* Prospect may convert to Brand Ambassador

## Integrations

* PMV provides engagement summary
* Ivory drafts respectful language
* CRM schedules and records follow-up
* Events provide webinar context
* Launch Center activates after enrollment

---

# PAGE 9 - BRAND AMBASSADOR CRM

## Purpose

Brand Ambassador CRM helps sponsors, mentors, and leaders support a BA's growth, consistency, contribution, and success path.

## Ownership

The BA owns their journey.

Sponsor and mentor own relational support.

CRM owns support context, timeline, notes, and follow-up obligations.

## Lifecycle

* `new_member`
* `welcomed`
* `oriented`
* `launching`
* `learning`
* `participating`
* `consistent`
* `contributing`
* `emerging_leader`
* `mentor`

## Statuses

* `active`
* `needs_welcome`
* `orientation_due`
* `launch_active`
* `training_active`
* `support_needed`
* `paused`
* `reengaging`

## Activities

* Orientation started
* Orientation completed
* Launch stage completed
* Training module completed
* Daily action completed
* Event attended
* Contribution recorded
* Sponsor touchpoint recorded
* Mentor connection recorded

## Relationships

* BA has sponsor
* BA may have mentor
* BA has Success Profile
* BA has Discovery Interview
* BA has launch record
* BA has training progress
* BA has daily actions
* BA has events and contributions

## Integrations

* Michael supports mentor-style guidance
* Daily Success Coach creates daily rhythm
* Launch Center provides stage context
* Orientation provides readiness context
* Training provides learning context
* Community provides belonging and contribution context

---

# PAGE 10 - SUCCESS PROFILE CRM

## Purpose

Success Profile CRM helps support become personal rather than generic.

It reminds humans and agents what kind of support, pace, learning, and encouragement fit the BA.

## Ownership

The BA owns the meaning of their Success Profile.

The system stores the profile.

Sponsors, mentors, and agents use it only to support the BA.

## Lifecycle

* `not_started`
* `started`
* `completed`
* `review_due`
* `updated`
* `archived`

## Statuses

* `available`
* `incomplete`
* `needs_review`
* `member_update_requested`
* `support_sensitive`

## Activities

* Profile created
* Why captured
* Learning style captured
* Communication preference captured
* Support need captured
* Profile updated
* Profile referenced by recommendation

## Relationships

* Success Profile belongs to BA
* Success Profile informs Orientation
* Success Profile informs Launch Center
* Success Profile informs Daily Success Coach
* Success Profile informs Training recommendations
* Success Profile may inform Michael guidance

## Integrations

* Discovery Interview creates source context
* Launch Center adapts pace
* Daily Success Coach adapts action size
* Training adapts resource recommendations
* Michael adapts guidance tone

---

# PAGE 11 - DISCOVERY INTERVIEW CRM

## Purpose

Discovery Interview CRM preserves the understanding gathered from a person's own answers.

Understanding precedes effective guidance.

## Ownership

The BA owns their story.

CRM stores interview status, summary, and support context.

Agents may summarize and recommend but may not overinterpret.

## Lifecycle

* `not_started`
* `in_progress`
* `completed`
* `summary_generated`
* `success_profile_created`
* `review_due`

## Statuses

* `pending`
* `active`
* `completed`
* `needs_human_review`
* `member_update_requested`

## Activities

* Interview started
* Question answered
* Interview paused
* Interview completed
* Summary created
* Success Profile updated
* Support need flagged

## Relationships

* Discovery Interview belongs to BA
* Discovery Interview informs Success Profile
* Discovery Interview informs Orientation
* Discovery Interview informs Launch Center
* Discovery Interview informs Training
* Discovery Interview informs Michael and Daily Success Coach

## Integrations

* Orientation checks interview status
* Launch Center uses summary for personalization
* Daily Success Coach adapts rhythm
* Michael uses context for support
* CRM timeline records meaningful milestones

---

# PAGE 12 - PMV CRM

## Purpose

PMV CRM connects prospect engagement awareness to relationship stewardship and follow-up timing.

## Ownership

PMV owns engagement awareness.

CRM owns relationship notes, timeline, and follow-up obligations.

BA owns the human relationship.

## Lifecycle

* `created`
* `activity_detected`
* `engagement_summarized`
* `follow_up_recommended`
* `follow_up_created`
* `outcome_recorded`
* `closed_or_converted`

## Statuses

* `awareness_only`
* `engaged`
* `follow_up_ready`
* `conversation_ready`
* `webinar_ready`
* `holding_tank`
* `paused`

## Activities

* Invitation opened
* Presentation started
* Presentation completed
* Dashboard viewed
* Return visit recorded
* Callback requested
* Webinar reserved
* Follow-up recommendation created
* Follow-up outcome recorded

## Relationships

* PMV belongs to prospect
* PMV connects to invitation
* PMV triggers follow-up
* PMV informs Ivory
* PMV informs CRM timeline
* PMV may inform Launch Center after enrollment

## Integrations

* Ivory creates respectful follow-up drafts
* CRM stores follow-up task
* Events provide webinar context
* PMV transitions into BA CRM after enrollment

---

# PAGE 13 - TRAINING CRM

## Purpose

Training CRM shows how learning is supporting confidence, launch, consistency, and leadership development.

## Ownership

Training system owns modules and progress.

CRM owns relationship and support context around training activity.

## Lifecycle

* `not_started`
* `recommended`
* `started`
* `in_progress`
* `completed`
* `review_needed`
* `applied`

## Statuses

* `available`
* `recommended`
* `active`
* `completed`
* `stalled`
* `confusion_detected`
* `support_needed`

## Activities

* Module recommended
* Module started
* Resource viewed
* Module completed
* Question asked
* Training feedback recorded
* Knowledge gap detected

## Relationships

* Training belongs to BA progress
* Training supports Orientation
* Training supports Launch Center
* Training supports Daily Success Coach actions
* Training supports leadership and community contribution

## Integrations

* Training Agent recommends modules
* Michael clarifies concepts
* Daily Success Coach recommends training action
* Launch Center uses training readiness
* Community uses training for participation and leadership development

---

# PAGE 14 - EVENT CRM

## Purpose

Event CRM connects events to learning, connection, recognition, collaboration, and culture reinforcement.

## Ownership

Event Center owns event records.

CRM owns attendance context, follow-up, and relationship outcomes.

## Lifecycle

* `event_available`
* `recommended`
* `reserved`
* `attended`
* `missed`
* `follow_up_needed`
* `outcome_recorded`

## Statuses

* `available`
* `recommended`
* `reserved`
* `attended`
* `missed`
* `needs_follow_up`
* `completed`

## Activities

* Event viewed
* Event recommended
* Reservation made
* Attendance recorded
* Question captured
* Follow-up created
* Recognition opportunity recorded
* Outcome recorded

## Relationships

* Event has attendees
* Event supports training
* Event supports community rhythm
* Event may trigger recognition
* Event may trigger follow-up
* Event may support leadership development

## Integrations

* Event Agent may recommend events
* Daily Success Coach may suggest attendance
* Community CRM records participation
* Training CRM links learning outcomes
* Michael may support post-event reflection

---

# PAGE 15 - COMMUNITY CRM

## Purpose

Community CRM shows belonging, participation, contribution, recognition, mentorship, and leadership development context.

## Ownership

Community systems own roles, contributions, recognitions, and health signals.

CRM owns timeline, notes, and support recommendations.

## Lifecycle

* `welcomed`
* `observing`
* `participating`
* `consistent`
* `contributing`
* `recognized`
* `mentoring`
* `leading`
* `paused`
* `reengaging`

## Statuses

* `connected`
* `new`
* `participating`
* `support_needed`
* `mentor_connected`
* `contribution_ready`
* `leadership_review`
* `paused`

## Activities

* Welcome completed
* Event attended
* Resource viewed
* Contribution recorded
* Recognition created
* Mentor connection made
* Community support need flagged
* Reengagement activity recorded

## Relationships

* BA participates in community
* BA attends events
* BA receives recognition
* BA contributes to others
* BA may mentor or be mentored
* BA may develop leadership

## Integrations

* Community Agent may recommend connection
* Michael supports mentor philosophy
* Daily Success Coach recommends small community actions
* Event Center provides participation pathways
* Training supports contribution readiness

---

# PAGE 16 - CRM ACTIVITY ARCHITECTURE

## Activity Purpose

Activities record what happened.

They are the factual building blocks of CRM timeline, momentum tracking, and recommendations.

## Activity Types

* `note_created`
* `follow_up_created`
* `follow_up_completed`
* `invitation_sent`
* `pmv_activity_recorded`
* `orientation_started`
* `orientation_completed`
* `launch_stage_completed`
* `training_started`
* `training_completed`
* `event_reserved`
* `event_attended`
* `daily_action_completed`
* `community_contribution_recorded`
* `recognition_recorded`
* `support_need_flagged`

## Mongo Representation

Collection:

`crm_activities`

```json
{
  "activity_id": "",
  "entity_type": "",
  "entity_id": "",
  "actor_type": "",
  "actor_id": "",
  "activity_type": "",
  "summary": "",
  "source_system": "",
  "source_id": "",
  "metadata": {},
  "created_at": ""
}
```

## Activity Rule

Activities must be factual.

Interpretation belongs in recommendations, summaries, or observations with evidence.

---

# PAGE 17 - CRM FOLLOW-UP ARCHITECTURE

## Follow-Up Purpose

Follow-up exists to preserve relationship continuity and support timing.

Follow-up is service.

## Follow-Up Categories

* Prospect access help
* Prospect clarity question
* Prospect conversation invitation
* Webinar reminder
* Holding Tank nurture
* BA welcome touchpoint
* Orientation support
* Launch support
* Training support
* Event follow-up
* Community reengagement
* Mentor check-in

## Mongo Representation

Collection:

`follow_ups`

```json
{
  "follow_up_id": "",
  "entity_type": "",
  "entity_id": "",
  "assigned_to": "",
  "trigger_activity_id": "",
  "follow_up_type": "",
  "recommended_posture": "",
  "due_at": "",
  "status": "",
  "outcome": "",
  "created_at": "",
  "completed_at": ""
}
```

## Statuses

* `draft`
* `scheduled`
* `due`
* `completed`
* `snoozed`
* `paused`
* `cancelled`
* `expired`

## Follow-Up Boundary

If follow-up risks damaging trust, CRM should recommend pause or human review.

---

# PAGE 18 - CRM TIMELINE ARCHITECTURE

## Timeline Purpose

The CRM timeline gives a human-readable story of relationship and momentum.

It combines activities, notes, follow-ups, recommendations, outcomes, and key milestones.

## Timeline Entry Types

* Note
* Activity
* Follow-up
* Recommendation
* Outcome
* Milestone
* Support flag
* Event attendance
* Training progress
* PMV summary
* Launch progress
* Orientation progress
* Community contribution

## Mongo Representation

Collection:

`crm_timeline_entries`

```json
{
  "timeline_entry_id": "",
  "entity_type": "",
  "entity_id": "",
  "entry_type": "",
  "title": "",
  "summary": "",
  "source_refs": [],
  "visibility": "",
  "created_at": ""
}
```

## Timeline Rule

Timeline should be useful at a glance.

It should not bury the human in raw event noise.

---

# PAGE 19 - CRM NOTE ARCHITECTURE

## Note Purpose

CRM notes preserve human context that structured activity cannot capture.

## Note Types

* Relationship note
* Support note
* Question note
* Follow-up note
* Training note
* Event note
* Sponsor note
* Mentor note
* Holding Tank note
* Community note

## Mongo Representation

Collection:

`crm_notes`

```json
{
  "note_id": "",
  "entity_type": "",
  "entity_id": "",
  "author_id": "",
  "note_type": "",
  "note": "",
  "visibility": "",
  "sensitivity": "",
  "created_at": "",
  "updated_at": ""
}
```

## Note Governance

Notes must be respectful, factual where possible, and scoped to support.

Sensitive notes must not be used for pressure or stereotyping.

---

# PAGE 20 - CRM DASHBOARD ARCHITECTURE

## Dashboard Purpose

CRM dashboards help users see who needs attention, what context matters, and what next action is appropriate.

## Dashboard Views

* Prospect relationship view
* BA success view
* Follow-up queue
* Momentum dashboard
* Training support dashboard
* Event participation dashboard
* Community health dashboard
* Sponsor support dashboard

## Dashboard Cards

Cards may include:

* Current state
* Last meaningful activity
* Next follow-up
* Momentum summary
* Support-needed flag
* Recent timeline entries
* Recommended action
* Related resources

## Dashboard Boundary

Dashboards must not become pressure boards.

They should show support priorities, not human rankings.

---

# PAGE 21 - CRM RECOMMENDATION ARCHITECTURE

## Recommendation Purpose

CRM recommendations identify next helpful actions in context.

## Recommendation Types

* `follow_up_now`
* `wait`
* `pause`
* `send_resource`
* `ask_clarity_question`
* `schedule_conversation`
* `recommend_training`
* `recommend_event`
* `record_note`
* `sponsor_check_in`
* `mentor_connection`
* `daily_action`
* `launch_next_step`
* `orientation_support`
* `human_review`

## Recommendation Requirements

Every CRM recommendation must include:

* Entity reference
* Recommendation type
* Plain-language action
* Rationale
* Evidence references
* Confidence
* Human approval requirement
* Expiration or review timing
* Outcome tracking plan

## Recommendation Boundary

Recommendations may guide.

They may not pressure or replace human judgment.

---

# PAGE 22 - CRM INTELLIGENCE ARCHITECTURE

## Intelligence Purpose

CRM intelligence helps identify patterns that improve support, timing, and momentum.

It must remain explainable and auditable.

## Intelligence Inputs

* Activities
* Timeline entries
* Notes
* Follow-up outcomes
* PMV summaries
* Orientation progress
* Launch progress
* Training progress
* Event attendance
* Daily actions
* Community health signals
* Agent recommendations
* Human feedback

## Intelligence Outputs

* Momentum summaries
* Support-needed signals
* Follow-up timing recommendations
* Training recommendations
* Event recommendations
* Community connection recommendations
* CRM data quality alerts
* Human escalation recommendations

## Intelligence Boundary

CRM intelligence may infer support needs.

It may not infer human worth, character, commitment, or guaranteed outcomes.

---

# PAGE 23 - MOMENTUM TRACKING ARCHITECTURE

## Momentum Tracking Purpose

Momentum tracking helps users see movement across relationship and success journeys.

## Momentum Dimensions

* Relationship continuity
* Learning progress
* Action rhythm
* Event participation
* Follow-up completion
* Launch progress
* Orientation progress
* Community connection
* Contribution
* Leadership development

## Momentum Snapshot

Collection:

`momentum_snapshots`

```json
{
  "snapshot_id": "",
  "entity_type": "",
  "entity_id": "",
  "momentum_state": "",
  "momentum_score": 0,
  "dimension_scores": {},
  "summary": "",
  "evidence_refs": [],
  "created_at": ""
}
```

## Momentum Boundary

Momentum score is a support signal.

It must be explainable and must not be used as pressure.

---

# PAGE 24 - RELATIONSHIP GRAPH ARCHITECTURE

## Graph Purpose

Neo4j explains CRM relationships and lineage.

## Core Nodes

* `Prospect`
* `BrandAmbassador`
* `SuccessProfile`
* `DiscoveryInterview`
* `PMVRecord`
* `TrainingModule`
* `Event`
* `CommunityActivity`
* `CRMNote`
* `FollowUp`
* `CRMActivity`
* `Recommendation`
* `Outcome`

## Core Relationships

* `(BrandAmbassador)-[:SPONSORS]->(BrandAmbassador)`
* `(BrandAmbassador)-[:ASSIGNED_TO]->(Prospect)`
* `(Prospect)-[:HAS_PMV_RECORD]->(PMVRecord)`
* `(Prospect)-[:HAS_FOLLOW_UP]->(FollowUp)`
* `(BrandAmbassador)-[:HAS_SUCCESS_PROFILE]->(SuccessProfile)`
* `(BrandAmbassador)-[:COMPLETED_DISCOVERY]->(DiscoveryInterview)`
* `(BrandAmbassador)-[:COMPLETED_TRAINING]->(TrainingModule)`
* `(BrandAmbassador)-[:ATTENDED]->(Event)`
* `(CRMActivity)-[:GENERATED]->(TimelineEntry)`
* `(Recommendation)-[:SUPPORTED_BY]->(CRMActivity)`

## Graph Boundary

Graph paths must represent real relationships.

No recommendation may invent a relationship path.

---

# PAGE 25 - SEMANTIC CRM MEMORY ARCHITECTURE

## Chroma Purpose

Chroma stores semantic CRM summaries for retrieval.

It does not store canonical CRM truth.

## Chroma Collections

* `mcs_crm_memory`
* `mcs_prospect_memory`
* `mcs_member_memory`
* `mcs_pmv_memory`
* `mcs_training_knowledge`
* `mcs_event_knowledge`
* `mcs_community_memory`
* `mcs_agent_observations`
* `mcs_recommendation_memory`

## CRM Semantic Documents

* Relationship summary
* Follow-up outcome summary
* Support need summary
* Training support summary
* Event participation summary
* Community engagement summary
* Momentum summary

## Metadata Requirements

Every CRM memory entry must include:

* `source_collection`
* `source_id`
* `entity_type`
* `entity_id`
* `owner_id`
* `privacy_scope`
* `created_at`

## Chroma Boundary

Do not embed secrets, raw tokens, unnecessary sensitive details, or unsupported personal judgments.

---

# PAGE 26 - PMV INTEGRATION

## Integration Purpose

PMV gives CRM awareness of prospect engagement so follow-up can be more timely and respectful.

## PMV Sends To CRM

* Prospect state
* Momentum state
* Engagement summary
* Last meaningful activity
* Recommended follow-up posture
* Callback request
* Webinar reservation
* Pause signal

## CRM Sends To PMV

* Human follow-up outcome
* Relationship notes
* Pause instructions
* Not-now status
* Holding Tank state
* Conversation summary

## Integration Boundary

PMV data must not be used to pressure a prospect.

CRM should translate PMV awareness into respectful human context.

---

# PAGE 27 - MICHAEL INTEGRATION

## Integration Purpose

Michael helps users interpret CRM context with mentor-style wisdom, patience, integrity, encouragement, leadership, and service.

## Michael Reads

* CRM timeline
* BA success context
* Success Profile
* Discovery Interview summary
* Launch and Orientation progress
* Training progress
* Event participation
* Community context

## Michael Writes

* Mentor guidance recommendation
* Reflection prompt
* Sponsor conversation suggestion
* Support-needed escalation
* Outcome observation

## Boundary

Michael does not own the relationship.

Michael supports the human who owns the relationship.

---

# PAGE 28 - IVORY INTEGRATION

## Integration Purpose

Ivory helps users communicate with prospects through respect, permission, curiosity, authenticity, and value.

## Ivory Reads

* Prospect CRM state
* PMV summary
* Follow-up history
* CRM notes
* Invitation history
* Compliance rules
* Prior outcomes

## Ivory Writes

* Draft recommendation
* Follow-up posture recommendation
* Compliance warning
* Message revision suggestion
* Outcome observation

## Boundary

Ivory may draft and recommend.

Ivory may not send without explicit human approval.

Ivory may not qualify prospects or pressure action.

---

# PAGE 29 - DAILY SUCCESS COACH INTEGRATION

## Integration Purpose

Daily Success Coach turns CRM needs into manageable daily actions.

## Daily Success Coach Reads

* Follow-up queue
* Launch stage
* Orientation status
* Training recommendations
* PMV follow-up needs
* Event schedule
* Success Profile
* Support-needed flags

## Daily Success Coach Writes

* Daily CRM action
* Action completion
* Overwhelm signal
* Follow-up completion prompt
* Momentum observation

## Boundary

Daily Success Coach must not create volume pressure.

CRM-driven actions should be manageable and relationship-preserving.

---

# PAGE 30 - LAUNCH CENTER AND ORIENTATION INTEGRATION

## Launch Center Integration Purpose

Launch Center uses CRM to preserve early action context, sponsor touchpoints, and relationship stewardship.

## Launch Reads From CRM

* Sponsor notes
* PMV-to-BA transition context
* Follow-up history
* Support notes
* First action context

## Launch Writes To CRM

* Launch stage completion
* Launch action outcome
* CRM readiness milestone
* Support-needed note
* Launch completion summary

## Orientation Integration Purpose

Orientation uses CRM to ensure the member is welcomed, supported, and connected.

## Orientation Writes To CRM

* Orientation started
* Orientation completed
* Help request
* Support path confirmation
* Launch transition

## Boundary

Launch and Orientation CRM context should reduce uncertainty, not create administrative burden.

---

# PAGE 31 - TRAINING AND EVENT INTEGRATION

## Training Integration Purpose

Training integration helps CRM show whether learning is creating confidence and supporting action.

## Training Sends To CRM

* Module recommended
* Module started
* Module completed
* Question asked
* Knowledge gap detected
* Resource usefulness

## Events Integration Purpose

Event integration helps CRM show community participation, education, recognition, and follow-up needs.

## Events Send To CRM

* Event recommended
* Event reserved
* Event attended
* Event missed
* Event question recorded
* Event follow-up needed

## Boundary

Training and event data should support member growth.

It must not become public comparison or pressure.

---

# PAGE 32 - CRM DASHBOARD EXPERIENCE

## Dashboard Experience Purpose

The CRM dashboard should make the next human action obvious without making the user feel buried in data.

## Primary Sections

* Today's relationship priorities
* Follow-ups due
* Prospect momentum
* BA success support
* Launch and Orientation support
* Training support
* Event follow-up
* Community health
* Recent timeline
* Agent recommendations

## Dashboard Filters

* Entity type
* Assigned owner
* Status
* Momentum state
* Follow-up due date
* Support-needed flag
* Lifecycle stage
* Event or training context

## Dashboard Boundary

The dashboard should prioritize clarity.

It should not create a wall of metrics.

---

# PAGE 33 - CRM PERMISSIONS AND PRIVACY

## Permission Principle

CRM data should be visible only to people and agents with a legitimate support purpose.

## Permission Factors

* User role
* Relationship ownership
* Sponsor relationship
* Mentor assignment
* Admin authority
* Entity sensitivity
* Note visibility
* Workflow purpose

## Privacy Rules

* Sensitive notes are scoped
* Private support context is protected
* Prospect-facing surfaces never expose internal CRM context
* AI receives only needed context
* Audit logs record access where required

## Boundary

CRM must not turn personal context into pressure.

Privacy supports trust.

---

# PAGE 34 - CRM GRAPHRAG ARCHITECTURE

## GraphRAG Purpose

CRM GraphRAG grounds recommendations in canonical records, semantic memory, and real relationship paths.

## Retrieval Plan

1. Retrieve canonical entity records from Mongo.
2. Retrieve CRM activities, notes, timeline entries, follow-ups, and outcomes.
3. Search Chroma for relevant relationship, support, and momentum summaries.
4. Traverse Neo4j for relationship, lifecycle, event, training, and recommendation paths.
5. Apply permissions and privacy filters.
6. Apply compliance and relationship-first boundaries.
7. Generate recommendation or summary.
8. Record evidence and outcome plan.

## Output Requirements

Every CRM GraphRAG output must include:

* Entity state
* Relationship summary
* Recommended action
* Evidence references
* Confidence
* Missing context
* Escalation flag
* Follow-up or outcome plan

## Boundary

GraphRAG may connect evidence.

It may not invent intent, relationship status, or commitment.

---

# PAGE 35 - CRM LIFECYCLE GOVERNANCE

## CRM Record Lifecycle

CRM records follow this lifecycle:

* `created`
* `active`
* `updated`
* `review_due`
* `paused`
* `resolved`
* `archived`

## Review Rules

CRM records should be reviewed when:

* Follow-up is overdue
* A person is inactive after engagement
* Support-needed signal repeats
* Sensitive note exists
* Agent recommendation was rejected
* Conflicting context appears
* Lifecycle state changes

## Archive Rules

Archiving should preserve audit and history while removing active prompts.

Archive does not erase relationship truth.

## Governance Boundary

CRM lifecycle rules should keep context clean and useful.

They should not erase uncomfortable but important support history.

---

# PAGE 36 - FUTURE CRM INTELLIGENCE

## Future Intelligence Purpose

Future CRM intelligence should make relationship stewardship easier, more timely, and more respectful.

## Future Capabilities

* Better follow-up timing
* Better relationship summaries
* Better support-needed detection
* Better momentum summaries
* Better training and event matching
* Better sponsor support prompts
* Better reengagement guidance
* Better CRM data quality checks
* Better privacy-sensitive summarization
* Better outcome learning

## Future Agent Roles

* Michael for mentor guidance
* Ivory for prospect communication
* Daily Success Coach for daily CRM actions
* Training Agent for learning support
* Event Agent for event matching
* Community Agent for belonging and connection
* Compliance Agent for safe language
* Knowledge Agent for source-backed answers

## Future Governance Rule

No future CRM intelligence may ship unless it strengthens relationship, protects trust, and remains auditable.

---

# PAGE 37 - CRM SUCCESS CRITERIA

## CRM Succeeds When

* Prospects feel respected
* BAs feel supported
* Sponsors remember important context
* Follow-up is timely and appropriate
* Holding Tank relationships are preserved
* Orientation and Launch transitions are clear
* Training support improves confidence
* Events create useful follow-up
* Community health is easier to support
* Recommendations are explainable
* Human trust increases

## CRM Fails When

* People feel processed
* Follow-up becomes pressure
* Activity becomes identity
* Scores replace judgment
* Notes become invasive
* AI acts without clear authority
* Relationship context is hidden or noisy
* CRM creates more confusion than clarity
* Momentum tracking creates shame

## Governance Conclusion

The Momentum Creation System CRM is relationship memory.

It helps humans see context, preserve trust, support success, and create momentum.

It is not a transaction machine.

It is a stewardship system.

People remain the center.

