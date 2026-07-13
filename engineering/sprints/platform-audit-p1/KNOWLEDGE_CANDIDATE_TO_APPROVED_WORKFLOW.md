# Candidate-to-Approved Knowledge Workflow Map

**Executable map:** `packages/shared/src/knowledge-workflow-map.ts`  
**Finding:** the repository currently has multiple governed lanes, not one connected candidate-to-active workflow.

```text
Runtime outcome/signal -> detected candidate -> human approved
                                           -X-> approval event/evolution

Context Agent proposed -> confirmed note/handle
                     -X-> runtime candidate/evolution

Synthetic/internal approval event -> evolution plan -> version/index/graph
                                                  -X-> P1-84 resource gate
                                                  -X-> Context retrieval

Kevin/admin-authored source -> active governed chunks -> Context retrieval
```

`-X->` is an explicit missing edge, not an implied future behavior.

## What is implemented

- Runtime candidates are deterministically created as `detected` in review-only Mongo, Neo4j, and Chroma stores.
- `reviewLearningCandidate` is the only app-runtime approval/rejection function and requires a non-empty human reviewer ID.
- Kevin/admin-authored knowledge has a separate live fast lane that creates active governed source/chunk records.
- Knowledge Evolution can plan, version, index, graph-sync, and mark retrieval readiness when explicitly invoked with an approval request.
- Context Manager retrieval structurally excludes candidate/review-only records and degrades to an empty approved set on failure.

## Material gaps

- Runtime candidate review is wired-dormant and has no admin review route or UI.
- Candidate approval updates Mongo and Neo4j but leaves the review-only Chroma metadata stale.
- No production code emits `knowledge.candidate.approved` from the stored human review.
- Knowledge Evolution validates approval-reference shape but does not load and prove the persisted candidate/reviewer decision.
- Context Agent candidates share the Mongo collection with incompatible `proposed/confirmed` states and Mongo-only persistence.
- Knowledge Evolution active indexes, Phase-7 GraphRAG records, the P1-84 resource gate, and the current generic approved-chunk provider are not one connected authorization path.

P1-85 maps these facts only. It does not fabricate an end-to-end green path or auto-promote approved candidates.
