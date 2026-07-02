# START HERE

Phase 7 — Outcomes, Persistence, Learning, and GraphRAG (DESIGN / CONTRACTS ONLY)
Assigned tool: Claude Code (Claude Code Instance 5)

1. Open this folder in Claude Code.
2. Read REPO_STATE_PACKET.md (Base SHA cce9a95 = current main).
3. Read ORCHESTRATOR_PROMPT_DESIGN.md  <-- USE THIS ONE.
   (The old ORCHESTRATOR_PROMPT.md is the stale template — ignore it. Ignore TASK.md decoy too.)
4. Paste ORCHESTRATOR_PROMPT_DESIGN.md into the agent.
5. THIS IS A DESIGN RUN. No runtime code (server/src/**). Phase 6 runs concurrently and owns
   the persistence seam — do NOT touch it. Produce only P7_* design docs/contracts.
6. PRIMARY TASK: revise P7.3 to kill the external-tooling `quadstack.write` Path B (ACR-0007 violation);
   collapse memory/lineage writes onto the app-direct seam into the dedicated stores.
7. Build ON the existing untracked P7_1/P7_2/P7_3 drafts already in this worktree.
8. Do not browse GitHub. Do not work outside this phase.
9. Verify HEAD == cce9a951e3ca1b04307f68245201c389375b0a7a before starting; if not, STOP.
