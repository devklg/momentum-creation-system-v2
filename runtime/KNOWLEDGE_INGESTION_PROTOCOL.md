# Knowledge Ingestion Protocol

Status: Canonical runtime source-of-truth  
Layer: `/runtime`

## Purpose

The Knowledge Ingestion Protocol defines how raw conversations, sessions, outcomes, and journal entries become structured knowledge candidates.

It prepares knowledge. It does not approve knowledge.

## Principle

```text
Raw conversation != private journal != knowledge candidate != approved organizational knowledge
```

A private note is not automatically a lesson for the organization. A lesson is not automatically approved knowledge.

## Ingestion sources

| Source | Default visibility | Candidate pathway |
|---|---|---|
| Steve Success session | session-scoped | Success Knowledge Candidate |
| Michael Magnificent session | session-scoped | Training Knowledge Candidate |
| Ivory session | session-scoped | Relationship Knowledge Candidate |
| Momentum Journal | private to BA | BA selects for review |
| Knowledge Session | review-scoped | direct candidate creation |
| Outcome event | runtime event | Learning Pipeline proposes candidate |
| Admin/manual import | admin-scoped | candidate or approved import depending on ratified process |

## Pipeline

```text
Capture -> Normalize -> Classify -> Segment -> Risk-check -> Dedupe -> Candidate-create -> Index-for-review -> Graph-link -> Queue-for-review
```

## Capture

Capture stores the original input.

```ts
interface CapturedInput {
  captureId: string;
  tenantId: string;
  baId?: string;
  sourceType: 'agent_session' | 'journal_entry' | 'knowledge_session' | 'outcome' | 'manual_import';
  sourceId: string;
  agentKey?: 'steve_success' | 'michael_magnificent' | 'ivory';
  inputMode?: 'voice' | 'text' | 'system';
  language: 'en' | 'es';
  originalText: string;
  capturedAt: Date;
  metadata?: Record<string, unknown>;
}
```

Browser voice capture stores transcript text, language, confidence, and final/interim status. MVP stores transcripts, not raw audio.

## Normalize

Normalization may add punctuation, create a summary, detect language, extract entities, extract action items, extract relationship context, and create a candidate title. It must not change meaning or promote private content.

```ts
interface NormalizedCapture {
  captureId: string;
  normalizedText: string;
  summary: string;
  language: 'en' | 'es';
  detectedEntities: Array<{
    type: 'person' | 'product' | 'place' | 'concept' | 'action' | 'relationship';
    value: string;
    confidence: number;
  }>;
  actionItems: string[];
  candidateSignals: string[];
}
```

## Classify

```ts
type KnowledgeDomain = 'success' | 'training' | 'relationship';
type CandidateLikelihood = 'none' | 'low' | 'medium' | 'high';
```

Classification signals:

- `success`: win, breakthrough, obstacle, lesson, action, outcome;
- `training`: onboarding, how-to, journal teaching, system usage, repeated question;
- `relationship`: person, relationship, invitation, tone, script, follow-up.

## Segment

```ts
interface KnowledgeChunkDraft {
  chunkId: string;
  sourceType: string;
  sourceId: string;
  tenantId: string;
  baId?: string;
  domain: KnowledgeDomain;
  language: 'en' | 'es';
  text: string;
  summary: string;
  tags: string[];
  visibility: 'private_to_ba' | 'review_only' | 'organizational';
  order: number;
}
```

## Risk-check

```ts
type KnowledgeRiskFlag =
  | 'income_claim'
  | 'medical_claim'
  | 'private_personal_data'
  | 'prospect_private_data'
  | 'unverified_claim'
  | 'compliance_sensitive'
  | 'duplicate_possible'
  | 'outdated'
  | 'needs_translation_review'
  | 'none';
```

Risk flags route content to careful review. Risk flags do not automatically reject content.

## Dedupe

Check against approved knowledge, review candidates, same source session, same journal entry, semantic similarity in Chroma, and related Neo4j concepts.

```ts
type DedupeOutcome =
  | 'new_candidate'
  | 'merge_with_existing_candidate'
  | 'link_to_existing_knowledge'
  | 'reject_duplicate'
  | 'requires_human_review';
```

## Candidate creation by agent

Steve may propose success patterns, obstacle patterns, action habits, field lessons, and next-step patterns.

Michael may propose onboarding clarifications, system how-tos, Momentum Journal teaching improvements, training FAQs, and repeated support answers.

Ivory may propose relationship invitation patterns, tone guidance, follow-up wording principles, and editable script template patterns.

Journal entries become candidates only when the BA selects them for review or explicitly consents through an authorized workflow.

## Review-only indexing

Candidates may be indexed in Chroma for review and dedupe only:

```json
{
  "sourceCollection": "knowledge_candidates",
  "sourceId": "cand_...",
  "status": "candidate",
  "retrievalScope": "review_only",
  "domain": "training",
  "language": "en"
}
```

Candidate chunks are not retrieved as approved agent knowledge.

## Graph lineage

```cypher
(:AgentSession)-[:PRODUCED]->(:KnowledgeCandidate)
(:JournalEntry)-[:SELECTED_AS]->(:KnowledgeCandidate)
(:KnowledgeCandidate)-[:ABOUT]->(:Concept)
(:KnowledgeCandidate)-[:SIMILAR_TO]->(:Knowledge)
```

## Events

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
knowledge.graph.linked
knowledge.ingestion.failed
```

## Idempotency keys

| Operation | Idempotency key |
|---|---|
| Capture turn | `sessionId + turnSequence` |
| Journal prompt entry | `sessionId + promptId + baId` |
| Journal selected for review | `journalEntryId + baId` |
| Candidate from source | `sourceType + sourceId + domain + normalizedTitleHash` |
| Candidate indexing | `candidateId + version` |

## APIs

```text
POST /api/runtime/ingestion/capture-turn
POST /api/runtime/journal
POST /api/runtime/journal/:journalEntryId/select-for-review
POST /api/runtime/knowledge-candidates
```

## Acceptance criteria

Raw session turns are captured; journal entries are private by default; candidate creation preserves lineage; candidates are not approved knowledge; risk flags attach before review; duplicate checks run before queue insertion; review-only Chroma indexing exists; Neo4j lineage edges are created; English and Spanish inputs are preserved; all stages emit idempotent events.
