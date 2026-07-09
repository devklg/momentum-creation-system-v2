# Memory Gap Solutions for Semantic Context

**Created:** 2026-07-09
**Audience:** Codex, Claude, and future MCS v2 implementation agents
**Status:** active implementation memory

## Why This Exists

During the KB / Context Manager / runtime trace work, the first pass covered
Michael and Steve but missed Ivory. Kevin caught it immediately.

That miss exposed a memory gap: agents were reasoning from the most visible
runtime consumers instead of auditing the full semantic-context contract. The
registry already declared Ivory as a Context Packet agent. The implementation
had to follow that registry, not just the files touched most recently.

## The Rule

When adding semantic context, KB retrieval, runtime traces, or Context Manager
behavior, audit every registered agent before calling the work complete.

Current registered agents:

- `michael_magnificent`
- `steve_success`
- `ivory`

Do not stop at the agents that are easiest to see in the current branch.

## The Diagnostic Checklist

For every registered agent, answer these before finalizing:

1. Is the agent present in `server/src/runtime/orchestration/registry.ts`?
2. Does the registry say `requiresContextPacket: true`?
3. Which production route/domain path actually serves that agent today?
4. Does that production path request a Context Packet through the Context Manager?
5. Does it use the approved knowledge provider instead of raw Mongo/Chroma/Neo4j reads?
6. Does it write a content-free runtime trace showing packet/source/knowledge ids?
7. Does the trace fail safely if a store stalls?
8. Is there a focused test proving the path requests context and writes a trace?
9. Is the protocol doc updated so the next agent sees the rule?

## Implemented Solution

Runtime context traces now cover:

- Michael runtime: `server/src/routes/michael-runtime.ts`
- Steve discovery runtime: `server/src/domain/steveConversationRuntime.ts`
- Ivory coach and invitation draft runtime: `server/src/domain/ivory.ts`

Context foundations now include:

- `server/src/runtime/context/michaelRuntimeContextFoundation.ts`
- `server/src/runtime/context/steveRuntimeContextFoundation.ts`
- `server/src/runtime/context/ivoryRuntimeContextFoundation.ts`

Trace records are written by:

- `server/src/services/runtimeContextTrace.ts`

Trace storage:

- MongoDB: `momentum.mcs_runtime_context_traces`
- Neo4j: `(:RuntimeContextTrace)` with `USED_KNOWLEDGE` and `USED_SOURCE` edges
- ChromaDB: `mcs_runtime_context_traces`

Trace records must remain content-free. They store ids, counts, statuses,
retrieval method names, route/catalog decisions, and a short sanitized query
hint. They must not store raw prompts, full generated responses, or full KB
content.

## Failure Pattern To Avoid

Bad pattern:

- “Michael and Steve are traced, so the agent/context layer is complete.”

Correct pattern:

- “The registry has three Context Packet agents. Michael, Steve, and Ivory all
  need production Context Manager paths and trace coverage before the semantic
  context layer is complete.”

## Design Principle

The Knowledge Base is not useful just because data exists in Mongo, Chroma, and
Neo4j. It becomes useful when the runtime:

- retrieves approved knowledge through the Context Manager,
- keeps candidates and raw sources out of agent prompts,
- records which approved ids were used,
- exposes operator observability without leaking prompt or response content,
- and applies that discipline to every agent that can act from semantic context.

## Standing Instruction

When Kevin asks whether the KB OS, context layer, or runtime works as intended,
do not answer from database counts alone. Verify the complete chain:

source ingestion -> taxonomy -> index -> Chroma/Neo4j projections -> Context
Manager retrieval -> agent-specific production path -> content-free runtime
trace -> admin/operator observability.

If any registered agent is missing from that chain, say so and close the gap.
