# Learning Pipeline

Status: Canonical runtime source-of-truth  
Layer: `/runtime`

## Purpose

The Learning Pipeline defines how runtime activity improves Momentum knowledge over time. It implements the ratified knowledge growth loop without creating new governance.

## Core loop

```text
Guided Action -> BA Action -> Outcome -> Runtime Event -> Learning Signal -> Knowledge Candidate -> Review -> Approved Knowledge -> Better Retrieval -> Better Guided Action
```

## Learning is

Learning means discovering repeated useful patterns, improving confusing explanations, identifying relationship approaches that worked or need revision, turning repeated questions into training knowledge, linking guided actions to outcomes, and validating/refining/superseding knowledge.

## Signal sources

| Source | Signals |
|---|---|
| Steve Success | win, breakthrough, obstacle, action completion, success lesson |
| Michael Magnificent | training confusion, journal adoption, repeated system question |
| Ivory | draft accepted, draft edited, relationship approach outcome |
| Momentum Journal | BA-selected lesson, idea, script, reflection |
| Agent events | session completed, action suggested, candidate proposed |
| Outcome events | action completed, training resolved, draft used |
| QA/admin review | outdated knowledge, compliance risk, duplicate knowledge |

## Learning objects

```ts
interface LearningOutcome {
  outcomeId: string;
  tenantId: string;
  baId: string;
  sessionId?: string;
  agentKey?: 'steve_success' | 'michael_magnificent' | 'ivory';
  guidedActionId?: string;
  outcomeType:
    | 'action_completed'
    | 'action_skipped'
    | 'journal_entry_created'
    | 'invitation_draft_used'
    | 'training_question_resolved'
    | 'success_lesson_confirmed'
    | 'relationship_approach_worked'
    | 'relationship_approach_needs_revision'
    | 'knowledge_helpful'
    | 'knowledge_not_helpful';
  description: string;
  linkedKnowledgeIds: string[];
  linkedCandidateIds: string[];
  occurredAt: Date;
}
```

```ts
interface LearningSignal {
  signalId: string;
  tenantId: string;
  signalType:
    | 'repeat_question'
    | 'successful_action_pattern'
    | 'failed_action_pattern'
    | 'template_gap'
    | 'knowledge_gap'
    | 'candidate_needed'
    | 'knowledge_update_needed'
    | 'compliance_review_needed';
  sourceType: 'agent_event' | 'outcome' | 'journal_selection' | 'qa_review' | 'manual';
  sourceId: string;
  domain: 'success' | 'training' | 'relationship';
  priority: 'low' | 'normal' | 'high';
  status: 'new' | 'triaged' | 'candidate_created' | 'dismissed' | 'resolved';
  createdAt: Date;
}
```

## Pipeline stages

```text
Observe -> Link -> Score -> Detect Pattern -> Propose Candidate -> Review -> Approve/Reject/Revise -> Reindex -> Update Graph -> Monitor Outcomes
```

## Pattern detection

MVP can be rules-based:

```ts
if (sameQuestionCount >= 5 && domain === 'training') {
  createLearningSignal('repeat_question');
}

if (draftUsedCount >= 3 && positiveFeedbackCount >= 2) {
  createLearningSignal('successful_action_pattern');
}
```

## Candidate examples

Steve candidate:

```json
{
  "domain": "success",
  "title": "Ask for one next action after each breakthrough",
  "summary": "When a BA identifies a breakthrough, Steve should help them choose one concrete next action before closing the session.",
  "evidence": ["session_101", "session_118", "outcome_204"]
}
```

Michael candidate:

```json
{
  "domain": "training",
  "title": "Momentum Journal onboarding explanation",
  "summary": "New BAs understand the journal better when Michael explains it as a private learning notebook first, then an optional source of Knowledge Candidates."
}
```

Ivory candidate:

```json
{
  "domain": "relationship",
  "title": "Invite close family with permission and care",
  "summary": "For close family, Ivory should help the BA lead with care, ask permission, and avoid sounding like a sales pitch.",
  "riskFlags": ["compliance_sensitive"]
}
```

## Graph updates

```cypher
(:GuidedAction)-[:PRODUCED]->(:Outcome)
(:Knowledge)-[:INFORMED]->(:GuidedAction)
(:Outcome)-[:VALIDATES|WEAKENS|REFINES]->(:Knowledge)
(:LearningSignal)-[:PROPOSED]->(:KnowledgeCandidate)
(:KnowledgeCandidate)-[:APPROVED_AS]->(:Knowledge)
(:Knowledge)-[:SUPERSEDES]->(:Knowledge)
```

## Metrics

| Metric | Purpose |
|---|---|
| Candidate creation rate | shows knowledge growth volume |
| Approval rate | shows candidate quality |
| Supersession rate | shows knowledge improvement |
| Retrieval usefulness | shows whether context helps action |
| Repeated confusion count | shows where training is weak |
| Journal adoption | shows whether BAs use the journal |
| Bilingual parity score | shows English/Spanish coverage |

## APIs

```text
POST /api/runtime/outcomes
GET  /api/runtime/outcomes
POST /api/runtime/learning/signals
GET  /api/runtime/learning/signals
POST /api/runtime/learning/signals/:signalId/triage
POST /api/runtime/learning/signals/:signalId/create-candidate
GET  /api/runtime/learning/metrics
```

## Events

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

## Guardrails

The Learning Pipeline must not approve knowledge automatically, learn private journal entries without selection, promote unreviewed claims, optimize pressure or manipulation, treat drafts as proof of effectiveness, or expose sensitive context outside BA-owned workflows.

## Acceptance criteria

Outcomes can be recorded; learning signals can be linked to sessions, events, candidates, knowledge, and actions; pattern detection can propose candidates; review remains separate from learning automation; approved knowledge can be reindexed and graph-linked; private journal entries are excluded unless selected; English and Spanish learning records are supported.
