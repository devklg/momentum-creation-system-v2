# IMPLEMENTATION_PACKAGE_001_KNOWLEDGE_AGENT_MVP.md

## Momentum Creation System V2

### Implementation Package 001 — Knowledge Agent MVP

#### Version 1.0

---

## 1. Document Status

**Document Name:** Implementation Package 001 — Knowledge Agent MVP  
**System:** Momentum Creation System V2  
**Layer:** `/implementation`  
**Status:** Canonical Implementation Package  
**Target:** Codex implementation  
**Depends On:** `/runtime`  
**Runtime Freeze:** Runtime Layer Version 1.0  
**Team Scope:** Team Magnificent  
**BA Scope:** Brand Ambassador inside Team Magnificent  
**Internal Runtime:** Steve Success, Michael Magnificent, Ivory, Browser Voice, Browser Text  
**External Runtime:** Ringless Voicemail, SMS, future callback workflows  
**Telnyx Scope:** External runtime only. Telnyx is not part of internal Browser Voice, Steve, Michael, or Ivory runtime.  
**Bilingual Requirement:** English and Spanish

---

## 2. Purpose

This package gives Codex a direct serial implementation plan for the Momentum Creation System V2 Phase 2 Runtime Layer.

Do not redesign the platform.

Do not create new governance.

Do not create a new runtime philosophy.

Do not replace the ratified Foundation.

Implement the Runtime Layer exactly as described in the ratified `/runtime` documents.

The purpose of Package 001 is to build the Knowledge Agent MVP:

```text
Team Magnificent Brand Ambassador
  ↓
Browser Voice / Browser Text
  ↓
Steve Success / Michael Magnificent / Ivory
  ↓
Context Packet
  ↓
Knowledge Core
  ↓
Momentum Journal
  ↓
Knowledge Candidate
  ↓
Learning Pipeline
  ↓
Knowledge Evolution
```

---

## 3. MVP Outcome

Build runtime support for:

- Steve Success browser voice/text success interviews
- Michael Magnificent browser voice/text training support
- Michael Momentum Journal teaching
- Ivory browser voice/text relationship coaching
- Ivory editable invitation drafts
- Momentum Journal private personal knowledge
- Knowledge Core using Mongo/Mongoose, Chroma, Neo4j, and GraphRAG service boundaries
- Knowledge Ingestion Protocol
- Context Manager
- `context_packet.v1`
- Agent Runtime
- Agent Event Model
- Browser Voice Runtime
- Learning Pipeline
- Knowledge Evolution Runtime
- Team Magnificent identity scope
- English and Spanish runtime operation

This package must leave the system ready for later implementation packages without creating application-specific behavior that belongs outside Runtime.

---

## 4. Required Runtime Source Documents

Codex must read these files first and treat them as canonical:

```text
/runtime/README.md
/runtime/KNOWLEDGE_CORE_RUNTIME.md
/runtime/KNOWLEDGE_INGESTION_PROTOCOL.md
/runtime/CONTEXT_MANAGER.md
/runtime/CONTEXT_PACKET_SCHEMA.md
/runtime/AGENT_RUNTIME.md
/runtime/AGENT_EVENT_MODEL.md
/runtime/BROWSER_VOICE_RUNTIME.md
/runtime/LEARNING_PIPELINE.md
/runtime/KNOWLEDGE_EVOLUTION_RUNTIME.md
/implementation/IMPLEMENTATION_PACKAGE_001_KNOWLEDGE_AGENT_MVP.md
```

The implementation must satisfy the acceptance criteria defined in those runtime files.

---

## 5. Hard Constraints

1. Momentum is a Knowledge-Centric Platform.
2. Knowledge belongs to Momentum, not individual agents.
3. The app is scoped to Team Magnificent.
4. Every BA-scoped record must also be Team Magnificent scoped.
5. `baId` remains the correct Three International Brand Ambassador identifier.
6. `teamId`, `teamKey`, and `teamName` define the Team Magnificent application boundary.
7. Steve, Michael, and Ivory use browser voice plus text fallback.
8. Do not use Telnyx PSTN for internal coaching agents.
9. Telnyx is reserved for ringless voicemail, SMS, and future callback workflows.
10. MVP supports English and Spanish.
11. Every interview template exists in English and Spanish.
12. Every BA owns a private Momentum Journal.
13. Momentum Journal entries are private by default.
14. Selected journal entries may become Knowledge Candidates after review.
15. Agents may propose candidates but cannot approve them.
16. Knowledge Candidates are review-only.
17. Approved candidates become active knowledge only through Knowledge Evolution.
18. Ivory drafts are editable and BA-owned.
19. Ivory must not auto-send prospect outreach.
20. Learning Pipeline does not approve knowledge.
21. Knowledge Evolution does not approve knowledge.
22. Knowledge Evolution does not allow agents to self-modify.
23. Context Manager builds Context Packets.
24. Agents do not query MongoDB, Chroma, Neo4j, or GraphRAG directly.

---

## 6. Team Magnificent Identity Scope

The Runtime Layer must model every Brand Ambassador as a Brand Ambassador inside Team Magnificent.

### Required Identity Fields

Every BA-scoped runtime type, model, event, packet, outcome, journal entry, session, relationship context, guided action, transcript, candidate, and learning record must include:

```ts
teamId: string;
teamKey: "team_magnificent";
teamName: "Team Magnificent";
baId: string;
```

Where a record is not BA-scoped but belongs to the Team Magnificent app boundary, it must still include:

```ts
teamId: string;
teamKey: "team_magnificent";
teamName: "Team Magnificent";
```

### Identity Invariant

```text
No BA-scoped runtime record may exist without Team Magnificent scope.
```

---

## 7. Existing App Context to Preserve

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

The MVP internal agent surfaces live in the `.team` app.

The `.com` prospect surface is not the internal Runtime Agent surface.

---

## 8. Required Implementation Order

Implement in this order:

```text
001-A  Repo audit
001-B  Shared runtime types and Team Magnificent identity
001-C  Agent Event Model and outbox
001-D  Knowledge Core
001-E  Momentum Journal
001-F  Knowledge Ingestion
001-G  Context Packet Schema and Context Manager
001-H  Browser Voice Runtime
001-I  Agent Runtime backend
001-J  Agent UI routes
001-K  Learning Pipeline
001-L  Knowledge Evolution Runtime
001-M  Tests and QA
```

Do not skip Team Magnificent identity scope.

Do not implement Knowledge Evolution before candidates, events, and learning records exist.

---

## 9. Phase 001-A: Repo Audit

Create:

```text
implementation/audits/RUNTIME_MVP_REPO_AUDIT.md
```

Tasks:

- Locate server entry point.
- Locate Mongo/Mongoose setup.
- Locate existing Neo4j adapter or stub.
- Locate existing Chroma adapter or stub.
- Locate `.team` router.
- Locate existing `/ivory`.
- Locate existing `/michael/interview`.
- Locate existing `/invitations`.
- Locate existing `/cockpit`.
- Locate shared types package.
- Locate event service, if any.
- Locate journal-related code, if any.
- Locate existing learning/outcome code, if any.
- Confirm no Telnyx internal coaching path will be implemented.
- Identify where Team Magnificent identity fields should be added.
- Identify whether `/steve/interview` exists.
- Identify current package manager scripts.
- Identify current test framework.

Do not modify app code in this phase.

Acceptance:

- Audit file exists.
- Audit identifies exact paths to modify.
- Audit confirms no internal Telnyx coaching implementation.
- Audit identifies Team Magnificent identity insertion points.

---

## 10. Phase 001-B: Shared Runtime Types and Team Magnificent Identity

Create/update:

```text
packages/shared/src/runtime/team.ts
packages/shared/src/runtime/contextPacket.ts
packages/shared/src/runtime/agentEvents.ts
packages/shared/src/runtime/agentSession.ts
packages/shared/src/runtime/knowledge.ts
packages/shared/src/runtime/journal.ts
packages/shared/src/runtime/learning.ts
packages/shared/src/runtime/knowledgeEvolution.ts
packages/shared/src/runtime/browserVoice.ts
packages/shared/src/runtime/index.ts
```

Required shared types:

```ts
export type TeamKey = "team_magnificent";

export interface TeamMagnificentScope {
  teamId: string;
  teamKey: "team_magnificent";
  teamName: "Team Magnificent";
}

export interface BAScope extends TeamMagnificentScope {
  baId: string;
}

export type RuntimeLanguage = "en" | "es";

export type AgentKey = "steve_success" | "michael_magnificent" | "ivory";
```

Acceptance:

- `TeamMagnificentScope` exists.
- `BAScope` exists.
- `ContextPacketV1` exists.
- `AgentEventEnvelope` exists.
- `AgentKey` exists.
- `RuntimeLanguage` exists.
- Knowledge Evolution types exist.
- Shared runtime exports compile.
- All BA-scoped shared types include Team Magnificent scope.

---

## 11. Phase 001-C: Agent Event Model and Outbox

Create/update:

```text
server/src/runtime/events/event.types.ts
server/src/runtime/events/event.constants.ts
server/src/runtime/events/eventTaxonomy.ts
server/src/runtime/events/event.model.ts
server/src/runtime/events/eventOutbox.model.ts
server/src/runtime/events/eventSubscriberOffset.model.ts
server/src/runtime/events/eventReplayJob.model.ts
server/src/runtime/events/eventError.model.ts
server/src/runtime/events/event.service.ts
server/src/runtime/events/eventValidation.service.ts
server/src/runtime/events/eventPrivacy.service.ts
server/src/runtime/events/eventOutbox.service.ts
server/src/runtime/events/eventReplay.service.ts
server/src/runtime/events/routes.ts
```

Required collections:

```text
runtime_events
runtime_event_outbox
runtime_event_subscriber_offsets
runtime_event_replay_jobs
runtime_event_errors
```

Acceptance:

- Events persist in MongoDB.
- `eventId` is unique.
- `idempotencyKey` is unique.
- Events query by `sessionId`.
- Events query by `correlationId`.
- Events preserve Team Magnificent scope in payload or metadata when BA-scoped.
- Browser Voice events are internal.
- External runtime events are separate.
- Replay does not resend external communications.
- Runtime components use event service, not direct event collection writes.

---

## 12. Phase 001-D: Knowledge Core

Create/update:

```text
server/src/runtime/knowledge/knowledge.types.ts
server/src/runtime/knowledge/agentSession.model.ts
server/src/runtime/knowledge/conversationTurn.model.ts
server/src/runtime/knowledge/knowledgeCandidate.model.ts
server/src/runtime/knowledge/approvedKnowledge.model.ts
server/src/runtime/knowledge/knowledgeSource.model.ts
server/src/runtime/knowledge/knowledgeCore.service.ts
server/src/runtime/knowledge/chroma.adapter.ts
server/src/runtime/knowledge/neo4j.adapter.ts
server/src/runtime/knowledge/graphrag.service.ts
server/src/runtime/knowledge/routes.ts
```

Acceptance:

- Agent sessions persist.
- Conversation turns persist.
- Candidates persist.
- Approved knowledge persists.
- Knowledge sources persist.
- Team Magnificent scope is preserved for BA-derived knowledge.
- Chroma adapter exists as real adapter or safe stub.
- Neo4j adapter exists as real adapter or safe stub.
- GraphRAG service boundary exists.
- Agents do not access DB clients directly.
- Approved knowledge and candidate knowledge are separate.
- Active knowledge has lifecycle status and source traceability.

---

## 13. Phase 001-E: Momentum Journal

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

Journal entry categories:

```text
lesson
idea
question
observation
reflection
script
personal_strategy
voice_note
resource
reminder
other
```

Acceptance:

- BA can create private journal entries.
- Journal entries include Team Magnificent scope.
- Journal entries are private by default.
- Journal entries are not organizational knowledge.
- Selecting for review creates a Knowledge Candidate, not approved knowledge.
- Michael can create journal prompts.
- Private journal text is not put unnecessarily into runtime events.
- Another BA cannot access a BA journal entry.

---

## 14. Phase 001-F: Knowledge Ingestion

Create/update:

```text
server/src/runtime/ingestion/ingestion.types.ts
server/src/runtime/ingestion/capture.service.ts
server/src/runtime/ingestion/normalize.service.ts
server/src/runtime/ingestion/classify.service.ts
server/src/runtime/ingestion/segment.service.ts
server/src/runtime/ingestion/riskCheck.service.ts
server/src/runtime/ingestion/dedupe.service.ts
server/src/runtime/ingestion/candidate.service.ts
server/src/runtime/ingestion/reviewIndex.service.ts
server/src/runtime/ingestion/graphLineage.service.ts
server/src/runtime/ingestion/routes.ts
```

Acceptance:

- Session turns capture.
- Captures normalize.
- Captures classify.
- Captures segment.
- Risk flags attach before review.
- Dedupe runs before queue insertion.
- Candidates create with lineage and risk flags.
- Candidates default to review-only candidate status.
- Candidate creation is idempotent.
- Review-only Chroma indexing exists.
- Neo4j lineage edge creation exists.
- Journal entries become candidates only when selected or explicitly consented.
- Team Magnificent scope is preserved.

---

## 15. Phase 001-G: Context Packet Schema and Context Manager

Create/update:

```text
server/src/runtime/context/context.types.ts
server/src/runtime/context/contextManager.service.ts
server/src/runtime/context/requestValidator.service.ts
server/src/runtime/context/retrieval.service.ts
server/src/runtime/context/ranking.service.ts
server/src/runtime/context/budget.service.ts
server/src/runtime/context/contextPacket.model.ts
server/src/runtime/context/contextAudit.model.ts
server/src/runtime/context/routes.ts
```

Acceptance:

- `buildContextPacket()` returns `context_packet.v1`.
- Packet includes tenant, team, BA, session, agent, language, runtime rules, guardrails, approved knowledge, private context, journal context, relationship context, guided actions, exclusions, and retrieval audit.
- Team Magnificent scope appears in packet identity.
- Candidate knowledge is excluded by default.
- Private journal context is scoped to BA.
- Relationship context is BA-owned and person-sensitive.
- English packets work.
- Spanish packets work.
- Telnyx boundary is always present.
- Context Manager retrieves approved knowledge through Knowledge Core, not through agent direct DB access.
- Context Manager only retrieves Knowledge Evolution retrieval-ready active knowledge.

---

## 16. Phase 001-H: Browser Voice Runtime

Create/update:

```text
apps/team/src/runtime/browserVoice/browserVoice.types.ts
apps/team/src/runtime/browserVoice/browserVoiceController.ts
apps/team/src/runtime/browserVoice/browserVoiceStateMachine.ts
apps/team/src/runtime/browserVoice/useBrowserVoice.ts
apps/team/src/runtime/browserVoice/speechLanguage.ts
apps/team/src/runtime/browserVoice/browserVoiceEvents.ts
apps/team/src/runtime/browserVoice/transcriptUtils.ts
apps/team/src/runtime/browserVoice/browserVoiceErrors.ts

apps/team/src/components/runtime/BrowserAgentSession.tsx
apps/team/src/components/runtime/VoiceControls.tsx
apps/team/src/components/runtime/TranscriptPanel.tsx
apps/team/src/components/runtime/TextFallbackInput.tsx
apps/team/src/components/runtime/AgentResponsePanel.tsx
apps/team/src/components/runtime/LanguageSelector.tsx
apps/team/src/components/runtime/VoicePermissionMessage.tsx
apps/team/src/components/runtime/VoiceStatusIndicator.tsx
```

Acceptance:

- Support detection works.
- Microphone permission flow exists.
- Permission requested only after BA action.
- Text fallback always works.
- English/Spanish language selector exists.
- Final transcript submits to Agent Runtime.
- Interim transcripts do not create final turns.
- Agent response displays as text.
- Agent response may be spoken by browser TTS.
- Team Magnificent scope is preserved in transcript metadata.
- No Telnyx/PSTN path exists.
- Raw audio is not stored in MVP.

---

## 17. Phase 001-I: Agent Runtime Backend

Create/update:

```text
server/src/runtime/agents/agent.registry.ts
server/src/runtime/agents/agent.types.ts
server/src/runtime/agents/agentRuntime.service.ts
server/src/runtime/agents/agentSession.service.ts
server/src/runtime/agents/agentTurn.service.ts
server/src/runtime/agents/agentStateMachine.service.ts
server/src/runtime/agents/agentTemplate.service.ts
server/src/runtime/agents/outputGuardrails.ts
server/src/runtime/agents/routes.ts

server/src/runtime/agents/templates/steve.en.ts
server/src/runtime/agents/templates/steve.es.ts
server/src/runtime/agents/templates/michael.en.ts
server/src/runtime/agents/templates/michael.es.ts
server/src/runtime/agents/templates/ivory.en.ts
server/src/runtime/agents/templates/ivory.es.ts

server/src/runtime/agents/ivory/createRelationshipContext.tool.ts
server/src/runtime/agents/ivory/prepareEditableInvitationDraft.tool.ts
server/src/runtime/agents/ivory/mintInvitationLinkIfApprovedByBA.tool.ts
```

Acceptance:

- Sessions can be created for Steve, Michael, and Ivory.
- Each agent has English and Spanish templates.
- Turns transition state.
- Agents request Context Packets.
- Failed Context Packets block substantive guidance.
- Degraded Context Packets use safe fallback.
- Agents can create journal prompts.
- Agents can propose candidates.
- Agents cannot approve candidates.
- Ivory can create editable invitation drafts.
- Ivory cannot auto-send outreach.
- Guardrails block auto-send language.
- Guardrails block Telnyx internal voice behavior.
- All agent sessions include Team Magnificent scope.

---

## 18. Phase 001-J: Agent UI Routes

Create/update/adapt:

```text
apps/team/src/routes/michael/interview.tsx
apps/team/src/routes/ivory/index.tsx
apps/team/src/routes/steve/interview.tsx
```

Acceptance:

- Michael runs training support.
- Michael teaches Momentum Journal.
- Ivory runs relationship coaching.
- Ivory creates editable invitation drafts.
- Steve runs success interview.
- Transcript is visible.
- Text fallback is visible.
- Journal prompt appears when returned.
- Invitation draft card appears when returned by Ivory.
- Guided action card appears when returned.
- Language selection works.
- Team Magnificent runtime scope is attached to session requests.

---

## 19. Phase 001-K: Learning Pipeline

Create/update:

```text
server/src/runtime/learning/learning.types.ts
server/src/runtime/learning/learning.constants.ts

server/src/runtime/learning/models/LearningOutcome.model.ts
server/src/runtime/learning/models/LearningSignal.model.ts
server/src/runtime/learning/models/LearningPattern.model.ts
server/src/runtime/learning/models/LearningCandidateProposal.model.ts
server/src/runtime/learning/models/LearningMetricsSnapshot.model.ts

server/src/runtime/learning/services/LearningPipeline.service.ts
server/src/runtime/learning/services/OutcomeService.ts
server/src/runtime/learning/services/LearningSignalService.ts
server/src/runtime/learning/services/PatternDetectionService.ts
server/src/runtime/learning/services/CandidateProposalService.ts
server/src/runtime/learning/services/LearningMetricsService.ts
server/src/runtime/learning/services/LearningGraphService.ts

server/src/runtime/learning/rules/repeatQuestion.rule.ts
server/src/runtime/learning/rules/successfulActionPattern.rule.ts
server/src/runtime/learning/rules/failedActionPattern.rule.ts
server/src/runtime/learning/rules/journalAdoption.rule.ts
server/src/runtime/learning/rules/voiceRuntimeFriction.rule.ts
server/src/runtime/learning/rules/bilingualParityGap.rule.ts

server/src/runtime/learning/routes.ts
```

Acceptance:

- Outcomes can be recorded.
- Outcomes include Team Magnificent scope.
- Learning signals can be created.
- Signals link to sessions, events, candidates, knowledge, and actions.
- Pattern detection may be rules-based.
- Learning proposes candidates but does not approve them.
- Learning does not mine private journal entries unless selected.
- English and Spanish learning records work.
- Learning emits events.
- Metrics can be calculated.

---

## 20. Phase 001-L: Knowledge Evolution Runtime

Create/update:

```text
server/src/runtime/knowledge-evolution/knowledgeEvolution.types.ts
server/src/runtime/knowledge-evolution/knowledgeEvolution.constants.ts

server/src/runtime/knowledge-evolution/models/KnowledgeEvolutionRecord.model.ts
server/src/runtime/knowledge-evolution/models/KnowledgeEvolutionPlan.model.ts
server/src/runtime/knowledge-evolution/models/KnowledgeEvolutionVersion.model.ts
server/src/runtime/knowledge-evolution/models/KnowledgeSupersessionRecord.model.ts
server/src/runtime/knowledge-evolution/models/KnowledgeRetrievalRollout.model.ts
server/src/runtime/knowledge-evolution/models/KnowledgeLanguageEvolutionRecord.model.ts
server/src/runtime/knowledge-evolution/models/KnowledgeRollbackPlan.model.ts
server/src/runtime/knowledge-evolution/models/KnowledgeEvolutionError.model.ts
server/src/runtime/knowledge-evolution/models/KnowledgeEvolutionMetrics.model.ts

server/src/runtime/knowledge-evolution/services/KnowledgeEvolution.service.ts
server/src/runtime/knowledge-evolution/services/EvolutionPlan.service.ts
server/src/runtime/knowledge-evolution/services/EvolutionApproval.service.ts
server/src/runtime/knowledge-evolution/services/EvolutionVersion.service.ts
server/src/runtime/knowledge-evolution/services/Supersession.service.ts
server/src/runtime/knowledge-evolution/services/Archive.service.ts
server/src/runtime/knowledge-evolution/services/RetrievalRollout.service.ts
server/src/runtime/knowledge-evolution/services/EvolutionRollback.service.ts
server/src/runtime/knowledge-evolution/services/EvolutionMetrics.service.ts

server/src/runtime/knowledge-evolution/workers/approvedCandidateEvolution.worker.ts
server/src/runtime/knowledge-evolution/workers/approvedTranslationEvolution.worker.ts
server/src/runtime/knowledge-evolution/workers/supersessionEvolution.worker.ts
server/src/runtime/knowledge-evolution/workers/archiveEvolution.worker.ts
server/src/runtime/knowledge-evolution/workers/reindexEvolution.worker.ts
server/src/runtime/knowledge-evolution/workers/graphSyncEvolution.worker.ts

server/src/runtime/knowledge-evolution/routes.ts
```

Acceptance:

- Approved candidates can become active Knowledge Objects.
- Approval reference is required.
- Source traceability is preserved.
- Version records are created.
- Team Magnificent scope is preserved.
- Supersession works.
- Archival works.
- Chroma reindex coordination exists.
- Neo4j graph sync coordination exists.
- Retrieval-ready status is required before Context Manager can retrieve evolved knowledge.
- Rollback plan exists for retrieval-affecting changes.
- English and Spanish knowledge evolution works.
- Unreviewed machine translation cannot become active.
- Knowledge Evolution does not approve knowledge.
- Knowledge Evolution does not let agents self-modify.
- Knowledge Evolution does not use Telnyx.

---

## 21. Phase 001-M: Tests and QA

Create/update:

```text
server/src/runtime/__tests__/agentRuntime.test.ts
server/src/runtime/__tests__/contextPacket.test.ts
server/src/runtime/__tests__/knowledgeIngestion.test.ts
server/src/runtime/__tests__/journal.test.ts
server/src/runtime/__tests__/learningPipeline.test.ts
server/src/runtime/__tests__/knowledgeEvolution.test.ts
server/src/runtime/__tests__/teamMagnificentScope.test.ts
server/src/runtime/__tests__/runtimeBoundary.test.ts
apps/team/src/runtime/browserVoice/__tests__/browserVoiceController.test.ts
```

Required tests:

- Agent session creates.
- Context Packet validates.
- Journal privacy is enforced.
- Selected journal entry creates candidate only.
- Candidate is not approved knowledge.
- Approved candidate can become active only through Knowledge Evolution.
- Knowledge Evolution requires approval reference.
- Supersession excludes old knowledge from normal retrieval.
- Retrieval-ready status blocks incomplete evolution.
- Team Magnificent scope exists wherever `baId` exists.
- Telnyx internal voice is blocked.
- English and Spanish templates exist.
- Browser Voice text fallback works.
- Ivory drafts are editable and not auto-sent.
- Learning Pipeline cannot approve knowledge.
- Knowledge Evolution cannot approve knowledge.

---

## 22. API Route Map

```text
POST   /api/runtime/events
GET    /api/runtime/events/session/:sessionId
GET    /api/runtime/events/correlation/:correlationId
POST   /api/runtime/events/replay/session/:sessionId
POST   /api/runtime/events/replay/correlation/:correlationId

POST   /api/runtime/agents/:agentKey/sessions
GET    /api/runtime/agents/:agentKey/sessions/:sessionId
POST   /api/runtime/agents/:agentKey/sessions/:sessionId/turns
POST   /api/runtime/agents/:agentKey/sessions/:sessionId/complete
POST   /api/runtime/agents/ivory/sessions/:sessionId/invitation-draft

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
POST   /api/runtime/learning/signals/:signalId/triage
POST   /api/runtime/learning/signals/:signalId/create-candidate
GET    /api/runtime/learning/metrics

POST   /api/runtime/knowledge-evolution
GET    /api/runtime/knowledge-evolution/:evolutionId
POST   /api/runtime/knowledge-evolution/:evolutionId/retrieval-ready
POST   /api/runtime/knowledge-evolution/:evolutionId/rollback
GET    /api/runtime/knowledge-evolution/metrics
```

---

## 23. Environment Variables

```env
MONGODB_URI=
NEO4J_URI=
NEO4J_USERNAME=
NEO4J_PASSWORD=
CHROMA_URL=

RUNTIME_EVENT_OUTBOX_ENABLED=true
RUNTIME_BROWSER_VOICE_ENABLED=true
RUNTIME_INTERNAL_TELNYX_DISABLED=true

RUNTIME_TEAM_ID=team_magnificent
RUNTIME_TEAM_KEY=team_magnificent
RUNTIME_TEAM_NAME=Team Magnificent

RUNTIME_KNOWLEDGE_EVOLUTION_ENABLED=true
RUNTIME_KNOWLEDGE_EVOLUTION_REQUIRE_APPROVAL=true
RUNTIME_CONTEXT_REQUIRE_RETRIEVAL_READY=true
```

Do not add Telnyx requirements for internal coaching agents.

---

## 24. Runtime Acceptance Gates

### 24.1 Team Magnificent Gate

- `teamId`, `teamKey`, and `teamName` exist where BA-scoped records exist.
- `teamKey` equals `team_magnificent`.
- All BA records are scoped to Team Magnificent.
- Runtime events preserve Team Magnificent scope in payload or metadata.
- Learning and Knowledge Evolution records preserve Team Magnificent scope.

### 24.2 Agent Runtime Gate

- Steve sessions can be created.
- Michael sessions can be created.
- Ivory sessions can be created.
- Each agent receives a Context Packet.
- Each agent supports English and Spanish.
- Each agent supports Browser Voice and Browser Text fallback.
- Agent output guardrails run before responses are returned.

### 24.3 Knowledge Gate

- Knowledge Core stores canonical knowledge.
- Knowledge Ingestion captures raw runtime experience.
- Knowledge Candidates are review-only.
- Approved knowledge is separate from candidates.
- Personal journal knowledge remains private unless selected.
- Source traceability is preserved.

### 24.4 Context Gate

- Context Manager builds `context_packet.v1`.
- Agents do not retrieve knowledge directly.
- Approved knowledge retrieval works.
- Private context is BA-scoped.
- Relationship context is BA-owned and person-sensitive.
- Exclusions and retrieval audit are preserved.
- Retrieval-ready Knowledge Evolution status is honored.

### 24.5 Browser Runtime Gate

- Browser Voice support detection works.
- Text fallback always works.
- Microphone permission is requested only after BA action.
- Final transcripts submit to Agent Runtime.
- Agent responses display as text.
- Agent responses may be spoken through browser TTS.
- No Telnyx/PSTN code path is used for internal coaching.

### 24.6 Journal Gate

- Momentum Journal is private by default.
- Michael teaches Momentum Journal usage.
- Journal entries can be created.
- Selected journal entries can become Knowledge Candidates.
- Journal entries do not automatically become organizational knowledge.

### 24.7 Event Gate

- Runtime events are emitted consistently.
- Event schema `agent_event.v1` is enforced.
- Idempotency is enforced.
- Correlation IDs connect related runtime activity.
- Event payloads avoid unnecessary private text.
- Outbox supports asynchronous workers.

### 24.8 Learning Gate

- Outcomes can be recorded.
- Learning signals can be created.
- Learning signals link to events, sessions, candidates, knowledge, and actions.
- Pattern detection can propose candidates.
- Review remains separate from learning automation.
- Private journal entries are excluded unless selected.
- English and Spanish learning records are supported.

### 24.9 Knowledge Evolution Gate

- Approved candidates can become active Knowledge Objects.
- Approval reference is required.
- Version records are created.
- Chroma reindex coordination exists.
- Neo4j graph sync coordination exists.
- Retrieval rollout exists.
- Context Manager retrieves only retrieval-ready evolved knowledge.
- Supersession works.
- Archival works.
- Rollback works.
- Knowledge Evolution does not approve knowledge.

---

## 25. Codex Execution Prompt

Use this prompt for Codex:

```text
You are implementing Momentum Creation System V2 Phase 2 Runtime Layer.

Read these files first:

- /runtime/README.md
- /runtime/KNOWLEDGE_CORE_RUNTIME.md
- /runtime/KNOWLEDGE_INGESTION_PROTOCOL.md
- /runtime/CONTEXT_MANAGER.md
- /runtime/CONTEXT_PACKET_SCHEMA.md
- /runtime/AGENT_RUNTIME.md
- /runtime/AGENT_EVENT_MODEL.md
- /runtime/BROWSER_VOICE_RUNTIME.md
- /runtime/LEARNING_PIPELINE.md
- /runtime/KNOWLEDGE_EVOLUTION_RUNTIME.md
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

Team Magnificent identity scope is mandatory.

Every BA-scoped runtime record must include:
- teamId
- teamKey: "team_magnificent"
- teamName: "Team Magnificent"
- baId

Knowledge Evolution safely turns approved candidates and approved refinements into active, versioned, indexed, graph-linked, retrieval-ready knowledge.

Knowledge Evolution does not approve knowledge.
Knowledge Evolution does not bypass review.
Knowledge Evolution does not mine private journals.
Knowledge Evolution does not let agents self-modify.

Start with Phase 001-A repo audit.

After each implementation phase run:
- pnpm typecheck
- pnpm build
- git status --short --branch
```

---

## 26. Definition of Done

Package 001 is done when:

- Runtime docs are placed in repo.
- Shared types compile.
- Team Magnificent scope is implemented.
- Event model works.
- Knowledge Core service exists.
- Journal runtime preserves privacy.
- Ingestion creates candidates, not approved knowledge.
- Context Manager creates `context_packet.v1`.
- Browser Voice and text fallback work.
- Steve, Michael, and Ivory have English and Spanish templates.
- Michael teaches Momentum Journal.
- Ivory creates editable drafts.
- Learning outcomes and signals can be recorded.
- Knowledge Evolution turns approved candidates into active, retrieval-ready knowledge.
- Supersession and archival work.
- Context Manager honors retrieval-ready status.
- Typecheck passes.
- Build passes.
- Telnyx is not used for internal coaching voice.

---

## 27. Final Implementation Statement

This package implements the first working Runtime MVP for Team Magnificent.

It establishes Team Magnificent identity scope.

It gives Steve, Michael, and Ivory browser voice and text runtime.

It gives every Brand Ambassador a private Momentum Journal.

It creates review-only Knowledge Candidates.

It builds Context Packets.

It records runtime events.

It captures outcomes.

It creates learning signals.

It evolves approved learning into active knowledge through Knowledge Evolution.

It closes the loop from experience to organizational learning without bypassing governance.

The agent guides.

The Brand Ambassador acts.

The outcome teaches.

The Learning Pipeline observes.

Knowledge Evolution safely applies approved learning.

The Knowledge Core grows.

Momentum improves.
