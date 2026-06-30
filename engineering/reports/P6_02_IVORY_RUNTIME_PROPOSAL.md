# P6.2 Ivory Runtime Proposal

- Sprint: Sprint 6 — Multi-Agent Runtime Expansion
- Slice: P6.2 (Agent B — Architecture) Ivory Runtime Proposal
- Status: PLANNING / GOVERNANCE / DOCUMENTATION ONLY — NON-AUTHORIZING DRAFT
- Architecture version: v1.0 frozen (S2.1 orchestration skeleton)
- Branch: feature/phase-06-multi-agent-runtime-expansion
- Base SHA: d39ab149ef41baf23f370bead4b54a83d3e1433a (HEAD verified to match)
- Date: 2026-06-29
- Depends on: P6.1 Multi-Agent Runtime Expansion Charter
- Owner: Phase 6 worktree (Codex CLI Instance 1)

---

## 1. Executive Verdict

This proposal recommends a **first, narrowly scoped activation objective** for the inert
orchestration-runtime **Ivory** adapter, and a fixture-first, route-free, LLM-free,
persistence-disabled path to get there — mirroring Michael's proven S2.11 → S2.17 ladder.

Recommendation: adopt **`relationship_coaching`** as Ivory's **first** runtime activation
objective (relationship-context "who do you know" reflection support), and defer
**`invitation_drafting`** to a separate, later slice. Approve this **as a proposal only**.

This proposal **approves nothing for activation.** It defines the target so that P6.3 can
specify the response contract and catalog without ambiguity. No route, persistence, LLM,
or behavior is authorized here.

---

## 2. Explicit NON-AUTHORIZING Status

This proposal authorizes nothing. It does **not** approve a route or mount, any
persistence, any LLM/dynamic generation, any voice/Telnyx, any automatic send / call /
schedule / score / rank / qualify, and it does **not** change the Context Manager's sole
authority over Context Packet assembly. Everything below is a *proposal for a future,
separate decision by Kevin.*

---

## 3. Current State (Inert)

The Ivory runtime adapter (`server/src/runtime/orchestration/adapters/ivoryAdapter.ts`)
is inert. It sets `identity.agentKey = 'ivory'`, checks `isTaskTypeAllowed('ivory', …)`
against the registry, and composes a turn via `composeOrchestrationTurn`, returning an
`OrchestrationTurnCompositionResult`. That result already carries the inert markers:

- `behavior: 'not_implemented'`
- `agentResponseGenerated: false`
- `eventPersistence / outcomePersistence / guidedActionPersistence / envelopePersistence:
  'disabled'`

The Ivory registry descriptor (`registry.ts`) is `behaviorImplemented: false`. There is
**no Ivory response contract, no Ivory fixture, and no Ivory catalog yet** — that is the
gap P6.3 fills (specification only).

The legacy shipped `/ivory` LLM coaching feature (build #131 / verified #145) is a
**separate surface** and is explicitly out of scope (see P6.1 §4, the two-Ivory boundary).

---

## 4. Ivory Registry Facts (Source Of Truth For Scoping)

From `registry.ts` — the inert `ivory` descriptor (do not rebuild; reference only):

- `agentKey`: `ivory`
- `primaryDomain`: `relationship`
- `roleSummary`: "Internal .team BA-facing relationship/context support that produces
  editable, BA-owned drafts only."
- `allowedTaskTypes`: `relationship_coaching`, `invitation_drafting`, `session_resume`,
  `guided_action_review`
- `supportedModes`: `browser_text`, `browser_voice`, `mixed`
- `supportedLanguages`: `en`, `es`
- `guardrailSet`: `no_auto_send`, `no_calling`, `no_lead_qualification`,
  `no_prospect_scoring`, `no_automated_prospecting`, `no_bulk_outreach`,
  `no_income_or_placement_claims`, `no_medical_claims`, `no_direct_store_access`,
  `ba_owned_action`
- `allowedOutputs`: `editable_invitation_draft`, `clarifying_question`, `next_step_prompt`,
  `reflection_prompt`, `guided_action_suggestion`
- `forbiddenOutputs`: `auto_sent_message`, `placed_call`, `lead_qualification`,
  `prospect_score`, `automated_prospecting_list`, `bulk_outreach`, `income_projection`,
  `placement_promise`
- `eventFamily`: `ivory`
- `behaviorImplemented`: `false`

The shared contract `AgentKey` already includes `'ivory'`, and `RuntimeTaskType` already
includes `relationship_coaching` and `invitation_drafting`
(`packages/shared/src/runtime/agents.ts`). **No new shared-contract export is required**
to begin Ivory governance — append-only rules on `types.ts` are not triggered by this
proposal.

---

## 5. Proposed First Activation Objective

> **Ivory's approved-for-proposal first objective is relationship-context coaching:** help
> the BA recall and reflect on people they already know — surfacing "who do you know"
> (WDYK) reflection and clarifying prompts — without producing any sendable message and
> without any tokenized prospect link.

This maps to locked-spec §1.8: *"Ivory helps the BA think of everyone they know — names
they would not remember on their own."*

### 5.1 Exact allowed task type (first slice)

- `relationship_coaching`

### 5.2 Task types registry-known but NOT first-slice-approved

- `invitation_drafting` — deferred to a later, separate slice. It produces an
  `editable_invitation_draft`, which is closer to outreach and may later combine with the
  invitation spine's tokenized link; it must be governed on its own.
- `session_resume` — lifecycle-only; not a substantive objective for the first slice.
- `guided_action_review` — lifecycle-only; not a substantive objective for the first slice.

### 5.3 Why `relationship_coaching` first, not `invitation_drafting`

- **Lowest external-action surface.** Reflection/clarifying prompts cannot be "sent" and
  carry no recipient or link. The first slice stays maximally far from any send/call path.
- **Cleanest compliance posture.** No draft message content means no opportunity for
  income/placement/medical language to enter a sendable artifact in the first slice.
- **Direct locked-spec anchor.** The WDYK framing is exactly Ivory's named job.
- **Defers the hardest governance question** (drafts + tokenized links + CRM promotion)
  to a slice that can be reviewed in isolation.

---

## 6. Allowed Response Intent (First Slice)

Limited to (full shapes specified in P6.3):

- `relationship_prompt` — a short relationship-context coaching prompt (the substantive
  WDYK reflection), available only on a **complete** Context Packet.
- `clarifying_question` — one focused question when the BA's intent is ambiguous, on a
  complete Context Packet.
- `safe_fallback` — a limited, non-substantive response when the Context Packet is
  degraded or missing.
- `safe_close` — a non-substantive close when the Context Packet failed or was rejected.

Substantive responses (`relationship_prompt`, `clarifying_question`) are allowed **only**
when the Context Packet is `complete`. Degraded/missing → `safe_fallback`; failed/rejected
→ `safe_close`. This is the identical safety topology Michael uses.

---

## 7. Prohibited Outputs (First Slice)

Ivory must not output:

- prospect-facing content of any kind;
- any auto-sent message, SMS, email, social post, or DM;
- any placed or scheduled call;
- a recipient list, bulk-outreach list, or automated-prospecting list;
- a tokenized prospect link or any `.com` token;
- a lead qualification, prospect score, rank, classification, or readiness label;
- an income projection, earnings figure, commission/cycle math, or placement promise;
- medical or GLP-related health claims;
- Steve interview behavior or Michael training behavior;
- any THREE International authority claim or direct-store action;
- any knowledge approval.

---

## 8. Context Packet Consumption (Boundary Reuse)

The first Ivory slice consumes `context_packet.v1` **only**, via the existing
`ContextManagerRequestPort` boundary. Ivory does **not** assemble packets, retrieve
knowledge, or import Context Manager internals — the Context Manager remains the sole
assembler. BA scope is derived from the session (`scope.baId`), **never** from a request
body, consistent with sponsor immutability and the existing orchestration identity model
(`OrchestrationSessionIdentity`).

Consumption decisions reuse the existing `ContextPacketConsumptionDecision` set
(`proceed` / `degraded` / `block_substantive` / `reject`) and map to the response-type
topology in §6.

---

## 9. Route Decision (First Slice)

The first Ivory slice remains **route-free**. No `/api/runtime/*` family, no new `.team`
Ivory runtime endpoint, no mount in `server/src/index.ts`. The adapter and (proposed)
contract/catalog are exercised by **fixtures and tests only**, exactly as Michael's
catalog is (S2.17). A route is a later, separate decision (P6.4) gated behind Phase 5
closeout and explicit approval.

---

## 10. Fixture-First, LLM-Free Path

Ivory's runtime responses in this and the next slices are **pre-authored, contract-valid
fixtures** (EN/ES), looked up deterministically — never generated. No Anthropic call, no
ScriptMaker, no legacy Ivory coach, no dynamic text. `agentResponseGenerated: false` holds
throughout. This is what makes the runtime path safe to build while the dependency gate is
unmet: there is no behavior to activate, only contracts and fixtures to validate.

---

## 11. Proposed Slice Sequence (All Gated)

1. **P6.3 (this batch)** — Ivory response contract + fixture catalog **spec** (no code).
2. *Future, gated* — implement `ivory_response_contract.v1` types + EN/ES fixtures +
   catalog + selector (inert, returned-only), mirroring Michael S2.11/S2.17 code.
3. *Future, gated* — inert Ivory runtime adapter contract + resolution facade
   (mirroring Michael S2.14/S2.20).
4. *Future, gated, separate approvals* — route (P6.4), observability (P6.5), `.team` UI
   (P6.6/P6.7), and only then any behavior activation.

Each step is non-authorizing until Kevin approves it and Phase 5 closeout is recorded.

---

## 12. Required Gates (Documentation-Only Session)

Per the orchestrator prompt, a documentation-only change with no code changed runs at
minimum `pnpm typecheck`. The full gate set (`build:shared`, `typecheck`, `build`,
`@momentum/team typecheck`, `@momentum/server test`) applies when code lands in a future,
gated slice. This session changes **no code** — only `engineering/reports/P6_*` markdown.

---

## 13. Recommendation To Kevin

Approve **as a proposal only**:

- Ivory's first runtime activation objective = **`relationship_coaching`** (WDYK
  relationship-context coaching), inert, route-free, LLM-free, persistence-disabled,
  fixture-first.
- Proceeding to P6.3 to specify the response contract and catalog for that objective.

Do **not** approve (separate future decisions, gated behind Phase 5 closeout):

- Activating `relationship_coaching` or any Ivory task type.
- `invitation_drafting` (deferred to its own slice).
- Any route, `.team` UI, observability, persistence, LLM call, or external action.
- Any bridge to the legacy `/ivory` LLM coach.

This proposal scopes a target. It activates nothing.
