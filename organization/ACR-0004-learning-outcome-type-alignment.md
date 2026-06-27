# ACR-0004 — Learning Outcome Type Alignment

## Momentum Creation System V2

Status: Proposed

Priority: Post-Runtime Ratification

Type: Architecture Consistency

Approval: Pending

---

## Purpose

Align the outcome-type vocabulary used in `AGENT_EVENT_MODEL.md` and `KNOWLEDGE_INGESTION_PROTOCOL.md` with the canonical `LearningOutcome.outcomeType` defined in `LEARNING_PIPELINE.md`.

`LEARNING_PIPELINE.md` is the canonical domain authority for learning outcomes.

The event payload and the ingestion request currently use a smaller, divergent outcome-type set.

This ACR aligns those two surfaces to the canonical learning outcome-type vocabulary.

This ACR introduces architectural consistency only.

It does not change runtime behavior.

---

## Motivation

The Learning Pipeline owns the `LearningOutcome` domain model, including its `outcomeType` union.

When the Learning Pipeline emits `learning.outcome.created`, the event payload must be able to carry that outcome type.

`LEARNING_PIPELINE.md` §12 `LearningOutcome.outcomeType` defines a 17-value set:

```text
action_completed, action_skipped, journal_entry_created,
invitation_draft_created, invitation_draft_edited, invitation_draft_used,
follow_up_completed, training_question_resolved, training_question_unresolved,
success_lesson_confirmed, relationship_approach_worked,
relationship_approach_needs_revision, knowledge_helpful, knowledge_not_helpful,
voice_session_completed, voice_fallback_used, language_fallback_used
```

`AGENT_EVENT_MODEL.md` §21.2 `LearningOutcomeCreatedPayload.outcomeType` and `KNOWLEDGE_INGESTION_PROTOCOL.md` §27.5 `IngestOutcomeRequest.outcomeType` both use a different 9-value set:

```text
action_completed, action_missed, prospect_responded, presentation_viewed,
follow_up_completed, training_completed, conversion, retention_signal,
feedback_received
```

The two sets overlap only partially, so the event payload cannot faithfully represent every Learning Pipeline outcome.

---

## Proposed Changes

### 1. Align the Agent Event Model payload

Update `AGENT_EVENT_MODEL.md` §21.2 `LearningOutcomeCreatedPayload.outcomeType` to use the canonical `LearningOutcome.outcomeType` vocabulary from `LEARNING_PIPELINE.md` §12 (or reference that type directly).

### 2. Align the Knowledge Ingestion request

Update `KNOWLEDGE_INGESTION_PROTOCOL.md` §27.5 `IngestOutcomeRequest.outcomeType` to the same canonical vocabulary.

### 3. Preserve genuinely distinct outcome concepts

Any outcome concept in the current 9-value set that is genuinely needed and absent from the Learning Pipeline set (for example `conversion`, `retention_signal`, `prospect_responded`, `presentation_viewed`) must be added to the canonical `LearningOutcome.outcomeType` in `LEARNING_PIPELINE.md` rather than retained as a divergent local copy, so a single canonical vocabulary remains.

---

## Impact

Documents affected:

- AGENT_EVENT_MODEL.md
- KNOWLEDGE_INGESTION_PROTOCOL.md
- LEARNING_PIPELINE.md (only if distinct concepts must be merged into the canonical set)

Referenced documents:

- LEARNING_PIPELINE.md

No application behavior changes.

No implementation changes required until Version 1.1.

---

## Rationale

`LEARNING_PIPELINE.md` is the canonical domain owner of learning outcomes.

The event payload and ingestion request are downstream surfaces of the same concept and should share one outcome-type vocabulary.

This ACR removes an outcome-type vocabulary divergence without changing the constitutional architecture.

---

## Approval

Pending
