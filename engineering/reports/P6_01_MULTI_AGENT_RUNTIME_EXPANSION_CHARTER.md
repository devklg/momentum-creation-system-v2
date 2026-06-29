# P6.1 Multi-Agent Runtime Expansion Charter

- Sprint: Sprint 6 — Multi-Agent Runtime Expansion
- Slice: P6.1 (Agent B — Architecture) Multi-Agent Runtime Expansion Charter
- Status: PLANNING / GOVERNANCE ONLY — NON-AUTHORIZING DRAFT
- Architecture version: v1.0 frozen (S2.1 orchestration skeleton)
- Branch: feature/phase-06-multi-agent-runtime-expansion
- Base SHA: d39ab149ef41baf23f370bead4b54a83d3e1433a (HEAD verified to match)
- Date: 2026-06-29
- Owner: Phase 6 worktree (Codex CLI Instance 1)

---

## 1. Executive Verdict

This charter **authorizes nothing for activation.** It defines the governance frame
for bringing the **Ivory** agent into the existing inert agent-runtime orchestration
spine under the same controlled, fixture-first, non-persistent posture already proven
for **Michael Magnificent** (S2.11 → S2.14 → S2.17).

Recommendation: proceed with **architecture and contract artifacts only** for Phase 6 —
the Ivory runtime proposal (P6.2) and the Ivory response contract and catalog (P6.3) —
and **do not approve** any route, persistence, LLM call, dynamic generation, or behavior
activation. Each of those remains a separate, future decision reserved for Kevin.

Phase 6 is **dependency-gated**: it requires Phase 5 closeout. Until Phase 5 closeout is
recorded, Phase 6 produces **charters, proposals, contracts, and catalogs only**. No new
agent behavior is activated. This charter records that gate as **not yet satisfied** and
constrains all downstream Phase 6 work accordingly.

---

## 2. Explicit NON-AUTHORIZING Status

This charter authorizes nothing. Specifically:

- It does **not** approve a route, a mount, or any namespace — including any
  `/api/runtime/*` family or any new `.team` Ivory runtime endpoint.
- It does **not** approve persistence of any kind — no events, outcomes, Guided Actions,
  sessions, transcripts, or drafts written to MongoDB, Neo4j, ChromaDB, or any store.
- It does **not** approve an LLM call — no Anthropic / ScriptMaker / Ivory-coach or any
  dynamic response generation.
- It does **not** approve voice, Telnyx, PSTN, or call-control wiring.
- It does **not** approve any automatic sending, calling, scheduling, prospecting,
  scoring, ranking, or qualification.
- It does **not** approve any agent approving knowledge, nor any change to the Context
  Manager remaining the sole Context Packet assembler.

Every capability described below is a *proposal for a future, separate decision.*

---

## 3. Scope Of "Multi-Agent Runtime Expansion"

The runtime orchestration spine (`server/src/runtime/orchestration/`) currently carries
three inert agent descriptors in `registry.ts`: `steve_success`, `michael_magnificent`,
and `ivory`. All three are `behaviorImplemented: false`. Michael has progressed through a
governed sequence of **non-behavioral** artifacts — activation charter (S2.11), response
contract and safety guardrails (S2.14), and a returned-only fixture catalog plus selector
(S2.17 → S2.20) — without ever generating text, mounting a route, calling an LLM, or
persisting anything.

"Multi-Agent Runtime Expansion" means **extending that same proven, inert governance
ladder to the next agent (Ivory)** — not turning agents on. The expansion is in the
*catalog of governed contracts*, not in live behavior.

### 3.1 In scope for Phase 6 (architecture / governance artifacts)

- P6.2 — Ivory runtime proposal (first activation objective, route-free, fixture-first).
- P6.3 — Ivory response contract and catalog (proposed `ivory_response_contract.v1`
  shape + fixture-indexed catalog spec, EN/ES, returned-only).
- Later Phase 6 backlog items (P6.4–P6.13) remain **gated** behind Phase 5 closeout and
  explicit per-slice approval.

### 3.2 Out of scope for Phase 6 (until deps + approvals land)

- Any Ivory runtime route (P6.4), observability wiring (P6.5/P6.12), or `.team` UI
  (P6.6/P6.7).
- Any Steve runtime expansion implementation (P6.8–P6.10).
- Any activation of Ivory, Steve, or Michael behavior.

---

## 4. The Two-Ivory Boundary (load-bearing)

There are **two distinct surfaces that share the name "Ivory."** Conflating them would
violate the standing prohibitions. This charter draws the line explicitly:

1. **Legacy shipped `/ivory` feature** (build registry #131, verified live #145).
   A standalone `.team` warm-market roster (`ivory_names`, BA-private) plus an LLM
   coaching layer (Anthropic transport, evergreen fallback when key unset) that surfaces
   "who do you know" (WDYK) prompts. This already exists on `main`. **Phase 6 does not
   touch, re-platform, or re-govern this feature.**

2. **Orchestration-runtime Ivory adapter** (`runtime/orchestration/adapters/ivoryAdapter.ts`,
   registry descriptor `ivory`). Currently **inert** — it composes a turn through the
   Context Packet request/consumption path and returns non-persistent draft envelopes
   with `behavior: 'not_implemented'` and `agentResponseGenerated: false`. **This is the
   only Ivory surface Phase 6 governs.**

The Phase 6 runtime path is **fixture-first and LLM-free**, exactly like Michael's
runtime path — even though the legacy feature uses an LLM. The standing prohibition
"No LLM calls" applies to the Phase 6 runtime path without exception. Any future bridge
between the runtime adapter and the legacy coach is a separate decision and is **not**
proposed here.

---

## 5. Why Ivory Is The Correct Next Runtime Target

- **Registry precedent already exists.** `ivory` is a fully-formed inert descriptor with
  a defined domain (`relationship`), allowed task types, guardrail set, allowed/forbidden
  outputs, guided-action categories, and outcome categories. No new shared contract member
  is required to begin governance work.
- **Domain isolation.** Ivory's `relationship` domain is disjoint from Michael's
  `training` domain and Steve's `success` domain. Governing Ivory does not alter Michael's
  or Steve's contracts.
- **Proven ladder.** Michael's S2.11 → S2.17 sequence is a working template that already
  passes the repo gates with zero behavior, zero routes, zero persistence. Ivory reuses it.
- **Clean first objective.** Ivory's narrowest objective — relationship-context coaching
  (the WDYK reflection/clarifying prompts) — produces no message that could be sent and no
  tokenized link, which keeps the first slice maximally far from any outreach surface.

---

## 6. Internal Multi-Agent Workflow Applied To Phase 6

Per the orchestrator prompt, Phase 6 is executed by an internal A–E workflow. Their
boundaries for this gated session:

- **Agent A — Readiness:** verified HEAD == Base SHA, worktree clean (only the three
  orchestration `.md` files untracked), and that Phase 5 closeout is **not** recorded →
  therefore charters/proposals/contracts only.
- **Agent B — Architecture:** authored this charter (P6.1) and the contracts (P6.3).
- **Agent C — Implementation / Documentation:** produced planning docs only; **no code**
  because the dependency gate is unmet.
- **Agent D — Tests / Governance:** confirmed every standing prohibition still holds; no
  tests added because no behavior changed.
- **Agent E — Final Verification:** reserved for P6.13 closeout; not run this session.

---

## 7. Standing Prohibitions Carried Into Every Phase 6 Slice

Restated for the record (from `REPO_STATE_PACKET.md` and the orchestrator prompt). Every
Phase 6 artifact must preserve all of these:

- No `.com` exposure (Ivory is `.team` BA-facing only; never prospect-facing).
- No `/api/runtime/*` route family.
- No unapproved persistence.
- No LLM calls.
- No dynamic generation.
- No voice / Telnyx / PSTN / call-control.
- No automatic sending / calling / scheduling / prospecting / scoring / ranking /
  qualification.
- No income / compensation / cycle / placement guarantees.
- No agent may approve knowledge.
- Context Manager remains the sole Context Packet assembler.

---

## 8. Inert-State Markers Required Of All Phase 6 Artifacts

Any proposed type, fixture, or envelope described in Phase 6 documents must carry the same
inert markers proven for Michael:

- `behavior: 'not_implemented'`
- `agentResponseGenerated: false`
- `persistence: 'disabled'` (and per-axis: event / outcome / guided-action / envelope /
  response / session / transcript persistence all disabled)
- route-free (no mount)
- fixture-only (pre-authored, contract-valid; no dynamic text)

These markers are restated wherever a Phase 6 document describes current or proposed
state, to prevent drift.

---

## 9. Dependency Gate And Stop Conditions

- **Dependency gate:** Phase 6 requires Phase 5 closeout. Until then: charters, proposals,
  contracts, and catalogs only; no new agent behavior activation.
- **Stop conditions honored this session:**
  - HEAD matched Base SHA → no `LOCAL_REPO_STATE_MISMATCH`.
  - Worktree clean before start (only the three expected orchestration `.md` files
    untracked) → no `DIRTY_WORKTREE_BEFORE_START`.
  - Upstream phase closeout missing → readiness/planning only (this charter + P6.2 + P6.3).
  - No standing prohibition is violated by any artifact in this session.

---

## 10. Recommendation To Kevin

Approve **only** the following for Phase 6 at this time:

- Producing P6.1 (this charter), P6.2 (Ivory runtime proposal), and P6.3 (Ivory response
  contract and catalog) as **non-authorizing governance artifacts**.
- Keeping Ivory's orchestration runtime **inert** (`behaviorImplemented: false`), route-free,
  LLM-free, persistence-disabled, fixture-first.

Do **not** approve — pending Phase 5 closeout and a separate explicit decision per item:

- Activation of Ivory behavior or any task type.
- Any Ivory runtime route, `.team` UI, or observability wiring.
- Any LLM call, dynamic generation, persistence, or external action (send / call /
  schedule).
- Any bridge from the runtime adapter to the legacy `/ivory` LLM coach.

This charter is evidence for a future activation decision. It activates nothing.
