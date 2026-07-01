# P4.10 — Next Training Step Resolution Contract (Agent B)

## Momentum Creation System V2 · Phase 4 · Slice P4.10 (final)

The official contract for resolving the agent's next training step over approved knowledge.

### Load-bearing rule

> **The resolver selects; it never generates.** A step is a content-free pointer to an approved
> knowledge item, chosen deterministically by retrieval (curator) order and the BA's completed
> set. A degraded/empty retrieval yields `unavailable` + the P4.9 safe fallback — never a guessed
> step, never fabricated content.

---

## 1. Input

```
NextTrainingStepInput {
  result: ApprovedKnowledgeQueryResult            // from retrieveApprovedKnowledge (P4.4/6/7)
  completedKnowledgeIds?: readonly KnowledgeId[]   // the BA's completed approved items
}
```

`result.references` are the approved training sequence in curator order (the order the boundary
returned). `completedKnowledgeIds` is de-duplicated into a set; unknown ids are ignored.

**PRECONDITION (load-bearing):** `result` must be the **complete** approved sequence — the
retrieval request used for training-step resolution must **not** set `maxResults`. The resolver
treats `result.references` as the entire sequence; a truncated window would masquerade as a
completed sequence (false `all_completed`, wrong `totalSteps`). Progress requires the whole
sequence. Duplicate `knowledgeId`s in `result.references` are de-duplicated (first occurrence
wins) so counts and position are per **distinct** approved item.

## 2. Output

```
NextTrainingStepResolution {
  status: 'resolved' | 'all_completed' | 'unavailable'
  reasonCode: 'next_uncompleted' | 'all_completed' | 'no_approved_knowledge'
  step?: NextTrainingStep            // present iff status === 'resolved'
  completedCount: number             // completed items that are in the approved sequence
  totalCount: number                 // approved items in the sequence
  safeFallback?: DegradedContextState // present iff status === 'unavailable'
}

NextTrainingStep {
  knowledgeId: KnowledgeId
  sourceId: SourceId
  domain: KnowledgeDomain
  language: RuntimeLanguage
  stepIndex: number      // 0-based position in the approved sequence
  totalSteps: number
}
```

Every step field is an identifier, an enum, or a position — no field can carry knowledge text.

## 3. Resolution algorithm (deterministic)

1. If `result.status === 'degraded'` **or** `result.references` is empty ⇒
   `status: 'unavailable'`, `reasonCode: 'no_approved_knowledge'`, `safeFallback` from P4.9
   (`safeFallbackFromResult`; for a defensive empty-`ok`, `resolveSafeFallbackState` with
   `no_approved_match`), `completedCount: 0`, `totalCount: 0`.
2. Else let `refs = result.references`, `total = refs.length`,
   `completedCount = refs.filter(r ∈ completed).length`.
3. `next = first r in refs with r.knowledgeId ∉ completed`.
   - If none ⇒ `status: 'all_completed'`, `reasonCode: 'all_completed'`.
   - Else ⇒ `status: 'resolved'`, `reasonCode: 'next_uncompleted'`, `step = { …r, stepIndex, totalSteps: total }`.

Selection is by first-uncompleted in retrieval order — stable and reproducible for the same
result + completed set.

## 4. Fail-closed & reuse of P4.9

The `unavailable` path returns the **same** `DegradedContextState` P4.9 produces for the
degraded retrieval (reason-specific safe directive; offers the other language on a language
miss; forbids fabrication and presenting a machine translation as approved). P4.10 introduces no
new fallback wording — it composes P4.9.

## 5. Compliance & determinism

Pure and deterministic — no clock, no I/O, no persistence, no LLM, no Gateway. The resolution is
content-free (identifiers + counts + position, plus the P4.9 safe directive) and BA-facing; it
carries no knowledge body and none of the five `.com`-prohibited items, and is never wired to
`apps/com`.

## 6. Non-goals

No LLM/generation, no knowledge-body enrichment, no persistence of progress (the completed set is
an input), no shared-type change, no packet assembly (Context Manager remains sole assembler), no
`.com`, no routes.
