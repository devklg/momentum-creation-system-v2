# Agent Brief: Steve, Context Packets, and the Knowledge Base Next Step

**Created:** 2026-07-06
**Audience:** Codex, Claude, and future MCS v2 implementation agents
**Purpose:** Preserve Kevin's July 6 discovery and turn it into concrete next work for Steve Success and the Knowledge Base.

## Kevin's Corrected Direction

Kevin clarified that the fastest place where the Memory Context Compiler idea works, or can work right away, is Steve.

The reason is not that Steve already consumes the full Context Manager. He does not. The reason is that Steve already creates the first high-value human-context memory object in the app:

- the BA's primary why;
- success vision;
- learning style;
- communication preferences;
- support needs;
- launch recommendations;
- training recommendations;
- Michael handoff summary;
- transcript and answers.

Steve is therefore the first operational bridge from human meaning into durable agent memory.

## Current Reality

Steve is operational as a browser-based `.team` discovery conversation:

- UI: `apps/team/src/routes/steve-success-interview.tsx`
- Routes: `server/src/routes/steve.ts`
- Conversation runtime: `server/src/domain/steveConversationRuntime.ts`
- Discovery artifact domain: `server/src/domain/steve-success-interview.ts`

The runtime:

1. accepts BA turns through `/api/steve/discovery/converse`;
2. event-sources live transcript turns into `tmag_agent_steve_events`;
3. uses the Steve system prompt and runtime contract;
4. detects `[[DISCOVERY_COMPLETE]]`;
5. extracts structured profile JSON from the transcript;
6. persists the final discovery artifact through `ingestDiscoveryArtifact`;
7. writes the final artifact into MongoDB, Neo4j, and ChromaDB.

The current graph edges are:

- `(TeamMagnificentMember)-[:HAD_STEVE_DISCOVERY]->(TmagSteveDiscovery)`
- `(TmagSteveDiscovery)-[:VISIBLE_TO_SPONSOR]->(TeamMagnificentMember)`

The current semantic collection is:

- `mcs_steve_success_interview`

## The Important Gap

Steve is operational, but Steve is not yet operating inside the approved Knowledge Base / Context Packet layer.

Today, Steve mainly runs from:

- hardcoded domain prompt in `buildSteveSystemPrompt`;
- live event-sourced conversation state;
- extraction rules in `steveConversationRuntime.ts`;
- final artifact persistence in `steve-success-interview.ts`.

The formal runtime plan says Steve must consume Context Packets only:

- `engineering/plans/S2_STEVE_SUCCESS_RUNTIME_ACTIVATION_PLAN.md`

But the current orchestration adapter is still inert:

- `server/src/runtime/orchestration/adapters/steveSuccessAdapter.ts`

This means Steve currently creates durable memory, but does not yet consume compiled approved knowledge as his operating context.

## Why The Briefs Matter

Kevin's July 6 point: the briefs are functioning as the app's real knowledge base until the runtime Knowledge Base is fully wired.

The repo already contains many decisions, plans, reports, and briefs that define foundational app truth. They should not stay as passive files forever. The Knowledge Base intake system should convert approved briefs into governed knowledge records so Context Manager can compile context for agents from them.

The next agent should treat briefs as source material for approved/foundational knowledge, not as random documentation.

## Next Agent Mission

Wire Steve toward the Knowledge Base and Context Packet path without breaking the already-working Steve discovery flow.

Do not rewrite Steve from scratch.
Do not remove the existing `/api/steve/discovery/converse` flow.
Do not give Steve direct Mongo, Neo4j, Chroma, GraphRAG, or gateway access as a runtime agent.

The correct next move is to create a small, governed bridge:

1. Load approved Steve-relevant knowledge through the existing Knowledge Base provider.
2. Assemble a Context Packet through the Context Manager.
3. Feed the packet's approved knowledge, guardrails, exclusions, and retrieval audit into Steve's runtime prompt path.
4. Preserve degraded behavior if the Context Manager or approved knowledge is unavailable.
5. Keep the current discovery artifact persistence unchanged.

## Codex Start Slice Landed 2026-07-06

Codex began the bridge in a safe, flag-gated slice.

Implemented files:

- `server/src/runtime/context/steveRuntimeContextFoundation.ts`
- `server/src/runtime/context/__tests__/steveRuntimeContextFoundation.test.ts`
- `server/src/domain/steveContextComparison.ts`
- `server/src/domain/__tests__/steveContextComparison.test.ts`
- `server/src/runtime/context/index.ts`
- `server/src/runtime/context/contextManagerService.ts`
- `server/src/domain/steveConversationRuntime.ts`
- `server/src/domain/__tests__/steveConversationRuntime.test.ts`
- `.env.example`

What this slice does:

- Adds `STEVE_CONTEXT_MANAGER_LIVE_ENABLED=false` to `.env.example`.
- Adds a Steve-specific Context Manager foundation mirroring the Michael pattern.
- Builds a server-owned `context_packet.v1` request for `agentKey: "steve_success"` and `taskType: "success_interview"`.
- Keeps flag-off behavior degraded and store-free.
- When the flag is on, retrieves approved knowledge through `createStoredApprovedKnowledgeProvider().searchApprovedKnowledge(...)`.
- Renders approved packet knowledge into Steve's system prompt as internal guidance only.
- Adds the first governed shared contract for the Memory Context Compiler shape: `memory_context_compiler.schema.v1`.
- The contract names the three store functions Kevin identified: Mongo canonical memory, Neo4j relationship graph, and Chroma semantic meaning.
- The contract adds graph questions and graph verbs so agents can traverse memory by action: captures, expresses, supports, requires context, guides, retrieves, grounds, protects, excludes, hands off to, relates to, supersedes, and contradicts.
- Adds a pure non-persistent Steve diagnostic comparison report that conforms to that compiler contract.
- Records proposed ACR-0010 for the contract; persistence of comparison records remains unauthorized until approved.
- Leaves the existing Steve discovery conversation and `ingestDiscoveryArtifact` persistence path intact.
- Expands `success_interview` Context Manager domain hints to include `relationship`, because Steve captures communication/support context, not just success/training/governance.

Verification run:

- `server\node_modules\.bin\vitest.cmd run server/src/runtime/context/__tests__/steveRuntimeContextFoundation.test.ts server/src/domain/__tests__/steveConversationRuntime.test.ts server/src/runtime/context/__tests__/contextManagerService.test.ts`
- `server\node_modules\.bin\vitest.cmd run server/src/domain/__tests__/steveContextComparison.test.ts`
- `server\node_modules\.bin\tsc.cmd -p server/tsconfig.json --noEmit`

Both passed.

Note: `pnpm --filter @momentum/server test -- ...` was blocked by the local pnpm approve-builds gate before Vitest started, so Codex used the already-installed server Vitest binary directly.

## Next For Claude Code

Continue from the landed bridge, not from scratch.

Recommended next slice:

1. Review/approve ACR-0010 before treating the comparison contract as release-approved or adding persistence.
2. Use `compareSteveInterviewToContext(...)` as a non-persistent diagnostic against a real saved `tmag_steve_success_interview` artifact and the Steve Context Packet once the app persistence stack has records.
3. Add a small Steve context trace to the Steve conversation response or server logs that records:
   - flag state;
   - packet status;
   - included approved knowledge count;
   - included knowledge ids for audit only.
4. Decide whether this trace belongs in the response, the existing event stream, or a server-only observability record.
5. Add a Knowledge Base intake path for approved briefs so Steve has actual approved knowledge to retrieve.
6. Seed or ingest the first approved Steve/context source from this brief and the Knowledge Base/VoiceBox/Context brief.
7. Enable `STEVE_CONTEXT_MANAGER_LIVE_ENABLED=true` only in a local verified environment and run a Steve discovery turn to confirm the prompt gets approved context without leaking internal packet language to the BA.

## Concrete Build Path

Recommended implementation order:

1. Add a Steve Context Manager foundation beside the Michael one.
   - Likely file: `server/src/runtime/context/steveRuntimeContextFoundation.ts`
   - Pattern to study first: `server/src/runtime/context/michaelRuntimeContextFoundation.ts`

2. The Steve context foundation should request approved knowledge for domains relevant to Steve:
   - `success`
   - `training`
   - `relationship`
   - `governance`

3. Add a feature flag so the change is safe by default.
   - Suggested name: `STEVE_CONTEXT_MANAGER_LIVE_ENABLED`
   - Default: false in `.env.example`

4. Refactor `converseWithSteve` so it can optionally receive a context packet or context supplement.
   - Keep current behavior when the flag is off.
   - Do not make the route trust client-provided context.
   - The server must assemble or request context.

5. Add prompt rendering that includes only packet-approved sections.
   - Approved knowledge summaries are allowed.
   - Runtime rules and guardrails are allowed.
   - Exclusions/retrieval audit should be retained for trace/debug, not shown to the BA.
   - Candidate/review-only knowledge must remain excluded.

6. Add tests proving:
   - Steve still works with the flag off.
   - Steve can build a degraded packet with no approved knowledge.
   - Steve includes approved knowledge when the provider returns it.
   - candidate/review-only knowledge is not included.
   - Steve does not import store clients directly from runtime/orchestration.
   - completion still calls `ingestDiscoveryArtifact`.

## Knowledge Base Intake Follow-Up

Create a separate admin or script path to ingest approved briefs as Knowledge Base sources.

Initial source candidates:

- `docs/agent-briefs/knowledge-base-voicebox-context-brief.md`
- `docs/agent-briefs/steve-context-knowledge-base-next-agent-brief.md`
- `engineering/plans/S2_STEVE_SUCCESS_RUNTIME_ACTIVATION_PLAN.md`
- `runtime/CONTEXT_MANAGER.md`
- `runtime/CONTEXT_PACKET_SCHEMA.md`
- `runtime/KNOWLEDGE_CORE_RUNTIME.md`

Use existing knowledge ingestion where possible:

- `server/src/services/knowledge/approvedKnowledgeStore.ts`
- `server/src/routes/admin/knowledge.ts`
- `server/src/runtime/knowledge/intake/*`

Do not invent a second knowledge ingestion system.

## Acceptance Criteria

The next implementation is done when:

- Steve can request or receive a server-assembled Context Packet.
- Steve's runtime can include approved Knowledge Base context when enabled.
- Steve still runs exactly as before when the flag is disabled.
- The Context Packet path degrades safely when approved knowledge is unavailable.
- No prospect-facing `.com` surface changes.
- No income, placement, qualification, scoring, or ranking language is introduced.
- Steve remains BA-facing only.
- Existing Steve artifact persistence still triple-stacks.
- The next agent can explain what knowledge was used to shape a Steve turn.

## Kevin's Key Insight To Preserve

The app is moving from "agents use a database" to "Kevin creates meaning, the system stores it across Mongo/Neo4j/Chroma, Context Manager compiles the right pieces, and agents respond from that compiled context."

For Steve, that means:

Steve should not just ask discovery questions.
Steve should eventually sit inside the Team Magnificent Knowledge Base, speak from approved foundational context, and create the next layer of durable human meaning from each BA conversation.
