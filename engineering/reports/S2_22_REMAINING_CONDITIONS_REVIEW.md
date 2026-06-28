# S2.22 Remaining Conditions Review

- Sprint: Sprint 2 - Agent Runtime Activation
- Slice: S2.22 Michael Activation Charter Closeout — review/plan of the three carried-forward S2.21 conditions
- Status: PLANNING / GOVERNANCE / DOCUMENTATION ONLY (no production code, tests, routes, UI, or `.com` modified; no commit; no builds/LLMs/DB run; no scanner/contract/harness change implemented)
- Architecture version: v1.0 frozen
- Date: 2026-06-28
- Owner: Agent B (remaining-conditions review/planning)
- Branch: `review/s2.22-michael-activation-charter-closeout`
- Inputs: S2.21 decision gate (`SPRINT_002_S2_21_MICHAEL_INERT_RUNTIME_READINESS_DECISION_GATE.md`), S2.21 safety guardrail review (`S2_21_MICHAEL_SAFETY_GUARDRAIL_REVIEW.md`), Kevin's recorded S2.21-close decisions

## Executive Summary

S2.21 closed PASS WITH CONDITIONS over a verified inert Michael runtime chain. Three conditions carry forward. This report reviews and **plans** each — it implements none. Verdict per condition:

- **Condition 1 (duplicate S2.13 harness)** — Kevin has already ruled: KEEP as test-only, NOT part of the activation path. This report confirms the files are test/fixture-only with no production consumer and recommends paste-ready documentation language to record that ruling at the source.
- **Condition 2 (ES content scanner)** — Confirmed the scanner is English-lexicon-only. The inert fixtures-only path generates no text, so an ES scanner is **not** a prerequisite for the inert facade, but **is** a prerequisite for any future live (non-fixture) Spanish generation. No scanner is approved or implemented in S2.22.
- **Condition 3 (`failed → safe_close` strictness)** — Confirmed the adapter enforces `failed → safe_close` while the response contract alone permits `failed → safe_fallback OR safe_close`. No live gap exists today (the facade routes only through the adapter). Recommend documenting contract-level strictness as a pre-requisite to be added if/when a non-adapter contract consumer is ever introduced. No contract change is approved or implemented in S2.22.

Nothing in this report approves a route, persistence, an LLM, voice, a scanner, or any contract/harness change.

---

## Condition 1 — Duplicate S2.13 Harness (KEEP as test-only)

**Kevin decision (recorded at S2.21 close):** the S2.13 scenario-driven fixture harness is *retained, explicitly documented as a test-only fixture harness, and is NOT part of the activation path*. The canonical runtime path for any future activation is the S2.17–S2.20 catalog → selector → derivation → facade chain. This section supplies the evidence and the documentation language to satisfy that ruling.

### 1. Files and what they export

- `server/src/runtime/orchestration/fixtures/michaelRuntimeResponseHarness.ts`
  - Exports `createMichaelRuntimeResponseFixtureHarness()` (factory returning a `{ runScenario }` harness object) and `runMichaelRuntimeResponseFixtureScenario(options)` (async function).
  - `runMichaelRuntimeResponseFixtureScenario` resolves a scenario by name via `getMichaelRuntimeResponseScenario`, runs the inert runtime-turn fixture scenario (`runRuntimeTurnFixtureScenario`), selects the response fixture directly by `scenario.responseFixtureKey` (`selectValidatedMichaelResponseFixture` indexing `michaelResponseFixtures[...]`), validates it with `validateMichaelResponseContract`, and returns a result with every persistence channel `'disabled'`, `behavior: 'not_implemented'`, and `agentResponseGenerated: false`.
- `server/src/runtime/orchestration/fixtures/michaelRuntimeResponseScenarios.ts`
  - Exports the `michaelRuntimeResponseScenarios` table (13 named scenarios), `michaelRuntimeResponseScenarioEntries`, `michaelRuntimeResponseScenarioNames`, `getMichaelRuntimeResponseScenario(...)`, and the `MichaelRuntimeResponseScenario*` types.
  - Each scenario maps a `scenarioName` **directly to a `responseFixtureKey`** (e.g. `failed_context_packet → safeCloseFailedContextPacket`). This is the "second resolution surface": a scenario-name → fixture-key lookup that bypasses the S2.17–S2.20 catalog → selector → derivation → facade chain. Every scenario is stamped `fixtureOnly: true`, `persistence: 'disabled'`, `agentResponseGenerated: false`.

### 2. Confirmed test-only / fixture-only (no production consumer)

Functional consumers of these exports are **only `__tests__` files** — five of them:

- `server/src/runtime/orchestration/__tests__/michaelRuntimeResponseHarness.test.ts`
- `server/src/runtime/orchestration/__tests__/michaelRuntimeResponseScenarios.test.ts`
- `server/src/runtime/orchestration/__tests__/michaelRuntimeResponseIntegration.test.ts`
- `server/src/runtime/orchestration/__tests__/s213MichaelRuntimeResponseGovernanceBoundary.test.ts`
- `server/src/runtime/orchestration/__tests__/michaelRuntimeAdapterContractGuardrails.test.ts`

The only non-test references are **append-only barrel re-exports**, which surface the symbols but do not exercise them: `fixtures/index.ts` (lines 6-23), `orchestration/index.ts` (lines 106, 110-111), and `runtime/index.ts` (lines 122, 143-144). A grep of `server/src/routes/` and of `apps/` for every harness/scenario symbol returns **zero** files — no route, no `.team`/`.com`/`.admin` UI, and no persistence/service module consumes them. They are inert and fully tested (not dead code), but they are not on any activation path.

### 3. Confirmed they must NOT be used for activation

Confirmed, and ratified by Kevin's S2.21-close ruling. The harness resolves a response by a **single direct `scenarioName → responseFixtureKey` map** (`michaelRuntimeResponseScenarios.ts:230-249` build + `michaelRuntimeResponseHarness.ts:54-76` lookup). It does **not** run the governance-bearing chain links — the selector's explicit `(scenarioFamily|responseType)` mapping table, the selection-request derivation that reads only redacted classification off the already-inert adapter response, or the facade's redacted-trace construction. Using it for activation would re-introduce a divergent resolution path and defeat the single-canonical-path guarantee the S2.17–S2.20 chain was built to provide. Activation must route exclusively through the S2.17–S2.20 catalog → selector → derivation → facade chain.

### 4. Recommended documentation language (paste-ready)

Recommend adding the following header comment block atop **both** `fixtures/michaelRuntimeResponseHarness.ts` and `fixtures/michaelRuntimeResponseScenarios.ts`, and recording the same note in the S2.22 charter. (Recommendation only — Agent B does not apply this edit in S2.22.)

```text
// TEST-ONLY FIXTURE HARNESS — NOT AN ACTIVATION PATH.
//
// This S2.13 scenario-driven harness maps a scenario name directly to a
// response fixture key. It exists solely to exercise the inert response
// fixtures from tests. It is consumed only by __tests__ files; no route,
// service, persistence layer, or UI imports it.
//
// Per Kevin's S2.21-close decision (2026-06-28), this harness is RETAINED
// as a test-only fixture harness and is explicitly NOT part of the Michael
// activation path. The single canonical runtime resolution path for any
// future activation is the S2.17–S2.20 chain:
//   adapter contract -> selection-request derivation
//     -> catalog selector -> catalog entry
//     -> validated response fixture -> inert resolution facade -> redacted trace.
// Do NOT add a production consumer of this harness. Do NOT use it to resolve
// a live Michael response. New activation work resolves through the facade.
```

Charter line (for the S2.22 Activation Charter document): *"The S2.13 scenario-driven fixture harness (`fixtures/michaelRuntimeResponseHarness.ts` + `fixtures/michaelRuntimeResponseScenarios.ts`) is a test-only fixture harness, retained and not scheduled for retirement. It is not part of the activation path. All activation routes through the S2.17–S2.20 catalog → selector → derivation → facade chain. Condition 1 is resolved as documentation."*

---

## Condition 2 — ES Content Scanner

### 1. Current scanner is English-lexicon-only

Confirmed. `PROHIBITED_TEXT_PATTERNS` (`michaelResponseContract.ts:74-103`) and `SAFE_CLOSE_SUBSTANTIVE_TRAINING_PATTERN` (`:105-106`) match English lexemes: income/earnings/commission/compensation/paycheck, placement/guarantee/spillover/binary leg, cycle/cv/volume points, medical advice/diagnose/cure/prescribe, THREE approved/THREE authority, send this to your prospect/lead, auto-send/call prospects/prospecting list, and the safe-close guard's open/review/practice/complete/start/continue + module/lesson/training/script/next step. The **numeric/currency triggers are language-agnostic** — `\$\s?\d` and `make \$?\d` in the `income_claim` pattern fire regardless of language. The **lexical** terms are English-only; Spanish equivalents (ingresos, ganancias, comisión, colocación, etc.) are not in the set.

### 2. ES fixture safety currently rests on authoring + governance review

Confirmed. The `es` substantive fixtures (`next_training_step`, `clarification_question`) and the `es` safe-path fixtures pass `validateMichaelResponseContract` because the English regexes do not flag compliant Spanish prose — not because an ES scanner cleared them. A Spanish safe-close embedding substantive guidance (e.g. *abre el módulo*) would not be regex-caught; today the ES fixtures are correctly hand-authored to avoid it (per S2.21 Agent B §24). The ES guarantee is therefore **fixture authoring discipline plus governance review**, not regex enforcement. Note that every catalog/fixture entry IS run through the (English) scanner via `validateMichaelResponseContract`, so the catalog cannot ship text that trips the English scanner — the limitation is purely the scanner's lexical coverage for Spanish.

### 3. Recommendation — ES scanner is a prerequisite for live ES generation, not for the inert facade

The inert, fixtures-only path **generates no text** — it returns pre-authored fixtures by reference. An ES content scanner is therefore **not required for the current inert facade** and is **not required to close Sprint 2**. It **becomes a hard prerequisite the moment any live (non-fixture) Spanish text generation is contemplated** — i.e. before `agentResponseGenerated` could ever flip to `true` for an `es` response, or before any dynamic ES drafting surface is enabled. Recommendation: record in the S2.22 charter that an approved ES content scanner (or an equivalent ES-trained content-safety control) is a named precondition on the Sprint 3 "response-generation scope" decision for Spanish, gating any live ES generation. Until then, ES safety remains authoring + governance review over a fixed catalog, which is acceptable for the inert foundation.

### 4. Minimum ES scanner terms (if/when implemented)

If an ES scanner is later approved, the minimum lexical floor (mapping to the existing English categories) should include at least:

| Category (parallels EN pattern) | Minimum ES terms |
|---|---|
| income / compensation | `ingresos`, `ganancias`, `comisión`, `compensación` |
| placement / guarantee | `colocación`, `garantizado` |
| medical | `médico`, `salud` |
| prospect-facing / automatic action | `prospecto`, `automático`, `llamar`, `enviar` |

Full floor list: **ingresos, ganancias, comisión, compensación, colocación, garantizado, médico, salud, prospecto, automático, llamar, enviar.** This is a documented minimum starting set, not an implementation spec; real coverage would also need diacritic-insensitive and inflection-aware matching (e.g. comisión/comision, ganancia/ganancias) and a safe-close ES substantive-guidance pattern paralleling `SAFE_CLOSE_SUBSTANTIVE_TRAINING_PATTERN`.

### 5. No scanner implementation approved in S2.22

Explicitly: **no ES content scanner is implemented, approved, or scheduled by S2.22.** This is documentation and a named precondition only. No edit to `PROHIBITED_TEXT_PATTERNS`, the language enum, or any validator is made or authorized here.

---

## Condition 3 — `failed → safe_close` Contract Strictness

### 1. The adapter enforces `failed → safe_close`

Confirmed. `runMichaelRuntimeAdapterContract` maps `consumption.decision === 'block_substantive'` OR `consumption.packetStatus === 'failed'` to `selectResponse(input, 'failed_context', 'safe_close', 'failed', safeLanguage)` (`michaelRuntimeAdapterContract.ts:122-124`). The adapter always closes on a failed context; it never emits a `safe_fallback` for `failed`. `runtimeStatusFor('failed_context')` returns `'blocked'` (`:466-468`).

### 2. The contract alone permits `failed → safe_fallback OR safe_close`

Confirmed. `validateContextPacketStatusBehavior` (`michaelResponseContract.ts:329-359`) bars substantive responses on `failed`/`missing`/`rejected` — it permits **only `safe_fallback` or `safe_close`** for those statuses (`:336-348`). It then adds a `rejected`-specific rule requiring `safe_close` (`:350-358`), but adds **no equivalent rule for `failed`**. Consequently the response contract, evaluated on its own, would accept a `failed`-context `safe_fallback` as valid. The stricter `failed → safe_close` guarantee exists **only in the adapter**, not in the contract validator.

### 3. Recommendation — add contract-level strictness as a documented pre-req before any non-adapter consumer exists

There is **no live gap today**: the resolution facade and the entire S2.17–S2.20 chain route exclusively through the adapter, so `failed` always yields `safe_close` in practice. The risk is latent — a future *direct* contract consumer that bypasses the adapter could legitimately emit a `failed`-context `safe_fallback`. Recommendation: record in the S2.22 charter that **contract-level `failed → safe_close` strictness is a named pre-requisite to be added if/when any non-adapter consumer of `validateMichaelResponseContract` is introduced.** The concrete future change (not made here) would be a parallel rule in `validateContextPacketStatusBehavior` mirroring the existing `rejected_context_requires_safe_close` clause — e.g. a `failed_context_requires_safe_close` issue when `packetStatus === 'failed'` and `responseType !== 'safe_close'`. Adding it now is optional hardening with no behavioral effect on the current chain; adding it before a non-adapter consumer ships is the trigger condition. This keeps the contract and adapter from diverging at the moment a second consumer would make the divergence reachable.

### 4. No contract change approved in S2.22

Explicitly: **no change to `michaelResponseContract.ts`, `validateContextPacketStatusBehavior`, or any validator is made, approved, or scheduled by S2.22.** This is documentation and a named pre-requisite only.

---

## Disposition of the Three Conditions

| Condition | Status entering S2.22 | Recommended disposition |
|---|---|---|
| 1 — Duplicate S2.13 harness | Kevin ruled KEEP as test-only | Resolve as documentation: add source-header note + charter line marking it test-only, pointing activation at S2.17–S2.20 chain |
| 2 — ES content scanner | Open | Not required for inert facade; named precondition for any live ES generation in Sprint 3; minimum term floor recorded; no implementation in S2.22 |
| 3 — `failed → safe_close` strictness | Open | No live gap today; documented pre-requisite to add contract-level strictness if/when a non-adapter contract consumer is introduced; no contract change in S2.22 |

## Non-Approval Statement

This planning report approves nothing for activation and changes no code. No route, no `/api/runtime/*` mount, no persistence, no LLM, no dynamic response generation, no voice/Telnyx/PSTN, no ES scanner, no contract edit, and no harness edit are implemented, approved, or scheduled here. The three dispositions above are inputs to the S2.22 Michael Activation Charter, which is owned by Agent E. This report does not create the final S2.22 charter/closeout report.
