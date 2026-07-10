# Codex Execution Prompt — Complete Three-Way Call Calendaring (delivery + reminders)

You are working inside the Momentum Creation System V2 repository (`D:/momentum-creation-system-v2`).

Architecture Version: 1.0 (FROZEN)
Governance: ACR-0007 APPROVED (direct triple-stack persistence)
Branch base: `main`
Date: 2026-07-07

---

## Why this task exists (verified 2026-07-07, not assumed)

"Calendaring for three-way calls" is the workflow where a BA books a scheduled three-way call with someone in their upline. This was one of the functional gaps Kevin named at his turning point.

**The calendar itself is already BUILT and real** — do NOT rebuild it. Verified in code:
- `server/src/domain/threeWayCalls.ts` (651 lines, "Three-way call scheduling v1, BRIEF 5, 2026-07-04"): availability windows (owner-local weekly), bookings, 30-minute slots (`SLOT_MINUTES = 30`), real timezone handling (`Intl.DateTimeFormat`, zoned parts, offset math), UPLINE-CHAIN routing rule (a member can book any member in their immutable sponsor/upline chain who has recurring availability), triple-stack collections (`tmag_sponsor_availability`, `tmag_three_way_bookings` in Mongo; `mcs_sponsor_availability`, `mcs_three_way_bookings` in Chroma).
- `server/src/routes/three-way.ts`: `GET/PUT /availability`, `GET/POST /bookings`, `POST /bookings/:id/cancel` — all `requireAuth` + `requireSteveComplete`.
- `apps/team/src/components/cockpit/ThreeWayCallWorkspace.tsx` (604 lines): the booking UI (the 2 "stub" grep hits are just an input `placeholder` attribute — not stubs).

**The actual gap (verified):** bookings persist with `notificationChannel: 'in_app'` but there is **NO delivery wired** — no email, SMS, calendar invite, or reminder is sent when a call is booked or before it starts. A member books an upline's slot, it saves correctly, but **neither party is notified or reminded**, so the scheduled call can be silently missed. That is the completion gap: a calendar that books but never tells anyone.

**Channels + patterns already in the codebase to reuse (do not build new infra):**
- Email: `server/src/services/resend.ts` (NOTE: `RESEND_API_KEY` is currently ABSENT in `.env` — email path must be dormant-safe, exactly like the other Resend surfaces: throw `ResendConfigError`, caller catches, degrade — never crash a booking).
- SMS: `server/src/services/telnyx.ts` (`TELNYX_API_KEY` IS set).
- Scheduled-worker pattern to mirror for reminders: `server/src/workers/vmDeliveryWorker.ts` / `vmWebhookWorker.ts`.

---

## Persistence law (ACR-0007 — do not deviate)

- Every write (booking notifications, reminder records, delivery status) lands in **Mongo + Neo4j + Chroma** in one logical op, **read-back verified**; flag any failing leg loudly — never silently skip a leg.
- Universal Gateway (`localhost:2526`) is developer tooling only — never a production persistence path.
- No Redis.

---

## Task — complete the calendaring loop

1. **On booking create** (`POST /bookings` path in `threeWayCalls.ts`): after the booking persists, send a confirmation to BOTH parties (booking member + booked upline) — the requester and the owner. Include date/time rendered in EACH recipient's own timezone (the availability model is already timezone-aware), the other party's name, and the booking topic/context. Channel selection: SMS via `telnyx.ts` (keyed) and/or email via `resend.ts` (dormant-safe). Record actual delivery outcome on the booking (extend beyond the current `notificationChannel: 'in_app'`), triple-stack, read-back.

2. **Calendar invite (.ics):** attach/generate a standard `.ics` VEVENT for the booked slot so it drops into the recipient's real calendar (start/end from the 30-min slot, both parties as attendees, timezone-correct). If email is dormant, still make the `.ics` retrievable via the booking record/UI so it's not lost.

3. **Reminders:** add a reminder before the call (e.g. a lead-time window — confirm the exact lead time with Kirk via `[REMINDER LEAD — confirm with Kevin]`; do not invent a policy). Implement as a scheduled reminder record + a worker mirroring `vmDeliveryWorker.ts` that fires due reminders to both parties. Reminder records are triple-stack, read-back verified.

4. **On cancel** (`POST /bookings/:id/cancel`): notify both parties of the cancellation and cancel/void any pending reminder for that booking. Same delivery + persistence discipline.

5. **Dormant-safe everywhere:** a missing channel key (Resend absent today) must NEVER break booking, cancel, or the calendar — degrade to the available channel(s) + in-app, log, surface, never throw up the stack. Mirror the existing Resend/Telnyx dormant patterns.

6. **Tests** (Vitest, match existing server style): booking sends to both parties in correct per-recipient timezone; `.ics` is valid and timezone-correct; reminder record is created and the worker fires it; cancel notifies + voids the reminder; email-dormant degrades gracefully without breaking the booking; each notification/reminder write reads back across all three legs.

---

## Hard constraints

- Do NOT rebuild the calendar/availability/booking core — it works. Additive delivery + reminders only.
- Do NOT modify ratified docs (`constitution/**`, `runtime/**`, `organization/**`, `docs/locked-spec.md`).
- Do NOT change `.com` surfaces or the agent code.
- Do NOT reintroduce the Universal Gateway as a runtime persistence path.
- Preserve the UPLINE-CHAIN routing rule and `requireAuth` + `requireSteveComplete` gates exactly.
- No new scheduled-job infra if the existing worker pattern can carry reminders — mirror `vmDeliveryWorker.ts`.
- Additive only for `@momentum/shared`; don't break exports. (NOTE: coordinate with the concurrent Michael/Ivory/VM briefs which also touch `packages/shared` — land shared additions cleanly or sequence.)
- No time estimates in the brief output unless Kirk asks.

---

## Close (required verification)

- `pnpm --filter @momentum/shared typecheck && pnpm --filter @momentum/server typecheck && pnpm --filter @momentum/team typecheck` — expected green.
- `pnpm --filter @momentum/server test` — all green, including new notification/ics/reminder tests.
- Demonstrate end-to-end against a running server: BA books an upline slot → both parties receive confirmation in their own timezone (SMS live; email dormant-safe) → `.ics` is valid → a reminder record is created and the worker fires it → cancel notifies both and voids the reminder → every notification/reminder write reads back across all three legs.
- `git status` review confirming only intended `server/src/**`, `packages/shared/src/**`, `apps/team/src/**`, and test files changed.
- Kirk reviews and merges under ACR-0007 gates.
