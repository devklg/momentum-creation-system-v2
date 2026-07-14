# P2-128 Admin Bottleneck Report

Status: approved and complete. Automated verification passed, and Kevin approved
the contained desktop/mobile component previews on 2026-07-13. The trusted
in-app route browser remained unavailable and is not represented as having
passed.

## Scope and authority

The existing `/reports` surface now composes five current read authorities into
one bounded aggregate snapshot:

- invitations: current invitation-token lifecycle states;
- CRM: bounded, report-only CRM integrity findings;
- training: aggregate Fast Start curriculum state and progress data quality;
- events: Event Center capacity, attendance, reminders, and human CRM follow-up;
- delivery: provider delivery, projection queue, warnings, and worker state.

The composition performs no new persistence and exposes no person rows. It does
not score, rank, qualify, predict, or infer effectiveness. Invitation and normal
training lifecycle movement use `observed`; `attention` is reserved for explicit
integrity, capacity, missed-attendance follow-up, delivery, worker, queue, or
data-quality conditions already present in source authority.

Every section carries an explicit coverage boundary and is marked partial or
unavailable rather than exhaustive. Each source is isolated with
`Promise.allSettled`. If one authority fails, its
section is marked unavailable while the remaining sections stay current. Event
reminder configuration is reported as an unconfigured governance dependency;
P2-128 does not imply that the P2-109 email/SMS decisions have been approved.

## Surface

- `GET /api/admin/reporting/bottlenecks` is admin-gated and audits aggregate
  section status/source availability only.
- `/reports` displays the five aggregate cards before the existing export panel.
- `Reports` is now reachable from the admin navigation.

## Verification

- Pure projection tests cover the full current invitation lifecycle, missed
  attendance correlated to its own active reminder, bounded/partial labeling,
  unavailable-authority isolation, and removal of person-level source rows.
- Route coverage confirms `requireAdmin` and aggregate-only audit payloads.
- Component coverage confirms all five sections, governance notes, partial-source
  rendering, loading, and contained failure behavior.
- Focused verification passed: eight server tests and three admin component
  tests.
- Full server suite passed serially: 2,110 passed, 19 skipped. An initial
  parallel run completed all assertions but lost one worker and exited nonzero;
  it was not accepted as a gate.
- Full admin suite passed: 35 tests.
- Repo typecheck and production build passed.

## Visual approval

The required in-app browser refused the session because its automation client
was not trusted, so no trusted live-route pass is claimed. A contained component
preview was instead rendered at desktop and mobile widths and shown to Kevin.
Kevin explicitly approved P2-128 on 2026-07-13, accepting that bounded evidence
as the release gate for this task.

The unperformed live-route matrix remains useful follow-up evidence after the
browser client is trusted: 1440×1000, 768×1024, 390×844, 360×800, and 200% zoom,
covering populated, partial, unavailable, loading, and error states. It is not a
condition of the recorded P2-128 approval.
