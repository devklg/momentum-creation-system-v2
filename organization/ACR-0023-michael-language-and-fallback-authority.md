# ACR-0023 — Michael Language and Fallback Authority

**Status:** PROPOSED — Kevin approval is required before adoption
**Authorship:** Agent-authored source-of-truth reconciliation proposal
**Risk:** Critical — establishes a cross-workspace source of truth for governed Michael language and fallback policy
**Change type:** Source-of-truth / shared contract; no new runtime capability
**Audit authority:** `PLATFORM_AUDIT_PRIORITY_TASKLIST.md` P2-122
**Affected boundary:** Michael training-support runtime and `.team` display fallback
**Target version:** v1.2

## Purpose

Consolidate Michael's existing controlled English/Spanish response bodies,
Context Packet safe-path mapping, and current English-only `.team` runtime-card
copy into one versioned shared authority. Today those exact values are repeated
across server fixtures, selector logic, and the team UI.

## Proposed decision

1. Approve `packages/shared/src/michael-language.ts` version `1.0.0` as the
   canonical implementation source for the existing Michael response copy,
   safe-path status mapping, and runtime-card UI copy.
2. Preserve the existing response words and UI words exactly; this ACR approves
   consolidation, not rewritten language.
3. Preserve the existing mapping: `degraded` and `missing` return controlled
   `safe_fallback` copy; `failed` and `rejected` return controlled `safe_close`
   copy without side effects.
4. Keep Michael browser-based, BA-facing, training-only, English/Spanish, and
   catalog-driven. Runtime consumers may select controlled copy but may not
   generate, rewrite, translate, persist, send, or call.
5. Require a new immutable authority version and applicable governance review
   for later wording, language support, mission, safety, or fallback-policy
   changes.

## Explicit exclusions

- No Michael system prompt, LLM invocation, model, provider, Context Manager
  activation, route contract, persistence, or production communication change.
- No interviewer, scorer, qualifier, comparison, readiness, or prospect-facing
  behavior.
- No approval or classification of agent-authored content as Kevin-approved
  Knowledge Base material.
- No reconciliation of the stale `michael.workflow.discovery_interview`
  governance slot; that contradiction requires its own governed correction.
- No promotion of the dormant admin master-content scaffold
  `team.michael.training_support_prompt` into runtime authority.
- No conflation of internal Context Packet `safeFallbackInstruction` guidance
  with the controlled response copy returned to a Brand Ambassador.

## Verification

Verification must prove exact parity between the pre-consolidation copy and the
shared authority, all twelve controlled EN/ES fixtures, all four safe-path
scenario mappings, unchanged fail-closed compliance behavior, focused server
and team tests, repo-wide typecheck/build, and visual QA of the touched `.team`
card. No persistent write is introduced, so persistence read-back is not
applicable.

## Rollback

Rollback to the pre-ACR local constants and mappings at the parent of the
implementation commit. No data migration or production state rollback is
required.

## Approval record

No approval has been recorded. Until Kevin approves this ACR, P2-122 remains
unchecked, the shared authority is not canonical, and the implementation must
remain unmerged.
