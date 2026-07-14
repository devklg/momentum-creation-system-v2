# Orientation Record Diagnostic

P2-116 adds `orientation_diagnostic.v1`, a Kevin-only, read-only report over
the current group-session scheduler. It reads only:

- `tmag_new_member_orientation_sessions`
- `tmag_new_member_orientation_reservations`

The diagnostic is available at `GET /api/admin/orientation/diagnostic` and on
the existing admin `/orientation` page. Access uses the existing admin gate;
the read is audited with aggregate scan and finding counts only.

## Findings

| Category | Meaning |
| --- | --- |
| `stuck` | An otherwise-valid active reservation remains after its scheduled instant. Its state is `attendance_unverified`; elapsed time proves neither attendance nor completion. |
| `duplicate` | Explicit repeated stable ids or multiple active reservation records violate the current reservation invariant. Concurrent sessions at the same time are not treated as duplicates. |
| `inconsistent` | Required identity/lifecycle evidence is malformed, a reservation contradicts its session, or active seats exceed the recorded session capacity. |

Every finding carries `repairPolicy: report_only`. The response also fixes
`attendanceAuthority` and `completionAuthority` to `null`,
`completionInferred` and `autoRepair` to `false`. Participant-state projection
continues to use the separate `orientation_state.v1` contract.

## Boundaries

- The projector never writes, repairs, cancels, completes, or reclassifies a
  scheduler record. The Kevin-only endpoint still emits the existing aggregate
  admin access audit described above.
- A past session is not automatically treated as a lifecycle defect; the
  current scheduler has no automatic session-status transition authority.
- An elapsed active reservation is not a no-show or attendance conclusion.
- Attendance capture, completion authority, repair actions, grace thresholds,
  and automatic session transitions require separate Kevin approval.
