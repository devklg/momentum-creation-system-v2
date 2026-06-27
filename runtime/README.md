# Runtime Layer README

Status: Canonical runtime source-of-truth  
Layer: `/runtime`  
Phase: Phase 2 - Knowledge -> Runtime -> Implementation  
System: Momentum Creation System V2

## Purpose

This folder defines the runtime architecture that implements the ratified Foundation. It is implementation architecture, not constitutional architecture. It does not redesign the platform and it does not create new governance.

Momentum remains a Knowledge-Centric Platform:

```text
Conversation
  -> Knowledge Acquisition
  -> Knowledge Core
  -> Context Manager
  -> Agent Runtime
  -> Guided Action
  -> Outcome
  -> Learning
  -> Knowledge Growth
```

## Runtime documents

```text
/runtime/README.md
/runtime/KNOWLEDGE_CORE_RUNTIME.md
/runtime/KNOWLEDGE_INGESTION_PROTOCOL.md
/runtime/CONTEXT_MANAGER.md
/runtime/CONTEXT_PACKET_SCHEMA.md
/runtime/AGENT_RUNTIME.md
/runtime/LEARNING_PIPELINE.md
/runtime/BROWSER_VOICE_RUNTIME.md
/runtime/AGENT_EVENT_MODEL.md
/implementation/IMPLEMENTATION_PACKAGE_001_KNOWLEDGE_AGENT_MVP.md
```

## Runtime scope

Runtime defines how knowledge is captured, stored, indexed, retrieved, packetized, used by agents, and improved by outcomes.

Runtime does not define constitutional authority, ACR governance, compensation logic, prospect claims, or new platform governance.

## Ratified runtime agents

| Agent | Runtime responsibility | Knowledge created |
|---|---|---|
| Steve Success | Success interviews, lesson capture, momentum action planning | Success Knowledge |
| Michael Magnificent | Training support, onboarding support, Momentum Journal teaching | Training Knowledge |
| Ivory | Relationship coaching and editable invitation drafting | Relationship Knowledge |

Knowledge belongs to Momentum, not to any individual agent.

## Channel boundary

Internal agents use browser voice, browser text fallback, session transcript capture, and context packets.

Internal agents do not use Telnyx PSTN.

Telnyx is reserved for ringless voicemail, SMS, and future callback workflows.

## Bilingual MVP

The MVP supports English and Spanish. Every interview template exists in both languages. Every context packet, transcript, journal entry, candidate, and approved knowledge item includes language metadata.

## Momentum Journal rule

Every Brand Ambassador owns a Momentum Journal. Michael teaches every BA how to use it effectively. Journal entries are private by default and capture lessons learned, ideas, questions, observations, reflections, scripts, and personal reminders.

Selected entries may become Knowledge Candidates after review. They do not automatically become organizational knowledge.

## Runtime architecture

```text
Brand Ambassador
  -> Browser Runtime
  -> Agent Runtime
  -> Context Manager
  -> Knowledge Core
  -> Learning Pipeline
```

## Store responsibilities

| Store | Runtime responsibility |
|---|---|
| MongoDB + Mongoose | Operational source of truth: sessions, turns, journal entries, candidates, approved knowledge, events, outcomes |
| Chroma | Semantic retrieval for approved knowledge, review candidates, summaries, templates, and bilingual search |
| Neo4j | Knowledge lineage, BA/session/journal relationships, outcomes, concept edges, GraphRAG traversal |
| GraphRAG | Retrieval strategy combining graph relationships, semantic search, and operational filters |

## Default local expectations

```powershell
pnpm install
pnpm dev:server
pnpm dev:com
pnpm dev:team
pnpm typecheck
pnpm build
```

```text
server: http://localhost:7700
.com prospect app: http://localhost:7701
.team app: http://localhost:7702
```

## Implementation order

1. Agent Event Model and shared types
2. Mongo/Mongoose models
3. Knowledge Core service interfaces
4. Knowledge Ingestion Protocol
5. Context Packet Schema and Context Manager
6. Browser Voice Runtime
7. Agent Runtime
8. Michael MVP with Momentum Journal teaching
9. Steve Success MVP
10. Ivory MVP
11. Learning Pipeline
12. Runtime QA and acceptance tests

## Acceptance gates

The Runtime Layer is complete when Steve, Michael, and Ivory run through browser voice and text fallback; English and Spanish templates exist; the Momentum Journal is private by default; selected journal entries can become Knowledge Candidates; agents use Context Packets; candidates are not treated as approved knowledge; runtime events are emitted consistently; Telnyx is not used for internal coaching voice.
