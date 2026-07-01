# P4.9 — Approved-Knowledge Safe Fallback Upgrade — Readiness Review (Agent A)

## Momentum Creation System V2 · Phase 4 · Slice P4.9

Branch: `feature/phase-04-p4.9-safe-fallback-upgrade`
Base: `89a4cf6` (`main` after P4.8 / PR #85)
Mode: readiness review only.

---

## 1. Objective

Upgrade the degraded-packet path so a fail-closed retrieval produces a **reason-specific, safe,
compliant** fallback directive instead of one generic instruction. When retrieval degrades, the
agent should be told *why* and *what is safe to do* — ask a clarifying question, offer the other
language (never silently machine-translate), or proceed on identity + rules only — always
without fabricating or inferring missing knowledge.

## 2. The gap (two different reason vocabularies)

- Retrieval emits `ApprovedKnowledgeQueryDegradeReason` (`packages/shared/src/runtime/knowledge-query.ts`): `knowledge_unavailable | no_approved_match | language_unavailable | scope_empty | retrieval_timeout`.
- The packet's degraded block uses `DegradedContextReason` (`packages/shared/src/runtime/context-packets.ts:258`): `knowledge_unavailable | translation_unavailable | private_context_unavailable | relationship_context_unavailable | retrieval_timeout | partial_system_failure`.
- Today `defaultDegradedState()` in `contextManager.ts` hardcodes `reasons: ['knowledge_unavailable']` and a single generic `safeFallbackInstruction`, **regardless of the actual retrieval reason**. A `language_unavailable` miss and a `no_approved_match` miss are indistinguishable to the agent.

P4.9 is the **mapping** from the retrieval vocabulary to a specific `DegradedContextState`.

## 3. What exists to build on

- `buildContextPacket` already accepts a caller-supplied `input.degraded: DegradedContextState`
  and `input.packetStatus: 'degraded'` — the seam to inject an upgraded state without touching
  the assembler.
- `validateContextPacket` (`validation.ts:321-329`) requires a `degraded` block with a string
  `safeFallbackInstruction` on a degraded/failed packet — the upgrade must satisfy this.
- P4.8 observability now records the degrade reasons, so the effect of a better fallback is
  measurable.
- The P4.5 enrichment test pins the *existing* generic degraded wording — P4.9 must not change
  `defaultDegradedState()` (that default remains the last-resort), only add a reason-aware
  resolver the caller opts into.

## 4. Scope decision (additive, server-side, pure)

- New pure module `server/src/runtime/context/safeFallback.ts`:
  - `resolveSafeFallbackState({ degradeReasons, requestedLanguage, fallbackLanguage? })
    : DegradedContextState` — maps each retrieval reason to a `DegradedContextReason` + a
    specific safe guidance fragment, dedupes reasons, and assembles one compliant
    `safeFallbackInstruction` + `missingSections`.
  - `safeFallbackFromResult(result)` — convenience bridge: returns `{ packetStatus: 'degraded',
    degraded }` for a degraded `approved_knowledge_query.v1` result (or `null` when ok), ready to
    spread into `buildContextPacket` input.
- Tests: unit (per-reason mapping, multi-reason combine, language phrasing, defensive empty) +
  integration (retrieval degrade → resolver → `buildContextPacket` → valid degraded packet) +
  static governance.
- **No shared-type change** (both reason unions and `DegradedContextState` already exist).
- **`contextManager.ts` and its `defaultDegradedState()` are untouched** — the resolver is opt-in
  via the existing `input.degraded` seam, so every existing packet/test is unchanged.

## 5. Compliance discipline

Every fallback instruction is a generic *safe directive*: proceed on identity/rules/guardrails,
ask a clarifying question, never infer or fabricate missing knowledge, and — for a language miss
— never present a machine translation as approved (consistent with P4.6). The strings carry no
knowledge content and none of the five `.com`-prohibited items; degraded packets are BA-facing.

## 6. Invariants to preserve

- Degraded packet still carries **empty** approved knowledge (fail-closed) — the upgrade only
  changes the *instruction/reasons*, never re-introduces knowledge.
- Deterministic, pure resolver; content-free strings.
- `defaultDegradedState()` remains valid as the last-resort default; the resolver is additive.
- Context Manager remains the sole assembler; the resolver assembles no packet.

## 7. Stop conditions

- If a specific fallback required inventing a `DegradedContextReason` outside the shared union →
  stop (map to the closest existing reason instead).
- If upgrading required editing `defaultDegradedState()` and breaking the P4.5 wording test →
  stop (use the opt-in `input.degraded` seam).
- If a fallback instruction would need to surface knowledge content to be useful → stop
  (fail-closed: no content in a degraded packet).

**Verdict: READY.** The reason vocabularies and the injection seam are both known; P4.9 is a
pure mapping resolver + a convenience bridge, additive and provable against the existing
assembler.
