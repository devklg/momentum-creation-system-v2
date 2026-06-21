# PMV_ARCHITECTURE.md

# Momentum Creation System V2

## Prospect Momentum Viewer Ecosystem Architecture

Version 1.0

Constitutional Authority:
MOMENTUM_CREATION_SYSTEM_V2_FOUNDATION.md

Companion Governance:
SCHEMA_GOVERNANCE.md
MULTI_DB_AGENT_LEARNING_GOVERNANCE.md
AGENT_ARCHITECTURE.md

---

# DOCUMENT PURPOSE

This document defines the complete Prospect Momentum Viewer ecosystem for Momentum Creation System V2.

It governs:

* PMV philosophy
* Prospect journey architecture
* Momentum philosophy
* Engagement philosophy
* Relationship philosophy
* Follow-up philosophy
* Prospect lifecycle
* Prospect states
* Momentum states
* Engagement signals
* Activity tracking
* Behavior tracking
* Invitation tracking
* Viewing behavior
* Follow-up architecture
* PMV integrations
* Momentum scoring
* Engagement scoring
* Recommendation architecture
* Future AI integration

The foundation establishes that the Prospect Momentum System exists to help individuals explore opportunities through understanding rather than persuasion.

The PMV exists to create awareness so meaningful follow-up can happen at the appropriate time.

Its purpose is guidance rather than surveillance.

---

# PAGE 1 - GOVERNING PRINCIPLE

## Awareness Serves Relationship

The Prospect Momentum Viewer exists to help Brand Ambassadors steward relationships with care.

PMV must never become:

* A surveillance tool
* A pressure system
* A prospect qualification engine
* A manipulation engine
* A conversion scoreboard
* A replacement for human relationship

PMV exists to help the BA understand:

* Has the prospect engaged?
* What information has the prospect explored?
* Where might the prospect need clarity?
* When is follow-up appropriate?
* What kind of follow-up would preserve trust?
* Which human relationship should be strengthened next?

The purpose is not to force action.

The purpose is to support respectful timing.

Trust is the metric beneath all metrics.

---

# PAGE 2 - FOUNDATION ALIGNMENT

## Prospect Momentum System Principles

The foundation establishes the Prospect Momentum System as:

* Educational
* Relational
* Informative
* Discovery-based
* Trust-centered
* Non-pressuring

PMV must preserve those principles.

## PMV Constitutional Language

The foundation says:

The purpose of PMV is awareness.

Awareness creates appropriate support.

PMV exists to understand engagement patterns so that meaningful follow-up can occur at the appropriate time.

Its purpose is guidance rather than surveillance.

## Operating Standard

Every PMV feature must answer:

Does this help the BA follow up with more respect, more clarity, and better timing?

If the answer is no, the feature is out of scope.

---

# PAGE 3 - PMV PHILOSOPHY

## PMV Is a Compass

PMV should function as a compass, not a scoreboard.

It points toward useful next support.

It does not rank human value.

It does not reduce a person to a number.

## Awareness Without Pressure

PMV may show that a prospect is active, inactive, curious, returning, or ready for a conversation.

PMV must not declare that a prospect is qualified, unqualified, guaranteed, or likely to produce a specific outcome.

## Timing Over Urgency

PMV supports timing.

Timing means:

* Follow up when the person has enough context
* Wait when the person needs space
* Clarify when confusion appears
* Invite conversation when engagement suggests curiosity
* Preserve relationship when signals are mixed

Urgency means pushing before trust has formed.

PMV must choose timing over urgency.

---

# PAGE 4 - MOMENTUM PHILOSOPHY

## Momentum Is Movement

Momentum is sustained forward progress resulting from consistent action, learning, growth, contribution, and leadership.

For prospects, momentum begins before enrollment.

Prospect momentum may appear as:

* Opening an invitation
* Watching educational content
* Returning to a page
* Exploring sections
* Asking a question
* Reserving a webinar
* Requesting a callback
* Moving into deeper discovery

## Momentum Is Not Conversion

PMV must never treat conversion as the only valid movement.

A prospect who learns, gains clarity, and decides timing is not right has still experienced useful progress.

## Momentum Creates Better Conversations

PMV uses engagement signals to help the BA have a better conversation.

The goal is not:

"How do we close this person?"

The goal is:

"How can we serve this person well based on what they explored?"

---

# PAGE 5 - ENGAGEMENT PHILOSOPHY

## Engagement Means Attention, Not Commitment

Engagement indicates that the prospect interacted with information.

It does not prove intent.

It does not prove belief.

It does not prove readiness.

It does not authorize pressure.

## Engagement Signals Are Contextual

A high amount of viewing activity may mean:

* Curiosity
* Confusion
* Careful review
* Shared-device behavior
* Returning later
* Interest in one section
* A desire to understand before responding

PMV must avoid overinterpreting signals.

## Engagement Should Improve Support

Engagement tracking is justified only when it helps:

* Answer questions
* Recommend a helpful next step
* Prevent premature follow-up
* Avoid repeated messages
* Preserve trust
* Connect the person to education

---

# PAGE 6 - RELATIONSHIP PHILOSOPHY

## Relationship Before Transaction

The Holding Tank philosophy establishes that timing matters and relationship must be preserved.

PMV must protect relationship quality.

## Respectful Follow-Up

Follow-up should be:

* Permission-based
* Timely
* Helpful
* Brief
* Relevant
* Human
* Non-pressuring

## PMV as Relationship Stewardship

PMV should help a BA remember:

* Who was invited
* What they viewed
* When they returned
* What they might need next
* When to pause
* When to ask a clarifying question
* When to invite a live conversation

PMV should not make the BA feel like they are chasing.

It should help the BA serve.

---

# PAGE 7 - FOLLOW-UP PHILOSOPHY

## Follow-Up Is Service

Follow-up is not pestering.

Follow-up is helping someone continue a discovery journey.

## Follow-Up Must Match State

Different PMV states require different follow-up posture.

Examples:

* Opened but did not view: gentle help offer
* Viewed partially: clarity question
* Completed core content: conversation invitation
* Returned multiple times: offer to answer questions
* Inactive after interest: patient check-in
* Requested callback: prompt human response

## Follow-Up Has a Stop Rule

PMV must support pausing.

If follow-up becomes repetitive, ignored, or unwanted, the system must recommend slowing down or stopping.

Preserving trust outranks pursuing activity.

---

# PAGE 8 - PROSPECT JOURNEY ARCHITECTURE

## Prospect Journey

The PMV prospect journey begins when a prospect receives an invitation and continues through discovery, education, follow-up, and final disposition.

Journey stages:

1. Identified
2. Invited
3. Invitation opened
4. Presentation started
5. Presentation engaged
6. Presentation completed
7. Dashboard explored
8. Conversation requested
9. Webinar reserved
10. Holding Tank
11. Enrolled
12. Not now
13. Expired

## Journey Rule

The prospect journey must be reversible where human timing requires it.

A person can return to education, pause in Holding Tank, request conversation, or decide timing is not right.

## Journey Ownership

The BA owns the relationship.

PMV owns awareness.

Ivory owns invitation support.

CRM owns notes and follow-up tasks.

Agents own recommendations, not decisions.

---

# PAGE 9 - PROSPECT LIFECYCLE

## Lifecycle Stages

The prospect lifecycle describes canonical progression:

```text
created
  -> invited
  -> invitation_opened
  -> presentation_started
  -> engaged
  -> presentation_completed
  -> dashboard_explored
  -> follow_up_ready
  -> callback_requested | webinar_reserved | holding_tank | not_now
  -> enrolled | expired
```

## Lifecycle Governance

Lifecycle state is stored in Mongo.

Semantic interpretation is stored in Chroma only as summaries.

Relationship paths are stored in Neo4j.

AI recommendations must cite the lifecycle state and supporting evidence.

## Lifecycle Events

Supported lifecycle events:

* `prospect_created`
* `invitation_sent`
* `invitation_opened`
* `token_resolved`
* `presentation_started`
* `presentation_milestone_reached`
* `presentation_completed`
* `dashboard_opened`
* `section_viewed`
* `return_visit_recorded`
* `callback_requested`
* `webinar_reserved`
* `follow_up_created`
* `follow_up_completed`
* `holding_tank_entered`
* `prospect_enrolled`
* `prospect_expired`

---

# PAGE 10 - CANONICAL PROSPECT STATES

## State List

Canonical PMV prospect states:

* `identified`
* `invited`
* `opened`
* `started`
* `engaged`
* `deep_engaged`
* `completed`
* `dashboard_exploring`
* `conversation_ready`
* `webinar_ready`
* `holding_tank`
* `inactive`
* `not_now`
* `enrolled`
* `expired`

## State Ownership

Mongo owns canonical state.

Neo4j owns how the prospect moved through states.

Chroma stores narrative state summaries when useful for follow-up.

## State Change Requirements

Every state change must include:

* Prior state
* New state
* Event that caused the change
* Timestamp
* Prospect ID
* Assigned BA ID
* Evidence
* Confidence
* AI recommendation eligibility

---

# PAGE 11 - STATE: IDENTIFIED

## Purpose

The `identified` state represents a person known to the BA but not yet invited through the system.

## Entry Criteria

* Prospect record created
* Relationship source identified
* No active invitation sent

## Exit Criteria

* Invitation sent
* Prospect record archived
* Duplicate merged

## Recommended Actions

* Confirm basic contact context
* Clarify relationship source
* Prepare respectful invitation
* Avoid premature pressure

## AI Recommendations

Ivory may recommend permission-based invitation language.

PMV may not infer interest because the prospect was merely identified.

## Follow-Up Recommendations

No PMV follow-up exists yet.

Follow-up should remain human and relationship-based until invitation activity begins.

---

# PAGE 12 - STATE: INVITED

## Purpose

The `invited` state indicates that the prospect has received an invitation but has not opened or resolved it.

## Entry Criteria

* Invitation sent
* Token minted
* Prospect associated with assigned BA

## Exit Criteria

* Invitation opened
* Token expired
* Invitation revoked
* Prospect requests no further contact

## Recommended Actions

* Wait an appropriate interval
* Avoid repeated prompting
* Prepare a simple check-in only if timing supports it

## AI Recommendations

Ivory may suggest a light follow-up if enough time has passed.

Compliance Agent must block pressure-based urgency.

## Follow-Up Recommendations

Follow-up should be brief:

* Ask if the person received it
* Offer help if the link did not work
* Do not assume interest or disinterest

---

# PAGE 13 - STATE: OPENED

## Purpose

The `opened` state means the prospect opened or resolved the invitation link but has not meaningfully started the content.

## Entry Criteria

* Token resolved
* Page opened
* No meaningful viewing milestone reached

## Exit Criteria

* Presentation started
* Inactive timeout reached
* Token expired

## Recommended Actions

* Give the prospect room
* Monitor for further engagement
* Avoid immediate follow-up unless the prospect asks for help

## AI Recommendations

Ivory may recommend waiting before contacting.

PMV may mark this as awareness only, not intent.

## Follow-Up Recommendations

If no further activity appears after a reasonable period, follow-up may ask:

* Were you able to access it?
* Would it help if I sent the link again?

---

# PAGE 14 - STATE: STARTED

## Purpose

The `started` state means the prospect began the core presentation or educational experience.

## Entry Criteria

* Presentation start event
* First meaningful content interaction

## Exit Criteria

* Engagement milestone reached
* Abandonment threshold reached
* Presentation completed

## Recommended Actions

* Do not interrupt
* Allow educational flow to continue
* Prepare context-aware follow-up only after activity settles

## AI Recommendations

PMV may recommend no action while viewing is active.

Ivory may prepare a future clarity question, but should not send automatically.

## Follow-Up Recommendations

Follow-up after partial viewing should focus on clarity:

* Was anything unclear?
* Is there a section you want to talk through?

---

# PAGE 15 - STATE: ENGAGED

## Purpose

The `engaged` state means the prospect has consumed enough content to show meaningful attention.

## Entry Criteria

Any combination of:

* Presentation milestone reached
* Multiple sections viewed
* Time on page above threshold
* Return visit
* Resource opened

## Exit Criteria

* Deep engagement threshold reached
* Presentation completed
* Inactivity threshold reached
* Callback or webinar action taken

## Recommended Actions

* Prepare a relevant follow-up
* Avoid overinterpreting interest
* Look for what the prospect viewed before deciding wording

## AI Recommendations

Ivory may recommend a question tied to the viewed content.

PMV may recommend a support-oriented follow-up.

## Follow-Up Recommendations

Follow-up should connect to the discovery experience:

* I saw you had a chance to look through some of it.
* What part stood out or raised questions?

The BA should not imply hidden surveillance.

Use general phrasing rather than overly specific tracking language.

---

# PAGE 16 - STATE: DEEP_ENGAGED

## Purpose

The `deep_engaged` state means engagement is sustained, repeated, or broad enough to justify more intentional human support.

## Entry Criteria

Examples:

* Multiple return visits
* Completion of major content sections
* Extended viewing time
* Dashboard exploration
* Multiple CTA hovers or starts
* Webinar details viewed

## Exit Criteria

* Presentation completed
* Callback requested
* Webinar reserved
* Holding Tank entered
* Inactivity threshold reached

## Recommended Actions

* Prioritize thoughtful human follow-up
* Ask what questions are forming
* Offer a conversation
* Offer webinar information when relevant

## AI Recommendations

Ivory may recommend a conversation invitation.

Michael may later support the BA if this prospect enrolls.

Compliance Agent must ensure no pressure or promise language appears.

## Follow-Up Recommendations

Follow-up should be relational:

* You looked at quite a bit of the information. What would be most helpful to talk through?

Do not say:

* I tracked everything you viewed.

---

# PAGE 17 - STATE: COMPLETED

## Purpose

The `completed` state indicates the prospect completed the core educational content.

## Entry Criteria

* Presentation completion event
* Required content milestone reached

## Exit Criteria

* Dashboard explored
* Callback requested
* Webinar reserved
* Holding Tank entered
* Not now
* Expired

## Recommended Actions

* Invite conversation
* Offer next educational step
* Ask what they understood, liked, or questioned
* Respect timing

## AI Recommendations

Ivory may recommend a clear conversation prompt.

PMV may recommend a follow-up priority increase.

Compliance Agent must review generated language.

## Follow-Up Recommendations

Follow-up should invite reflection:

* Now that you have the overview, what questions came up for you?
* Would a quick conversation help you sort through it?

---

# PAGE 18 - STATE: DASHBOARD_EXPLORING

## Purpose

The `dashboard_exploring` state means the prospect is using post-presentation dashboard content to explore more detail.

## Entry Criteria

* Dashboard opened
* Dashboard section viewed
* Resource or event information viewed

## Exit Criteria

* Callback requested
* Webinar reserved
* Holding Tank entered
* Inactivity threshold reached

## Recommended Actions

* Identify the type of content explored
* Prepare an educational follow-up
* Offer to connect them to a live explanation

## AI Recommendations

Ivory may recommend topic-specific follow-up.

PMV may recommend relevant resource support.

## Follow-Up Recommendations

Follow-up should be grounded in broad topic, not invasive detail:

* If you want to talk through the next-step information, I can help.

---

# PAGE 19 - STATE: CONVERSATION_READY

## Purpose

The `conversation_ready` state means the prospect has signaled enough interest or question formation that a human conversation is appropriate.

## Entry Criteria

Any of:

* Callback requested
* High engagement plus return visit
* Completion plus dashboard exploration
* Direct question submitted
* BA manually marks conversation readiness

## Exit Criteria

* Conversation completed
* Webinar reserved
* Holding Tank entered
* Not now
* Enrolled

## Recommended Actions

* Prompt BA follow-up
* Keep wording simple and human
* Confirm convenient timing
* Prepare notes in CRM

## AI Recommendations

Ivory may recommend a conversation invitation.

CRM may create a follow-up task.

PMV may prioritize this record.

## Follow-Up Recommendations

Recommended follow-up:

* Would now be a good time to talk through what you saw?
* What part would you like more clarity on?

---

# PAGE 20 - STATE: WEBINAR_READY

## Purpose

The `webinar_ready` state means the prospect has shown interest in a live educational event.

## Entry Criteria

* Webinar page viewed
* Webinar reservation started
* Webinar reserved
* BA manually marks webinar fit

## Exit Criteria

* Webinar attended
* Webinar missed
* Callback requested
* Holding Tank entered
* Not now

## Recommended Actions

* Confirm event information
* Support attendance
* Provide simple reminders
* Follow up after the event

## AI Recommendations

Ivory may recommend a webinar confirmation message.

Event Agent may eventually recommend the best event option.

Compliance Agent must prevent outcome promises.

## Follow-Up Recommendations

Follow-up should support learning:

* The webinar may help give the broader picture.
* After you attend, I would be happy to answer questions.

---

# PAGE 21 - STATE: HOLDING_TANK

## Purpose

The `holding_tank` state honors timing.

Not every person is ready to act immediately.

## Entry Criteria

* Prospect expresses interest but not now
* Prospect completes education but delays decision
* BA marks relationship for patient nurture
* System detects engagement followed by quiet period

## Exit Criteria

* Prospect re-engages
* Follow-up scheduled
* Callback requested
* Webinar reserved
* Enrolled
* Prospect opts out

## Recommended Actions

* Preserve relationship
* Reduce follow-up frequency
* Offer value occasionally
* Avoid pressure

## AI Recommendations

Ivory may recommend patient nurture language.

PMV may recommend long-window follow-up.

Daily Success Coach may recommend a BA action to maintain relationship respectfully.

## Follow-Up Recommendations

Follow-up should be low-pressure:

* No rush. I just wanted to stay connected and see if anything would be helpful.

---

# PAGE 22 - STATE: INACTIVE

## Purpose

The `inactive` state means the prospect has not engaged recently after an earlier invitation or activity.

## Entry Criteria

* No activity after defined interval
* Opened but did not continue
* Started but did not return
* Follow-up unanswered

## Exit Criteria

* Prospect re-engages
* Follow-up completed
* Holding Tank entered
* Not now
* Expired

## Recommended Actions

* Do not chase
* Consider one simple check-in
* Move to Holding Tank if relationship should be preserved
* Respect non-response

## AI Recommendations

Ivory may suggest a single gentle check-in.

PMV may recommend pause after repeated non-response.

## Follow-Up Recommendations

Recommended follow-up:

* Just checking that you were able to access the information. No pressure either way.

---

# PAGE 23 - STATE: NOT_NOW

## Purpose

The `not_now` state means the prospect has indicated that timing is not right or they are not interested currently.

## Entry Criteria

* Prospect says not now
* Prospect declines
* BA records no current interest
* Follow-up stop requested

## Exit Criteria

* Prospect reopens conversation
* BA creates future relationship note
* Record archived

## Recommended Actions

* Respect the answer
* Preserve relationship
* Stop PMV-driven follow-up
* Keep only appropriate relationship context

## AI Recommendations

Ivory may recommend a respectful closing response.

PMV should suppress urgency recommendations.

## Follow-Up Recommendations

Follow-up should stop unless the prospect gives permission for future contact.

Respect is the outcome.

---

# PAGE 24 - STATE: ENROLLED

## Purpose

The `enrolled` state means the prospect journey has converted into a Brand Ambassador journey.

## Entry Criteria

* Enrollment confirmed through the approved human/system process
* Prospect linked to new BA member record

## Exit Criteria

* No PMV exit into prospect states
* Future journey continues through BA Success System

## Recommended Actions

* Trigger Discovery Interview
* Trigger Success Profile creation
* Trigger Orientation
* Trigger Launch Center
* Connect Michael and Daily Success Coach

## AI Recommendations

Michael may provide orientation guidance.

Daily Success Coach may recommend first actions.

Ivory no longer treats the person as a prospect.

## Follow-Up Recommendations

PMV follow-up stops as prospect follow-up.

The next relationship actions move into the BA Success System, including Discovery Interview, Success Profile, Orientation, and Launch Center support.

---

# PAGE 25 - STATE: EXPIRED

## Purpose

The `expired` state means the invitation or token is no longer active.

## Entry Criteria

* Token expiration reached
* Invitation expiration reached
* Access link no longer resolves to an active prospect experience

## Exit Criteria

* New invitation is sent when relationally appropriate
* Prospect record is archived
* Prospect is moved to Holding Tank or Not Now by human judgment

## Recommended Actions

* BA may send a new invitation only when relationally appropriate
* CRM may record expiration
* PMV should stop active tracking for that token

## AI Recommendations

Ivory may recommend a fresh-link message only when timing and relationship context support it.

PMV may recommend no action if there is no engagement or no permission-based reason to reconnect.

## Follow-Up Recommendations

Follow-up may offer a fresh link without pressure.

---

# PAGE 26 - MOMENTUM STATES

## Momentum State List

PMV momentum states describe movement quality:

* `no_momentum`
* `initial_awareness`
* `curiosity`
* `active_discovery`
* `deep_discovery`
* `conversation_momentum`
* `event_momentum`
* `paused_momentum`
* `relationship_momentum`
* `converted_momentum`

## Momentum State Purpose

Momentum states help the BA understand what kind of support fits.

They are not prospect labels.

They are temporary context signals.

## Momentum State Examples

`initial_awareness`:

The prospect opened the invitation.

`curiosity`:

The prospect started content or returned once.

`active_discovery`:

The prospect is exploring multiple pieces of content.

`deep_discovery`:

The prospect has completed or substantially explored content.

`paused_momentum`:

The prospect engaged but has gone quiet.

`relationship_momentum`:

The relationship is active even if the business decision is delayed.

---

# PAGE 27 - ENGAGEMENT SIGNALS

## Signal Categories

Engagement signals include:

* Invitation signals
* Viewing signals
* Navigation signals
* Return signals
* CTA signals
* Webinar signals
* Conversation signals
* Follow-up signals
* CRM signals

## Invitation Signals

* Sent
* Delivered when available
* Opened
* Link clicked
* Token resolved
* Expired

## Viewing Signals

* Presentation started
* Milestone reached
* Completed
* Watch duration
* Rewatch
* Drop-off point

## Navigation Signals

* Dashboard opened
* Section viewed
* Resource opened
* Event page opened
* FAQ viewed

## Return Signals

* Return visit
* Time since last visit
* Multiple-session viewing
* Reopened after follow-up

## Human Signals

* Callback request
* Webinar reservation
* Question asked
* BA note
* Follow-up response

---

# PAGE 28 - ACTIVITY AND BEHAVIOR TRACKING

## Activity Tracking Purpose

Activity tracking records what happened.

Behavior tracking interprets patterns cautiously.

## Activity Event Requirements

Each PMV activity event must include:

* `activity_id`
* `prospect_id`
* `pmv_id`
* `event_type`
* `source`
* `timestamp`
* `session_id`
* `token_id`
* `metadata`
* `privacy_scope`

## Behavior Interpretation Rules

PMV may infer:

* A prospect returned
* A prospect completed content
* A prospect viewed event information
* A prospect requested a callback

PMV may not infer:

* Financial readiness
* Guaranteed interest
* Character quality
* Personal worth
* Commitment level beyond evidence

## Behavior Summaries

Behavior summaries should use restrained language:

* "Viewed multiple sections"
* "Returned after initial visit"
* "Completed core presentation"
* "Requested callback"

Avoid:

* "Hot lead"
* "Ready to close"
* "High-value prospect"

---

# PAGE 29 - INVITATION TRACKING

## Invitation Tracking Purpose

Invitation tracking preserves lineage and context.

It answers:

* Who invited the prospect?
* Which invitation was sent?
* Which token was used?
* What state did the invitation create?
* What follow-up should happen?

## Mongo Representation

Collections:

* `prospects`
* `invitations`
* `tokens`
* `pmv_records`
* `pmv_activity_events`

## Neo4j Relationships

* `(BrandAmbassador)-[:SENT_INVITATION]->(Invitation)`
* `(Invitation)-[:SENT_TO]->(Prospect)`
* `(Invitation)-[:HAS_TOKEN]->(Token)`
* `(Token)-[:RESOLVED_TO]->(PMVRecord)`
* `(Prospect)-[:HAS_PMV_RECORD]->(PMVRecord)`

## Chroma Representation

Chroma should store only narrative summaries when useful:

* Invitation context
* Follow-up summary
* Engagement summary
* Relationship note summary

Do not embed raw tokens.

---

# PAGE 30 - VIEWING BEHAVIOR ARCHITECTURE

## Viewing Behavior Categories

Viewing behavior includes:

* First open
* Presentation start
* Section progress
* Completion
* Rewatch
* Dashboard open
* Section exploration
* Resource click
* Event information view
* CTA interaction
* Return visit

## Viewing Session Model

Mongo collection:

`pmv_viewing_sessions`

```json
{
  "session_id": "",
  "pmv_id": "",
  "prospect_id": "",
  "token_id": "",
  "started_at": "",
  "ended_at": "",
  "duration_seconds": 0,
  "events": [],
  "completion_percentage": 0,
  "privacy_scope": "",
  "created_at": ""
}
```

## Viewing Event Model

Mongo collection:

`pmv_activity_events`

```json
{
  "activity_id": "",
  "session_id": "",
  "pmv_id": "",
  "prospect_id": "",
  "event_type": "",
  "section_id": "",
  "occurred_at": "",
  "metadata": {}
}
```

## Viewing Behavior Boundary

Viewing behavior should be summarized for the BA.

It should not be displayed as invasive minute-by-minute surveillance.

---

# PAGE 31 - FOLLOW-UP ARCHITECTURE

## Follow-Up Purpose

Follow-up exists to help the prospect continue discovery.

It should be generated by relationship context, not pressure.

## Follow-Up Trigger Sources

* Invitation opened
* Presentation partially viewed
* Presentation completed
* Dashboard explored
* Callback requested
* Webinar reserved
* Return visit
* Inactivity after engagement
* BA manual note

## Follow-Up Mongo Representation

Collection:

`follow_ups`

```json
{
  "follow_up_id": "",
  "prospect_id": "",
  "assigned_to": "",
  "trigger_event_id": "",
  "pmv_state": "",
  "recommended_timing": "",
  "recommended_posture": "",
  "status": "",
  "due_date": "",
  "completed_at": "",
  "outcome": ""
}
```

## Follow-Up Postures

* `access_help`
* `clarity_question`
* `conversation_invitation`
* `webinar_support`
* `patient_nurture`
* `respectful_pause`
* `closing_respectfully`

## Follow-Up Rule

The more personal the follow-up, the more human it must be.

AI may draft.

The BA owns the relationship.

---

# PAGE 32 - PMV INTEGRATION WITH IVORY

## Integration Purpose

Ivory helps the BA communicate respectfully with prospects.

PMV provides awareness.

Ivory turns awareness into better invitation and follow-up language.

## Ivory Reads

* Prospect state
* PMV state
* Engagement summary
* Invitation history
* Follow-up history
* CRM notes
* Compliance rules

## Ivory Writes

* Draft recommendations
* Follow-up recommendations
* Compliance-risk observations
* Agent outcomes

## Ivory Boundaries

Ivory may not:

* Send without approval
* Qualify prospects
* Automate prospecting
* Use pressure language
* Mention overly specific tracking details

## Ivory Recommendation Examples

* Wait before following up
* Ask whether the person had a chance to review
* Ask what stood out
* Offer a conversation
* Suggest a webinar
* Recommend a pause

---

# PAGE 33 - PMV INTEGRATION WITH MICHAEL

## Integration Purpose

Michael primarily supports Brand Ambassadors.

PMV informs Michael after a prospect becomes a Brand Ambassador or when a BA needs mentor-style guidance on relationship stewardship.

## Michael Reads

When permitted, Michael may read:

* BA context
* PMV summary
* Follow-up outcomes
* Success Profile
* Launch state
* Training readiness

## Michael Writes

* Mentor guidance recommendations
* Reflection prompts
* Escalations to sponsor or leader
* Learning observations

## Michael Use Cases

* Help BA think through a respectful follow-up posture
* Encourage patience when a prospect is in Holding Tank
* Help a new BA reflect on prospect conversations
* Support orientation after enrollment

## Michael Boundary

Michael must not replace the BA's judgment or relationship.

---

# PAGE 34 - PMV INTEGRATION WITH DAILY SUCCESS COACH

## Integration Purpose

The Daily Success Coach helps BAs act consistently.

PMV can inform daily actions when a prospect needs appropriate follow-up.

## Daily Success Coach Reads

* Follow-up queue
* PMV state summaries
* BA daily action history
* Launch Center status
* Success Profile support needs

## Daily Success Coach Writes

* Daily action recommendation
* Follow-up action task
* Outcome record
* Overwhelm signal

## Daily Action Examples

* Follow up with one engaged prospect
* Send a respectful webinar reminder
* Update CRM note after a conversation
* Pause follow-up on an inactive prospect

## Boundary

The Daily Success Coach must not create volume pressure.

It should recommend manageable, trust-preserving action.

---

# PAGE 35 - PMV INTEGRATION WITH CRM

## Integration Purpose

CRM stores relationship notes, follow-up obligations, and human context.

PMV informs CRM.

CRM human notes inform PMV recommendations.

## CRM Reads From PMV

* Prospect state
* Momentum state
* Engagement summary
* Last activity
* Follow-up recommendation

## PMV Reads From CRM

* Human notes
* Follow-up outcomes
* Relationship context
* Opt-out or pause instructions
* Conversation summaries

## CRM Write Rules

CRM notes may be used for AI context only when they support relationship stewardship.

Sensitive notes should be scoped carefully.

## CRM Outcome Types

* `follow_up_completed`
* `conversation_completed`
* `question_answered`
* `webinar_invited`
* `not_now_recorded`
* `holding_tank_updated`
* `do_not_follow_up`

---

# PAGE 36 - PMV INTEGRATION WITH LAUNCH CENTER

## Integration Purpose

Launch Center is for Brand Ambassadors after they enter the BA journey.

PMV connects to Launch Center when a prospect enrolls and becomes a BA.

## Transition Rule

Once enrolled, the person is no longer managed as a prospect.

Their journey transitions from PMV to:

* Discovery Interview
* Success Profile
* Orientation
* Launch Center
* Daily Success Coach
* Michael guidance

## Launch Context From PMV

PMV may pass:

* Enrollment source
* Invitation path
* Educational content completed
* Webinar attendance
* Questions asked
* High-level engagement summary

## Boundary

PMV history may support personalization.

It must not stereotype the new BA or overdetermine their path.

---

# PAGE 37 - PMV INTEGRATION WITH DISCOVERY INTERVIEW AND SUCCESS PROFILES

## Discovery Interview Integration

The Discovery Interview exists to understand the individual.

PMV may inform the interview only as background context.

It must not answer interview questions for the person.

## Discovery Interview Reads

* How the person entered
* Educational path completed
* Questions or interests expressed
* Webinar or callback context

## Success Profile Integration

The Success Profile personalizes BA support.

PMV can contribute early context, but the Success Profile must be based primarily on the new BA's own responses.

## Success Profile Reads

* PMV engagement summary
* Interest areas
* Stated questions
* Webinar or conversation summary

## Boundary

PMV cannot decide a person's motivation, learning style, or support needs.

Only the person's own discovery responses and ongoing BA behavior can establish those.

---

# PAGE 38 - MONGODB PMV ARCHITECTURE

## Canonical Collections

Mongo owns PMV source-of-truth records.

Collections:

* `prospects`
* `invitations`
* `tokens`
* `pmv_records`
* `pmv_activity_events`
* `pmv_viewing_sessions`
* `follow_ups`
* `crm_notes`
* `agent_recommendations`
* `agent_outcomes`

## PMV Record

```json
{
  "pmv_id": "",
  "prospect_id": "",
  "assigned_to": "",
  "invitation_id": "",
  "token_id": "",
  "prospect_state": "",
  "momentum_state": "",
  "engagement_score": 0,
  "momentum_score": 0,
  "last_activity_at": "",
  "activity_summary": "",
  "recommended_follow_up_posture": "",
  "created_at": "",
  "updated_at": ""
}
```

## Mongo Rule

Mongo stores canonical PMV truth.

Scores, states, and recommendations must be reproducible from events and rules.

---

# PAGE 39 - NEO4J PMV ARCHITECTURE

## Graph Purpose

Neo4j explains the prospect journey.

It answers:

* How did this prospect arrive?
* Which invitation produced this PMV record?
* Which activity produced the current state?
* Which follow-up was triggered?
* Which agent made which recommendation?
* What outcome happened?

## Core Nodes

* `Prospect`
* `BrandAmbassador`
* `Invitation`
* `Token`
* `PMVRecord`
* `PMVActivity`
* `ViewingSession`
* `FollowUp`
* `CRMNote`
* `AgentRecommendation`
* `AgentOutcome`

## Core Relationships

* `(BrandAmbassador)-[:INVITED]->(Prospect)`
* `(Prospect)-[:HAS_INVITATION]->(Invitation)`
* `(Invitation)-[:HAS_TOKEN]->(Token)`
* `(Token)-[:RESOLVED_TO]->(PMVRecord)`
* `(PMVRecord)-[:HAS_ACTIVITY]->(PMVActivity)`
* `(PMVRecord)-[:HAS_VIEWING_SESSION]->(ViewingSession)`
* `(PMVRecord)-[:TRIGGERED_FOLLOW_UP]->(FollowUp)`
* `(PMVRecord)-[:INFORMED_RECOMMENDATION]->(AgentRecommendation)`
* `(FollowUp)-[:RESULTED_IN]->(AgentOutcome)`

---

# PAGE 40 - CHROMA PMV ARCHITECTURE

## Semantic Memory Purpose

Chroma stores searchable summaries.

It does not store canonical PMV truth.

## Chroma Collections

* `mcs_prospect_memory`
* `mcs_invitation_memory`
* `mcs_pmv_memory`
* `mcs_recommendation_memory`
* `mcs_agent_observations`

## PMV Semantic Documents

Examples:

* Prospect journey summary
* PMV engagement summary
* Follow-up outcome summary
* Repeated question summary
* Relationship context summary

## Metadata Requirements

Every PMV Chroma record must include:

* `source_collection`
* `source_id`
* `prospect_id`
* `pmv_id`
* `assigned_to`
* `state`
* `created_at`
* `privacy_scope`

## Chroma Boundary

Do not embed:

* Raw tokens
* Secrets
* Credentials
* Unnecessary private details
* Unsupported personal judgments

---

# PAGE 41 - MOMENTUM SCORING FRAMEWORK

## Scoring Philosophy

Momentum scoring is a guidance signal.

It is not a human value score.

It is not a qualification score.

It is not a prediction of outcome.

## Score Components

Momentum score may include:

* Invitation progression
* Content progress
* Return behavior
* Dashboard exploration
* Conversation signal
* Webinar signal
* Recent activity
* Follow-up response

## Suggested Weights

Weights are governance-controlled and adjustable:

* Invitation opened: low
* Presentation started: low to medium
* Presentation milestones: medium
* Presentation completed: high
* Dashboard explored: medium to high
* Callback requested: high
* Webinar reserved: high
* Return visit: medium
* Positive follow-up response: high
* Long inactivity: decay

## Score Output Bands

* `0-20`: Awareness only
* `21-40`: Early curiosity
* `41-60`: Active discovery
* `61-80`: Strong discovery
* `81-100`: Conversation priority

## Score Boundary

Scores must be shown with explanatory context.

Never show a score without saying what produced it.

---

# PAGE 42 - ENGAGEMENT FRAMEWORK

## Engagement Dimensions

Engagement is evaluated across:

* Depth
* Breadth
* Recency
* Return behavior
* Action signal
* Conversation signal
* Follow-up response

## Depth

How far into meaningful content did the prospect go?

## Breadth

How many relevant sections did the prospect explore?

## Recency

How recently did engagement happen?

## Return Behavior

Did the prospect return after initial viewing?

## Action Signal

Did the prospect request callback, reserve webinar, or ask a question?

## Follow-Up Response

Did human follow-up create clarity, conversation, pause, or opt-out?

## Engagement Summary Format

Engagement summary should be plain language:

"Prospect completed the core presentation, returned once, and viewed webinar information. Recommended posture: conversation invitation."

---

# PAGE 43 - RECOMMENDATION FRAMEWORK

## PMV Recommendation Types

* `wait`
* `access_help`
* `clarity_question`
* `conversation_invitation`
* `webinar_support`
* `resource_offer`
* `patient_nurture`
* `pause_follow_up`
* `close_respectfully`
* `human_review`

## Recommendation Inputs

* Prospect state
* Momentum state
* Engagement score
* Momentum score
* Viewing summary
* Invitation history
* Follow-up history
* CRM notes
* Compliance rules
* Agent outcomes

## Recommendation Requirements

Each recommendation must include:

* Recommended posture
* Suggested timing
* Plain-language rationale
* Evidence references
* Compliance status
* Human approval requirement
* Stop or pause condition

## Recommendation Boundary

PMV may recommend the next support posture.

PMV may not decide the relationship.

---

# PAGE 44 - FUTURE AI INTEGRATION FRAMEWORK

## AI Integration Purpose

Future AI integrations should make PMV more respectful, clearer, and more useful.

They must not make PMV more pressuring.

## Future AI Capabilities

Future AI may support:

* Better engagement summaries
* Better follow-up timing
* Better message drafting
* Better resource matching
* Better webinar matching
* Better Holding Tank nurture
* Better compliance screening
* Better learning from outcomes

## Required AI Governance

Every future PMV AI feature must define:

* Agent owner
* Data access scope
* Memory writes
* GraphRAG requirements
* Recommendation authority
* Escalation rules
* Compliance rules
* Human approval requirements
* Learning signals

## Future Agent Integration

* Ivory drafts and reviews follow-up language.
* Michael supports BA reflection and mentor guidance.
* Daily Success Coach turns PMV needs into manageable BA actions.
* Compliance Agent reviews risky wording.
* Event Agent recommends educational events.
* Knowledge Agent grounds answers in approved material.
* Customer Success Agent identifies product friction in prospect experience.

---

# PAGE 45 - GRAPHRAG PMV ARCHITECTURE

## GraphRAG Purpose

PMV GraphRAG grounds recommendations in real prospect activity, relationship context, and governed knowledge.

## Retrieval Plan

1. Retrieve PMV canonical record from Mongo.
2. Retrieve prospect, invitation, token, follow-up, and CRM records.
3. Search Chroma for similar engagement summaries and follow-up outcomes.
4. Traverse Neo4j for invitation, activity, recommendation, and outcome paths.
5. Apply compliance rules.
6. Generate a recommended follow-up posture.
7. Record recommendation, evidence, and outcome plan.

## GraphRAG Output

Every PMV GraphRAG output must include:

* Prospect state
* Momentum state
* Engagement summary
* Recommended action
* Follow-up posture
* Evidence references
* Confidence
* Escalation flag
* Pause condition

## GraphRAG Boundary

GraphRAG may connect evidence.

It may not invent intent.

---

# PAGE 46 - PMV LEARNING SIGNALS

## Learning Purpose

PMV learns to improve timing, relevance, and respect.

It does not learn how to pressure people.

## Learning Signals

* Invitation opened after message type
* Presentation completed after follow-up
* Callback requested
* Webinar reserved
* Follow-up accepted
* Follow-up ignored
* Follow-up caused opt-out
* Prospect asked for pause
* Prospect reported confusion
* Prospect found resource helpful
* BA marked recommendation useful
* BA rejected recommendation
* Compliance blocked draft
* Human corrected AI summary

## Learning Outputs

* Better follow-up timing
* Better posture selection
* Better wording recommendations
* Better pause conditions
* Better escalation rules
* Better resource matching

## Learning Boundary

Learning must remain auditable.

Human correction outranks pattern inference.

---

# PAGE 47 - PMV PRIVACY AND DISPLAY GOVERNANCE

## Privacy Principle

PMV should show useful awareness without making the prospect feel watched.

## BA Display Rules

Show:

* State
* Last meaningful activity
* Engagement summary
* Recommended posture
* Follow-up timing

Avoid:

* Intrusive micro-tracking
* Excessive detail
* Surveillance-style labels
* Pressure rankings

## Prospect-Facing Rules

Prospect-facing surfaces must never expose internal PMV scoring, tracking detail, or AI recommendation logic.

Prospect-facing copy must remain educational, respectful, and non-pressuring.

## Audit Rules

Internal events remain auditable for governance and system integrity.

Auditability does not mean all details should be displayed to every user.

---

# PAGE 48 - PMV SUCCESS CRITERIA

## PMV Succeeds When

* Prospects feel respected
* BAs follow up with better timing
* Relationships are preserved
* Education happens before action
* Follow-up becomes more helpful
* Pressure decreases
* CRM context improves
* Ivory recommendations improve
* Daily actions become more relevant
* Holding Tank timing is honored
* Compliance risk decreases

## PMV Fails When

* Prospects feel tracked or pressured
* BAs chase activity scores
* AI qualifies prospects
* Follow-up becomes manipulative
* Scores replace judgment
* Relationship context is ignored
* PMV creates urgency instead of clarity
* Data cannot be audited
* Engagement is treated as commitment

## Governance Conclusion

PMV is awareness in service of relationship.

It helps the BA see where support may be useful.

It helps Ivory recommend respectful words.

It helps CRM preserve context.

It helps the Daily Success Coach turn relationship stewardship into manageable action.

It helps the system honor timing.

The prospect remains a person.

The relationship remains human.

The goal remains transformation through trust, clarity, education, and momentum.
