# Sprint 2 S2.22 Sprint 3 Activation Options Review

- Sprint: Sprint 2 - Agent Runtime Activation (closeout slice)
- Slice: S2.22 Michael Activation Charter Closeout — Sprint 3 Activation Readiness Options Analysis
- Status: REVIEW / GOVERNANCE / PLANNING ONLY (no production code, tests, routes, UI, or `.com` modified; no commit; no build/LLM/DB run)
- Architecture version: v1.0 frozen
- Date: 2026-06-28
- Reviewer: Agent D (S2.22 options analysis input — does NOT own the final S2.22 report; that is Agent E)
- Branch: `review/s2.22-michael-activation-charter-closeout`
- Inputs: S2.21 decision gate (`SPRINT_002_S2_21_MICHAEL_INERT_RUNTIME_READINESS_DECISION_GATE.md`) + S2.21 options review (`S2_21_MICHAEL_READINESS_GATE_OPTIONS_REVIEW.md`) + Kevin's recorded S2.21-close decisions.

## 1. Executive Summary

This is options analysis only. It defines and compares the Sprint 3 activation readiness options that follow the S2.22 charter and the closing of Sprint 2 as a verified inert foundation. It does **not** approve, charter, or implement activation, and it does not propose or adopt a route.

**Recommended next step: Option A — Sprint 3 Planning Charter First.** A planning-only Sprint 3 charter that defines the activation governance — the authenticated, `.team`-only, BA-scoped activation boundary, the approval checklist, the kill-switch and rollback model, and the conditions that must be true before any code — is the highest-value, lowest-risk move and the precondition for everything after it. It is the SAFEST of the four options because it changes no runtime behavior and authorizes nothing; it only frames what Kevin must separately approve.

Option B (Sprint 3 route proposal) is the correct step *after* the charter, not instead of it — proposing a route family before the activation governance is ratified inverts the repo's decision-currency rule and risks smuggling in unapproved boundary assumptions. Option C (minimal internal route implementation) is too early for S2.22 by a wide margin — it presupposes both a ratified charter and an approved route proposal, neither of which exists. Option D (more inert hardening — ES content scanner, `failed→safe_close` contract strictness, more negative-space tests) is **not a prerequisite for Sprint 3 PLANNING**; those items are prerequisites for *live generation* and for *non-adapter contract consumers*, and are correctly tracked as conditions to satisfy before live behavior — not before a charter is written.

The fixed sequence Kevin ratified at S2.21 close stands: **charter → route proposal → implementation, each separately approved.** This review recommends only the first link.

## 2. Foundation State (what S2.11–S2.21 already locked)

Confirmed from the S2.21 decision gate and the S2.21 options review:

- The full runtime-turn → resolved-fixture chain is implemented and verified in inert form behind one deterministic entry point (`michaelRuntimeResolutionFacade.ts`): Context Packet → Runtime Turn → Michael Adapter Contract → Selection-Request Derivation → Catalog Selector → Catalog Entry → Validated Response Fixture → Inert Resolution Facade → Redacted Trace. The canonical activation path is **S2.17 catalog → S2.18 selector → S2.19 derivation → S2.20 facade**.
- Posture is uniform: route-free, persistence-free, LLM-free, voice-free, returned-only, fixtures-only (no dynamic generation), no direct store/GraphRAG/adapter/Gateway/retrieval access, `.com` untouched, Gateway fallback preserved, Context Manager the only Context Packet assembler.
- The S2.21 gate returned **PASS WITH CONDITIONS**: complete (Agent A), safe as a returned-only chain (Agent B), clean of every forbidden activation surface (Agent C); all four merge gates green; focused Michael chain passing.
- Kevin ruled at S2.21 close: **(1)** S2.22 is a route-free, planning-only Michael Activation Charter, after which Sprint 2 closes as a verified inert foundation and live activation becomes a separately approved Sprint 3; **(2)** the S2.13 scenario-driven fixture harness is **kept as a documented test-only harness**, not part of the activation path.
- **Two open conditions remain explicitly unresolved** and carried into Sprint 3 readiness:
  - **Condition 2 — ES content scanner.** The prohibited-text regex set and the safe-close substantive-guidance guard are English-lexicon-only. Spanish copy safety rests on hand-authoring + governance review, which is acceptable for a fixed inert catalog but must be decided before any **live (non-fixture) Spanish generation**.
  - **Condition 3 — `failed → safe_close` is adapter-enforced, not contract-enforced.** The adapter always closes on `failed`; the contract alone would permit `failed → safe_fallback`. No defect today (the chain always routes through the adapter), but any future **direct contract consumer that bypasses the adapter** could legitimately emit a `failed`-context `safe_fallback`.

Conclusion: the inert foundation is complete and well-defended. The remaining work is entirely a governance question — whether, when, and under what boundary Michael becomes live — plus two conditions that gate *live* behavior, not *planning*.

## 3. Option A — Sprint 3 Planning Charter First (RECOMMENDED)

Scope: a single planning-only Sprint 3 charter document. It defines the activation governance — what activation would mean, where the trust boundary sits, the authenticated `.team`-only / BA-scoped / Context-Packet-only boundary, the response-generation scope, persistence policy, feature-flag/kill-switch shape, monitoring/observability contract, rollback owner and post-rollback gate-rerun checklist, and the explicit approval checklist Kevin clears before any code. It activates nothing, mounts nothing, persists nothing, and proposes no concrete route.

**Value:** High. This is the one artifact Sprint 3 actually needs first. The inert chain answers "can we resolve a runtime turn to a safe fixture purely?" — yes. It does not answer "what is the exact authenticated `.team`-only boundary, kill-switch shape, monitoring contract, persistence policy, and rollback owner under which Michael first runs live?" The charter forces those decisions to be made and ratified before a single line of activation code exists — exactly the repo's decision-currency model (decision ledger > spec > code). It is the natural successor to the S2.22 closeout charter, extending it from "Sprint 2 is closed on a verified inert foundation" to "here is the governed path by which Sprint 3 activation may be proposed."

**Risk:** Low. A planning doc changes no runtime behavior. The only risk is scope drift — a charter that quietly reads as authorization. Mitigate by making it explicitly non-authorizing: it proposes governance and an approval checklist; it does not grant approval. It must restate every stop condition (no route, no persistence, no LLM/voice, no dynamic generation, no Steve/Ivory, no `.com`, no Telnyx/PSTN) as still in force, and it must name Conditions 2 and 3 as live-behavior prerequisites the charter does not close.

**Required Kevin approval:** The charter requires no approval to be *written* (it is governance-only). Its entire purpose is to enumerate what Kevin must SEPARATELY approve before activation — see §7. Kevin approves the charter as the agreed gate; he does not thereby approve activation.

**Should it PRECEDE any route proposal or code?** Yes, unambiguously. The charter is the gate any route proposal (Option B) or implementation (Option C) must clear. This is the first link in Kevin's fixed sequence.

**Verdict:** Correct, SAFEST, highest-value, lowest-risk next governance step. It is a precondition for Options B and C.

## 4. Option B — Sprint 3 Route Proposal First

Scope: propose a route family (not implementation) for an authenticated, internal `.team`-only, BA-scoped read endpoint that returns inert fixture resolutions — specifying the exact route family, auth middleware (`requireAuth` + `requireMichaelComplete`), BA-scoping, feature-flag default-off, route-disable rollback, and the DTO/serialization shape (the S2.20 inert presentation/serialization shape is the natural typed boundary it would consume). No `.com`, no persistence, no LLM, no dynamic generation, no mount. Requires Kevin approval.

**Value:** Medium, and genuinely the step *after* the charter. A route proposal is real, useful planning — but only once the boundary it specifies has been ratified.

**Risk:** Medium-to-high if taken NOW or as the *first* Sprint 3 step, because it presupposes the decisions the charter exists to make. A route proposal written before the activation governance is ratified will either (a) smuggle in boundary assumptions Kevin has not approved, or (b) have to be rewritten once the charter lands. It also risks reading as a step toward mounting — and the S2.10 gate, the S2.11 charter, and every slice through S2.21 have explicitly deferred route mounting until Kevin approves a route-specific charter. Mounting remains the single most consequential irreversible-feeling step in this chain.

**Riskier than charter-first?** Yes — distinctly. The charter changes nothing and authorizes nothing; a route proposal commits to a concrete route family and auth model that should be derived from, not asserted ahead of, the ratified charter. Sequencing it first inverts decision currency.

**Verdict:** Correct eventual step, wrong order if placed first. Defer until the Option A charter is approved. Then it is the second link in the fixed sequence.

## 5. Option C — Sprint 3 Minimal Internal Route Implementation

Scope (note: **NOT approved**): a minimal internal route implementation — strictly `.team`-only, authenticated (`requireAuth` + `requireMichaelComplete`), BA-scoped, **no persistence, no LLM, fixtures-only** — returning inert fixture resolutions by reference. This is the third link in Kevin's fixed sequence and **requires both a ratified charter (Option A) and an approved route proposal (Option B) first.**

**Value:** Potentially high *eventually* — it is the first slice where Michael's inert resolution becomes reachable behind an authenticated internal boundary. But its value is fully contingent on the two prior approvals; absent them it has no governance basis.

**Risk:** High if attempted in or near S2.22. It presupposes two approvals that do not exist (charter, route proposal), crosses the mount boundary that every slice S2.10–S2.21 has deliberately deferred, and would be the first irreversible-feeling step. Even with its tight constraints (`.team`-only, authenticated, BA-scoped, no persistence, no LLM, fixtures-only), implementing it before its two gates are cleared would be the exact scope-creep failure mode the charter discipline exists to prevent.

**Too early for S2.22?** Yes — decisively. S2.22 is a planning-only closeout slice; route implementation is two ratified approvals downstream and belongs to Sprint 3 proper, not to S2.22 and not to the immediately following charter slice.

**Verdict:** Defer. Eligible only after Option A is ratified AND Option B is approved, and only under the stated constraints, as a separately approved Sprint 3 implementation slice.

## 6. Option D — More Inert Hardening Before Sprint 3

Scope: additional inert work — implement the **ES content scanner** (Condition 2); add **`failed → safe_close` contract-level strictness** (Condition 3); add **more negative-space tests** — all still inert, route-free, non-persistent, LLM-free.

**Value:** Real but narrowly scoped. Conditions 2 and 3 are genuine, already-named follow-ups:
- The **ES content scanner** is a precondition for any **live (non-fixture) Spanish generation** — it closes the gap that Spanish prohibited-text and safe-close substantive-guidance safety currently rest on hand-authoring + governance review rather than regex enforcement.
- **`failed → safe_close` contract strictness** is a precondition for any **non-adapter contract consumer** — today the chain always routes through the adapter that enforces the close, so the gap is latent, not active.
- Further **negative-space tests** are diminishing-returns given the existing dedicated negative-space, EN/ES-symmetry, exhaustiveness, by-reference, no-mutation, and per-slice 31-check static governance suites.

**Risk:** Low in isolation (touches nothing live), but it carries the governance risk of **inert-hardening theater** — deepening coverage of an already-verified foundation in a way that delays the actual unresolved decision (the activation boundary) and creates the false impression that more inert work is a prerequisite to Sprint 3 *planning*. It is not.

**Required before Sprint 3 PLANNING? No — and this is the key distinction.** Conditions 2 and 3 are prerequisites for **live generation** (ES scanner) and for **non-adapter consumers** (contract-level `failed→safe_close` strictness), NOT for writing a charter. A planning charter can — and should — *name* both conditions as gating items the charter does not close and that must be satisfied before the corresponding live behavior. Implementing them is correctly sequenced *inside or after* the activation governance, when the charter has established whether/when live ES generation and non-adapter consumers are even in scope. Doing the implementation first risks building strictness against a boundary that has not yet been defined.

**Verdict:** Not a blocker for Sprint 3 planning. Keep Conditions 2 and 3 as explicitly tracked, charter-named prerequisites for the specific *live* behaviors they protect; address them as targeted inert follow-ups when the activation governance calls for the corresponding capability — not as a precondition to writing the charter. Further negative-space tests are diminishing returns and should be filed as thin targeted follow-ups only if a real gap surfaces.

## 7. Required Recommendation

**Recommended next step: Option A — Sprint 3 Planning Charter First.**

1. **Recommend the Sprint 3 Planning Charter first (Option A).** The inert chain is complete and deeply verified; the bottleneck is the un-made governance decision about the live activation boundary. The single highest-value, lowest-risk, SAFEST thing to produce next is the planning-only Sprint 3 charter that forces and frames that decision, written under the discipline that it authorizes nothing.

2. **No route implementation should occur until AFTER, in order:** (a) S2.22 lands; (b) Sprint 2 closes as a verified inert foundation; (c) the Sprint 3 charter (Option A) is approved by Kevin; and (d) a route proposal (Option B) is approved by Kevin. Only then is a minimal internal route implementation (Option C) eligible, and only under its stated constraints (`.team`-only, authenticated, BA-scoped, no persistence, no LLM, fixtures-only).

3. **Activation remains separately approved at each step.** The fixed sequence is **charter → route proposal → implementation, each separately approved by Kevin.** Approving the charter does not approve a route; approving a route proposal does not approve a mount or live behavior. No step is implied by the prior one.

### 7.1 What MUST NOT be approved by S2.22 or by this review

- No route mount of any kind, including any `/api/runtime/*` or `.team` Michael endpoint.
- No route PROPOSAL adopted as approved (Option B) until the Sprint 3 charter is ratified.
- No route IMPLEMENTATION (Option C) until both the charter and the route proposal are approved.
- No persistence of events, outcomes, Guided Actions, envelopes, responses, sessions, transcripts, or logs.
- No LLM/Anthropic/ScriptMaker activation; no voice, browser voice, Telnyx, PSTN, or call-control.
- No dynamic response generation — responses remain pre-authored fixtures returned by reference; `agentResponseGenerated` stays `false`.
- No live Michael behavior, and no Steve or Ivory behavior of any kind.
- No `.com` exposure, copy, or AI-agent behavior — Michael is `.team`/BA-facing only.
- No direct agent access to MongoDB, Neo4j, ChromaDB, GraphRAG, direct adapters, Gateway fallback clients, or raw retrieval helpers; Context Manager remains the only Context Packet assembler.
- No resolution of Condition 2 (ES content scanner) or Condition 3 (`failed→safe_close` contract strictness) implied by any planning artifact — they remain open, charter-named, and gate the specific live behaviors they protect.

### 7.2 What Kevin must approve SEPARATELY before any activation

Each is a distinct, explicit approval — none is implied by approving the Sprint 3 charter:

- The activation boundary itself: authenticated, internal `.team`-only, BA-scoped, Context-Packet-only.
- Whether a route is mounted at all, and if so the exact route family and auth middleware (`requireAuth` + `requireMichaelComplete`).
- Response-generation scope: confirm fixtures-only / returned-only vs. any future generated text, and whether `agentResponseGenerated` may ever flip to `true`.
- Persistence policy: confirm disabled, or approve a specific persisted artifact with its triple-stack contract.
- Feature-flag / kill-switch shape (default-off) and the response-generation and route-disable kill paths.
- Monitoring/observability contract (returned-only or log-only first) with PII/text redaction rules.
- Rollback owner and the post-rollback gate-rerun checklist.
- ES content scanner (Condition 2) before any live (non-fixture) Spanish generation.
- `failed → safe_close` contract-level strictness (Condition 3) before any non-adapter contract consumer.
- The Sprint 3 activation-sprint charter as a whole, before any activation slice is dispatched.

## 8. Explicit Non-Actions (Stop Conditions for this report)

This options review did not, and S2.22 options analysis does not:

- approve, charter, or begin any activation, route, route proposal, route implementation, persistence, LLM, voice, or dynamic-generation work;
- write the final S2.22 report (Agent E owns that);
- create the Sprint 3 activation charter, any route proposal, or any route (this report only recommends producing the charter first);
- resolve Condition 2 (ES content scanner) or Condition 3 (`failed→safe_close` contract strictness);
- modify any production code, test, route, UI, `.com`, ratified document, persistence adapter, or Gateway fallback;
- run builds, typecheck, tests, LLMs, or any database;
- mount routes or `/api/runtime/*`;
- activate Michael, Steve, or Ivory behavior;
- commit, or mutate git history or any database.

This report is the only file written by Agent D for S2.22.
