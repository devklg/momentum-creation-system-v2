# P2-126 PMV Dashboard Visual QA

## Status

`BLOCKED` — no visual pass is claimed.

## Scope

- Branch: `codex/p2-126-pmv-dashboard`
- Surface: BA-scoped `.team` cockpit PMV activity snapshot
- Component: `apps/team/src/components/cockpit/PmvDashboard.tsx`
- Route integration: `apps/team/src/routes/cockpit.tsx`

## Completed verification

- The existing `/api/cockpit/pmv` route remains authenticated, Steve-gated,
  and scoped by the session BA id.
- Dashboard metrics use only P1-53-authorized activity counts and rates.
- Presentation activity comes from explicit token/click/placement evidence;
  customer or enrollment outcomes alone do not imply that a link opened or a
  presentation started/completed.
- Public copy is checked against the shared PMV analytics forbidden patterns.
- Focused component tests and Team application/test typechecks pass.

## Visual-QA attempt

A fixture-only local preview was started at `127.0.0.1` using the actual
`PmvDashboard` component and synthetic rows. The required in-app browser
automation bridge refused the session because the local browser client was not
trusted. The safety boundary was not bypassed, and no fallback browser was used.

No screenshot was captured after the corrected metric grouping. Therefore
desktop, tablet, mobile, zoom/reflow, and horizontal-overflow checks remain
unchecked.

## Required retest

After the in-app browser client is trusted, render the actual component with
synthetic populated and empty datasets and capture at minimum:

- 1440 × 900 desktop
- 768 × 1024 tablet portrait
- 390 × 844 mobile
- 360 × 800 small mobile
- 200% browser zoom/reflow

Verify no horizontal clipping, clear People/Momentum/Volume/Next Action concept
grouping, legible one-metric groups, stable rate rows, and no earnings, CV,
cycle, placement, spillover, scoring, qualification, prediction, or current
team-count copy.
