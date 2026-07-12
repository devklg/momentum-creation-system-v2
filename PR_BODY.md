# ACR-0012/0013/0014: memory envelope, retrieval standard, context agent, and the library of context

Implements the three RATIFIED governance specs committed in this PR — `docs/governance/ACR-0012-agent-memory-schema.md` (write envelope + canonical stores), `ACR-0013-context-retrieval-standard.md` (the retrieval ladder), and `ACR-0014-context-agent.md` (guard → parse → propose → confirm → close). Extends `memory_context_compiler.schema.v1` (CDX-001) append-only; the concept was **not** rediscovered.

---

# Round 2 (2026-07-12) — CI unred + Kevin's three corrections

## FIX 1 — CI was red: the live/deterministic split

CI failed with `ECONNREFUSED 127.0.0.1:2526` — the retrieval regression reached for the Universal Gateway from a GitHub runner. **Kevin's ruling: the main library is LOCAL BY DESIGN; runners must never reach it.** Split:

- **CI gate (deterministic, no network, always runs):** `server/src/lib/handleManifest.ts` now carries the committed **handle manifest fixture** (handle, call_phrase, aliases, expected memory_id, audience) and `server/src/lib/__tests__/handleManifest.test.ts` asserts every handle and alias resolves through **rung-1 invocation** via the REAL matching rule (`matchHandleDoc`, now exported pure) — unambiguously, exactly. Fails if a handle is renamed, duplicated, or dropped. Plus the audience-boundary assertions (below). 36 deterministic tests.
- **Local-only (live):** `retrievalRegression.test.ts` runs only with `RETRIEVAL_REGRESSION=live`; otherwise it is **skipped with a loud console banner** (never a silent pass, never a false failure). `pnpm memory:verify` is the standalone live runner. `ci.yml` sets `RETRIEVAL_REGRESSION: skip` explicitly with a comment explaining why.
- Live suite re-run on Kevin's machine after tonight's writes: **19/19 pass** (`pnpm memory:verify`: all handles retrieve).

Also fixed while in there: `findExactHandle` was first-doc-wins, so one record's `useWhen` substring could shadow another record's exact call_phrase (cdx-001's useWhen contains "digital memory discovery"). Now rank-based within each store: exact handle > exact alias > useWhen. And `expandGraph` keyed graph lookups off Mongo `_id` — for learning-note anchors that's an ObjectId, not the slug; it now uses the same id rule as provenance (`note_id`/`noteId` first), which is what made anchor-rooted graph expansion work at all.

## FIX 2 — `audience`: the compile-time boundary

- `audience: 'dev_agents' | 'app_agents' | 'both'` added to the memory envelope: `AgentNote` (agentMemory.ts), `MemoryHandleInput`/`buildEntryDocument` (memoryContextIndex.ts), Chroma metadata, Neo4j props, and the shared schema (`McsMemoryAudience`, appended).
- **Fail closed:** `audienceOf()` in memoryStores.ts — absent/unknown → `dev_agents`, never `app_agents`.
- `compileContextPacket()` filters every hit list (canonical, neighbours, fallback, graph-edge endpoints) by audience; app-agent packets contain ONLY `app_agents`/`both`. Exclusion counts are reported in `warnings` without leaking content.
- **Deterministic CI test** (no database): no dev handle survives the app-agent filter; an unmarked record never reaches an app packet.
- **cdx-001 and the app-stack `claude_learning_notes` copy: untouched**, exactly as ruled — projections are by design; audience is what says who each record is for.

## FIX 3 — the verbs are the operators

- `compileContextPacket(handleOrPhrase, verb?, options)` — the verb selects the Neo4j traversal (**multi-hop**, up to 3 hops, matching UPPERCASE memory-stack and lowercase app-stack edge types); no verb → the full 13-verb chain (was 5). CLI: `pnpm memory:packet "<phrase>" --verb excludes [--audience …]`.
- **Edges are relationships, not properties:** typed, directional, traversable; edge provenance (`asserted_by`/`asserted_at`/`source`) travels into the packet as `evidence`.
- **Verb coverage is a first-class metric:** `measureVerbCoverage()` + `verbCoverage` on every compiled packet + a new "Verb Coverage — The Operators" section in `docs/memory-index.html` and dead-operator lines in the drift report. A **hollow operator** produces an explicit warning — e.g. compiling `--verb protects` on a handle with no PROTECTS edges says *"empty because the edges were never written, NOT because the answer is empty."*

## FIX 4 — tonight's edges (Kevin is the asserter), written and read back

`server/scripts/write-edges-2026-07-11.ts` (idempotent, MERGE, ON CREATE only — no existing record mutated). Memory stack, all edges `asserted_by: kevin · asserted_at: 2026-07-11 · source: chat`:

- **`voice mailer reality`** — 18 edges: REQUIRES_CONTEXT×5 (apache leads callback model, lead qualification pipeline, US-only phone normalization, quiet hours/region windows, Telnyx connection wiring), GROUNDS×2, HANDS_OFF_TO×2 (PMV, Holding Tank), PROTECTS×4, EXCLUDES×3, SUPERSEDES×1 (press-1 → auto-SMS-link design), CONTRADICTS×1 ("Telnyx is ringless").
- **`member sms channel`** — new Kevin-named handle (weight 8, audience `dev_agents`): anchor written via `writeAnchor` on the memory stack (retrieves at distance **0.290**, separation 0.856) + context-index projection via `writeHandle` (distance **0.484**, separation 0.927) + 13 edges: REQUIRES_CONTEXT×5 (consent capture NOT BUILT, backfill, STOP/HELP handler NOT BUILT, G.6 exclusion list, 10DLC brand BFPJ85Q), PROTECTS×4 (incl. membership NEVER contingent on staying subscribed), EXCLUDES×3, RELATES_TO×1 → voice mailer reality (shared Telnyx account only).
- **All 31 edges read back and printed** with provenance; the script fails if any edge or the `kevin` assertion is missing.

**Verb coverage, memory stack — before → after:**

| Verb | Before | After |
|---|---:|---:|
| supersedes | 16 | 17 |
| relates_to | 14 | 15 |
| hands_off_to | 4 | 6 |
| captures | 2 | 2 |
| requires_context | **0** | **10** |
| protects | **0** | **8** |
| excludes | **0** | **6** |
| grounds | **0** | **2** |
| contradicts | **0** | **1** |
| expresses / supports / guides / retrieves | 0 | 0 (still dead — Kevin asserted no such edges; none invented) |

**4/13 → 9/13 operators populated.** The four still-dead verbs are named in the index and in every packet — hollow, not empty.

## Round-2 governance updates

ACR-0012 gains §3.2b (`audience`, fail closed) and §3.3b (edges are relationships with provenance); ACR-0013 gains §4.3 (verbs as operators), §4.7 (compile-time audience boundary), and a rewritten §5 (local-library / CI split); ACR-0014 §3.5 updated to match.

## Round 2 — could not do as specified

- The brief's positional signature `compileContextPacket(handleOrPhrase, verb?, audience)` is implemented as `(handleOrPhrase, verb?, options)` with `options.audience` — audience rides with `gatewayUrl`/`maxChars` rather than as a bare third positional; same operators, same semantics.
- App-stack verb coverage remains 1/13 (only `retrieves` from handle→source edges) — tonight's edges were memory-stack assertions by ruling; nothing was mirrored to the app stack.
- `expresses`, `supports`, `guides`, `retrieves` remain dead on the memory stack — the brief said "do not invent additional edges," so they stay dead and visibly reported.

---

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
