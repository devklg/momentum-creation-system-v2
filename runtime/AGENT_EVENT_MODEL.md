# Agent Event Model

Status: Canonical runtime source-of-truth  
Layer: `/runtime`

## Purpose

The Agent Event Model defines immutable runtime events for browser voice, agents, context packets, ingestion, journal, knowledge, and learning.

## Event envelope

```ts
export interface AgentEventEnvelope<TPayload = Record<string, unknown>> {
  eventId: string;
  eventType: AgentEventType;
  schemaVersion: 'agent_event.v1';
  tenantId: string;
  baId?: string;
  agentKey?: 'steve_success' | 'michael_magnificent' | 'ivory';
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

```ts
export type AgentEventSource =
  | 'browser_voice_runtime'
  | 'agent_runtime'
  | 'context_manager'
  | 'knowledge_core'
  | 'knowledge_ingestion'
  | 'learning_pipeline'
  | 'journal_runtime'
  | 'implementation_test'
  | 'system';
```

## Storage

Store events in MongoDB collection:

```text
runtime_events
```

Indexes:

```ts
{ eventId: 1 }, unique
{ idempotencyKey: 1 }, unique
{ tenantId: 1, occurredAt: -1 }
{ tenantId: 1, baId: 1, occurredAt: -1 }
{ sessionId: 1, occurredAt: 1 }
{ eventType: 1, occurredAt: -1 }
{ correlationId: 1, occurredAt: 1 }
```

## Event taxonomy

### Browser voice

```text
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

### Agent runtime

```text
agent.session.created
agent.session.started
agent.session.paused
agent.session.resumed
agent.session.completed
agent.session.failed
agent.turn.received
agent.turn.responded
agent.state.transitioned
agent.guided_action.suggested
agent.guided_action.accepted
agent.guided_action.dismissed
agent.invitation_draft.created
agent.output.blocked_by_guardrail
```

### Context manager

```text
context.requested
context.retrieval.started
context.retrieval.completed
context.packet.created
context.packet.delivered
context.packet.degraded
context.packet.failed
context.private_journal.included
context.candidate.excluded
context.language.fallback_used
```

### Knowledge ingestion

```text
knowledge.capture.created
knowledge.capture.normalized
knowledge.capture.classified
knowledge.capture.segmented
knowledge.capture.risk_checked
knowledge.capture.deduped
knowledge.candidate.created
knowledge.candidate.queued_for_review
knowledge.candidate.indexed_for_review
knowledge.candidate.approved
knowledge.candidate.rejected
knowledge.approved.created
knowledge.approved.indexed
knowledge.graph.linked
knowledge.ingestion.failed
```

### Journal

```text
journal.entry.created
journal.entry.updated
journal.entry.archived
journal.entry.selected_for_review
journal.entry.promoted_to_candidate
journal.prompt.shown
journal.prompt.accepted
journal.prompt.dismissed
```

### Learning

```text
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

## Idempotency

| Event | Idempotency key |
|---|---|
| Session created | `agent.session.created:${sessionId}` |
| Turn received | `agent.turn.received:${sessionId}:${turnSequence}` |
| Final transcript | `browser_voice.final_transcript:${sessionId}:${transcriptHash}` |
| Context packet created | `context.packet.created:${packetId}` |
| Journal entry created | `journal.entry.created:${journalEntryId}` |
| Candidate created | `knowledge.candidate.created:${candidateId}` |
| Outcome created | `learning.outcome.created:${outcomeId}` |

## Required payload examples

```ts
interface AgentSessionCreatedPayload {
  sessionId: string;
  agentKey: 'steve_success' | 'michael_magnificent' | 'ivory';
  language: 'en' | 'es';
  mode: 'browser_voice' | 'text' | 'mixed';
  taskType: string;
}
```

```ts
interface ContextPacketCreatedPayload {
  packetId: string;
  requestId: string;
  sessionId: string;
  agentKey: 'steve_success' | 'michael_magnificent' | 'ivory';
  includedKnowledgeIds: string[];
  includedPrivateContextIds: string[];
  tokenEstimate: number;
  isDegraded: boolean;
}
```

```ts
interface KnowledgeCandidateCreatedPayload {
  candidateId: string;
  domain: 'success' | 'training' | 'relationship';
  sourceType: string;
  sourceId: string;
  riskFlags: string[];
  status: 'candidate';
}
```

Do not put unnecessary private transcript text in broad events. Store transcripts in `conversation_turns` and reference `turnId`.

## Event service

```ts
interface RuntimeEventService {
  emit<TPayload>(event: CreateRuntimeEventInput<TPayload>): Promise<AgentEventEnvelope<TPayload>>;
  emitMany(events: CreateRuntimeEventInput[]): Promise<AgentEventEnvelope[]>;
  findByCorrelationId(correlationId: string): Promise<AgentEventEnvelope[]>;
  findBySessionId(sessionId: string): Promise<AgentEventEnvelope[]>;
}
```

## Outbox

```ts
interface RuntimeEventOutboxItem {
  outboxId: string;
  eventId: string;
  eventType: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  attempts: number;
  nextAttemptAt?: Date;
  lastError?: string;
  createdAt: Date;
  updatedAt: Date;
}
```

Subscribers: knowledge ingestion worker, Chroma index worker, Neo4j graph worker, learning pipeline worker, and metrics projection worker.

## Replay rules

Replay can rebuild session timelines, learning metrics, knowledge candidate lineage, and context audit summaries. Replay must not send external communications, create duplicate candidates, change review decisions, or rerun browser voice actions.

## Suggested files

```text
server/src/runtime/events/event.types.ts
server/src/runtime/events/event.model.ts
server/src/runtime/events/eventOutbox.model.ts
server/src/runtime/events/event.service.ts
server/src/runtime/events/eventSubscribers.ts
server/src/runtime/events/eventReplay.service.ts
server/src/runtime/events/routes.ts
```

## Acceptance criteria

Event schema exists; event service enforces idempotency; events store in MongoDB; session/context/journal/ingestion/learning events emit; outbox supports async workers; correlation IDs connect related events; event payloads avoid unnecessary private text.
