# Current Orientation State Machine

P2-115 establishes `orientation_state.v1` as the current, machine-readable
participant state contract for new-member orientation.

## Current authority

The operative product is the live group-session scheduler decided in Chat 147:
a BA reserves their own seat, may cancel it, and attends a founder/leader-hosted
live orientation. Mongo collection
`tmag_new_member_orientation_reservations` is the current participant-state
authority.

The larger Stage 0–10 flow in `ORIENTATION_ARCHITECTURE.md` is a future target.
Its stage records, attendance capture, completion record, next-step selection,
and launch-transition writes are not implemented and are not treated as current
runtime truth.

## Participant states

| State | Explicit meaning |
| --- | --- |
| `not_scheduled` | No reservation evidence exists. |
| `scheduled` | Exactly one active reservation exists for a future session. |
| `cancelled` | No active seat exists and the latest reservation was explicitly cancelled. |
| `attendance_unverified` | An active reservation's scheduled instant elapsed; attendance is not inferred. |
| `inconsistent` | Duplicate active reservations or malformed state/timestamp evidence exists. |

Supported transitions are reserve, cancel, and the time-based projection from
scheduled to attendance-unverified. There is deliberately no transition to
`completed`: neither reservation nor elapsed time proves attendance, and the
current app has no attendance or completion authority.

`GET /api/orientation/state` exposes the authenticated BA's read-only projection.
It never accepts a BA id from the request and remains behind the existing auth
and Steve-complete gates. P2-116 can consume the same fail-closed contract for
admin diagnostics without inventing completion.
