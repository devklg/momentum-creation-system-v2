# Sprint 2 S2.21 Michael Readiness Gate Options Review

- Sprint: Sprint 2 - Agent Runtime Activation
- Slice: S2.21 Michael Readiness Decision Gate — Next-Step Options Analysis
- Status: REVIEW / GOVERNANCE / PLANNING ONLY (no production code, tests, routes, UI, or `.com` modified; no commit; no build/LLM/DB run)
- Architecture version: v1.0 frozen
- Date: 2026-06-28
- Reviewer: Agent D (S2.21 options analysis input — does NOT own the final S2.21 decision gate; that is Agent E)
- Branch: `review/s2.21-michael-readiness-decision-gate`

## 1. Executive Summary

This is options analysis only. It recommends the next governance-safe step after the completed Michael inert runtime chain (S2.11–S2.20) and does not itself approve, charter, or implement anything.

**Recommended next step: Option 2 — a Route-Free Activation Proposal Charter — paired with Option 4 closing Sprint 2 as an inert foundation.** These are complementary, not competing: close Sprint 2 with the inert chain as a sealed, verified foundation, and let the single S2.21 deliverable Agent E produces be a planning-only activation-proposal charter that defines the future, separately approved, `.team`-only, authenticated activation boundary. No activation, no route, no persistence, no LLM, no dynamic generation is approved by that charter — it is the gate document Kevin reads before any of those is ever proposed.

Option 1 (more inert hardening) has hit diminishing returns and is not necessary before activation. Option 3 (an internal `.team` route proposal) is too early — it presupposes the boundary decisions the charter exists to make. The charter must PRECEDE any code or route proposal.

## 2. Foundation State (what S2.11–S2.20 already locked)

Confirmed from the S2.11–S2.20 reports and the orchestration source:

- The full runtime-turn → resolved-fixture chain is implemented and verified in inert form behind one deterministic entry point (`michaelRuntimeResolutionFacade.ts`): Context Packet → Runtime Turn → Michael Adapter Contract → Selection Request Derivation → Catalog Selector → Catalog Entry → Validated Response Fixture → Inert Resolution Facade → Redacted Trace.
- Posture is uniform across the chain: route-free, persistence-free, LLM-free, voice-free, returned-only, fixtures-only (no dynamic generation), no direct store/GraphRAG/adapter/Gateway/retrieval access, `.com` untouched, Gateway fallback preserved, Context Manager remains the only Context Packet assembler.
- Every successful resolution carries `agentResponseGenerated: false` and `persistence: 'disabled'`; off-contract inputs (wrong agent / wrong task / unsupported language / non-Context-Manager packet) collapse to `safe_close` and never produce substantive guidance.
- Test depth is already deep: full server suite 653/653 across 63 files; the focused Michael chain runs 195/195 across 13 files; each slice S2.12–S2.20 carries its own dedicated static governance-boundary suite (e.g. S2.20's `s220MichaelRuntimeResolutionFacadeGovernanceBoundary.test.ts` enforces 31 CI-level boundary checks). Negative-space, EN/ES symmetry, by-reference, no-mutation, and trace-redaction coverage all exist.
- All four merge gates (`build:shared`, `typecheck`, `build`, server test) are green on the S2.20 branch.

Conclusion: the inert foundation is complete and well-defended. There is no inert gap that blocks a governance decision. What remains undecided is entirely a governance question — whether, when, and under what boundary Michael becomes live — not an implementation gap.

## 3. Option 1 — Continue Inert Hardening

Scope: more negative-space tests, additional trace-redaction checks, broader catalog coverage, further fixture review — all still inert, route-free, non-persistent.

**Value:** Low-to-marginal. The chain already has dedicated negative-space suites (`michaelResponseSelectionRequestNegativeSpace.test.ts`), EN/ES symmetry suites, exhaustiveness suites (`michaelResponseCatalogSelectorExhaustiveness.test.ts`), per-slice 31-check static governance suites, by-reference and no-mutation snapshots, and a dedicated trace-redaction suite. The marginal defect-catch per additional inert test is now small.

**Risk:** Low in isolation (it touches nothing live), but it carries a real governance risk: **inert-hardening theater** — spending sprint cycles deepening coverage of a foundation that is already verified, which delays the actual unresolved decision (the activation boundary) and creates the false impression that more inert work is a prerequisite to that decision. It is not.

**Necessary before activation?** No. Honestly assessed, coverage is already deep enough that further inert hardening is not a precondition for Kevin to make the activation-boundary decision. Specific gaps, if any are found later, should be filed as targeted follow-ups (the known `mongoAdapter.test.ts` parallel-load flake `testTimeout` bump is the one concrete, already-identified hardening candidate), not bundled as a full slice.

**Verdict:** Diminishing returns. Do not spend an S2.21 slice on this. Keep it available as a thin, targeted follow-up if a real gap surfaces.

## 4. Option 2 — Route-Free Activation Proposal Charter (RECOMMENDED)

Scope: a single planning-only document that defines the future, separately approved, `.team`-only, authenticated activation boundary — what activation would mean, where the trust boundary sits, what must be true before any code, and what Kevin must approve. It activates nothing and mounts nothing.

**Value:** High. This is the one artifact the foundation actually needs next. The inert chain answers "can we resolve a runtime turn to a safe fixture purely?" — yes. It does not answer "what is the exact authenticated `.team`-only boundary, kill-switch shape, monitoring contract, persistence policy, and rollback owner under which Michael first runs live?" The charter forces those decisions to be made and ratified before a single line of activation code exists, which is exactly the precedence model the repo enforces (decision ledger > spec > code). It builds directly on the S2.10 decision gate and S2.11 first-activation charter, extending them from "first implementation slice" to "live activation boundary," and gives Kevin a single document to approve or reject.

**Risk:** Low. A planning doc changes no runtime behavior. The only risk is scope drift — a charter that quietly reads as authorization. Mitigate by making the charter explicitly non-authorizing: it proposes a boundary and an approval checklist; it does not grant approval. It must restate every stop condition (no route, no persistence, no LLM/voice, no dynamic generation, no Steve/Ivory, no `.com`, no Telnyx/PSTN) as still-in-force.

**Required Kevin approval:** The charter itself requires no approval to be written (it is governance-only). But its entire purpose is to enumerate what Kevin must SEPARATELY approve before activation — see §8. Kevin approves the charter as the agreed gate; he does not thereby approve activation.

**Should it PRECEDE any code?** Yes, unambiguously. The charter is the gate that any future route proposal or activation slice must clear. Writing code or even a route proposal before the boundary is ratified inverts the repo's decision-currency rule. The charter comes first.

**Verdict:** This is the correct next governance-safe step. It is the highest-value, lowest-risk move and is a precondition for Options 3 and any future activation.

## 5. Option 3 — Internal `.team` Route Proposal

Scope: a future route PROPOSAL only (not implementation) for an authenticated, internal `.team`-only, BA-scoped read endpoint that returns inert fixture resolutions — no `.com`, no persistence, no LLM, no dynamic generation, no live behavior beyond returned fixture resolution.

**Value:** Medium, but premature. A route proposal is genuinely the step after the charter — it would specify the exact route family, auth middleware (`requireAuth` + `requireMichaelComplete`), BA-scoping, feature-flag default-off, route-disable rollback, and the DTO shape (the S2.20 §26 "inert presentation/serialization shape" is the natural typed boundary it would consume). All of that is real, useful planning.

**Risk:** Medium-to-high if taken NOW, because it presupposes decisions the charter exists to make. A route proposal written before the activation boundary is ratified will either (a) smuggle in boundary assumptions Kevin has not approved, or (b) have to be rewritten once the charter lands. It also risks reading as a step toward mounting — and the S2.10 gate, S2.11 charter, and every slice through S2.20 have explicitly deferred route mounting until Kevin approves a route-specific charter. Mounting remains the single most consequential irreversible-feeling step in this chain.

**Too early?** Yes. A route proposal is the right move AFTER the activation-proposal charter is ratified, not instead of it. Sequence: charter (Option 2) → route proposal (Option 3) → implementation slice (separate, separately approved). Do not collapse these.

**Verdict:** Correct eventual step, wrong time. Defer until the Option 2 charter is approved.

## 6. Option 4 — Stop Sprint 2 and Close Runtime Foundation (RECOMMENDED, paired with Option 2)

Scope: declare the Michael inert runtime chain a complete, sealed inert foundation; close Sprint 2 on that basis; defer all activation work to a separate, separately approved Sprint 3 activation sprint.

**Value:** High. Sprint 2's charter was "Agent Runtime Activation" foundation work, and the inert chain end-to-end is exactly that foundation, now verified. Closing Sprint 2 here draws a clean, honest line: foundation done, activation is a distinct undertaking with a distinct risk profile (auth surface, kill switch, monitoring, persistence policy, live exposure) that deserves its own sprint, its own gate, and its own explicit Kevin approval rather than being tacked onto a foundation sprint. It prevents activation from sliding in as "just one more slice."

**Risk:** Low. Closing a sprint changes no behavior. The only risk is leaving the foundation without a forward pointer — mitigated precisely by pairing closure with the Option 2 charter, which becomes the bridge document into the future activation sprint.

**Verdict:** Correct and complementary to Option 2. Close Sprint 2 as an inert foundation; let the activation-proposal charter be the artifact that frames Sprint 3.

## 7. Required Recommendation

**Safest next step: pair Option 2 (Route-Free Activation Proposal Charter) with Option 4 (close Sprint 2 as an inert foundation).**

Reasoning, stated independently: the inert chain is complete and deeply verified, so the bottleneck is no longer implementation or coverage — it is the un-made governance decision about the live activation boundary. The single highest-value, lowest-risk thing to produce next is the planning-only charter that forces and frames that decision, written under the discipline that it authorizes nothing. Sprint 2 should close on the verified inert foundation so that activation is a deliberate, separately-gated Sprint 3 undertaking and not foundation-sprint scope creep. Option 1 is diminishing-returns hardening that is not a precondition; Option 3 is the right step but only after the charter, never before it.

This matches — and I reached independently — the orchestrator's prior lean toward "activation-proposal charter or close Sprint 2 as a foundation." My added view is that these are not an either/or: do both, because the charter is the forward pointer that makes closing Sprint 2 safe.

### 7.1 What MUST NOT be approved yet

- No route mount of any kind, including any `/api/runtime/*` or `.team` Michael endpoint.
- No persistence of events, outcomes, Guided Actions, envelopes, responses, sessions, transcripts, or logs.
- No LLM/Anthropic/ScriptMaker activation; no voice, browser voice, Telnyx, PSTN, or call-control.
- No dynamic response generation — responses remain pre-authored fixtures returned by reference; `agentResponseGenerated` stays `false`.
- No live Michael behavior, and no Steve or Ivory behavior of any kind.
- No `.com` exposure, copy, or AI-agent behavior — Michael is `.team`/BA-facing only.
- No direct agent access to MongoDB, Neo4j, ChromaDB, GraphRAG, direct adapters, Gateway fallback clients, or raw retrieval helpers; Context Manager remains the only Context Packet assembler.
- No knowledge approval by agents or learning processes; no scoring/ranking/qualification/prediction; no income/compensation/cycle/placement output.
- No internal `.team` route PROPOSAL adopted as approved (Option 3) until the charter is ratified.

### 7.2 What Kevin must approve SEPARATELY before any activation

Each is a distinct, explicit approval — none is implied by approving the charter:

- The activation boundary itself: authenticated, internal `.team`-only, BA-scoped, Context-Packet-only.
- Whether a route is mounted at all, and if so the exact route family and auth middleware (`requireAuth` + `requireMichaelComplete`).
- Response-generation scope: confirm fixtures-only / returned-only vs. any future generated text, and whether `agentResponseGenerated` may ever flip to `true`.
- Persistence policy: confirm disabled, or approve a specific persisted artifact with its triple-stack contract.
- Feature-flag / kill-switch shape (default-off) and the response-generation and route-disable kill paths.
- Monitoring/observability contract (returned-only or log-only first) with PII/text redaction rules.
- Rollback owner and the post-rollback gate-rerun checklist.
- `.team` surface placement, if any UI is ever introduced.
- The Sprint 3 activation-sprint charter as a whole, before any activation slice is dispatched.

## 8. Explicit Non-Actions (Stop Conditions for this report)

This options review did not, and S2.21 options analysis does not:

- approve, charter, or begin any activation, route, persistence, LLM, voice, or dynamic-generation work;
- write the final S2.21 decision-gate report (Agent E owns that);
- create the activation-proposal charter or any route proposal (this report only recommends producing the charter);
- modify any production code, test, route, UI, `.com`, ratified document, persistence adapter, or Gateway fallback;
- run builds, typecheck, tests, LLMs, or any database;
- mount routes or `/api/runtime/*`;
- activate Michael, Steve, or Ivory behavior;
- commit, or mutate git history or any database.

This report is the only file written by Agent D for S2.21.
