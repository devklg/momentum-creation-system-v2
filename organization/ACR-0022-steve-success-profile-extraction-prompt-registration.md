# ACR-0022 — Steve Success Profile Extraction Prompt Registration

**Status:** PROPOSED — Kevin approval is required before activation
**Authorship:** Agent-authored prompt-governance reconciliation proposal
**Risk:** Medium — records an existing active LLM prompt in the governed template registry
**Change type:** Prompt registry / documentation; no runtime prompt change
**Audit authority:** `PLATFORM_AUDIT_PRIORITY_TASKLIST.md` P2-120
**Affected boundary:** Steve Success Profile extraction
**Target version:** v1.2

## Purpose

Register the existing `extractionSystem()` LLM system prompt used by
`steveConversationRuntime.ts`. The prompt converts a completed Steve transcript
into structured BA-authored answers and Success Profile inputs. It is distinct
from `assembleSuccessProfile()`, which is deterministic structural assembly and
is already registered as `steve_success_profile@1.0.0`.

## Proposed decision

1. Approve `steve_success_profile_extraction@1.0.0` as the governed identity
   for `server/src/domain/steveConversationRuntime.ts#extractionSystem`.
2. Keep the entry owned by the existing `steve.assemble_success_profile` skill.
3. Allow only completed discovery transcripts and registered discovery question
   ids as inputs; allow only structured answers and Success Profile inputs as
   outputs.
4. Forbid scoring, ranking, classification, qualification, prediction, income
   claims, and placement promises.
5. Preserve the current fail-closed behavior: one correction retry, then leave
   extraction pending. Never fabricate or persist a profile after failure.
6. Treat the current source text as version `1.0.0`; future edits require a new
   immutable version, prompt tests, review, and the applicable ACR when mission,
   safety, retrieval, completion, or compliance boundaries change.

## Explicit exclusions

- No runtime prompt text, model, provider, route, schema, persistence, Context
  Manager flag, knowledge source, or production communication changes.
- No approval of Steve outputs as Kevin-approved Knowledge Base content.
- No scoring, readiness measure, human comparison, access restriction, or
  change to the Steve-completion gate.
- No silent resolution of existing base-prompt drift. The locked spec describes
  a 36-question / 11-section browser interaction, while the current base source
  contains 17 questions / 7 sections and a stale phone-call literal. That
  behavioral reconciliation requires its own governed change.

## Verification

Verification must prove the planned template has a stable semantic version,
the exact extraction behavior source, bounded inputs/outputs, explicit
forbidden outputs, fail-closed degradation, test references, and no duplicate
registry. The playbook must distinguish extraction from deterministic assembly
and state that approval has not yet been granted.

## Approval record

No approval has been recorded. Until Kevin approves this ACR, the registry
entry remains `planned`, P2-120 remains unchecked, and no activation is
authorized.
