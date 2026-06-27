# Agent Runtime

Status: Canonical runtime source-of-truth  
Layer: `/runtime`

## Purpose

The Agent Runtime defines how Steve Success, Michael Magnificent, and Ivory operate inside Momentum Creation System V2.

Agents receive browser voice or text, request Context Packets, follow bilingual templates, guide Brand Ambassadors, create journal prompts, prepare editable outputs, propose Knowledge Candidates, and emit events.

## Agent registry

| Agent key | Display name | Domain | MVP role |
|---|---|---|---|
| `steve_success` | Steve Success | `success` | success interview, lesson capture, next action |
| `michael_magnificent` | Michael Magnificent | `training` | training support, onboarding, Momentum Journal teaching |
| `ivory` | Ivory | `relationship` | relationship coaching, editable invitation drafts |

## Non-negotiable runtime rules

Agents do not own knowledge, approve knowledge, auto-send prospect outreach, use Telnyx PSTN for internal coaching, bypass the Context Manager, or write directly to Chroma/Neo4j without service layers.

Agents support English and Spanish.

## Runtime loop

```text
BA opens session -> Browser Runtime starts voice/text -> Agent Runtime creates session -> Context Manager builds packet -> Agent asks template question -> BA responds -> Turn is captured -> State advances -> Journal/candidate/action may be created -> Agent closes or continues
```

## Session model

```ts
interface AgentRuntimeSessionState {
  sessionId: string;
  tenantId: string;
  baId: string;
  agentKey: 'steve_success' | 'michael_magnificent' | 'ivory';
  language: 'en' | 'es';
  mode: 'browser_voice' | 'text' | 'mixed';
  status: 'created' | 'active' | 'paused' | 'completed' | 'failed' | 'cancelled';
  currentTemplateId: string;
  currentStateKey: string;
  capturedFields: Record<string, unknown>;
  contextPacketId?: string;
  turnCount: number;
  startedAt: Date;
  updatedAt: Date;
  completedAt?: Date;
}
```

## Shared agent tools

```ts
interface RuntimeAgentTools {
  buildContextPacket(input: ContextRequest): Promise<ContextPacketV1>;
  appendConversationTurn(input: AppendConversationTurnInput): Promise<void>;
  createJournalEntry(input: CreateJournalEntryInput): Promise<MomentumJournalEntry>;
  createKnowledgeCandidate(input: CreateKnowledgeCandidateInput): Promise<KnowledgeCandidate>;
  createGuidedAction(input: CreateGuidedActionInput): Promise<GuidedAction>;
  emitAgentEvent(input: AgentEventInput): Promise<void>;
  completeSession(input: CompleteSessionInput): Promise<AgentSession>;
}
```

## Ivory tools

```ts
interface IvoryTools extends RuntimeAgentTools {
  createRelationshipContext(input: CreateRelationshipContextInput): Promise<RelationshipContext>;
  prepareEditableInvitationDraft(input: PrepareInvitationDraftInput): Promise<InvitationDraft>;
  mintInvitationLinkIfApprovedByBA(input: MintInvitationLinkInput): Promise<InvitationLink>;
}
```

## Interview template structure

```ts
interface AgentInterviewTemplate {
  templateId: string;
  agentKey: 'steve_success' | 'michael_magnificent' | 'ivory';
  language: 'en' | 'es';
  version: number;
  title: string;
  states: AgentTemplateState[];
}

interface AgentTemplateState {
  stateKey: string;
  prompt: string;
  purpose: string;
  captureFields: string[];
  transitions: AgentStateTransition[];
  allowedTools: string[];
}
```

## Steve Success

Mission: help the BA capture success, learn from it, and choose the next action.

States:

```text
welcome
capture_win_or_obstacle
clarify_context
extract_lesson
choose_next_action
journal_reflection_offer
knowledge_candidate_offer
session_summary
close_session
```

English starter prompt:

```text
Welcome. Tell me one thing that happened recently that we should learn from: a win, a breakthrough, an obstacle, or a conversation.
```

Spanish starter prompt:

```text
Bienvenido. Cuéntame algo reciente de lo que debemos aprender: una victoria, un avance, un obstáculo o una conversación.
```

## Michael Magnificent

Mission: teach and support the BA, especially around onboarding, system use, and the Momentum Journal.

States:

```text
welcome
identify_training_need
teach_momentum_journal
journal_practice_prompt
answer_system_question
guide_next_system_action
knowledge_candidate_offer
session_summary
close_session
```

Michael must teach that the Momentum Journal is the BA's private place to capture lessons learned, ideas, questions, observations, reflections, scripts, and reminders. Selected entries may be submitted for review as Knowledge Candidates.

## Ivory

Mission: help the BA think relationally, invite respectfully, and prepare editable invitation drafts.

States:

```text
welcome
who_came_to_mind
relationship_context
why_now
tone_and_channel
draft_invitation
ba_review_and_edit
optional_invitation_link
journal_or_candidate_offer
session_summary
close_session
```

Ivory must ask who came to mind, capture relationship, capture why now, ask tone/channel if needed, create short editable drafts, avoid pressure, avoid auto-send, and keep BA ownership clear.

```ts
interface InvitationDraft {
  draftId: string;
  baId: string;
  relationshipContextId: string;
  language: 'en' | 'es';
  channel: 'text' | 'phone' | 'email' | 'in_person';
  tone: 'warm' | 'direct' | 'professional' | 'gentle' | 'casual';
  body: string;
  editable: true;
  needsBAReview: true;
  createdAt: Date;
}
```

## APIs

```text
POST /api/runtime/agents/:agentKey/sessions
GET  /api/runtime/agents/:agentKey/sessions/:sessionId
POST /api/runtime/agents/:agentKey/sessions/:sessionId/turns
POST /api/runtime/agents/:agentKey/sessions/:sessionId/complete
POST /api/runtime/agents/ivory/sessions/:sessionId/invitation-draft
```

## Agent response contract

```ts
interface AgentTurnResponse {
  sessionId: string;
  agentKey: 'steve_success' | 'michael_magnificent' | 'ivory';
  language: 'en' | 'es';
  stateKey: string;
  message: string;
  outputMode: 'text' | 'voice_text';
  suggestedActions: SuggestedAction[];
  createdJournalEntryId?: string;
  createdKnowledgeCandidateId?: string;
  createdInvitationDraftId?: string;
  eventIds: string[];
}
```

## Output guardrails

Before returning output, validate no auto-send language, no Telnyx internal call behavior, no candidate-as-approved claims, no unapproved medical/income claims, correct language, correct agent role, and journal privacy.

## Suggested files

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
apps/team/src/routes/steve/interview.tsx
apps/team/src/routes/michael/interview.tsx
apps/team/src/routes/ivory/index.tsx
```

## Acceptance criteria

Steve, Michael, and Ivory sessions can be created; each agent gets a Context Packet; each agent runs in browser voice and text fallback; each agent has English and Spanish templates; Michael teaches the Momentum Journal; Ivory creates editable drafts only; Steve captures success lessons and next actions; events are emitted; agents may propose candidates but cannot approve them.
