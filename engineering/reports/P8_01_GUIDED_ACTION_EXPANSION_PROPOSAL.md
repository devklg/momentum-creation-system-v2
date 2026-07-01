# P8.1 — Guided Action Expansion Proposal (DESIGN ONLY)

- Date: 2026-07-01
- Phase: Phase 8 — Guided Action and External Integration Boundaries
- Status: PROPOSAL — no implementation authorized by this document
- Reconciles with: S2.3 outcome guided-action envelope wiring (#50, commit `c56c783`)
- Companion contract: `engineering/reports/P8_02_GUIDED_ACTION_CONTRACT.md`
- Implementation gate: P8.8 — CLOSED (requires Phase 7 closeout + explicit Kevin approval)

## 1. What exists today (the v1 baseline being extended)

S2.3 produces, per accepted orchestration turn, **exactly one** guided-action draft
envelope (`orchestration_guided_action_draft.v1`,
`server/src/runtime/orchestration/types.ts:206`), with:

- a single category chosen by `preferredCategory()` fallback (`review_required` or,
  degraded, `record_private_note`);
- generic title/instruction strings fixed in code (`outcomeGuidedAction.ts:96–103`);
- literal-typed inertness invariants: `draftStatus: 'draft_only'`,
  `actionOwner: 'brand_ambassador'`, `requiresBaApproval: true`,
  `automaticSending: false`, `automaticCalling: false`, `persistence: 'disabled'`,
  `agentResponseGenerated: false`;
- in-memory return only — no lifecycle, no storage, no UI.

This proposal **extends** that envelope. It does not replace it, rename it, or modify
any v1 field. v1 remains valid; the expansion is a superset (see P8.2 §4 for the
compatibility rule).

## 2. What the expansion adds (five capabilities)

### 2.1 A typed suggestion catalog (bounded, closed set)

Replace the single generic "review this draft" suggestion with a **closed catalog** of
suggestion kinds, each mapped 1:1 onto an allowed category from
`S2_OUTCOME_AND_GUIDED_ACTION_PLAN.md` §6. Catalog v1 (closed — additions require a
new contract version, not ad hoc strings):

| Suggestion kind | Category (S2 plan §6) | What the BA is invited to do |
|---|---|---|
| `review_success_profile` | review profile | Open the Success Profile draft and confirm/edit it. |
| `continue_training_topic` | continue training | Resume the identified training topic with Michael. |
| `open_team_workflow` | open an internal `.team` workflow | Deep-link to an existing `.team` route (CRM record, cockpit card, invitations). Internal navigation only. |
| `edit_draft` | edit a draft | Open an editable (Ivory) draft for revision. |
| `copy_draft_manually` | copy a draft manually | Copy compliance-checked text to clipboard for use in the BA's own channel. |
| `record_private_note` | record private note | Prefill a CRM private note the BA may save. |
| `set_followup_reminder` | open an internal `.team` workflow | Prefill a `crm_followups` reminder the BA may save. |
| `suggest_webinar_invite` | copy a draft manually | Surface the next seeded webinar event + copy-only invite text. |
| `request_context_refresh` | request context refresh | Re-request a Context Packet (Context Manager remains sole assembler). |
| `ask_followup_question` | ask follow-up question | Continue the session with a suggested question. |
| `pause_session` / `resume_later` | pause session / resume later | Session flow control. |

Forbidden categories (S2 plan §6) remain forbidden **at the type level**: no catalog
entry may map to sending, calling, ringless voicemail, scoring, qualification,
automated prospecting, bulk outreach, enrollment submission, or THREE
genealogy/placement. The catalog is the enforcement point: if a kind is not in the
catalog, it cannot be suggested.

### 2.2 Multiple suggestions per turn, bounded

A turn may yield **0–3** guided-action drafts (v1 yields exactly 0 or 1). Bound of 3 is
a UX/compliance choice: suggestions are review-required objects, and an unbounded list
becomes a task queue the BA rubber-stamps — which erodes the human-confirmation
premise. Degraded-context turns remain capped at **1** safe-fallback suggestion
(`record_private_note`), preserving S2.3's degraded behavior.

### 2.3 Reason codes (packet-local provenance)

Each draft carries `reasonCodes: string[]` and a human-readable `reason` derived
**only from the consumed Context Packet** (packet-local context, per S2 plan §9 —
"reason from packet-local context"). No reason may be derived from direct store access
(agents consume packets only), from scoring, or from any prospect-ranking signal.
Reason codes are drawn from a closed enum defined with the catalog (e.g.
`profile_draft_unconfirmed`, `training_topic_incomplete`, `followup_reminder_elapsed`).

### 2.4 Lifecycle (the P8.2 contract)

The expansion adopts the six lifecycle states already planned in S2 plan §4 —
`suggested → accepted | declined`, `accepted → completed | expired | failed` — with
transition authority, confirmation semantics, and expiry rules defined normatively in
`P8_02_GUIDED_ACTION_CONTRACT.md`. Key property restated here: **every transition out
of `suggested` and into `completed` is a BA act. The system may only expire.**

### 2.5 Dedupe and expiry

- **Dedupe:** a draft is suppressed if an open (`suggested` or `accepted`) guided
  action with the same `(baId, suggestionKind, subjectRef)` already exists. Dedupe is
  a read-time comparison, not a background job.
- **Expiry:** every suggestion carries `expiresAt`. Expiry is evaluated **lazily at
  read time** (the same pattern as pool lazy-flush in `server/src/routes/p.ts`) —
  never by a scheduler, cron, or worker. A lapsed suggestion renders as `expired` and
  becomes non-actionable. This is deliberate: a timer that acts on guided actions is
  the first step toward automation, and is prohibited.

## 3. What the expansion explicitly does NOT add

- No execution of any suggestion by the system, ever — including after BA acceptance.
  Acceptance records intent; the BA performs the act through existing BA-owned
  routes/UI or entirely off-app (see P8.2 §5).
- No external side effects: no send, no call, no schedule, no PSTN/Telnyx/RVM, no
  external API of any kind.
- No prospect scoring, ranking, qualification, or prioritization embedded in
  suggestion ordering. Drafts are ordered by catalog order, then creation time —
  never by any prospect-derived "value" signal.
- No LLM calls and no dynamic generation. All copy in suggestions is
  template/catalog-sourced (ScriptMaker-style static templates); the existing
  wired-dormant Anthropic surface is not touched by this proposal.
- No `.com` exposure — guided actions are BA-facing (`.team`) only, per compliance
  rule 3 (no AI prospecting language on prospect surfaces).
- No new persistence path. If/when guided-action state persists, it persists through
  Phase 7's P7.3 direct seam under the canonical MCS V2 schema (ACR-0007;
  `P10_MCS_V2_SCHEMA_DESIGN.md` conventions). Until P8.8 is approved,
  `persistence: 'disabled'` remains literally true.
- No new routes. `/api/runtime/*` stays unmounted.

## 4. Sequencing and gates

1. **This run:** P8.1 (this proposal) + P8.2 (contract) + P8.3 (UI proposal) +
   P8.4–P8.7 (boundaries). Docs only.
2. **Phase 7 closeout:** P7.3 direct-seam write contract finalized and merged —
   prerequisite for any guided-action persistence design becoming implementable.
3. **P8.8 (separately approved run):** implement catalog + lifecycle per P8.2, typed
   against the v1 envelope as a superset; tests per S2 plan §10; gates
   `pnpm typecheck`, `pnpm build`, `pnpm --filter @momentum/server test`.

Nothing in this document authorizes step 3.
