# ACR-0012/0013/0014: memory envelope, retrieval standard, context agent, and the library of context

Implements the three RATIFIED governance specs committed in this PR — `docs/governance/ACR-0012-agent-memory-schema.md` (write envelope + canonical stores), `ACR-0013-context-retrieval-standard.md` (the retrieval ladder), and `ACR-0014-context-agent.md` (guard → parse → propose → confirm → close). Extends `memory_context_compiler.schema.v1` (CDX-001) append-only; the concept was **not** rediscovered.

## Retrieval distances per handle (live, `pnpm memory:verify`, 2026-07-11)

Semantic leg — top hit + visible separation (`chromadb2/mcs_memory_context_index` unless noted):

| Phrase | Top hit | Distance | Runner-up | Separation |
|---|---|---:|---:|---:|
| `kevin's real turning point` | `kevins_real_turning_point_2026_07_05` | 0.477 | 1.405 | 0.928 |
| `krtp-mem` | `kevins_real_turning_point_2026_07_05` | 1.346 | 1.417 | 0.071 |
| `Digital Memory Discovery` | `digital_memory_discovery_20260706` | 0.762 | 1.155 | 0.394 |
| `voice mailer reality` | `voicemail-dialer-reality-2026-07-11` | 0.640 | 1.541 | 0.901 |
| `voice mailer reality` (memory stack, `chromadb/claude_learning_notes`) | `voicemail-dialer-reality-2026-07-11` | 0.576 | 1.102 | 0.526 |

Invocation leg — rung-1 deterministic lookup resolves all 9 phrases (`kevin's real turning point`, `krtp-mem`, `Digital Memory Discovery`, `voice mailer reality`, `cdx-001`, `codex message 1`, `memory-context-compiler`, `mcc-v1`, `go to intervector agent message`) to their records. All 14 checks PASS. The four-letter alias `krtp-mem` is semantically thin (separation 0.071); its real invocation path is the deterministic rung-1 lookup, which it passes — the manifest documents this explicitly.

## Integrity numbers (the library generator, read-only)

`pnpm memory:index` now reads **all** ACR-0013 §3 stores: `memory_index` 34 · `memory_decisions` 137 · `kevin_milestone_chats` 2 · `session_handoffs` 167 · `chat_registry` 40 · `momentum.decisions` (governance ledger) 42 · `claude_learning_notes` 606 · `kevin_library` 19 (memory stack) + `momentum.mcs_memory_context_index` 4 (app stack).

Corpus integrity (learning notes, at the back of the document per the ACR): 606 total · 170 ungraded · 573 unassigned project · 1 named anchor · **64.2% critical-or-high** (389/606, case-normalized on read) · dialects surfaced: `category` 543, `content` 545 as body field, `created_at` 399, `chat` (not `chat_number`) 152, `note_id` 120, `noteId`/`learned`/`createdAt` 2 each, 208 notes with no usable date.

**Acceptance test:** `docs/memory-index.html` contains **Kevin's Real Turning Point** and the **Holding Tank** handoffs — the two things the previous single-collection index missed. Section order is the spec: 1 Handles & aliases → 2 Milestones → 3 Decisions → 4 Work chronicle → 5 Learning notes + corpus integrity.

## What shipped

- **The guard (ACR-0014 §3.1, built first)** — `server/src/lib/contextGuard.ts`: `checkExisting(topic)` searches every store in the §3 registry (`server/src/lib/memoryStores.ts`), returns hits with provenance (stack, store, record id, date, **who stated it — Kevin or agent**) plus any `useWhen`/`nextAgentInstruction`. `verifiedAbsent` is true only when every store was reachable and none hit. CLI: `pnpm memory:guard "<topic>"` (exit 2 when stores were unreachable — absence NOT verified).
- **The retrieval ladder (ACR-0013 §4)** — `server/src/lib/contextPacket.ts`: `compileContextPacket()` — rung 1 exact `call_phrase`/alias/`useWhen` invocation (no semantic guessing), rung 2 compile (canonical Mongo record + Neo4j expansion along `requires_context`/`grounds`/`supports`/`hands_off_to`/`supersedes` + capped Chroma neighbours + `implementationBriefs` in stated order), rung 3 union semantic fallback across ALL stores ranked weight × recency × distance. Superseded records surfaced as superseded; packets token-budgeted. CLI: `pnpm memory:packet "<phrase>"`.
- **Retrieval regression (ACR-0013 §5)** — `server/src/lib/handleManifest.ts` (every phrase + measured floors) + `server/src/lib/__tests__/retrievalRegression.test.ts` (live vitest; a failing handle fails the build; `RETRIEVAL_REGRESSION=skip` escape hatch for offline machines only) + `pnpm memory:verify` standalone.
- **Kevin's real handles populated** — `pnpm memory:populate-handles` (`server/scripts/populate-context-handles.ts`) projected three Kevin-named handles into `momentum.mcs_memory_context_index`, **reading the source records** (`kevin_milestone_chats`, `memory_index`, `memory_decisions`, `claude_learning_notes`) — never inventing content: KRTP (alias `krtp-mem`), Digital Memory Discovery, voice mailer reality. Idempotent; each passed the full envelope + retrieval test. The index went from 1 entry (cdx-001) to 4.
- **The library of context (ACR-0012 §3.4)** — `server/scripts/generate-memory-index.mjs` rewritten to read ALL stores (was: `claude_learning_notes` only). Emits `docs/memory-index.html` (print-ready Letter, repeating `<thead>`, no split rows, Team Magnificent tokens from `packages/shared/src/brand.ts`) and `docs/memory-drift-report.md` (describes what a migration WOULD touch; mutates nothing). The old single-store outputs (`docs/agent-memory-index.html`, `docs/agent-memory-drift-report.md`) are deleted — superseded within this branch.
- **The context agent (ACR-0014)** — `server/src/lib/contextAgent.ts`: `parseSessionCandidates()` (pure; only Kevin's turns produce candidates; reversals/corrections/decisions/open questions/`front_of_line`, each with his exact words + turn ref), `proposeCandidates()` (writes `status: 'proposed'` to the pre-existing `momentum.mcs_learning_candidates` queue, satisfying its validator; idempotent; read-back), `confirmCandidate()` (executes Kevin's ruling only — routes confirmations through `writeAgentNote()`/`writeHandle()`; never self-confirms/self-weights/self-mints), `closeSession()` (handoff per `docs/handoff-contract.md`; `_id`/`chat_number`/title/`chat_registry_id` agreement is unrepresentable; registry row verified before writing; `front_of_line` required; read-back).
- **Writer helper for handles** — `server/src/lib/memoryContextIndex.ts`: `writeHandle()` (requires `named_by` containing Kevin — only Kevin mints handles; full envelope Mongo → Chroma delete-then-add → Neo4j → read back all three → retrieval-test every phrase, the call phrase OPENS the Chroma document). Complements the already-landed `writeAgentNote()`/`writeAnchor()` in `agentMemory.ts` (memory stack).
- **Shared contract** — append-only extension of `packages/shared/src/runtime/memory-context-compiler-schema.ts` (guard report, provenance, packet, ladder rung, learning-candidate types). Nothing above the appendix line was edited; CDX-001's graph questions/verbs/store functions preserved.
- **Docs** — `docs/AGENT-BRIEFING.md` + `CLAUDE.md` gain ACR-0013/0014 sections (guard-before-invention, the ladder, absence discipline, only-Kevin-mints-handles, two-stack table, read-back). Pointers to the ACRs, not restatements.

## What was deliberately left alone

- **Every existing record** — no backfill, no re-grading, no renames, no case fixes (ACR-0012 §4). The drift report describes; it does not act. cdx-001's 2026-07-06 vectors were not re-embedded — deterministic invocation is their contract (documented in the manifest).
- The 606 learning notes, the 22-orphaned-vector incident residue, the §9 migration, VM dialer, Holding Tank, CRM dispositions.
- `momentum.mcs_learning_candidates` schema/validator — wired as-is, not redesigned.
- App-runtime persistence (`tripleStackWrite`) — all new modules are agent tooling on the gateway path, marked "NOT for app runtime"; nothing in `routes/`/`domain/`/`services/` imports them.
- `.env.example` — memory/app stack URIs are agent-tooling env with documented defaults in the script headers; no secrets committed.

## Could not implement as specified / judgment calls

- **`agent_operations.chat_registry` is empty on both stacks** — the populated collection is `universal_gateway.chat_registry` (40 rows). The store registry reads where the rows actually are and the discrepancy is surfaced in `docs/memory-drift-report.md`; data was not moved (that would be a migration).
- **The `krtp-mem` semantic floor is 0.02, not 0.5** — a four-letter alias cannot win by a wide semantic margin; it still must be the top hit, and its deterministic rung-1 invocation is asserted separately. All other handles carry floors ≥ 0.2 derived from live measurement.
- The proposal queue's validator requires `domain`/`language`; candidates are written with `domain: 'organizational'`, `language: 'en'` as neutral defaults pending Kevin's confirmation step.

## Gates

`pnpm typecheck` ✅ · `pnpm build` ✅ · `pnpm --filter @momentum/server test` ✅ (includes contextSystem unit suite + live retrieval regression) · `pnpm memory:index` ✅ (KRTP + Holding Tank present) · `pnpm memory:verify` ✅ (14/14 handles).

🤖 Generated with [Claude Code](https://claude.com/claude-code)
