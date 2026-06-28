# S3.1 Pre-Activation Conditions Review

- Sprint: Sprint 3 - Michael Activation Planning
- Slice: S3.1 Activation Planning Charter — pre-activation conditions review (WHEN each open S2.22 condition must be resolved)
- Status: PLANNING / GOVERNANCE / DOCUMENTATION ONLY (no production code, tests, routes, UI, or `.com` modified; no commit; no builds/LLMs/DB run; no scanner/contract/middleware change implemented)
- Architecture version: v1.0 frozen
- Date: 2026-06-28
- Owner: Agent C (pre-activation conditions review/planning)
- Branch: `planning/s3.1-activation-planning-charter`
- Inputs: `engineering/reports/S2_22_REMAINING_CONDITIONS_REVIEW.md` (prior analysis), `server/src/runtime/orchestration/michaelResponseContract.ts`, `server/src/runtime/orchestration/michaelRuntimeAdapterContract.ts`, `server/src/middleware/`

## Executive Summary

This report sequences the open conditions carried out of S2.22 against the S3.1 activation-planning timeline. It defines, per condition, **when** resolution is required relative to three planning milestones: (a) charter / route-proposal authorship, (b) implementation start, and (c) live (non-fixture) response generation. It implements none of them. Per-condition verdict:

- **Condition B (ES content scanner)** — Not implemented in S2.22. Not required for the fixed fixtures-only runtime (no text is generated). Required before any live Spanish generation. A minimum ES term floor is recorded. Recommend a dedicated Sprint 3 pre-implementation hardening slice (e.g. S3.3), needed only before live generation — not before charter or route-proposal.
- **Condition C (`failed → safe_close` contract strictness)** — Adapter enforces `failed → safe_close`; the contract alone permits `failed → safe_fallback OR safe_close`. No live gap today (the facade routes only through the adapter). Required before any non-adapter contract consumer. Recommend a documentation-tracked pre-req, added when a non-adapter consumer is introduced — not a blocker for route proposal.
- **Condition D (gate naming)** — `requireSteveComplete` exists; `requireMichaelComplete` does not. Recommend a documentation correction plus a route-proposal naming decision: Steve = onboarding gate; Michael = runtime training-support agent.
- **Condition E (Kevin-only activation decisions)** — Enumerated below; all must be recorded by Kevin before implementation begins.

Nothing in this report approves a route, persistence, an LLM, voice, a scanner, a middleware rename, or any contract change.

---

## Condition B — ES Content Scanner

### 1. No ES scanner was implemented in S2.22

Confirmed. S2.22 was planning/governance only and implemented no scanner. The content scanner in `michaelResponseContract.ts` remains English-lexicon-only: `PROHIBITED_TEXT_PATTERNS` (`michaelResponseContract.ts:74-103`) and `SAFE_CLOSE_SUBSTANTIVE_TRAINING_PATTERN` (`:105-106`) match English lexemes only. The numeric/currency triggers (`\$\s?\d`, `make \$?\d` inside the `income_claim` pattern) are language-agnostic, but the lexical terms (income/earnings/commission/compensation, placement/guarantee/spillover, cycle/cv/volume, medical advice/diagnose/cure, THREE approved, send-to-prospect/lead, auto-send/call prospects) have no Spanish equivalents in the set. This matches the S2.22 finding (Condition 2, §1).

### 2. ES scanner is NOT required for the fixed fixtures-only runtime

Confirmed. The inert, fixtures-only path **generates no text** — it returns pre-authored, contract-validated fixtures by reference (`michaelRuntimeAdapterContract.ts` `selectResponse` → `fixtureFor` → `validateFixture`). Because no Spanish text is dynamically produced, the English-only scanner's lexical gap cannot be reached on the current path. Every `es` fixture is still run through `validateMichaelResponseContract`, so the catalog cannot ship text that trips the English scanner; ES safety on the inert path rests on fixture authoring discipline plus governance review, which is acceptable for a fixed catalog. An ES scanner is therefore not a prerequisite for the inert facade and not a prerequisite to propose the route or author the charter.

### 3. ES scanner IS required before live Spanish generation

Confirmed. The moment any live (non-fixture) Spanish text generation is contemplated — i.e. before `agentResponseGenerated` could flip to `true` for an `es` response, or before any dynamic ES drafting surface is enabled — an English-only scanner cannot enforce Spanish compliance. At that point an approved ES content scanner (or an equivalent ES-trained content-safety control) becomes a hard precondition. This is the trigger boundary, not a calendar date.

### 4. Minimum ES scanner term floor

If/when an ES scanner is approved, the minimum lexical floor (parallel to the existing English categories) must include at least:

| Category (parallels EN pattern) | Minimum ES terms |
|---|---|
| income / compensation | `ingresos`, `ganancias`, `comisión`, `compensación` |
| placement / guarantee | `colocación`, `garantizado` |
| medical | `médico`, `salud` |
| prospect-facing / automatic action | `prospecto`, `automático`, `llamar`, `enviar` |

Full floor list: **ingresos, ganancias, comisión, compensación, colocación, garantizado, médico, salud, prospecto, automático, llamar, enviar.** This is a documented minimum starting set, not an implementation spec. Real coverage would additionally require diacritic-insensitive and inflection-aware matching (e.g. comisión/comision, ganancia/ganancias) and an ES safe-close substantive-guidance pattern paralleling `SAFE_CLOSE_SUBSTANTIVE_TRAINING_PATTERN`.

### 5. Recommendation — Sprint 3 pre-implementation hardening slice (e.g. S3.3)

Recommend the ES scanner be scoped as a dedicated **Sprint 3 PRE-implementation hardening slice (e.g. S3.3)**, sequenced **after** the charter/route-proposal but **before** any live Spanish generation is enabled. Rationale: it has no effect on, and is not gated by, charter authorship or the route proposal (both of which concern the inert/fixture foundation), so making it a charter blocker would be incorrect. It is, however, a true precondition on the Sprint 3 "response-generation scope" decision for Spanish. Record it in the charter as a named precondition tied to live ES generation, and slot the implementation slice to land before that decision is exercised. No scanner is implemented, approved, or scheduled by S3.1.

---

## Condition C — `failed → safe_close` Contract Strictness

### 1. The adapter enforces `failed → safe_close`

Confirmed. `runMichaelRuntimeAdapterContract` maps `consumption.decision === 'block_substantive'` OR `consumption.packetStatus === 'failed'` to `selectResponse(input, 'failed_context', 'safe_close', 'failed', safeLanguage)` (`michaelRuntimeAdapterContract.ts:122-124`). The adapter always closes on a failed context and never emits `safe_fallback` for `failed`; `runtimeStatusFor('failed_context')` returns `'blocked'` (`:466-468`).

### 2. The contract alone permits `failed → safe_fallback OR safe_close`

Confirmed. `validateContextPacketStatusBehavior` (`michaelResponseContract.ts:329-359`) bars substantive responses on `failed`/`missing`/`rejected`, permitting **only `safe_fallback` or `safe_close`** for those statuses (`:336-348`). It then adds a `rejected`-specific rule requiring `safe_close` (`rejected_context_requires_safe_close`, `:350-358`) but adds **no equivalent rule for `failed`**. Evaluated on its own, the contract would therefore accept a `failed`-context `safe_fallback`. The stricter `failed → safe_close` guarantee lives **only in the adapter**, not in the contract validator.

### 3. No live gap today

Confirmed. The resolution facade and the entire S2.17–S2.20 chain route exclusively through the adapter, so `failed` always yields `safe_close` in practice. The contract-level permissiveness is latent and unreachable on the current single canonical path. No behavioral gap exists today.

### 4. Strictness is required before any non-adapter contract consumer

Confirmed as the trigger condition. The latent risk becomes reachable only if a future **direct** consumer of `validateMichaelResponseContract` bypasses the adapter and legitimately emits a `failed`-context `safe_fallback`. Therefore contract-level `failed → safe_close` strictness is required **before any non-adapter contract consumer is introduced** — not before then.

### 5. Recommendation — documentation-tracked pre-req, add when a non-adapter consumer is introduced

Recommend recording this in the S3.1 charter as a **documentation-tracked pre-requisite** rather than a route-proposal blocker. It is not required before route proposal and not required before implementation of the inert foundation, because the adapter already enforces the guarantee on the only path that exists. The concrete future change (not made here) would be a parallel rule in `validateContextPacketStatusBehavior` mirroring the existing `rejected_context_requires_safe_close` clause — e.g. a `failed_context_requires_safe_close` issue raised when `packetStatus === 'failed'` and `responseType !== 'safe_close'`. The trigger to add it is the introduction of any non-adapter contract consumer; adding it earlier is optional hardening with no behavioral effect on the current chain. No contract change is made, approved, or scheduled by S3.1.

---

## Condition D — Gate Naming

### 1. `requireSteveComplete` exists

Confirmed. `server/src/middleware/requireSteveComplete.ts` exists and is consumed across the route layer (e.g. `routes/cockpit.ts`, `routes/invitations.ts`, `routes/training.ts`, `routes/scriptmaker.ts`, `routes/profile.ts`, and others).

### 2. `requireMichaelComplete` does NOT exist

Confirmed. A repository search for `requireMichaelComplete` across `server/` returns **zero** occurrences — no middleware file, no import, no mount. The onboarding/completion gate is named for Steve, not Michael. (Note: project documentation, including `CLAUDE.md`, references a `requireMichaelComplete` mount pattern and a `MICHAEL_GATE_WHITELIST`; the implemented middleware is `requireSteveComplete`. This is a documentation/code naming divergence, not a missing gate.)

### 3. Recommendation — documentation correction plus route-proposal naming decision

Recommend two coordinated actions, neither implemented here:

- **Documentation correction:** reconcile the docs that reference `requireMichaelComplete`/`MICHAEL_GATE_WHITELIST` with the implemented `requireSteveComplete`, so the onboarding-gate name is consistent between code and docs.
- **Route-proposal naming decision:** adopt and record the role split in the S3.1 charter / route proposal — **Steve = onboarding gate** (the BA-completion middleware that opens BA-facing gated routes), **Michael = runtime training-support agent** (the inert response-resolution surface; `agentKey: "michael_magnificent"`, `taskType: "training_support"`). Any Michael activation route should be named for the Michael runtime agent and must not be conflated with, or reuse, the Steve onboarding gate. This is a naming/governance decision for Kevin to ratify at route-proposal time; no middleware is renamed, created, or removed by S3.1.

---

## Condition E — Kevin-Only Activation Decisions (required before implementation)

The following decisions are reserved to Kevin and must be recorded before any Michael activation implementation begins. Each is a precondition on implementation, not on charter authorship:

1. **Activation boundary** — what exactly flips from inert to live, and what stays inert at first activation (e.g. fixtures-only EN read path before any dynamic generation).
2. **Route family + namespace** — the route family and namespace for the Michael runtime surface (e.g. `/api/runtime/*` vs. another mount), and its mount position relative to the boot-order rules in `server/src/index.ts`.
3. **Auth model** — who may call the route, and how it relates to `requireAuth` and the onboarding gate (`requireSteveComplete`); whether the Michael runtime surface is BA-facing gated, admin-only, or otherwise scoped (Michael is BA-facing only, never prospect-facing).
4. **Kill switch** — the activation kill switch / feature-flag mechanism and who can trip it.
5. **Response-generation scope** — fixtures-only vs. live (non-fixture) generation; per-language scope (EN vs. ES), which directly gates the ES scanner precondition (Condition B).
6. **Persistence policy** — whether any persistence channel flips from `'disabled'`, and if so which, written through `tripleStackWrite()` per the triple-stack rule (all currently inert: event/outcome/guidedAction/envelope/response/session/transcript persistence).
7. **Observability contract** — what is logged/traced, the redacted-trace shape, and what must never appear in traces (compliance-forbidden content).
8. **Rollback owner** — who owns rollback and the rollback procedure if activation regresses.
9. **ES scanner decision** — approve/sequence the ES content scanner (Condition B) as a precondition on live Spanish generation.
10. **`failed → safe_close` strictness decision** — whether/when to add contract-level strictness (Condition C), triggered by the introduction of any non-adapter contract consumer.

---

## Disposition and Timing Summary

| Condition | Status entering S3.1 | Required WHEN | Recommended disposition |
|---|---|---|---|
| B — ES content scanner | Open; not implemented in S2.22 | Before live ES generation only | Dedicated Sprint 3 pre-implementation hardening slice (e.g. S3.3); not a charter/route-proposal blocker; term floor recorded |
| C — `failed → safe_close` strictness | Open; no live gap today | Before any non-adapter contract consumer | Documentation-tracked pre-req; add the parallel `failed` rule when a non-adapter consumer is introduced |
| D — Gate naming | `requireSteveComplete` exists; `requireMichaelComplete` absent | At route proposal | Doc correction + route-proposal naming decision (Steve = onboarding gate; Michael = runtime agent) |
| E — Kevin-only decisions | Open | Before implementation start | Record all ten decisions before implementation begins |

## Non-Approval Statement

This planning report approves nothing for activation and changes no code. No route, no `/api/runtime/*` mount, no persistence, no LLM, no dynamic response generation, no voice/Telnyx/PSTN, no ES scanner, no contract edit, and no middleware rename are implemented, approved, or scheduled here. The dispositions above are inputs to the S3.1 Activation Planning Charter, which is owned by Agent E. This report does not create the final S3.1 charter report.
