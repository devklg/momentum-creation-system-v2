# Context Manager

Status: Canonical runtime source-of-truth  
Layer: `/runtime`

## Purpose

The Context Manager builds the structured context packet used by Steve Success, Michael Magnificent, and Ivory. Agents do not search every database directly. They request a packet.

The Context Manager decides what approved knowledge is relevant, what private context is allowed, what language should be used, what template applies, what guardrails must be included, and what should be excluded.

## Flow

```text
Agent Runtime
  -> Context Manager
  -> Knowledge Core Service
      -> Mongo filters
      -> Chroma semantic search
      -> Neo4j graph traversal
  -> Context scoring
  -> Context Packet
  -> Agent Runtime
```

## Request contract

```ts
interface ContextRequest {
  requestId: string;
  tenantId: string;
  baId: string;
  sessionId: string;
  agentKey: 'steve_success' | 'michael_magnificent' | 'ivory';
  language: 'en' | 'es';
  mode: 'browser_voice' | 'text' | 'mixed';
  taskType:
    | 'success_interview'
    | 'training_support'
    | 'journal_teaching'
    | 'relationship_coaching'
    | 'invitation_drafting'
    | 'session_resume'
    | 'guided_action_review';
  userInput?: string;
  currentState?: string;
  requestedScopes: ContextScope[];
  maxTokens?: number;
  includePrivateJournal?: boolean;
  includeCandidates?: boolean;
}
```

```ts
type ContextScope =
  | 'agent_instructions'
  | 'approved_knowledge'
  | 'ba_profile'
  | 'session_history'
  | 'private_journal'
  | 'relationship_context'
  | 'training_templates'
  | 'interview_templates'
  | 'guided_actions'
  | 'compliance_boundaries';
```

## Required packet sections

The Context Manager returns `context_packet.v1` as defined in `/runtime/CONTEXT_PACKET_SCHEMA.md`.

Minimum sections: tenant, BA, session, agent, language, runtime rules, guardrails, active interview template, approved knowledge, private context, journal context, relationship context, guided actions, exclusions, retrieval audit.

## Retrieval layers

1. Mandatory runtime context: agent identity, session language, Telnyx boundary, journal privacy, BA-owned action rule, active template state.
2. Agent-domain knowledge: Steve retrieves `success`, Michael retrieves `training`, Ivory retrieves `relationship`.
3. Cross-domain support: allowed only when relevant.
4. Private BA context: current session summary, BA-owned journal snippets, BA-entered relationship context, guided action history.
5. Outcome-linked knowledge: outcome-validated knowledge may be ranked higher.

## Ranking

```ts
interface RetrievalScore {
  semanticSimilarity: number;
  graphRelevance: number;
  domainMatch: number;
  languageMatch: number;
  outcomeUsefulness: number;
  safetyScore: number;
  finalScore: number;
}
```

MVP may use simpler rules, but every included item must include source ID and reason codes.

```ts
type RetrievalReasonCode =
  | 'same_agent_domain'
  | 'same_language'
  | 'active_interview_template'
  | 'related_to_current_state'
  | 'ba_owned_private_context'
  | 'relationship_context_match'
  | 'journal_instruction_required'
  | 'outcome_validated'
  | 'graph_neighbor'
  | 'semantic_match'
  | 'fallback_general_training';
```

## Context budget

| Section | MVP maximum |
|---|---:|
| Active template | 1 |
| Approved knowledge | 5-8 |
| Recent session turns | 8-12 |
| Private journal snippets | 3 |
| Relationship contexts | 3 |
| Guided actions | 3 |

Prefer summaries over full transcripts.

## Privacy rules

Organizational knowledge must be `active`. Candidate knowledge is excluded by default. Private journal context requires BA ownership and explicit request. Relationship context is BA-owned and person-sensitive.

## Bilingual behavior

Language priority:

```text
1. Same-language approved knowledge
2. Human-reviewed translation
3. Marked machine translation
4. Language-neutral template
5. Ask clarifying question
```

## Agent-specific context rules

Steve includes success interview template, recent success/action context, approved success knowledge, and journal prompt options.

Michael includes training support template, Momentum Journal teaching knowledge, onboarding state, current system action, and approved training knowledge.

Ivory includes relationship coaching template, BA-provided relationship context, invitation tone principles, editable draft guardrails, and invitation spine state when needed.

## Service interface

```ts
interface ContextManagerService {
  buildContextPacket(request: ContextRequest): Promise<ContextPacketV1>;
  retrieveApprovedKnowledge(request: ContextRetrievalRequest): Promise<ContextKnowledgeItem[]>;
  retrievePrivateJournalContext(request: PrivateJournalContextRequest): Promise<PrivateJournalContextItem[]>;
  retrieveRelationshipContext(request: RelationshipContextRequest): Promise<RelationshipContextItem[]>;
  recordContextPacket(packet: ContextPacketV1): Promise<void>;
  emitContextEvents(packet: ContextPacketV1): Promise<void>;
}
```

## Events

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

## Failure behavior

If retrieval fails, return mandatory runtime context and active template if available, mark packet as degraded, instruct the agent to ask clarifying questions, emit degraded/failed event, and do not invent knowledge.

## Acceptance criteria

Agents get context through the Context Manager; approved knowledge retrieval works; private journal retrieval is scoped to the BA; candidate knowledge is excluded by default; English and Spanish packets work; source IDs and reason codes are preserved; Telnyx boundary is always present.
