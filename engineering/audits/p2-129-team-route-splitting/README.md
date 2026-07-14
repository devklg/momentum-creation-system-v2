# P2-129 Team Route Splitting

Status: implemented and regression-covered.

## Finding

`apps/team/src/App.tsx` statically imported every public and authenticated page.
Vite therefore emitted one 681.19 kB minified JavaScript entry (185.44 kB gzip)
and raised its greater-than-500 kB chunk warning. A BA opening one route paid the
parse/download cost for the cockpit, VM campaigns, training, Ivory, CRM, event,
resource, profile, and other route surfaces together.

## Implementation

Every page component is now loaded through `React.lazy()` at its route boundary.
The entry chunk retains the router, shell, navigation, VM entitlement gate, and
loading states. Public routes use a full-page suspense fallback; authenticated
routes use a nested fallback inside `TeamShell`, so `TeamNav` stays mounted while
the next page chunk loads.

Manual vendor chunks were not added. Route boundaries address the actual loading
problem and let Rollup share common dependencies naturally without introducing a
second hand-maintained chunk map.

## Result

| Production artifact | Before | After | Change |
|---|---:|---:|---:|
| Initial JS entry | 681.19 kB | 232.23 kB | -65.9% |
| Initial JS entry, gzip | 185.44 kB | 74.95 kB | -59.6% |
| Largest deferred route | none | Cockpit 87.67 kB | route-loaded |
| Vite >500 kB JS warning | present | absent | resolved |

The CSS bundle remains shared at 49.67 kB because route-level Tailwind output is
compiled as one stylesheet; P2-129 targets the JavaScript warning and initial
application execution cost.

## Verification

- Team production build emits the entry plus route chunks and no oversized-JS
  warning.
- `App.route-splitting.test.tsx` verifies the suspense shell resolves to the
  lazy login route and that the entry-owned 404 remains available.
- Team typecheck and test typecheck are green.
