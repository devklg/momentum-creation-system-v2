# P4.9 — Approved-Knowledge Safe Fallback Upgrade Contract (Agent B)

## Momentum Creation System V2 · Phase 4 · Slice P4.9

The official contract for turning a fail-closed retrieval degrade into a reason-specific, safe,
compliant `DegradedContextState`.

### Load-bearing rule

> **A degraded packet still carries empty approved knowledge; P4.9 only makes the instruction
> honest and specific.** The fallback never re-introduces knowledge, never fabricates, never
> infers, and never presents a machine translation as approved. Every string is content-free.

---

## 1. Reason mapping (retrieval → packet)

| `ApprovedKnowledgeQueryDegradeReason` | `DegradedContextReason` | Safe guidance (appended to the base directive) |
|---|---|---|
| `knowledge_unavailable` | `knowledge_unavailable` | The approved knowledge base could not be reached; proceed on identity, rules, and guardrails only. |
| `no_approved_match` | `knowledge_unavailable` | No approved knowledge matched this objective; ask a clarifying question to narrow the need — do not fabricate an answer. |
| `language_unavailable` | `translation_unavailable` | Approved knowledge is not available in {requested}; ask the Brand Ambassador whether to continue in {fallback} or rephrase — never present a machine translation as approved. |
| `scope_empty` | `knowledge_unavailable` | No approved knowledge is scoped to this team/BA yet; proceed on identity and rules, and invite the BA to add knowledge. |
| `retrieval_timeout` | `retrieval_timeout` | Retrieval timed out; proceed safely on identity and rules — the BA may retry shortly. |

Unknown/empty input degrades **safely** to `['knowledge_unavailable']` with the base directive
(fail-safe).

## 2. The base directive (always present)

> "Proceed only with packet identity, runtime rules, guardrails, and clarifying questions; do
> not infer or fabricate missing knowledge."

The assembled `safeFallbackInstruction` is the base directive followed by the space-joined
guidance fragments for each distinct reason (stable order = the reason order above).

## 3. Output shape

`resolveSafeFallbackState(input): DegradedContextState` where:
- `reasons`: the de-duplicated `DegradedContextReason[]` (never empty; `['knowledge_unavailable']`
  as the fail-safe default).
- `safeFallbackInstruction`: base directive + guidance fragments (a non-empty string —
  satisfies `validateContextPacket`).
- `missingSections`: `['approvedKnowledge']` (a degraded retrieval always misses approved
  knowledge).

Input: `{ degradeReasons: readonly ApprovedKnowledgeQueryDegradeReason[]; requestedLanguage:
RuntimeLanguage; fallbackLanguage?: RuntimeLanguage }`. Language names render as English/Spanish
for the `language_unavailable` fragment; with no `fallbackLanguage`, the fragment says "rephrase
or try another language".

## 4. Bridge

`safeFallbackFromResult(result: ApprovedKnowledgeQueryResult)`:
- returns `null` when `result.status === 'ok'`;
- otherwise returns `{ packetStatus: 'degraded', degraded: resolveSafeFallbackState(...) }`,
  derived from `result.metadata.degradeReasons` and `result.metadata.language`, ready to spread
  into `buildContextPacket` input. The Context Manager remains the sole assembler.

## 5. Compliance & determinism

Pure and deterministic — no clock, no I/O, no persistence, no LLM, no Gateway. Every string is a
fixed safe directive with only the language name interpolated; it carries no knowledge content
and none of the five `.com`-prohibited items. A degraded packet is BA-facing and fail-closed.

## 6. Non-goals

No change to `defaultDegradedState()` (remains the last-resort default), no shared-type change,
no new packet assembler, no re-introduction of knowledge into a degraded packet, no `.com`, no
routes, no persistence.
