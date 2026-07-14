# ACR-0024 — Generated-Output Audit Governance

**Status:** PROPOSED — Kevin approval is required before activation
**Authorship:** Agent-authored post-merge governance reconciliation proposal
**Risk:** High — adds live persistent audit writes and a compliance-sensitive fail-closed response boundary
**Change type:** Persistence / compliance boundary / audit contract
**Audit authority:** `PLATFORM_AUDIT_PRIORITY_TASKLIST.md` P2-124
**Affected boundary:** BA-visible Ivory and ScriptMaker generated output
**Target version:** v1.2

## Why this ACR is required

PR #315 merged the P2-124 implementation before an ACR was prepared. The
implementation adds a live call to the persistent audit substrate and changes
delivery behavior so audit or compliance failure prevents generated output
from being returned. `MOMENTUM_ACR_SYSTEM.md` section 1 requires an ACR for a
persistence-pattern or compliance-boundary change, and sections 5 and 7 reserve
approval of this High-risk compliance-sensitive change to Kevin.

Kevin's merge of PR #315 satisfied merge authority. It is not treated as the
separate explicit ACR approval required by the state machine.

## Proposed boundary

1. Every BA-visible Ivory and ScriptMaker provider-backed generation route
   appends an audit record before returning generated or deterministic-fallback
   output.
2. Prompt identity and semantic version come from an active, approved entry in
   `MCS_AGENT_TEMPLATE_REGISTRY`; the input classification must match that
   template identity exactly.
3. The canonical Mongo record may store only the authenticated BA id and
   bounded enum, presence, and length metadata. It must not store raw prompts,
   generated output, names, relationship notes, prospect context, secrets, or
   credentials.
4. Delivered output is independently scanned with the existing generated-copy
   compliance scanner. Passing output records `prompt.output.generated`.
   Rejected output records critical `prompt.output.rejected`, whose unified
   taxonomy outcome is `blocked`.
5. A compliance rejection or failure to commit and read back the canonical
   Mongo audit row fails closed before the output response is delivered.
6. Neo4j and Chroma remain operational projections governed by the established
   durable outbox contract. They do not become canonical truth, and projection
   delay does not silently replace Mongo read-back.
7. These audit rows are operational evidence only. They do not approve or
   classify knowledge and do not grant Ivory, ScriptMaker, or any prospect-facing
   surface new authority.

## Explicit exclusions

- No prompt text, prompt approval, model, provider, retry policy, agent mission,
  prospect-facing AI behavior, or live communication change.
- No raw private input or generated-copy retention.
- No new audit collection or parallel taxonomy.
- No production mutation or live-output test as part of approval verification.

## Verification and activation gate

Before P2-124 returns to complete status, verification must prove:

- all four scoped generation routes audit before response delivery;
- prompt/input identity mismatch fails before persistence;
- rejected output is classified with taxonomy outcome `blocked`;
- raw private input and generated output are absent from the canonical row;
- audit/compliance failure prevents response delivery;
- a safe non-production end-to-end write reaches `mcs_audit_log` and canonical
  Mongo read-back confirms the prompt version, safe input metadata, user id, and
  compliance result;
- relevant focused tests, the full server suite, repo typecheck, and build pass.

No visual QA is required because this change has no frontend surface.

## Rollback

Rollback removes the four route audit calls and generated-output audit helper,
then restores the prior route behavior. The pre-existing generated-copy
compliance scanner remains in place. If PR #315 has not been released, hold the
release until approval and verification. If it has already auto-released and
cannot be held, the conservative governed action is to roll back PR #315 until
Kevin decides this ACR.

## Approval record

No approval has been recorded. Until Kevin explicitly approves this ACR and
the non-production persistence read-back is evidenced, P2-124 remains partial
and must not be represented as governance-complete.
