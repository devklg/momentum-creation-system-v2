# Codex Execution Prompt — Michael Training-Agent Generation Path

You are working inside the Momentum Creation System V2 repository (`D:/momentum-creation-system-v2`).

Architecture Version: 1.0 (FROZEN)
Governance: ACR-0007 APPROVED (direct triple-stack persistence)
Branch base: `main` (commit `fc365ac`)
Date: 2026-07-07

---

## Why this task exists (verified, not assumed)

Michael's role is settled and correct: he is the **Training Agent / Daily Success Coach** for Team Magnificent BAs, per `constitution/MOMENTUM_GOVERNANCE.md` and `TRAINING_ARCHITECTURE.md`. His job is to take a BA's training/support question and return a real, knowledge-grounded coaching response.

**The problem is purely implementation, not design.** A code read on 2026-07-07 confirmed:

- `server/src/routes/michael-runtime.ts` is, by its own header, **"fixtures-only, non-persistent, LLM-free"**. It resolves every turn through the S2.20 inert facade (`resolveMichaelRuntimeTurnResponse` / `michaelRuntimeResolutionFacade.ts`), which returns a **pre-authored fixture by reference**. Michael does not generate.
- The other Michael surface, `/api/michael/*` (`michael.ts` + `domain/michael-training-support.ts`), is real but is **deterministic profile-projection** (`getTrainingSupportCardForSponsor`) — a sponsor-facing card derived from a downline BA's profile. It contains **no** LLM generation.
- There is **no** `buildMichaelSystemPrompt` and **no** `michaelConversationRuntime` anywhere in the repo (grep-verified: zero hits). Michael's coaching brain was never built — the large `runtime/orchestration/**` + `fixtures/**` Michael tree is scaffolding that selects/validates canned responses, not a generator.
- The wireframe build-map counts Michael's route as a "done leaf," which is why prior audits report ~98% complete. That measures surface presence, not generation. The surface exists; the thinking does not.

**Working reference to mirror:** Steve already has a real generation path. Build Michael's to match Steve's structure exactly.

**Retrieval gate (verified 2026-07-07 — do not miss this):** Michael's context foundation (`michaelRuntimeContextFoundation.ts`) already has a real live-retrieval path (`requestLiveContextPacket` → Context Manager → `searchApprovedKnowledge`, up to 6 approved chunks), but it is gated on `MCS_CONTEXT_MANAGER_LIVE_ENABLED === 'true'` and fails CLOSED to `packetStatus: 'degraded'` (no KB enrichment) when off. This flag is now SET to `true` in `.env` (line 101). If it is ever false, Michael generates KB-BLIND even with everything else wired correctly — the exact hollow outcome to avoid. Steve uses a SEPARATE flag, `STEVE_CONTEXT_MANAGER_LIVE_ENABLED` (also true). Verify `MCS_CONTEXT_MANAGER_LIVE_ENABLED=true` as part of the live-turn proof, and confirm the returned packet is NOT `degraded`.

- Steve prompt builder: `server/src/domain/steve-success-interview.ts` (`buildSteveSystemPrompt`)
- Steve conversation runtime: `server/src/domain/steveConversationRuntime.ts`
- Steve route wiring + LLM call + dormant-key handling: `server/src/routes/steve.ts` (uses `services/anthropic.ts`, `AnthropicConfigError`)
- Shared LLM transport (real, already keyed — `ANTHROPIC_API_KEY` is SET in `.env`): `server/src/services/anthropic.ts`
- KB retrieval Michael must consume: `searchApprovedKnowledge` in `server/src/services/knowledge/approvedKnowledgeStore.ts` (queries the `mcs_knowledge_chunks` Chroma collection; 471 approved chunks live).

---

## Persistence law (ACR-0007 — do not deviate)

- Production runtime persists to **MongoDB + Neo4j + ChromaDB directly**, through the existing app adapters/service layers. Every write lands in all three stores in the same logical operation, and **read-back verifies it**.
- The Universal Gateway (`localhost:2526`) is **developer tooling only** — never a production persistence path. Do not route Michael's persistence through it.
- Redis is not part of persistence. Do not add it.

---

## Task — build Michael's real generation path

Mirror Steve. Produce, as production code under `server/src/**` and `packages/shared/src/**` (additive; do not break existing exports):

1. **`buildMichaelSystemPrompt`** (new; e.g. `server/src/domain/michael-training-coach.ts`) — the Training Agent / Daily Success Coach system prompt, grounded in `TRAINING_ARCHITECTURE.md` philosophy (People Before Content; Progress Before Perfection; Simplicity Creates Duplication; Education Before Promotion; transformation over information transfer). Accepts BA first name + retrieved approved-knowledge context. EN/ES.

2. **`michaelConversationRuntime`** (new; mirror `steveConversationRuntime.ts`) — assembles the turn: pull approved knowledge via `searchApprovedKnowledge` (scoped to Team Magnificent + Michael), build the system prompt, call the shared Anthropic transport, return the coaching response. Fail-closed and LLM-dormant-safe exactly like Steve (surface `AnthropicConfigError` as a soft/503, do not crash).

3. **Re-wire `/api/michael-runtime/resolve`** (`server/src/routes/michael-runtime.ts`) to call the new runtime **instead of** `resolveMichaelRuntimeTurnResponse` (the fixture facade). Preserve the existing security envelope that is already correct: `.team`-only, `requireAuth`, `requireSteveComplete`, server-owned turn (BA scope from `req.session.tmagId`, never the body), the `language`/`ask` body contract, and the three-axis kill switch. Only the resolution step changes: fixture → real generation.

4. **Persist each Michael turn** via the existing triple-stack write pattern (Mongo + Neo4j + Chroma in one logical op) and **read back to verify**. If any leg errors, surface it loudly — do not silently skip a leg.

5. **Tests** (Vitest, matching the server's existing style — there are already 132 test files, 1,400 passing): cover the new prompt builder, the runtime turn (mocked LLM), the dormant-key path, the kill-switch axes still fail-closed, EN/ES, and that BA scope comes from session not body. Keep the suite green.

---

## Hard constraints

- Do NOT redesign Michael's role or invent new scope. His purpose is fixed: Training Agent / Daily Success Coach.
- Do NOT modify ratified documents (`constitution/**`, `runtime/**`, `organization/**`, `docs/locked-spec.md`).
- Do NOT change `.com` prospect surfaces or Steve's or Ivory's working code.
- Do NOT reintroduce the Universal Gateway as a runtime persistence path.
- Do NOT delete the existing fixture/orchestration Michael tree in this task — leave it in place, just stop routing through it. (Retiring dead scaffolding is a separate cleanup task.)
- Additive only for shared contracts; do not break current `@momentum/shared` exports.
- The kill switch must still fail-closed with no LLM call, no generation, no persistence when disabled.

---

## Close (required verification)

- `pnpm --filter @momentum/shared typecheck && pnpm --filter @momentum/server typecheck` — expected green.
- `pnpm --filter @momentum/server test` — expected all green, including the new Michael generation tests.
- Demonstrate one real Michael turn end-to-end against a running server with `ANTHROPIC_API_KEY` set: authenticated `.team` BA → `/api/michael-runtime/resolve` with `{ "ask": "..." }` → real KB-grounded coaching response → triple-stack write → read-back confirmation of all three legs.
- `git status` review confirming only intended `server/src/**`, `packages/shared/src/**`, and test files changed.
- Kevin reviews and merges. Production runtime code executes only under ACR-0007 gates (Implementing → Verified with persistence read-back → Merged).

---

## Note on scope vs. the 2026-07-07 audit

The same-day `engineering/audits/APP_STATE_AUDIT_2026-07-07_CODEX.md` reports ~98–99% build-map completion and lists Michael's route as "built." That is accurate at the wireframe-leaf level (the surface exists) but does not test generation — the route returns fixtures. This task closes that specific depth gap: it makes Michael actually generate. It does not contradict the audit; it addresses what a surface-level build-map cannot measure.
