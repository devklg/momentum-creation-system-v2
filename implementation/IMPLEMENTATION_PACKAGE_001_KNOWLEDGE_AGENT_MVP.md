# Implementation Package 001 - Knowledge Agent MVP

Status: Canonical implementation package  
Layer: `/implementation`  
Target: Codex implementation  
Depends on: `/runtime`

## Purpose

This package gives Codex a direct serial implementation plan for Phase 2 Runtime Layer.

Do not redesign the platform. Do not create new governance. Continue from the ratified Foundation.

## MVP outcome

Build runtime support for Steve Success browser voice/text success interviews; Michael Magnificent browser voice/text training support and Momentum Journal teaching; Ivory browser voice/text relationship coaching and editable invitation drafts; Momentum Journal; Knowledge Core using Mongo/Mongoose, Chroma, Neo4j, and GraphRAG service boundaries; Context Manager and `context_packet.v1`; Agent Event Model; Knowledge Ingestion Protocol; Learning Pipeline.

## Hard constraints

1. Momentum is a Knowledge-Centric Platform.
2. Knowledge belongs to Momentum, not individual agents.
3. Steve, Michael, and Ivory use browser voice plus text fallback.
4. Do not use Telnyx PSTN for internal coaching agents.
5. Telnyx is reserved for ringless voicemail, SMS, and future callback workflows.
6. MVP supports English and Spanish.
7. Every interview template exists in both languages.
8. Every BA owns a private Momentum Journal.
9. Selected journal entries may become Knowledge Candidates after review.
10. Agents may propose candidates but cannot approve them.
11. Ivory drafts are editable and BA-owned.
12. No auto-send of prospect outreach.

## Existing app context to preserve

Default local surfaces:

```text
server: http://localhost:7700
.com prospect app: http://localhost:7701
.team app: http://localhost:7702
```

Known `.team` routes:

```text
/welcome
/cockpit
/ivory
/invitations
/michael/schedule
/michael/interview
/onboarding/questionnaire
/training/day-1
```

Known `.com` routes:

```text
/p/:token
/p/:token?view=dashboard
```

Add runtime agent surfaces without breaking these expectations.

## Phase 001-A: Repo audit

Create:

```text
implementation/audits/RUNTIME_MVP_REPO_AUDIT.md
```

Tasks:

- locate server entry point;
- locate Mongo/Mongoose setup;
- locate existing Neo4j/Chroma adapters or stubs;
- locate `.team` router;
- locate existing `/ivory`, `/michael/interview`, `/invitations`, `/cockpit`;
- locate shared types package;
- confirm no Telnyx internal coaching path will be implemented.

Do not modify app code in this phase.

## Phase 001-B: Shared runtime types

Create/update:

```text
packages/shared/src/runtime/contextPacket.ts
packages/shared/src/runtime/agentEvents.ts
packages/shared/src/runtime/agentSession.ts
packages/shared/src/runtime/knowledge.ts
packages/shared/src/runtime/journal.ts
packages/shared/src/runtime/learning.ts
packages/shared/src/runtime/index.ts
```

Acceptance: `ContextPacketV1`, `AgentEventEnvelope`, typed agent keys, and `en | es` language union exist and compile.

## Phase 001-C: Event model and outbox

Create/update:

```text
server/src/runtime/events/event.types.ts
server/src/runtime/events/event.model.ts
server/src/runtime/events/eventOutbox.model.ts
server/src/runtime/events/event.service.ts
server/src/runtime/events/routes.ts
```

Acceptance: events persist in MongoDB; `eventId` and `idempotencyKey` are unique; events can query by `sessionId` and `correlationId`.

## Phase 001-D: Knowledge Core

Create/update:

```text
server/src/runtime/knowledge/agentSession.model.ts
server/src/runtime/knowledge/conversationTurn.model.ts
server/src/runtime/knowledge/knowledgeCandidate.model.ts
server/src/runtime/knowledge/approvedKnowledge.model.ts
server/src/runtime/knowledge/knowledgeCore.service.ts
server/src/runtime/knowledge/chroma.adapter.ts
server/src/runtime/knowledge/neo4j.adapter.ts
server/src/runtime/knowledge/routes.ts
```

Acceptance: sessions, turns, candidates, approved knowledge persist; Chroma and Neo4j adapters exist as real adapters or safe stubs; agents do not access DB clients directly.

## Phase 001-E: Momentum Journal

Create/update:

```text
server/src/runtime/journal/momentumJournalEntry.model.ts
server/src/runtime/journal/journal.service.ts
server/src/runtime/journal/routes.ts
apps/team/src/routes/journal/index.tsx
apps/team/src/components/runtime/JournalEntryEditor.tsx
apps/team/src/components/runtime/JournalEntryList.tsx
apps/team/src/components/runtime/JournalPromptCard.tsx
```

Acceptance: BA can create private journal entries; categories are lesson, idea, question, observation, reflection, script, reminder, other; selecting for review creates a Knowledge Candidate, not approved knowledge; Michael can create journal prompts.

## Phase 001-F: Knowledge ingestion

Create/update:

```text
server/src/runtime/ingestion/capture.service.ts
server/src/runtime/ingestion/normalize.service.ts
server/src/runtime/ingestion/classify.service.ts
server/src/runtime/ingestion/dedupe.service.ts
server/src/runtime/ingestion/candidate.service.ts
server/src/runtime/ingestion/routes.ts
```

Acceptance: session turns capture; captures normalize and classify; candidates create with lineage and risk flags; candidates default to `candidate`; candidate creation is idempotent.

## Phase 001-G: Context Manager

Create/update:

```text
server/src/runtime/context/context.types.ts
server/src/runtime/context/contextManager.service.ts
server/src/runtime/context/retrieval.service.ts
server/src/runtime/context/contextPacket.model.ts
server/src/runtime/context/routes.ts
```

Acceptance: `buildContextPacket()` returns `context_packet.v1`; packet includes required runtime rules and guardrails; candidate knowledge is excluded by default; private journal context is scoped to BA; English and Spanish packets work.

## Phase 001-H: Browser Voice Runtime

Create/update:

```text
apps/team/src/runtime/browserVoice/browserVoice.types.ts
apps/team/src/runtime/browserVoice/browserVoiceController.ts
apps/team/src/runtime/browserVoice/useBrowserVoice.ts
apps/team/src/runtime/browserVoice/speechLanguage.ts
apps/team/src/components/runtime/BrowserAgentSession.tsx
apps/team/src/components/runtime/VoiceControls.tsx
apps/team/src/components/runtime/TranscriptPanel.tsx
apps/team/src/components/runtime/TextFallbackInput.tsx
apps/team/src/components/runtime/AgentResponsePanel.tsx
```

Acceptance: support detection works; microphone permission flow exists; text fallback always works; English/Spanish language selector exists; final transcript submits to Agent Runtime; no Telnyx/PSTN path exists.

## Phase 001-I: Agent Runtime backend

Create/update:

```text
server/src/runtime/agents/agent.registry.ts
server/src/runtime/agents/agent.types.ts
server/src/runtime/agents/agentRuntime.service.ts
server/src/runtime/agents/templates/steve.en.ts
server/src/runtime/agents/templates/steve.es.ts
server/src/runtime/agents/templates/michael.en.ts
server/src/runtime/agents/templates/michael.es.ts
server/src/runtime/agents/templates/ivory.en.ts
server/src/runtime/agents/templates/ivory.es.ts
server/src/runtime/agents/outputGuardrails.ts
server/src/runtime/agents/routes.ts
```

Acceptance: sessions can be created for all three agents; each agent has English and Spanish templates; turns transition state; agents can create journal prompts and candidates; Ivory can create editable invitation draft; guardrails block auto-send and Telnyx internal voice behavior.

## Phase 001-J: Agent UI routes

Create/update/adapt:

```text
apps/team/src/routes/michael/interview.tsx
apps/team/src/routes/ivory/index.tsx
apps/team/src/routes/steve/interview.tsx
```

Acceptance: Michael runs training support; Ivory runs relationship coaching; Steve runs success interview; transcript is visible; journal prompt appears when returned; language selection works.

## Phase 001-K: Learning Pipeline

Create/update:

```text
server/src/runtime/learning/learning.types.ts
server/src/runtime/learning/learningOutcome.model.ts
server/src/runtime/learning/learningSignal.model.ts
server/src/runtime/learning/learningPipeline.service.ts
server/src/runtime/learning/patternDetection.worker.ts
server/src/runtime/learning/learningGraph.worker.ts
server/src/runtime/learning/learningMetrics.service.ts
server/src/runtime/learning/routes.ts
```

Acceptance: outcomes can be recorded; learning signals can be created; signals link to sessions, events, candidates, and knowledge; pattern detection may be rules-based; learning proposes candidates but does not approve them.

## Phase 001-L: Tests and QA

Create/update:

```text
server/src/runtime/__tests__/agentRuntime.test.ts
server/src/runtime/__tests__/contextPacket.test.ts
server/src/runtime/__tests__/knowledgeIngestion.test.ts
server/src/runtime/__tests__/journal.test.ts
server/src/runtime/__tests__/learningPipeline.test.ts
apps/team/src/runtime/browserVoice/__tests__/browserVoiceController.test.ts
```

Required tests: agent session creates; context packet validates; journal privacy; selected journal entry creates candidate only; candidate is not approved knowledge; Telnyx internal voice is blocked; English/Spanish templates exist.

## API route map

```text
POST   /api/runtime/events
GET    /api/runtime/events/session/:sessionId
POST   /api/runtime/agents/:agentKey/sessions
GET    /api/runtime/agents/:agentKey/sessions/:sessionId
POST   /api/runtime/agents/:agentKey/sessions/:sessionId/turns
POST   /api/runtime/agents/:agentKey/sessions/:sessionId/complete
POST   /api/runtime/journal
GET    /api/runtime/journal
PATCH  /api/runtime/journal/:journalEntryId
POST   /api/runtime/journal/:journalEntryId/select-for-review
POST   /api/runtime/ingestion/capture-turn
POST   /api/runtime/knowledge-candidates
GET    /api/runtime/knowledge-candidates
POST   /api/runtime/knowledge-candidates/:candidateId/approve
POST   /api/runtime/knowledge-candidates/:candidateId/reject
GET    /api/runtime/knowledge/:knowledgeId
POST   /api/runtime/knowledge/retrieve
POST   /api/runtime/context/build
POST   /api/runtime/outcomes
GET    /api/runtime/outcomes
POST   /api/runtime/learning/signals
GET    /api/runtime/learning/signals
GET    /api/runtime/learning/metrics
```

## Env variables

```env
MONGODB_URI=
NEO4J_URI=
NEO4J_USERNAME=
NEO4J_PASSWORD=
CHROMA_URL=
RUNTIME_EVENT_OUTBOX_ENABLED=true
RUNTIME_BROWSER_VOICE_ENABLED=true
RUNTIME_INTERNAL_TELNYX_DISABLED=true
```

Do not add Telnyx requirements for internal coaching agents.

## Codex execution prompt

```text
You are implementing Momentum Creation System V2 Phase 2 Runtime Layer.

Read these files first:
- /runtime/README.md
- /runtime/KNOWLEDGE_CORE_RUNTIME.md
- /runtime/KNOWLEDGE_INGESTION_PROTOCOL.md
- /runtime/CONTEXT_MANAGER.md
- /runtime/CONTEXT_PACKET_SCHEMA.md
- /runtime/AGENT_RUNTIME.md
- /runtime/LEARNING_PIPELINE.md
- /runtime/BROWSER_VOICE_RUNTIME.md
- /runtime/AGENT_EVENT_MODEL.md
- /implementation/IMPLEMENTATION_PACKAGE_001_KNOWLEDGE_AGENT_MVP.md

Do not redesign the platform.
Do not create new governance.
Do not use Telnyx PSTN for internal coaching agents.
Steve Success, Michael Magnificent, and Ivory use browser voice plus text fallback.
MVP supports English and Spanish.
Every interview template exists in English and Spanish.
Momentum Journal belongs to the BA and is private by default.
Agents may propose Knowledge Candidates but may not approve them.
Ivory drafts are editable and BA-owned; do not auto-send.

Start with Phase 001-A repo audit.
After each implementation phase run:
- pnpm typecheck
- pnpm build
- git status --short --branch
```

## Definition of done

Runtime docs are placed in repo; shared types compile; event model works; Knowledge Core service exists; Journal runtime preserves privacy; ingestion creates candidates, not approved knowledge; Context Manager creates `context_packet.v1`; browser voice/text fallback works; Steve/Michael/Ivory have English and Spanish templates; Michael teaches Momentum Journal; Ivory creates editable drafts; learning outcomes and signals can be recorded; typecheck and build pass; Telnyx is not used for internal coaching voice.
