# ACR-0001 — Agent Event Model Alignment for Knowledge Evolution

## Momentum Creation System V2

Status: Proposed

Priority: Post-Runtime Ratification

Type: Architecture Consistency

Approval: Pending

---

## Purpose

Align the Agent Event Model with the ratified Knowledge Evolution Runtime.

The current Runtime architecture defines Knowledge Evolution as a first-class runtime component.

The Agent Event Model should explicitly recognize Knowledge Evolution as an event producer and consumer.

This ACR introduces architectural consistency only.

It does not change runtime behavior.

---

## Motivation

The Runtime Layer now contains a dedicated Knowledge Evolution Runtime.

Knowledge Evolution emits and consumes runtime events.

The Agent Event Model should explicitly represent this runtime component rather than relying on indirect Knowledge Core or Learning Pipeline events.

---

## Proposed Changes

### 1. Register a new Runtime Event Source

Add:

```text
knowledge_evolution
```

to the `AgentEventSource` union.

Knowledge Evolution becomes a first-class runtime event producer.

---

### 2. Register the Knowledge Evolution Event Family

Add the following event family:

```text
knowledge.evolution.received
knowledge.evolution.plan_created
knowledge.evolution.version_created
knowledge.evolution.knowledge_written
knowledge.evolution.supersession_applied
knowledge.evolution.archive_applied
knowledge.evolution.reindex_requested
knowledge.evolution.reindex_completed
knowledge.evolution.graph_sync_requested
knowledge.evolution.graph_sync_completed
knowledge.evolution.retrieval_ready
knowledge.evolution.rollback_applied
knowledge.evolution.failed
knowledge.evolution.completed
```

These events already exist in the Knowledge Evolution Runtime and should become canonical Agent Event Model events.

---

### 3. Register Review Approval Events

Add approval lifecycle events that bridge review and evolution.

```text
knowledge.candidate.approved
knowledge.translation.approved
knowledge.refinement.approved
knowledge.supersession.approved
knowledge.archive.approved
```

These events become the canonical transition between Review and Knowledge Evolution.

---

## Impact

Documents affected:

- AGENT_EVENT_MODEL.md

Referenced documents:

- KNOWLEDGE_EVOLUTION_RUNTIME.md
- KNOWLEDGE_CORE_RUNTIME.md
- KNOWLEDGE_INGESTION_PROTOCOL.md
- LEARNING_PIPELINE.md

No application behavior changes.

No implementation changes required until Version 1.1.

---

## Rationale

Knowledge Evolution is now a first-class Runtime component.

The event system should explicitly represent that architectural reality.

This ACR improves runtime consistency without changing the constitutional architecture.

---

## Approval

Pending
