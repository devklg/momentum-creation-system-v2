# P8.5 — CRM Integration Proposal (BOUNDARY / PROPOSAL ONLY)

- Date: 2026-07-01
- Phase: Phase 8 — Guided Action and External Integration Boundaries
- Status: PROPOSAL — no implementation, no wiring, no schema changes
- Governing boundary: `P8_04_WORKFLOW_AUTOMATION_BOUNDARY_REVIEW.md`

## 1. Position: the internal CRM is the CRM

MCS V2 already has its CRM, live on main: the BA pipeline write-side in
`server/src/domain/crm.ts` (`crm_notes` append-only, `crm_followups`,
`crm_dispositions`), `prospectCrm.ts`, routes `crm.ts`/`crmHub.ts`, the cockpit
read-side, `todaysActions.ts`, and `followUpAging.ts` — all sponsor-immutable and
BA-scoped (`assertOwnership()` on every mutation).

**Proposal: "CRM integration" for Phase 8 means guided actions integrating with THIS
internal CRM. No external CRM (HubSpot, Salesforce, GoHighLevel, Zoho, etc.) is
integrated, synced, imported from, or exported to.** The prospect relationship data of
Kevin's downline stays in the dedicated, governed triple-stack.

## 2. Guided-action ↔ internal CRM touchpoints (the whole integration)

| Guided action kind | CRM touchpoint | Tier (P8.4) |
|---|---|---|
| `record_private_note` | Deep-link to prospect record with note composer prefilled, **unsaved**. BA clicks Save through the existing route. | 1 → 2 |
| `set_followup_reminder` | Prefilled follow-up (date + reason), unsaved; BA saves via existing route. | 1 → 2 |
| `open_team_workflow` (prospect subject) | Navigate to the CRM record / cockpit card. Read-only effect. | 1 |
| Re-invite suggestion (via `copy_draft_manually` + deep-link) | Surfaces the existing re-invite script + spine. BA decides; no cooldown logic added, none removed. | 1 → 2 |

Rules:

- Guided actions never write CRM rows themselves. They prefill; the existing BA-owned
  route is the only writer, with its existing auth/ownership/compliance behavior.
- No guided action may change a **disposition** even as a prefill-with-one-click-save
  shortcut from the card itself; disposition changes happen on the CRM surface where
  the BA sees full context. (Prevents "confirm-fatigue" laundering of Tier 2 acts
  into the suggestion panel.)
- No suggestion is generated *from* CRM-wide scans that rank prospects ("these 5
  prospects are going cold — act now" as an ordered queue is prohibited
  prioritization). Reasons remain packet-local to the session's Context Packet. The
  existing `todaysActions.ts` / `followUpAging.ts` cards are BA-pulled reports and
  remain outside the guided-action framework.

## 3. External CRM — explicit non-goals and the one permitted future shape

Non-goals (Tier 3 or governance-blocked):

- No inbound sync (external CRM → MCS): foreign data entering Context Packets would
  bypass Context Manager governance and knowledge approval.
- No outbound sync (MCS → external CRM): prospect PII of the downline leaving the
  governed stack is a data-boundary breach; also creates a second source of truth.
- No webhook listeners, no polling connectors, no Zapier/Make bridges.

The one shape that could ever be considered (NOT proposed now, requires its own ACR):
a **Kevin-initiated, admin-surface, manual export** of the BA's own data (CSV
download), synchronous, click-per-export, audited. Recorded here only so a future
request has a named, gated slot instead of growing informally.

## 4. Persistence

Any future guided-action↔CRM linkage rows (e.g. `subjectRef` back-references) persist
only via Phase 7's P7.3 direct seam under the canonical schema (ACR-0007). The
existing CRM collections are not restructured by Phase 8; write-freeze respected this
run.
