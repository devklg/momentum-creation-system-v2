# P8.4 — Workflow Automation Boundary Review (DESIGN — CONSOLIDATED BOUNDARY)

- Date: 2026-07-01
- Phase: Phase 8 — Guided Action and External Integration Boundaries
- Status: BOUNDARY REVIEW — consolidates prohibitions already in force; adds a
  normative tier taxonomy for all future workflow features
- Sources consolidated: REPO_STATE_PACKET standing prohibitions;
  `S2_OUTCOME_AND_GUIDED_ACTION_PLAN.md` §3/§4/§6; `packages/shared/src/rules.ts`;
  `packages/shared/src/compliance.ts`; S2.14 / S2.21 route-persistence-LLM-voice
  exclusion reviews; locked-spec Part 2 (THREE authority)

## 1. The question this document answers

For every workflow-shaped feature, present or future: **what may the system propose,
what may it do only on a per-instance human click, and what may it never do at all —
even with confirmation, even "just as a design"?**

## 2. The three-tier boundary

### Tier 1 — MAY PROPOSE (suggestion only; zero effect until BA acts)

The system may *surface* these as guided actions (P8.2 catalog) or passive UI cards:

- Review/edit/confirm a profile, draft, or training step.
- Copy compliance-checked text for the BA to send **themselves, off-app**.
- Open an internal `.team` workflow (deep-link, prefill-unsaved).
- Record a private note; set a follow-up reminder (prefilled, unsaved).
- Suggest attending/inviting-to a seeded webinar event (copy-only).
- Request a context refresh; ask a follow-up question; pause/resume a session.

Constraints: bounded count (≤3/turn), packet-local reasons, no prioritization by
prospect "value", template-sourced copy only, compliance-checked, expiry passive.

### Tier 2 — MAY EXECUTE ONLY AS A NORMAL BA-OWNED APP OPERATION, PER-INSTANCE

These have in-app effect, but **only** through an existing BA-authed route the BA
invokes with a specific click, carrying the standard ownership asserts. The guided
action may prefill; the BA's click through the normal surface is the act:

- Save a CRM note; set/clear a follow-up; update a disposition (`domain/crm.ts`).
- Re-invite (existing spine — BA-decided, no cooldown, per `dec_cockpit_sponsor_and_reinvite`).
- Mark a guided action accepted/declined/completed/failed (the lifecycle itself).

Constraints: one click = one instance; idempotent transitions; no batch endpoints
("apply to all matching prospects" is Tier 3); no chaining where one confirmation
triggers a second effect the BA didn't individually see and click.

### Tier 3 — NEVER (prohibited at the design level; confirmation does not unlock)

These may not be built, designed-for, stubbed, feature-flagged, or left as a
dormant-but-wired path. A BA (or even Kevin-as-BA) clicking "yes" does not authorize
them; removing them from this tier requires an approved ACR, not a run brief:

1. **Automatic sending** of any message (email, SMS, DM, broadcast) on behalf of a BA
   or the system toward a prospect. Includes "send later", "send if no response",
   drip/sequence/cadence automation, and bulk outreach.
2. **Automatic calling / voice**: PSTN, Telnyx call-control, ringless voicemail,
   voice AI toward prospects — any wiring at all.
3. **Automatic scheduling**: creating/moving calendar events for BA or prospect,
   auto-booking, auto-reminders sent externally.
4. **Automated prospecting**, prospect **scoring, ranking, qualification**, or
   prioritization — including disguised forms (sort orders, "suggested next
   prospect", heat indicators).
5. **Enrollment submission or any THREE mutation** — genealogy, placement,
   registration. THREE is upstream authority; this system mirrors, never writes.
6. **`.com` behavior triggered by agent/workflow logic** — prospect-facing surfaces
   never carry guided actions, AI language, or workflow side effects.
7. **Income/compensation/cycle/placement guarantees** in any generated or templated
   copy.
8. **Agent approval of knowledge**; any Context Packet assembly outside the Context
   Manager.
9. **Unapproved persistence** — any write path other than the P7.3 direct seam under
   the canonical schema (ACR-0007); any runtime write through the Universal Gateway.
10. **Runtime LLM calls / dynamic generation** under the current standing
    prohibition (the wired-dormant Anthropic surface remains dormant; its activation
    is a separate, already-governed concern — not a workflow feature).

## 3. Litmus tests (apply to any future feature request)

- **The timer test:** does anything happen because time passed, without a human click
  at that moment? If yes → Tier 3. (Passive read-time expiry is the only sanctioned
  time effect: it *removes* actionability, never adds an act.)
- **The sleep test:** can any prospect-visible effect occur while the BA is asleep?
  If yes → Tier 3.
- **The batch test:** does one click affect more than one instance? If yes → Tier 3.
- **The vocabulary test:** does the feature need words from the forbidden category
  list (send, call, schedule, score, qualify, enroll) to describe what the *system*
  does? If yes → Tier 3. The system's verbs are: suggest, prefill, deep-link, record,
  display.
- **The representability test (strongest):** prefer designs where the violation
  cannot typecheck (literal `false`/`'prohibited'` fields, closed enums) over designs
  where it is merely rejected at runtime.

## 4. Boundary between "wired-dormant" and "prohibited"

The repo legitimately contains dormant transports (Resend, Telnyx verify middleware,
Anthropic) that activate by env key for **already-approved, non-workflow** purposes
(transactional email, webhook verification). This review does not touch them. The
line: a dormant transport for an approved system function is acceptable; a dormant
*automation path* (code that would auto-send/auto-schedule on behalf of workflow
logic the moment a flag flips) is Tier 3 and may not exist even dormant. No guided
-action or integration code may import these transports (P8.2 §8 conformance).

## 5. Standing verification hooks

Future P8.8+ verification reports must re-run, at minimum, the S2.14/S2.21-style
static exclusions over guided-action/integration code: no transport imports, no
`gatewayCall`, no `/api/runtime/*` mounts, no `.com` diff, no scheduler/cron/worker
registration, plus the P8.2 §8 checklist.
