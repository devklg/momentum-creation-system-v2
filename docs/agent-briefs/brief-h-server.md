# Agent Brief — H-server (ADMIN Section H Live Operations, server side)

**Round:** Chat #144 fan-out.
**Branch:** `feat/admin-h-live-ops-server`
**Worktree:** `D:/mcs-h-server`
**Sibling agents:** H-UI, I-export, G-broadcast (do not coordinate directly — the
shared contract in `packages/shared/src/admin-live-ops.ts` is your only seam).

---

## What you're building

The server side of /admin Section H Live Operations — four endpoints plus the
domain functions behind them, exactly matching the wire contract in
`packages/shared/src/admin-live-ops.ts`.

Leaves you ship (build-checklist #111–114):

- **H.1** SSE usage strip stream — `GET /api/admin/live-ops/usage/stream`
- **H.2** Growth stat cards — `GET /api/admin/live-ops/growth`
- **H.3** Holding-tank live grid — `GET /api/admin/live-ops/grid`
- **H.4** Conversion funnels — `GET /api/admin/live-ops/funnel?kind=prospect|ba_activation`

---

## Files you own (write here)

- `server/src/routes/admin/liveOps.ts` (NEW — the Express router, mirroring the
  pattern in `server/src/routes/admin/reporting.ts`: `requireAdmin`, filter
  parsing, one `appendAuditEntry` per request)
- `server/src/domain/liveOps.ts` (NEW — the four domain fns:
  `getUsageSample()`, `getGrowthCards(filter)`, `getLiveGrid(filter)`,
  `getFunnel(kind, filter)`)
- `server/src/services/poolEvents.ts` (EXTEND — add a tiny ring-buffer for
  events/min and a counter for `activeAdminSessions`; pattern after the
  existing `activePlacementSubscriberCount`. Additive only. Do NOT change the
  existing public API — H-UI doesn't read this file.)
- `server/src/services/gatewayLatency.ts` (NEW — wraps gateway calls to
  record p50/p95 over a 60s rolling window; tiny module, in-memory only)
- `server/src/server.ts` (EXTEND — mount the new router under `/api/admin`)

## Files you read but never write

- `packages/shared/src/admin-live-ops.ts` — the contract. Import all types
  from `@momentum/shared`. Do not redefine them locally.
- `packages/shared/src/types.ts` — for `AdminDashboardFilter`.
- `server/src/middleware/requireAuth.ts` — `requireAdmin` helper.
- `server/src/domain/auditLog.ts` — `appendAuditEntry`.
- `server/src/routes/admin/reporting.ts` — reference pattern for filter
  parsing + audit logging.

## Files you MUST NOT touch

- `CLAUDE.md` (read-only, root context)
- `docs/locked-spec.md` (Kevin owns)
- `docs/project-wireframe.md` (Kevin owns; landlord updates at merge)
- `docs/build-checklist.html` (regenerated from wireframe at merge)
- `packages/shared/src/admin-live-ops.ts` (the contract; locked once landed)
- `apps/admin/**` (H-UI's turf)
- `server/src/routes/admin/reporting.ts` (I-export's turf for the export
  routes; you have no business in there)
- Any `services/email.ts` or `services/telnyx.ts` edits (G-broadcast)

---

## Acceptance criteria (verify before you claim done)

1. `pnpm --filter @momentum/server typecheck` exits 0
2. `pnpm -r typecheck` exits 0
3. Each of the four endpoints returns a body that satisfies the contract
   types (TypeScript will catch this if your domain fns return the right
   types; verify by running a real GET against a running server)
4. SSE stream emits at least one `snapshot` event and a `heartbeat` within
   35 seconds of connection (you can verify with `curl -N`)
5. Every request appends to the audit log (read back `mcs_audit_log` for
   one of your requests)
6. `activeAdminSessions` increments on connect and decrements on disconnect
   (deterministic; verify with two curl windows)

---

## Provenance notes — honest-partial pattern

Some data sources don't exist yet. Follow the #143 pattern: build the
structure correctly, return an honest empty result with a `provenanceNote`
field when the source is missing. Do NOT invent data. Do NOT block waiting
for sources.

Likely candidates that may need provenance notes:
- **eventsPerMinute** — if no centralized event firehose exists yet, count
  placements/min via `poolEvents` and call it placements-per-minute in the
  note. Adjust the response key only if the contract allows.
- **gatewayLatencyMs** — if you can't wrap every gateway call cleanly,
  start with the calls in `tripleStack.ts` and call out the scope.
- **BA-activation funnel stages without timestamps** — same pattern as
  `reporting.ts` Report #1 (which already handles this); reuse.

---

## Reference reading order

1. `packages/shared/src/admin-live-ops.ts` — the contract (your bible)
2. `server/src/routes/admin/reporting.ts` — route pattern to mirror
3. `server/src/domain/reports/baActivation.ts` — domain fn pattern
4. `server/src/services/poolEvents.ts` — the SSE pub/sub you extend
5. `docs/locked-spec.md` §3.10 — compliance posture (no income/CV math
   anywhere; H is /admin-only so the CV exception holds, but never assume)
6. `docs/Team-Magnificent-ADMIN-Design.docx` Section H — if anything in the
   contract is ambiguous, the design doc wins, raise it to Kevin

When the contract and the design doc disagree, **STOP and tell Kevin**. Do not
resolve drift unilaterally.
