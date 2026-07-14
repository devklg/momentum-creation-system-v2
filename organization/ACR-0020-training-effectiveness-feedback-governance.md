# ACR-0020 — Training Effectiveness Feedback Governance

**Status:** PROPOSED — awaiting Kevin L. Gardner
**Authorship:** Agent-authored reconciliation proposal; no approval is inferred
**Risk:** Medium — new training/recommendation feedback flow and evidence lineage
**Change type:** Contract / persistence lineage / training and knowledge workflow
**Audit authority:** `PLATFORM_AUDIT_PRIORITY_TASKLIST.md` P2-112
**Affected boundary:** Training progress, approved knowledge, outcome capture,
learning candidates, future admin training analytics
**Target version:** v1.2

## Why an ACR is required

P2-112 asks for a training-effectiveness feedback loop tied to approved
knowledge and outcomes. The repository already has the component foundations,
but they are intentionally separate and partly wired-dormant:

- `tmag_fast_start_progress` owns explicit current training completion;
- approved active knowledge enters runtime only through the Context Manager;
- `mcs_outcomes` accepts BA-confirmed terminal prospect outcomes only and is
  canary-gated;
- `mcs_learning_candidates` is review-only, canary-gated, and cannot promote
  itself into active knowledge.

Connecting those foundations would create a new evidence and recommendation
flow. The current decision ledger does not define which outcomes count, how
long attribution lasts, what aggregation protects people, or which human may
approve a proposed learning change. An agent cannot invent those policies.

## Proposed fail-closed boundary

The following boundary is proposed for Kevin's approval. It does not authorize
runtime implementation:

1. **Evidence stays explicit.** Training state comes only from explicit module
   progress. Outcomes come only from existing BA-confirmed outcome records.
   Timers, elapsed time, engagement, and agent inference never manufacture a
   completion or outcome.
2. **Approved knowledge is read-only input.** Only active, approved,
   source-traceable knowledge may be associated with a module. Candidate,
   review-only, stale, superseded, or degraded knowledge never counts as the
   training source.
3. **Association is not causation.** The loop may report that explicit training
   evidence and later confirmed outcomes co-occurred. It may not claim that a
   module caused an enrollment, customer result, or other outcome.
4. **No person scoring.** The loop never scores, ranks, predicts, classifies, or
   compares Brand Ambassadors. P2-113 may display aggregate curriculum health,
   never a leaderboard or individual effectiveness score.
5. **No automatic knowledge change.** A detected pattern may create, at most, a
   review-only learning candidate with full evidence lineage. It cannot alter
   active knowledge, module content, recommendations, or prompts automatically.
6. **Human approval remains mandatory.** No agent or pipeline approves a
   learning candidate. Existing append-only review and supersession rules stay
   in force.
7. **Canaries remain off until verified.** Outcome capture and learning-candidate
   persistence remain disabled unless their existing canary gates and read-back
   requirements are separately satisfied.
8. **No live/runtime activation from this ACR proposal.** No schema, API,
   database, route, worker, prompt, knowledge, or production change is
   authorized until the decisions below are supplied and this ACR is approved.

## Decisions reserved to Kevin

Implementation remains blocked until Kevin decides:

1. **Eligible outcomes:** which existing BA-confirmed outcome kinds may enter
   training-effectiveness reporting.
2. **Attribution window:** how long after explicit module completion an outcome
   may be associated for aggregate reporting.
3. **Privacy threshold:** the minimum aggregate cohort size before a result may
   be displayed or used to create a learning candidate.
4. **Feedback action:** admin diagnostic only, review-only learning-candidate
   creation, or both.
5. **Human reviewer authority:** Kevin only or the existing admin allowlist.
6. **Review cadence:** event-driven, scheduled batch, or manual admin action.

No default value is supplied for any of these decisions. Missing authority
fails closed.

## Existing behavior held outside this proposal

This proposal does not activate `OUTCOME_CAPTURE_PERSISTENCE_ENABLED` or
`LEARNING_CANDIDATE_PERSISTENCE_ENABLED`. It does not add an outcome kind,
reinterpret invitation or CRM events as outcomes, mount the dormant writers on
a route, or expose any training/outcome correlation to `.com`.

## Verification gates for a future implementation

A later approved implementation must prove:

- only explicit progress and BA-confirmed outcomes enter the computation;
- every knowledge reference is active, approved, and source-traceable;
- all output is aggregate and cannot rank or classify a person;
- candidate creation is review-only and human approval is the sole promotion
  path;
- every persistent write uses the app-direct required stores and passes
  persistence read-back;
- disabled canaries produce no writes and an honest unavailable state;
- focused tests, repository typecheck/build, compliance scans, and GitHub merge
  gates pass; and
- rollback returns to the current independent, wired-dormant foundations.

## Compatibility and rollback

This proposal is documentation-only. It makes no runtime or persistence change.
The rollback target for any later implementation is the current state in which
training progress, outcome capture, learning candidates, and approved knowledge
remain independent and no effectiveness loop is active.

## Evidence

- `packages/shared/src/training-catalog.ts`
- `packages/shared/src/training-target-reconciliation.ts`
- `server/src/domain/outcomes.ts`
- `server/src/domain/learningCandidates.ts`
- `server/src/services/knowledge/approvedKnowledgeStore.ts`
- `server/src/runtime/context/contextManagerRetrievalAdapter.ts`
- `MOMENTUM_CONSTITUTION.md` Article VII.1 and VII.6
- `constitution/MOMENTUM_ACR_SYSTEM.md` §1 and §7

## Approval record

No approval has been granted. P2-112 remains unchecked. Approval of this ACR
would approve only the fail-closed boundary; the six reserved decisions must
also be supplied before runtime implementation begins.
