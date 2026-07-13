# ACR-0019 — Event Email and SMS Reminder Governance

**Status:** PROPOSED — awaiting Kevin L. Gardner; not approved
**Authorship:** Agent-authored proposal; this document is not Kevin-approved knowledge
**Risk:** High — external communications, consent, opt-out, and compliance boundaries
**Change type:** Integration / compliance boundary / surface contract
**Audit authority:** `PLATFORM_AUDIT_PRIORITY_TASKLIST.md` P2-109
**Affected boundary:** Event Center, New Member Orientation, Prospect Webinar, CRM follow-up
**Target version:** Unscheduled until approval

## Why an ACR is required

P2-109 names email and SMS reminder governance but does not decide who may be
contacted, what constitutes permission, how many reminders may be sent, what the
messages say, or whether a webinar reservation email authorizes later reminder
email. Those choices affect people and external communications. Under the
Constitution, Decision Framework, and ACR System, an agent may propose them but
Kevin must decide them.

This proposal therefore creates no implementation authority. The audit task,
its ACR, and this branch cannot be treated as approval.

## Proposed channel rules

The following rules are proposed exactly as a fail-closed boundary:

1. **SMS is members-only.** Prospect webinar SMS reminders are always
   prohibited.
2. **New-member orientation SMS** requires all of the following before it may
   be considered eligible:
   - first-party member consent evidence;
   - a valid destination;
   - an enabled event-reminder preference;
   - no permanent opt-out, with STOP taking precedence over every other signal;
   - a verified inbound STOP/HELP handler; and
   - an approved, operational 10DLC campaign.
3. **Prospect webinar reminder email** remains blocked until Kevin approves the
   cadence and copy and confirms that the email supplied with a webinar
   reservation authorizes subsequent reminder email.
4. **New-member orientation reminder email** requires a verified member email,
   an enabled event-reminder preference, and Kevin-approved cadence and copy.
5. **CRM attendance follow-up remains in-app and human-owned.** External email
   and SMS from that follow-up are prohibited.
6. **Event Center remains honest and inert.** Reminder status stays
   `not_configured` and `channels` stays `[]` until Kevin approves this boundary
   and every required prerequisite exists and is verified.

These proposed rules do not define consent wording, backfill wording, cadence,
message count, send times, reminder copy, or opt-out copy. Those are reserved
for Kevin's decision. Resend is already the locked email provider; its live
path remains dormant until the required configuration and sending-domain
verification are complete.

## Existing behavior held outside this proposal slice

The repository already attempts a best-effort orientation confirmation SMS to
the reserving member and a webinar-reservation alert SMS to the sponsoring BA.
Those paths predate this proposal and do not apply the complete proposed
consent/preference/STOP/10DLC gate. They are recorded as existing drift for
Kevin's ruling; this proposal branch does not alter, endorse, or expand them.

The existing webinar reservation confirmation email is also left unchanged.
This proposal concerns subsequent event reminders and does not silently
reclassify existing confirmation behavior.

## Approval and implementation gates

If Kevin approves or amends the channel rules, implementation still must:

- remain fail-closed when any required evidence is absent or unavailable;
- preserve prospect SMS prohibition and STOP precedence as approved;
- prove no reminder can bypass the source-domain governance boundary;
- keep Event Center factual until the approved implementation and all
  prerequisites are verified;
- pass focused tests, static provider/send boundaries, repository typecheck,
  build, relevant suites, and any applicable production-safety gate; and
- receive separate authority before any live send, scheduler activation,
  provider call, production mutation, or release.

Approval of this ACR would not itself approve live communications.

## This proposal slice expressly excludes

- email or SMS sends;
- provider imports or provider calls;
- schedulers, cron jobs, workers, or queues;
- runtime, schema, or canonical Event Center boundary edits;
- consent, cadence, copy, or opt-out language invented by an agent;
- changes to existing confirmation or BA-alert delivery paths; and
- checking P2-109 complete.

## Compatibility and rollback

This proposal changes documentation only and has no runtime, schema,
persistence, provider, or production effect. Before approval, rollback is simply
removing the proposed record and register row. After a future approved
implementation, rollback requirements must be defined by that implementation
slice before it begins.

## Evidence

- `packages/shared/src/event-center.ts` currently limits reminder state to
  `not_configured | configured` and channels to `email | sms | in_app`.
- `docs/event-center-product-boundary.md` requires reminder status to remain
  `not_configured` until P2-109.
- `docs/locked-spec.md` Part 5 resolves the email provider to Resend and keeps
  live email dormant pending API configuration and sending-domain verification.
- `docs/locked-spec.md` §3.17 explicitly says webinar reservation is not SMS
  consent.
- Kevin's `member sms channel` memory handle says SMS is members-only and lists
  the still-missing consent, backfill, STOP/HELP, exclusion, and 10DLC gates.
- `server/src/domain/orientationSession.ts` and
  `server/src/domain/webinarReservation.ts` contain the existing BA SMS paths
  described above.

## Single Kevin decision request

**Kevin: approve or amend these channel rules and specify (1) reminder
cadence/count, (2) approved copy/opt-out wording, (3) whether webinar
reservation email authorizes reminder email, (4) member SMS consent/backfill
wording, and (5) whether current ungated BA SMS confirmations fail closed
immediately.**

Until Kevin answers, ACR-0019 remains Proposed, P2-109 remains unchecked, Event
Center remains `not_configured` with `channels:[]`, and no implementation is
authorized.
