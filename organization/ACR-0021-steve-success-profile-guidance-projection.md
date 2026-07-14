# ACR-0021 — Steve Success Profile Guidance Projection

**Status:** PROPOSED — implementation prepared for Kevin review; no approval is inferred
**Authorship:** Agent-authored reconciliation proposal
**Risk:** Medium — additive recommendation/API/surface projection
**Change type:** Shared contract / read-only application projection
**Audit authority:** `PLATFORM_AUDIT_PRIORITY_TASKLIST.md` P2-118
**Affected boundary:** Steve Success Profile, Launch Center, sponsor training support
**Target version:** v1.2

## Purpose

Connect the descriptive training and launch recommendations already stored in
the authenticated BA's Steve Success Profile to the existing Launch Center.
The projection makes existing support context visible; it does not generate a
new recommendation, approve knowledge, or evaluate a person.

## Proposed boundary

1. The only source is exactly one completed
   `tmag_steve_success_interview.successProfile` whose `tmagId` matches the
   authenticated BA. Duplicate, missing, incomplete, or identity-inconsistent
   evidence fails closed.
2. Recommendation text and order are preserved after bounded trimming and a
   fail-closed generated-copy safety scan. No weight or priority is added.
3. Stored links are trusted only when they exactly match an implemented,
   allowlisted internal Team route. Other links become `null`.
4. Guidance is supplementary and self-facing. It never changes route access,
   training prerequisites or order, progress, completion, Launch Center steps,
   or the factual `nextAction`.
5. Every BA retains equal access to the same opportunity, tools, training, and
   support. The projection never scores, ranks, classifies, qualifies,
   predicts, compares, or creates a hidden readiness measure.
6. Data exposure is minimal while P2-141 remains open: no transcript, primary
   why, success vision, obstacles, communication preferences, or Michael
   handoff text enters the Launch Center response.
7. This projection is not Kevin-approved knowledge. It is labeled as
   Steve-authored guidance and never enters the Knowledge Base.
8. No database, graph, vector, Context Packet, comparison report, prompt,
   worker, or production communication is added or changed.

## Context Agent reconciliation

ACR-0014 remains in force. Private Context Packet enrichment is not active, so
this slice does not claim that Michael consumes the profile through Context
Manager. The existing sponsor-facing read projection remains outside agent
runtime orchestration. A future Michael runtime connection must use a
server-owned Context Manager provider and a separately approved contract.

ACR-0010 remains proposed and does not authorize comparison-report or compiled
guidance persistence. This ACR neither depends on nor expands ACR-0010.

## Verification and rollback

Verification must prove same-BA identity, duplicate/mismatch degradation,
bounded recommendation pass-through, unsafe-copy exclusion, route allowlisting,
unchanged access/completion/next-action truth, responsive UI behavior,
repository typecheck/build, and relevant full test suites.

Rollback removes the additive guidance field, projector, and UI panel. Existing
Steve artifacts, Launch Center state, training progress, and Context Manager
behavior remain unchanged.

## Approval record

No approval has been recorded. Kevin remains the sole approval and merge
authority.
