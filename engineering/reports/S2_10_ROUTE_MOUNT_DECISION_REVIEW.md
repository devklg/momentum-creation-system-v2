# S2.10 Route Mount Decision Review

- Sprint: Sprint 2 - Agent Runtime Activation
- Slice: S2.10 Runtime Activation Approval Charter / Decision Gate
- Status: REVIEW / GOVERNANCE ONLY
- Architecture version: v1.0 frozen

## 1. Current Route State

The server currently mounts established route families in `server/src/index.ts`, including health, auth, welcome, onboarding, sponsor workbook, Michael, Steve, admin routes, prospect token routes, RVM/VM routes, invitations, cockpit, CRM, ScriptMaker, Ivory, agents, training, profile, preview, and orientation.

Runtime orchestration code exists under `server/src/runtime/` and `server/src/runtime/orchestration/`, but it remains an inert internal runtime foundation. It is verified by static governance tests and is not exposed through a runtime HTTP route family.

## 2. `/api/runtime/*` Confirmation

Confirmed: `/api/runtime/*` is not mounted.

The S2.9 readiness review confirms this, and the current `server/src/index.ts` route list does not include `/api/runtime`, `/api/runtime/*`, or a runtime route import.

## 3. Is A Route Mount Required For The Next Activation?

No route mount is required for the next governance decision.

The next safe step is to define the first activation slice and its route policy before exposing any runtime surface. The runtime foundation can continue to be tested through direct orchestration calls, fixture harnesses, and `.team` integration planning without mounting a production route.

## 4. Recommended Route Policy

Recommendation: defer the route decision and keep runtime unmounted for the next slice unless Kevin separately approves a route-specific activation charter.

If Kevin approves runtime exposure later, the only acceptable route shape should be an internal authenticated `.team` route with explicit guardrails. It must not be prospect-facing, must not touch `.com`, and must not be mounted as `/api/runtime/*` without a separate approval that names that route family.

## 5. Risks Of Route Mounting

- Route mounting converts inert orchestration into a live callable surface.
- A broad `/api/runtime/*` route could blur boundaries between Steve, Michael, and Ivory before first-agent activation is approved.
- Route exposure raises authorization, identity, tenant/team scope, and rate-limit requirements.
- Route exposure could create accidental response-generation expectations while response generation remains unapproved.
- Route exposure could create pressure to persist events, outcomes, or Guided Actions before persistence is approved.
- Any route reachable from `.com` would violate the Sprint 2 activation boundary.

## 6. Required Route Guardrails If Later Approved

- Route must be `.team` only.
- Route must require authenticated BA identity from the server session.
- Route must preserve Steve-complete or approved onboarding gating where applicable.
- Route must reject caller-supplied BA identity, tenant identity, or agent identity that conflicts with the session.
- Route must call Agent Runtime through the approved orchestration boundary only.
- Route must receive Context Packets only through Context Manager.
- Route must not assemble Context Packets.
- Route must not import MongoDB, Neo4j, ChromaDB, GraphRAG, persistence adapters, Gateway fallback clients, or retrieval helpers.
- Route must return runtime events, outcomes, and Guided Actions only unless persistence is separately approved.
- Route must keep `agentResponseGenerated: false` until response generation is separately approved.
- Route must exclude Telnyx/PSTN/call-control.
- Route must preserve Gateway fallback.

## 7. Required Tests Before Any Route Mount

- Static test proving `/api/runtime/*` remains unmounted until Kevin approves the exact mount.
- Static test proving `.com` contains no runtime route calls, imports, or copy.
- Route auth tests for unauthenticated, wrong BA, wrong team scope, and invalid agent.
- Route validation tests for invalid objective, missing Context Manager response, degraded response, failed response, and candidate/review-only exclusion.
- Boundary tests proving no direct store, GraphRAG, adapter, Gateway fallback, or retrieval access.
- Tests proving no event persistence, outcome persistence, Guided Action persistence, outbox, replay, subscriber, or event API activation.
- Tests proving no Steve/Michael/Ivory behavior or response generation unless separately approved.
- Full gates: `pnpm build:shared`, `pnpm typecheck`, `pnpm build`, and `pnpm --filter @momentum/server test`.

## 8. `.com` Confirmation

Confirmed: `.com` remains out of scope for runtime activation.

No route decision should introduce prospect-facing runtime calls, runtime copy, AI agent language, or `/api/runtime/*` usage from `apps/com`.

## 9. Recommendation To Kevin

Keep the runtime route unmounted through S2.10 and require a separate route-specific approval before any runtime HTTP surface is added.

Recommended next approval shape: approve a first activation target and response policy first; then decide whether that first activation needs an internal `.team` route or can begin with a route-free harness/integration slice.
