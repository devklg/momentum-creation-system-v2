# AGENT_EVENT_MODEL.md

## Momentum Creation System V2

### Agent Event Model Runtime Specification

#### Version 1.0

---

## 1. Document Status

**Document Name:** Agent Event Model Runtime Specification
**System:** Momentum Creation System V2
**Layer:** Runtime Layer
**Version:** 1.0
**Schema Version:** `agent_event.v1`
**Status:** Ratified Runtime Specification
**Owner:** Momentum Creation System
**Primary Producers:** Browser Voice Runtime, Agent Runtime, Context Manager, Knowledge Ingestion, Knowledge Core, Journal Runtime, Learning Pipeline
**Primary Consumers:** Knowledge Ingestion Worker, Chroma Index Worker, Neo4j Graph Worker, Learning Pipeline Worker, Metrics Projection Worker, Audit Runtime
**Implementation Target:** Codex / Engineering Runtime Implementation
**Bilingual Requirement:** English and Spanish
**Internal Runtime Scope:** Steve Success, Michael Magnificent, Ivory, Browser Voice, Browser Text
**External Runtime Scope:** Ringless Voicemail, SMS, future callback workflows
**Telnyx Scope:** External runtime only. Telnyx is not part of internal Browser Voice, Steve, Michael, or Ivory runtime.

---

## 2. Purpose

The Agent Event Model defines the immutable runtime event system for Momentum Creation System V2.

It standardizes how runtime activity is recorded across:

- Browser Voice Runtime
- Browser Text Runtime
- Agent Runtime
- Context Manager
- Context Packet lifecycle
- Knowledge Ingestion
- Knowledge Core
- Momentum Journal
- Guided Actions
- Learning Pipeline
- Metrics projections
- Audit workflows
- Implementation tests
- System operations

The Agent Event Model answers this runtime question:

> What happened in Momentum, when did it happen, what caused it, and how can it be traced?

Events provide the runtime memory of activity.

Events do not replace the Knowledge Core.

Events do not replace the Context Packet.

Events do not approve knowledge.

Events do not activate knowledge.

Events do not send external communication.

Events record what happened so that Momentum can trace, replay, audit, learn, and improve.

---

## 3. Runtime Philosophy

Momentum is a learning organization.

Learning requires a reliable record of activity.

The Agent Event Model exists so Momentum can connect:

```text id="go2f5h"
Session
  ↓
Context Packet
  ↓
Agent Turn
  ↓
Guided Action
  ↓
Outcome
  ↓
Learning Signal
  ↓
Knowledge Evolution
```

Events make runtime behavior observable.

Events make learning traceable.

Events make audit possible.

Events allow Momentum to reconstruct what happened without allowing replay to repeat unsafe side effects.

The event system is not a command system.

An event records something that happened.

A command asks the system to do something.

This distinction is mandatory.

---

## 4. Foundational Principle

The Agent Event Model must enforce this principle:

```text id="gx4f53"
Events are immutable records of completed runtime facts.

Events do not directly perform actions.
```

An event may trigger downstream workers.

An event may be consumed by Knowledge Ingestion.

An event may support Learning Pipeline evaluation.

An event may update metrics projections.

An event may support audit and replay.

An event must not itself auto-send outreach, approve knowledge, activate knowledge, rerun Browser Voice, or duplicate side effects.

---

## 5. Runtime Position

The Agent Event Model spans the Runtime Layer.

```text id="z50tsq"
Browser Voice / Browser Text
  ↓ emits events
Agent Runtime
  ↓ emits events
Context Manager
  ↓ emits events
Knowledge Ingestion
  ↓ emits events
Knowledge Core
  ↓ emits events
Learning Pipeline
  ↓ emits events
Metrics / Audit / Replay
```

Events connect runtime components without allowing them to violate ownership boundaries.

Every runtime component may publish events through the Runtime Event Service.

Runtime components must not write arbitrary event records directly to storage.

---

## 6. Scope

This document defines the Version 1.0 runtime specification for agent and runtime events.

It defines:

- Event envelope
- Event source taxonomy
- Event type taxonomy
- Storage requirements
- MongoDB indexes
- Idempotency rules
- Payload requirements
- Privacy rules
- Outbox requirements
- Subscriber requirements
- Replay rules
- Event service interface
- Event lifecycle
- Event validation
- Runtime flows
- Error handling
- Observability
- Acceptance criteria
- Testing requirements
- Relationship to runtime components

This document does not define external communication execution.

SMS, ringless voicemail, and callback workflows belong to external runtime specifications.

This document does not define Context Packet structure.

That is defined in `CONTEXT_PACKET_SCHEMA.md`.

This document does not define Agent Runtime behavior.

That is defined in `AGENT_RUNTIME.md`.

This document does not define Knowledge Core storage.

That is defined in `KNOWLEDGE_CORE_RUNTIME.md`.

---

## 7. Event Schema Version

The required event schema version is:

```text id="47o4k5"
agent_event.v1
```

Every runtime event must include:

```ts id="gv8xca"
schemaVersion: "agent_event.v1";
```

No other event schema version is valid for Runtime Layer Version 1.0.

Future event schema versions must be introduced through a ratified runtime upgrade.

---

## 8. Event Envelope

All runtime events must use the standard event envelope.

```ts id="j9tuuw"
export interface AgentEventEnvelope<TPayload = Record<string, unknown>> {
  eventId: string;

  eventType: AgentEventType;

  schemaVersion: "agent_event.v1";

  tenantId: string;

  teamId?: string;
  teamKey?: "team_magnificent";
  teamName?: "Team Magnificent";

  baId?: string;

  agentKey?: "steve_success" | "michael_magnificent" | "ivory";

  sessionId?: string;

  correlationId: string;

  causationId?: string;

  idempotencyKey: string;

  source: AgentEventSource;

  payload: TPayload;

  occurredAt: string;

  recordedAt: string;

  metadata?: Record<string, unknown>;
}
```

---

## 9. Envelope Field Requirements

### 9.1 eventId

`eventId` is the immutable unique event identifier.

Requirements:

- Must be globally unique.
- Must never be reused.
- Must be generated before persistence.
- Must be indexed uniquely.

Recommended format:

```text id="e3jhk0"
evt_<ulid>
```

### 9.2 eventType

`eventType` identifies what happened.

Requirements:

- Must belong to the `AgentEventType` taxonomy.
- Must be specific enough for downstream consumers.
- Must use dot-separated namespace format.
- Must describe a completed fact.

Examples:

```text id="vby421"
agent.session.created
context.packet.created
knowledge.candidate.created
journal.entry.created
learning.signal.created
```

### 9.3 schemaVersion

`schemaVersion` must equal:

```text id="y7ndm0"
agent_event.v1
```

### 9.4 tenantId

`tenantId` identifies the Momentum tenant.

Requirements:

- Must be present for every event.
- Must be indexed.
- Must be used for isolation and query filtering.

### 9.5 baId

`baId` identifies the Brand Ambassador when the event relates to a Brand Ambassador.

Required for:

- Agent session events
- Browser voice events
- Browser text events
- Journal events
- Guided action events
- Relationship context events
- Learning outcome events tied to a BA

Optional for:

- System events
- Implementation test events
- Global knowledge events
- Administrative events

### 9.6 agentKey

`agentKey` identifies the agent when the event relates to Steve, Michael, or Ivory.

Valid values:

```ts id="ahx7eu"
export type AgentKey = "steve_success" | "michael_magnificent" | "ivory";
```

### 9.7 sessionId

`sessionId` identifies the runtime session when applicable.

Required for:

- Agent session events
- Agent turn events
- Browser Voice events
- Browser Text events
- Context Packet events tied to a session
- Invitation draft events
- Guided action events created during a session

### 9.8 correlationId

`correlationId` links related events across a workflow.

Requirements:

- Must be present for every event.
- Must remain consistent across a related runtime flow.
- Must allow reconstruction of a session or workflow timeline.

Example:

```text id="b3qraf"
correlationId = corr_session_abc123
```

### 9.9 causationId

`causationId` references the event that caused this event.

Requirements:

- Optional for root events.
- Required when an event is clearly caused by another event.
- Must reference a valid prior event ID when available.

Example:

```text id="u38spy"
agent.turn.received causes knowledge.capture.created
```

### 9.10 idempotencyKey

`idempotencyKey` prevents duplicate event persistence.

Requirements:

- Must be present for every event.
- Must be unique.
- Must be deterministic where possible.
- Must be indexed uniquely.
- Must be checked before inserting an event.

### 9.11 source

`source` identifies the runtime component that emitted the event.

### 9.12 payload

`payload` contains event-specific data.

Payloads must be minimal, scoped, and privacy-safe.

Payloads must reference large or sensitive records by ID rather than embedding unnecessary private text.

### 9.13 occurredAt

`occurredAt` is when the runtime fact happened.

### 9.14 recordedAt

`recordedAt` is when the event was persisted.

`recordedAt` may be later than `occurredAt`.

### 9.15 metadata

`metadata` may contain non-sensitive operational details.

Metadata must not contain unnecessary private transcript text, secrets, tokens, credentials, or large payloads.

---

## 10. Event Sources

```ts id="m0ehja"
export type AgentEventSource =
  | "browser_voice_runtime"
  | "browser_text_runtime"
  | "agent_runtime"
  | "context_manager"
  | "knowledge_core"
  | "knowledge_ingestion"
  | "learning_pipeline"
  | "journal_runtime"
  | "guided_action_runtime"
  | "external_runtime"
  | "implementation_test"
  | "system";
```

### 10.1 Source Rules

Each runtime component must emit events using its own source identity.

Internal Browser Voice must use:

```text id="q4r8b5"
browser_voice_runtime
```

Internal Browser Text must use:

```text id="g1m2zr"
browser_text_runtime
```

External SMS, ringless voicemail, and callback workflows must use:

```text id="ycbdzu"
external_runtime
```

Telnyx-based external events must not be mislabeled as internal Browser Voice events.

---

## 11. Event Storage

All runtime events must be stored in MongoDB.

Required collection:

```text id="k6r4sf"
runtime_events
```

### 11.1 Required Indexes

The implementation must create these indexes:

```ts id="w374xc"
{ eventId: 1 }, unique
{ idempotencyKey: 1 }, unique
{ tenantId: 1, occurredAt: -1 }
{ tenantId: 1, baId: 1, occurredAt: -1 }
{ sessionId: 1, occurredAt: 1 }
{ eventType: 1, occurredAt: -1 }
{ correlationId: 1, occurredAt: 1 }
{ causationId: 1, occurredAt: 1 }
{ source: 1, occurredAt: -1 }
{ agentKey: 1, occurredAt: -1 }
```

### 11.2 Storage Requirements

Event storage must:

- Persist immutable event records.
- Enforce unique `eventId`.
- Enforce unique `idempotencyKey`.
- Preserve event order by `occurredAt`.
- Preserve recording order by `recordedAt`.
- Support lookup by session ID.
- Support lookup by correlation ID.
- Support lookup by Brand Ambassador.
- Support replay queries.
- Support audit queries.
- Support metrics projection.

### 11.3 Immutability Rule

Events must not be updated after creation except for system-level metadata required for operational repair.

The preferred model is append-only.

If an event requires correction, emit a correcting event.

Do not mutate the original event payload.

---

## 12. Event Taxonomy Overview

Version 1.0 includes these event categories:

```text id="wms58o"
Browser Voice Events
Browser Text Events
Agent Runtime Events
Context Manager Events
Knowledge Ingestion Events
Knowledge Core Events
Journal Events
Guided Action Events
Learning Events
External Runtime Events
System Events
```

---

## 13. Browser Voice Events

Browser Voice is internal.

Browser Voice does not use Telnyx.

### 13.1 Browser Voice Event Types

```text id="yp4wga"
browser_voice.capability_checked
browser_voice.permission_requested
browser_voice.permission_granted
browser_voice.permission_denied
browser_voice.listening_started
browser_voice.interim_transcript
browser_voice.final_transcript
browser_voice.transcript_corrected
browser_voice.language_changed
browser_voice.speech_started
browser_voice.speech_completed
browser_voice.fallback_to_text
browser_voice.error
```

### 13.2 Browser Voice Rules

Browser Voice events must:

- Preserve session ID.
- Preserve BA ID.
- Preserve language.
- Preserve transcript references when applicable.
- Avoid unnecessary raw transcript text in broad events.
- Use turn IDs or transcript segment IDs when possible.
- Never imply Telnyx internal coaching.

### 13.3 Browser Voice Payloads

```ts id="hx3r4v"
export interface BrowserVoiceFinalTranscriptPayload {
  sessionId: string;
  turnId: string;
  transcriptId?: string;
  language: "en" | "es";
  transcriptHash: string;
  confidence?: number;
  segmentSequence?: number;
  isFinal: true;
}
```

```ts id="npgnld"
export interface BrowserVoiceFallbackToTextPayload {
  sessionId: string;
  reason:
    | "permission_denied"
    | "browser_not_supported"
    | "speech_error"
    | "user_selected_text"
    | "unknown";
}
```

---

## 14. Browser Text Events

Browser Text is internal.

### 14.1 Browser Text Event Types

```text id="k5q0vl"
browser_text.session.started
browser_text.message.created
browser_text.message.submitted
browser_text.message.corrected
browser_text.fallback_from_voice
browser_text.error
```

### 14.2 Browser Text Payload

```ts id="4qm4ao"
export interface BrowserTextMessageCreatedPayload {
  sessionId: string;
  turnId: string;
  language: "en" | "es";
  messageHash: string;
  sequence: number;
}
```

Browser Text events should reference stored conversation turns rather than embedding unnecessary private message text.

---

## 15. Agent Runtime Events

### 15.1 Agent Runtime Event Types

```text id="tyrhgj"
agent.session.created
agent.session.started
agent.session.paused
agent.session.resumed
agent.session.completed
agent.session.failed
agent.session.cancelled
agent.context.requested
agent.context.received
agent.turn.received
agent.turn.responded
agent.state.advanced
agent.guided_action.created
agent.journal_entry.created
agent.knowledge_candidate.proposed
agent.relationship_context.created
agent.invitation_draft.created
agent.invitation_link.requested
agent.invitation_link.created
agent.output_guardrail.blocked
```

### 15.2 Agent Session Created Payload

```ts id="mlja43"
export interface AgentSessionCreatedPayload {
  sessionId: string;
  agentKey: "steve_success" | "michael_magnificent" | "ivory";
  language: "en" | "es";
  mode: "browser_voice" | "browser_text" | "mixed";
  taskType:
    | "success_interview"
    | "training_support"
    | "journal_teaching"
    | "relationship_coaching"
    | "invitation_drafting"
    | "session_resume"
    | "guided_action_review";
}
```

### 15.3 Agent Turn Received Payload

```ts id="05a2zr"
export interface AgentTurnReceivedPayload {
  sessionId: string;
  turnId: string;
  agentKey: "steve_success" | "michael_magnificent" | "ivory";
  language: "en" | "es";
  mode: "browser_voice" | "browser_text" | "mixed";
  turnSequence: number;
  stateKey: string;
}
```

### 15.4 Agent Turn Responded Payload

```ts id="nmioo2"
export interface AgentTurnRespondedPayload {
  sessionId: string;
  responseId: string;
  agentKey: "steve_success" | "michael_magnificent" | "ivory";
  language: "en" | "es";
  stateKey: string;
  outputMode: "text" | "voice_text";
  contextPacketId: string;
  suggestedActionIds?: string[];
}
```

### 15.5 Agent State Advanced Payload

```ts id="z0l0p9"
export interface AgentStateAdvancedPayload {
  sessionId: string;
  agentKey: "steve_success" | "michael_magnificent" | "ivory";
  fromStateKey: string;
  toStateKey: string;
  reason:
    | "field_captured"
    | "template_transition"
    | "ba_request"
    | "clarification_needed"
    | "session_close"
    | "error_recovery";
}
```

### 15.6 Agent Output Guardrail Blocked Payload

```ts id="qoi1f9"
export interface AgentOutputGuardrailBlockedPayload {
  sessionId: string;
  agentKey: "steve_success" | "michael_magnificent" | "ivory";
  responseId?: string;
  violationTypes: string[];
  severity: "low" | "medium" | "high" | "critical";
  safeReplacementUsed: boolean;
}
```

---

## 16. Context Manager Events

### 16.1 Context Manager Event Types

```text id="96i2u3"
context.requested
context.validation.completed
context.retrieval.started
context.retrieval.completed
context.packet.created
context.packet.delivered
context.packet.degraded
context.packet.failed
context.private_journal.included
context.relationship_context.included
context.candidate.excluded
context.language.fallback_used
context.audit.recorded
```

### 16.2 Context Packet Created Payload

```ts id="u3l6df"
export interface ContextPacketCreatedPayload {
  packetId: string;
  requestId: string;
  sessionId: string;
  agentKey: "steve_success" | "michael_magnificent" | "ivory";
  includedKnowledgeIds: string[];
  includedPrivateContextIds: string[];
  includedJournalEntryIds?: string[];
  includedRelationshipContextIds?: string[];
  tokenEstimate: number;
  isDegraded: boolean;
  language: "en" | "es";
}
```

### 16.3 Context Candidate Excluded Payload

```ts id="4dztuy"
export interface ContextCandidateExcludedPayload {
  packetId: string;
  requestId: string;
  sessionId: string;
  candidateIds?: string[];
  reason:
    | "candidate_not_approved"
    | "not_review_workflow"
    | "permission_denied"
    | "context_budget_exceeded";
}
```

### 16.4 Context Language Fallback Payload

```ts id="u3hyeg"
export interface ContextLanguageFallbackUsedPayload {
  packetId: string;
  requestId: string;
  requestedLanguage: "en" | "es";
  fallbackLanguage: "en" | "es";
  fallbackReason:
    | "same_language_unavailable"
    | "template_unavailable"
    | "translation_unavailable"
    | "machine_translation_marked";
}
```

---

## 17. Knowledge Ingestion Events

### 17.1 Knowledge Ingestion Event Types

```text id="1geicj"
knowledge.capture.created
knowledge.capture.normalized
knowledge.capture.classified
knowledge.capture.segmented
knowledge.capture.risk_checked
knowledge.capture.deduped
knowledge.candidate.created
knowledge.candidate.queued_for_review
knowledge.candidate.indexed_for_review
knowledge.graph.linked
knowledge.ingestion.failed
knowledge.ingestion.idempotent_replay
```

### 17.2 Knowledge Candidate Created Payload

```ts id="a7ujxz"
export interface KnowledgeCandidateCreatedPayload {
  candidateId: string;
  domain:
    | "success"
    | "training"
    | "relationship"
    | "performance"
    | "organizational"
    | "system"
    | "governance";
  sourceType: string;
  sourceId: string;
  riskFlags: string[];
  status: "candidate";
  language: "en" | "es";
}
```

### 17.3 Knowledge Capture Created Payload

```ts id="kfgxcd"
export interface KnowledgeCaptureCreatedPayload {
  captureId: string;
  sourceType:
    | "agent_session"
    | "journal_entry"
    | "knowledge_session"
    | "outcome"
    | "guided_action"
    | "manual_import"
    | "browser_voice_session"
    | "browser_text_session"
    | "pmv_activity"
    | "sms_activity"
    | "ringless_voicemail_activity"
    | "callback_workflow_activity";
  sourceId: string;
  language: "en" | "es";
  visibility:
    | "private_to_ba"
    | "session_scoped"
    | "relationship_scoped"
    | "review_only"
    | "admin_scoped"
    | "governance_scoped"
    | "organizational";
}
```

### 17.4 Knowledge Ingestion Failed Payload

```ts id="m4ftmh"
export interface KnowledgeIngestionFailedPayload {
  captureId?: string;
  candidateId?: string;
  stage:
    | "capture"
    | "normalize"
    | "classify"
    | "segment"
    | "risk_check"
    | "dedupe"
    | "candidate_create"
    | "review_index"
    | "graph_link"
    | "queue_for_review";
  errorType: string;
  retryable: boolean;
}
```

---

## 18. Knowledge Core Events

Knowledge Core events record canonical knowledge lifecycle activity.

### 18.1 Knowledge Core Event Types

```text id="rmlgh3"
knowledge.object.created
knowledge.object.updated
knowledge.object.lifecycle_changed
knowledge.object.approved
knowledge.object.activated
knowledge.object.rejected
knowledge.object.superseded
knowledge.object.archived
knowledge.source.created
knowledge.embedding.completed
knowledge.graph_sync.completed
knowledge.retrieval.completed
knowledge.quality_flag.created
knowledge.review_requested
knowledge.promotion_request.created
knowledge.learning_signal.recorded
knowledge.translation_variant.created
```

### 18.2 Knowledge Object Activated Payload

```ts id="nvdq4h"
export interface KnowledgeObjectActivatedPayload {
  knowledgeObjectId: string;
  version: number;
  domain: string[];
  language: "en" | "es";
  activatedAt: string;
  approvedBy?: string;
}
```

### 18.3 Knowledge Retrieval Completed Payload

```ts id="zjqquj"
export interface KnowledgeRetrievalCompletedPayload {
  retrievalRequestId: string;
  resultCount: number;
  omittedCount: number;
  language: "en" | "es";
  graphRagUsed: boolean;
}
```

---

## 19. Journal Events

Journal events record private Momentum Journal activity.

Momentum Journal is private by default.

### 19.1 Journal Event Types

```text id="pgdjr8"
journal.entry.created
journal.entry.updated
journal.entry.archived
journal.entry.selected_for_review
journal.entry.promoted_to_candidate
journal.prompt.shown
journal.prompt.accepted
journal.prompt.dismissed
```

### 19.2 Journal Entry Created Payload

```ts id="p03yte"
export interface JournalEntryCreatedPayload {
  journalEntryId: string;
  baId: string;
  sessionId?: string;
  language: "en" | "es";
  visibility: "private_to_ba";
  source:
    | "steve_success"
    | "michael_magnificent"
    | "ivory"
    | "brand_ambassador"
    | "system";
}
```

### 19.3 Journal Entry Selected for Review Payload

```ts id="7q3s98"
export interface JournalEntrySelectedForReviewPayload {
  journalEntryId: string;
  baId: string;
  promotionRequestId: string;
  consentConfirmed: true;
}
```

### 19.4 Journal Privacy Payload Rule

Journal events must not include unnecessary private journal text.

Journal text must be stored in journal records.

Events should reference:

- `journalEntryId`
- `baId`
- `sessionId`
- `promotionRequestId`
- `candidateId`

---

## 20. Guided Action Events

Guided Action events record BA-owned action lifecycle activity.

### 20.1 Guided Action Event Types

```text id="zocuiw"
guided_action.created
guided_action.suggested
guided_action.accepted
guided_action.dismissed
guided_action.completed
guided_action.missed
guided_action.cancelled
guided_action.outcome_recorded
```

### 20.2 Guided Action Created Payload

```ts id="oy1tyb"
export interface GuidedActionCreatedPayload {
  guidedActionId: string;
  baId: string;
  sessionId?: string;
  agentKey?: "steve_success" | "michael_magnificent" | "ivory";
  actionType:
    | "write_journal_entry"
    | "schedule_follow_up"
    | "review_training"
    | "draft_invitation"
    | "choose_next_prospect"
    | "capture_lesson"
    | "submit_candidate_for_review";
  owner: "ba";
  urgency: "low" | "normal" | "high";
}
```

### 20.3 Guided Action Rule

Guided Action events must preserve that the Brand Ambassador owns the action.

No event may imply the agent completed the BA's relationship action unless the BA explicitly marked it completed.

---

## 21. Learning Events

### 21.1 Learning Event Types

```text id="ik5br6"
learning.outcome.created
learning.signal.created
learning.signal.triaged
learning.pattern.detected
learning.candidate.proposed
learning.candidate.linked_to_outcome
learning.knowledge.validated
learning.knowledge.weakened
learning.knowledge.refined
learning.knowledge.superseded
learning.metrics.updated
```

### 21.2 Outcome Created Payload

```ts id="yjh1rg"
export interface LearningOutcomeCreatedPayload {
  outcomeId: string;
  baId?: string;
  sessionId?: string;
  guidedActionId?: string;
  agentKey?: "steve_success" | "michael_magnificent" | "ivory";
  outcomeType:
    | "action_completed"
    | "action_missed"
    | "prospect_responded"
    | "presentation_viewed"
    | "follow_up_completed"
    | "training_completed"
    | "conversion"
    | "retention_signal"
    | "feedback_received";
  language: "en" | "es";
}
```

### 21.3 Learning Signal Created Payload

```ts id="0i78e7"
export interface LearningSignalCreatedPayload {
  learningSignalId: string;
  outcomeId?: string;
  knowledgeObjectId?: string;
  candidateId?: string;
  signalType:
    | "positive_outcome"
    | "negative_outcome"
    | "knowledge_gap"
    | "repeated_question"
    | "training_gap"
    | "relationship_pattern"
    | "candidate_opportunity"
    | "quality_issue";
  strength: "low" | "medium" | "high";
}
```

---

## 22. External Runtime Events

External runtime includes:

- Ringless voicemail
- SMS
- Future callback workflows

External runtime may use Telnyx.

External runtime is separate from internal Browser Voice.

### 22.1 External Runtime Event Types

```text id="ejcmlc"
external.sms.queued
external.sms.sent
external.sms.delivered
external.sms.failed
external.sms.response_received
external.ringless_voicemail.queued
external.ringless_voicemail.sent
external.ringless_voicemail.failed
external.callback.requested
external.callback.scheduled
external.callback.completed
external.callback.failed
```

### 22.2 External Event Rules

External events must:

- Use source `external_runtime`.
- Preserve BA scope.
- Preserve prospect or relationship scope when applicable.
- Avoid unnecessary private message text.
- Preserve provider metadata safely.
- Never be confused with internal Browser Voice events.

### 22.3 External SMS Response Payload

```ts id="zhvc1r"
export interface ExternalSmsResponseReceivedPayload {
  externalMessageId: string;
  baId: string;
  prospectId?: string;
  relationshipContextId?: string;
  provider: "telnyx" | "other";
  messageHash: string;
  receivedAt: string;
}
```

---

## 23. System Events

System events support runtime operations.

### 23.1 System Event Types

```text id="f51fat"
system.health.checked
system.worker.started
system.worker.stopped
system.worker.failed
system.outbox.retry_scheduled
system.outbox.item_completed
system.replay.started
system.replay.completed
system.replay.failed
system.metrics.projection_updated
```

System events must not include unnecessary private payload content.

---

## 24. Complete Event Type Union

```ts id="mcc5ww"
export type AgentEventType =
  | BrowserVoiceEventType
  | BrowserTextEventType
  | AgentRuntimeEventType
  | ContextManagerEventType
  | KnowledgeIngestionEventType
  | KnowledgeCoreEventType
  | JournalEventType
  | GuidedActionEventType
  | LearningEventType
  | ExternalRuntimeEventType
  | SystemEventType;
```

Each category must export its own event type union.

---

## 25. Idempotency

The Runtime Event Service must enforce idempotency.

### 25.1 Idempotency Key Requirements

Every event must have an idempotency key.

The idempotency key must be deterministic where possible.

The service must return the existing event when the same idempotency key is emitted again.

The service must not create duplicate events.

### 25.2 Required Idempotency Keys

| Event                       | Idempotency Key                                                 |
| --------------------------- | --------------------------------------------------------------- |
| Session created             | `agent.session.created:${sessionId}`                            |
| Session started             | `agent.session.started:${sessionId}`                            |
| Turn received               | `agent.turn.received:${sessionId}:${turnSequence}`              |
| Turn responded              | `agent.turn.responded:${sessionId}:${turnSequence}`             |
| Final transcript            | `browser_voice.final_transcript:${sessionId}:${transcriptHash}` |
| Browser text message        | `browser_text.message.created:${sessionId}:${messageHash}`      |
| Context packet created      | `context.packet.created:${packetId}`                            |
| Context packet delivered    | `context.packet.delivered:${packetId}`                          |
| Journal entry created       | `journal.entry.created:${journalEntryId}`                       |
| Journal selected for review | `journal.entry.selected_for_review:${journalEntryId}:${baId}`   |
| Candidate created           | `knowledge.candidate.created:${candidateId}`                    |
| Guided action created       | `guided_action.created:${guidedActionId}`                       |
| Invitation draft created    | `agent.invitation_draft.created:${draftId}`                     |
| Outcome created             | `learning.outcome.created:${outcomeId}`                         |
| Learning signal created     | `learning.signal.created:${learningSignalId}`                   |

### 25.3 Idempotency Failure Rule

If an idempotency conflict occurs with different payload content, the event service must:

- Reject the duplicate write.
- Return a typed idempotency conflict error.
- Emit or log an operational warning.
- Preserve the original event.

---

## 26. Privacy and Payload Minimization

Events must avoid unnecessary private text.

### 26.1 Transcript Rule

Do not put unnecessary private transcript text in broad events.

Store transcripts in conversation turn records.

Events should reference:

- `turnId`
- `transcriptId`
- `messageHash`
- `transcriptHash`
- `sessionId`

### 26.2 Journal Rule

Do not put private journal body text in events.

Store journal text in journal records.

Events should reference:

- `journalEntryId`
- `promotionRequestId`
- `candidateId`

### 26.3 Relationship Rule

Do not put sensitive prospect details in broad events unless required and scoped.

Events should reference:

- `relationshipContextId`
- `prospectId`
- `draftId`
- `guidedActionId`

### 26.4 External Communication Rule

Do not place full SMS content, voicemail text, or callback transcript in broad events unless an approved external runtime workflow explicitly requires it.

Use hashes and references where possible.

### 26.5 Secret Rule

Events must never contain:

- API keys
- Access tokens
- Refresh tokens
- Database credentials
- Provider secrets
- Private authentication material

---

## 27. Event Service

The Runtime Event Service is the only approved service for emitting runtime events.

```ts id="gj2uxx"
export interface RuntimeEventService {
  emit<TPayload>(
    event: CreateRuntimeEventInput<TPayload>
  ): Promise<AgentEventEnvelope<TPayload>>;

  emitMany(events: CreateRuntimeEventInput[]): Promise<AgentEventEnvelope[]>;

  findByCorrelationId(correlationId: string): Promise<AgentEventEnvelope[]>;

  findBySessionId(sessionId: string): Promise<AgentEventEnvelope[]>;

  findByEventId(eventId: string): Promise<AgentEventEnvelope | null>;

  findByIdempotencyKey(
    idempotencyKey: string
  ): Promise<AgentEventEnvelope | null>;
}
```

### 27.1 Create Runtime Event Input

```ts id="udn4h6"
export interface CreateRuntimeEventInput<TPayload = Record<string, unknown>> {
  eventType: AgentEventType;

  tenantId: string;

  teamId?: string;
  teamKey?: "team_magnificent";
  teamName?: "Team Magnificent";

  baId?: string;

  agentKey?: "steve_success" | "michael_magnificent" | "ivory";

  sessionId?: string;

  correlationId?: string;

  causationId?: string;

  idempotencyKey: string;

  source: AgentEventSource;

  payload: TPayload;

  occurredAt?: string;

  metadata?: Record<string, unknown>;
}
```

### 27.2 Emit Requirements

The `emit` method must:

- Validate event type.
- Validate source.
- Validate schema version.
- Validate idempotency key.
- Generate event ID.
- Generate correlation ID when omitted and safe.
- Set occurredAt when omitted.
- Set recordedAt.
- Persist event.
- Add event to outbox when subscribers exist.
- Return persisted envelope.

### 27.3 EmitMany Requirements

The `emitMany` method must:

- Validate each event.
- Preserve input order where possible.
- Enforce idempotency for each event.
- Prefer transactional write where supported.
- Return persisted envelopes.

---

## 28. Event Outbox

The Runtime Event Outbox supports asynchronous workers.

Required collection:

```text id="71lssa"
runtime_event_outbox
```

### 28.1 Outbox Item

```ts id="f819hr"
export interface RuntimeEventOutboxItem {
  outboxId: string;

  eventId: string;

  eventType: string;

  status: "pending" | "processing" | "completed" | "failed";

  attempts: number;

  nextAttemptAt?: Date;

  lastError?: string;

  createdAt: Date;

  updatedAt: Date;
}
```

### 28.2 Outbox Indexes

```ts id="1gx7p8"
{ outboxId: 1 }, unique
{ eventId: 1 }, unique
{ status: 1, nextAttemptAt: 1 }
{ eventType: 1, status: 1 }
{ createdAt: 1 }
```

### 28.3 Outbox Requirements

The outbox must:

- Create an outbox item for events requiring asynchronous processing.
- Support retry.
- Track attempts.
- Track last error.
- Mark completed after all required subscribers process the event.
- Avoid duplicate processing through idempotent subscribers.
- Support dead-letter or failed status after retry exhaustion.

---

## 29. Subscribers

### 29.1 Required Subscribers

Version 1.0 requires these subscribers:

```text id="gaaxuw"
knowledge_ingestion_worker
chroma_index_worker
neo4j_graph_worker
learning_pipeline_worker
metrics_projection_worker
audit_projection_worker
```

### 29.2 Subscriber Responsibilities

#### knowledge_ingestion_worker

Consumes:

- Agent turn events
- Browser transcript events
- Journal selection events
- Outcome events
- External communication events

Produces:

- Knowledge capture events
- Knowledge candidate events

#### chroma_index_worker

Consumes:

- Candidate indexed-for-review events
- Knowledge approved/indexed events
- Knowledge object activated events

Produces:

- Embedding completed events
- Index failure events

#### neo4j_graph_worker

Consumes:

- Knowledge graph link events
- Candidate created events
- Knowledge object events
- Relationship context events

Produces:

- Graph sync completed events
- Graph link failure events

#### learning_pipeline_worker

Consumes:

- Guided action outcome events
- Agent session completed events
- Context packet records
- Knowledge retrieval records

Produces:

- Learning signal events
- Pattern detected events
- Candidate proposed events

#### metrics_projection_worker

Consumes:

- Runtime events across categories

Produces:

- Metrics projection updates

#### audit_projection_worker

Consumes:

- Runtime events across categories

Produces:

- Audit summaries
- Session timelines
- Correlation timelines

### 29.3 Subscriber Safety Rules

Subscribers must be idempotent.

Subscribers must not:

- Send external communications during replay.
- Create duplicate candidates.
- Change review decisions during replay.
- Rerun Browser Voice actions.
- Approve knowledge without governance.
- Activate knowledge without Knowledge Core lifecycle.

---

## 30. Replay Rules

Replay reconstructs runtime history from events.

Replay is for rebuilding projections, timelines, metrics, audit summaries, and lineage.

Replay must not repeat unsafe side effects.

### 30.1 Replay May Rebuild

Replay may rebuild:

- Session timelines
- Agent turn timelines
- Context audit summaries
- Knowledge candidate lineage
- Journal promotion timelines
- Guided action timelines
- Learning metrics
- Relationship activity projections
- Event correlation graphs
- Metrics projections

### 30.2 Replay Must Not

Replay must not:

- Send external SMS.
- Send ringless voicemail.
- Execute callback workflows.
- Create duplicate candidates.
- Change review decisions.
- Rerun browser voice actions.
- Request microphone permissions.
- Generate new Context Packets unless explicitly running a projection repair workflow.
- Approve knowledge.
- Activate knowledge.
- Mutate original events.

### 30.3 Replay Service

```ts id="iek54x"
export interface RuntimeEventReplayService {
  replayByCorrelationId(
    correlationId: string,
    options: ReplayOptions
  ): Promise<ReplayResult>;

  replayBySessionId(
    sessionId: string,
    options: ReplayOptions
  ): Promise<ReplayResult>;

  replayByTimeRange(
    tenantId: string,
    startAt: string,
    endAt: string,
    options: ReplayOptions
  ): Promise<ReplayResult>;
}
```

```ts id="7m4mx3"
export interface ReplayOptions {
  mode:
    | "audit_only"
    | "metrics_projection"
    | "lineage_projection"
    | "session_timeline";

  dryRun: boolean;

  allowSideEffects: false;
}
```

```ts id="v87z4v"
export interface ReplayResult {
  replayId: string;
  eventsRead: number;
  projectionsUpdated: number;
  skippedEvents: number;
  errors: RuntimeReplayError[];
  completedAt: string;
}
```

Replay `allowSideEffects` must be `false` in Version 1.0.

---

## 31. Event Lifecycle

The standard event lifecycle is:

```text id="wtciv5"
Runtime fact occurs
  ↓
Runtime component calls RuntimeEventService.emit
  ↓
Event is validated
  ↓
Idempotency key is checked
  ↓
Event envelope is created
  ↓
Event is stored in runtime_events
  ↓
Outbox item is created if needed
  ↓
Subscribers process event
  ↓
Outbox item is completed or retried
  ↓
Metrics and audit projections update
```

---

## 32. Runtime Event Flow Examples

### 32.1 Agent Session Flow

```text id="ctfq6u"
agent.session.created
  ↓
agent.context.requested
  ↓
context.requested
  ↓
context.packet.created
  ↓
context.packet.delivered
  ↓
agent.context.received
  ↓
agent.session.started
```

### 32.2 Browser Voice Turn Flow

```text id="kbls5s"
browser_voice.listening_started
  ↓
browser_voice.speech_started
  ↓
browser_voice.interim_transcript
  ↓
browser_voice.final_transcript
  ↓
agent.turn.received
  ↓
knowledge.capture.created
  ↓
agent.turn.responded
```

### 32.3 Journal Flow

```text id="q1uwyn"
journal.prompt.shown
  ↓
journal.prompt.accepted
  ↓
journal.entry.created
  ↓
knowledge.capture.created
  ↓
journal.entry.selected_for_review
  ↓
journal.entry.promoted_to_candidate
  ↓
knowledge.candidate.created
```

### 32.4 Candidate Flow

```text id="fp22vl"
agent.knowledge_candidate.proposed
  ↓
knowledge.capture.created
  ↓
knowledge.capture.risk_checked
  ↓
knowledge.capture.deduped
  ↓
knowledge.candidate.created
  ↓
knowledge.candidate.queued_for_review
  ↓
knowledge.candidate.indexed_for_review
  ↓
knowledge.graph.linked
```

### 32.5 Learning Flow

```text id="09br6g"
guided_action.completed
  ↓
learning.outcome.created
  ↓
learning.signal.created
  ↓
learning.signal.triaged
  ↓
learning.candidate.proposed
```

---

## 33. Validation Rules

The Runtime Event Service must validate every event before persistence.

### 33.1 Required Validation

Every event must validate:

- Event type exists.
- Source exists.
- Schema version is `agent_event.v1`.
- Tenant ID exists.
- Correlation ID exists or is generated.
- Idempotency key exists.
- Payload matches event type requirements when schema is defined.
- occurredAt is valid.
- recordedAt is valid.
- No forbidden private fields are present.
- Source is allowed to emit event type.

### 33.2 Source-to-Event Validation

Examples:

- `browser_voice_runtime` may emit `browser_voice.*`.
- `browser_text_runtime` may emit `browser_text.*`.
- `agent_runtime` may emit `agent.*`.
- `context_manager` may emit `context.*`.
- `knowledge_ingestion` may emit ingestion candidate and capture events.
- `knowledge_core` may emit knowledge object lifecycle events.
- `learning_pipeline` may emit `learning.*`.
- `journal_runtime` may emit `journal.*`.
- `external_runtime` may emit `external.*`.
- `system` may emit `system.*`.

A source may not emit unrelated event types unless explicitly allowed by implementation policy.

---

## 34. Error Handling

### 34.1 Event Error Types

```ts id="kwmjgl"
export type RuntimeEventErrorType =
  | "invalid_event_type"
  | "invalid_event_source"
  | "invalid_schema_version"
  | "missing_tenant_id"
  | "missing_idempotency_key"
  | "idempotency_conflict"
  | "payload_validation_failed"
  | "privacy_violation"
  | "storage_failed"
  | "outbox_write_failed"
  | "subscriber_failed"
  | "replay_failed";
```

### 34.2 Event Error Model

```ts id="gvyxkm"
export interface RuntimeEventError {
  errorId: string;
  errorType: RuntimeEventErrorType;
  eventType?: string;
  idempotencyKey?: string;
  message: string;
  safeMessage: string;
  retryable: boolean;
  occurredAt: string;
  metadata?: Record<string, unknown>;
}
```

### 34.3 Error Behavior

If event persistence fails:

- Return typed error.
- Do not claim event was emitted.
- Preserve safe logs.
- Retry only when safe.

If outbox write fails after event storage:

- Mark event as stored.
- Record outbox failure.
- Schedule repair job where possible.

If subscriber fails:

- Mark outbox item failed or pending retry.
- Increment attempts.
- Preserve last error.
- Do not duplicate event.

---

## 35. Security Requirements

### 35.1 Private Data Protection

Events must protect:

- Momentum Journal text
- Private session transcript text
- Prospect-sensitive information
- Relationship-sensitive information
- Authentication credentials
- Provider secrets
- Internal system secrets

### 35.2 Event Access Control

Runtime event access must be scoped by:

- Tenant
- Brand Ambassador where applicable
- Session where applicable
- Role
- Runtime component
- Audit permission

### 35.3 Event Payload Safety

The implementation must detect and reject obvious payload violations, including:

- Full private journal content in broad event payload
- Full transcript text in broad event payload when a turn reference is sufficient
- API keys or tokens
- Raw provider secrets
- Unscoped prospect-sensitive content

---

## 36. Observability

The event system must expose operational observability.

### 36.1 Required Metrics

The implementation must track:

- Events emitted by type
- Events emitted by source
- Events emitted by tenant
- Events emitted by agent
- Event write latency
- Event write failures
- Idempotent replays
- Idempotency conflicts
- Outbox pending count
- Outbox failed count
- Outbox retry count
- Subscriber processing latency
- Subscriber failures
- Replay jobs started
- Replay jobs completed
- Replay jobs failed
- Privacy validation failures

### 36.2 Required Logs

The implementation must log:

- Event emitted
- Event idempotent replay
- Event validation failure
- Event storage failure
- Outbox item created
- Outbox item completed
- Outbox retry scheduled
- Subscriber failure
- Replay started
- Replay completed
- Replay failed
- Privacy violation blocked

### 36.3 Required Health Checks

The event system must expose health checks for:

- MongoDB event storage
- Outbox backlog
- Failed outbox items
- Subscriber worker health
- Replay service health
- Event validation service
- Metrics projection health

---

## 37. API Contracts

The Runtime Event service may expose internal APIs.

### 37.1 Emit Event

```text id="qo4npj"
POST /api/runtime/events
```

Request:

```ts id="u2krbc"
export interface EmitRuntimeEventRequest<TPayload = Record<string, unknown>> {
  eventType: AgentEventType;
  tenantId: string;
  teamId?: string;
  teamKey?: "team_magnificent";
  teamName?: "Team Magnificent";
  baId?: string;
  agentKey?: AgentKey;
  sessionId?: string;
  correlationId?: string;
  causationId?: string;
  idempotencyKey: string;
  source: AgentEventSource;
  payload: TPayload;
  occurredAt?: string;
  metadata?: Record<string, unknown>;
}
```

Response:

```ts id="mtem1m"
export interface EmitRuntimeEventResponse<TPayload = Record<string, unknown>> {
  event: AgentEventEnvelope<TPayload>;
  idempotentReplay: boolean;
}
```

### 37.2 Find by Correlation ID

```text id="uqrdd4"
GET /api/runtime/events/correlation/:correlationId
```

### 37.3 Find by Session ID

```text id="8j962d"
GET /api/runtime/events/session/:sessionId
```

### 37.4 Replay by Session ID

```text id="pxa03l"
POST /api/runtime/events/replay/session/:sessionId
```

### 37.5 Replay by Correlation ID

```text id="0i8q36"
POST /api/runtime/events/replay/correlation/:correlationId
```

These APIs may remain internal and must enforce authorization.

---

## 38. Persistence Requirements

### 38.1 Required Collections

Version 1.0 requires:

```text id="jck970"
runtime_events
runtime_event_outbox
runtime_event_subscriber_offsets
runtime_event_replay_jobs
runtime_event_errors
runtime_event_metrics_projection
```

### 38.2 Subscriber Offset Model

```ts id="hb0ioc"
export interface RuntimeEventSubscriberOffset {
  subscriberId: string;
  lastProcessedEventId?: string;
  lastProcessedOccurredAt?: string;
  updatedAt: string;
}
```

### 38.3 Replay Job Model

```ts id="h19ldy"
export interface RuntimeEventReplayJob {
  replayId: string;
  tenantId: string;
  mode:
    | "audit_only"
    | "metrics_projection"
    | "lineage_projection"
    | "session_timeline";
  status: "pending" | "running" | "completed" | "failed";
  correlationId?: string;
  sessionId?: string;
  startAt?: string;
  endAt?: string;
  dryRun: boolean;
  allowSideEffects: false;
  createdAt: string;
  completedAt?: string;
  error?: string;
}
```

---

## 39. Relationship to Agent Runtime

Agent Runtime emits events for:

- Session creation
- Context request
- Context receipt
- Turn received
- Turn responded
- State transition
- Journal entry creation
- Candidate proposal
- Guided Action creation
- Relationship context creation
- Invitation draft creation
- Guardrail blocks
- Session completion
- Session failure

Agent Runtime must use the Runtime Event Service.

Agent Runtime must not write directly to `runtime_events`.

---

## 40. Relationship to Browser Voice Runtime

Browser Voice Runtime emits events for:

- Capability checks
- Permission requests
- Permission decisions
- Listening state
- Speech state
- Interim transcripts
- Final transcripts
- Transcript correction
- Language changes
- Fallback to text
- Browser voice errors

Browser Voice Runtime is internal.

Browser Voice Runtime must not emit Telnyx PSTN events.

---

## 41. Relationship to Browser Text Runtime

Browser Text Runtime emits events for:

- Text session start
- Message creation
- Message submission
- Message correction
- Fallback from voice
- Text runtime errors

Browser Text events must reference message or turn records rather than storing unnecessary message body text.

---

## 42. Relationship to Context Manager

Context Manager emits events for:

- Context request
- Retrieval start
- Retrieval completion
- Packet creation
- Packet delivery
- Degraded packet
- Failed packet
- Private journal inclusion
- Candidate exclusion
- Language fallback
- Audit recording

Context events allow Learning Pipeline and Audit Runtime to connect guidance to outcomes.

---

## 43. Relationship to Knowledge Ingestion

Knowledge Ingestion consumes agent and browser events.

Knowledge Ingestion emits:

- Capture events
- Normalization events
- Classification events
- Segmentation events
- Risk-check events
- Dedupe events
- Candidate events
- Review queue events
- Review-only indexing events
- Graph lineage events
- Failure events

Knowledge Ingestion must preserve lineage through event correlation and causation.

---

## 44. Relationship to Knowledge Core

Knowledge Core emits events for:

- Knowledge Object creation
- Knowledge updates
- Lifecycle changes
- Approval
- Activation
- Rejection
- Supersession
- Archival
- Source creation
- Embedding completion
- Graph sync completion
- Retrieval completion
- Quality flags
- Review requests
- Promotion requests
- Learning signal recording
- Translation variants

Knowledge Core events support audit, learning, and projection.

---

## 45. Relationship to Momentum Journal

Journal Runtime emits events for:

- Entry creation
- Entry updates
- Entry archival
- Selection for review
- Promotion to candidate
- Prompt shown
- Prompt accepted
- Prompt dismissed

Journal events must preserve privacy.

Journal text must not be placed unnecessarily in event payloads.

---

## 46. Relationship to Learning Pipeline

Learning Pipeline consumes:

- Context packet events
- Agent turn events
- Guided Action events
- Outcome events
- Knowledge retrieval events
- Candidate events

Learning Pipeline emits:

- Outcome events
- Signal events
- Pattern detected events
- Candidate proposed events
- Knowledge validation or weakening events
- Metrics updated events

Learning events do not approve knowledge by themselves.

---

## 47. Relationship to External Runtime

External runtime includes:

- Ringless voicemail
- SMS
- Future callback workflows

External runtime may use Telnyx.

External runtime emits `external.*` events.

External runtime must not emit `browser_voice.*` events.

Replay of external events must not resend external communications.

---

## 48. Implementation Structure for Codex

A recommended implementation layout is:

```text id="t6fpdv"
server/src/runtime/events/
  index.ts

  event.types.ts
  event.constants.ts
  eventTaxonomy.ts

  event.model.ts
  eventOutbox.model.ts
  eventSubscriberOffset.model.ts
  eventReplayJob.model.ts
  eventError.model.ts

  event.service.ts
  eventValidation.service.ts
  eventPrivacy.service.ts
  eventOutbox.service.ts
  eventSubscribers.ts
  eventReplay.service.ts
  eventMetrics.service.ts

  subscribers/
    knowledgeIngestion.subscriber.ts
    chromaIndex.subscriber.ts
    neo4jGraph.subscriber.ts
    learningPipeline.subscriber.ts
    metricsProjection.subscriber.ts
    auditProjection.subscriber.ts

  payloads/
    browserVoice.payloads.ts
    browserText.payloads.ts
    agentRuntime.payloads.ts
    contextManager.payloads.ts
    knowledgeIngestion.payloads.ts
    knowledgeCore.payloads.ts
    journal.payloads.ts
    guidedAction.payloads.ts
    learning.payloads.ts
    externalRuntime.payloads.ts
    system.payloads.ts

  replay/
    replay.types.ts
    replayPolicies.ts
    sessionTimelineReplay.ts
    metricsProjectionReplay.ts
    lineageProjectionReplay.ts
    auditReplay.ts

  routes.ts

  tests/
    event.schema.test.ts
    event.idempotency.test.ts
    event.privacy.test.ts
    event.outbox.test.ts
    event.replay.test.ts
    event.taxonomy.test.ts
```

---

## 49. Minimal Runtime Implementation Sequence

Codex should implement the Agent Event Model in this order.

### Step 1: Event Types

Implement:

- Event envelope
- Source union
- Event type unions
- Payload interfaces
- Error types

### Step 2: MongoDB Models

Implement:

- `runtime_events`
- `runtime_event_outbox`
- Subscriber offsets
- Replay jobs
- Event errors

### Step 3: Indexes

Create all required unique and query indexes.

### Step 4: Event Validation

Implement event type, source, schema, payload, and privacy validation.

### Step 5: Event Service

Implement `emit`, `emitMany`, `findByCorrelationId`, `findBySessionId`, `findByEventId`, and `findByIdempotencyKey`.

### Step 6: Idempotency

Implement deterministic idempotency checks and conflict handling.

### Step 7: Outbox

Implement outbox creation, processing, retry, completion, and failure.

### Step 8: Subscribers

Implement required workers:

- Knowledge Ingestion
- Chroma Index
- Neo4j Graph
- Learning Pipeline
- Metrics Projection
- Audit Projection

### Step 9: Replay

Implement audit-only replay modes with side effects disabled.

### Step 10: APIs

Implement internal event routes.

### Step 11: Observability

Implement logs, metrics, health checks, and privacy violation tracking.

### Step 12: Tests

Implement schema, idempotency, privacy, outbox, replay, and taxonomy tests.

---

## 50. Testing Requirements

### 50.1 Schema Tests

Schema tests must prove:

- `schemaVersion` exists.
- `schemaVersion` equals `agent_event.v1`.
- Required envelope fields exist.
- Event type is valid.
- Source is valid.
- Tenant ID is present.
- Correlation ID is present or generated.
- Idempotency key is present.
- occurredAt and recordedAt are valid.

### 50.2 Taxonomy Tests

Taxonomy tests must prove:

- Browser Voice event types are valid.
- Browser Text event types are valid.
- Agent Runtime event types are valid.
- Context Manager event types are valid.
- Knowledge Ingestion event types are valid.
- Knowledge Core event types are valid.
- Journal event types are valid.
- Guided Action event types are valid.
- Learning event types are valid.
- External Runtime event types are valid.
- System event types are valid.

### 50.3 Idempotency Tests

Idempotency tests must prove:

- Duplicate idempotency key returns existing event.
- Duplicate event does not create a second event.
- Conflicting payload with same idempotency key is rejected.
- Required idempotency keys are generated correctly.

### 50.4 Privacy Tests

Privacy tests must prove:

- Full private journal text is blocked from broad events.
- Transcript text is avoided when turn ID is sufficient.
- Secrets are blocked.
- External communication payloads avoid unnecessary private text.
- Prospect-sensitive payloads are minimized.

### 50.5 Outbox Tests

Outbox tests must prove:

- Outbox item is created for subscriber events.
- Pending items are processed.
- Failed items retry.
- Retry attempts are counted.
- Completed items are marked completed.
- Failed items can be inspected.

### 50.6 Replay Tests

Replay tests must prove:

- Session timeline replay works.
- Correlation timeline replay works.
- Metrics projection replay works.
- Candidate lineage replay works.
- Replay does not send external SMS.
- Replay does not send voicemail.
- Replay does not create duplicate candidates.
- Replay does not approve knowledge.
- Replay does not rerun Browser Voice actions.

### 50.7 Runtime Boundary Tests

Runtime boundary tests must prove:

- Browser Voice emits only `browser_voice.*` events.
- Browser Voice does not emit Telnyx events.
- External runtime emits `external.*` events.
- Telnyx external events are not confused with internal Browser Voice.
- Agent Runtime does not write events directly to MongoDB.

---

## 51. Acceptance Criteria

The Agent Event Model Runtime is complete only when all acceptance criteria are satisfied.

### 51.1 Event Schema Acceptance Criteria

- Event schema exists.
- `agent_event.v1` is enforced.
- Event envelope is implemented.
- Event source taxonomy is implemented.
- Event type taxonomy is implemented.
- Payload types exist for required events.

### 51.2 Event Storage Acceptance Criteria

- Events store in MongoDB.
- `runtime_events` collection exists.
- Required indexes exist.
- `eventId` is unique.
- `idempotencyKey` is unique.
- Events can be queried by correlation ID.
- Events can be queried by session ID.
- Events can be queried by tenant and BA.

### 51.3 Idempotency Acceptance Criteria

- Event service enforces idempotency.
- Duplicate emits return existing event.
- Conflicting duplicate emits are rejected.
- Required idempotency keys are implemented.

### 51.4 Event Emission Acceptance Criteria

- Browser Voice events emit.
- Browser Text events emit.
- Agent Runtime events emit.
- Context Manager events emit.
- Journal events emit.
- Knowledge Ingestion events emit.
- Knowledge Core events emit.
- Guided Action events emit.
- Learning events emit.
- External Runtime events emit when external workflows exist.
- System events emit.

### 51.5 Outbox Acceptance Criteria

- Outbox collection exists.
- Outbox supports async workers.
- Outbox supports retries.
- Outbox tracks attempts.
- Outbox tracks failures.
- Outbox can mark completion.
- Required subscribers are registered.

### 51.6 Correlation Acceptance Criteria

- Correlation IDs connect related events.
- Causation IDs connect caused events.
- Session timelines can be reconstructed.
- Context audit summaries can be reconstructed.
- Knowledge candidate lineage can be reconstructed.
- Learning traces can be reconstructed.

### 51.7 Privacy Acceptance Criteria

- Event payloads avoid unnecessary private text.
- Transcript text is referenced by turn ID where possible.
- Journal text is referenced by journal entry ID.
- Prospect-sensitive data is minimized.
- Secrets are not stored in events.

### 51.8 Replay Acceptance Criteria

- Replay can rebuild session timelines.
- Replay can rebuild learning metrics.
- Replay can rebuild knowledge candidate lineage.
- Replay can rebuild context audit summaries.
- Replay does not send external communications.
- Replay does not create duplicate candidates.
- Replay does not change review decisions.
- Replay does not rerun Browser Voice actions.

### 51.9 Runtime Boundary Acceptance Criteria

- Browser Voice events remain internal.
- Browser Voice does not use Telnyx.
- External events are separate.
- Telnyx is limited to external SMS, ringless voicemail, and future callback workflows.
- Agent Runtime uses Runtime Event Service.
- Components do not write directly to event storage.

---

## 52. Required Invariants

The following invariants must always hold.

1. Every event has `schemaVersion: "agent_event.v1"`.
2. Every event has an event ID.
3. Every event has an event type.
4. Every event has a tenant ID.
5. Every event has a correlation ID.
6. Every event has an idempotency key.
7. Every event has a source.
8. Every event has occurredAt.
9. Every event has recordedAt.
10. Events are immutable after creation.
11. Duplicate idempotency keys do not create duplicate events.
12. Event payloads minimize private text.
13. Journal text is not placed unnecessarily in broad events.
14. Transcript text is referenced by turn ID where possible.
15. Browser Voice events are internal.
16. Browser Voice events do not represent Telnyx PSTN activity.
17. External runtime events are separate.
18. Replay does not perform external side effects.
19. Replay does not approve knowledge.
20. Replay does not create duplicate candidates.
21. Outbox subscribers are idempotent.
22. Correlation IDs allow timeline reconstruction.
23. Causation IDs allow cause-chain reconstruction.
24. English and Spanish language metadata are preserved where relevant.
25. Every Brand Ambassador-scoped event carries Team Magnificent identity, including `teamId`, `teamKey`, and `teamName`.

---

## 53. Completion Definition

The Agent Event Model Runtime is considered Version 1.0 complete when:

- Event envelope is implemented.
- Event taxonomy is implemented.
- Runtime event storage exists.
- Required indexes exist.
- Event service emits events.
- Event service enforces idempotency.
- Event service supports correlation lookup.
- Event service supports session lookup.
- Outbox exists.
- Required subscribers are registered.
- Replay service exists.
- Replay side effects are disabled.
- Privacy validation blocks unsafe payloads.
- Browser Voice, Browser Text, Agent Runtime, Context Manager, Knowledge Ingestion, Knowledge Core, Journal, Guided Action, Learning, External Runtime, and System event categories are represented.
- Acceptance tests pass.

---

## 54. Final Runtime Statement

The Agent Event Model is the runtime record of what happened inside Momentum Creation System V2.

It makes sessions traceable.

It makes Context Packets auditable.

It makes agent guidance reviewable.

It makes journal promotion accountable.

It makes Knowledge Candidate lineage visible.

It makes Guided Actions measurable.

It makes outcomes learnable.

It makes replay possible without repeating unsafe side effects.

It protects private text by using references instead of unnecessary payload exposure.

It keeps internal Browser Voice separate from Telnyx.

It keeps external runtime events separate from internal coaching events.

It allows Momentum to learn from experience while preserving governance, privacy, and runtime boundaries.

The event system records.

The Knowledge Core remembers.

The Context Manager selects.

The Agent Runtime guides.

The Brand Ambassador acts.

The Learning Pipeline evaluates.

Momentum evolves.

---

## Ratification

Status: RATIFIED

Ratified By: Kevin Gardner

Ratification Date: 2026-06-27

Architecture Review: PASS

Review Authority: Claude (Chief Governance Architect)

Implementation Authority: Codex

Version: 1.0.0

This document is now a canonical source-of-truth for Momentum Creation System V2.

Future modifications require an approved ACR.
