# Agent Brief — H-UI (ADMIN Section H Live Operations, UI side)

**Round:** Chat #144 fan-out.
**Branch:** `feat/admin-h-live-ops-ui`
**Worktree:** `D:/mcs-h-ui`
**Sibling agents:** H-server, I-export, G-broadcast (do not coordinate directly
— the shared contract in `packages/shared/src/admin-live-ops.ts` is your only
seam).

---

## What you're building

The /admin Live Operations page — a single route with four panels, all reading
from the H-server endpoints defined by `packages/shared/src/admin-live-ops.ts`.

Leaves you ship (build-checklist #111–114):

- **H.1** Real-time usage strip across the top — active dashboard viewers,
  events/min, persistence p50/p95 — SSE-driven, updates live
- **H.2** Growth stat cards — three cards (24h / 7d / 30d) with deltas
- **H.3** Holding-tank live grid — every active placement, colored by age,
  click a slot to deep-link into the existing 4.D prospect detail panel
  (`/admin/prospects?prospectId={id}`)
- **H.4** Conversion funnel — toggle between prospect funnel and BA
  activation funnel, horizontal funnel bars

---

## Files you own (write here)

- `apps/admin/src/routes/live-ops.tsx` (NEW — the page, mirrors the
  `bas.tsx` / `prospects.tsx` / `queue.tsx` pattern)
- `apps/admin/src/components/admin/live-ops/UsageStrip.tsx` (NEW — H.1)
- `apps/admin/src/components/admin/live-ops/GrowthCards.tsx` (NEW — H.2)
- `apps/admin/src/components/admin/live-ops/HoldingTankGrid.tsx` (NEW — H.3)
- `apps/admin/src/components/admin/live-ops/ConversionFunnel.tsx` (NEW — H.4)
- `apps/admin/src/components/admin/live-ops/useUsageStream.ts` (NEW — SSE
  consumer hook, pattern after the existing dashboard `LiveEventStream.tsx`)
- `apps/admin/src/App.tsx` (EXTEND — register the new `/live-ops` route in
  the admin shell nav; additive only)

## Files you read but never write

- `packages/shared/src/admin-live-ops.ts` — the contract (read all types
  + the `ADMIN_LIVE_OPS_PATHS` constant from `@momentum/shared`)
- `apps/admin/src/components/admin/dashboard/LiveEventStream.tsx` — SSE
  consumer pattern to mirror
- `apps/admin/src/components/admin/dashboard/FilterBar.tsx` — reuse for the
  BA / leader-group filter at the top of the page
- `apps/admin/src/components/admin/queue-oversight/AdminTickerPanel.tsx`
  — another SSE consumer example

## Files you MUST NOT touch

- `CLAUDE.md` (read-only)
- `docs/locked-spec.md`, `docs/project-wireframe.md`, `docs/build-checklist.html`
- `packages/shared/src/admin-live-ops.ts` (the contract; locked)
- `server/**` (H-server's turf)
- Any `routes/admin/reporting.ts` edits (I-export's turf)
- Any `routes/admin/broadcast.ts` edits (G-broadcast's turf, doesn't exist
  yet but will land in another worktree)

---

## Acceptance criteria (verify before you claim done)

1. `pnpm --filter @momentum/admin typecheck` exits 0
2. `pnpm -r typecheck` exits 0
3. The page renders against MOCK data — build a tiny mocks module so the UI
   is reviewable before H-server lands. The mocks satisfy the contract types,
   so when H-server ships you swap the data source line and nothing else.
4. The SSE consumer hook handles: connect, snapshot, heartbeat (no-op),
   disconnect, auto-reconnect with backoff. Mirror `LiveEventStream.tsx`.
5. The grid is 4-bucket color-coded per `AdminLiveGridSlot.ageBucket`:
   fresh (gold C9A84C), warming (teal 2DD4BF), aging (cream F5EFE6 outline),
   stale (ink 0A0A0A border, low-saturation fill). The contract sends the
   bucket; you map bucket → brand color.
6. Click a grid slot → navigate `/admin/prospects?prospectId={prospectId}`.
   That deep-link contract already exists (Agent E #141).

---

## Brand

From `packages/shared/src/brand.ts`:

- Ink `#0A0A0A` · Gold `#C9A84C` · Gold-bright `#F5C030` · Teal `#2DD4BF` ·
  Cream `#F5EFE6`
- Bebas Neue (display) · DM Sans (body) · DM Mono (numbers / tabular data)

/admin is the "back-office terminal" surface per locked-spec 3.15 — quieter
than .com, denser data, less animation. The usage strip pulses; everything
else is calm.

---

## Reference reading order

1. `packages/shared/src/admin-live-ops.ts` — the contract (your bible)
2. `apps/admin/src/routes/queue.tsx` — page composition pattern
3. `apps/admin/src/components/admin/queue-oversight/AdminTickerPanel.tsx` — SSE
   consumer pattern
4. `apps/admin/src/components/admin/dashboard/MetricsRow.tsx` — card layout
   pattern (mirror this for GrowthCards)
5. `docs/Team-Magnificent-ADMIN-Design.docx` Section H — visual intent

When the contract and the design doc disagree, **STOP and tell Kevin**.
