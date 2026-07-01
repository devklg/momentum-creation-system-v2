# P4.11 — Retrieval Canary — Scenario Plan (Agent B)

## Momentum Creation System V2 · Phase 4 · Slice P4.11

Controlled, deterministic, test-only scenarios. The canonical wiring under test:

```
injected provider → createContextManagerRetrievalAdapter(provider, { now, onRetrievalObservability })
  → retrieveApprovedKnowledge(request)                 (P4.4/6/7 + P4.8 sink)
  → toContextReferences(result)                        (P4.6 per-item marking)
  → buildContextPacket({ …, knowledgeReferences, …safeFallbackFromResult(result) })  (sole assembler; P4.9 on degrade)
  → consumeContextPacket({ expectedAgentKey:'michael_magnificent', packet })          (real validation)
  → selectMichaelResponseCatalogEntry({ scenarioFamily=packetStatus, responseType, language, intent }) → catalogKey
  → resolveNextTrainingStep({ result, completedKnowledgeIds })                          (P4.10, when complete)
```

All inputs are deterministic (fixed `now`, fixed provider). All outputs asserted are content-free:
catalog keys, approved reference ids, counts, degrade-reason enums, language-marking enums.

---

## Scenario 1 — Empty / degraded knowledge → safe fallback

**Input:** provider returns `[]`; `michael_magnificent` / `training_support` / `en`.
**Expected:**
- retrieval `degraded`, `degradeReasons` includes `no_approved_match`.
- `toContextReferences` → `[]`; packet `packetStatus: 'degraded'`, `approvedKnowledge: []`.
- `consumeContextPacket` → `decision: 'degraded'`, `packetStatus: 'degraded'`.
- `selectMichaelResponseCatalogEntry` → `michael_safe_fallback_degraded_en` (`responseType: 'safe_fallback'`).
- `resolveNextTrainingStep` → `unavailable` + P4.9 safe fallback.
- No fabrication, no generated text (fixture is pre-authored), no raw content emitted.

## Scenario 2 — Approved knowledge available → substantive selection

**Input:** provider returns approved, active, fresh, retrieval-eligible `en` `training` references.
**Expected:**
- retrieval `ok`; approved references present.
- packet `packetStatus: 'complete'`; `approvedKnowledge` contains the expected reference ids.
- `consumeContextPacket` → `decision: 'proceed'`.
- `selectMichaelResponseCatalogEntry` (clear intent) → `michael_next_training_step_en`
  (`responseType: 'next_training_step'`, `response.agentResponseGenerated === false`).
- `resolveNextTrainingStep` → `resolved`, step = first approved reference.
- No generated text.

## Scenario 3 — Exclusion controls

**Input (mixed):** one approved-active-fresh-`en`-`training` reference PLUS:
candidate (status cast), deprecated (lifecycle), archived (lifecycle), rejected (status cast),
stale (`updatedAt` + `maxAgeDays` policy), wrong-language (`es`), wrong-domain (`relationship`);
and, via the P4.5A intake path, a **parse-failed** chunk that maps to zero references.
**Scope note:** the retrieval adapter applies **no** post-hoc scope filter — scope is enforced at
the provider / Knowledge Core boundary (P4.3). "Wrong-scope excluded" is proven as **scope-bound
retrieval**: a scope-capturing provider confirms the adapter forwards `request.scope` verbatim and
never widens it. (candidate/rejected/archived exclusion is proven via status; deprecated/stale via
the freshness guard; wrong-domain/wrong-language via non-match.)

**Expected:**
- packet `approvedKnowledge` contains **only** the single approved-eligible reference.
- candidate/rejected/archived appear in `excluded`; deprecated/stale dropped by the freshness
  guard; wrong-domain/wrong-language are non-matches; parse-failed chunk → zero references.
- scope-bound: the provider receives exactly `request.scope`.
- P4.8 observability (via sink) counts exclusions **without any content leakage** (record has no
  body/summary/text fields).
- **All-excluded variant** (remove the one approved item) → retrieval degrades → Scenario-1 safe
  fallback.

## Scenario 4 — Language / fallback behavior

**Inputs & Expected:**
- `en` request + `en` approved → `ok` `en`; select `michael_next_training_step_en`.
- `es` request + `es` approved → `ok` `es`; select `michael_next_training_step_es`.
- `en` request + `es` `human_reviewed_translation`, `allowLanguageFallback: true` → `ok` fallback:
  delivered `es`, batch `translationStatus: 'human_reviewed_translation'` (marked, not native).
- `en` request + `es` `machine_translation_marked`, fallback allowed → `machineTranslationUsed:
  true`, `translationStatus: 'machine_translation_marked'` in the packet — **never laundered as
  `same_language`**.
- **Unsupported language** request (e.g. `fr`) → the P4.2 request validator rejects it (adapter
  throws) — fails closed; no packet, no selection.

---

## Governance tripwires (Agent D, static + behavioral)

1. no `/api/runtime/*` anywhere in the context retrieval layer or `server/src/index.ts`;
2. no `.com` wiring of retrieval;
3. no store/Gateway/LLM import in the context retrieval production files;
4. no route direct-store access for runtime retrieval;
5. Context Manager (`buildContextPacket`) remains the sole assembler; the canary and orchestration
   selection assemble no packet;
6–12. candidate / review-only / deprecated / archived / stale / rejected / wrong-scope excluded
   (behavioral, Scenarios 1–4);
13. degraded empty → safe fallback (Scenario 1);
14. approved eligible → expected fixture selection (Scenario 2);
15. no LLM / dynamic generation (static: no `anthropic`/`generate*`/`llm`; fixtures pre-authored);
16. no persistence of runtime outputs (static: no store/Gateway write in the layer);
17. observability content-free (Scenario 3 + static key-allowlist).
