# Momentum Creation System V2 — Phase 7 Worktree Prompt

You are working in a dedicated phase worktree.

Do not browse GitHub.

Use REPO_STATE_PACKET.md as source of truth.

First run:

```bash
git status --short
git branch --show-current
git rev-parse HEAD
cat REPO_STATE_PACKET.md
```

If HEAD does not match Base SHA, STOP with LOCAL_REPO_STATE_MISMATCH.

If the worktree is dirty before you begin, STOP with DIRTY_WORKTREE_BEFORE_START.

## Phase
Phase 7 — Outcomes, Persistence, Learning, and GraphRAG

## Assigned Agent / Tool
Codex CLI (Codex CLI Instance 2)

## Source of Truth
REPO_STATE_PACKET.md (Base SHA d39ab149ef41baf23f370bead4b54a83d3e1433a)

## Dependency Gate
Requires Phase 6 closeout. No persistence implementation until P7.1-P7.3 approved. No direct agent writes.

## Phase Backlog
- P7.1 Runtime Persistence Governance Proposal
- P7.2 Runtime Audit Schema
- P7.3 Triple-Stack Write Contract
- P7.4 Runtime Audit Persistence
- P7.5 Outcome Capture Contract
- P7.6 Outcome Capture UI
- P7.7 Learning Candidate Pipeline
- P7.8 Knowledge Approval Workflow
- P7.9 GraphRAG Learning Schema
- P7.10 GraphRAG Write Implementation
- P7.11 Learning Observability and Audit
- P7.12 Phase 7 Closeout

## Allowed Files
- engineering/reports/P7_*
- engineering/reports/SPRINT_007_*
- persistence governance
- outcome/learning/GraphRAG architecture

## Forbidden Files / Actions
- Persistence implementation until P7.1-P7.3 approved
- Direct agent writes to any store
- Anything outside the allowed list

Standing prohibitions (always in force):
- No `.com` exposure.
- No `/api/runtime/*` route family.
- No unapproved persistence.
- No LLM calls.
- No dynamic generation.
- No voice/Telnyx/PSTN/call-control.
- No automatic sending/calling/scheduling/prospecting/scoring/ranking/qualification.
- No income/compensation/cycle/placement guarantees.
- No agent may approve knowledge.
- Context Manager remains sole Context Packet assembler.

## Internal Multi-Agent Workflow
- Agent A — Readiness: verify deps, repo state, and dependency gate; produce a readiness note.
- Agent B — Architecture: define contracts, schemas, and plans for in-scope slices.
- Agent C — Implementation / Documentation: implement approved slices, or produce planning docs if gated.
- Agent D — Tests / Governance: add or adjust tests; verify every standing prohibition still holds.
- Agent E — Final Verification: run gates, reconcile, and write the final report.

## Required Gates
```bash
pnpm build:shared
pnpm typecheck
pnpm build
pnpm --filter @momentum/team typecheck
pnpm --filter @momentum/server test
```

Documentation-only with no code changed: at minimum run `pnpm typecheck`.
If gates cannot be run, the final report must say so honestly.

## Stop Conditions
- LOCAL_REPO_STATE_MISMATCH (HEAD != Base SHA).
- DIRTY_WORKTREE_BEFORE_START (uncommitted changes before you begin).
- Upstream phase closeout missing — produce readiness/planning only.
- Any standing prohibition would be violated — STOP.
- Any git command fails — STOP and report the exact command and error.

## Final Report
engineering/reports/SPRINT_007_PHASE_7_OUTCOMES_PERSISTENCE_LEARNING_GRAPHRAG_VERIFICATION.md
