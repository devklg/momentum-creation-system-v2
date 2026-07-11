# LANE 3 - P0 Agent, VM/RVM, and GraphRAG Governance

Final signal: `LANE3 COMPLETE PR:<number>` or `LANE3 FAILED: <reason>`

## Owned P0 Items

- 11. Link the agent playbook to `AGENT_ARCHITECTURE.md`, `AGENT_PROMPT_GOVERNANCE.md`, and runtime agent docs.
- 12. Create the explicit VM/RVM governance decision or ACR before expanding live delivery.
- 13. Add a VM/RVM compliance checklist covering automation, qualification, PMV, copy, and provider controls.
- 14. Confirm VM live delivery remains disabled until the governance and compliance checklist is approved.
- 15. Keep GraphRAG and Context Manager live flags off until canary criteria are written and approved.

## Dependency

Start after Lane 0 has merged. Rebase onto `origin/main` before editing.

## Required Reads

- `constitution/MOMENTUM_CONSTITUTION.md`
- `constitution/MOMENTUM_DECISION_FRAMEWORK.md`
- `constitution/MOMENTUM_ACR_SYSTEM.md`
- `AGENT_ARCHITECTURE.md`
- `AGENT_PROMPT_GOVERNANCE.md`
- `docs/VM_LEAD_CAMPAIGN_MODULE_ARCHITECTURE.md`
- `docs/VM_LEAD_CAMPAIGN_IMPLEMENTATION_PLAN.md`
- `.env.example`
- `server/src/env.ts`

## Guardrails

- Agents may draft ACRs and decisions; Kevin approves high/critical changes.
- Do not enable VM/RVM live delivery.
- Do not enable GraphRAG or Context Manager live flags.
- VM/RVM must not qualify leads, automate prospecting, promise income, use placement claims, or send noncompliant copy.
- Any live-delivery path must remain gated by explicit admin approval and provider controls.

## Expected Artifacts

- VM/RVM governance ACR or decision draft under the existing constitution/ACR or docs structure.
- VM/RVM compliance checklist.
- Agent playbook links added to the appropriate architecture/prompt/runtime docs, or an explicit replacement reference if Lane 0 reconciled a different playbook source.
- A clear statement that GraphRAG and Context Manager live flags remain off pending canary criteria.

## Verification

Run docs/link checks if available. Run typecheck only if code changed.
