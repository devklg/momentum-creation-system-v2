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
2. **Compile the packet.** Canonical Mongo record + Neo4j graph expansion along **the operator Kevin gave** (§4.3; no verb → the full 13-verb chain, multi-hop) + Chroma semantic neighbours (capped) + `implementationBriefs` in their stated order.
3. **Semantic fallback.** No handle match → search **all stores in §3**, ranked `weight × recency × distance`. **Never a single collection.**
4. **Provenance on every claim.** Store, record id, date, and **who said it — Kevin or an agent.** An agent's prior suggestion is NOT Kevin's decision, even if he reacted well to it.
5. **Supersession.** `supersedes` / `contradicts` are live verbs. Prefer current records; surface superseded ones **as superseded**, never silently.
6. **Absence discipline.** "I don't have that" is sayable **only after all stores are searched.** A miss in one store is not evidence of absence.
7. **Lazy, never ritual.** Nothing preloads at session start. Context arrives when Kevin invokes a handle or the work demands it.

### 4.3 The verbs are the operators (Kevin, 2026-07-11)

> "It compiles my shorthand of memory context semantically and allows me the **verbs** that compile the memory at the moment I am giving context."

The 13 graph verbs (`captures`, `expresses`, `supports`, `requires_context`, `guides`, `retrieves`, `grounds`, `protects`, `excludes`, `hands_off_to`, `relates_to`, `supersedes`, `contradicts`) are not schema decoration — they are **Kevin's operators at speak-time**. Handle (noun) + verb (operator) = a packet compiled for that moment: `compileContextPacket(handleOrPhrase, verb?, audience)`. The verb selects the Neo4j traversal (multi-hop — follow the chain); no verb → the full chain.

- **Edges are relationships, not properties**: typed, directional, first-class, traversable, carrying their own provenance (`asserted_by`, `asserted_at`, `source_chat`).
- **Verb coverage is a first-class metric.** The index and every compiled packet report which verbs are populated and which are dead. A **hollow operator** (a verb with zero edges) must never masquerade as an empty answer — the packet says explicitly that the edges were never written.

### 4.7 The audience boundary is at compile time

One shared library — Kevin's knowledge base of everything — serves two audiences. Every record carries `audience` (`dev_agents` | `app_agents` | `both`; ACR-0012 §3.2b). `compileContextPacket()` filters by it: packets for app agents (Steve/Michael/Ivory) include **only** `app_agents`/`both` records and must be III-Intl-scoped; dev agents (Kevin/Claude/Codex) get everything. **Fail closed:** absent/unknown audience → `dev_agents`; an unmarked record never reaches an app agent. This is enforced by a deterministic CI test against the committed handle manifest — no database required.

## 5. Verification — a handle that does not retrieve is a broken handle

**The main library is LOCAL BY DESIGN (Kevin's ruling, 2026-07-11): GitHub runners must never reach it.** A live retrieval test can therefore never be a CI gate. Verification is split:

- **CI gate (deterministic, no network, always runs):** the committed handle manifest fixture (`server/src/lib/handleManifest.ts` — handle, call phrase, aliases, expected memory_id, audience). Every handle and alias must resolve through **rung-1 invocation** (exact call_phrase/alias/useWhen match), unambiguously; and the §4.7 audience boundary must hold. Fails if a handle is renamed, duplicated, or dropped. (`handleManifest.test.ts`)
- **Local live (Kevin's machine):** the semantic/distance assertions —
  - invoke each `call_phrase` and `alias`
  - assert the canonical record is the top hit
  - assert visible distance separation from the runner-up (reference: `voice mailer reality` = **0.576** vs runner-up **1.10**)

  Run with `pnpm memory:verify`, or `RETRIEVAL_REGRESSION=live` for the vitest suite. In CI this suite is **skipped with a loud, visible message** — never a silent pass, never a false failure.

A failing handle is a build failure on the machine that owns the library, not a warning. Kevin will say the words and trust what comes back; a silently-broken handle is worse than no handle.

## 6. Boundaries (inherited from the compiler map, still binding)

- Runtime agents do not query stores directly — **the server compiles Context Packets.**
- Do not expose packet ids or compiler/graph language to BAs.
- Packets are token-budgeted and ranked internally. No dumping.
