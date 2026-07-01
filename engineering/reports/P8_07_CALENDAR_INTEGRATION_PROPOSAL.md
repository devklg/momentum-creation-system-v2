# P8.7 — Calendar Integration Proposal (BOUNDARY / PROPOSAL ONLY)

- Date: 2026-07-01
- Phase: Phase 8 — Guided Action and External Integration Boundaries
- Status: PROPOSAL — no implementation. **No auto-scheduling is designed here; none
  may be designed later under this document.**
- Governing boundary: `P8_04_WORKFLOW_AUTOMATION_BOUNDARY_REVIEW.md` (Tier 3 item 3)

## 1. The calendar that exists

The internal webinar-event system on main: the idempotent rolling-8-week seeder
(`pnpm seed:webinar-events`, Mon/Thu 5pm Pacific), the `webinar_reserved` state in
the prospect token lifecycle, and prospect-side webinar reservation on the `.com`
dashboard spine. That is the only calendar in MCS V2, and this proposal keeps it so.

## 2. Boundary: display and suggest — never book, never sync

**The system may:**

- Display seeded webinar events (read-only) on `.team` surfaces and inside guided-
  action cards (`suggest_webinar_invite`: "the next webinar is Thu 5pm Pacific" +
  copy-only invite text per P8.6).
- Continue the existing prospect-initiated webinar reservation flow (a prospect
  clicking reserve on their own dashboard is that human's own act — unchanged, not a
  Phase 8 surface).
- Let a BA set themselves a follow-up reminder (a `crm_followups` row, Tier 2) that
  the BA sees in-app when they next look. The reminder never leaves the app.

**The system may never:**

- Create, modify, or cancel events in any external calendar (Google Calendar,
  Outlook/MS365, Calendly, etc.) — for BAs or prospects, with or without OAuth
  consent. No connector, no token storage, no dormant wiring. (Gateway MCP calendar
  tools are dev tooling under ACR-0007 and never a runtime path.)
- Auto-schedule anything: no auto-booking prospects into webinars, no auto-created
  "callback" appointments from `callback_requested`, no slot-picking on anyone's
  behalf. `callback_requested` surfaces to the BA as information; acting on it is
  the BA's off-app act.
- Send calendar invitations (.ics email invites are sends — P8.6 Tier 3) or external
  reminders (SMS/email "your webinar is in 1 hour" to prospects is automatic
  sending).
- Read external calendars for availability ("Michael sees you're free Tuesday") —
  inbound sync creating context outside the Context Manager is prohibited.

## 3. Considered and deferred: BA-clicked `.ics` file download

A per-instance, BA-initiated download of a static `.ics` file for a webinar event
(BA adds it to their own calendar themselves) has no external side effect and is
arguably Tier 2. It is **deferred, not proposed**: it is calendar-shaped enough that
it should ride the P8.8 approval explicitly rather than slip in as a footnote. Until
then, the copy-only card includes the date/time as text the BA can enter themselves.

## 4. Guided-action integration points

| Kind | Behavior |
|---|---|
| `suggest_webinar_invite` | Copy-only card: next seeded event's date/time in the draft text; BA sends via their own channel; completion is BA attestation. |
| `set_followup_reminder` | Prefilled in-app reminder around an event date (e.g. day-after follow-up); BA saves via existing CRM route; in-app visibility only. |

Suggestion reasons stay packet-local (e.g. `prospect_reached_video_complete` from the
session's packet) — never derived from scanning the pool or ranking prospects by
"webinar readiness".

## 5. Persistence

Webinar events already persist via their existing seeder path — untouched. Future
guided-action references to events (`subjectRef: { kind: 'webinar_event' }`) persist
only through the P7.3 direct seam under the canonical schema (ACR-0007). No new
collections, no schema edits, this run (write-freeze respected).
