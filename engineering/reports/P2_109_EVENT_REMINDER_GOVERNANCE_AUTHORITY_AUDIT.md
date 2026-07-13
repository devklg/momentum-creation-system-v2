# P2-109 Event Reminder Governance Authority Audit

**Status:** Non-canonical evidence report; Kevin approval recorded 2026-07-13
**Conclusion:** Fail-closed boundary approved; live implementation remains blocked
**Implementation performed:** None
**Production or communication effect:** None

## Audit question

Does current authority permit Codex to implement email and SMS reminders for
Event Center workflows without a new Kevin decision?

**No.** Current sources establish several hard boundaries and expose missing
prerequisites, but they do not authorize reminder cadence, copy, consent
language, or live delivery. P2-109 affects people and external communications,
so the unresolved decisions belong to Kevin.

## Sources inspected

| Source | Evidence relevant to P2-109 |
| --- | --- |
| `constitution/MOMENTUM_CONSTITUTION.md` | Human dignity, non-manipulation, compliance, and Kevin's final authority govern external communication. |
| `constitution/MOMENTUM_DECISION_FRAMEWORK.md` | Anything affecting people, compliance, money, or external communications escalates to Kevin; missing evidence cannot be invented. |
| `constitution/MOMENTUM_ACR_SYSTEM.md` | A compliance boundary or external integration requires an ACR; High-risk changes require Kevin approval and cannot skip states. |
| `PLATFORM_AUDIT_PRIORITY_TASKLIST.md` P2-109 | Names governance as the delivery but supplies no cadence, copy, or consent decision. |
| `organization/ACR-0015-event-center-model-fields.md` | Reminder fields must report `not_configured` until P2-109 establishes governance. |
| `organization/ACR-0016-event-attendance-crm-follow-up.md` | Event-attendance follow-up remains human-owned and does not send SMS, email, calls, or messages. |
| `organization/ACR-0018-unified-follow-up-queue.md` | The unified follow-up queue is read-only and manual-contact-only. |
| `docs/event-center-product-boundary.md` | Event Center is a read/coordination projection and remains `not_configured` for reminders. |
| `packages/shared/src/event-center.ts` | Current truth is `status:'not_configured'` and `channels:[]`; no consent, cadence, copy, or delivery contract exists. |
| `docs/locked-spec.md` Part 5 | Resend is the resolved email provider; live email remains dormant pending API configuration and sending-domain verification. |
| `docs/locked-spec.md` §3.17 | A webinar reservation is logistics and is not prospect SMS consent. |
| Kevin's `member sms channel` memory handle | SMS is members-only. Consent capture/backfill, STOP/HELP handling, permanent exclusion, and an operational 10DLC campaign are prerequisites and are not all built. |
| Existing orientation/webinar domains | Orientation confirmation SMS and webinar BA alert SMS already exist without the complete future gate. |

## Authority findings

### 1. Prospect SMS is not eligible

Kevin's members-only SMS rule excludes prospects. The locked spec separately
states that webinar reservation is not an SMS consent signal. A prospect webinar
reminder SMS therefore has no eligible authority path and must be prohibited.

### 2. Member orientation SMS lacks required operational evidence

The members-only rule requires first-party permission and permanent STOP
handling. The current repository has a broadcast opt-out collection and
server-side audience filtering, but the code itself describes inbound STOP
webhook wiring as future work. The memory authority also identifies member
consent capture/backfill and an operational 10DLC campaign as missing. A phone
number alone cannot establish reminder eligibility.

### 3. Reminder email authority is incomplete

Resend is already the locked email provider, with live email dormant until its
API configuration and sending-domain verification are complete. Provider
selection does not supply reminder authority: no approved source defines
event-reminder cadence, count, copy, opt-out wording, or member event-reminder
preference. For prospect webinars, no current decision says the reservation
email authorizes later reminder email. These omissions cannot be filled by
agent judgment.

### 4. CRM follow-up cannot become an external-message trigger

ACR-0016 and ACR-0018 deliberately keep attendance follow-up in the human CRM
and the unified queue. Turning that evidence into email or SMS would change the
approved human-owned boundary and is prohibited by this proposal.

### 5. Event Center must continue showing the honest inert state

ACR-0015 and the product boundary explicitly hold reminders at
`not_configured`. Neither an agent-authored proposal nor partially available
infrastructure makes a channel configured. `channels:[]` remains the only
honest value before approval and verified prerequisites.

## Existing drift recorded, not repaired here

- `server/src/domain/orientationSession.ts` attempts a best-effort confirmation
  SMS to the reserving BA when a phone exists.
- `server/src/domain/webinarReservation.ts` attempts a best-effort reservation
  alert SMS to the sponsoring BA.

These are existing confirmation/alert paths rather than new reminder delivery.
They do not apply the complete proposed consent, preference, STOP, and 10DLC
gate. The audit records them for Kevin's decision and deliberately makes no
runtime change in this pre-approval slice.

## Proposed safe boundary

`organization/ACR-0019-event-reminder-governance.md` is an agent-authored,
High-risk Proposed ACR. It proposes:

- members-only SMS and an unconditional prospect webinar SMS prohibition;
- fail-closed member orientation SMS prerequisites;
- Kevin approval of email cadence/copy and webinar-email authority before
  reminder email;
- human-only, in-app CRM attendance follow-up; and
- continued Event Center `not_configured` / `channels:[]` truth.

Kevin approved the fail-closed boundary on 2026-07-13. The approval does not
authorize live delivery or fill the implementation details that remain
undefined.

## Work deliberately not performed

- No runtime or canonical Event Center boundary edits.
- No schema or shared-contract changes.
- No evaluator, provider adapter, scheduler, worker, cron, queue, or tests.
- No email, SMS, call, provider invocation, or production mutation.
- No invented consent, cadence, copy, or opt-out language.
- No generated catalog updates.
- P2-109 remains unchecked.

## Approval and remaining implementation gate

Kevin approved the proposed fail-closed boundary in the Codex task on
2026-07-13 with the exact instruction, "show me i approve." This clears the ACR
approval gate for the boundary only.

P2-109 implementation remains blocked until Kevin supplies the exact reminder
cadence/count, approved copy/opt-out wording, webinar-email reminder consent
rule, member SMS consent/backfill wording, and disposition of the current
ungated BA confirmation paths. No live communication is authorized meanwhile.
