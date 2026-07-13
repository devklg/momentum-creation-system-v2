# ACR-0014 — The Context Agent

**Status:** RATIFIED — Kevin La'Mont Gardner, 2026-07-11
**Depends on:** ACR-0012 (write envelope), ACR-0013 (retrieval standard)
**Builds on:** `docs/handoff-contract.md`, `mcs_learning_candidates` (the proposal queue that already exists and was never wired)

---

## 1. The idea (Kevin's words)

A context agent that **parses the chat for context, moves things further, and confirms learning.**

## 2. What today proved

The 2026-07-11 session did not fail from missing context. It failed from **unconsulted** context:
- `cdx-001` explicitly instructed the next agent **not to rediscover the concept** — and an agent spent hours rediscovering it.
- An index was built from one collection and shipped as "Kevin's library," omitting his own **Real Turning Point**.
- Test residue was reported purged while 22 vectors sat in the other stack.

Each was preventable by **looking first**. None was prevented, because nothing required looking.

## 3. The Context Agent

### 3.1 GUARD — retrieval before invention (build this first)

Before substantive work on any thread, the agent queries the index across **all** stores (ACR-0013 §3). If a handle, milestone, decision, brief, or prior learning already covers it, **surface it before work begins.**

This is the single highest-value function. Had it existed today it would have stopped the word "anchor" cold.

Cheap and lazy: the topic-specific guard fires on the work, not on the greeting.
ACR-0017 adds lifecycle enforcement around this principle: `SessionStart`
injects the durable continuation foundation, and the first real
`UserPromptSubmit` runs this guard against the user's topic. A trivial first
prompt such as `continue` resolves to the handoff's `front_of_line`.

### 3.2 PARSE

As the chat runs, extract candidates with evidence (Kevin's exact words + turn reference):
- decisions Kevin made
- corrections he issued
- **reversals** (the expensive ones — e.g. "10DLC is not on the critical path")
- open questions
- the `front_of_line` — the single next move

### 3.3 PROPOSE — never assert

Candidates are written to `mcs_learning_candidates` as `status: proposed`, **with evidence, never as fact.** An agent's own suggestion is not Kevin's decision — even if he reacted well to it.

### 3.4 CONFIRM — the load-bearing step

**Kevin ratifies. Kevin weights (0–10). Kevin names what deserves a handle.**

Extraction is cheap; **confirmation is the scarce signal.** An agent that grades its own learnings is exactly how the corpus reached 606 notes with 64% marked critical-or-high. The agent proposes; it never self-promotes a candidate into memory, and it never mints a handle.

### 3.5 WRITE & VERIFY

Confirmed items go through the ACR-0012 envelope — Mongo → Chroma (delete-then-add on update) → Neo4j → **read back**. Any new handle is **retrieval-tested** (ACR-0013 §5) before it counts — live on the machine that owns the library (`pnpm memory:verify`); the deterministic manifest gate covers CI, where the library is unreachable by design.

Writes carry `audience` (ACR-0012 §3.2b; absent fails closed to `dev_agents`) and graph edges are written as **typed relationships with provenance** (`asserted_by` / `asserted_at` / `source_chat`), from stated assertions only — the agent never invents edges (ACR-0013 §4.3).

### 3.6 CLOSE

Write the handoff per `docs/handoff-contract.md`: `_id = handoff_chat_{N}`, agreeing `chat_number`, `chat_registry_id` bound to `agent_operations.chat_registry`, `summary`, ordered `next_priorities[]`, and **`front_of_line`**. The next session opens on truth, not triangulation.

## 4. Guardrails

- The agent **proposes**; Kevin **disposes**. It never self-confirms, never self-weights, never mints a handle.
- Evidence or it didn't happen: every candidate cites Kevin's actual words.
- Never flatten lineage: Kevin authors the meaning; Claude is the conversational partner; Codex operationalizes (per the 2026-07-06 lineage decision).
- Automatic lifecycle delivery is governed by ACR-0017. Static foundation
  arrives at session/subagent start; topic retrieval fires on the first work
  prompt, not on the greeting itself.
- Silence is a valid output. A chat with no durable learning produces no candidates.
