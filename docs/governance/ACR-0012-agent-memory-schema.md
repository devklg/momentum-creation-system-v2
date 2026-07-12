# ACR-0012 — The Memory Index: Canonical Stores, Handles & the Library of Context

**Status:** RATIFIED
**Ratified by:** Kevin La'Mont Gardner — 2026-07-11
**Lineage:** Extends **Digital Memory Discovery** (2026-07-06), Kevin's named birth moment for this layer. This ACR does not invent the memory-index concept — it **codifies what Kevin already built** and closes the drift around it.

---

## 1. What already exists (and must not be reinvented)

Kevin authored this system on 2026-07-06 and named it **Digital Memory Discovery**:

> "Kevin can create the words, titles, categories, and tags that attach meaning to memory, and those entries become printable/findable memory-index handles that can later compile context packets for agents."

The mechanism, live in `memory_decisions` today:

| Type | Purpose | Example |
|---|---|---|
| `memory_index_entry` | A **human handle** — Kevin's words for a body of meaning. Carries `human_handle`, `call_phrase`, `memory_id`, `weight` (1–10), `category`, `tags`. | `digital_memory_discovery_20260706` |
| `memory_index_alias` | A short invocation alias bound to a handle. | `krtp-mem` → `kevins_real_turning_point_2026_07_05` |
| `milestone` | A pinned chat/arc preserved for perpetuity. `pinned_by: kevin`, canonical home `universal_gateway.kevin_milestone_chats`. | **Kevin's Real Turning Point** (2026-07-03–05) |

**Lineage is preserved deliberately** (Kevin, 2026-07-06): Kevin is the discoverer and author of the meaning; Claude was the conversational partner where the breakthrough unfolded; Codex receives, verifies, memorializes, indexes, and operationalizes. The record must not flatten all agents into one source.

**Weight (1–10), not severity, is the canonical gradient for meaning.** Severity remains only for agent *corrections* (learning notes).

## 2. The drift being closed

### 2.1 The index was never whole
Memory is spread across at least five stores. Any "index" that reads one of them is not a library — it is a fragment. On 2026-07-11 an index was generated from `claude_learning_notes` alone; it contained **neither Kevin's Real Turning Point nor the Holding Tank context**, because neither lives there.

| Store | Holds |
|---|---|
| `universal_gateway.claude_learning_notes` | agent corrections (606) |
| `memory_decisions` | **memory-index entries, aliases, milestones**, Kevin's decisions |
| `momentum.decisions` / `momentum_decisions` | governance & ACR ledger |
| `universal_gateway.session_handoffs` | the work chronicle (Holding Tank, orientation, spec closures) |
| `universal_gateway.kevin_milestone_chats` | pinned milestone chats |
| `kevin_library` | Kevin's foundational library |

### 2.2 Store drift — two stacks, one name
The gateway exposes **two connector sets against different instances**:

| Connectors | Instance | Use for |
|---|---|---|
| `mongodb`, `chromadb`, `neo4j` | **memory stack** | all memory/index/handles |
| `mongodb2`, `chromadb2`, `neo4j2` | **MCS-v2 app stack** | application data only |

**Both host a database named `momentum`.** An agent that confuses them writes memory into the app stack or cleans the wrong database — **and every call reports success.** On 2026-07-11, 22 app-stack vectors sat orphaned for hours after being reported "purged from all three legs." State which stack you are on before any destructive or verifying operation. A read that finds nothing on the wrong stack is not evidence of absence.

### 2.3 Schema drift in learning notes
606 notes; 170 ungraded; 573 with no project; `high` and `HIGH` both present; 386 (64%) graded critical-or-high — severity has stopped discriminating. Three field dialects: `note_id`/`noteId`, `note`/`learned`, `subject`/`topic`/`category`, `created_at`/`createdAt`.

## 3. Decision

### 3.1 Handles are Kevin's to mint
Only Kevin names a handle. Agents never self-declare one. When he names something:
- Write a `memory_index_entry` with `human_handle` = **his exact words**, `call_phrase`, `memory_id`, `weight`, `category`, `tags`.
- Add a `memory_index_alias` if he gives a short form (e.g. `krtp-mem`).
- The Chroma document body **opens with the handle** — measured: leading with the phrase moved one entry's retrieval distance from **0.878 → 0.576**.
- **Retrieval-test it.** Search the call phrase; it must return top with visible separation. A handle that does not retrieve is not a handle.

### 3.2 Canonical learning-note schema (agent corrections only)
`note_id` · `subject` · `note` · `trigger` · `severity` (`critical`|`high`|`medium`|`low`, lowercase) · `tags[]` · `project` · `chat_number` · `created_at` · `canonical_collection`.
Severity grades **consequence of being wrong**, not enthusiasm. `critical` = breaks production, corrupts data, or loses money. Target <10%.

### 3.3 Write protocol
Mongo (canonical) → Chroma (semantic; **`add()` does not overwrite — update = delete then add**; `verified: true` is not proof) → Neo4j. **Read back and confirm.** Never report a write or delete complete without re-querying.

### 3.4 The Memory Index is a library of context
One regenerable, printable index **across all stores in §2.1**. It MUST lead with:
1. **Handles & aliases** — Kevin's vocabulary, with their call phrases. This is the point of the artifact.
2. **Milestones** — pinned, preserve-for-perpetuity arcs.
3. **Corpus integrity** — ungraded, unassigned, dialect counts, drift.
4. Then decisions, handoffs, and learning notes.

What isn't visible drifts. The index is how Kevin pulls shared memory into immediate context.

## 4. Scope

**In:** canonical stores; the handle/alias/milestone contract; the learning-note schema; a writer helper; the multi-store index generator; a read-only drift report.

**Out:** **mutating any existing record.** No backfill, no re-grading, no renames. The drift report describes; a migration is a separate ratified step. We do not rewrite history we have not read.
