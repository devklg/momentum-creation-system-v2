# AI Agent Playbook

Status: current operational playbook for agent implementation work.
Created: 2026-07-11.
Authority: subordinate to `constitution/MOMENTUM_CONSTITUTION.md`, `constitution/MOMENTUM_DECISION_FRAMEWORK.md`, `constitution/MOMENTUM_ACR_SYSTEM.md`, `AGENT_ARCHITECTURE.md`, `AGENT_PROMPT_GOVERNANCE.md`, and runtime specs.

This file exists because the platform audit named `AI_AGENT_PLAYBOOK.md` as a needed onboarding and governance source. It is a routing playbook, not a new authority layer. When this file conflicts with a ratified or operational source, the higher source wins.

## Source Order

For constitutional permission and boundaries:

1. `constitution/MOMENTUM_CONSTITUTION.md`
2. `constitution/MOMENTUM_DECISION_FRAMEWORK.md`
3. `constitution/MOMENTUM_ACR_SYSTEM.md`
4. `AGENT_ARCHITECTURE.md`
5. `AGENT_PROMPT_GOVERNANCE.md`
6. Runtime specs under `runtime/`

For current implementation state:

1. `momentum.decisions`
2. `docs/locked-spec.md`
3. `docs/project-wireframe.md`
4. `PLATFORM_AUDIT_PRIORITY_TASKLIST.md` and active sprint trackers
5. `docs/build-registry.md`
6. Git history and PRs

## Universal Agent Rules

- Agents support humans. They do not replace Kevin, sponsors, leadership, compliance, or human judgment.
- No agent may score, rank, classify, qualify, pressure, or label people.
- No agent may create hidden policy, hidden authority, or a private data island.
- No agent may introduce prospect-facing AI language, income claims, cycle math, placement promises, automated prospecting, automated calling, or noncompliant medical claims.
- Agent output is a draft, recommendation, or evidence package unless an approved human-controlled automation explicitly says otherwise.
- Any change to agent mission, permissions, escalation, prompt safety level, persistence pattern, or live-delivery boundary requires ACR review under `constitution/MOMENTUM_ACR_SYSTEM.md`.

## Current Agent Roles

| Agent | Purpose | Must not do | Primary sources |
| --- | --- | --- | --- |
| Steve | New BA Discovery and non-scored Success Profile. | Score, rank, classify, predict potential, or qualify the BA. | `AGENT_ARCHITECTURE.md`, `runtime/AGENT_RUNTIME.md`, Steve runtime docs. |
| Michael | Training Agent and Daily Success Coach using Steve-derived context where available. | Interview for scoring, classify BAs, prospect, pressure, or qualify. | `AGENT_ARCHITECTURE.md`, `AGENT_PROMPT_GOVERNANCE.md`, Michael runtime code/tests. |
| Ivory | Help BAs remember who they know and draft respectful invitation/follow-up language. | Send messages, call people, score prospects, qualify leads, or pressure contacts. | `AGENT_ARCHITECTURE.md`, `AGENT_PROMPT_GOVERNANCE.md`, invitation/generator docs. |
| ScriptMaker | Draft compliant product/video invitation copy for human review and sending. | Auto-send, promise outcomes, use `.com`-forbidden claims, or bypass compliance scans. | `AGENT_PROMPT_GOVERNANCE.md`, ScriptMaker domain code. |
| Governance/operations agents | Coordinate, verify, warn, document, and surface risk. | Decide for Kevin, self-approve expansion, or silently change source-of-truth order. | Constitution and governance docs. |

## Steve Prompt And Runtime Playbook

Steve's current governed template inventory lives in the existing
`MCS_AGENT_TEMPLATE_REGISTRY` in `packages/shared/src/agent-skills.ts`. Do not
create a second Steve prompt registry. The stable template id and semantic
version identify the governed prompt contract; the behavior source identifies
the code that supplies the implementation. P2-120 does not re-approve the two
existing active records.

| Governed template | Status | Purpose | Behavior source | Degradation | Primary tests |
| --- | --- | --- | --- | --- | --- |
| `steve_success_discovery@1.0.0` | Existing active record | Conduct the authenticated BA's non-scored Success Discovery conversation. | `server/src/domain/steve-success-interview.ts#buildSteveSystemPrompt`, composed by `server/src/domain/steveConversationRuntime.ts`. | Preserve prior turns and block substantive invention; request a retry. | `steveConversationRuntime.test.ts`, `steve.test.ts` |
| `steve_success_profile@1.0.0` | Existing active deterministic record | Structurally assemble completed BA-authored answers into the descriptive Success Profile and Michael handoff summary. This is not an LLM prompt. | `server/src/domain/steve-success-interview.ts#assembleSuccessProfile`. | Do not create a profile from incomplete authoritative answers. | `steveDiscoveryPersistence.test.ts`, `steve.test.ts` |
| `steve_success_profile_extraction@1.0.0` | Planned; ACR-0022 approval required | Extract structured BA-authored answers and Success Profile inputs from the completed transcript without judging the BA. | `server/src/domain/steveConversationRuntime.ts#extractionSystem`. | Retry once, then leave extraction pending; never fabricate a profile. | `steveConversationRuntime.test.ts`, `stevePromptPlaybook.test.ts` |

The extraction system is already invoked by the current runtime, but it was
not independently represented in the template registry. The planned entry
documents that governance gap without claiming approval. It must not become
active until Kevin approves ACR-0022 and the approval record is updated.

Operational rules:

- Steve is the sole New BA Discovery interviewer. Michael does not interview.
- The interaction is BA-facing inside the authenticated `.team` browser
  runtime. Steve never appears on `.com` and Telnyx carries no Steve runtime
  conversation.
- `buildSteveSystemPrompt` is the registered base prompt implementation. Optional approved
  Context Packet material may supplement it only through the server-owned,
  flag-gated context path; unavailable context never broadens behavior.
- `[[DISCOVERY_COMPLETE]]` is an internal completion marker. The server removes
  it from BA-facing text, extracts the completed profile, persists the
  authoritative artifact, and only then opens Steve-completion-gated routes.
- Steve may reflect the BA's own goals and words. Steve may not score, rank,
  classify, qualify, predict, compare, pressure, or infer human potential.
- The Success Profile is private support context, not the BA's public/editable
  profile and not Kevin-approved Knowledge Base content.
- Current drift remains visible rather than silently changing behavior here:
  the locked spec describes a 36-question / 11-section browser interaction,
  while the current base source contains 17 questions / 7 sections and a
  stale phone-call literal. P2-120 registers and documents prompt truth; it
  does not amend the runtime prompt or onboarding contract.
- Prompt or extraction changes must update the registered version and tests.
  Mission, safety, retrieval, or completion-contract changes require the
  applicable prompt-governance and ACR approval; never edit an approved active
  version in place.

## Degradation And Fallbacks

- Degraded agent behavior must be explicit in API responses, logs, or admin diagnostics where user-facing behavior depends on it.
- A fallback must stay inside the same compliance boundary as the full agent response.
- A fallback must not pretend to have used unavailable context, GraphRAG, Context Manager, or provider output.
- GraphRAG and Context Manager live flags stay off until canary criteria are written and approved.
- VM/RVM live delivery stays disabled until a governance decision or ACR and compliance checklist are approved.

## Implementation Checklist

Before changing an agent surface:

1. Read the relevant lane brief or task brief.
2. Read the agent architecture and prompt governance files.
3. Confirm whether the change is routine delivery or an ACR-triggering platform shape change.
4. Keep writes scoped to the lane ownership.
5. Add or update tests for forbidden outputs, degradation behavior, English/Spanish parity where applicable, and route gates.
6. Record blockers in the active tracker instead of silently skipping them.

