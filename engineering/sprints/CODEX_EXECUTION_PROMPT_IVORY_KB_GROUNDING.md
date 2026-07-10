# Codex Execution Prompt — Ivory Knowledge-Base Grounding

You are working inside the Momentum Creation System V2 repository (`D:/momentum-creation-system-v2`).

Architecture Version: 1.0 (FROZEN)
Governance: ACR-0007 APPROVED (direct triple-stack persistence)
Branch base: `main`
Date: 2026-07-07

---

## Why this task exists (verified, not assumed)

Ivory's role is settled and correct: she helps Team Magnificent BAs with **list creation and invitation generation** (the Generator + Ivory invitation pair, per wireframe A3.4 and `constitution/MOMENTUM_GOVERNANCE.md`).

**Ivory's generation is real and already works** — this is NOT a fixtures problem like Michael. A code read on 2026-07-07 confirmed `server/src/domain/ivory.ts` calls the real Anthropic transport (`complete({...})` at lines ~725 and ~855), builds an admin-tunable coach system prompt via `buildCoachSystem` (`readMasterContent('team.ivory.coach_prompt')` + `COACH_SYSTEM_PREFIX`), and handles the dormant-key path (`AnthropicConfigError`). `ANTHROPIC_API_KEY` is SET in `.env`, so she generates today.

**The gap:** Ivory has **zero connection to the approved Knowledge Base.** Grep-verified — `ivory.ts` contains no `searchApprovedKnowledge`, no context foundation, no approved-knowledge call of any kind. She drafts invitations from her coach prompt and master-content voice **only**, blind to the 471 approved THREE knowledge chunks (product science, GLP-THREE facts, compliance do/don't) that are live in the KB.

The purpose of the app is that the agents run **on** the knowledge base — "KB as OS." Steve already does this correctly (his `steveConversationRuntime` calls `requestSteveRuntimeContextPacket` and renders it into his prompt). Ivory must do the same so her invitations are grounded in real, approved, compliance-checked THREE knowledge rather than the model's unguided priors — which is also the safest path for invitation content that touches product claims.

**Working reference to mirror:** `server/src/domain/steveConversationRuntime.ts` (lines ~33–304: imports `requestSteveRuntimeContextPacket` from `steveRuntimeContextFoundation`, calls it, renders via `renderSteveContextPromptSupplement`). The KB retrieval entry point is `searchApprovedKnowledge` in `server/src/services/knowledge/approvedKnowledgeStore.ts`.

---

## Persistence law (ACR-0007 — do not deviate)

- Production runtime persists to **MongoDB + Neo4j + ChromaDB directly**, all three in one logical op, **read-back verified**.
- Universal Gateway (`localhost:2526`) is developer tooling only — never a production persistence path.
- No Redis in persistence.

---

## Task — ground Ivory in the approved Knowledge Base

1. **Retrieve approved knowledge in Ivory's generation path.** In `server/src/domain/ivory.ts`, before `complete(...)` in the draft/coach flows, call `searchApprovedKnowledge` scoped to Team Magnificent + Ivory, using the invitation's product/angle/context as the query cue (e.g. product name + angle already available in `McsIvoryCoachPayload`). Mirror how Steve's foundation retrieves and shapes context.

2. **Inject retrieved knowledge into `buildCoachSystem`.** Add the approved-knowledge context as a grounding block in the assembled system prompt — AFTER `COACH_SYSTEM_PREFIX` and the hard compliance rules (which must still win), as factual grounding Ivory draws on. Keep the existing admin-tunable voice. If retrieval returns empty or errors, Ivory must **degrade gracefully** to today's prompt-only behavior — never blank, never throw (match the existing `readMasterContent` fallback philosophy already documented in the file).

3. **Preserve everything that already works:** the JSON output contract, `parseCoachJson`, the HARD COMPLIANCE RULES, the admin voice override, EN/ES, and the dormant-key handling. This task ADDS grounding; it does not restructure Ivory.

4. **No new persistence unless Ivory already persists.** If Ivory's draft/mint already writes app data, keep that path and its triple-stack read-back intact. Do not add a new persistence surface in this task.

5. **Tests** (Vitest, match existing server style): cover that retrieved approved knowledge reaches the system prompt; that empty/failed retrieval degrades to prompt-only without throwing; that compliance rules and JSON contract still hold with grounding present; EN/ES.

---

## Hard constraints

- Do NOT redesign Ivory's role or output contract. Additive grounding only.
- Do NOT modify ratified documents (`constitution/**`, `runtime/**`, `organization/**`, `docs/locked-spec.md`).
- Do NOT change `.com` surfaces, Steve, or Michael code in this task.
- Do NOT reintroduce the Universal Gateway as a runtime path.
- Retrieval failure must be non-fatal — Ivory always produces a valid invitation, grounded when the KB is reachable, prompt-only when it isn't.
- HARD COMPLIANCE RULES always win over any retrieved content.

---

## Close (required verification)

- `pnpm --filter @momentum/shared typecheck && pnpm --filter @momentum/server typecheck` — expected green.
- `pnpm --filter @momentum/server test` — all green, including new grounding tests.
- Demonstrate one real Ivory draft end-to-end against a running server with `ANTHROPIC_API_KEY` set: authenticated `.team` BA → invitation draft → confirm the response reflects approved THREE knowledge (e.g. product science pulled from the KB), and confirm graceful degrade when retrieval is forced empty.
- `git status` review confirming only `server/src/domain/ivory.ts` (+ any shared type it needs) and tests changed.
- Kevin reviews and merges under ACR-0007 gates.
