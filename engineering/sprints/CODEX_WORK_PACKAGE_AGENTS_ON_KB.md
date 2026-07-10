# Codex Work Package — Agents Run On The Knowledge Base ("KB as OS")

Date: 2026-07-07 | Branch base: `main` | Governance: ACR-0007

## The real goal

The purpose of MCS v2 is to support and train Team Magnificent BAs through agents
that generate real, knowledge-grounded responses from the approved Knowledge Base.
That is what "KB as OS" means: every agent runs ON the KB, not beside it.

This package makes that true. It is NOT a new subsystem — the KB retrieval spine
is already built and PROVEN (Steve uses it end-to-end). The work is closing the
two agents that don't yet run on it, and proving the one that does.

## Verified state (code read 2026-07-07, not from ledgers)

| Agent | Role | Generates? | Runs on KB? | Gap |
|---|---|---|---|---|
| **Steve** | Discovery / Success Interview | YES (real Anthropic) | YES — `steveConversationRuntime` calls `requestSteveRuntimeContextPacket` | Just needs LIVE PROOF (flag on, never exercised) |
| **Michael** | Training Agent / Daily Success Coach | NO — route returns fixtures | Foundation exists but route bypasses it | Build generation; reroute off the S2.20 fixture facade |
| **Ivory** | List creation + invitation generation | YES (real Anthropic) | NO — zero KB calls in `ivory.ts` | Connect her draft path to `searchApprovedKnowledge` |

KB itself: real. 471 approved chunks, semantic search returns correct hits. The
retrieval machinery (`searchApprovedKnowledge`, `contextManagerRetrievalAdapter`,
the per-agent context foundations) is built. Steve is the reference for "done right."

## Execution order

1. **Steve live proof** (fast, no code): boot server with `ANTHROPIC_API_KEY` set,
   run `server/scripts/smoke-steve-context-comparison.ts` or one discovery turn.
   Confirm approved KB reaches Steve's prompt WITHOUT leaking Context-Packet
   internals to the BA. This validates the pattern the other two will copy.

2. **Michael generation** — `CODEX_EXECUTION_PROMPT_MICHAEL_GENERATION.md`.
   Build `buildMichaelSystemPrompt` + `michaelConversationRuntime` mirroring Steve;
   reroute `/api/michael-runtime/resolve` off the fixture facade to real
   generation; consume the KB (his context foundation already calls it); persist
   triple-stack with read-back. Michael's foundation already retrieves — the route
   just has to use it.

3. **Ivory KB grounding** — `CODEX_EXECUTION_PROMPT_IVORY_KB_GROUNDING.md`.
   Add `searchApprovedKnowledge` to her existing (working) generation path; inject
   as grounding in `buildCoachSystem` after the hard compliance rules; degrade
   gracefully to prompt-only if retrieval is empty/errors.

## What "done" looks like for this package

All three agents generate real responses grounded in the approved Knowledge Base,
proven live end-to-end against a running server, with app-data writes triple-stack
read-back verified. At that point the app does the thing it exists to do: agents
train and support BAs from Kevin's governed knowledge, not from unguided model priors.

## Constraints (all three tasks)

- ACR-0007 persistence law: direct Mongo+Neo4j+Chroma, one op, read-back verified.
- Universal Gateway is dev tooling only — never a runtime persistence path.
- No ratified-doc edits (`constitution/**`, `runtime/**`, `organization/**`, `docs/locked-spec.md`).
- Additive only; keep `@momentum/shared` exports and existing agent contracts intact.
- Kevin reviews and merges each under ACR-0007 gates.
