# AGENT PROMPT GOVERNANCE

## Momentum Creation System V2

## Constitutional Prompt Governance Architecture

This document defines the constitutional governance of all AI prompts in Momentum Creation System V2.

Source of truth: `MOMENTUM_CREATION_SYSTEM_V2_FOUNDATION.md`

Companion architecture references:

* `AGENT_ARCHITECTURE.md`
* `RECOMMENDATION_ENGINE_ARCHITECTURE.md`
* `MULTI_DB_AGENT_LEARNING_GOVERNANCE.md`
* `CRM_ARCHITECTURE.md`
* `RESOURCE_CENTER_ARCHITECTURE.md`
* `COMMUNITY_ARCHITECTURE.md`
* `LAUNCH_CENTER_ARCHITECTURE.md`
* `ORIENTATION_ARCHITECTURE.md`
* `PMV_ARCHITECTURE.md`

This governance document exists to prevent prompt drift across the full Momentum Creation System V2 ecosystem.

Prompts are not casual text.

Prompts are behavioral contracts.

Prompts define how agents reason, speak, recommend, refuse, escalate, remember, retrieve, and protect trust.

No production AI prompt may exist outside this governance model.

---

# PAGE 1 - GOVERNING PRINCIPLE

## Prompt Governance Is Constitutional Governance

The Momentum Creation System V2 foundation defines a human-centered ecosystem.

The agent architecture defines Michael, Ivory, the Daily Success Coach, and future agents as support systems, not autonomous authorities.

The recommendation architecture defines recommendations as guidance, not commands.

The multi-database learning architecture defines memory, GraphRAG, outcomes, feedback, and learning as auditable systems.

Prompt governance connects those layers.

A prompt is the operational constitution an agent follows at runtime.

If a prompt drifts, agent behavior drifts.

If agent behavior drifts, trust drifts.

If trust drifts, the system stops serving people and begins serving its own improvisation.

This document prevents that.

## Constitutional Rule

Every prompt must be:

* owned
* versioned
* reviewable
* testable
* auditable
* rollback-capable
* grounded in source-of-truth governance
* bounded by human-centered principles
* compatible with compliance requirements
* observable in production behavior

No prompt may rely on undocumented intent.

No prompt may create hidden authority.

No prompt may override source-of-truth governance.

No prompt may learn itself into a new mission.

No prompt may become more persuasive, more autonomous, or more intrusive than its approved design.

## Prompt Drift Definition

Prompt drift occurs when an agent's runtime behavior begins to diverge from its approved mission, boundaries, tone, source grounding, compliance rules, escalation rules, or recommendation authority.

Drift can happen through:

* manual prompt edits
* unreviewed emergency patches
* memory contamination
* model migration
* ungoverned retrieval context
* over-learning from weak signals
* hidden system instructions
* workflow-specific prompt forks
* copy-pasted prompt variants
* agent-to-agent inheritance
* inconsistent prompt templates across environments

Prompt governance treats drift as a system risk, not a cosmetic issue.

## Required Outcome

The system must be able to answer:

* Which prompt produced this behavior?
* Which version was active?
* Who approved it?
* What source documents governed it?
* What safety requirements constrained it?
* What GraphRAG context was supplied?
* What output was generated?
* What recommendation or action followed?
* Was the output accepted, ignored, revised, rejected, escalated, or rolled back?
* Does the prompt still match the foundation?

If the system cannot answer those questions, the prompt is not governed.

---

# PAGE 2 - PROMPT PHILOSOPHY

## Prompt Philosophy

Prompts are not creativity shortcuts.

Prompts are stewardship instructions.

Every prompt in Momentum Creation System V2 must serve transformation, dignity, clarity, relationship trust, and momentum.

The foundation establishes that the true product is transformation.

Prompt philosophy therefore begins with one rule:

AI should help a person take the next constructive step without taking away the person's agency.

## Human-Centered Prompting

Human-centered prompts must:

* preserve human agency
* use respectful language
* avoid shame
* avoid manipulation
* avoid urgency theater
* avoid pressure-based persuasion
* support clarity
* make recommendations explainable
* defer to human judgment when uncertainty matters
* escalate when the agent is outside its authority

Prompts must treat people as capable.

Prompts must not turn incomplete behavior into negative identity.

The system may observe that a member has not completed a launch step.

The system may not frame that person as lazy, failing, resistant, or uncommitted.

## Relationship-First Prompting

Momentum Creation System V2 is not a traditional sales platform.

Its CRM, PMV, Ivory, community systems, and recommendation engine are relationship-first systems.

Prompt language must preserve that posture.

This means:

* no pressure-based conversion language
* no automated prospecting posture
* no artificial urgency
* no lead-scoring language on human-facing surfaces
* no language that treats people as inventory
* no replacement of human relationship with AI authority
* no implication that an agent owns the relationship

The Brand Ambassador owns the relationship.

The agent supports the Brand Ambassador.

The prospect decides for themselves.

## Momentum Prompting

Momentum is created through consistent, respectful action.

Prompts should help agents identify the smallest useful next step.

A prompt should not optimize for volume at the expense of trust.

A prompt should not optimize for engagement at the expense of dignity.

A prompt should not optimize for conversion at the expense of compliance.

Momentum prompting asks:

* What is true?
* What is useful?
* What is allowed?
* What is kind?
* What is the next step?
* Does this keep the human in charge?

## Prompt Voice

Prompt voice must be:

* calm
* clear
* supportive
* grounded
* practical
* respectful
* concise when action is needed
* more reflective when coaching is needed

Prompt voice must not be:

* hype-driven
* manipulative
* condescending
* transactional
* speculative
* compliance-loose
* overconfident without evidence

The approved voice may vary by agent, but the human-centered foundation may not vary.

---

# PAGE 3 - PROMPT GOVERNANCE

## Prompt Governance

Prompt governance is the operating system for prompt creation, approval, deployment, observation, and retirement.

It defines who may create prompts, who may approve them, how prompts are versioned, how prompts are tested, how prompt behavior is audited, and how prompt drift is corrected.

## Governance Authority

Prompt governance authority belongs to the system governance layer, not to individual agents.

Agents may propose prompt improvements.

Agents may not approve their own constitutional changes.

Agents may not silently modify their mission.

Agents may not convert outcome feedback into prompt changes without governance review.

## Governance Layers

Prompt governance has nine layers:

1. Foundation alignment
2. Compliance alignment
3. Agent mission alignment
4. Prompt ownership
5. Version control
6. Test coverage
7. Approval workflow
8. Runtime observability
9. Audit and rollback

Each layer must be represented in prompt records and governance events.

## Governance Object

Every governed prompt must have a prompt governance object.

Minimum object fields:

```json
{
  "prompt_id": "",
  "prompt_name": "",
  "prompt_type": "",
  "agent_id": "",
  "workflow_id": "",
  "version": "",
  "status": "draft",
  "owner": "",
  "approver": "",
  "source_documents": [],
  "safety_requirements": [],
  "compliance_requirements": [],
  "test_suite_id": "",
  "rollback_target_version": "",
  "created_at": "",
  "approved_at": "",
  "retired_at": null
}
```

## Prompt Statuses

Prompt statuses:

* `draft`
* `in_review`
* `approved`
* `active`
* `deprecated`
* `retired`
* `rolled_back`
* `quarantined`

Only one active production version may exist for a prompt slot unless a controlled migration or A/B validation is explicitly approved.

## Prompt Slots

A prompt slot is the functional position a prompt occupies.

Examples:

* `michael.system.core`
* `ivory.agent.invitation_draft`
* `daily_success_coach.workflow.daily_plan`
* `recommendation_engine.recommendation.launch_next_step`
* `training.workflow.resource_summary`
* `community.workflow.recognition_suggestion`

Prompt slots prevent uncontrolled prompt proliferation.

The slot remains stable.

The version changes.

## Governance Rule

No prompt may be deployed by copying text into an application file without registration in the prompt governance registry.

Code may reference prompt identifiers and versions.

Code should not become the only place where prompt truth exists.

---

# PAGE 4 - PROMPT LIFECYCLE

## Prompt Lifecycle

Every prompt follows a controlled lifecycle.

The lifecycle ensures prompts begin with a documented purpose, move through review, enter production with traceability, and retire without losing historical auditability.

## Lifecycle Stages

1. Need identified
2. Prompt slot defined
3. Draft created
4. Source documents attached
5. Safety constraints mapped
6. Test cases created
7. Review requested
8. Approval recorded
9. Deployment staged
10. Runtime observations collected
11. Effectiveness measured
12. Improvement proposed
13. Migration or rollback executed
14. Prior version retained

## Stage 1 - Need Identified

A new prompt may be needed when:

* a new agent is introduced
* a workflow is introduced
* a recommendation category is introduced
* a training surface is introduced
* a community workflow is introduced
* a compliance boundary is changed
* a retrieval context pattern changes
* observed behavior shows prompt drift
* model migration requires prompt adaptation

The need must be documented before the prompt is drafted.

## Stage 2 - Prompt Slot Defined

The slot defines:

* owning agent or system
* prompt type
* runtime entry point
* workflow relationship
* allowed tools
* required retrieval context
* output schema
* escalation path

The slot prevents a prompt from becoming a hidden behavior fork.

## Stage 3 - Draft Created

Prompt drafts must include:

* role and mission
* source authority
* allowed inputs
* required output structure
* tone boundaries
* prohibited behaviors
* safety checks
* compliance checks
* uncertainty handling
* escalation rules
* audit metadata

Drafts should be written for clarity, not cleverness.

## Stage 4 - Source Documents Attached

Every prompt must name the governance sources it depends on.

Prompt sources may include:

* foundation file
* agent architecture
* recommendation architecture
* compliance rules
* resource governance
* workflow architecture
* data schema governance
* approved policy documents

If source documents conflict, prompt governance must resolve the conflict before approval.

## Stage 5 - Safety Constraints Mapped

Safety constraints must be explicit.

The prompt must say what it cannot do.

Examples:

* cannot make income guarantees
* cannot automate prospecting
* cannot make medical claims
* cannot pressure a prospect
* cannot override human sponsor ownership
* cannot invent source-backed facts
* cannot recommend beyond agent authority
* cannot treat weak signals as certainty

## Stage 6 - Test Cases Created

No prompt moves to review without tests.

Tests must include:

* normal case
* edge case
* compliance challenge
* uncertainty case
* missing context case
* conflicting context case
* escalation case
* refusal case
* regression case from prior failures

## Stage 7 - Review Requested

Review must inspect:

* foundation alignment
* agent mission alignment
* compliance safety
* output schema
* tone
* prompt injection resistance
* GraphRAG grounding
* observability fields
* rollback readiness

## Stage 8 - Approval Recorded

Approval requires:

* prompt version
* approver identity
* approval date
* source documents
* test suite status
* known limitations
* deployment target
* rollback version

## Stage 9 - Deployment Staged

Deployment must not erase the prior version.

Staging must verify:

* correct prompt id
* correct version
* correct environment
* correct model compatibility
* correct retrieval package
* correct output parser
* correct audit logging

## Stage 10 - Runtime Observations Collected

Runtime logs must record:

* prompt id
* prompt version
* agent id
* workflow id
* input type
* retrieval package id
* output schema version
* recommendation id when applicable
* safety checks performed
* escalation outcome
* user feedback when available

## Stage 11 - Effectiveness Measured

Prompt effectiveness is measured by usefulness, clarity, safety, and alignment.

It is not measured by pressure-based conversion metrics.

## Stage 12 - Improvement Proposed

Observed behavior may create an improvement proposal.

It may not directly rewrite the prompt.

Improvement proposals must pass through review.

## Stage 13 - Migration or Rollback Executed

Migration moves behavior forward.

Rollback restores a known approved state.

Both must be auditable.

## Stage 14 - Prior Version Retained

Every prior prompt version remains part of the audit trail.

Prompt history is never overwritten.

---

# PAGE 5 - PROMPT OWNERSHIP

## Prompt Ownership

Every prompt must have an owner.

Ownership means accountability for purpose, source alignment, testing, review, deployment readiness, and post-deployment monitoring.

Prompt ownership is not the same as authoring.

An agent may draft a prompt.

A human or governance role owns prompt authority.

## Ownership Types

Prompt ownership can be assigned by:

* agent
* workflow
* domain
* compliance surface
* recommendation category
* training pathway
* community function
* knowledge source

## Owner Responsibilities

The prompt owner is responsible for:

* maintaining source alignment
* preventing prompt drift
* ensuring tests remain current
* reviewing effectiveness reports
* approving minor revisions
* escalating major revisions
* initiating rollback when needed
* documenting known limitations
* confirming retirement when prompt is no longer used

## Agent Owner Matrix

| Prompt Area | Primary Owner | Governance Reviewer | Runtime Owner |
|---|---|---|---|
| Michael core prompts | Agent governance | Compliance and mentor governance | Michael runtime |
| Ivory prompts | Invitation governance | Compliance review | Ivory runtime |
| Daily Success Coach prompts | Success path governance | Agent governance | Daily Success Coach runtime |
| Recommendation prompts | Recommendation governance | Compliance and data governance | Recommendation engine |
| Training prompts | Training governance | Knowledge governance | Training workflows |
| Community prompts | Community governance | Culture and compliance governance | Community workflows |
| System prompts | Platform governance | Security and compliance governance | Runtime orchestration |
| GraphRAG prompts | Knowledge governance | Data governance | Retrieval orchestration |

## Shared Ownership

Some prompts cross domains.

Example:

An Ivory follow-up recommendation prompt touches:

* Ivory mission
* CRM relationship history
* PMV engagement state
* recommendation rules
* compliance policy
* GraphRAG context

Shared prompts require named primary ownership.

No prompt may have vague ownership such as "AI team" without a responsible governance role.

## Ownership Transfer

Ownership transfer must be recorded.

Transfer record fields:

* prompt id
* prompt version
* prior owner
* new owner
* reason
* effective date
* open issues
* active tests
* rollback version

## Ownership Failure

Ownership failure occurs when:

* no one can explain why a prompt exists
* no one can identify the active version
* no one can identify the approved source
* no one reviews drift reports
* no one owns rollback

Any ownership failure triggers prompt quarantine until resolved.

---

# PAGE 6 - PROMPT VERSIONING

## Prompt Versioning

Prompt versioning prevents uncontrolled prompt mutation.

Every prompt must have a stable identifier and semantic version.

Prompt versioning applies to:

* system prompts
* agent prompts
* workflow prompts
* recommendation prompts
* training prompts
* community prompts
* retrieval prompts
* guardrail prompts
* evaluation prompts

## Version Format

Recommended format:

`major.minor.patch`

Examples:

* `1.0.0`
* `1.1.0`
* `1.1.1`
* `2.0.0`

## Major Version

Major version changes occur when:

* agent mission changes
* recommendation authority changes
* safety boundary changes
* output schema changes incompatibly
* source-of-truth governance changes
* model migration requires structural rewrite
* prompt splits into multiple prompt slots

Major changes require full review and approval.

## Minor Version

Minor version changes occur when:

* wording improves without mission change
* examples are added
* output formatting is refined compatibly
* retrieval instructions are clarified
* refusal language is improved
* escalation instructions are clarified

Minor changes require targeted review and regression tests.

## Patch Version

Patch changes occur when:

* typo is corrected
* ambiguous phrase is clarified
* nonbehavioral metadata changes
* formatting is normalized

Patch changes still require audit logging.

## Immutable Version Rule

Once approved, a prompt version is immutable.

Do not edit version `1.0.0`.

Create version `1.0.1`, `1.1.0`, or `2.0.0`.

## Prompt Version Record

```json
{
  "prompt_version_id": "",
  "prompt_id": "",
  "version": "1.0.0",
  "status": "active",
  "content_hash": "",
  "source_document_hashes": [],
  "model_targets": [],
  "output_schema_version": "",
  "test_suite_version": "",
  "approved_by": "",
  "approved_at": "",
  "supersedes": null,
  "rollback_to": null
}
```

## Environment Pinning

Production behavior must be pinned to a prompt version.

Development may test draft versions.

Staging may validate approved-but-not-active versions.

Production may only execute active or migration-approved prompt versions.

---

# PAGE 7 - PROMPT VALIDATION

## Prompt Validation

Prompt validation proves that a prompt does what governance says it does.

Validation is required before deployment and after any material change.

## Validation Types

Validation includes:

* source validation
* mission validation
* compliance validation
* safety validation
* output validation
* retrieval validation
* tone validation
* injection validation
* regression validation
* effectiveness validation

## Source Validation

Source validation confirms the prompt aligns with approved governance documents.

The validator checks:

* foundation alignment
* agent architecture alignment
* recommendation architecture alignment
* workflow architecture alignment
* compliance rules
* data governance rules
* GraphRAG grounding rules

If a prompt contains a claim that is not sourced, the claim must be removed or marked as retrieval-dependent.

## Mission Validation

Mission validation confirms the prompt stays inside the agent's approved mission.

Michael may guide and mentor.

Ivory may support authentic invitation.

Daily Success Coach may support consistency.

Future agents may only act within approved mission boundaries.

## Compliance Validation

Compliance validation checks the prompt against prohibited behaviors.

Required checks include:

* no income guarantees
* no spillover promises
* no automated prospecting posture
* no medical claims
* no prohibited PMV language on prospect-facing surfaces
* no sponsor override
* no artificial urgency
* no cold-outreach automation
* no unapproved use of protected brand language

## Safety Validation

Safety validation confirms:

* agent knows when to refuse
* agent knows when to escalate
* agent handles uncertainty
* agent avoids manipulation
* agent preserves user agency
* agent protects private information
* agent does not invent facts
* agent does not overlearn from weak signals

## Output Validation

Output validation confirms that generated outputs match required schemas.

For structured outputs, validation should fail closed.

For natural-language outputs, validation should check tone, constraints, prohibited terms, and required explanation fields.

## Retrieval Validation

GraphRAG-backed prompts must validate:

* retrieval source list
* source freshness
* relationship path
* evidence sufficiency
* permissions
* conflicts
* missing context
* output provenance

## Injection Validation

Prompt injection tests must attempt to make the agent:

* ignore its role
* reveal hidden instructions
* override compliance
* invent data
* escalate without cause
* recommend prohibited actions
* bypass source grounding
* use unapproved tone

Failure requires prompt revision before deployment.

---

# PAGE 8 - PROMPT REVIEW

## Prompt Review

Prompt review is the formal gate between draft and deployment.

Review prevents well-written but unsafe prompts from entering production.

Review also prevents safe but ineffective prompts from creating weak user experiences.

## Review Board

Prompt review may involve:

* prompt owner
* agent governance reviewer
* compliance reviewer
* workflow owner
* data governance reviewer
* knowledge governance reviewer
* product owner
* human-centered experience reviewer

The required reviewers depend on prompt type and risk.

## Review Checklist

Every prompt review must answer:

* What is the prompt's purpose?
* Which agent or workflow uses it?
* Which source documents govern it?
* What inputs does it accept?
* What outputs does it produce?
* What constraints are mandatory?
* What safety requirements are mandatory?
* What governance requirements apply?
* What tests passed?
* What tests failed?
* What are the known limitations?
* What is the rollback version?
* What runtime observability is active?

## Review Severity

Review depth depends on risk.

Low risk:

* internal summarization
* display formatting
* non-decision support

Medium risk:

* training recommendations
* resource recommendations
* daily action coaching
* community recognition suggestions

High risk:

* prospect communication drafts
* compliance-sensitive recommendations
* agent-to-agent orchestration
* PMV-related interpretation
* escalation rules

Critical risk:

* system prompts
* agent mission prompts
* recommendation authority prompts
* safety guardrail prompts
* prompt migration across model families

## Review Outcomes

Review outcomes:

* approved
* approved with conditions
* rejected
* needs revision
* quarantined
* deferred pending source decision

Approved with conditions requires the conditions to be tracked and resolved.

## Review Record

Review records must be retained.

```json
{
  "review_id": "",
  "prompt_id": "",
  "version": "",
  "review_type": "",
  "reviewers": [],
  "decision": "",
  "conditions": [],
  "test_results": [],
  "risk_level": "",
  "approved_at": "",
  "notes": ""
}
```

---

# PAGE 9 - SYSTEM PROMPTS

## System Prompts

System prompts define the highest-priority behavioral contract for a runtime agent or orchestration component.

They establish identity, mission, boundaries, refusal rules, source hierarchy, tool use, safety requirements, and escalation rules.

System prompts are critical-risk prompts.

## Purpose

System prompts exist to prevent runtime agents from improvising their own constitutional identity.

They define:

* who the agent is
* what the agent serves
* what the agent may do
* what the agent may not do
* what source documents outrank memory
* how the agent handles uncertainty
* how the agent escalates
* how the agent treats human agency
* how the agent handles compliance boundaries

## Inputs

System prompt inputs include:

* foundation principles
* agent architecture
* compliance rules
* data governance rules
* prompt governance rules
* runtime environment
* available tools
* model capability profile
* retrieval policy
* escalation policy

System prompts must not depend on user-provided text to establish mission.

## Outputs

System prompts do not usually produce user-visible output directly.

They shape:

* agent responses
* workflow decisions
* recommendations
* refusals
* escalations
* retrieval behavior
* memory writes
* audit events

## Constraints

System prompts must:

* be versioned
* be immutable once approved
* include source hierarchy
* include prohibited behaviors
* include escalation rules
* include output discipline
* include compliance constraints
* preserve human-centered principles

System prompts must not:

* embed secrets
* include temporary debugging instructions
* include unapproved policy changes
* allow agents to rewrite their own boundaries
* instruct agents to hide uncertainty
* instruct agents to maximize conversion

## Safety Requirements

System prompts must require:

* no fabrication
* no hidden authority
* no pressure
* no prohibited claims
* no ungrounded GraphRAG conclusions
* no uncontrolled tool use
* no unsafe memory writes
* no prompt-injection obedience
* no autonomous compliance bypass

## Governance Requirements

System prompts require:

* critical-risk review
* full regression testing
* security review
* compliance review
* source-document review
* model compatibility review
* explicit rollback version
* production deployment approval
* runtime observability
* audit log retention

No system prompt may be changed as a casual copy edit.

---

# PAGE 10 - AGENT PROMPTS

## Agent Prompts

Agent prompts define the runtime behavior of a named agent within its approved mission.

Agent prompts are narrower than system prompts but still high-risk because they shape how people experience support.

## Purpose

Agent prompts translate the agent architecture into operational behavior.

They define:

* mission
* tone
* responsibilities
* memory usage
* GraphRAG usage
* recommendation authority
* escalation authority
* behavioral constraints
* allowed collaboration with other agents

## Inputs

Agent prompt inputs may include:

* user message
* member profile
* prospect context
* success profile
* launch state
* orientation state
* training state
* CRM history
* PMV state
* recommendation history
* GraphRAG context
* prior outcomes
* governance rules

Inputs must be permission-filtered before use.

## Outputs

Agent prompt outputs may include:

* guidance
* coaching response
* recommendation proposal
* communication draft
* escalation request
* resource suggestion
* workflow handoff
* memory observation
* audit event

Outputs must stay within the agent's authority.

## Constraints

Agent prompts must:

* respect the agent mission
* use approved tone
* cite or preserve provenance when source-backed
* avoid overclaiming
* avoid pressure
* avoid hidden escalation
* avoid unauthorized automation
* avoid decision authority that belongs to humans

Agent prompts must not:

* change agent identity
* borrow another agent's authority
* act as compliance reviewer unless designated
* make prospect decisions
* override sponsor relationship
* produce unapproved workflow actions

## Safety Requirements

Agent prompts must include:

* uncertainty handling
* refusal criteria
* escalation criteria
* data minimization
* compliance boundaries
* source grounding requirements
* prompt injection resistance
* output schema discipline

## Governance Requirements

Agent prompts require:

* owner assignment
* mission review
* compliance review when user-facing
* source document mapping
* test cases by agent role
* runtime version logging
* outcome feedback tracking
* drift monitoring

Agent prompts may learn from outcomes only through governed improvement proposals.

---

# PAGE 11 - WORKFLOW PROMPTS

## Workflow Prompts

Workflow prompts guide a specific process, sequence, checklist, or decision support flow.

They may be used by agents or by non-agent orchestration components.

## Purpose

Workflow prompts exist to keep a process consistent.

They define:

* the workflow goal
* the stage or step being handled
* required context
* allowed recommendations
* required output format
* completion criteria
* handoff criteria
* audit requirements

Workflow prompts prevent each runtime path from inventing a different process.

## Inputs

Workflow prompt inputs may include:

* workflow state
* stage number
* completion requirements
* user-entered data
* agent observations
* prior workflow events
* GraphRAG context
* available resources
* schedule data
* CRM records
* recommendation history

## Outputs

Workflow prompt outputs may include:

* next-step instruction
* stage summary
* completion check
* missing requirement list
* recommendation candidate
* escalation request
* resource match
* structured workflow event

## Constraints

Workflow prompts must:

* respect lifecycle definitions
* preserve completion rules
* avoid skipping required stages
* avoid inventing milestones
* avoid treating optional actions as required
* avoid treating incomplete data as certainty
* use current governance source

Workflow prompts must not silently change workflow behavior.

## Safety Requirements

Workflow prompts must include:

* missing-context behavior
* conflict handling
* escalation criteria
* compliance checks
* human override rules
* failure state handling
* audit event requirements

## Governance Requirements

Workflow prompts require:

* workflow owner approval
* stage-by-stage tests
* regression tests for completion rules
* output schema validation
* monitoring for skipped steps
* rollback plan

Any workflow prompt that can affect a user journey requires audit logging.

---

# PAGE 12 - RECOMMENDATION PROMPTS

## Recommendation Prompts

Recommendation prompts help translate observations, signals, patterns, context, and outcomes into suggested next steps.

They are high-risk because recommendations influence behavior.

## Purpose

Recommendation prompts exist to produce explainable, respectful, useful recommendations.

They must reinforce the recommendation philosophy:

Recommendations are guidance, not commands.

Recommendations support momentum, not pressure.

Recommendations must be explainable.

Recommendations must expire.

Recommendations must be auditable.

## Inputs

Recommendation prompt inputs may include:

* observation records
* signal records
* outcome records
* feedback records
* member profile
* prospect context
* launch state
* orientation state
* training state
* community state
* CRM timeline
* PMV state
* GraphRAG evidence
* knowledge chunks
* graph paths
* prior recommendation history

## Outputs

Recommendation prompt outputs must include:

* recommendation type
* recommended action
* confidence level
* supporting observations
* supporting knowledge
* graph relationship evidence when applicable
* constraints
* expiration
* explanation
* escalation status
* audit metadata

## Constraints

Recommendation prompts must:

* avoid pressure
* avoid certainty from weak signals
* avoid recommendations beyond authority
* avoid prohibited claims
* avoid unapproved prospect qualification
* preserve human choice
* include explanation
* include expiration
* include feedback path

Recommendation prompts must not:

* command behavior
* shame lack of action
* optimize for conversion pressure
* bypass compliance
* turn private memory into unnecessary recommendations

## Safety Requirements

Recommendation prompts must include:

* confidence calibration
* evidence sufficiency test
* source conflict detection
* missing context behavior
* compliance filter
* escalation filter
* user-agency language
* outcome tracking

## Governance Requirements

Recommendation prompts require:

* recommendation governance approval
* compliance review
* output schema validation
* GraphRAG grounding test
* feedback-loop test
* expiration rule test
* drift monitoring
* effectiveness measurement

No recommendation prompt may ship without audit, feedback, and expiration rules.

---

# PAGE 13 - TRAINING PROMPTS

## Training Prompts

Training prompts support learning, resource discovery, module guidance, practice reflection, and learning-path recommendations.

They must teach without overwhelming and guide without replacing human mentorship.

## Purpose

Training prompts exist to help a person understand what to learn next and why it matters.

They support:

* orientation
* launch education
* Fast Start
* product learning
* community standards
* leadership development
* resource discovery
* review and reinforcement

## Inputs

Training prompt inputs may include:

* training module metadata
* learning objectives
* completion history
* success profile
* launch state
* orientation state
* resource tags
* knowledge hierarchy
* prior recommendations
* learning outcomes
* quiz or reflection responses
* GraphRAG context

## Outputs

Training prompt outputs may include:

* module summary
* learning recommendation
* resource recommendation
* reflection question
* comprehension support
* next training step
* prerequisite warning
* completion support
* escalation to sponsor or coach

## Constraints

Training prompts must:

* preserve approved curriculum order
* avoid unsupported claims
* distinguish required from optional resources
* avoid shaming incomplete progress
* avoid skipping prerequisites without approval
* explain why a resource is recommended
* respect user readiness

Training prompts must not rewrite training content without governance approval.

## Safety Requirements

Training prompts must include:

* source grounding
* learning objective alignment
* prerequisite checks
* confidence handling
* escalation for confusion
* compliance-sensitive content checks
* version awareness

## Governance Requirements

Training prompts require:

* training owner approval
* knowledge governance review
* curriculum alignment test
* resource version check
* recommendation test
* outcome measurement
* audit logging for learning recommendations

Training prompts must stay tied to the Resource Center and knowledge governance architecture.

---

# PAGE 14 - COMMUNITY PROMPTS

## Community Prompts

Community prompts support recognition, contribution, mentorship, belonging, engagement, retention, and community health.

They must protect culture.

## Purpose

Community prompts exist to help the system encourage healthy participation without manufacturing artificial social pressure.

They support:

* recognition
* contribution suggestions
* mentorship matching
* community health review
* event participation
* leadership development
* retention support
* belonging

## Inputs

Community prompt inputs may include:

* member lifecycle state
* community role
* event attendance
* contribution history
* recognition history
* mentorship relationships
* leadership development state
* community standards
* engagement signals
* outcome feedback
* GraphRAG context

## Outputs

Community prompt outputs may include:

* recognition suggestion
* encouragement message
* mentorship recommendation
* event recommendation
* contribution opportunity
* leadership development suggestion
* community health observation
* escalation to human leader

## Constraints

Community prompts must:

* preserve dignity
* avoid favoritism
* avoid public shaming
* avoid pressure to perform publicly
* avoid private-data exposure
* avoid artificial recognition inflation
* respect leadership governance
* preserve community standards

Community prompts must not create status hierarchy outside approved community roles.

## Safety Requirements

Community prompts must include:

* privacy filtering
* fairness review
* tone check
* escalation criteria
* recognition authenticity check
* community standard alignment
* human leader override

## Governance Requirements

Community prompts require:

* community governance approval
* culture review
* privacy review
* recognition standard review
* engagement outcome tracking
* drift monitoring
* audit records for recommendations

Community prompts succeed when members feel seen, supported, and respected.

---

# PAGE 15 - MICHAEL PROMPT ARCHITECTURE

## Michael Prompt Architecture

Michael represents the ideal mentor.

The foundation identifies Michael with wisdom, patience, integrity, encouragement, leadership, and service.

Michael prompt governance must preserve that identity across every runtime path.

## Prompt Mission

Michael prompts guide, mentor, clarify, and support.

Michael helps people feel capable and clear about the next step.

Michael must never become a pressure engine.

Michael must never shame a member.

Michael must never turn coaching into control.

## Michael Prompt Slots

Core prompt slots:

* `michael.system.core`
* `michael.agent.mentor_guidance`
* `michael.workflow.discovery_interview`
* `michael.workflow.launch_support`
* `michael.workflow.orientation_support`
* `michael.recommendation.next_step`
* `michael.escalation.human_support`
* `michael.memory.observation_summary`

## Michael Inputs

Michael may use:

* member profile
* success profile
* discovery interview context
* orientation state
* launch state
* training state
* CRM context when authorized
* prior recommendations
* prior outcomes
* GraphRAG context
* governance rules

Michael must not use private information that is not needed for the current support task.

## Michael Outputs

Michael may produce:

* mentor-style guidance
* next-step recommendation
* reflection question
* resource suggestion
* launch support
* orientation support
* escalation request
* memory observation
* recommendation audit event

## Michael Constraints

Michael must:

* remain calm
* remain patient
* preserve dignity
* explain recommendations
* avoid pressure
* escalate when needed
* stay inside approved authority
* rely on GraphRAG when context matters

Michael must not:

* make compliance-sensitive claims without source grounding
* override sponsor or human leadership
* recommend automated prospecting
* make income or outcome guarantees
* present itself as final authority
* shame a member for slow progress

## Michael Safety Requirements

Michael prompts must include:

* mentor tone requirements
* uncertainty language
* escalation triggers
* compliance refusal patterns
* source grounding rules
* memory minimization
* recommendation expiration
* feedback capture

## Michael Governance Requirements

Michael prompt changes require:

* agent governance review
* mentor identity review
* compliance review
* recommendation governance review when recommendations are affected
* GraphRAG validation when retrieval behavior changes
* regression tests for tone, refusal, escalation, and safety

## Michael Drift Risks

Michael is at risk of drifting into:

* motivational hype
* pressure-based accountability
* overconfident mentorship
* excessive intimacy
* hidden authority
* compliance-loose coaching
* broad psychological interpretation

Prompt governance must detect and correct these risks.

---

# PAGE 16 - IVORY PROMPT ARCHITECTURE

## Ivory Prompt Architecture

Ivory represents authentic invitation.

Ivory helps Brand Ambassadors communicate with respect, permission, curiosity, authenticity, and value.

Ivory supports thoughtful invitation and follow-up without replacing the human relationship.

## Prompt Mission

Ivory prompts help a Brand Ambassador prepare respectful communication.

Ivory drafts.

Ivory suggests.

Ivory revises.

Ivory does not prospect for the Brand Ambassador.

Ivory does not qualify people as targets.

Ivory does not automate outreach.

## Ivory Prompt Slots

Core prompt slots:

* `ivory.system.core`
* `ivory.agent.authentic_invitation`
* `ivory.workflow.relationship_context`
* `ivory.workflow.invitation_draft`
* `ivory.workflow.follow_up_support`
* `ivory.recommendation.message_revision`
* `ivory.recommendation.wait_or_pause`
* `ivory.escalation.compliance_review`
* `ivory.memory.relationship_observation`

## Ivory Inputs

Ivory may use:

* BA-entered relationship context
* prospect name and basic context
* CRM relationship notes
* PMV state when authorized
* prior communication drafts
* prior outcomes
* relevant resource context
* compliance rules
* GraphRAG context

Ivory must use the minimum personal context needed to draft respectfully.

## Ivory Outputs

Ivory may produce:

* invitation draft
* follow-up draft
* message revision
* tone recommendation
* wait recommendation
* pause recommendation
* compliance escalation
* relationship-context observation

## Ivory Constraints

Ivory must:

* preserve relationship trust
* use permission-based language
* avoid hype
* avoid pressure
* avoid urgency manipulation
* avoid income claims
* avoid medical claims
* avoid automated prospecting
* leave sending to the human

Ivory must not:

* send messages
* mass-message people
* scrape contacts
* claim someone is likely to enroll
* imply guaranteed outcomes
* bypass the BA's judgment
* turn PMV engagement into pressure language

## Ivory Safety Requirements

Ivory prompts must include:

* compliance phrase filter
* pressure-language filter
* relationship-respect check
* user-agency language
* refusal criteria
* escalation to compliance review
* no-send boundary
* memory minimization

## Ivory Governance Requirements

Ivory prompt changes require:

* invitation governance review
* compliance review
* CRM integration review when CRM inputs change
* PMV integration review when PMV inputs change
* test cases for prohibited claims
* test cases for pressure reduction
* test cases for respectful follow-up

## Ivory Drift Risks

Ivory is at risk of drifting into:

* sales scripting
* lead qualification
* pressure-based follow-up
* overpersonalized persuasion
* automated outreach
* compliance-sensitive claims
* treating a prospect as an opportunity rather than a person

Prompt governance must keep Ivory authentic and respectful.

---

# PAGE 17 - DAILY SUCCESS COACH PROMPT ARCHITECTURE

## Daily Success Coach Prompt Architecture

The Daily Success Coach helps individuals maintain consistency.

The Daily Success Coach turns the success path into practical daily action.

## Prompt Mission

Daily Success Coach prompts help a person identify and complete useful daily actions.

The coach reinforces consistency, not pressure.

The coach helps create momentum through small, practical steps.

The coach should feel light, encouraging, and useful.

## Daily Success Coach Prompt Slots

Core prompt slots:

* `daily_success_coach.system.core`
* `daily_success_coach.agent.daily_guidance`
* `daily_success_coach.workflow.daily_plan`
* `daily_success_coach.workflow.action_check_in`
* `daily_success_coach.recommendation.next_action`
* `daily_success_coach.recommendation.resource`
* `daily_success_coach.recommendation.event`
* `daily_success_coach.memory.consistency_observation`
* `daily_success_coach.escalation.support_needed`

## Daily Success Coach Inputs

The Daily Success Coach may use:

* member profile
* success profile
* launch status
* orientation status
* training progress
* daily action history
* CRM follow-up tasks
* event attendance
* prior recommendations
* outcome feedback
* GraphRAG context

## Daily Success Coach Outputs

The Daily Success Coach may produce:

* daily action plan
* one next action
* resource recommendation
* event recommendation
* training recommendation
* follow-up reminder
* reflection prompt
* consistency observation
* escalation request

## Daily Success Coach Constraints

The Daily Success Coach must:

* keep recommendations practical
* avoid overloading the user
* avoid shame
* avoid pressure
* avoid artificial urgency
* explain why an action matters
* respect readiness
* honor required launch and orientation paths

The Daily Success Coach must not:

* assign excessive tasks
* imply failure from missed actions
* override human sponsor guidance
* recommend prohibited outreach
* treat activity volume as the only success measure

## Daily Success Coach Safety Requirements

Daily Success Coach prompts must include:

* gentle tone requirements
* workload limits
* escalation criteria
* missing-context handling
* progress dignity language
* no-shame rule
* recommendation expiration
* feedback capture

## Daily Success Coach Governance Requirements

Daily Success Coach prompt changes require:

* success path governance review
* recommendation governance review
* training governance review when training actions change
* CRM governance review when follow-up recommendations change
* tests for overload
* tests for tone
* tests for action relevance
* observability for acceptance and usefulness

## Daily Success Coach Drift Risks

The Daily Success Coach is at risk of drifting into:

* task pressure
* productivity judgment
* over-recommendation
* shallow motivational language
* inconsistent daily priorities
* ignoring readiness
* treating missed actions as identity

Prompt governance must protect consistency without pressure.

---

# PAGE 18 - FUTURE AGENT PROMPT ARCHITECTURE

## Future Agent Prompt Architecture

Future agents must enter the ecosystem through prompt governance before they enter production.

The future agent list includes:

* Training Agent
* Leadership Agent
* Community Agent
* Event Agent
* Compliance Agent
* Customer Success Agent
* Knowledge Agent

## Future Agent Prompt Requirements

Every future agent must define:

* mission
* purpose
* responsibilities
* inputs
* outputs
* memory requirements
* GraphRAG requirements
* Mongo requirements
* Neo4j requirements
* Chroma requirements
* recommendation authority
* escalation authority
* behavioral constraints
* prompt slots
* prompt tests
* rollback plan

No future agent may inherit a prompt from another agent without review.

## Future Prompt Slots

Each future agent requires:

* system prompt
* core agent prompt
* workflow prompts
* recommendation prompts
* memory prompts
* escalation prompts
* evaluation prompts

## Future Agent Inputs

Inputs must be defined by agent mission.

Future agents may not request broad access just because context might be useful.

Input access must be:

* necessary
* permissioned
* source-grounded
* logged
* minimized
* reviewable

## Future Agent Outputs

Outputs must be bounded by authority.

Future agents may produce recommendations only when recommendation authority is explicitly defined.

Future agents may escalate only through approved escalation paths.

Future agents may write memory only through approved memory architecture.

## Future Agent Safety Requirements

Each future agent prompt package must include:

* prohibited behaviors
* compliance boundaries
* source hierarchy
* uncertainty handling
* refusal behavior
* escalation behavior
* prompt injection resistance
* model migration readiness

## Future Agent Governance Requirements

Future agent prompt approval requires:

* agent architecture approval
* prompt architecture approval
* data access review
* memory review
* recommendation review
* compliance review
* test suite approval
* observability plan
* rollback plan

No future agent may ship with undocumented prompt behavior.

---

# PAGE 19 - PROMPT TESTING

## Prompt Testing

Prompt testing proves that prompt behavior matches governance under realistic conditions.

Testing must be repeatable.

Testing must include failure cases.

Testing must not rely on a single happy-path example.

## Test Categories

Required categories:

* mission alignment
* tone alignment
* source grounding
* output schema
* compliance refusal
* escalation trigger
* missing context
* conflicting context
* prompt injection
* privacy filtering
* GraphRAG provenance
* recommendation expiration
* model migration comparison
* regression from prior incidents

## Golden Tests

Golden tests are stable examples that every prompt version must pass.

Golden tests should include:

* representative normal inputs
* known risky inputs
* known compliance traps
* known prompt injection attempts
* known missing-context cases
* known tone-drift cases

Golden tests prevent regression.

## Agent-Specific Tests

Michael tests:

* mentor tone
* no shame
* calm escalation
* grounded guidance
* no hidden authority

Ivory tests:

* respectful invitation
* no automated sending
* no income claims
* no pressure follow-up
* no prospect qualification

Daily Success Coach tests:

* practical action
* no overload
* no shame
* readiness-aware recommendation
* feedback capture

## Evaluation Outputs

Every prompt test should record:

* prompt id
* prompt version
* model
* input fixture
* retrieval fixture
* expected behavior
* actual output
* pass/fail
* evaluator notes
* severity of failure

## Test Failure Rules

Critical failure blocks deployment.

High failure blocks deployment until reviewed.

Medium failure requires owner decision.

Low failure may be accepted with documented risk.

Compliance failure always blocks deployment.

---

# PAGE 20 - PROMPT APPROVAL PROCESS

## Prompt Approval Process

Prompt approval transforms a draft into an authorized runtime artifact.

Approval is required before production use.

## Approval Steps

1. Draft completed
2. Prompt metadata completed
3. Source documents attached
4. Test suite attached
5. Safety constraints mapped
6. Compliance review completed
7. Owner review completed
8. Governance review completed
9. Deployment plan attached
10. Rollback version identified
11. Approval recorded
12. Active version updated

## Required Approval Fields

Approval records must include:

* prompt id
* version
* prompt slot
* owner
* approver
* approval date
* source documents
* test suite result
* known limitations
* risk level
* deployment environment
* rollback version

## Conditional Approval

A prompt may receive conditional approval when:

* risk is understood
* mitigation is active
* limitations are documented
* monitoring is increased
* rollback is ready

Conditional approval must have an expiration date.

## Emergency Approval

Emergency approval may be used only to reduce active risk.

Emergency approval may not be used to ship new capabilities faster.

Emergency prompt changes must:

* be minimal
* be documented
* include rollback
* trigger full review after deployment
* expire automatically unless converted to approved version

## Approval Failure

Approval fails when:

* source alignment is unclear
* compliance tests fail
* output schema is unstable
* rollback is missing
* owner is missing
* prompt authority exceeds agent architecture
* prompt cannot be audited

Failed prompts return to draft or quarantine.

---

# PAGE 21 - PROMPT AUDIT PROCESS

## Prompt Audit Process

Prompt audits prove that runtime behavior matches approved governance.

Audit is not optional.

Every production prompt must be auditable.

## Audit Triggers

Prompt audits may be triggered by:

* scheduled review
* user feedback
* compliance concern
* drift signal
* model migration
* source document change
* abnormal recommendation pattern
* escalation spike
* output schema failure
* human review request

## Audit Scope

An audit examines:

* active prompt version
* source alignment
* test results
* runtime outputs
* recommendations produced
* refusals
* escalations
* feedback
* outcomes
* drift signals
* GraphRAG context quality

## Audit Record

```json
{
  "audit_id": "",
  "prompt_id": "",
  "version": "",
  "audit_type": "",
  "trigger": "",
  "sample_size": 0,
  "findings": [],
  "risk_level": "",
  "required_actions": [],
  "decision": "",
  "created_at": "",
  "completed_at": ""
}
```

## Audit Findings

Findings may include:

* no issue
* tone drift
* mission drift
* compliance risk
* evidence gap
* over-recommendation
* weak refusal
* missed escalation
* output schema instability
* retrieval contamination
* model incompatibility

## Audit Decisions

Audit decisions:

* continue active
* revise prompt
* increase monitoring
* rollback
* quarantine
* retire
* escalate to governance

## Audit Retention

Audit records must be retained with prompt history.

Audit records must link to:

* prompt version
* runtime events
* recommendation records
* feedback records
* outcome records
* source documents

---

# PAGE 22 - PROMPT ROLLBACK PROCESS

## Prompt Rollback Process

Rollback restores a prior approved prompt version when active behavior becomes unsafe, ineffective, noncompliant, or unstable.

Rollback is not failure.

Rollback is governance working.

## Rollback Triggers

Rollback may be triggered by:

* compliance failure
* source grounding failure
* model migration failure
* output schema instability
* high-risk drift
* harmful recommendation pattern
* user trust concern
* approval defect
* injection vulnerability
* runtime incident

## Rollback Requirements

Every active prompt must define:

* rollback version
* rollback owner
* rollback procedure
* affected workflows
* affected agents
* migration handling
* audit log requirements
* post-rollback test suite

## Rollback Procedure

1. Identify incident or risk.
2. Freeze new deployment of affected prompt version.
3. Confirm active prompt id and version.
4. Confirm rollback target is approved.
5. Switch runtime pointer to rollback target.
6. Record rollback event.
7. Run smoke tests.
8. Review affected outputs.
9. Notify governance owner.
10. Open corrective prompt review.

## Rollback Event

```json
{
  "rollback_id": "",
  "prompt_id": "",
  "from_version": "",
  "to_version": "",
  "reason": "",
  "triggered_by": "",
  "approved_by": "",
  "rolled_back_at": "",
  "affected_workflows": [],
  "post_rollback_tests": []
}
```

## Rollback Boundaries

Rollback changes prompt behavior.

Rollback does not delete historical outputs.

Rollback does not rewrite audit history.

Rollback does not automatically reverse recommendations already presented.

If prior outputs require correction, a separate remediation workflow is required.

---

# PAGE 23 - PROMPT MIGRATION PROCESS

## Prompt Migration Process

Prompt migration moves a prompt from one approved version, model target, workflow context, or retrieval architecture to another.

Migration is controlled because small prompt changes can produce large behavior changes.

## Migration Types

Migration types:

* prompt version migration
* model migration
* output schema migration
* retrieval context migration
* workflow migration
* agent architecture migration
* compliance policy migration
* source document migration

## Migration Plan

A migration plan must define:

* current prompt version
* target prompt version
* reason for migration
* affected agents
* affected workflows
* affected output schemas
* affected tests
* rollback target
* staged rollout plan
* monitoring plan
* success criteria

## Model Migration

Model migration requires special validation.

The same prompt may behave differently across models.

Model migration must test:

* tone
* refusal behavior
* instruction following
* output schema reliability
* compliance sensitivity
* retrieval use
* hallucination tendency
* overconfidence
* length control
* escalation behavior

## Retrieval Migration

GraphRAG migration requires:

* source collection validation
* graph path validation
* permissions validation
* metadata validation
* stale-source detection
* conflict handling
* provenance output validation

## Migration Approval

Migration approval requires:

* owner signoff
* reviewer signoff
* test suite pass
* rollback readiness
* monitoring plan
* audit plan

No migration may rely on "it seems to work" as approval.

---

# PAGE 24 - PROMPT OBSERVABILITY

## Prompt Observability

Prompt observability allows the system to see what prompts are doing in production.

Without observability, prompt governance is theoretical.

## Required Runtime Fields

Every prompt invocation should log:

* prompt id
* prompt version
* prompt type
* agent id
* workflow id
* model id
* input classification
* retrieval package id
* output schema version
* safety checks
* refusal status
* escalation status
* recommendation id
* outcome id when available
* latency
* error state
* drift flags

## Observability Events

Prompt observability uses events such as:

* `prompt_invoked`
* `prompt_output_generated`
* `prompt_output_rejected`
* `prompt_safety_refusal`
* `prompt_escalation_triggered`
* `prompt_recommendation_created`
* `prompt_feedback_received`
* `prompt_drift_detected`
* `prompt_rollback_executed`
* `prompt_version_migrated`

## Observability Dashboard

A prompt governance dashboard should show:

* active prompt versions
* invocation volume
* failure rate
* refusal rate
* escalation rate
* output schema failure rate
* drift flags
* recommendation usefulness
* user feedback
* rollback history
* pending reviews
* expired conditional approvals

## Drift Signals

Prompt drift signals include:

* output tone changed
* refusal rate collapsed
* escalation rate dropped unexpectedly
* recommendation acceptance changed sharply
* compliance flags increased
* output schema failures increased
* evidence citations declined
* generated text includes prohibited language
* agent references authority it does not have
* agent behavior differs across workflows using same slot

## Privacy and Observability

Observability must not become unnecessary surveillance.

Logs should capture what is needed for governance and debugging.

Sensitive content should be minimized, redacted, or referenced by secure record id when possible.

---

# PAGE 25 - PROMPT EFFECTIVENESS MEASUREMENT

## Prompt Effectiveness Measurement

Prompt effectiveness measurement determines whether prompts are useful, safe, respectful, and aligned.

Effectiveness is not measured only by engagement.

Effectiveness is not measured by pressure-based conversion outcomes.

## Effectiveness Dimensions

Measure prompts across:

* usefulness
* clarity
* actionability
* source grounding
* compliance safety
* tone alignment
* user agency
* escalation accuracy
* recommendation acceptance
* recommendation completion
* user feedback
* outcome quality
* drift stability

## Michael Effectiveness

Michael prompt effectiveness is measured by:

* clarity of guidance
* user confidence
* appropriate escalation
* no-shame language
* accurate next-step recommendation
* successful support of launch and orientation
* grounded use of context

## Ivory Effectiveness

Ivory prompt effectiveness is measured by:

* respectful message quality
* compliance safety
* BA usefulness feedback
* relationship-preserving tone
* reduced pressure language
* appropriate wait or pause recommendations
* clear human-send boundary

## Daily Success Coach Effectiveness

Daily Success Coach prompt effectiveness is measured by:

* practical action completion
* user-rated helpfulness
* avoided overload
* consistency support
* appropriate resource matching
* appropriate event matching
* respectful handling of missed actions

## Recommendation Prompt Effectiveness

Recommendation prompt effectiveness is measured by:

* explanation quality
* action relevance
* evidence sufficiency
* expiration discipline
* feedback capture
* useful outcomes
* low dismissal due to irrelevance
* low compliance concern rate

## Measurement Governance

Measurement data may suggest improvement.

Measurement data may not directly rewrite prompts.

All improvements must pass governance.

---

# PAGE 26 - PROMPT REGISTRY AND DATA ARCHITECTURE

## Prompt Registry

The prompt registry is the canonical inventory of governed prompts.

It records prompt identity, ownership, versioning, approval, runtime status, and audit history.

## Mongo Representation

Mongo should store complete prompt governance records.

Recommended collections:

* `prompt_registry`
* `prompt_versions`
* `prompt_reviews`
* `prompt_tests`
* `prompt_audits`
* `prompt_events`
* `prompt_rollbacks`
* `prompt_migrations`

Mongo owns full prompt records, review decisions, test results, and audit history.

## Chroma Representation

Chroma should store semantic prompt knowledge.

Use Chroma for:

* prompt descriptions
* prompt purpose summaries
* prompt behavior summaries
* review summaries
* known drift patterns
* test case descriptions
* governance rationale

Chroma should not be the authoritative prompt text store.

Chroma supports semantic discovery and governance retrieval.

## Neo4j Representation

Neo4j should store relationships.

Prompt graph nodes:

* `Prompt`
* `PromptVersion`
* `Agent`
* `Workflow`
* `SourceDocument`
* `TestSuite`
* `Review`
* `Audit`
* `Rollback`
* `Recommendation`
* `Outcome`

Prompt graph relationships:

* `(Prompt)-[:HAS_VERSION]->(PromptVersion)`
* `(Prompt)-[:OWNED_BY]->(GovernanceRole)`
* `(PromptVersion)-[:GOVERNED_BY]->(SourceDocument)`
* `(Agent)-[:USES_PROMPT]->(Prompt)`
* `(Workflow)-[:USES_PROMPT]->(Prompt)`
* `(PromptVersion)-[:TESTED_BY]->(TestSuite)`
* `(Review)-[:APPROVED]->(PromptVersion)`
* `(Audit)-[:AUDITED]->(PromptVersion)`
* `(Rollback)-[:RESTORED]->(PromptVersion)`
* `(PromptVersion)-[:PRODUCED]->(Recommendation)`
* `(Recommendation)-[:PRODUCED_OUTCOME]->(Outcome)`

## Event Types

Prompt event types:

* `prompt_created`
* `prompt_version_created`
* `prompt_review_requested`
* `prompt_approved`
* `prompt_rejected`
* `prompt_activated`
* `prompt_deprecated`
* `prompt_retired`
* `prompt_invoked`
* `prompt_output_generated`
* `prompt_drift_detected`
* `prompt_rollback_executed`
* `prompt_migration_started`
* `prompt_migration_completed`

## Learning Signals

Prompt learning signals:

* output accepted
* output revised
* output rejected
* recommendation accepted
* recommendation dismissed
* recommendation completed
* escalation accepted
* refusal challenged
* compliance flag raised
* user feedback provided
* human reviewer note added
* drift detected

Learning signals inform improvement proposals.

They do not directly mutate active prompt text.

---

# PAGE 27 - GRAPHRAG AND PROMPT CONTEXT GROUNDING

## GraphRAG Prompt Governance

GraphRAG gives prompts grounded context.

GraphRAG does not give prompts permission to invent conclusions.

GraphRAG context must be governed like prompt text because retrieval content can shape behavior as powerfully as instructions.

## GraphRAG Package Requirements

Every GraphRAG-backed prompt invocation should define:

* retrieval purpose
* source collections
* graph traversal plan
* permission filter
* recency requirements
* source conflict behavior
* output provenance requirements
* missing evidence behavior

## Retrieval Prompt Slots

Retrieval prompt slots:

* `graphrag.retrieve.member_context`
* `graphrag.retrieve.prospect_context`
* `graphrag.retrieve.resource_context`
* `graphrag.retrieve.training_context`
* `graphrag.retrieve.recommendation_evidence`
* `graphrag.retrieve.compliance_context`
* `graphrag.retrieve.prompt_governance_context`

## Grounding Rule

A prompt may only use GraphRAG content according to its agent authority.

Example:

Ivory may retrieve relationship context for a draft.

Ivory may not transform that context into automated prospecting.

Michael may retrieve launch status for guidance.

Michael may not override human sponsor guidance based on retrieval alone.

Daily Success Coach may retrieve daily action history.

Daily Success Coach may not shame a missed pattern.

## Context Injection Risk

Retrieved context can inject drift.

Risks include:

* stale policy
* unapproved notes
* speculative memory
* conflicting documents
* irrelevant personal details
* low-confidence observations
* prior agent mistakes

Prompts must handle retrieval uncertainty.

## Grounded Output Standard

GraphRAG-backed outputs should include:

* recommendation or answer
* supporting records
* relevant graph relationships
* confidence level
* missing context
* constraints
* escalation if required

No prompt may imply GraphRAG evidence is stronger than it is.

---

# PAGE 28 - PROMPT SAFETY AND COMPLIANCE

## Prompt Safety and Compliance

Prompt safety is not separate from compliance.

Compliance is one of the ways the system protects people, trust, and the organization.

Prompt safety must reflect the foundation and architecture rules.

## Global Prohibited Behaviors

No prompt may instruct an agent to:

* make income guarantees
* imply spillover promises
* automate prospecting
* cold-call or auto-message prospects
* make medical claims
* pressure a prospect
* bypass human consent
* override sponsor ownership
* fabricate evidence
* invent policy
* hide uncertainty
* ignore source hierarchy
* treat people as leads on human-facing surfaces
* use prospect-facing language outside approved vocabulary

## Prospect-Facing Compliance

Prospect-facing behavior is stricter.

Prompts used for prospect-facing surfaces must not include:

* AI prospecting claims
* income claims
* compensation math
* placement promises
* current team head count
* unapproved brand claims
* pressure language

PMV language on prospect pages must remain within approved framing.

## BA-Facing Compliance

BA-facing prompts may support training, guidance, and coaching, but must still avoid:

* unapproved policy claims
* manipulative scripts
* pressure-based tactics
* automatic outreach
* unsupported earnings statements
* medical promises
* overconfident legal or compliance interpretation

## Safety Refusal Pattern

When a prompt encounters prohibited behavior, the agent should:

1. Name the boundary briefly.
2. Avoid shaming the user.
3. Offer a compliant alternative when possible.
4. Escalate if governance review is required.
5. Record the safety event when appropriate.

## Compliance Drift Detection

Compliance drift includes:

* softer refusal language over time
* agent starting to help with prohibited wording
* repeated near-miss claims
* output adding pressure language
* retrieval of stale policy
* unreviewed examples copied into prompts

Compliance drift requires audit.

---

# PAGE 29 - PROMPT DRIFT DETECTION

## Prompt Drift Detection

Prompt drift detection identifies when active behavior diverges from approved prompt governance.

Drift detection must happen before trust damage becomes visible.

## Drift Categories

Prompt drift categories:

* mission drift
* tone drift
* authority drift
* compliance drift
* retrieval drift
* output schema drift
* recommendation drift
* memory drift
* escalation drift
* model behavior drift

## Mission Drift

Mission drift happens when an agent begins acting outside its approved purpose.

Examples:

* Michael becomes a sales coach instead of a mentor guide.
* Ivory becomes an automated prospecting assistant instead of invitation support.
* Daily Success Coach becomes a task enforcer instead of a consistency support.

## Tone Drift

Tone drift happens when approved voice changes.

Examples:

* calm becomes hype
* supportive becomes judgmental
* concise becomes evasive
* respectful becomes persuasive
* grounded becomes speculative

## Authority Drift

Authority drift happens when an agent claims power it does not have.

Examples:

* approving actions
* overriding sponsors
* making compliance decisions without review
* deciding prospect readiness
* declaring policy from weak context

## Detection Methods

Detection methods:

* automated output checks
* compliance scanners
* prompt-version comparisons
* model migration comparisons
* human review sampling
* feedback analysis
* recommendation outcome analysis
* escalation pattern monitoring
* GraphRAG provenance audits

## Drift Response

Drift response depends on severity.

Low drift:

* monitor
* create improvement proposal

Medium drift:

* review prompt
* add tests
* patch prompt after approval

High drift:

* quarantine affected prompt
* rollback if needed
* audit outputs

Critical drift:

* immediate rollback
* governance incident review
* remediation plan

---

# PAGE 30 - FUTURE PROMPT GOVERNANCE FRAMEWORK

## Future Prompt Governance Framework

Future prompt governance must support a larger ecosystem without losing control.

As more agents, workflows, recommendations, and memory systems are added, prompt governance becomes more important, not less.

## Future Capabilities

Future governance should support:

* prompt registry UI
* prompt diff viewer
* approval workflow
* prompt test runner
* drift dashboard
* prompt effectiveness dashboard
* model migration comparison tool
* GraphRAG context inspector
* prompt rollback button
* conditional approval expiration
* audit sampling queue
* reviewer comments
* prompt lineage graph
* prompt impact analysis

## Prompt Lineage Graph

Prompt lineage should show:

* source documents
* prompt versions
* agent usage
* workflow usage
* recommendations produced
* outcomes
* audits
* rollbacks
* migrations

The graph should make prompt influence visible.

## Future AI Governance

Future AI governance must prevent agents from becoming uncontrolled optimizers.

Agents may improve support.

Agents may not rewrite constitutional rules.

Agents may identify prompt weaknesses.

Agents may not deploy self-authored prompt changes without approval.

Agents may suggest new tests.

Agents may not remove tests because they are inconvenient.

## Prompt Marketplace Rule

If prompts are ever shared, templated, or reused across domains, they must retain:

* source requirements
* safety requirements
* governance metadata
* version lineage
* approved usage scope
* prohibited usage scope

Reusable prompts are still governed prompts.

## Future Governance Principle

The more capable the AI becomes, the more visible its governance must become.

Prompt governance should make the system more trustworthy, not slower for its own sake.

Governance should preserve speed by preventing rework, confusion, drift, and trust repair.

---

# PAGE 31 - SUCCESS CRITERIA

## Prompt Governance Succeeds When

Prompt governance succeeds when:

* every production prompt is registered
* every prompt has an owner
* every prompt has a version
* every prompt has tests
* every prompt has source documents
* every prompt has safety requirements
* every prompt has governance requirements
* every prompt invocation is observable
* every prompt change is auditable
* every prompt can be rolled back
* every agent stays inside its mission
* recommendations remain explainable
* GraphRAG context stays grounded
* prompt drift is detected early
* humans remain in charge

## Prompt Governance Fails When

Prompt governance fails when:

* prompts are edited directly in code without review
* agents use undocumented prompt variants
* prompt versions cannot be identified
* outputs cannot be traced to prompt versions
* recommendations cannot be explained
* compliance rules are embedded inconsistently
* model migration changes behavior silently
* GraphRAG context changes behavior without audit
* prompt improvements bypass approval
* rollback is impossible
* agents become more autonomous than approved

## Constitutional Closure

The Momentum Creation System V2 prompt layer exists to protect the system from invisible behavioral drift.

Prompts define how the AI speaks, reasons, retrieves, recommends, escalates, refuses, and learns.

Therefore prompts must be governed with the same seriousness as schemas, agents, recommendations, and memory.

Michael guides.

Ivory supports authentic invitation.

Daily Success Coach reinforces consistency.

Future agents extend support.

Prompt governance keeps all of them aligned.

The system should become more capable over time without becoming less trustworthy.

That is the purpose of AGENT_PROMPT_GOVERNANCE.md.
