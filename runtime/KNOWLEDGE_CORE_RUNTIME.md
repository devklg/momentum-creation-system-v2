# Knowledge Core Runtime

Status: Canonical runtime source-of-truth  
Layer: `/runtime`

## Purpose

The Knowledge Core Runtime defines the shared implementation layer for storing, retrieving, relating, and improving Momentum knowledge. The Knowledge Core belongs to Momentum. Agents create, retrieve, and propose knowledge, but they do not own it.

## Domains

| Domain | Primary creator | Contents |
|---|---|---|
| `success` | Steve Success | wins, breakthroughs, field lessons, obstacles, next actions, momentum patterns |
| `training` | Michael Magnificent | onboarding explanations, how-to knowledge, journal training, system guidance |
| `relationship` | Ivory | invitation principles, relationship context, tone guidance, editable script patterns |

## Lifecycle

```text
Raw Input -> Capture -> Normalize -> Candidate -> Review -> Approved Knowledge -> Chroma Index -> Neo4j Graph -> Runtime Retrieval -> Guided Action -> Outcome -> Learning Update
```

## Status values

```ts
type KnowledgeStatus =
  | 'captured'
  | 'normalized'
  | 'candidate'
  | 'under_review'
  | 'approved'
  | 'rejected'
  | 'archived'
  | 'superseded';
```

## Store strategy

### MongoDB + Mongoose

Mongo is the operational source of truth for agent sessions, conversation turns, Momentum Journal entries, knowledge candidates, approved knowledge, review decisions, runtime events, context packet audit records, learning outcomes, and learning signals.

### Chroma

Chroma stores retrieval-ready chunks. Chroma is never the source of truth. Every Chroma document references a Mongo source ID.

Collections:

```text
mcs_approved_success_knowledge
mcs_approved_training_knowledge
mcs_approved_relationship_knowledge
mcs_candidate_knowledge_review
mcs_session_summaries
mcs_journal_private_index
```

Private journal embeddings must include `baId` and must only be retrieved for that same BA.

### Neo4j

Neo4j stores lineage and relationships:

```cypher
(:BA)-[:OWNS]->(:JournalEntry)
(:BA)-[:PARTICIPATED_IN]->(:AgentSession)
(:Agent)-[:RAN]->(:AgentSession)
(:AgentSession)-[:PRODUCED]->(:KnowledgeCandidate)
(:JournalEntry)-[:SELECTED_AS]->(:KnowledgeCandidate)
(:KnowledgeCandidate)-[:APPROVED_AS]->(:Knowledge)
(:Knowledge)-[:DERIVED_FROM]->(:KnowledgeCandidate)
(:Knowledge)-[:SUPPORTS]->(:GuidedAction)
(:GuidedAction)-[:PRODUCED]->(:Outcome)
(:Outcome)-[:VALIDATES|WEAKENS|REFINES]->(:Knowledge)
(:Knowledge)-[:RELATED_TO|SUPERSEDES]->(:Knowledge)
(:Knowledge)-[:ABOUT]->(:Concept)
```

### GraphRAG

GraphRAG combines Mongo operational filters, Chroma semantic retrieval, Neo4j graph traversal, and Context Manager budget/safety rules.

## Canonical models

### AgentSession

```ts
interface AgentSession {
  sessionId: string;
  tenantId: string;
  baId: string;
  agentKey: 'steve_success' | 'michael_magnificent' | 'ivory';
  language: 'en' | 'es';
  mode: 'browser_voice' | 'text' | 'mixed';
  status: 'created' | 'active' | 'paused' | 'completed' | 'failed' | 'cancelled';
  currentState?: string;
  contextPacketId?: string;
  summary?: string;
  createdKnowledgeCandidateIds: string[];
  createdJournalEntryIds: string[];
  createdAt: Date;
  updatedAt: Date;
}
```

### ConversationTurn

```ts
interface ConversationTurn {
  turnId: string;
  sessionId: string;
  tenantId: string;
  baId: string;
  speaker: 'ba' | 'agent' | 'system';
  inputMode: 'voice' | 'text' | 'system';
  language: 'en' | 'es';
  originalText: string;
  normalizedText?: string;
  confidence?: number;
  timestamp: Date;
}
```

### MomentumJournalEntry

```ts
interface MomentumJournalEntry {
  journalEntryId: string;
  tenantId: string;
  baId: string;
  source: 'manual' | 'michael_prompt' | 'steve_prompt' | 'ivory_prompt' | 'session_reflection';
  language: 'en' | 'es';
  title?: string;
  body: string;
  category: 'lesson' | 'idea' | 'question' | 'observation' | 'reflection' | 'script' | 'reminder' | 'other';
  tags: string[];
  visibility: 'private_to_ba' | 'selected_for_review' | 'approved_org_knowledge' | 'archived';
  knowledgeCandidateId?: string;
  createdAt: Date;
  updatedAt: Date;
}
```

### KnowledgeCandidate

```ts
interface KnowledgeCandidate {
  candidateId: string;
  tenantId: string;
  domain: 'success' | 'training' | 'relationship';
  sourceType: 'agent_session' | 'journal_entry' | 'knowledge_session' | 'manual_import' | 'outcome_review';
  sourceId: string;
  createdByAgentKey?: 'steve_success' | 'michael_magnificent' | 'ivory';
  createdByBaId?: string;
  language: 'en' | 'es';
  title: string;
  summary: string;
  body: string;
  tags: string[];
  confidence: number;
  riskFlags: string[];
  status: 'candidate' | 'under_review' | 'approved' | 'rejected' | 'archived';
  approvedKnowledgeId?: string;
  createdAt: Date;
  updatedAt: Date;
}
```

### ApprovedKnowledge

```ts
interface ApprovedKnowledge {
  knowledgeId: string;
  tenantId: string;
  domain: 'success' | 'training' | 'relationship';
  language: 'en' | 'es';
  title: string;
  canonicalSummary: string;
  body: string;
  tags: string[];
  status: 'active' | 'archived' | 'superseded';
  sourceCandidateId?: string;
  version: number;
  supersedesKnowledgeId?: string;
  approvedBy: string;
  approvedAt: Date;
  retrieval: { shouldIndex: boolean; chromaCollection?: string; indexedAt?: Date };
  graph: { nodeCreated: boolean; edgesCreated: string[] };
}
```

## Service interface

Agents must use this service boundary instead of raw database clients:

```ts
interface KnowledgeCoreService {
  createAgentSession(input: CreateAgentSessionInput): Promise<AgentSession>;
  appendConversationTurn(input: AppendConversationTurnInput): Promise<ConversationTurn>;
  createJournalEntry(input: CreateJournalEntryInput): Promise<MomentumJournalEntry>;
  selectJournalEntryForReview(input: SelectJournalEntryInput): Promise<KnowledgeCandidate>;
  createKnowledgeCandidate(input: CreateKnowledgeCandidateInput): Promise<KnowledgeCandidate>;
  approveKnowledgeCandidate(input: ApproveKnowledgeCandidateInput): Promise<ApprovedKnowledge>;
  rejectKnowledgeCandidate(input: RejectKnowledgeCandidateInput): Promise<KnowledgeCandidate>;
  retrieveKnowledge(input: RetrieveKnowledgeInput): Promise<RetrievedKnowledgeResult[]>;
  indexKnowledge(input: IndexKnowledgeInput): Promise<void>;
  createKnowledgeGraphEdges(input: CreateKnowledgeGraphEdgesInput): Promise<void>;
}
```

## Retrieval rules

Retrieval honors tenant scope, BA privacy scope, agent domain, language, approved status, version/supersession, context budget, and safety flags.

Private journal entries are retrieved only when the BA owns the entry and the Context Manager explicitly requests private journal context.

## Write consistency

Use operational write first, then async indexing/graph updates:

```text
Mongo write -> runtime event -> outbox job -> Chroma index job -> Neo4j graph job -> projection update
```

If Chroma or Neo4j fails, preserve Mongo source records and mark indexing/graph status as failed or pending.

## APIs

```text
POST   /api/runtime/agent-sessions
POST   /api/runtime/agent-sessions/:sessionId/turns
POST   /api/runtime/journal
GET    /api/runtime/journal
POST   /api/runtime/journal/:journalEntryId/select-for-review
POST   /api/runtime/knowledge-candidates
GET    /api/runtime/knowledge-candidates
POST   /api/runtime/knowledge-candidates/:candidateId/approve
POST   /api/runtime/knowledge-candidates/:candidateId/reject
GET    /api/runtime/knowledge/:knowledgeId
POST   /api/runtime/knowledge/retrieve
```

## Acceptance criteria

Agents use service interfaces; journal entries are private by default; candidates can be created from sessions and selected journal entries; candidates are not approved knowledge; approved knowledge indexes into Chroma; lineage edges are created in Neo4j; retrieval returns source IDs, domain, language, visibility, score, and reason codes; English and Spanish content is preserved.
