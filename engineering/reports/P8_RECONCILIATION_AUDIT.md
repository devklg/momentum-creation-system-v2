# P8 Reconciliation Audit — Guided Action and External Integration Boundaries

- Date: 2026-07-01
- Phase: Phase 8 — Guided Action and External Integration Boundaries (DESIGN SLICE)
- Worktree branch: `feature/phase-08-guided-action-integrations`
- Base SHA verified: `cce9a951e3ca1b04307f68245201c389375b0a7a` (== current `main`)
- Run type: DESIGN / CONTRACTS ONLY — no runtime code, no `apps/**`, no adapters, no seams
- Agent: Claude Code (Claude Code Instance 6)

## 1. Purpose

Mandatory pre-design reconciliation. Maps every Phase 8 backlog slice to
`DONE-ON-MAIN | PARTIAL | NOT-STARTED` against the actual repository state at the
base SHA, so that this design run **extends** what exists instead of inventing
parallel artifacts.

## 2. Verified repository preconditions

| Check | Result |
|---|---|
| `git rev-parse HEAD` | `cce9a951e3ca1b04307f68245201c389375b0a7a` — matches Base SHA. |
| Tracked-file dirtiness | None. Only the four untracked orchestration files (`START_HERE.md`, `ORCHESTRATOR_PROMPT.md`, `ORCHESTRATOR_PROMPT_DESIGN.md`, `REPO_STATE_PACKET.md`) — expected, per the prompt. |
| Existing `engineering/reports/P8_*` | None. This is the first P8 design set. |

## 3. The existing S2.3 guided-action envelope (#50) — the artifact P8 must extend

Commit `c56c783` ("Implement S2.3 outcome guided action envelope wiring (#50)") landed
a complete, inert, draft-only guided-action envelope:

| Artifact | Location | What it establishes |
|---|---|---|
| `draftOutcomeGuidedActionEnvelopes()` | `server/src/runtime/orchestration/outcomeGuidedAction.ts` | Converts accepted Context Packet consumption metadata into returned-only draft envelopes. No behavior, no persistence, no routes. |
| `OrchestrationGuidedActionDraftEnvelope` | `server/src/runtime/orchestration/types.ts:206–228` | `schemaVersion: 'orchestration_guided_action_draft.v1'`; literal-typed invariants `actionOwner: 'brand_ambassador'`, `requiresBaApproval: true`, `automaticSending: false`, `automaticCalling: false`, `persistence: 'disabled'`, `draftStatus: 'draft_only'`, `agentResponseGenerated: false`. |
| `OrchestrationOutcomeDraftEnvelope` | `server/src/runtime/orchestration/types.ts` | Sibling outcome draft envelope, same inertness markers. |
| `OutcomeGuidedActionDraftResult` | `server/src/runtime/orchestration/types.ts:237–246` | Turn-level result: `envelopePersistence: 'disabled'`, `behavior: 'not_implemented'`. |
| Degraded-context behavior | `outcomeGuidedAction.ts:48–57` | Degraded packets produce `contentScope: 'limited'` fallback drafts (`record_private_note` category); rejected/blocked packets produce **no** drafts. |
| Tests | `server/src/runtime/orchestration/__tests__/outcomeGuidedAction.test.ts` (192 lines) | Locks the above. |
| Verification | `engineering/reports/SPRINT_002_S2_3_OUTCOME_GUIDED_ACTION_ENVELOPE_WIRING_VERIFICATION.md` | PASS on all gates; confirms no auto-send/auto-call/persistence. |

Additional pre-existing guided-action surface area on main:

- `packages/shared/src/runtime/ids.ts` — `GuidedActionId` branded id type.
- `packages/shared/src/runtime/outcomes.ts` — `RuntimeOutcomeReference.guidedActionId?`, `RuntimeOutcomeStatus` (`created | observed | ba_accepted | ba_completed | ba_dismissed | failed | not_applicable`).
- `server/src/runtime/orchestration/types.ts:39` — session status `'guided_action_pending'` already reserved.
- `engineering/plans/S2_OUTCOME_AND_GUIDED_ACTION_PLAN.md` — planning-only lifecycle states (`suggested/accepted/declined/completed/expired/failed`), allowed and forbidden guided-action categories (§4, §6), event-name plan (§7: `guided_action.suggested` … `outcome.capture_failed`).
- S2.4+ composition (`composition.ts`, `turnCoordinator.ts`) returns `guidedActionDrafts` with `guidedActionPersistence: 'disabled'` in the combined turn result.

**Conclusion:** the guided-action *envelope and inert wiring* exist. What does NOT exist:
a lifecycle contract (state machine + who may transition), a confirmation model, a UI
proposal, a persistence design, or any integration boundary docs. That is exactly the
P8 design surface.

## 4. Slice-by-slice reconciliation

| Slice | Status on main | Evidence / what exists | This run produces |
|---|---|---|---|
| P8.1 Guided Action Expansion Proposal | **PARTIAL (foundation only)** | S2.3 emits exactly one generic draft per accepted turn, category via `preferredCategory()` fallback; no catalog, no multi-suggestion, no reason codes, no dedupe/expiry. | `P8_01_GUIDED_ACTION_EXPANSION_PROPOSAL.md` — extends `orchestration_guided_action_draft.v1`; does not replace it. |
| P8.2 Guided Action Contract | **PARTIAL (foundation only)** | Envelope shape + boolean invariants exist (types.ts); lifecycle states exist only as a plan (S2 plan §4). No authoritative contract doc. | `P8_02_GUIDED_ACTION_CONTRACT.md` — the contract, superset-compatible with v1. |
| P8.3 Guided Action UI | **NOT-STARTED** | Only S2 plan §9 "UI Handoff Expectations" (display list). No `.team` UI exists or is designed. | `P8_03_GUIDED_ACTION_UI_PROPOSAL.md` — wireframe/contract only. |
| P8.4 Workflow Automation Boundary Review | **PARTIAL (scattered)** | Prohibitions live in REPO_STATE_PACKET standing prohibitions, S2 plan §3/§4/§6, `packages/shared/src/rules.ts`, S2.14/S2.21 exclusion reviews. No single consolidated boundary doc. | `P8_04_WORKFLOW_AUTOMATION_BOUNDARY_REVIEW.md` — consolidation + tier taxonomy. |
| P8.5 CRM Integration Proposal | **PARTIAL (internal CRM done; boundary doc not started)** | Internal BA CRM is DONE-ON-MAIN: `server/src/domain/crm.ts` (crm_notes / crm_followups / crm_dispositions, sponsor-immutability asserts), `prospectCrm.ts`, routes `crm.ts` / `crmHub.ts`, `todaysActions.ts`, `followUpAging.ts`. No *external* CRM integration exists (correct). | `P8_05_CRM_INTEGRATION_PROPOSAL.md` — boundary: internal CRM is the integration target; external CRM sync is out. |
| P8.6 Email/Message Integration Proposal | **PARTIAL (transport done-dormant; boundary doc not started)** | `server/src/services/resend.ts` — dormant-by-design transactional transport (`ResendConfigError` → callers record `emailDeliveryStatus='skipped'`); `broadcastQueue.ts`; ScriptMaker manual-compose fallback. No agent-triggered send path exists (correct). | `P8_06_EMAIL_MESSAGE_INTEGRATION_PROPOSAL.md` — copy-only boundary; no auto-send design. |
| P8.7 Calendar Integration Proposal | **PARTIAL (internal events done; boundary doc not started)** | Rolling-8-week webinar-event seeder (`pnpm seed:webinar-events`, Mon/Thu 5pm Pacific); `webinar_reserved` token state in the pool lifecycle; no external calendar API anywhere (correct). | `P8_07_CALENDAR_INTEGRATION_PROPOSAL.md` — boundary; no auto-scheduling. |
| P8.8 Integration Implementation | **NOT-STARTED — GATED OUT OF THIS RUN** | Gate CLOSED: requires Phase 7 closeout + explicit Kevin approval. | Nothing. Referenced as future work only. |

## 5. Governance inputs — availability at base SHA

| Governance artifact | Status at `cce9a95` | Handling in this design set |
|---|---|---|
| `organization/ACR-0007-runtime-persistence-direct-not-gateway.md` | **Present on main.** Approved by Kevin 2026-06-27. Runtime persistence is DIRECT (Mongo + Neo4j + Chroma adapters); Universal Gateway V2 is developer tooling only, never a runtime dependency. | All P8 persistence references are to the direct seam. No gateway persistence appears in any P8 design. |
| Canonical MCS V2 schema design | **Present on main** — commit `f976dd3`, `engineering/reports/P10_MCS_V2_SCHEMA_DESIGN.md` (proposed-only; write-freeze in force). Contains **no** guided-action collections. | P8 persistence design defines *requirements* for a future guided-action record under the canonical schema + P7.3 seam; it does not add collections itself (write-freeze respected). |
| `organization/DECISION_governed_dedicated_stack_founding_principle.md` | **NOT on main at this SHA.** The orchestrator prompt names it, but it does not exist in this worktree; it is being produced in the concurrent Phase 7 (persistence design) worktree. | Aligned to by *principle* (governed-from-birth, dedicated stack, no ungoverned writes) via ACR-0007 and the write-freeze. Flagged here so the Phase 7 merge can confirm no conflict. |
| Phase 7 P7.3 direct-seam write contract | **NOT on main** — being finalized concurrently in the phase-07 worktree. | Referenced **by name only** as the sole authorized persistence path for any future guided-action/integration record. P8 defines no persistence path of its own. |

## 6. Collision-avoidance confirmation (concurrent Phases 6 and 7)

This run touches **only** `engineering/reports/P8_*` and `engineering/reports/SPRINT_008_*`.
It does not touch:

- `server/src/**` (Phase 6 runtime surface) — the S2.3 envelope was **read, not modified**;
- `apps/**`;
- any adapter, persistence seam, `.env`, or flag;
- any Phase 6 (`P6_*`) or Phase 7 (`P7_*`) report.

## 7. Standing-prohibition posture for the design set

Every P8 document produced in this run is written under, and restates where relevant:
no `.com` exposure; no `/api/runtime/*`; no unapproved persistence; no LLM calls; no
dynamic generation; no voice/Telnyx/PSTN/call-control; no automatic
sending/calling/scheduling/prospecting/scoring/ranking/qualification; no
income/compensation/cycle/placement guarantees; no agent approves knowledge; Context
Manager remains the sole Context Packet assembler. **Guided actions are human-confirmed
suggestions — never auto-executed — at the contract level, not merely as an
implementation convention.**

## 8. Verdict

Reconciliation complete. Design may proceed: every P8 slice extends an identified
existing artifact (or fills a documented gap) and no slice requires touching a
forbidden surface.
