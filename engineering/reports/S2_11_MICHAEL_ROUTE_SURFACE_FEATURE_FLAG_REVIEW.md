# S2.11 Michael Route / Surface / Feature Flag Review

- Sprint: Sprint 2 - Agent Runtime Activation
- Slice: S2.11 Michael First Activation Charter
- Status: PLANNING / GOVERNANCE ONLY
- Architecture version: v1.0 frozen

## 1. Current Route State

The server currently mounts existing route families in `server/src/index.ts`, including health, auth, welcome, onboarding, sponsor workbook, Michael, Steve, admin routes, prospect token routes, RVM/VM routes, invitations, cockpit, CRM, ScriptMaker, Ivory, agents, VM, training, profile, preview, and orientation.

Runtime orchestration remains internal under `server/src/runtime/` and `server/src/runtime/orchestration/`. It is not exposed through a runtime route family.

## 2. `/api/runtime/*` Confirmation

Confirmed: `/api/runtime/*` remains unmounted.

S2.10 confirmed the same route state, and S2.11 does not authorize route mounting.

## 3. S2.11 Route Recommendation

Recommendation: route-free fixture/evaluation only for the next Michael implementation slice.

S2.11 should not approve an internal `.team` route yet. A later slice may prepare an internal `.team` route only after Kevin approves the route family, request/response contract, auth boundary, feature flag, rollback path, and monitoring plan.

## 4. `.team` Surface Requirements If Later Approved

Any later `.team` surface must:

- be authenticated and BA-scoped from the server session;
- stay internal to Brand Ambassadors;
- present Michael as training support only;
- avoid scheduling, interviewing, Steve discovery behavior, Ivory relationship/outreach behavior, and prospect-facing copy;
- support text fallback;
- preserve EN/ES language handling;
- show safe degraded/fallback states when Context Packet quality is missing, degraded, or failed;
- make BA ownership explicit for any suggested next step;
- avoid automatic sends, calls, prospecting, enrollment, or external effects.

No `.team` UI change is approved by S2.11.

## 5. `.com` Exclusion Checks

`.com` remains out of scope.

Before any route or UI exposure, tests must confirm:

- `apps/com/src/` contains no Michael runtime imports;
- `apps/com/src/` contains no `/api/runtime/*` calls;
- `apps/com/src/` contains no Michael training-support activation copy;
- prospect-facing pages contain no AI agent runtime behavior.

## 6. Feature Flag / Kill Switch Requirements

Any later activation must have a single explicit kill switch before live exposure.

Required flag behavior:

- default disabled unless Kevin approves activation;
- disable response generation independently from route availability;
- disable route handling if a route exists;
- return a safe disabled response shape;
- emit no persistent event, outcome, or Guided Action writes;
- preserve Context Packet-only boundaries while disabled;
- be covered by tests.

## 7. Rollback Route-Disable Requirements

If a route is later approved, rollback must include:

- immediate flag disable path;
- removal or disablement of the route mount if necessary;
- verification that `/api/runtime/*` or the approved route returns disabled/not-found behavior;
- confirmation no `.com` surface calls the route;
- confirmation no persistence was written;
- full gate rerun after rollback.

## 8. Required Tests Before Any Route Or UI Exposure

Required tests:

- server entrypoint route test for `/api/runtime/*` unmounted until separately approved;
- `.team` route auth tests if a route is later approved;
- `.team` BA scope tests;
- invalid agent and invalid objective tests;
- complete, degraded, failed, missing, and candidate/review-only Context Packet tests;
- response contract validation tests;
- feature flag enabled/disabled tests;
- rollback disabled-state tests;
- `.com` exclusion scan;
- no direct store, GraphRAG, adapter, Gateway fallback, or retrieval helper imports;
- no Telnyx/PSTN/call-control imports;
- no event/outcome/Guided Action persistence unless separately approved.

## 9. Recommendation To Kevin

Keep S2.11 route-free. Approve the next Michael implementation slice as a fixture/evaluation-only response-contract harness before any internal `.team` route or UI exposure.
