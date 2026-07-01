# P8.2 — Guided Action Contract (DESIGN — NORMATIVE WHEN APPROVED)

- Date: 2026-07-01
- Phase: Phase 8 — Guided Action and External Integration Boundaries
- Status: PROPOSED CONTRACT — becomes normative only on Kevin's approval; implementation gated to P8.8
- Extends (does not replace): `orchestration_guided_action_draft.v1`
  (`server/src/runtime/orchestration/types.ts:206`, commit `c56c783`, #50)
- Aligned to: ACR-0007 (direct persistence), S2_OUTCOME_AND_GUIDED_ACTION_PLAN.md §4/§6/§7,
  Phase 7 P7.3 direct-seam write contract (by reference), canonical MCS V2 schema (`f976dd3`)

## 1. Definition

A **guided action** is a *suggestion*, produced by the agent runtime from consumed
Context Packet metadata, that a Brand Ambassador may accept, decline, perform, and
confirm. It is an object the BA acts **on**, never an act the system performs.

Three defining properties, all mandatory, all type-level where possible:

1. **Human-confirmed.** No guided action has any effect until a specific BA takes a
   specific per-instance action on it. There is no batch-accept, no default-accept,
   no timeout-accept, no "accept all".
2. **Suggestion, not execution.** The system never performs the suggested act — not
   before acceptance, not after acceptance, not on completion. Acceptance records
   intent; completion records the BA's attestation that *the BA* did the thing.
3. **Bounded vocabulary.** A guided action's kind must come from the closed catalog
   (P8.1 §2.1), which maps only onto the allowed categories of S2 plan §6. Forbidden
   categories are unrepresentable, not merely rejected.

## 2. Envelope — `guided_action.v2` (superset of v1)

The v2 envelope carries every v1 field unchanged, plus lifecycle fields. v1's
literal-typed invariants are retained and extended:

```
// All v1 fields retained verbatim, including:
//   actionOwner: 'brand_ambassador'
//   requiresBaApproval: true
//   automaticSending: false
//   automaticCalling: false
//   agentResponseGenerated: false

// v2 additions (design shape — names normative, syntax illustrative):
schemaVersion: 'guided_action.v2'
suggestionKind: GuidedActionSuggestionKind      // closed catalog enum (P8.1 §2.1)
reasonCodes: readonly GuidedActionReasonCode[]  // closed enum, packet-local provenance only
reason: string                                  // human-readable, template-sourced
subjectRef?: { kind: 'prospect' | 'draft' | 'profile' | 'training_topic' | 'webinar_event'; id: string }
lifecycleState: 'suggested' | 'accepted' | 'declined' | 'completed' | 'expired' | 'failed'
suggestedAt: string
expiresAt: string
acceptedAt?: string; declinedAt?: string; completedAt?: string; failedAt?: string
transitionActor?: 'brand_ambassador'            // literal — the ONLY value; system expiry sets no actor
automaticScheduling: false                      // NEW literal invariant, sibling of sending/calling
autoExecution: 'prohibited'                     // NEW literal invariant — contract marker
completionAttestation?: { attestedByBaId: BaId; attestedAt: string; note?: string }
```

Rules:

- The three `automatic*: false` fields and `autoExecution: 'prohibited'` are **literal
  types**, not booleans — code that tries to set them true does not typecheck. This
  continues the v1 enforcement style.
- `transitionActor` admits only `'brand_ambassador'`. Expiry (the sole
  system-originated transition) leaves it unset — making system-originated
  accept/complete unrepresentable.
- v1 envelopes remain producible during migration; a v2 envelope in state `suggested`
  with `persistence: 'disabled'` is semantically identical to a v1 draft.

## 3. Lifecycle state machine

```
                 ┌────────────┐
     (runtime)   │  suggested │────────(BA declines)───────► declined   [terminal]
        creates ─►            │
                 └─────┬──────┘────────(read-time lapse)───► expired    [terminal]
                       │
                 (BA accepts)
                       │
                 ┌─────▼──────┐───────(read-time lapse)────► expired    [terminal]
                 │  accepted  │───────(BA reports failure)─► failed     [terminal]
                 └─────┬──────┘
                       │
              (BA attests completion)
                       │
                 ┌─────▼──────┐
                 │ completed  │  [terminal]
                 └────────────┘
```

Transition authority table — **normative core of this contract**:

| Transition | Sole authorized actor | Mechanism |
|---|---|---|
| (create) → `suggested` | Agent runtime orchestrator | Draft envelope from accepted Context Packet consumption (S2.3 path). |
| `suggested` → `accepted` | The owning BA, per instance | Explicit UI act (P8.3). Records intent only. |
| `suggested` → `declined` | The owning BA, per instance | Explicit UI act. Optional closed-enum decline reason. |
| `suggested`/`accepted` → `expired` | System, **passively at read time only** | Lazy evaluation of `expiresAt` on render/query (pool lazy-flush pattern). Never a scheduler, cron, worker, or timer. |
| `accepted` → `completed` | The owning BA, per instance | BA attestation that the BA performed the act. Requires `completionAttestation`. |
| `accepted` → `failed` | The owning BA, per instance | BA reports the attempt failed. |

Anti-transitions (unrepresentable or contract-rejected):

- System → `accepted` / `completed`: **unrepresentable** (`transitionActor` literal).
- `declined`/`expired`/`completed`/`failed` → anything: terminal. A new need means a
  **new** suggestion (subject to dedupe, P8.1 §2.5).
- Any transition on another BA's guided action: rejected by the same ownership assert
  pattern as `domain/crm.ts` (`assertOwnership()` against the session BA). Sponsor
  immutability semantics carry over: the owning BA is fixed at suggestion time from
  the session identity, never recomputed, never accepted from a request body.

## 4. Confirmation model — what "human-confirmed" means precisely

Two distinct confirmations, never merged into one click:

1. **Acceptance** (`suggested → accepted`): "I intend to do this." Grants nothing to
   the system. Triggers nothing. May at most deep-link the BA into an existing
   internal `.team` surface (e.g. open the CRM record with a prefilled, unsaved note).
2. **Completion attestation** (`accepted → completed`): "I did this." The system
   records the BA's statement. The system has no way to verify or perform the act and
   must not pretend to — completion is attestation, not observation.

Where a suggestion's act is itself an in-app operation (save a note, set a follow-up
reminder), the act executes **only** through the existing BA-owned route with its
existing auth and ownership checks — the guided action merely prefills. The guided
action framework itself has zero execution capability; there is no
"executeGuidedAction()" anywhere in this design, and none may be added under it.

## 5. Boundary

- **Internal reach:** deep-links and prefills into existing `.team` surfaces only.
- **External reach: none.** No email/SMS/voice send, no PSTN/Telnyx/RVM, no external
  CRM/calendar/messaging API, no `.com` behavior. External-facing suggestions are
  copy-only (P8.6, P8.7): the system hands the BA compliance-checked text; the BA
  uses their own channel, off-app.
- **Compliance:** all suggestion copy passes the existing compliance constants
  (`packages/shared/src/compliance.ts`, `rules.ts`) at template-definition time and
  fails closed at render time. No income claims, placement promises, head counts,
  THREE branding, or prospect-facing AI language.
- **No intelligence creep:** no scoring, ranking, qualification, or prioritization of
  prospects in suggestion creation or ordering (P8.1 §3). Reason codes are
  packet-local facts, not judgments.

## 6. Persistence (design requirements only — nothing persists this run)

When P8.8 is approved and Phase 7 is closed:

- Guided-action lifecycle records persist **exclusively** through Phase 7's P7.3
  direct-seam write contract to the dedicated triple-stack (ACR-0007: direct
  adapters; the Universal Gateway is dev tooling and must not appear in this path).
- The record uses the canonical MCS V2 schema conventions
  (`P10_MCS_V2_SCHEMA_DESIGN.md`): required-core + typed fields, no ad hoc timestamp
  aliases; memory/lineage writes follow the graphrag base envelope where applicable.
- Writes are **append-only transitions**: one immutable transition record per state
  change (actor, state, timestamp, attestation), with the current state derivable.
  This makes "who confirmed what, when" auditable — the point of a human-confirmed
  system.
- Until that gate opens, `persistence: 'disabled'` remains literally true and the DB
  write freeze (no MCS V2 store writes until schemas approved) is respected.

## 7. Events

Adopts the S2 plan §7 event names as the envelope-fact vocabulary
(`guided_action.suggested|accepted|declined|completed|expired|failed`), emitted as
non-persistent runtime event envelopes exactly as S2.2 established. Event
persistence/outbox/replay/subscribers/APIs remain unactivated and are not designed
here.

## 8. Conformance checklist (for the future P8.8 verification report)

- [ ] Every catalog kind maps to an allowed S2 §6 category; forbidden categories unrepresentable.
- [ ] `automaticSending/Calling/Scheduling: false` and `autoExecution: 'prohibited'` are literal types.
- [ ] No code path transitions to `accepted` or `completed` without a per-instance BA request context.
- [ ] Expiry has no scheduler/cron/worker/timer — read-time only.
- [ ] No guided-action code imports any external transport (resend, telnyx, fetch to third parties).
- [ ] All persistence goes through the P7.3 seam; zero `gatewayCall` in the guided-action path.
- [ ] Ownership assert on every transition; sponsor/owner never taken from request body.
- [ ] `.com` bundle contains zero guided-action code or copy.
- [ ] State-transition test matrix covers every cell of the authority table, including all anti-transitions.
