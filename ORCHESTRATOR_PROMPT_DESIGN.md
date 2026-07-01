# Momentum Creation System V2 — Phase 7 Worktree Prompt (DESIGN / CONTRACTS ONLY)

You are working in a dedicated phase worktree for Phase 7 — Outcomes, Persistence, Learning, and GraphRAG.

**SCOPE FOR THIS RUN: DESIGN AND CONTRACTS ONLY. NO IMPLEMENTATION.**
Phase 6 (multi-agent runtime) is running CONCURRENTLY and owns the persistence seam and
`server/src/runtime/orchestration/*` as implementation. To avoid collision, this Phase 7 run
produces ONLY design docs / proposals / contracts under `engineering/reports/P7_*`. It must NOT
edit `server/src/**` runtime code, the persistence adapters, or the seam. Implementation is a
later, separately-approved run once Phase 6 lands.

Do not browse GitHub. Use REPO_STATE_PACKET.md for standing rules; reconcile against ACTUAL state.

First run:
```bash
git status --short
git branch --show-current
git rev-parse HEAD
cat REPO_STATE_PACKET.md
```
If HEAD does not match Base SHA, STOP with LOCAL_REPO_STATE_MISMATCH.
If TRACKED files are dirty before you begin, STOP with DIRTY_WORKTREE_BEFORE_START.
(Note: untracked P7_1/P7_2/P7_3 draft reports already exist in this worktree — that is expected,
not a dirty tree. Build ON them.)

## Phase
Phase 7 — Outcomes, Persistence, Learning, and GraphRAG (DESIGN SLICE)

## Assigned Agent / Tool
Claude Code (Claude Code Instance 5)

## Source of Truth
REPO_STATE_PACKET.md (Base SHA cce9a951e3ca1b04307f68245201c389375b0a7a = current main)

## Dependency Gate
Gate for design work: OPEN. Phases 4 and 5 are closed on main. Design/contract work is authorized.
Gate for IMPLEMENTATION: CLOSED for this run (see SCOPE above) — runtime persistence changes wait
for Phase 6 to land and a separate approval.

## Existing material you MUST build on (do not start from scratch)
1. Local drafts already in this worktree (untracked): 
   - engineering/reports/P7_1_RUNTIME_PERSISTENCE_GOVERNANCE_PROPOSAL.md
   - engineering/reports/P7_2_RUNTIME_AUDIT_SCHEMA.md
   - engineering/reports/P7_3_TRIPLE_STACK_WRITE_CONTRACT.md  <-- contains the KNOWN DEFECT below
2. On main: the canonical MCS V2 schema design across Mongo/Neo4j/Chroma, commit f976dd3
   "docs(phase-10): MCS V2 schema design (Mongo/Neo4j/Chroma) — the B4/write-freeze linchpin".
   P7 persistence governance MUST align to this canonical schema, not invent a parallel one.
3. Governance already ratified (read, align to, do not contradict):
   - organization/ACR-0007 (Runtime persistence is DIRECT; Universal Gateway is dev tooling, NOT a runtime dependency)
   - organization/DECISION_governed_dedicated_stack_founding_principle.md (governed-from-birth: Mongoose+$jsonSchema, one-concept-one-name, governed door only)
   - organization/FINDING_chroma_boot_naming_drift.md (audit_log vs mcs_audit_log duplicate + unprefixed names)
   - SCHEMA_GOVERNANCE.md, MULTI_DB_AGENT_LEARNING_GOVERNANCE.md (Page 5 canonical collections/labels)

## THE PRIMARY TASK — fix the P7.3 Path B defect (design)
P7_3_TRIPLE_STACK_WRITE_CONTRACT.md currently defines TWO write paths:
  - Path A: tripleStackWrite (correct — goes through the app-direct persistence seam).
  - Path B: `quadstack.write` with enforce_schema, for memory/lineage — routes through the
    Universal Gateway's QuadStackConnector using the docs/graphrag-schema-contract.md schema,
    which is scoped "Universal Gateway memory" (chat_number/chat_registry/namespace universal_gateway).
Path B makes the app's agent memory layer DEPEND ON THE GATEWAY — this VIOLATES ACR-0007.
Your job (design only): REVISE the P7.3 contract so Path B is COLLAPSED onto the app-direct seam:
  - Memory/lineage/outcome writes go through the SAME persist()/tripleStackWrite direct path,
    into the app's OWN dedicated stores (Mongo momentum @30000, Neo4j @7710, Chroma mcs_* @8200),
    Mongoose + $jsonSchema enforced, read-back verified per leg.
  - NO quadstack.write anywhere in app runtime. The gateway is dev tooling only.
  - Align every collection/label/field name to the canonical schema (commit f976dd3) and fix the
    naming drift noted in FINDING_chroma_boot_naming_drift.md (one canonical audit collection,
    all mcs_* prefixed).
Produce the revised contract as the authoritative P7.3. Mark the old Path B explicitly DEPRECATED
with rationale (ACR-0007).

## Phase Backlog (DESIGN slices only this run)
- P7.1 Runtime Persistence Governance Proposal — finalize; align to canonical schema (f976dd3) + ACR-0007.
- P7.2 Runtime Audit Schema — finalize; single canonical audit collection, mcs_* prefixed, $jsonSchema-shaped.
- P7.3 Triple-Stack Write Contract — REVISE to kill Path B (primary task above).
- P7.4 Outcome Capture Contract — design (how agent outcomes persist through the direct seam).
- P7.5 Learning Candidate Pipeline Contract — design (candidate→review→approved→indexed, per KNOWLEDGE_EVOLUTION_RUNTIME; no agent may approve knowledge).
- P7.6 GraphRAG Architecture — design (Neo4j graph + Chroma vector retrieval over the app's OWN stores, direct).
- (Implementation slices P7.7+ are OUT OF SCOPE this run.)

## Allowed Files (DESIGN RUN)
- engineering/reports/P7_*
- engineering/reports/SPRINT_007_*
- docs/*graphrag*schema* (design docs only)
EXPLICITLY FORBIDDEN this run: server/src/**, any adapter/seam code, .env, any flag, apps/**.

## Forbidden Files / Actions
- ANY runtime code change (server/src/**) — this is a design run; STOP if tempted.
- Reintroducing or preserving quadstack.write as an app runtime path.
- Editing `.env`, flipping flags, touching apps/com or apps/team.
- Anything outside the allowed list.

Standing prohibitions (always in force):
- No `.com` exposure. No `/api/runtime/*` new routes. No unapproved persistence.
- No LLM calls. No dynamic generation. No voice/Telnyx/PSTN/call-control.
- No automatic sending/calling/scheduling/prospecting/scoring/ranking/qualification.
- No income/compensation/cycle/placement guarantees.
- No agent may approve knowledge. Context Manager remains sole Context Packet assembler.

## Internal Multi-Agent Workflow
- Agent A — Readiness: verify base, gate, and that the 3 P7 drafts + schema commit f976dd3 are present.
- Agent B — Architecture: revise P7.3 (kill Path B), finalize P7.1/P7.2, draft P7.4-P7.6 contracts.
- Agent C — Documentation: write the contracts as authoritative design docs; deprecate Path B with rationale.
- Agent D — Governance: verify every contract aligns to ACR-0007 + canonical schema + governed-from-birth; no gateway in any app path.
- Agent E — Final Verification: reconcile, run `pnpm typecheck` (docs-only run), write final report.

## Required Gates (design/docs run)
Docs-only, no code changed: run at minimum `pnpm typecheck` to prove the tree still builds.
If gates cannot be run, the final report must say so honestly.

## Stop Conditions
- LOCAL_REPO_STATE_MISMATCH (HEAD != cce9a95).
- DIRTY_WORKTREE_BEFORE_START (tracked changes before you begin).
- About to edit server/src/** or any runtime code — STOP (design run only).
- About to keep quadstack.write in an app path — STOP (violates ACR-0007).
- Any standing prohibition would be violated — STOP.
- Any git command fails — STOP and report the exact command and error.

## Final Report
engineering/reports/SPRINT_007_PHASE_7_OUTCOMES_PERSISTENCE_LEARNING_GRAPHRAG_DESIGN_VERIFICATION.md
