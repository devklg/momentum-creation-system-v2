# Knowledge Evolution Runtime — Implementation Readiness Packet

Produced by: orchestrator readiness pass for `engineering/sprints/CODEX_EXECUTION_PROMPT_KNOWLEDGE_EVOLUTION_RUNTIME.md`
Date: 2026-07-10
Repository: `D:/momentum-creation-system-v2`
Branch / HEAD at verification: `main` / `9b34f96`

## 0. Why this packet exists (not code lanes)

The master brief mandates, as Orchestrator Responsibility #1 and the Governance And Gate Rule, that the orchestrator confirm an approved ACR or decision-ledger entry authorizes implementation **before** launching lanes — and, if none exists, "stop and create an implementation-readiness packet instead of launching code lanes." Verification found **no approval record**. Therefore no worktrees were created and no agents were launched. This packet + the proposed **ACR-0012** are the required deliverables. The orchestrator does not self-approve; Kevin is final authority.

## 1. Governance verification result

| Check | Result |
| --- | --- |
| Approved ACR authorizing KER implementation | **None found** |
| KER-related ACRs in register | ACR-0001 (event model) — **Proposed**; ACR-0005 (runtime README) — **Proposed**; both v1.1, "no runtime behavior change" |
| Decision-ledger entry for KER implementation | None (`organization/DECISION_*.md` reviewed) |
| Spec status | `KNOWLEDGE_EVOLUTION_RUNTIME.md` = Ratified Runtime Specification v1.0, Implementation Target: Codex/Engineering |
| Register release band for new capability | v1.2 (v1.1 is consistency-only) |

Conclusion: the **architecture** is ratified, but **implementation is not yet authorized**. ACR-0012 (Proposed) is the gate record; hold lanes until it is Approved.

## 2. Technical readiness (verified, not assumed)

| Item | State |
| --- | --- |
| All 16 authoritative source files present | Yes (AGENTS.md, docs/READ-ME-FIRST.md, FOUNDATION_v1.0_FREEZE.md, constitution ×3, runtime ×8, PLATFORM_AUDIT.md, PLATFORM_AUDIT_PRIORITY_TASKLIST.md) |
| Existing `knowledge-evolution` module | None — greenfield under `server/src` and `packages/shared` |
| Route mounts for knowledge-evolution | None in `server/src/index.ts` |
| Tiered write / projection outbox prerequisites | Present: `server/src/services/tieredWrite.ts`, `server/src/services/projectionOutbox.ts` (+ worker test) |
| Working tree | Clean except untracked: this packet, ACR-0012, master brief, PLATFORM_AUDIT docx/tasklist, `server/scripts/vm_e2e_verify.ts` |
| Master brief tracked in git | No — currently untracked; commit alongside approval |

Residual note carried from `PLATFORM_AUDIT.md`: a pre-existing Michael runtime test cluster (~9 assertions) fails independently of this work, and normal `pnpm` commands require `--config.verify-deps-before-run=false` due to dependency build-script approval state. Both must be reported separately at Lane E, not masked.

## 3. Staged launch plan (executes only after ACR-0012 = Approved)

Dependency order (never all at once): **Lane 0 alone → merge → Lanes A/B/C parallel → merge → Lane D → merge → Lane E → merge → final verify on main.**

| Lane | Branch | Owns | Engine |
| --- | --- | --- | --- |
| 0 | `feat/knowledge-evolution-lane0-foundation` | shared contracts, enums, event names, module skeleton (append-only) | Claude Code (opus) |
| A | `feat/knowledge-evolution-laneA-persistence` | Mongo models/repositories/indexes, 9 collections | Claude Code (opus) |
| B | `feat/knowledge-evolution-laneB-core-services` | 9 services + 6 policies, business rules | Claude Code (opus) |
| C | `feat/knowledge-evolution-laneC-index-graph` | Chroma reindex + Neo4j graph sync coordination | Claude Code (opus) |
| D | `feat/knowledge-evolution-laneD-runtime-api` | routes, workers, events, metrics/health (additive mount) | Claude Code (opus) |
| E | `feat/knowledge-evolution-laneE-qa-docs` | acceptance tests, impl report, final verification | Claude Code (opus) |

Job root: `D:/mcs-v2-knowledge-evolution/<lane>`. Each worktree gets the master brief copied in as `LANE_BRIEF.md`. Each lane ends with `LANEX COMPLETE PR:<n>` or `LANEX FAILED: <reason>`.

### Launch mechanics (per orchestration skill — hard rules)

- Script files only, never inline `-Command` with `$` (gateway interpolates/leaks env). Detach with `Start-Process ... -WindowStyle Hidden`.
- Every launcher strips inherited stale env first:
  `ANTHROPIC_API_KEY, ANTHROPIC_AUTH_TOKEN, MONGODB_URI, MONGO_URI, NEO4J_URI, NEO4J_URL, CHROMA_URL, CHROMADB_URL` — else app persistence silently redirects to the legacy stack.
- Auth smoke test (`'Reply with exactly: AUTH_OK'`) through the launcher before the first real lane.
- Monitor via worktree `git status` + process count + log tail; polling, never a blocking watch. Delete a lane log before relaunch (stale-log trap).

### Merge flow per lane

`gh pr checks <n>` until gates pass → `gh pr merge <n> --merge` → confirm merge SHA on `origin/main` → rebase and launch dependents. Lane 0 merges before any parallel lane. No exceptions (shared-surface collision is the known risk).

## 4. Non-negotiable boundaries enforced across all lanes

Never: approve knowledge · create raw candidates · detect learning signals · assemble Context Packets · generate agent responses · mine private journals · bypass Knowledge Core/Ingestion/governance · self-modify · activate unapproved knowledge · activate unreviewed machine translation · use Telnyx · send external comms · touch `.com` · reintroduce Universal Gateway for runtime persistence. GraphRAG and Context Manager live flags stay OFF.

## 5. Decision required from Kevin

1. **Approve ACR-0012** (`organization/ACR-0012-implement-knowledge-evolution-runtime.md`) → flip Status to Approved, add the register row → orchestrator launches Lane 0.
2. **Amend scope first** (name changes to boundaries, engine choice, target version) → I revise ACR-0012, then you approve.
3. **Hold** → artifacts stay as the ready-to-execute record; nothing launches.

Until option 1 is chosen, all code lanes remain on hold by design.
