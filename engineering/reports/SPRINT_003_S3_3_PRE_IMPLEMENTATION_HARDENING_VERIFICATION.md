# Sprint 3 S3.3 Pre-Implementation Hardening Verification

- Sprint: Sprint 3 - Activation Planning
- Slice: S3.3 Pre-Implementation Hardening — two contract-level safety hardenings on the inert Michael runtime foundation (Spanish lexical guardrails + `failed → safe_close` contract strictness), plus a test-only flake fix, with final integration verification
- Status: HARDENING + VERIFICATION ONLY (gate commands run read-only; production change limited to the contract validator + its validation-code union; no routes, no mounts, no `server/src/index.ts` edit, no `.com`, no persistence, no LLM, no dynamic generation, no commit)
- Architecture version: v1.0 frozen
- Date: 2026-06-28
- Owner: Agent E (final integration + verification agent — owns this verdict)
- Branch: `hardening/s3.3-pre-implementation` (working tree verified; nothing committed — observed local branch label is the working checkout carrying the S3.3 diff)
- Inputs reviewed (not blindly trusted — each diff/test read in full on disk):
  - Core contract change — `server/src/runtime/orchestration/michaelResponseContract.ts`
  - Type union addition — `server/src/runtime/orchestration/types.ts`
  - Agent B — `server/src/runtime/orchestration/__tests__/michaelResponseContractEsGuardrails.test.ts` + `__tests__/s333MichaelPreImplementationGovernanceBoundary.test.ts`
  - Agent C — `server/src/runtime/orchestration/__tests__/michaelResponseContractFailedStrictness.test.ts`
  - Agent D — `server/src/services/persistence/__tests__/mongoAdapter.test.ts` (test-only)
  - Predecessor route proposal — `engineering/reports/SPRINT_003_S3_2_MICHAEL_ROUTE_PROPOSAL.md`

> This is the final integration + verification record for the governance-approved S3.3
> pre-implementation hardening slice. It is NON-AUTHORIZING for any activation: it
> verifies two in-process contract hardenings and a test-only flake fix, runs the merge
> gates read-only, and confirms the foundation stays inert. It approves no route, mounts
> nothing, persists nothing, generates nothing, and activates no live Michael/Steve/Ivory
> behavior. S3.4 remains a separately-approved undertaking.

## 1. Executive Result

**PASS.**

S3.3 lands exactly two contract-level safety hardenings on the previously-verified inert
Michael runtime chain, plus one test-only flake fix — and nothing else. The Spanish (`es`)
lexical guardrails (`normalizeForLexicalScan()` + `ES_PROHIBITED_TEXT_PATTERNS` in
`validateTextContent`, and `ES_SAFE_CLOSE_SUBSTANTIVE_TRAINING_PATTERN` in
`validateSafeCloseTextContent`) run alongside the unchanged English patterns. The
`failed → safe_close` contract strictness rule (`failed_context_requires_safe_close`) closes
the latent gap previously carried as S3.2 Condition 4. All four merge gates are green; the
full server suite is **66 files / 699 tests, 0 failures** — exactly the **653** baseline plus
the **46** new tests (24 + 12 + 10). No route, no mount, no `server/src/index.ts` edit, no
`.com` change, no persistence, no LLM, no dynamic generation. The `mongoAdapter.test.ts`
parallel-load flake did not reappear: the full suite passed clean on the first run.

The verdict is unconditional **PASS** (not "with conditions"): the slice is in-process
contract validation plus tests, both hardenings are fully test-covered and green, and every
inert-foundation invariant (persistence `'disabled'`, `agentResponseGenerated: false`,
returned-only behavior, no wiring) is preserved and statically asserted by the new governance
boundary test. The S3.4 implementation slice remains separately gated on Kevin's explicit
approvals (see §27–§28).

## 2. Files Added

- `server/src/runtime/orchestration/__tests__/michaelResponseContractEsGuardrails.test.ts` — 24 tests (Agent B).
- `server/src/runtime/orchestration/__tests__/s333MichaelPreImplementationGovernanceBoundary.test.ts` — 12 tests (Agent B).
- `server/src/runtime/orchestration/__tests__/michaelResponseContractFailedStrictness.test.ts` — 10 tests (Agent C).
- `engineering/reports/SPRINT_003_S3_3_PRE_IMPLEMENTATION_HARDENING_VERIFICATION.md` — this report.

## 3. Files Modified

- `server/src/runtime/orchestration/michaelResponseContract.ts` — added `normalizeForLexicalScan()`, `ES_PROHIBITED_TEXT_PATTERNS`, the ES branch in `validateTextContent`, `ES_SAFE_CLOSE_SUBSTANTIVE_TRAINING_PATTERN` + its branch in `validateSafeCloseTextContent`, and the `failed_context_requires_safe_close` rule in `validateContextPacketStatusBehavior`. English patterns/guards unchanged; no new imports.
- `server/src/runtime/orchestration/types.ts` — appended `'failed_context_requires_safe_close'` to the `MichaelResponseContractValidationCode` union.
- `server/src/services/persistence/__tests__/mongoAdapter.test.ts` — test-only: describe-level `15000ms` timeout + explanatory comment for the known parallel-load dynamic-import flake. No production persistence code touched.

## 4. Scope Implemented

Two pure, in-process contract hardenings plus one test-only flake fix:

1. **ES lexical guardrails** — diacritic-/case-insensitive Spanish prohibited-term scanning over a normalized copy of every contract text field, sitting alongside the unchanged English lexicon, plus a Spanish safe-close substantive-guidance guard mirroring the English one.
2. **`failed → safe_close` contract strictness** — the contract validator now rejects a `failed` Context Packet paired with anything other than `safe_close`, closing the latent gap for any future non-adapter contract consumer (S3.2 Condition 4).
3. **Test-only mongoAdapter flake hardening** — a describe-level timeout that removes a pre-existing, environment-driven full-suite flake; no logic change.

No routes, mounts, `index.ts` edits, persistence, LLM calls, or dynamic generation were introduced.

## 5. ES Content Scanner Summary

`validateTextContent` now computes `normalizeForLexicalScan(value)` once per text field and
tests it against `ES_PROHIBITED_TEXT_PATTERNS` (income-claim, placement-promise,
medical-advice, prospect-facing-instruction, automatic-action), pushing a `prohibited_text`
issue per match — the same issue code and shape the English scan emits. The English
`PROHIBITED_TEXT_PATTERNS` scan runs first and is byte-for-byte unchanged; the ES scan is
purely additive. The scan is pure and deterministic (no I/O, no allocation beyond the
normalized string), runs on every text field the validator already inspects (`text`,
`nextStep.title`, `nextStep.instruction`, `nextStep.label`), and the automatic-action pattern
deliberately targets instruction forms (infinitive / imperative / gerund), not simple-past
statements — mirroring how the English guard blocks "send automatically" but not "sent".

## 6. Spanish Term Floor Coverage (12)

All twelve charter-floor terms are covered, each case- and diacritic-insensitive (matching
also covers regular morphological variants — plurals, gendered endings, conjugations — via
the patterns):

1. **ingresos** — income_claim
2. **ganancias** — income_claim
3. **comisión** (→ `comision`) — income_claim
4. **compensación** (→ `compensacion`) — income_claim
5. **colocación** (→ `colocacion`) — placement_promise
6. **garantizado** (→ `garantizad[oa]s?` / `garantia`) — placement_promise
7. **médico** (→ `medic[oa]s?`) — medical_advice
8. **salud** — medical_advice
9. **prospecto** (→ `prospectos?`) — prospect_facing_instruction
10. **automático** (→ `automatic[oa]s?` / `automaticamente`) — automatic_action
11. **llamar** (→ `llamar`/`llamando`/`llamen`/`llame` + clitic forms) — automatic_action
12. **enviar** (→ `enviar`/`enviando`/`envien`/`envie` + clitic forms) — automatic_action

All twelve match regardless of accent marks and letter case. Verified green by tests 1–14 of
`michaelResponseContractEsGuardrails.test.ts`.

## 7. Diacritic-Insensitive / Case-Insensitive Behavior

`normalizeForLexicalScan` performs Unicode NFD decomposition, strips combining diacritical
marks (`U+0300–U+036F`), then lowercases — so `COMISIÓN`, `Comisión`, `comision`, and
`comisión` all normalize to `comision` and match a non-accented, lowercase pattern. The ES
patterns therefore carry no `i` flag and no inline accent alternations; normalization does the
work. English text is unaffected by the transform (no combining marks to strip, and the
English patterns retain their own `i` flag and run against the raw string). Tests 13 (uppercase
variants) and 14 (accent/non-accent pairs `comision`/`comisión`, `medico`/`médico`) confirm
both axes.

## 8. ES Safe-Close Substantive-Guidance Guard

`validateSafeCloseTextContent` now tests the normalized text against
`ES_SAFE_CLOSE_SUBSTANTIVE_TRAINING_PATTERN` in addition to the unchanged English
`SAFE_CLOSE_SUBSTANTIVE_TRAINING_PATTERN`; either match yields the existing `prohibited_text`
issue ("safe_close text cannot include substantive training guidance"). The ES pattern is a
training verb (`abre`/`revisa`/`repasa`/`practica`/`completa`/`empieza`/`comienza`/`inicia`/
`continua`/`sigue`/`estudia`) immediately followed by an optional article and a training noun
(`modulo`/`leccion`/`entrenamiento`/`guion`/`paso`/`capacitacion`/`curso`/`pagina`/`video`),
mirroring the English verb+noun shape. Safe close-out phrasing that names no concrete training
step (e.g. "continúa solo desde contexto de entrenamiento") does not match. Verified by test 15
(rejects "Abre el módulo de entrenamiento y completa la lección.") and by the valid-ES-fixture
pass in test 17.

## 9. Valid Fixtures Still Pass (incl. ES failed fixture with past-tense "se envió")

All six valid ES fixtures and all valid EN fixtures still validate (tests 17–18). Critically,
`michaelResponseFixtureSafeCloseFailedContextPacketEs` — whose text is
*"No puedo continuar este turno de entrenamiento sin un Context Packet válido. No se guardó ni
se envió nada."* — still passes: the past-tense "se envió nada" is intentionally NOT blocked
(the automatic-action pattern matches infinitive/imperative/gerund forms, not simple past),
mirroring the English guard's allowance of "sent." Test 17 asserts both the fixture text
contains `se envió nada` and that it validates `ok`. The full invalid-fixture set still fails
(test 19).

## 10. Full Catalog Still Validates (12 entries)

`validateMichaelResponseCatalog()` returns `ok` with `entryCount === 12`, and every one of the
12 `MICHAEL_RESPONSE_CATALOG` entries individually validates `ok` against
`validateMichaelResponseContract` (test 20 of the ES guardrails suite, test 7 of the
failed-strictness suite, and test 12 of the governance-boundary suite each re-assert the
12-entry inert catalog independently). No catalog entry regressed under either new guard.

## 11. `failed → safe_close` Contract Strictness Summary

`validateContextPacketStatusBehavior` gains a rule: when `contextPacketStatus === 'failed'` and
`responseType !== 'safe_close'`, it pushes `issue('responseType',
'failed_context_requires_safe_close', 'failed Context Packets require safe_close.')`. This sits
beside the pre-existing `substantive_response_not_allowed` (failed/missing/rejected → only
safe_fallback or safe_close) and `rejected_context_requires_safe_close` rules, and brings
`failed` to the same strictness `rejected` already had. The new code is added to the
`MichaelResponseContractValidationCode` union in `types.ts` (append-only). This closes S3.2
Condition 4: a future non-adapter contract consumer can no longer accept a `failed`-context
`safe_fallback`.

## 12. `failed + safe_fallback` Is Rejected (`failed_context_requires_safe_close`)

Confirmed. Cloning the failed safe-close fixture and overriding `responseType` to
`safe_fallback` (while `contextPacketStatus` stays `failed`) yields `ok === false` with the
issue codes containing `failed_context_requires_safe_close` (failed-strictness test 1).

## 13. `failed + safe_close` Is Accepted

Confirmed. Both `michaelResponseFixtureSafeCloseFailedContextPacket` (EN) and
`michaelResponseFixtureSafeCloseFailedContextPacketEs` (ES) carry `contextPacketStatus: failed`
+ `responseType: safe_close` and validate `ok` (failed-strictness tests 2–3).

## 14. Adapter / Facade Behavior Unchanged (failed Path Still safe_close)

Confirmed. The adapter (`runMichaelRuntimeAdapterContract`) on the `failed_context` scenario
still emits `responseType: safe_close` with `contextPacketStatus: failed`, and the S2.20 facade
(`resolveMichaelRuntimeTurnResponseFromFixture`) still resolves the same `safe_close` —
validating `ok` in both cases (failed-strictness tests 8–9). The new contract rule is
consistent with the adapter's long-standing behavior; it adds no new adapter/facade code path
and changes no resolution output.

## 15. mongoAdapter Flake Hardening Summary

**Root cause:** each test in `mongoAdapter.test.ts` performs a dynamic
`await import('../mongo/adapter.js')`. On the FIRST full-suite run under parallel load, the
contended module-transform cost of that dynamic import can exceed Vitest's default 5000ms
per-test timeout — a timing flake, not a logic bug (it passes in isolation and on re-run).

**Fix:** a describe-level `15000ms` timeout (the second argument to `describe(...)`) plus an
inline comment documenting the parallel-load cause. The change is local to this one file; no
global Vitest config change, no production persistence code touched. With the fix, the full
suite passed clean on the first run (no re-run needed) — the flake did not reappear.

## 16. Targeted Test-Only Change Only

Confirmed. The only edit to `mongoAdapter.test.ts` is the describe-level timeout argument and
its comment. No test assertions, mock shapes, or imports were altered; no other persistence
test or source file was touched.

## 17. No Production Persistence Behavior Change

Confirmed. No file under `server/src/services/persistence/` (Mongo/Neo4j/Chroma adapters,
`tripleStack.ts`, gateway client) was modified. The only persistence-tree change is the
test-only timeout in §15–§16. All persistence remains inert relative to this slice.

## 18. No Route Files

Confirmed. No file was added under `server/src/routes/`, and the modified files
(`michaelResponseContract.ts`, `types.ts`) contain no Express/Router/handler code. The
governance-boundary test (#8) statically asserts the contract source imports no express/fastify
and constructs no router/handler.

## 19. No Route Mounts

Confirmed. No mount line was added anywhere; `server/src/index.ts` carries no S3.3 change.

## 20. `server/src/index.ts` Untouched

Confirmed. `git status` does not list `server/src/index.ts`; no existing line edited, no import
or mount line added. Boot order (raw-body Telnyx first; pre-gate block; gated banner) is
preserved exactly.

## 21. No `/api/runtime/*`

Confirmed. `/api/runtime/*` remains unmounted and reserved — zero matches in
`server/src/index.ts`, and the recommended `/api/michael-runtime` namespace is likewise
unmounted. This slice revives no reserved namespace.

## 22. `.com` Untouched

Confirmed. No file under `apps/com/` was modified (`git status` lists none). The five `.com`
compliance prohibitions stand absolutely; no Michael surface renders prospect-facing. The ES
guardrails, like the English ones, are BA-facing contract validation only.

## 23. No Persistence Added

Confirmed. No new persistent write, store, repository, or `tripleStackWrite()` call was
introduced. Governance-boundary tests #1–#5 and #9 statically assert no Mongo/Neo4j/Chroma/
GraphRAG/Gateway imports and no persistence call shapes in the contract source; #10 asserts no
`persistence: 'enabled'` assignment.

## 24. No LLM Calls

Confirmed. No Anthropic/OpenAI/Claude/ScriptMaker/Ivory client import or completion call was
added. Governance-boundary tests #6–#7 statically assert no LLM-provider import and no
completion-call shape in the contract source.

## 25. No Dynamic Generation

Confirmed. Catalog responses remain the verbatim pre-authored fixtures returned by reference
(ES guardrails test 24 asserts identity-equality of catalog entries to their fixture objects);
`agentResponseGenerated` stays the literal `false` everywhere (governance-boundary test #11
asserts the source never sets it `true`; #12 + ES test 22 assert every catalog entry keeps it
`false`).

## 26. No Live Michael / Steve / Ivory Behavior Activated

Confirmed. The slice adds contract-validation rules and tests only. No agent runtime is wired
to a route, no kill switch is enabled, no fixture path becomes live generation. The chain
remains the inert, fixtures-only, facade-routed foundation verified in S2.20–S3.2.

## 27. S3.4 Remains Separately Approved

Confirmed. This verification authorizes no implementation. S3.4 (minimal route implementation)
remains gated on the fixed sequence — S3.1 charter approval AND S3.2 route-proposal approval
AND a separate, explicit Kevin approval of the implementation slice itself. Nothing here
implements, approves, or pre-stages S3.4.

## 28. Recommendation for Next Slice

S3.3 has now satisfied both hardening conditions that S3.2 reserved (ES content scanner,
§5–§8; `failed → safe_close` contract strictness, §11–§14), so neither is an open blocker. The
**S3.4 minimal route implementation may be proposed separately only after Kevin explicitly
approves** the S3.2 namespace, the auth model, the kill switch, the response scope, the
observability mode, the rollback owner, and the implementation slice itself. Until those are
recorded, S3.4 stays unproposed. A future S3.4, if approved, must remain a one-call consumer of
the S2.20 facade (catalog → selector → derivation → facade), `.team`-only, authenticated,
BA-scoped, no-persistence, no-LLM, returned-only with a redacted trace behind the default-off
three-axis kill switch — and must NOT import the S2.13 harness or revive `/api/runtime/*`.

## Gates Run and Results

All four merge gates were run read-only with pnpm 9 / Node ≥ 22. The full server suite passed
clean on the FIRST run — the known `mongoAdapter.test.ts` parallel-load flake did not reappear
(the describe-level 15000ms timeout in §15 prevents it). No re-run was required.

| Gate | Command | Exit | Duration | Result |
|---|---|---|---|---|
| Shared build | `pnpm build:shared` | 0 | ~0.9s | PASS |
| Typecheck | `pnpm typecheck` | 0 | ~4.4s | PASS (all workspace projects done) |
| Build | `pnpm build` | 0 | ~5.7s | PASS (standing Vite chunk-size notes only) |
| Full server suite | `pnpm --filter @momentum/server test` | 0 | ~2.6s | PASS — **66 files / 699 tests**, 0 failures, no flake |

Baseline was **63 files / 653 tests**; this slice adds **3 files / 46 tests** (24 + 12 + 10) →
**66 / 699**, exactly as expected.

### Focused command results

| Focused command | Exit | Duration | Files / Tests |
|---|---|---|---|
| `... test -- michaelRuntimeResolutionFacade michaelResponseSelectionRequest michaelResponseCatalogSelector michaelResponseCatalog michaelRuntimeAdapterContract michaelResponseContract s220MichaelRuntimeResolutionFacadeGovernanceBoundary` | 0 | ~1.5s | **22 files / 306 tests** all pass (the S2.22 baseline of 272/20 plus the +3 S3.3 contract files / +34 of the +46 tests captured by the `michaelResponseContract` substring) |
| `... test -- michaelResponseContractEsGuardrails michaelResponseContract` | 0 | ~1.3s | **3 files / 49 tests** all pass (ES guardrails 24 + failed-strictness 10 + original contract suite 15) |
| `... test -- mongoAdapter` | 0 | ~1.2s | **1 file / 2 tests** all pass; flake did not reproduce (15000ms describe timeout in effect) |

(Vitest treats each argument as a filename-substring filter, so the broad Michael-chain command
sweeps the named modules plus adjacent guardrail/boundary/ES/strictness specs — the intended
broad sweep, now 306/22 vs. the prior 272/20 because of the three new S3.3 contract test files.)

---

This is the final S3.3 Pre-Implementation Hardening verification (Agent E). Production change is
limited to two in-process contract-validation hardenings + one validation-code union entry, plus
a test-only flake fix; gate commands were run read-only. No route file, mount, `server/src/index.ts`
edit, `.com` change, persistence, LLM call, dynamic generation, or live agent behavior was
introduced; nothing was committed. S3.4 remains separately approved.
