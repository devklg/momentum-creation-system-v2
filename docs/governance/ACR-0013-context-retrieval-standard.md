# ACR-0013 — Context Retrieval Standard

**Status:** RATIFIED — Kevin La'Mont Gardner, 2026-07-11
**Extends:** `memory_context_compiler.schema.v1` (CDX-001, Digital Memory Discovery, 2026-07-06). This ACR **finishes** that schema. It does not replace it.

---

## 1. Why

CDX-001's `nextAgentInstruction` says: *"Treat cdx-001 as the index key … **do not rediscover the concept**."*
On 2026-07-11 an agent rediscovered it anyway — inventing an "anchor_phrase" system that already existed as `human_handle` / `call_phrase` / `memory_index_alias`. Nothing stopped it, because **nothing requires an agent to look before it invents.**

Separately, an index built from a single collection (`claude_learning_notes`) omitted **Kevin's Real Turning Point** and the **Holding Tank** context entirely — not because they were missing, but because they live in other stores.

Retrieval failure is not the absence of memory. It is the absence of a **contract for looking.**

## 2. Kevin's insight (the thing being protected)

Kevin authors the retrieval key. He says the words that already carry the meaning — `voice mailer reality`, `krtp-mem`, `Digital Memory Discovery` — and the system must reconstitute the chain behind them. **The handle IS the meaning, not a pointer to it.**

The value is not "AI memory." The value is **not having to re-explain himself.**

## 3. The stores (all of them — an index of one is a fragment)

| Store | Holds |
|---|---|
| `memory_decisions` | memory-index entries, **aliases**, milestones, Kevin's decisions |
| `momentum.mcs_memory_context_index` (+ `_maps`) | context-compiler entries, weights, aliases, graph verbs |
| `universal_gateway.kevin_milestone_chats` | pinned milestone arcs (KRTP) |
| `universal_gateway.session_handoffs` | work chronicle (Holding Tank, orientation, spec closures) |
| `agent_operations.chat_registry` | **canonical chat identity** (per `docs/handoff-contract.md`) |
| `momentum.decisions` / `momentum_decisions` | governance & ACR ledger |
| `universal_gateway.claude_learning_notes` | agent corrections |
| `kevin_library` | Kevin's foundational library |

**Stack discipline:** `mongodb`/`chromadb`/`neo4j` = memory stack. `mongodb2`/`chromadb2`/`neo4j2` = MCS-v2 app stack (the context compiler lives here by design). **Both host a database named `momentum`.** Name the stack before any destructive or verifying operation.

## 4. The retrieval ladder (in order — do not skip)

1. **Invocation (exact).** Kevin says a `call_phrase` or `alias` → deterministic lookup against handles/aliases/`useWhen`. **No semantic guessing.** Load the packet.
2. **Compile the packet.** Canonical Mongo record + Neo4j graph expansion (follow `requires_context`, `grounds`, `supports`, `hands_off_to`, `supersedes`) + Chroma semantic neighbours (capped) + `implementationBriefs` in their stated order.
3. **Semantic fallback.** No handle match → search **all stores in §3**, ranked `weight × recency × distance`. **Never a single collection.**
4. **Provenance on every claim.** Store, record id, date, and **who said it — Kevin or an agent.** An agent's prior suggestion is NOT Kevin's decision, even if he reacted well to it.
5. **Supersession.** `supersedes` / `contradicts` are live verbs. Prefer current records; surface superseded ones **as superseded**, never silently.
6. **Absence discipline.** "I don't have that" is sayable **only after all stores are searched.** A miss in one store is not evidence of absence.
7. **Lazy, never ritual.** Nothing preloads at session start. Context arrives when Kevin invokes a handle or the work demands it.

## 5. Verification — a handle that does not retrieve is a broken handle

Every handle carries an expected top hit. A **retrieval regression test** runs in CI:
- invoke each `call_phrase` and `alias`
- assert the canonical record is the top hit
- assert visible distance separation from the runner-up (reference: `voice mailer reality` = **0.576** vs runner-up **1.10**)

A failing handle is a build failure, not a warning. Kevin will say the words and trust what comes back; a silently-broken handle is worse than no handle.

## 6. Boundaries (inherited from the compiler map, still binding)

- Runtime agents do not query stores directly — **the server compiles Context Packets.**
- Do not expose packet ids or compiler/graph language to BAs.
- Packets are token-budgeted and ranked internally. No dumping.
