# Memory Drift Report — all stores

> Generated 2026-07-12T03:46:02.149Z by `node server/scripts/generate-memory-index.mjs` (`pnpm memory:index`).
>
> **READ-ONLY.** This report *describes* non-conformance against ACR-0012 /
> ACR-0013. Under ACR-0012 §4, mutating existing records — backfill,
> re-grading, renames — is out of scope and requires a separately ratified
> migration. Nothing was modified to produce this report.

## Store inventory (ACR-0013 §3 — all of them)

| Store | Stack | Records read |
|---|---|---:|
| `universal_gateway.memory_index` | memory | 34 |
| `universal_gateway.memory_decisions` | memory | 137 |
| `universal_gateway.kevin_milestone_chats` | memory | 2 |
| `universal_gateway.session_handoffs` | memory | 167 |
| `universal_gateway.chat_registry` | memory | 40 |
| `momentum.decisions (governance ledger)` | memory | 42 |
| `universal_gateway.claude_learning_notes` | memory | 606 |
| `universal_gateway.kevin_library` | memory | 19 |
| `momentum.mcs_memory_context_index` | app | 4 |

## Cross-store discrepancies observed (described, not fixed)

- `docs/handoff-contract.md` names the chat registry as `agent_operations.chat_registry`; the populated collection on the live memory stack is `universal_gateway.chat_registry` (`agent_operations` is empty on both stacks). Readers should follow the rows; a future ratified step should reconcile the doc or move the data — not this generator.
- 53 session_handoffs row(s) carry a non-integer chat_number (slugs/dates) — violates the registry numbering rule; left as-is.
- 1 chat_registry row(s) carry a suspicious chat_number (non-integer or date-as-number, e.g. 20260610); left as-is.
- cdx-001 (`momentum.mcs_memory_context_index`, app stack) claims aliases `digital-memory-discovery` and `dmd-mem`; the Digital Memory Discovery handle entry deliberately claims no aliases to avoid ambiguity. Kevin may reassign; agents must not mutate cdx-001.

## Learning-notes corpus snapshot (`universal_gateway.claude_learning_notes`)

| Metric | Value |
|---|---:|
| Total notes | 606 |
| Ungraded (no `severity`) | 170 |
| Unassigned project (missing or `unassigned`) | 573 |
| Named anchors | 1 |
| Graded `critical` | 195 |
| Graded `high` | 194 |
| Graded `medium` | 44 |
| Graded `low` | 2 |
| Critical-or-high share | 64.2% (target: critical <10%) |
| Severity casing drift (e.g. `HIGH`) | 3 |
| Non-standard severity values | 1 (downgraded_to_partial_truth) |
| No usable date at all | 208 |
| No canonical `created_at` | 207 |

## What a future migration would touch

### Field renames (dialect → canonical)

| Legacy field | Notes carrying it | Migration action |
|---|---:|---|
| `noteId` | 2 | rename to `note_id` |
| `topic` | 8 | rename to `subject` |
| `category` | 543 | rename to `subject` |
| `learned` | 2 | rename to `note` |
| `lesson` | 20 | rename to `note` |
| `content` | 545 | rename to `note` |
| `createdAt` | 2 | rename to `created_at` |
| `timestamp` | 3 | convert to `created_at` (ISO 8601) |
| `date` | 4 | convert to `created_at` (ISO 8601) |
| `chat` | 152 | rename to `chat_number` (integer-only) |

Counts overlap — one note can carry several dialects. `timestamp`/`date`/`chat`
are counted only where the canonical field is absent.

### Grading and assignment backfill

- **170 notes** need a severity grade. Under §3.3 discipline most
  should land `medium`/`low`; bulk-defaulting them to `high` would repeat the
  severity collapse this ACR exists to reverse.
- **573 notes** need a real `project` value. `unassigned`
  is a defect, not a value.
- **3 notes** need only case normalization (`HIGH` → `high`).
- **1 note(s)** carry a severity outside the canonical
  four (downgraded_to_partial_truth) and need a human re-grade —
  not a mechanical coercion.
- **208 notes** have no recoverable date on any known dialect; a
  migration could fall back to the ObjectId timestamp where `_id` is an ObjectId.
- Every note needs `canonical_collection: "universal_gateway.claude_learning_notes"` and a
  `trigger` keyword string where absent.

### Cross-store legs

The canonical write protocol (ACR-0012 §3.3) is Mongo → Chroma → Neo4j with
read-back. A migration must also reconcile the Chroma projections using
**delete-then-add** (Chroma `add()` does not overwrite), and re-run the
retrieval regression (`pnpm memory:verify`) for every handle and anchor.

## What this report deliberately does not do

- It does not modify, re-grade, rename, or backfill any record in any store.
- It does not move the chat registry, renumber handoffs, or touch cdx-001's aliases.
- It does not decide the migration — that is a separate ratified step.
